import { Source } from "@prisma/client";
import { resolveCedulaFromIdentification } from "../../lib/ecuadorId";
import { normalizePlate } from "../../lib/phone";
import { FetchOutcome, SourceHandler, TrafficFineInput } from "../types/scraper.types";
import { AntScrapeResult, scrapeSanciones } from "./scrape";
import { getConsolidatedPerson, syncTrafficFines, upsertPersonIdentity } from "../../db/personRepository";

function transformFines(result: AntScrapeResult): TrafficFineInput[] {
  const pendientes: TrafficFineInput[] = result.pendientes.map((m) => ({
    plate: m.placa ? normalizePlate(m.placa) : null,
    status: "pendiente",
    offenseDescription: m.delito,
    amountDue: m.totalPagar,
    issueDate: m.fechaEmision,
    notificationDate: m.fechaNotificacion,
    rawPayload: m,
  }));

  const pagadas: TrafficFineInput[] = result.pagadas.map((m) => ({
    plate: m.placa ? normalizePlate(m.placa) : null,
    status: "pagada",
    offenseDescription: m.delito,
    amountPaid: m.totalPagado,
    issueDate: m.fechaEmision,
    notificationDate: m.fechaNotificacion,
    sanctionAmount: m.sancion,
    fineAmount: m.multa,
    remissionAmount: m.remision,
    rawPayload: m,
  }));

  return [...pendientes, ...pagadas];
}

export const antHandler: SourceHandler = {
  source: Source.ANT,

  validateIdentification(identification: string): boolean {
    return resolveCedulaFromIdentification(identification) !== null;
  },

  async fetch(identification: string): Promise<FetchOutcome> {
    const cedula = resolveCedulaFromIdentification(identification);
    if (!cedula) return { found: false };

    const result = await scrapeSanciones(cedula);
    const fines = transformFines(result);
    return { found: fines.length > 0, raw: fines };
  },

  async persist(identification: string, raw: unknown) {
    const person = await upsertPersonIdentity(identification);
    await syncTrafficFines(person.id, Source.ANT, raw as TrafficFineInput[]);
    return getConsolidatedPerson(identification);
  },
};
