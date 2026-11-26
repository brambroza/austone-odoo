-- Live progress of a running Odoo sync / calculation (step, total, label, token of the click), so the
-- button can show a real percentage while the server works. Overwritten by each run; null when never run.
-- Idempotent; run once in the Supabase SQL Editor.
ALTER TABLE "CommissionRun"
    ADD COLUMN IF NOT EXISTS "progress" JSONB;

NOTIFY pgrst, 'reload schema';
