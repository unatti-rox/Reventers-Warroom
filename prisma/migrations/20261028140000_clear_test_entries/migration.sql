-- One-time clean-up before go-live: the posts on Log it so far were test
-- entries. Remove all of them so account directors and CSs start fresh.
-- Brands, cohorts, buckets, people, festivals, shoots and targets are kept.
DELETE FROM "CalendarEntry";
