-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
