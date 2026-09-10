import { Source } from "@prisma/client";
import { resolveCedulaFromIdentification } from "../../lib/ecuadorId";
import { FetchOutcome, IdentityScrapeResult, SourceHandler } from "../types/scraper.types";
import { fetchAll, findByCarRegistration } from "./http";
import { getFamily } from "./family";
import {
  transformAddresses,
  transformDataDiverProperties,
  transformEmails,
  transformFamily,
  transformLaborRecords,
  transformPerson,
  transformPhones,
  transformVehicles,
} from "./transform";
import {
  getConsolidatedPerson,
  syncAddresses,
  syncEmails,
  syncFamilyLinks,
  syncLaborRecords,
  syncPhones,
  syncPropertyRecords,
  syncVehicles,
  upsertPersonIdentity,
} from "../../db/personRepository";

async function fetchIdentity(dni: string): Promise<IdentityScrapeResult> {
  const [apiData, family] = await Promise.all([
    fetchAll(dni),
    getFamily(dni).catch(() => ({ family: [], data: [], results: [], relatives: [], parentesco: [] })),
  ]);

  if (!apiData.general) return { found: false };

  return {
    found: true,
    person: transformPerson(apiData.general),
    addresses: transformAddresses(apiData.contact, apiData.general),
    phones: transformPhones(apiData.contact),
    emails: transformEmails(apiData.contact),
    familyLinks: transformFamily(apiData.general, family),
    vehicles: transformVehicles(apiData.vehicle),
    laborRecords: transformLaborRecords(apiData.labour),
    propertyRecords: transformDataDiverProperties(apiData.property),
    rawPayload: apiData,
  };
}

/**
 * Búsqueda inversa por placa: DataDiverService devuelve el dueño (dni) junto
 * con el vehículo — se usa como respaldo cuando buscás una placa que todavía
 * no está en nuestra base (plan de búsqueda unificada, sección "filtros").
 */
export async function findOwnerDniByPlate(plate: string): Promise<string | null> {
  const results = await findByCarRegistration(plate);
  const dni = results.find((r) => r.dni)?.dni;
  return dni ? String(dni) : null;
}

export const dataDiverServiceHandler: SourceHandler = {
  source: Source.DATADIVERSERVICE,

  validateIdentification(identification: string): boolean {
    return resolveCedulaFromIdentification(identification) !== null;
  },

  async fetch(identification: string): Promise<FetchOutcome> {
    const cedula = resolveCedulaFromIdentification(identification);
    if (!cedula) return { found: false };

    const result = await fetchIdentity(cedula);
    return { found: result.found, raw: result };
  },

  async persist(identification: string, raw: unknown) {
    const result = raw as IdentityScrapeResult;
    const person = await upsertPersonIdentity(identification, result.person);

    await Promise.all([
      syncAddresses(person.id, Source.DATADIVERSERVICE, result.addresses ?? []),
      syncPhones(person.id, Source.DATADIVERSERVICE, result.phones ?? []),
      syncEmails(person.id, Source.DATADIVERSERVICE, result.emails ?? []),
      syncFamilyLinks(person.id, Source.DATADIVERSERVICE, result.familyLinks ?? []),
      syncVehicles(person.id, Source.DATADIVERSERVICE, result.vehicles ?? []),
      syncLaborRecords(person.id, Source.DATADIVERSERVICE, result.laborRecords ?? []),
      syncPropertyRecords(person.id, Source.DATADIVERSERVICE, result.propertyRecords ?? []),
    ]);

    return getConsolidatedPerson(identification);
  },
};
