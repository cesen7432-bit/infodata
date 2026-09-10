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
 */
export async function enqueueConsulta(
  source: Source,
  identification: string,
  opts: { forceRefresh?: boolean; bulkJobItemId?: string } = {}
) {
  const queue = getQueue(source);
  const jobId = `${source}-${identification}`;
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
