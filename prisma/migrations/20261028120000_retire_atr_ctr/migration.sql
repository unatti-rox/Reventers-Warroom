-- Log it now offers only WIP, LIVE and REJECTED. Posts waiting on the
-- agency go back to WIP; posts with the client (CTR, formerly "Done")
-- were already counted as delivered, so they become LIVE and the
-- dashboard numbers don't move. The enum keeps ATR and CTR so code
-- still running against this database doesn't break.
UPDATE "CalendarEntry" SET "status" = 'WIP' WHERE "status" = 'ATR';
UPDATE "CalendarEntry" SET "status" = 'LIVE' WHERE "status" = 'CTR';
