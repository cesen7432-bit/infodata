import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { createApiKey, InvalidDomainError, listApiKeys, revokeApiKey } from "./apiKeys.service";

export const apiKeysRouter = Router();

apiKeysRouter.use(requireAuth, requireRole(Role.ADMIN));

apiKeysRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listApiKeys());
  })
);

const createSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(80),
  domains: z.array(z.string().trim().min(1)).max(20).optional().default([]),
});

apiKeysRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const created = await createApiKey({
        name: parsed.data.name,
        domains: parsed.data.domains,
        createdById: req.user!.id,
      });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof InvalidDomainError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  })
);

apiKeysRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const ok = await revokeApiKey(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Clave no encontrada o ya revocada" });
      return;
    }
    res.status(204).end();
  })
);
