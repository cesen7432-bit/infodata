import { prisma } from "../db/prisma";
import { generateApiKey, normalizeDomain } from "../auth/apiKey";

export class InvalidDomainError extends Error {}

export async function listApiKeys() {
  return prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      allowedDomains: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

/** Devuelve la clave en claro UNA sola vez — después solo queda el hash. */
export async function createApiKey(params: { name: string; domains: string[]; createdById: string }) {
  const allowedDomains: string[] = [];
  for (const raw of params.domains) {
    const normalized = normalizeDomain(raw);
    if (!normalized) throw new InvalidDomainError(`Dominio inválido: "${raw}"`);
    if (!allowedDomains.includes(normalized)) allowedDomains.push(normalized);
  }

  const { key, keyPrefix, keyHash } = generateApiKey();
  const record = await prisma.apiKey.create({
    data: { name: params.name, keyPrefix, keyHash, allowedDomains, createdById: params.createdById },
    select: { id: true, name: true, keyPrefix: true, allowedDomains: true, createdAt: true },
  });
  return { ...record, key };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
