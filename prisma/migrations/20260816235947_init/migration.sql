-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('DATADIVERSERVICE', 'SATJE', 'SRI', 'ANT', 'RP');

-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS');

-- CreateEnum
CREATE TYPE "BulkItemStatus" AS ENUM ('PENDING', 'RUNNING', 'OK', 'FAILED', 'BLOCKED_CAPTCHA');

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "fullName" TEXT,
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "gender" TEXT,
    "civilStatus" TEXT,
    "nationality" TEXT,
    "profession" TEXT,
    "placeOfBirth" TEXT,
    "age" INTEGER,
    "salary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "isValid" TEXT,
    "source" "Source" NOT NULL,
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phone" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneType" TEXT,
    "source" "Source" NOT NULL,
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "Source" NOT NULL,
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyLink" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "relatedPersonId" TEXT,
    "relatedName" TEXT,
    "relatedIdentification" TEXT,
    "relationshipType" TEXT,
    "relatedBirthDate" TIMESTAMP(3),
    "relatedDeathDate" TIMESTAMP(3),
    "relatedGender" TEXT,
    "relatedCivilStatus" TEXT,
    "relatedAge" INTEGER,
    "source" "Source" NOT NULL,
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudicialCase" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "caseId" TEXT,
    "caseNumber" TEXT,
    "province" TEXT,
    "court" TEXT,
    "role" TEXT,
    "litigants" JSONB,
    "incidents" JSONB,
    "source" "Source" NOT NULL DEFAULT 'SATJE',
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudicialCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRecord" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "status" TEXT,
    "taxpayerType" TEXT,
    "regime" TEXT,
    "businessName" TEXT,
    "mainEconomicActivity" TEXT,
    "category" TEXT,
    "requiredToKeepAccounting" TEXT,
    "isWithholdingAgent" TEXT,
    "isSpecialTaxpayer" TEXT,
    "isPhantomTaxpayer" TEXT,
    "hasNonexistentTransactions" TEXT,
    "activitiesStartDate" TEXT,
    "cessationDate" TEXT,
    "restartDate" TEXT,
    "lastUpdateDate" TEXT,
    "legalRepresentatives" JSONB,
    "cancellationReason" TEXT,
    "source" "Source" NOT NULL DEFAULT 'SRI',
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxEstablishment" (
    "id" TEXT NOT NULL,
    "taxRecordId" TEXT NOT NULL,
    "establishmentNumber" TEXT,
    "name" TEXT,
    "location" TEXT,
    "status" TEXT,
    "establishmentType" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TaxEstablishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficFine" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "plate" TEXT,
    "status" TEXT,
    "offenseDescription" TEXT,
    "amountDue" DOUBLE PRECISION,
    "amountPaid" DOUBLE PRECISION,
    "issueDate" TEXT,
    "notificationDate" TEXT,
    "sanctionAmount" DOUBLE PRECISION,
    "fineAmount" DOUBLE PRECISION,
    "remissionAmount" DOUBLE PRECISION,
    "source" "Source" NOT NULL DEFAULT 'ANT',
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficFine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyRecord" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "recordType" TEXT,
    "number1" TEXT,
    "number2" TEXT,
    "recordDate" TEXT,
    "role" TEXT,
    "detail" TEXT,
    "source" "Source" NOT NULL DEFAULT 'RP',
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJobItem" (
    "id" TEXT NOT NULL,
    "bulkJobId" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "source" "Source" NOT NULL,
    "status" "BulkItemStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_identification_key" ON "Person"("identification");

-- CreateIndex
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");

-- CreateIndex
CREATE INDEX "Address_personId_source_idx" ON "Address"("personId", "source");

-- CreateIndex
CREATE INDEX "Phone_personId_source_idx" ON "Phone"("personId", "source");

-- CreateIndex
CREATE INDEX "Email_personId_source_idx" ON "Email"("personId", "source");

-- CreateIndex
CREATE INDEX "FamilyLink_personId_source_idx" ON "FamilyLink"("personId", "source");

-- CreateIndex
CREATE INDEX "JudicialCase_personId_idx" ON "JudicialCase"("personId");

-- CreateIndex
CREATE INDEX "JudicialCase_caseId_idx" ON "JudicialCase"("caseId");

-- CreateIndex
CREATE INDEX "TaxRecord_personId_idx" ON "TaxRecord"("personId");

-- CreateIndex
CREATE INDEX "TaxRecord_ruc_idx" ON "TaxRecord"("ruc");

-- CreateIndex
CREATE INDEX "TaxEstablishment_taxRecordId_idx" ON "TaxEstablishment"("taxRecordId");

-- CreateIndex
CREATE INDEX "TrafficFine_personId_idx" ON "TrafficFine"("personId");

-- CreateIndex
CREATE INDEX "TrafficFine_plate_idx" ON "TrafficFine"("plate");

-- CreateIndex
CREATE INDEX "PropertyRecord_personId_idx" ON "PropertyRecord"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "BulkJobItem_bulkJobId_idx" ON "BulkJobItem"("bulkJobId");

-- CreateIndex
CREATE INDEX "BulkJobItem_identification_idx" ON "BulkJobItem"("identification");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phone" ADD CONSTRAINT "Phone_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyLink" ADD CONSTRAINT "FamilyLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudicialCase" ADD CONSTRAINT "JudicialCase_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRecord" ADD CONSTRAINT "TaxRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEstablishment" ADD CONSTRAINT "TaxEstablishment_taxRecordId_fkey" FOREIGN KEY ("taxRecordId") REFERENCES "TaxRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficFine" ADD CONSTRAINT "TrafficFine_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRecord" ADD CONSTRAINT "PropertyRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJob" ADD CONSTRAINT "BulkJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJobItem" ADD CONSTRAINT "BulkJobItem_bulkJobId_fkey" FOREIGN KEY ("bulkJobId") REFERENCES "BulkJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
