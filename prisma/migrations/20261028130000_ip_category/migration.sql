-- Each content bucket now counts toward IP, Non-IP or Festive on the dashboard.
CREATE TYPE "IpCategory" AS ENUM ('IP', 'NON_IP', 'FESTIVE');
ALTER TABLE "Ip" ADD COLUMN "category" "IpCategory" NOT NULL DEFAULT 'IP';

UPDATE "Ip" SET "category" = 'NON_IP'
WHERE "name" IN ('Contests / Regular GIFs', 'Amenity / Project Reels', 'Teaser / Launch Reels and AVs');

-- Festive posts are planned against a festival; the old bucket's posts count as Festive.
UPDATE "Ip" SET "category" = 'FESTIVE' WHERE "name" = 'Festive Reels / AV';

-- Split "History / Brand Based Reels": the existing bucket (and its posts)
-- becomes History (IP); Brand Based Reels is a new Non-IP bucket with the
-- same cohorts and team.
DO $$
DECLARE
  old_id TEXT;
  new_id TEXT := 'ip_brand_based_reels';
BEGIN
  SELECT "id" INTO old_id FROM "Ip" WHERE "name" = 'History / Brand Based Reels';
  IF old_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE "Ip" SET "name" = 'History' WHERE "id" = old_id;
  UPDATE "Ip" SET "sortOrder" = "sortOrder" + 1 WHERE "sortOrder" > (SELECT "sortOrder" FROM "Ip" WHERE "id" = old_id) AND "sortOrder" < 1000;
  INSERT INTO "Ip" ("id", "name", "sortOrder", "category")
  SELECT new_id, 'Brand Based Reels', "sortOrder" + 1, 'NON_IP' FROM "Ip" WHERE "id" = old_id
  ON CONFLICT ("name") DO NOTHING;
  INSERT INTO "_CohortToIp" ("A", "B") SELECT "A", new_id FROM "_CohortToIp" WHERE "B" = old_id ON CONFLICT DO NOTHING;
  INSERT INTO "PersonAssignment" ("id", "personId", "ipId", "role")
  SELECT 'pa_bbr_' || "id", "personId", new_id, "role" FROM "PersonAssignment" WHERE "ipId" = old_id ON CONFLICT DO NOTHING;
END $$;
