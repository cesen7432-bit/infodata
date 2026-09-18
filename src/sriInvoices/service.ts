import { prisma } from "../db/prisma";
import { logger } from "../lib/logger";
import { enqueueSriInvoiceJob } from "../queue/sriInvoiceQueue";
import { DocumentTypeCode, Period } from "./types";

export interface CreateSriInvoiceJobParams {
  requestedById: string;
  ruc: string;
  password: string;
  documentType: DocumentTypeCode;
  from: Period;
  to: Period;
}

export async function createSriInvoiceJob(params: CreateSriInvoiceJobParams) {
  const job = await prisma.sriInvoiceJob.create({
    data: {
      requestedById: params.requestedById,
      ruc: params.ruc,
      documentType: params.documentType,
      periodFromYear: params.from.year,
      periodFromMonth: params.from.month,
      periodToYear: params.to.year,
      periodToMonth: params.to.month,
    },
  });

  // La contraseña solo viaja acá, hacia la cola — nunca se guarda en Postgres.
  await enqueueSriInvoiceJob({
    jobId: job.id,
    ruc: params.ruc,
    password: params.password,
    documentType: params.documentType,
    from: params.from,
    to: params.to,
  }).catch(async (err) => {
    logger.error("no se pudo encolar la descarga de comprobantes", { jobId: job.id, error: err.message });
    await prisma.sriInvoiceJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: "No se pudo encolar el job", completedAt: new Date() },
    });
  });

  return job;
}

export async function getSriInvoiceJob(jobId: string, requestedById: string) {
  const job = await prisma.sriInvoiceJob.findUnique({ where: { id: jobId } });
  if (!job || job.requestedById !== requestedById) return null;
  return job;
}

export async function listSriInvoiceJobs(requestedById: string) {
  return prisma.sriInvoiceJob.findMany({
    where: { requestedById },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      ruc: true,
      documentType: true,
      periodFromYear: true,
      periodFromMonth: true,
      periodToYear: true,
      periodToMonth: true,
      status: true,
      totalFound: true,
      totalDownloaded: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  });
}
