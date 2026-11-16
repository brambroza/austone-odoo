-- Commission rate kind: add PERCENT_GROSS (% of the amount including VAT) beside PERCENT (% before VAT) and PER_UNIT.
-- Idempotent; run once in the Supabase SQL Editor.
ALTER TABLE "CommissionRate" DROP CONSTRAINT IF EXISTS "CommissionRate_kind_check";
ALTER TABLE "CommissionRate"
    ADD CONSTRAINT "CommissionRate_kind_check" CHECK ("kind" IN ('PERCENT', 'PERCENT_GROSS', 'PER_UNIT'));

NOTIFY pgrst, 'reload schema';
