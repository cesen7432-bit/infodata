import ExcelJS from "exceljs";
import { prisma } from "../db/prisma";

/**
 * Cada hoja lleva la columna `identification` (aunque ya venga de un include
 * anidado) para que el workbook sea relacionable en Excel por identificación
 * sin tener que ir hoja por hoja resolviendo el personId interno.
 */
export async function buildPersonsWorkbook(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const [
    persons,
    addresses,
    phones,
    emails,
    familyLinks,
    vehicles,
    laborRecords,
    judicialCases,
    taxRecords,
    taxEstablishments,
    trafficFines,
    propertyRecords,
  ] = await Promise.all([
    prisma.person.findMany({ orderBy: { identification: "asc" } }),
    prisma.address.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.phone.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.email.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.familyLink.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.vehicle.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.laborRecord.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.judicialCase.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.taxRecord.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.taxEstablishment.findMany({
      include: { taxRecord: { select: { ruc: true, person: { select: { identification: true } } } } },
    }),
    prisma.trafficFine.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
    prisma.propertyRecord.findMany({
      where: { isCurrent: true },
      include: { person: { select: { identification: true } } },
    }),
  ]);

  addSheet(workbook, "Personas", [
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
  ], persons);

  addSheet(workbook, "Direcciones", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "Dirección", key: "address", width: 40 },
    { header: "Provincia", key: "province", width: 16 },
    { header: "Ciudad", key: "city", width: 16 },
    { header: "Válida", key: "isValid", width: 10 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Última vez visto", key: "lastSeenAt", width: 18 },
  ], addresses.map((a) => ({ ...a, identification: a.person.identification })));

  addSheet(workbook, "Telefonos", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "Teléfono", key: "phoneNumber", width: 18 },
    { header: "Tipo", key: "phoneType", width: 14 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Última vez visto", key: "lastSeenAt", width: 18 },
  ], phones.map((p) => ({ ...p, identification: p.person.identification })));

  addSheet(workbook, "Correos", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "Correo", key: "address", width: 30 },
    { header: "Activo", key: "isActive", width: 10 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Última vez visto", key: "lastSeenAt", width: 18 },
  ], emails.map((e) => ({ ...e, identification: e.person.identification })));

  addSheet(workbook, "Familiares", [
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
  ], familyLinks.map((f) => ({ ...f, identification: f.person.identification })));

  addSheet(workbook, "Vehiculos", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "Placa", key: "plate", width: 12 },
    { header: "Marca", key: "brand", width: 16 },
    { header: "Modelo", key: "model", width: 16 },
    { header: "Año", key: "year", width: 8 },
    { header: "Color", key: "color", width: 12 },
    { header: "Tipo", key: "vehicleType", width: 16 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Última vez visto", key: "lastSeenAt", width: 18 },
  ], vehicles.map((v) => ({ ...v, identification: v.person.identification })));

  addSheet(workbook, "HistorialLaboral", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "Empleador", key: "employerName", width: 30 },
    { header: "Cargo", key: "position", width: 20 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Fecha ingreso", key: "startDate", width: 16 },
    { header: "Fecha salida", key: "endDate", width: 16 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Última vez visto", key: "lastSeenAt", width: 18 },
  ], laborRecords.map((l) => ({ ...l, identification: l.person.identification })));

  addSheet(workbook, "CausasJudiciales", [
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
  ], judicialCases.map((j) => ({
    ...j,
    identification: j.person.identification,
    litigants: j.litigants ? JSON.stringify(j.litigants) : null,
    incidents: j.incidents ? JSON.stringify(j.incidents) : null,
  })));

  addSheet(workbook, "DatosTributarios", [
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
  ], taxRecords.map((t) => ({ ...t, identification: t.person.identification })));

  addSheet(workbook, "Establecimientos", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "RUC", key: "ruc", width: 16 },
    { header: "Número establecimiento", key: "establishmentNumber", width: 20 },
    { header: "Nombre", key: "name", width: 26 },
    { header: "Ubicación", key: "location", width: 30 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Tipo", key: "establishmentType", width: 16 },
    { header: "Matriz", key: "isHeadquarters", width: 10 },
  ], taxEstablishments.map((e) => ({
    ...e,
    identification: e.taxRecord.person.identification,
    ruc: e.taxRecord.ruc,
  })));

  addSheet(workbook, "MultasTransito", [
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
  ], trafficFines.map((f) => ({ ...f, identification: f.person.identification })));

  addSheet(workbook, "Propiedades", [
    { header: "Identificación", key: "identification", width: 16 },
    { header: "Tipo de registro", key: "recordType", width: 20 },
    { header: "Número 1", key: "number1", width: 16 },
    { header: "Número 2", key: "number2", width: 16 },
    { header: "Fecha", key: "recordDate", width: 16 },
    { header: "Rol", key: "role", width: 16 },
    { header: "Detalle", key: "detail", width: 32 },
    { header: "Fuente", key: "source", width: 18 },
    { header: "Última vez visto", key: "lastSeenAt", width: 18 },
  ], propertyRecords.map((p) => ({ ...p, identification: p.person.identification })));

  return workbook;
}

function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: Partial<ExcelJS.Column>[],
  rows: Record<string, unknown>[]
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  if (rows.length > 0) sheet.addRows(rows);
}
