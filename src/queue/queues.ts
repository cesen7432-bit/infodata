import { Queue, QueueEvents } from "bullmq";
import { Source } from "@prisma/client";
import { queueConnection } from "./connection";

export interface ConsultaJobData {
  identification: string;
  // true cuando la dispara un lote de admin: ignora caché y siempre re-scrapea (sección 08 del plan)
  forceRefresh?: boolean;
  bulkJobItemId?: string;
}

// BullMQ prohíbe ":" tanto en el nombre de la cola como en jobId (lo usa
// como separador de namespace en las claves de Redis) — cualquiera de los
// dos con ":" revienta con "Custom Id cannot contain :".
const queueName = (source: Source) => `consulta-${source.toLowerCase()}`;

const queues = new Map<Source, Queue<ConsultaJobData>>();

export function getQueue(source: Source): Queue<ConsultaJobData> {
  let queue = queues.get(source);
  if (!queue) {
    queue = new Queue<ConsultaJobData>(queueName(source), { connection: queueConnection });
    queues.set(source, queue);
  }
  return queue;
}

export function queueNameFor(source: Source): string {
  return queueName(source);
}

const queueEvents = new Map<Source, QueueEvents>();

/** Necesario para poder hacer `job.waitUntilFinished(...)` desde la API. */
export function getQueueEvents(source: Source): QueueEvents {
  let events = queueEvents.get(source);
  if (!events) {
    events = new QueueEvents(queueName(source), { connection: queueConnection });
    queueEvents.set(source, events);
  }
  return events;
}

/**
 * Encola una consulta con jobId determinista `${fuente}-${identificacion}` —
 * BullMQ ignora un job nuevo si ya existe uno activo/en espera con el mismo id,
 * lo que da deduplicación in-flight gratis (plan, sección 04).
 *
 * Pero ese mismo id determinista, combinado con `removeOnComplete`/`removeOnFail`
 * (que conservan historial en vez de borrar al toque), significa que un job
 * que YA terminó (completed o failed) se queda ocupando ese id — y BullMQ no
 * crea uno nuevo mientras exista, así que un refresco posterior (búsqueda
 * normal pasado el TTL de caché, o "forzar" desde consulta masiva) quedaba
 * encolado en apariencia pero nunca se ejecutaba. Se limpia el job viejo
 * antes de reencolar, pero solo si ya está en estado terminal — uno todavía
 * activo/en espera se deja intacto para no romper la dedup in-flight.
 */
export async function enqueueConsulta(
  source: Source,
  identification: string,
  opts: { forceRefresh?: boolean; bulkJobItemId?: string } = {}
) {
  const queue = getQueue(source);
  const jobId = `${source}-${identification}`;

  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed" || state === "failed") {
      await existing.remove();
    }
  }

  return queue.add(
    "consulta",
    { identification, forceRefresh: opts.forceRefresh ?? false, bulkJobItemId: opts.bulkJobItemId },
    {
      jobId,
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    }
  );
}
