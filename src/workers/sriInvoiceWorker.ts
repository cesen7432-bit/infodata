import { Job, Worker } from "bullmq";
import { queueConnection } from "../queue/connection";
import { SRI_INVOICE_QUEUE_NAME, SriInvoiceQueueData } from "../queue/sriInvoiceQueue";
import { runSriInvoiceJob } from "../sriInvoices/job";
import { prisma } from "../db/prisma";
import { logger } from "../lib/logger";
import { env } from "../config/env";

/**
 * Un solo worker (no uno por fuente como genericWorker.ts) — esto no es una
 * "fuente" del expediente, es un job de exportación puntual. Concurrencia
 * baja a propósito (QUEUE_CONCURRENCY_SRI_INVOICES): cada corrida es un
 * login real de contribuyente, no conviene machacar el portal del SRI con
 * varios logins simultáneos.
 */
export function createSriInvoiceWorker(): Worker<SriInvoiceQueueData> {
  const worker = new Worker<SriInvoiceQueueData>(
    SRI_INVOICE_QUEUE_NAME,
    async (job: Job<SriInvoiceQueueData>) => {
      const { jobId, ruc, password, documentType, from, to } = job.data;
      logger.info("[worker:sri-invoices] procesando", { jobId, ruc, documentType, from, to });

      await prisma.sriInvoiceJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });

      try {
        const result = await runSriInvoiceJob({ jobId, ruc, password, documentType, from, to }, async (progress) => {
          await prisma.sriInvoiceJob
            .update({ where: { id: jobId }, data: { totalFound: progress.totalFound, totalDownloaded: progress.totalDownloaded } })
            .catch(() => {});
        });

        await prisma.sriInvoiceJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            resultFilePath: result.resultFilePath,
            totalFound: result.totalFound,
            totalDownloaded: result.totalDownloaded,
            completedAt: new Date(),
          },
        });

        return { ok: true };
      } catch (err) {
        logger.error("[worker:sri-invoices] job falló", { jobId, error: (err as Error).message });
        await prisma.sriInvoiceJob.update({
          where: { id: jobId },
          data: { status: "FAILED", errorMessage: (err as Error).message, completedAt: new Date() },
        });
        throw err;
      }
    },
    { connection: queueConnection, concurrency: env.QUEUE_CONCURRENCY_SRI_INVOICES }
  );

  worker.on("failed", (job, err) => {
    logger.error("[worker:sri-invoices] job falló (evento)", { jobId: job?.data.jobId, error: err.message });
  });

  return worker;
}
