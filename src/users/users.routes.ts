import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { createUser, deleteUser, EmailInUseError, listUsers, updateUser } from "./users.service";

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole(Role.ADMIN));

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await listUsers());
  })
);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.nativeEnum(Role).default(Role.USER),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      const user = await createUser({ ...parsed.data, createdById: req.user!.id });
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof EmailInUseError) {
        res.status(409).json({ error: "Ese email ya está registrado" });
        return;
      }
      throw err;
    }
  })
);

const updateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const user = await updateUser(req.params.id, parsed.data);
    res.json(user);
  })
);

usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await deleteUser(req.params.id);
    res.status(204).end();
  })
);
