import { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { findActiveSession } from "./session";
import { findActiveApiKey, isApiKey, isOriginAllowed, touchApiKey } from "./apiKey";

/**
 * Única fuente de verdad: la tabla `sessions`. El token no es un JWT (no hay
 * nada que verificar sin BD), así que no hay atajo — cada request golpea la
 * sesión + usuario en una sola consulta. Si fue revocada (logout, o un admin
 * que desactivó/degradó a este usuario), el token deja de servir de inmediato.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Falta el token de autenticación" });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const session = await findActiveSession(token);
    if (!session) {
      res.status(401).json({ error: "Sesión inválida, cerrada o cuenta desactivada" });
      return;
    }

    req.user = { id: session.user.id, email: session.user.email, role: session.user.role };
    req.authToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Para el endpoint consolidado y nada más: acepta una sesión de usuario
 * (Bearer <token>) **o** una API key de integración (header `X-API-Key`, o
 * `Bearer dc_live_...`). La API key no tiene usuario asociado — `req.user`
 * queda undefined — así que quien la use no registra historial ni pasa
 * ningún chequeo de rol.
 */
export async function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const headerAuth = req.headers.authorization;
  const rawKey =
    (typeof req.headers["x-api-key"] === "string" ? (req.headers["x-api-key"] as string) : undefined) ??
    (headerAuth?.startsWith("Bearer ") && isApiKey(headerAuth.slice("Bearer ".length))
      ? headerAuth.slice("Bearer ".length)
      : undefined);

  if (rawKey) {
    try {
      const apiKey = await findActiveApiKey(rawKey.trim());
      if (!apiKey) {
        res.status(401).json({ error: "API key inválida o revocada" });
        return;
      }
      if (!isOriginAllowed(apiKey.allowedDomains, req.headers.origin, req.headers.referer)) {
        res.status(403).json({ error: "Esta API key no está autorizada para este dominio" });
        return;
      }
      req.apiKey = { id: apiKey.id, name: apiKey.name };
      touchApiKey(apiKey.id);
      next();
    } catch (err) {
      next(err);
    }
    return;
  }

  return requireAuth(req, res, next);
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "No tienes permiso para esta acción" });
      return;
    }
    next();
  };
}
