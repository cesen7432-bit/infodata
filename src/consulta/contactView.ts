import { isValidCedula, isValidRuc } from "../lib/ecuadorId";
import { getConsolidatedPerson } from "../db/personRepository";

type ConsolidatedPerson = NonNullable<Awaited<ReturnType<typeof getConsolidatedPerson>>>;

/**
 * Respuesta reducida del endpoint consolidado cuando se consulta con API key:
 * solo el núcleo de identidad y contacto. La fuente de estos datos es siempre
 * DataDiverService (o la base interna ya poblada por él) — el endpoint por API
 * key no dispara SATJE / SRI / ANT / RP.
 */
export interface ContactView {
  name: string | null;
  identification: string;
  identification_type: "cedula" | "ruc" | null;
  email: string | null;
  address: string | null;
  phone_number: string | null;
}

function identificationType(id: string): ContactView["identification_type"] {
  if (isValidCedula(id)) return "cedula";
  if (isValidRuc(id)) return "ruc";
  return null;
}

/** El registro vigente visto más recientemente (los hechos nunca se borran, solo se marcan isCurrent=false). */
function mostRecent<T extends { lastSeenAt: Date }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())[0];
}

export function toContactView(identification: string, person: ConsolidatedPerson): ContactView {
  const address = mostRecent(person.addresses);
  const phone = mostRecent(person.phones);
  const email = mostRecent(person.emails);

  return {
    name: person.fullName ?? null,
    identification,
    identification_type: identificationType(identification),
    email: email?.address ?? null,
    address: address ? [address.address, address.city, address.province].filter(Boolean).join(", ") : null,
    phone_number: phone?.phoneNumber ?? null,
  };
}
