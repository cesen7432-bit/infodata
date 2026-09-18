import { convertDateFormat } from "../../lib/dates";
import { normalizePhone, normalizePlate } from "../../lib/phone";
import {
  AddressInput,
  EmailInput,
  FamilyLinkInput,
  LaborRecordInput,
  PhoneInput,
  PersonIdentityInput,
  PropertyRecordInput,
  VehicleInput,
} from "../types/scraper.types";
import { RawFamilyData } from "./family";
import { RawCompanyContact } from "./http";

interface RawGeneral {
  id?: string | number;
  dni?: string;
  fullname?: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  gender?: string;
  civilStatus?: string;
  citizenship?: string;
  profession?: string;
  placeOfBirth?: string;
  salary?: string;
  age?: number;
  address?: string;
  family?: any[];
}

type RawContact = Record<string, any> | null;

/** La API a veces envuelve la respuesta en `.data` o `.result` en vez de devolverla directa. */
function unwrap(obj: Record<string, any> | null | undefined): Record<string, any> {
  if (!obj) return {};
  return obj.data || obj.result || obj;
}

function toArray(val: unknown): any[] {
  return Array.isArray(val) ? val : [];
}

export function transformPerson(general: RawGeneral): PersonIdentityInput {
  return {
    fullName: general.fullname || null,
    birthDate: convertDateFormat(general.dateOfBirth),
    deathDate: general.dateOfDeath?.trim() ? convertDateFormat(general.dateOfDeath) : null,
    gender: general.gender || null,
    civilStatus: general.civilStatus || null,
    nationality: general.citizenship || null,
    profession: general.profession || null,
    placeOfBirth: general.placeOfBirth || null,
    age: general.age ?? null,
    salary: general.salary || null,
  };
}

/**
 * Igual que el resto de estas funciones: la respuesta real de /contact varía
 * (a veces envuelta en .data/.result, a veces con nombres de campo distintos:
 * telefonos/phone_numbers en vez de phones). Sin esta tolerancia, los
 * teléfonos y correos quedaban vacíos aunque la API sí los trajera.
 */
