-- CreateEnum
CREATE TYPE "SriInvoiceJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SriInvoiceJob" (
    "id" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "documentType" INTEGER NOT NULL,
    "periodFromYear" INTEGER NOT NULL,
    "periodFromMonth" INTEGER NOT NULL,
    "periodToYear" INTEGER NOT NULL,
    "periodToMonth" INTEGER NOT NULL,
    "status" "SriInvoiceJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalFound" INTEGER,
    "totalDownloaded" INTEGER,
    "errorMessage" TEXT,
    "resultFilePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SriInvoiceJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SriInvoiceJob_requestedById_idx" ON "SriInvoiceJob"("requestedById");

-- AddForeignKey
ALTER TABLE "SriInvoiceJob" ADD CONSTRAINT "SriInvoiceJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
