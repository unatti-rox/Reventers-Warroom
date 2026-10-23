-- AlterTable
ALTER TABLE "Shoot" ADD COLUMN     "brandId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Shoot" ADD CONSTRAINT "Shoot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
