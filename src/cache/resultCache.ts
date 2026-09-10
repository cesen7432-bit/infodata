import { Source } from "@prisma/client";
import { redis } from "./redis";
import { NOT_FOUND_TTL_SECONDS, RESULT_TTL_SECONDS, resultCacheKey } from "./cacheKeys";

export interface CachedEnvelope<T> {
  notFound: boolean;
  data: T | null;
  cachedAt: string;
}

export async function getCachedResult<T>(
  source: Source,
  identification: string
): Promise<CachedEnvelope<T> | null> {
  const raw = await redis.get(resultCacheKey(source, identification));
  if (!raw) return null;
  return JSON.parse(raw) as CachedEnvelope<T>;
}

export async function setCachedResult<T>(
  source: Source,
  identification: string,
  data: T | null,
  notFound: boolean
): Promise<void> {
  const envelope: CachedEnvelope<T> = { notFound, data, cachedAt: new Date().toISOString() };
  const ttl = notFound ? NOT_FOUND_TTL_SECONDS[source] : RESULT_TTL_SECONDS[source];
  await redis.set(resultCacheKey(source, identification), JSON.stringify(envelope), "EX", ttl);
}

export async function invalidateCachedResult(source: Source, identification: string): Promise<void> {
  await redis.del(resultCacheKey(source, identification));
}
