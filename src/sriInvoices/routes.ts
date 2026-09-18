import { Router } from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { createSriInvoiceJob, getSriInvoiceJob, listSriInvoiceJobs } from "./service";
import { DOCUMENT_TYPES, isDocumentTypeCode } from "./types";

export const sriInvoicesRouter = Router();

sriInvoicesRouter.use(requireAuth, requireRole(Role.ADMIN));

// Cada solicitud es un login real contra el SRI con la contraseña del
// contribuyente — límite bien estricto para no arriesgar que el portal
// bloquee la cuenta por intentos repetidos.
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

const periodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

const createSchema = z.object({
  ruc: z.string().min(10).max(13),
  password: z.string().min(1),
  documentType: z.number().int().refine(isDocumentTypeCode, "Tipo de comprobante desconocido"),
  from: periodSchema,
  to: periodSchema,
});

sriInvoicesRouter.get(
  "/tipos-comprobante",
  asyncHandler(async (_req, res) => {
    res.json(Object.entries(DOCUMENT_TYPES).map(([value, label]) => ({ value: Number(value), label })));
  })
);

sriInvoicesRouter.post(
  "/",
  createLimiter,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { from, to } = parsed.data;
    if (from.year > to.year || (from.year === to.year && from.month > to.month)) {
      res.status(400).json({ error: "El período 'desde' no puede ser posterior a 'hasta'" });
      return;
    }

    const job = await createSriInvoiceJob({ ...parsed.data, requestedById: req.user!.id });
    res.status(202).json({ jobId: job.id });
  })
);

sriInvoicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listSriInvoiceJobs(req.user!.id));
  })
);

sriInvoicesRouter.get(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const job = await getSriInvoiceJob(req.params.jobId, req.user!.id);
    if (!job) {
      res.status(404).json({ error: "Job no encontrado" });
      return;
    }
    res.json(job);
  })
);

sriInvoicesRouter.get(
  "/:jobId/descargar",
  asyncHandler(async (req, res) => {
    const job = await getSriInvoiceJob(req.params.jobId, req.user!.id);
    if (!job || job.status !== "COMPLETED" || !job.resultFilePath) {
      res.status(404).json({ error: "El archivo todavía no está listo o no existe" });
      return;
    }
    if (!fs.existsSync(job.resultFilePath)) {
      res.status(404).json({ error: "El archivo ya no está disponible (pudo haberse limpiado)" });
      return;
    }

    res.download(job.resultFilePath, `comprobantes-${job.ruc}-${job.id}.zip`);
  })
);