export function transformPhones(contact: RawContact): PhoneInput[] {
  const c = unwrap(contact);
  const phones = toArray(c.phones || c.telefonos || c.phone_numbers);
  const seen = new Set<string>();
  const out: PhoneInput[] = [];
  for (const phone of phones) {
    const raw = String(typeof phone === "string" ? phone : phone.phone || phone.numero || phone.number || "");
    // Normalizado a formato local: "593978950498" y "0978950498" son el
    // mismo número — sin esto quedan como dos teléfonos "distintos".
    const normalized = normalizePhone(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    // El "tipo"/"type" que trae la fuente no es confiable ni consistente
    // (valores libres, códigos numéricos, etc.) — la única regla que sirve
    // en todos los casos es la del propio número (ver classifyPhoneType).
    out.push({ phoneNumber: normalized, phoneType: classifyPhoneType(normalized) });
  }
  return out;
}

export function transformEmails(contact: RawContact): EmailInput[] {
  const c = unwrap(contact);
  const emails = toArray(c.emails || c.correos || c.email_addresses);
  const seen = new Set<string>();
  const out: EmailInput[] = [];
  for (const email of emails) {
    const addr = String(typeof email === "string" ? email : email.email || email.correo || "")
      .trim()
      .toLowerCase();
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    out.push({ address: addr, isActive: true });
  }
  return out;
}

/**
 * Móvil ecuatoriano: siempre 10 dígitos y empieza con "09". Cualquier otra
 * cosa (9 dígitos "0" + código de área, o un formato raro que se nos coló)
 * se clasifica como fijo — nunca null, el tipo solo puede ser uno de los dos.
 */
function classifyPhoneType(normalizedPhone: string): "MOVIL" | "FIJO" {
  return normalizedPhone.startsWith("09") && normalizedPhone.length === 10 ? "MOVIL" : "FIJO";
}

/**
 * /crm/company/info/contact no distingue teléfono de correo por un campo
 * propio confiable (su `tipo` no correlaciona con MOVIL/FIJO) — se infiere
 * del valor: "@" es correo, si no, la longitud del número decide entre móvil
 * y fijo. La respuesta además repite el mismo contacto muchas veces, así que
 * se dedupea acá antes de llegar a syncPhones/syncEmails.
 */
export function transformCompanyContact(raw: RawCompanyContact[]): { phones: PhoneInput[]; emails: EmailInput[] } {
  const phones: PhoneInput[] = [];
  const emails: EmailInput[] = [];
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();

  for (const item of raw) {
    const value = String(item?.contacto ?? "").trim();
    if (!value) continue;

    if (value.includes("@")) {
      const addr = value.toLowerCase();
      if (seenEmails.has(addr)) continue;
      seenEmails.add(addr);
      emails.push({ address: addr, isActive: true });
      continue;
    }

    const normalized = normalizePhone(value);
    if (!normalized || seenPhones.has(normalized)) continue;
    seenPhones.add(normalized);
    phones.push({ phoneNumber: normalized, phoneType: classifyPhoneType(normalized) });
  }

  return { phones, emails };
}

export function transformAddresses(contact: RawContact, general: RawGeneral): AddressInput[] {
  const out: AddressInput[] = [];
  const c = unwrap(contact);
  const addresses = toArray(c.address || c.addresses || c.direcciones);

  for (const addr of addresses) {
    if (typeof addr === "string") {
      if (addr.trim()) out.push({ address: addr, province: null, city: null, isValid: null });
      continue;
    }
    const text = addr.address || addr.direccion || addr.addressLine || "";
    if (!text) continue;
    out.push({
      address: text,
      province: addr.province || addr.provincia || null,
      city: addr.city || addr.ciudad || null,
      isValid: addr.is_valid || addr.isValid || null,
    });
  }

  if (general.address && typeof general.address === "string" && general.address.trim() !== "") {
    out.push({ address: general.address, province: null, city: null, isValid: null });
  }

  return out.filter((a) => a.address?.trim());
}

/** /vehicle — placas registradas a nombre de la cédula consultada. */
export function transformVehicles(vehicleRaw: RawContact): VehicleInput[] {
  const c = unwrap(vehicleRaw);
  const items = toArray(c.vehicles || c.vehicle || c.data || (Array.isArray(vehicleRaw) ? vehicleRaw : null));

  return items.map((v: Record<string, any>) => ({
    plate: v.plate || v.placa || v.plaque ? normalizePlate(String(v.plate || v.placa || v.plaque)) : null,
    brand: v.brand || v.marca || null,
    model: v.model || v.modelo || null,
    year: v.year ? String(v.year) : v.anio ? String(v.anio) : v.año ? String(v.año) : null,
    color: v.color || null,
    vehicleType: v.type || v.tipo || v.vehicleType || null,
    rawPayload: v,
  }));
}

/** /labournew — historial laboral reportado bajo esa cédula. */
export function transformLaborRecords(labourRaw: RawContact): LaborRecordInput[] {
  const c = unwrap(labourRaw);
  const items = toArray(c.labour || c.labor || c.jobs || c.trabajos || c.data || (Array.isArray(labourRaw) ? labourRaw : null));

  return items.map((j: Record<string, any>) => ({
    employerName: j.employerName || j.empresa || j.employer || j.company || null,
    position: j.position || j.cargo || j.puesto || null,
    status: j.status || j.estado || null,
    startDate: convertDateFormat(j.startDate || j.fechaIngreso || j.fecha_ingreso) || j.startDate || j.fechaIngreso || null,
    endDate: convertDateFormat(j.endDate || j.fechaSalida || j.fecha_salida) || j.endDate || j.fechaSalida || null,
    rawPayload: j,
  }));
}

/** /property — bienes reportados por DataDiverService, distinto del Registro de la Propiedad oficial pero misma tabla (source lo distingue). */
export function transformDataDiverProperties(propertyRaw: RawContact): PropertyRecordInput[] {
  const c = unwrap(propertyRaw);
  const items = toArray(c.properties || c.property || c.data || (Array.isArray(propertyRaw) ? propertyRaw : null));

  return items.map((p: Record<string, any>) => ({
    recordType: p.type || p.tipo || "PROPIEDAD",
    number1: p.registrationNumber || p.numero || null,
    number2: null,
    recordDate: p.date || p.fecha || null,
    role: p.role || p.rol || "PROPIETARIO",
    detail: p.address || p.direccion || p.description || p.descripcion || null,
    rawPayload: p,
  }));
}

const FAMILY_KEYWORDS = [
  "familia", "parientes", "relatives", "relations", "members", "miembros",
  "padres", "parents", "hijos", "children", "hermanos", "siblings",
  "esposa", "esposo", "spouse", "conyuge", "pareja",
];
const FAMILY_FIELDS = [
  "fullname", "dni", "name", "relationship", "parentesco", "relation",
  "age", "gender", "dateOfBirth", "civilStatus", "nombre", "cedula",
  "identificacion", "edad", "genero", "sexo", "fechaNacimiento",
];

function seemsFamilyData(item: Record<string, any>): boolean {
  const keys = Object.keys(item);
  return FAMILY_FIELDS.filter((f) => keys.includes(f)).length >= 2;
}

function collectFamilyMembers(all: any[], source: Record<string, any>): void {
  const known = ["family", "data", "results", "relatives", "parentesco"];
  for (const key of known) {
    if (Array.isArray(source[key])) all.push(...source[key]);
  }
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value) && value.length > 0 && !known.includes(key)) {
      const keyLower = key.toLowerCase();
      if (FAMILY_KEYWORDS.some((k) => keyLower.includes(k))) {
        all.push(...value);
      } else if (seemsFamilyData(value[0])) {
        all.push(...value);
      }
    }
  }
}

export function transformFamily(general: RawGeneral, family: RawFamilyData): FamilyLinkInput[] {
  const all: any[] = [];
  collectFamilyMembers(all, general);
  collectFamilyMembers(all, family);

  const seen = new Set<string>();
  const unique = all.filter((m) => {
    const dni = m.dni || m.identification || m.cedula;
    const name = m.fullname || m.name || m.nombre;
    const birth = m.dateOfBirth || m.birthDate || m.fechaNacimiento || "";
    const id = `${dni || ""}-${name || ""}-${birth}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return unique.map((member) => {
    const rawBirth = member.dateOfBirth || member.birthDate || member.fechaNacimiento || "";
    const ageMatch = rawBirth.match?.(/\((\d+)\)/);
    const cleanBirth = rawBirth.replace(/\s*\(\d+\)\s*/g, "").replace(/\s+/g, "").trim() || null;
    const relationship = member.relationship || member.parentesco || member.relation;

    return {
      relatedName: member.fullname || member.name || member.nombre || null,
      relatedIdentification: member.dni || member.identification || member.cedula || null,
      relationshipType: relationship ? String(relationship).toUpperCase() : null,
      relatedBirthDate: convertDateFormat(cleanBirth) || cleanBirth,
      relatedDeathDate: member.dateOfDeath?.trim?.() ? convertDateFormat(member.dateOfDeath) : null,
      relatedGender: member.gender || member.genero || member.sexo || null,
      relatedCivilStatus: member.civilStatus || member.estadoCivil || member.maritalStatus || null,
      relatedAge: member.age || member.edad || (ageMatch ? Number(ageMatch[1]) : null),
    };
  });
}
