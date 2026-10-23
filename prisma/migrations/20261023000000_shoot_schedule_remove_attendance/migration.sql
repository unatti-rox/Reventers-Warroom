-- DropForeignKey
ALTER TABLE "AttendanceDay" DROP CONSTRAINT "AttendanceDay_personId_fkey";

-- DropTable
DROP TABLE "AttendanceDay";

-- CreateTable
CREATE TABLE "Shoot" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dop" TEXT NOT NULL,
    "socialMediaPerson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shoot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shoot_date_idx" ON "Shoot"("date");

-- AddForeignKey
ALTER TABLE "Shoot" ADD CONSTRAINT "Shoot_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
