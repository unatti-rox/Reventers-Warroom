-- Shoot Schedule: client servicing person and start time.
ALTER TABLE "Shoot" ADD COLUMN "cs" TEXT NOT NULL DEFAULT '',
ADD COLUMN "time" TEXT NOT NULL DEFAULT '';
