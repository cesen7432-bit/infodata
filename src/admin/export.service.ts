import ExcelJS from "exceljs";
import { Writable } from "stream";
import { prisma } from "../db/prisma";

/**
 * Los datos vienen de scrapers de portales de gobierno (SATJE, SRI, ANT) — de
 * vez en cuando traen caracteres de control fuera del rango válido de XML (la
 * especificación no admite ciertos códigos de control ni los "noncharacters"
 * U+FFFE/U+FFFF). ExcelJS no los sanea: si llegan a una celda, el .xlsx queda
 * técnicamente inválido y Excel lo abre con el diálogo de "se encontró un
 * problema con el contenido" — el bug reportado. Se recorre por code point
 * (no con una regex de rango) para evitar cualquier ambigüedad de escapes.
 * Mismo trato para NaN/Infinity y fechas inválidas, que tampoco son valores
 * XML válidos.
 */
const INVALID_XML_RANGES: Array<[number, number]> = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0xfffe, 0xffff],
];

function isInvalidXmlCodePoint(code: number): boolean {
  return INVALID_XML_RANGES.some(([start, end]) => code >= start && code <= end);
}

function stripInvalidXmlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (!isInvalidXmlCodePoint(code)) out += ch;
  }
  return out;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return stripInvalidXmlChars(value);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  return value;
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = sanitizeValue(value);
  return out;
}

type SheetDef = {
  key: string;
  label: string;
  columns: Partial<ExcelJS.Column>[];
  fetch: () => Promise<Record<string, unknown>[]>;
};

/**
 * Cada hoja lleva la columna `identification` (aunque ya venga de un include
 * anidado) para que el workbook sea relacionable en Excel por identificación
 * sin tener que ir hoja por hoja resolviendo el personId interno.
 */
const SHEET_DEFS: SheetDef[] = [
  {
    key: "persons",
    label: "Personas",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Nombre completo", key: "fullName", width: 32 },
      { header: "Fecha nacimiento", key: "birthDate", width: 16 },
      { header: "Fecha defunción", key: "deathDate", width: 16 },
      { header: "Género", key: "gender", width: 12 },
      { header: "Estado civil", key: "civilStatus", width: 14 },
      { header: "Nacionalidad", key: "nationality", width: 14 },
      { header: "Profesión", key: "profession", width: 20 },
      { header: "Lugar de nacimiento", key: "placeOfBirth", width: 24 },
      { header: "Edad", key: "age", width: 8 },
      { header: "Salario", key: "salary", width: 12 },
      { header: "Creado", key: "createdAt", width: 18 },
      { header: "Actualizado", key: "updatedAt", width: 18 },
    ],
    fetch: () => prisma.person.findMany({ orderBy: { identification: "asc" } }),
  },
  {
    key: "addresses",
    label: "Direcciones",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Dirección", key: "address", width: 40 },
      { header: "Provincia", key: "province", width: 16 },
      { header: "Ciudad", key: "city", width: 16 },
      { header: "Válida", key: "isValid", width: 10 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.address.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((a) => ({ ...a, identification: a.person.identification }));
    },
  },
  {
    key: "phones",
    label: "Telefonos",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Teléfono", key: "phoneNumber", width: 18 },
      { header: "Tipo", key: "phoneType", width: 14 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.phone.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((p) => ({ ...p, identification: p.person.identification }));
    },
  },
  {
    key: "emails",
    label: "Correos",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Correo", key: "address", width: 30 },
      { header: "Activo", key: "isActive", width: 10 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.email.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((e) => ({ ...e, identification: e.person.identification }));
    },
  },
  {
    key: "familyLinks",
    label: "Familiares",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Nombre familiar", key: "relatedName", width: 32 },
      { header: "Identificación familiar", key: "relatedIdentification", width: 18 },
      { header: "Parentesco", key: "relationshipType", width: 16 },
      { header: "Fecha nacimiento", key: "relatedBirthDate", width: 16 },
      { header: "Fecha defunción", key: "relatedDeathDate", width: 16 },
      { header: "Género", key: "relatedGender", width: 12 },
      { header: "Estado civil", key: "relatedCivilStatus", width: 14 },
      { header: "Edad", key: "relatedAge", width: 8 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.familyLink.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((f) => ({ ...f, identification: f.person.identification }));
    },
  },
  {
    key: "vehicles",
    label: "Vehiculos",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Placa", key: "plate", width: 12 },
      { header: "Marca", key: "brand", width: 16 },
      { header: "Modelo", key: "model", width: 16 },
      { header: "Año", key: "year", width: 8 },
      { header: "Color", key: "color", width: 12 },
      { header: "Tipo", key: "vehicleType", width: 16 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.vehicle.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((v) => ({ ...v, identification: v.person.identification }));
    },
  },
  {
    key: "laborRecords",
    label: "HistorialLaboral",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Empleador", key: "employerName", width: 30 },
      { header: "Cargo", key: "position", width: 20 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Fecha ingreso", key: "startDate", width: 16 },
      { header: "Fecha salida", key: "endDate", width: 16 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.laborRecord.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((l) => ({ ...l, identification: l.person.identification }));
    },
  },
  {
    key: "judicialCases",
    label: "CausasJudiciales",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "ID causa", key: "caseId", width: 16 },
      { header: "Número de causa", key: "caseNumber", width: 20 },
      { header: "Provincia", key: "province", width: 16 },
      { header: "Judicatura", key: "court", width: 26 },
      { header: "Rol", key: "role", width: 14 },
      { header: "Litigantes", key: "litigants", width: 30 },
      { header: "Incidentes", key: "incidents", width: 30 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.judicialCase.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((j) => ({
        ...j,
        identification: j.person.identification,
        litigants: j.litigants ? JSON.stringify(j.litigants) : null,
        incidents: j.incidents ? JSON.stringify(j.incidents) : null,
      }));
    },
  },
  {
    key: "taxRecords",
    label: "DatosTributarios",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "RUC", key: "ruc", width: 16 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Tipo contribuyente", key: "taxpayerType", width: 18 },
      { header: "Régimen", key: "regime", width: 16 },
      { header: "Razón social", key: "businessName", width: 30 },
      { header: "Actividad económica", key: "mainEconomicActivity", width: 30 },
      { header: "Categoría", key: "category", width: 16 },
      { header: "Obligado contabilidad", key: "requiredToKeepAccounting", width: 20 },
      { header: "Agente retención", key: "isWithholdingAgent", width: 18 },
      { header: "Contribuyente especial", key: "isSpecialTaxpayer", width: 20 },
      { header: "Contribuyente fantasma", key: "isPhantomTaxpayer", width: 20 },
      { header: "Transacciones inexistentes", key: "hasNonexistentTransactions", width: 22 },
      { header: "Inicio actividades", key: "activitiesStartDate", width: 18 },
      { header: "Fecha cese", key: "cessationDate", width: 16 },
      { header: "Fecha reinicio", key: "restartDate", width: 16 },
      { header: "Última actualización", key: "lastUpdateDate", width: 18 },
      { header: "Motivo cancelación", key: "cancellationReason", width: 22 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.taxRecord.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((t) => ({ ...t, identification: t.person.identification }));
    },
  },
  {
    key: "taxEstablishments",
    label: "Establecimientos",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "RUC", key: "ruc", width: 16 },
      { header: "Número establecimiento", key: "establishmentNumber", width: 20 },
      { header: "Nombre", key: "name", width: 26 },
      { header: "Ubicación", key: "location", width: 30 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Tipo", key: "establishmentType", width: 16 },
      { header: "Matriz", key: "isHeadquarters", width: 10 },
    ],
    fetch: async () => {
      const rows = await prisma.taxEstablishment.findMany({
        include: { taxRecord: { select: { ruc: true, person: { select: { identification: true } } } } },
      });
      return rows.map((e) => ({
        ...e,
        identification: e.taxRecord.person.identification,
        ruc: e.taxRecord.ruc,
      }));
    },
  },
  {
    key: "trafficFines",
    label: "MultasTransito",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Placa", key: "plate", width: 12 },
      { header: "Estado", key: "status", width: 14 },
      { header: "Descripción infracción", key: "offenseDescription", width: 32 },
      { header: "Monto adeudado", key: "amountDue", width: 16 },
      { header: "Monto pagado", key: "amountPaid", width: 16 },
      { header: "Fecha emisión", key: "issueDate", width: 16 },
      { header: "Fecha notificación", key: "notificationDate", width: 18 },
      { header: "Monto sanción", key: "sanctionAmount", width: 16 },
      { header: "Monto multa", key: "fineAmount", width: 16 },
      { header: "Monto remisión", key: "remissionAmount", width: 16 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.trafficFine.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((f) => ({ ...f, identification: f.person.identification }));
    },
  },
  {
    key: "propertyRecords",
    label: "Propiedades",
    columns: [
      { header: "Identificación", key: "identification", width: 16 },
      { header: "Tipo de registro", key: "recordType", width: 20 },
      { header: "Número 1", key: "number1", width: 16 },
      { header: "Número 2", key: "number2", width: 16 },
      { header: "Fecha", key: "recordDate", width: 16 },
      { header: "Rol", key: "role", width: 16 },
      { header: "Detalle", key: "detail", width: 32 },
      { header: "Fuente", key: "source", width: 18 },
      { header: "Última vez visto", key: "lastSeenAt", width: 18 },
    ],
    fetch: async () => {
      const rows = await prisma.propertyRecord.findMany({
        where: { isCurrent: true },
        include: { person: { select: { identification: true } } },
      });
      return rows.map((p) => ({ ...p, identification: p.person.identification }));
    },
  },
];

