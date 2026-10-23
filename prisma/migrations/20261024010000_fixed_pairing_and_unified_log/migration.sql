-- Drop the weekly rotation engine entirely: cohorts are now fixed to their
-- IPs (see _CohortToIp below) instead of rotating through all of them
-- week by week, so there is nothing left to assign, trade, or status-check
-- per week.
DROP TABLE "RotationAssignment";
DROP TABLE "Trade";
DROP TABLE "CohortWeeklyStatus";
DROP TABLE "RotationEntry";
DROP TABLE "RotationCycle";

DROP TYPE "Week";
DROP TYPE "StatusState";

-- Fold Festive & Non-IP into the unified Piece log (see Piece changes below).
DROP TABLE "PlannedEntry";
DROP TYPE "PlanKind";

-- An IP's weekly target only existed for the rotation above; it's gone with it.
ALTER TABLE "Ip" DROP COLUMN "defaultWeeklyTarget";

-- CreateEnum
CREATE TYPE "PieceKind" AS ENUM ('REGULAR', 'FESTIVAL', 'NON_IP');

-- AlterTable: Piece now also carries Festive/Non-IP pieces (kind, festivalId,
-- workLabel, format), so ipId only applies to REGULAR pieces and becomes optional.
ALTER TABLE "Piece"
  ADD COLUMN "kind" "PieceKind" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN "festivalId" TEXT,
  ADD COLUMN "workLabel" TEXT,
  ADD COLUMN "format" "PlanFormat",
  ALTER COLUMN "ipId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Piece_monthKey_brandId_kind_festivalId_workLabel_format_idx" ON "Piece"("monthKey", "brandId", "kind", "festivalId", "workLabel", "format");

-- CreateTable: fixed Cohort <-> IP pairing, set once in Admin.
CREATE TABLE "_CohortToIp" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_CohortToIp_AB_unique" ON "_CohortToIp"("A", "B");

-- CreateIndex
CREATE INDEX "_CohortToIp_B_index" ON "_CohortToIp"("B");

-- AddForeignKey
ALTER TABLE "_CohortToIp" ADD CONSTRAINT "_CohortToIp_A_fkey" FOREIGN KEY ("A") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CohortToIp" ADD CONSTRAINT "_CohortToIp_B_fkey" FOREIGN KEY ("B") REFERENCES "Ip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
