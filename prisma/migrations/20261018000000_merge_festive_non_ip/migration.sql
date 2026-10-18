-- DropForeignKey
ALTER TABLE "FestiveEntry" DROP CONSTRAINT "FestiveEntry_brandId_fkey";

-- DropForeignKey
ALTER TABLE "FestiveEntry" DROP CONSTRAINT "FestiveEntry_festivalId_fkey";

-- DropForeignKey
ALTER TABLE "NonIpEntry" DROP CONSTRAINT "NonIpEntry_brandId_fkey";

-- DropTable
DROP TABLE "FestiveEntry";

-- DropTable
DROP TABLE "NonIpEntry";

-- DropEnum
DROP TYPE "FestiveFormat";

-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('FESTIVAL', 'NON_IP');

-- CreateEnum
CREATE TYPE "PlanFormat" AS ENUM ('STORY', 'REEL', 'AV', 'GIF');

-- CreateTable
CREATE TABLE "PlannedEntry" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "kind" "PlanKind" NOT NULL,
    "festivalId" TEXT,
    "workLabel" TEXT,
    "format" "PlanFormat" NOT NULL,
    "achieved" INTEGER NOT NULL DEFAULT 0,
    "live" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlannedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedEntry_monthKey_idx" ON "PlannedEntry"("monthKey");

-- AddForeignKey
ALTER TABLE "PlannedEntry" ADD CONSTRAINT "PlannedEntry_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedEntry" ADD CONSTRAINT "PlannedEntry_festivalId_fkey" FOREIGN KEY ("festivalId") REFERENCES "Festival"("id") ON DELETE CASCADE ON UPDATE CASCADE;
