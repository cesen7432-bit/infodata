import { BulkItemStatus, BulkJobStatus, Source } from "@prisma/client";
import { prisma } from "../db/prisma";
import { enqueueConsulta } from "../queue/queues";
import { getSourceHandler } from "../scrapers/registry";
import { logger } from "../lib/logger";

/**
 * Crea el lote y encola un job por cédula × fuente. La consulta masiva
 * siempre ignora el caché (forceRefresh) — si el admin la disparó es porque
 * quiere el dato de hoy (plan, sección 04).
 */
export async function createBulkJob(params: {
  identifications: string[];
  sources: Source[];
  requestedById: string;
}) {
  const unique = Array.from(new Set(params.identifications.map((c) => c.trim()).filter(Boolean)));

  const bulkJob = await prisma.bulkJob.create({
    data: {
      requestedById: params.requestedById,
      totalItems: unique.length * params.sources.length,
      status: BulkJobStatus.RUNNING,
    },
  });

  for (const identification of unique) {
    for (const source of params.sources) {
      const handler = getSourceHandler(source);
      const item = await prisma.bulkJobItem.create({
        data: { bulkJobId: bulkJob.id, identification, source, status: BulkItemStatus.PENDING },
      });

      if (!handler.validateIdentification(identification)) {
        await prisma.bulkJobItem.update({
          where: { id: item.id },
          data: {
            status: BulkItemStatus.FAILED,
            errorMessage: "Identificación con formato inválido para esta fuente",
            completedAt: new Date(),
          },
        });
        continue;
      }

      await enqueueConsulta(source, identification, { forceRefresh: true, bulkJobItemId: item.id }).catch((err) =>
        logger.error("no se pudo encolar item del lote", { identification, source, error: err.message })
      );
    }
  }

  logger.info("lote de consulta masiva creado", { bulkJobId: bulkJob.id, totalItems: bulkJob.totalItems });
  return bulkJob;
}

export async function getBulkJobStatus(jobId: string) {
  const bulkJob = await prisma.bulkJob.findUnique({ where: { id: jobId }, include: { items: true } });
  if (!bulkJob) return null;

  const counts = { pendientes: 0, completados: 0, fallidos: 0, bloqueadosCaptcha: 0 };
  for (const item of bulkJob.items) {
    if (item.status === BulkItemStatus.OK) counts.completados++;
    else if (item.status === BulkItemStatus.FAILED) counts.fallidos++;
    else if (item.status === BulkItemStatus.BLOCKED_CAPTCHA) counts.bloqueadosCaptcha++;
    else counts.pendientes++;
  }

  const isDone = counts.pendientes === 0;
  const finalStatus = !isDone
    ? BulkJobStatus.RUNNING
    : counts.fallidos > 0 || counts.bloqueadosCaptcha > 0
      ? BulkJobStatus.COMPLETED_WITH_ERRORS
      : BulkJobStatus.COMPLETED;

  if (isDone && bulkJob.status !== finalStatus) {
    await prisma.bulkJob.update({ where: { id: bulkJob.id }, data: { status: finalStatus, completedAt: new Date() } });
  }

  return {
    id: bulkJob.id,
    totalItems: bulkJob.totalItems,
    status: finalStatus,
    counts,
    createdAt: bulkJob.createdAt,
    items: bulkJob.items.map((i) => ({
      identification: i.identification,
      source: i.source,
      status: i.status,
      errorMessage: i.errorMessage,
      completedAt: i.completedAt,
    })),
  };
}

export async function listBulkJobs() {
  return prisma.bulkJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, totalItems: true, status: true, createdAt: true, completedAt: true, requestedById: true },
  });
}
