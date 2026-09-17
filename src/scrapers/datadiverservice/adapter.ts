import { Source } from "@prisma/client";
import { isCompanyRuc, isValidRuc, resolveCedulaFromIdentification } from "../../lib/ecuadorId";
import { FetchOutcome, IdentityScrapeResult, SourceHandler } from "../types/scraper.types";
import { fetchAll, fetchCompanyContact, findByCarRegistration } from "./http";
import { getFamily } from "./family";
import {
  transformAddresses,
  transformCompanyContact,
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

  // Persona natural (cédula, o RUC que deriva de una) además de RUC de
  // sociedad — este último solo trae contacto (ver `fetch`), no identidad.
  validateIdentification(identification: string): boolean {
    return resolveCedulaFromIdentification(identification) !== null || isValidRuc(identification);
  },

  async fetch(identification: string): Promise<FetchOutcome> {
    // Se revisa primero: un RUC de sociedad "resuelve" a una cédula falsa por
    // `resolveCedulaFromIdentification` (ver nota en isCompanyRuc), y esa
    // cédula nunca tiene datos en /crn/client/info/* — hay que enrutarlo a
    // /crm/company/info/contact antes de caer en la rama de persona natural.
    if (isCompanyRuc(identification)) {
      const raw = await fetchCompanyContact(identification);
      const { phones, emails } = transformCompanyContact(raw);
      if (phones.length === 0 && emails.length === 0) return { found: false };

      const result: IdentityScrapeResult = { found: true, phones, emails, rawPayload: raw };
      return { found: true, raw: result };
    }

    const cedula = resolveCedulaFromIdentification(identification);
    if (cedula) {
      const result = await fetchIdentity(cedula);
      return { found: result.found, raw: result };
    }

    return { found: false };
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
