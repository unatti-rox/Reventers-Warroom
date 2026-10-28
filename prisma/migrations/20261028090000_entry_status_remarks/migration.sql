-- Log it: WIP / ATR / CTR / LIVE / REJECTED statuses and a remarks column.
-- Existing entries keep their meaning: PENDING becomes WIP, DONE becomes CTR,
-- LIVE stays LIVE. Renaming enum values keeps existing rows and the column
-- default (now WIP) pointing at the same value.
ALTER TYPE "EntryStatus" RENAME VALUE 'PENDING' TO 'WIP';
ALTER TYPE "EntryStatus" RENAME VALUE 'DONE' TO 'CTR';
ALTER TYPE "EntryStatus" ADD VALUE 'ATR' BEFORE 'CTR';
ALTER TYPE "EntryStatus" ADD VALUE 'REJECTED';

ALTER TABLE "CalendarEntry" ADD COLUMN "remarks" TEXT;