export const EXPORT_SHEETS = SHEET_DEFS.map(({ key, label }) => ({ key, label }));

const SHEET_DEFS_BY_KEY = new Map(SHEET_DEFS.map((def) => [def.key, def]));

export function isExportSheetKey(key: string): boolean {
  return SHEET_DEFS_BY_KEY.has(key);
}

/**
 * Escribe el workbook directamente al stream de respuesta (ExcelJS streaming
 * writer) en vez de construirlo entero en memoria y recién ahí mandarlo: así
 * el cliente (y el proxy Apache delante de la API) empiezan a recibir bytes
 * apenas terminan las consultas, en lugar de esperar en silencio a que se
 * arme el .xlsx completo — eso último es lo que producía el Error 503 en
 * exports grandes, con Apache cortando la conexión por inactividad antes de
 * que Express llegara a escribir nada.
 *
 * `sheetKeys` vacío o ausente = todas las hojas (comportamiento previo).
 */
export async function writePersonsWorkbook(
  stream: Writable,
  sheetKeys?: string[]
): Promise<void> {
  const defs = sheetKeys && sheetKeys.length > 0
    ? sheetKeys.map((key) => SHEET_DEFS_BY_KEY.get(key)).filter((d): d is SheetDef => Boolean(d))
    : SHEET_DEFS;

  const rowsBySheet = await Promise.all(defs.map((def) => def.fetch()));

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });
  workbook.created = new Date();

  defs.forEach((def, i) => {
    const sheet = workbook.addWorksheet(def.label);
    sheet.columns = def.columns;
    sheet.getRow(1).font = { bold: true };
    for (const row of rowsBySheet[i]) {
      sheet.addRow(sanitizeRow(row)).commit();
    }
    sheet.commit();
  });

  await workbook.commit();
}
