import { BulkItemStatus, BulkJobStatus, Source } from "@prisma/client";
import { prisma } from "../db/prisma";
import { enqueueConsulta, getQueue } from "../queue/queues";
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

/**
 * Cancela un lote en curso: los items que todavía no arrancó ningún worker
 * (PENDING/RUNNING en la BD, "waiting"/"delayed" en BullMQ) se sacan de la
 * cola y quedan marcados CANCELLED. Un item cuyo job ya está "active" (un
 * worker ya está a mitad de un scrape) no se puede interrumpir de forma
 * segura — se deja terminar solo; si termina después de esto, su resultado
 * (OK/FAILED) va a pisar el CANCELLED que le pusimos acá.
 */
export async function cancelBulkJob(jobId: string) {
  const bulkJob = await prisma.bulkJob.findUnique({ where: { id: jobId }, include: { items: true } });
  if (!bulkJob) return null;

  const finished: BulkJobStatus[] = [BulkJobStatus.COMPLETED, BulkJobStatus.COMPLETED_WITH_ERRORS, BulkJobStatus.CANCELLED];
  if (finished.includes(bulkJob.status)) return bulkJob;

  const openItems = bulkJob.items.filter((i) => i.status === BulkItemStatus.PENDING || i.status === BulkItemStatus.RUNNING);

  await Promise.all(
    openItems.map(async (item) => {
      const queueJobId = `${item.source}-${item.identification}`;
      try {
        const job = await getQueue(item.source).getJob(queueJobId);
        if (!job) return;
        const state = await job.getState();
        if (state === "waiting" || state === "delayed") await job.remove();
      } catch (err) {
        logger.warn("no se pudo remover job de la cola al cancelar lote", { queueJobId, error: (err as Error).message });
      }
    })
  );

  await prisma.bulkJobItem.updateMany({
    where: { bulkJobId: jobId, status: { in: [BulkItemStatus.PENDING, BulkItemStatus.RUNNING] } },
    data: { status: BulkItemStatus.CANCELLED, errorMessage: "Cancelado por el usuario", completedAt: new Date() },
  });

  return prisma.bulkJob.update({ where: { id: jobId }, data: { status: BulkJobStatus.CANCELLED, completedAt: new Date() } });
}

export async function getBulkJobStatus(jobId: string) {
  const bulkJob = await prisma.bulkJob.findUnique({ where: { id: jobId }, include: { items: true } });
  if (!bulkJob) return null;

  const counts = { pendientes: 0, completados: 0, fallidos: 0, bloqueadosCaptcha: 0, cancelados: 0 };
  for (const item of bulkJob.items) {
    if (item.status === BulkItemStatus.OK) counts.completados++;
    else if (item.status === BulkItemStatus.FAILED) counts.fallidos++;
    else if (item.status === BulkItemStatus.BLOCKED_CAPTCHA) counts.bloqueadosCaptcha++;
    else if (item.status === BulkItemStatus.CANCELLED) counts.cancelados++;
    else counts.pendientes++;
  }

  const isDone = counts.pendientes === 0;
  // Un lote ya CANCELLED no vuelve a recalcularse — cancelar es un estado final
  // que puede convivir con items que igual terminaron OK/FAILED después.
  const finalStatus =
    bulkJob.status === BulkJobStatus.CANCELLED
      ? BulkJobStatus.CANCELLED
      : !isDone
        ? BulkJobStatus.RUNNING
        : counts.fallidos > 0 || counts.bloqueadosCaptcha > 0
          ? BulkJobStatus.COMPLETED_WITH_ERRORS
          : BulkJobStatus.COMPLETED;

  if (isDone && bulkJob.status !== finalStatus && bulkJob.status !== BulkJobStatus.CANCELLED) {
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
