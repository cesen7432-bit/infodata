import { Person, Source } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizePhone, normalizePlate } from "../lib/phone";
import {
  AddressInput,
  EmailInput,
  FamilyLinkInput,
  JudicialCaseInput,
  LaborRecordInput,
  PersonIdentityInput,
  PhoneInput,
  PropertyRecordInput,
  TaxRecordInput,
  TrafficFineInput,
  VehicleInput,
} from "../scrapers/types/scraper.types";

function parseDate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

/** Crea o actualiza el núcleo de identidad de la persona. Un campo nuevo no nulo gana; si la fuente no lo trae, se conserva el valor existente. */
export async function upsertPersonIdentity(identification: string, identity?: PersonIdentityInput): Promise<Person> {
  const existing = await prisma.person.findUnique({ where: { identification } });

  const data = identity
    ? {
        fullName: identity.fullName ?? existing?.fullName ?? null,
        birthDate: parseDate(identity.birthDate) ?? existing?.birthDate ?? null,
        deathDate: parseDate(identity.deathDate) ?? existing?.deathDate ?? null,
        gender: identity.gender ?? existing?.gender ?? null,
        civilStatus: identity.civilStatus ?? existing?.civilStatus ?? null,
        nationality: identity.nationality ?? existing?.nationality ?? null,
        profession: identity.profession ?? existing?.profession ?? null,
        placeOfBirth: identity.placeOfBirth ?? existing?.placeOfBirth ?? null,
        age: identity.age ?? existing?.age ?? null,
        salary: identity.salary ?? existing?.salary ?? null,
      }
    : {};

  return prisma.person.upsert({
    where: { identification },
    create: { identification, ...data },
    update: data,
  });
}

/**
 * Sincroniza los hechos (direcciones, teléfonos...) de una fuente para una persona:
 * lo que ya existía y sigue llegando se refresca (lastSeenAt), lo nuevo se inserta,
 * lo que dejó de llegar se marca isCurrent=false — nunca se borra (plan, sección 05).
 */

