import { Source } from "@prisma/client";
import { getCachedResult, setCachedResult } from "../cache/resultCache";
import { getConsolidatedPerson, getSourceFreshness } from "../db/personRepository";
import { enqueueConsulta, getQueueEvents } from "../queue/queues";
import { RESULT_TTL_SECONDS } from "../cache/cacheKeys";
import { logger } from "../lib/logger";

export interface ConsultaResponse {
  source: Source;
  identification: string;
  found: boolean;
  blockedCaptcha?: boolean;
  resolvedFrom: "cache" | "db" | "live";
  data: unknown;
}

/**
 * Cascada de resolución (plan, sección 03): caché en Redis → Postgres si está
 * fresco → si no, se encola y se espera el resultado del worker.
 */
export async function resolveConsulta(
  source: Source,
  identification: string,
  opts: { forceRefresh?: boolean } = {}
): Promise<ConsultaResponse> {
  if (!opts.forceRefresh) {
    const cached = await getCachedResult(source, identification);
    if (cached) {
      logger.debug("consulta resuelta desde caché", { source, identification });
      return { source, identification, found: !cached.notFound, resolvedFrom: "cache", data: cached.data };
    }

    const person = await getConsolidatedPerson(identification);
    if (person) {
      const lastSeen = await getSourceFreshness(person.id, source);
      const ttlMs = RESULT_TTL_SECONDS[source] * 1000;
      if (lastSeen && Date.now() - lastSeen.getTime() < ttlMs) {
        await setCachedResult(source, identification, person, false);
        return { source, identification, found: true, resolvedFrom: "db", data: person };
      }
    }
  }

  const job = await enqueueConsulta(source, identification, { forceRefresh: opts.forceRefresh });
  const result = (await job.waitUntilFinished(getQueueEvents(source), 90_000)) as {
    found: boolean;
    blockedCaptcha?: boolean;
    data: unknown;
  };

  return {
    source,
    identification,
    found: result.found,
    blockedCaptcha: result.blockedCaptcha,
    resolvedFrom: "live",
    data: result.data,
  };
}
