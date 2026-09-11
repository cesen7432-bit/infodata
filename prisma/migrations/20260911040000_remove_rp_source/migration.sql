-- RP (Registro de la Propiedad) se elimina como fuente: el sitio dejó de responder
-- de forma consistente y no hay reemplazo. Antes de sacar el valor del enum hay que
-- limpiar cualquier fila que todavía lo referencie, si no el cast al enum nuevo falla.
DELETE FROM "PropertyRecord" WHERE "source" = 'RP';
DELETE FROM "BulkJobItem" WHERE "source" = 'RP';
DELETE FROM "Address" WHERE "source" = 'RP';
DELETE FROM "Phone" WHERE "source" = 'RP';
DELETE FROM "Email" WHERE "source" = 'RP';
DELETE FROM "FamilyLink" WHERE "source" = 'RP';
DELETE FROM "JudicialCase" WHERE "source" = 'RP';
DELETE FROM "TaxRecord" WHERE "source" = 'RP';
DELETE FROM "TrafficFine" WHERE "source" = 'RP';
DELETE FROM "Vehicle" WHERE "source" = 'RP';
DELETE FROM "LaborRecord" WHERE "source" = 'RP';

-- AlterEnum
BEGIN;
CREATE TYPE "Source_new" AS ENUM ('DATADIVERSERVICE', 'SATJE', 'SRI', 'ANT');
ALTER TABLE "Address" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "Phone" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "Email" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "FamilyLink" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "Vehicle" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "LaborRecord" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "BulkJobItem" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");

ALTER TABLE "JudicialCase" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "JudicialCase" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "JudicialCase" ALTER COLUMN "source" SET DEFAULT 'SATJE';

ALTER TABLE "TaxRecord" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "TaxRecord" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "TaxRecord" ALTER COLUMN "source" SET DEFAULT 'SRI';

ALTER TABLE "TrafficFine" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "TrafficFine" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "TrafficFine" ALTER COLUMN "source" SET DEFAULT 'ANT';

ALTER TABLE "PropertyRecord" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "PropertyRecord" ALTER COLUMN "source" TYPE "Source_new" USING ("source"::text::"Source_new");
ALTER TABLE "PropertyRecord" ALTER COLUMN "source" SET DEFAULT 'DATADIVERSERVICE';

ALTER TYPE "Source" RENAME TO "Source_old";
ALTER TYPE "Source_new" RENAME TO "Source";
DROP TYPE "Source_old";
COMMIT;
