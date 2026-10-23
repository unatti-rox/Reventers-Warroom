-- AlterTable
ALTER TABLE "BrandIpMonth" DROP COLUMN "achieved",
DROP COLUMN "live";

-- CreateTable
CREATE TABLE "Piece" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ipId" TEXT NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "loggedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Piece_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Piece_monthKey_brandId_ipId_idx" ON "Piece"("monthKey", "brandId", "ipId");

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_ipId_fkey" FOREIGN KEY ("ipId") REFERENCES "Ip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Piece" ADD CONSTRAINT "Piece_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
