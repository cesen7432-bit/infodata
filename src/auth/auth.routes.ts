import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "./auth.middleware";
import { changeOwnPassword, InvalidCredentialsError, login, logout } from "./auth.service";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "email y password son requeridos" });
      return;
    }

    try {
      const { token, role, email } = await login(parsed.data.email, parsed.data.password);
      res.json({ token, role, email });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: "Credenciales inválidas" });
        return;
      }
      throw err;
    }
  })
);

/** Revoca la sesión actual en BD — a partir de este momento el token deja de servir, no espera a expirar solo. */
authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await logout(req.authToken!);
    res.status(204).end();
  })
);

/** Para rehidratar la sesión al recargar la página sin volver a pedir login. */
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

/** Cualquier usuario logueado cambia su propia contraseña — requiere la actual. */
authRouter.patch(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    try {
      await changeOwnPassword(req.user!.id, parsed.data.currentPassword, parsed.data.newPassword);
      res.status(204).end();
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        res.status(401).json({ error: "La contraseña actual no es correcta" });
        return;
      }
      throw err;
    }
  })
);
