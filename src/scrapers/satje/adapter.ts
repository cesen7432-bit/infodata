import { Source } from "@prisma/client";
import { resolveCedulaFromIdentification } from "../../lib/ecuadorId";
import { FetchOutcome, JudicialCaseInput, SourceHandler } from "../types/scraper.types";
import { buscarCausas, getAllActuacionesForJuicio, getInformacionJuicio } from "./http";
import { getConsolidatedPerson, syncJudicialCases, upsertPersonIdentity } from "../../db/personRepository";
import { logger } from "../../lib/logger";

interface EnrichedCausa {
  idJuicio?: string;
  numeroDemanda?: string;
  numeroCausa?: string;
  provincia?: string;
  informacion: unknown;
  movimientos: Array<{ nombreJudicatura?: string; litigantesActor?: unknown; litigantesDemandado?: unknown }>;
  [key: string]: unknown;
}

async function enrichCausa(causa: Record<string, unknown>): Promise<EnrichedCausa> {
  const idJuicio = String(causa.idJuicio ?? causa.numeroDemanda ?? "");
  if (!idJuicio) return { ...causa, informacion: null, movimientos: [] };

  const [informacion, movimientos] = await Promise.allSettled([
    getInformacionJuicio(idJuicio),
    getAllActuacionesForJuicio(idJuicio),
  ]);

  return {
    ...causa,
    informacion: informacion.status === "fulfilled" ? informacion.value : null,
    movimientos: movimientos.status === "fulfilled" ? movimientos.value : [],
  };
}

function transformCase(causa: EnrichedCausa): JudicialCaseInput {
  const idJuicio = String(causa.idJuicio ?? causa.numeroDemanda ?? "");
  return {
    caseId: idJuicio,
    caseNumber: (causa.numeroDemanda as string) ?? (causa.numeroCausa as string) ?? null,
    province: (causa.provincia as string) ?? null,
    court: causa.movimientos?.[0]?.nombreJudicatura ?? null,
    // La búsqueda siempre filtra por cedulaDemandado — el rol es conocido de antemano.
    role: "demandado",
    litigants: causa.movimientos?.map((m) => ({
      judicatura: m.nombreJudicatura,
      actor: m.litigantesActor,
      demandado: m.litigantesDemandado,
    })),
    incidents: causa.movimientos,
    rawPayload: causa,
  };
}

export const satjeHandler: SourceHandler = {
  source: Source.SATJE,

  validateIdentification(identification: string): boolean {
    return resolveCedulaFromIdentification(identification) !== null;
  },

  async fetch(identification: string): Promise<FetchOutcome> {
    const cedula = resolveCedulaFromIdentification(identification);
    if (!cedula) return { found: false };

    const causasRaw = await buscarCausas(cedula);
    const causas: Record<string, unknown>[] = Array.isArray(causasRaw) ? causasRaw : [];

    if (!causas.length) return { found: false };

    const enriched = await Promise.allSettled(causas.map(enrichCausa));
    const cases = enriched.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      logger.warn("[satje] no se pudo enriquecer una causa", { error: r.reason?.message, idx: i });
      return { ...causas[i], informacion: null, movimientos: [] } as EnrichedCausa;
    });

    return { found: true, raw: cases };
  },

  async persist(identification: string, raw: unknown) {
    const cases = (raw as EnrichedCausa[]).map(transformCase);
    const person = await upsertPersonIdentity(identification);
    await syncJudicialCases(person.id, Source.SATJE, cases);
    return getConsolidatedPerson(identification);
  },
};
