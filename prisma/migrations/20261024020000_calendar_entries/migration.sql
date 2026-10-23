-- The separate numeric target (BrandIpMonth) and the anonymous tap log
-- (Piece) are both replaced by CalendarEntry: a specific, dated, named
-- post. The count of entries for a brand+IP+month *is* the target now.
DROP TABLE "BrandIpMonth";
DROP TABLE "Piece";

-- Reuse the existing REGULAR/FESTIVAL/NON_IP enum under its new name.
ALTER TYPE "PieceKind" RENAME TO "EntryKind";

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'DONE', 'LIVE');

-- CreateTable
CREATE TABLE "CalendarEntry" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "EntryKind" NOT NULL DEFAULT 'REGULAR',
    "ipId" TEXT,
    "festivalId" TEXT,
    "title" TEXT NOT NULL,
    "format" "PlanFormat",
    "postDate" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEntry_monthKey_brandId_ipId_idx" ON "CalendarEntry"("monthKey", "brandId", "ipId");

-- CreateIndex
CREATE INDEX "CalendarEntry_postDate_idx" ON "CalendarEntry"("postDate");

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_ipId_fkey" FOREIGN KEY ("ipId") REFERENCES "Ip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEntry" ADD CONSTRAINT "CalendarEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
