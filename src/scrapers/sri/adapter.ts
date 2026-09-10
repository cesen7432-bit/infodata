import { Source } from "@prisma/client";
import { deriveNaturalPersonRuc, isValidCedula, isValidRuc } from "../../lib/ecuadorId";
import { FetchOutcome, SourceHandler, TaxRecordInput } from "../types/scraper.types";
import { fetchSri } from "./http";
import { transformTaxRecord } from "./transform";
import { getConsolidatedPerson, syncTaxRecords, upsertPersonIdentity } from "../../db/personRepository";

/**
 * Acepta tanto un RUC directo como una cédula — de una cédula válida se
 * deriva el RUC de persona natural (cédula + "001") para consultar el SRI,
 * pero el expediente sigue viviendo bajo la cédula que se buscó.
 */
function resolveRuc(identification: string): string | null {
  if (isValidRuc(identification)) return identification;
  return deriveNaturalPersonRuc(identification);
}

export const sriHandler: SourceHandler = {
  source: Source.SRI,

  validateIdentification(identification: string): boolean {
    return isValidRuc(identification) || isValidCedula(identification);
  },

  async fetch(identification: string): Promise<FetchOutcome> {
    const ruc = resolveRuc(identification);
    if (!ruc) return { found: false };

    const result = await fetchSri(ruc);
    if (result.blockedCaptcha) return { found: false, blockedCaptcha: true };

    if (!result.contribuyente || result.contribuyente.length === 0) {
      return { found: false };
    }

    const record = transformTaxRecord(ruc, result.contribuyente[0], result.establecimientos ?? []);
    return { found: true, raw: record };
  },

  async persist(identification: string, raw: unknown) {
    // "identification" es lo que el usuario buscó (cédula o RUC) — el
    // expediente se guarda ahí, aunque el RUC real consultado (con el
    // sufijo 001 si vino de una cédula) queda en record.ruc.
    const record = raw as TaxRecordInput;
    // Si nadie más aportó un nombre todavía, la razón social del SRI sirve de
    // identidad — mejor eso que "Nombre no disponible" cuando SRI es la
    // única fuente que encontró algo.
    const person = await upsertPersonIdentity(
      identification,
      record.businessName ? { fullName: record.businessName } : undefined
    );
    await syncTaxRecords(person.id, Source.SRI, [record]);
    return getConsolidatedPerson(identification);
  },
};