export async function syncAddresses(personId: string, source: Source, addresses: AddressInput[]): Promise<void> {
  const key = (a: { address: string; province?: string | null; city?: string | null }) =>
    `${a.address.trim().toLowerCase()}|${a.province ?? ""}|${a.city ?? ""}`;

  const existing = await prisma.address.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const addr of addresses) {
    if (!addr.address?.trim()) continue;
    const k = key(addr);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    if (match) {
      await prisma.address.update({ where: { id: match.id }, data: { lastSeenAt: new Date() } });
    } else {
      await prisma.address.create({
        data: { personId, source, address: addr.address, province: addr.province, city: addr.city, isValid: addr.isValid },
      });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.address.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncPhones(personId: string, source: Source, phones: PhoneInput[]): Promise<void> {
  // Mismo normalizador que en el scraper: "593978950498" y "0978950498" deben
  // deduplicar al mismo registro, no quedar como dos teléfonos distintos.
  const key = (p: { phoneNumber: string }) => normalizePhone(p.phoneNumber);

  const existing = await prisma.phone.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const phone of phones) {
    if (!phone.phoneNumber?.trim()) continue;
    const k = key(phone);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    if (match) {
      await prisma.phone.update({ where: { id: match.id }, data: { lastSeenAt: new Date() } });
    } else {
      await prisma.phone.create({
        data: { personId, source, phoneNumber: k || phone.phoneNumber, phoneType: phone.phoneType },
      });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.phone.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncEmails(personId: string, source: Source, emails: EmailInput[]): Promise<void> {
  const key = (e: { address: string }) => e.address.trim().toLowerCase();

  const existing = await prisma.email.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const email of emails) {
    if (!email.address?.trim()) continue;
    const k = key(email);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    if (match) {
      await prisma.email.update({ where: { id: match.id }, data: { lastSeenAt: new Date() } });
    } else {
      await prisma.email.create({
        data: { personId, source, address: email.address, isActive: email.isActive ?? true },
      });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.email.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncFamilyLinks(personId: string, source: Source, links: FamilyLinkInput[]): Promise<void> {
  const key = (l: { relatedIdentification?: string | null; relatedName?: string | null; relationshipType?: string | null }) =>
    `${l.relatedIdentification ?? ""}|${l.relatedName ?? ""}|${l.relationshipType ?? ""}`;

  const existing = await prisma.familyLink.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const link of links) {
    if (!link.relatedName && !link.relatedIdentification) continue;
    const k = key(link);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    if (match) {
      await prisma.familyLink.update({ where: { id: match.id }, data: { lastSeenAt: new Date() } });
    } else {
      await prisma.familyLink.create({
        data: {
          personId,
          source,
          relatedName: link.relatedName,
          relatedIdentification: link.relatedIdentification,
          relationshipType: link.relationshipType,
          relatedBirthDate: parseDate(link.relatedBirthDate),
          relatedDeathDate: parseDate(link.relatedDeathDate),
          relatedGender: link.relatedGender,
          relatedCivilStatus: link.relatedCivilStatus,
          relatedAge: link.relatedAge,
        },
      });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.familyLink.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncJudicialCases(personId: string, source: Source, cases: JudicialCaseInput[]): Promise<void> {
  const key = (c: { caseId: string | null }) => c.caseId ?? "";

  const existing = await prisma.judicialCase.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const c of cases) {
    if (!c.caseId) continue;
    const k = key(c);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    const data = {
      caseNumber: c.caseNumber,
      province: c.province,
      court: c.court,
      role: c.role,
      litigants: c.litigants as any,
      incidents: c.incidents as any,
      rawPayload: c.rawPayload as any,
    };
    if (match) {
      await prisma.judicialCase.update({ where: { id: match.id }, data: { ...data, lastSeenAt: new Date() } });
    } else {
      await prisma.judicialCase.create({ data: { personId, source, caseId: c.caseId, ...data } });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.judicialCase.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncTaxRecords(personId: string, source: Source, records: TaxRecordInput[]): Promise<void> {
  const key = (r: { ruc: string }) => r.ruc;

  const existing = await prisma.taxRecord.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const r of records) {
    if (!r.ruc) continue;
    const k = key(r);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    const data = {
      status: r.status,
      taxpayerType: r.taxpayerType,
      regime: r.regime,
      businessName: r.businessName,
      mainEconomicActivity: r.mainEconomicActivity,
      category: r.category,
      requiredToKeepAccounting: r.requiredToKeepAccounting,
      isWithholdingAgent: r.isWithholdingAgent,
      isSpecialTaxpayer: r.isSpecialTaxpayer,
      isPhantomTaxpayer: r.isPhantomTaxpayer,
      hasNonexistentTransactions: r.hasNonexistentTransactions,
      activitiesStartDate: r.activitiesStartDate,
      cessationDate: r.cessationDate,
      restartDate: r.restartDate,
      lastUpdateDate: r.lastUpdateDate,
      legalRepresentatives: r.legalRepresentatives as any,
      cancellationReason: r.cancellationReason,
      rawPayload: r.rawPayload as any,
    };

    const taxRecordId = match
      ? (await prisma.taxRecord.update({ where: { id: match.id }, data: { ...data, lastSeenAt: new Date() } })).id
      : (await prisma.taxRecord.create({ data: { personId, source, ruc: r.ruc, ...data } })).id;

    // Los establecimientos son un snapshot del punto en el tiempo del TaxRecord — se reemplazan enteros.
    await prisma.taxEstablishment.deleteMany({ where: { taxRecordId } });
    if (r.establishments.length) {
      await prisma.taxEstablishment.createMany({
        data: r.establishments.map((e) => ({
          taxRecordId,
          establishmentNumber: e.establishmentNumber,
          name: e.name,
          location: e.location,
          status: e.status,
          establishmentType: e.establishmentType,
          isHeadquarters: e.isHeadquarters ?? false,
        })),
      });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.taxRecord.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncTrafficFines(personId: string, source: Source, fines: TrafficFineInput[]): Promise<void> {
  const key = (f: { plate?: string | null; offenseDescription?: string | null; issueDate?: string | null }) =>
    `${f.plate ?? ""}|${f.offenseDescription ?? ""}|${f.issueDate ?? ""}`;

  const existing = await prisma.trafficFine.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const f of fines) {
    const k = key(f);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    const data = {
      plate: f.plate,
      status: f.status,
      offenseDescription: f.offenseDescription,
      amountDue: f.amountDue,
      amountPaid: f.amountPaid,
      issueDate: f.issueDate,
      notificationDate: f.notificationDate,
      sanctionAmount: f.sanctionAmount,
      fineAmount: f.fineAmount,
      remissionAmount: f.remissionAmount,
      rawPayload: f.rawPayload as any,
    };
    if (match) {
      await prisma.trafficFine.update({ where: { id: match.id }, data: { ...data, lastSeenAt: new Date() } });
    } else {
      await prisma.trafficFine.create({ data: { personId, source, ...data } });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.trafficFine.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncPropertyRecords(personId: string, source: Source, records: PropertyRecordInput[]): Promise<void> {
  const key = (r: { number1?: string | null; number2?: string | null; recordType?: string | null }) =>
    `${r.number1 ?? ""}|${r.number2 ?? ""}|${r.recordType ?? ""}`;

  const existing = await prisma.propertyRecord.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const r of records) {
    const k = key(r);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    const data = {
      recordType: r.recordType,
      number1: r.number1,
      number2: r.number2,
      recordDate: r.recordDate,
      role: r.role,
      detail: r.detail,
      rawPayload: r.rawPayload as any,
    };
    if (match) {
      await prisma.propertyRecord.update({ where: { id: match.id }, data: { ...data, lastSeenAt: new Date() } });
    } else {
      await prisma.propertyRecord.create({ data: { personId, source, ...data } });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.propertyRecord.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncVehicles(personId: string, source: Source, vehicles: VehicleInput[]): Promise<void> {
  const key = (v: { plate?: string | null; brand?: string | null; model?: string | null }) =>
    `${v.plate ?? ""}|${v.brand ?? ""}|${v.model ?? ""}`;

  const existing = await prisma.vehicle.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const v of vehicles) {
    const k = key(v);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    const data = {
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      vehicleType: v.vehicleType,
      rawPayload: v.rawPayload as any,
    };
    if (match) {
      await prisma.vehicle.update({ where: { id: match.id }, data: { ...data, lastSeenAt: new Date() } });
    } else {
      await prisma.vehicle.create({ data: { personId, source, ...data } });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.vehicle.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

export async function syncLaborRecords(personId: string, source: Source, records: LaborRecordInput[]): Promise<void> {
  const key = (r: { employerName?: string | null; position?: string | null; startDate?: string | null }) =>
    `${r.employerName ?? ""}|${r.position ?? ""}|${r.startDate ?? ""}`;

  const existing = await prisma.laborRecord.findMany({ where: { personId, source, isCurrent: true } });
  const existingByKey = new Map(existing.map((e) => [key(e), e]));
  const incomingKeys = new Set<string>();

  for (const r of records) {
    const k = key(r);
    incomingKeys.add(k);
    const match = existingByKey.get(k);
    const data = {
      employerName: r.employerName,
      position: r.position,
      status: r.status,
      startDate: r.startDate,
      endDate: r.endDate,
      rawPayload: r.rawPayload as any,
    };
    if (match) {
      await prisma.laborRecord.update({ where: { id: match.id }, data: { ...data, lastSeenAt: new Date() } });
    } else {
      await prisma.laborRecord.create({ data: { personId, source, ...data } });
    }
  }

  const stale = existing.filter((e) => !incomingKeys.has(key(e)));
  if (stale.length) {
    await prisma.laborRecord.updateMany({ where: { id: { in: stale.map((s) => s.id) } }, data: { isCurrent: false } });
  }
}

/** Última vez que esta fuente confirmó datos para esta persona (null si nunca) — enruta a la tabla que corresponda. */
export async function getSourceFreshness(personId: string, source: Source): Promise<Date | null> {
  switch (source) {
    case Source.DATADIVERSERVICE: {
      const [addr, phone, email, family, vehicle, labor, property] = await Promise.all([
        prisma.address.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
        prisma.phone.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
        prisma.email.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
        prisma.familyLink.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
        prisma.vehicle.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
        prisma.laborRecord.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
        prisma.propertyRecord.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } }),
      ]);
      const dates = [
        addr?.lastSeenAt,
        phone?.lastSeenAt,
        email?.lastSeenAt,
        family?.lastSeenAt,
        vehicle?.lastSeenAt,
        labor?.lastSeenAt,
        property?.lastSeenAt,
      ].filter((d): d is Date => !!d);
      return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    }
    case Source.SATJE: {
      const row = await prisma.judicialCase.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } });
      return row?.lastSeenAt ?? null;
    }
    case Source.SRI: {
      const row = await prisma.taxRecord.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } });
      return row?.lastSeenAt ?? null;
    }
    case Source.ANT: {
      const row = await prisma.trafficFine.findFirst({ where: { personId, source }, orderBy: { lastSeenAt: "desc" } });
      return row?.lastSeenAt ?? null;
    }
  }
}

/**
 * Búsquedas inversas dentro de lo ya scrapeado — no consultan ninguna fuente
 * externa, solo resuelven "¿de quién es este teléfono/placa?" a una cédula
 * para reusar el mismo flujo de consulta normal a partir de ahí.
 */
export async function findIdentificationByPhone(normalizedPhone: string): Promise<string | null> {
  const phone = await prisma.phone.findFirst({
    where: { phoneNumber: normalizedPhone, isCurrent: true },
    include: { person: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return phone?.person.identification ?? null;
}

export async function findIdentificationByPlate(plate: string): Promise<string | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { plate, isCurrent: true },
    include: { person: true },
    orderBy: { lastSeenAt: "desc" },
  });
  if (vehicle) return vehicle.person.identification;

  const fine = await prisma.trafficFine.findFirst({
    where: { plate, isCurrent: true },
    include: { person: true },
    orderBy: { lastSeenAt: "desc" },
  });
  return fine?.person.identification ?? null;
}

/** Devuelve la vista consolidada de una persona con todos sus hechos vigentes, agrupados por fuente. */
export async function getConsolidatedPerson(identification: string) {
  return prisma.person.findUnique({
    where: { identification },
    include: {
      addresses: { where: { isCurrent: true } },
      phones: { where: { isCurrent: true } },
      emails: { where: { isCurrent: true } },
      familyLinks: { where: { isCurrent: true } },
      judicialCases: { where: { isCurrent: true } },
      taxRecords: { where: { isCurrent: true }, include: { establishments: true } },
      trafficFines: { where: { isCurrent: true } },
      propertyRecords: { where: { isCurrent: true } },
      vehicles: { where: { isCurrent: true } },
      laborRecords: { where: { isCurrent: true } },
    },
  });
}
