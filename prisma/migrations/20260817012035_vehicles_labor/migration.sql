-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "plate" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "year" TEXT,
    "color" TEXT,
    "vehicleType" TEXT,
    "source" "Source" NOT NULL,
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRecord" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "employerName" TEXT,
    "position" TEXT,
    "status" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "source" "Source" NOT NULL,
    "rawPayload" JSONB,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vehicle_personId_source_idx" ON "Vehicle"("personId", "source");

-- CreateIndex
CREATE INDEX "LaborRecord_personId_source_idx" ON "LaborRecord"("personId", "source");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborRecord" ADD CONSTRAINT "LaborRecord_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
