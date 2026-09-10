-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "personFound" BOOLEAN NOT NULL DEFAULT false,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchHistory_userId_lastSearchedAt_idx" ON "SearchHistory"("userId", "lastSearchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchHistory_userId_identification_key" ON "SearchHistory"("userId", "identification");

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
