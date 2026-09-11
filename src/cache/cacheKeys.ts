import { Source } from "@prisma/client";

export function resultCacheKey(source: Source, identification: string): string {
  return `cache:${source.toLowerCase()}:${identification}`;
}

// TTL por fuente — ver plan de arquitectura, sección 04.
export const RESULT_TTL_SECONDS: Record<Source, number> = {
  DATADIVERSERVICE: 24 * 60 * 60,
  SATJE: 6 * 60 * 60,
  SRI: 24 * 60 * 60,
  ANT: 6 * 60 * 60,
};

export const NOT_FOUND_TTL_SECONDS: Record<Source, number> = {
  DATADIVERSERVICE: 2 * 60,
  SATJE: 2 * 60,
  SRI: 5 * 60,
  ANT: 5 * 60,
};
