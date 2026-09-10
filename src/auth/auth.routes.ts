import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "./auth.middleware";
import { InvalidCredentialsError, login, logout } from "./auth.service";

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
