import { Source } from "@prisma/client";
import { resolveCedulaFromIdentification } from "../../lib/ecuadorId";
import { FetchOutcome, PropertyRecordInput, SourceHandler } from "../types/scraper.types";
import { PropertyRow, scrapeProperty } from "./scrape";
import { getConsolidatedPerson, syncPropertyRecords, upsertPersonIdentity } from "../../db/personRepository";

function transformRecords(rows: PropertyRow[]): PropertyRecordInput[] {
  return rows.map((r) => ({
    recordType: r.tipo_estado,
    number1: r.numero1,
    number2: r.numero2,
    recordDate: r.fecha,
    role: r.rol,
    detail: r.detalle,
    rawPayload: r,
  }));
}

export const rpHandler: SourceHandler = {
  source: Source.RP,

  validateIdentification(identification: string): boolean {
    return resolveCedulaFromIdentification(identification) !== null;
  },

  async fetch(identification: string): Promise<FetchOutcome> {
    const ci = resolveCedulaFromIdentification(identification);
    if (!ci) return { found: false };

    const rows = await scrapeProperty(ci);
    const records = transformRecords(rows);
    return { found: records.length > 0, raw: records };
  },

  async persist(identification: string, raw: unknown) {
    const person = await upsertPersonIdentity(identification);
    await syncPropertyRecords(person.id, Source.RP, raw as PropertyRecordInput[]);
    return getConsolidatedPerson(identification);
  },
};
