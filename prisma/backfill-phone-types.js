// Corrección puntual (no se corre automáticamente): normaliza el campo
// phoneType de TODOS los teléfonos ya guardados a solo "MOVIL" o "FIJO" —
// antes de este fix venía tal cual de la fuente (valores libres, códigos
// numéricos, null...). Mismo criterio que usa el código nuevo al ingestar
// (src/scrapers/datadiverservice/transform.ts): móvil ecuatoriano = 10
// dígitos empezando en "09", cualquier otra cosa se trata como fijo.
//
// Plano en JS a propósito (igual que seed.js): corre con `node`, sin
// necesitar ts-node ni devDependencies en el contenedor de producción.
//
// Uso: node prisma/backfill-phone-types.js
// Idempotente — correrlo de nuevo sobre datos ya corregidos no cambia nada.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("593") && digits.length >= 11) return `0${digits.slice(3)}`;
  if (digits.startsWith("0")) return digits;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

function classifyPhoneType(normalized) {
  return normalized.startsWith("09") && normalized.length === 10 ? "MOVIL" : "FIJO";
}

async function main() {
  const phones = await prisma.phone.findMany({ select: { id: true, phoneNumber: true, phoneType: true } });

  let updated = 0;
  for (const phone of phones) {
    const normalized = normalizePhone(phone.phoneNumber) || phone.phoneNumber;
    const correctType = classifyPhoneType(normalized);
    if (phone.phoneType !== correctType) {
      await prisma.phone.update({ where: { id: phone.id }, data: { phoneType: correctType } });
      updated++;
    }
  }

  console.log(`[backfill-phone-types] revisados ${phones.length}, corregidos ${updated}.`);
}

main()
  .catch((err) => {
    console.error("[backfill-phone-types] error:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
