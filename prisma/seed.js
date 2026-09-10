// Seeder plano en JS (no TS) a propósito: así corre igual en local
// ("npx prisma db seed") y dentro del contenedor Docker en runtime, sin
// necesitar ts-node ni devDependencies ahí.
//
// Uso:
//   node prisma/seed.js                          -> admin con password aleatoria
//   node prisma/seed.js correo@dominio.com Clave  -> admin con esos datos
//
// Es idempotente: si ya existe algún usuario, no hace nada. Por eso es seguro
// dejarlo corriendo en cada arranque del contenedor (docker-compose.yml).
const { PrismaClient, Role } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log("[seed] ya hay usuarios en la base — nada que sembrar.");
    return;
  }

  const email = process.argv[2] || "admin@expediente-unico.local";
  const password = process.argv[3] || crypto.randomBytes(12).toString("base64url");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, passwordHash, role: Role.ADMIN } });

  console.log("========================================================");
  console.log("[seed] admin inicial creado — esto NO se vuelve a mostrar:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("  Guárdala ahora y cámbiala después de tu primer login");
  console.log("  (PATCH /api/admin/users/:id).");
  console.log("========================================================");
}

main()
  .catch((err) => {
    console.error("[seed] error:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
