import crypto from "crypto";
import { prisma } from "../db/prisma";

/**
 * Clave de API opaca, mismo criterio que el token de sesión: bytes al azar,
 * sin payload, sin firma. Lo único que se persiste es el hash SHA-256; el
 * valor en claro se devuelve una sola vez al crearla. El prefijo `dc_live_`
 * la hace reconocible en logs/headers y permite distinguirla de un token de
 * sesión en el mismo header Authorization.
 */
const API_KEY_PREFIX = "dc_live_";

export function isApiKey(candidate: string): boolean {
  return candidate.startsWith(API_KEY_PREFIX);
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; keyPrefix: string; keyHash: string } {
  const key = API_KEY_PREFIX + crypto.randomBytes(24).toString("base64url");
  // Suficiente para reconocer la clave en la UI sin exponerla entera.
  const keyPrefix = key.slice(0, API_KEY_PREFIX.length + 6);
  return { key, keyPrefix, keyHash: hashApiKey(key) };
}

export async function findActiveApiKey(key: string) {
  if (!isApiKey(key)) return null;
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!apiKey || apiKey.revokedAt) return null;
  return apiKey;
}

/** Marca de uso — best-effort, nunca frena ni rompe la request si falla. */
export function touchApiKey(id: string): void {
  void prisma.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } }).catch(() => {});
}

/**
 * Normaliza lo que el admin escriba ("https://www.Ejemplo.com/", "ejemplo.com")
 * a un host limpio y comparable. Devuelve null si no parece un dominio.
 */
export function normalizeDomain(raw: string): string | null {
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
  if (value.startsWith("www.")) value = value.slice(4);
  // Un dominio real tiene al menos un punto y solo caracteres válidos de host.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(value)) return null;
  return value;
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * ¿La request viene de un origen permitido para esta clave?
 * - Sin dominios configurados → siempre sí (uso servidor-a-servidor).
 * - Con dominios → el host del Origin (o, si no hay, del Referer) tiene que
 *   ser exactamente uno de la lista o un subdominio de alguno.
 */
export function isOriginAllowed(
  allowedDomains: string[],
  origin: string | undefined,
  referer: string | undefined
): boolean {
  if (allowedDomains.length === 0) return true;
  const host = hostOf(origin) ?? hostOf(referer);
  if (!host) return false;
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
