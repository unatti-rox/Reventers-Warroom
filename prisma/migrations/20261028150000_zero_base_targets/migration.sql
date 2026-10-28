-- The 192/month base and +4 per new brand no longer apply: the floor's
-- target is its scope (posts planned on Log it). Zero the base settings
-- and clear any per-month base/achieved overrides.
UPDATE "AppSetting" SET "value" = '0' WHERE "key" IN ('target.baseMonthly', 'target.perBrand');
UPDATE "MonthSetting" SET "baseOverride" = NULL, "achievedOverride" = NULL;
