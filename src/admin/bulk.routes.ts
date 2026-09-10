import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { SOURCE_SLUGS, ALL_SOURCES } from "../scrapers/registry";
import { createBulkJob, getBulkJobStatus, listBulkJobs } from "./bulk.service";

export const bulkRouter = Router();

bulkRouter.use(requireAuth, requireRole(Role.ADMIN));

// Disparar un lote es la acción con más riesgo de bloqueo por IP (plan, sección 08)
// — límite aparte y más estricto que el resto de la API.
const bulkLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

const createSchema = z.object({
  cedulas: z.array(z.string().min(1)).min(1).max(5000),
  fuentes: z.array(z.enum(Object.keys(SOURCE_SLUGS) as [string, ...string[]])).optional(),
});

bulkRouter.post(
  "/",
  bulkLimiter,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const sources = parsed.data.fuentes?.length ? parsed.data.fuentes.map((slug) => SOURCE_SLUGS[slug]) : ALL_SOURCES;

    const bulkJob = await createBulkJob({
      identifications: parsed.data.cedulas,
      sources,
      requestedById: req.user!.id,
    });

    res.status(202).json({ jobId: bulkJob.id, totalItems: bulkJob.totalItems });
  })
);

bulkRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listBulkJobs());
  })
);

bulkRouter.get(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const status = await getBulkJobStatus(req.params.jobId);
    if (!status) {
      res.status(404).json({ error: "Lote no encontrado" });
      return;
    }
    res.json(status);
  })
);
