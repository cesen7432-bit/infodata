import { Job, Worker } from "bullmq";
import { BulkItemStatus, Source } from "@prisma/client";
import { queueConnection } from "../queue/connection";
import { ConsultaJobData, queueNameFor } from "../queue/queues";
import { setCachedResult } from "../cache/resultCache";
import { getSourceHandler, QUEUE_CONCURRENCY } from "../scrapers/registry";
import { prisma } from "../db/prisma";
import { logger } from "../lib/logger";

async function markBulkItem(id: string, status: BulkItemStatus, errorMessage?: string): Promise<void> {
  await prisma.bulkJobItem
    .update({ where: { id }, data: { status, errorMessage, completedAt: new Date() } })
    .catch((err) => logger.warn("no se pudo actualizar BulkJobItem", { id, error: err.message }));
}

/**
 * Un Worker por fuente, todos con la misma forma: llama al handler registrado
 * (fetch → persist), cachea el resultado y — si el job viene de un lote de
 * admin — deja constancia del resultado en su BulkJobItem.
 */
export function createSourceWorker(source: Source): Worker<ConsultaJobData> {
  const handler = getSourceHandler(source);
  const label = source.toLowerCase();

  const worker = new Worker<ConsultaJobData>(
    queueNameFor(source),
    async (job: Job<ConsultaJobData>) => {
      const { identification, bulkJobItemId } = job.data;
      logger.info(`[worker:${label}] procesando`, { identification, jobId: job.id });

      const outcome = await handler.fetch(identification);

      if (outcome.blockedCaptcha) {
        logger.warn(`[worker:${label}] bloqueado por CAPTCHA`, { identification });
        if (bulkJobItemId) await markBulkItem(bulkJobItemId, BulkItemStatus.BLOCKED_CAPTCHA);
        return { found: false, blockedCaptcha: true, data: null };
      }

      if (!outcome.found) {
        await setCachedResult(source, identification, null, true);
        if (bulkJobItemId) await markBulkItem(bulkJobItemId, BulkItemStatus.OK);
        return { found: false, data: null };
      }

      const consolidated = await handler.persist(identification, outcome.raw);
      await setCachedResult(source, identification, consolidated, false);
      if (bulkJobItemId) await markBulkItem(bulkJobItemId, BulkItemStatus.OK);
      return { found: true, data: consolidated };
    },
    { connection: queueConnection, concurrency: QUEUE_CONCURRENCY[source] }
  );

  worker.on("failed", async (job, err) => {
    logger.error(`[worker:${label}] job falló`, { jobId: job?.id, error: err.message });
    const bulkJobItemId = job?.data.bulkJobItemId;
    if (bulkJobItemId) await markBulkItem(bulkJobItemId, BulkItemStatus.FAILED, err.message);
  });

  return worker;
}
