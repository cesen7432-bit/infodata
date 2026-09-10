import crypto from "crypto";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

/**
 * Token de sesión opaco: 256 bits al azar, sin firmar y sin payload — no es
 * un JWT. No hay nada que verificar client-side porque no hay nada que
 * "decodificar"; la única fuente de verdad es la fila en `sessions`. Evita
 * cargar con un secreto de firma (JWT_SECRET) que, dado que igual se golpea
 * la BD en cada request, no aportaba ninguna garantía extra.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Nunca se guarda el token en texto plano — un hash alcanza para buscar por igualdad exacta. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export async function createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
}

/** Sesión + usuario en una sola consulta — es la fuente de verdad de requireAuth. */
export async function findActiveSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.user.isActive) return null;

  return session;
}

export async function revokeSession(token: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Cierra todas las sesiones activas de un usuario — al desactivarlo, cambiarle el rol o la contraseña. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
