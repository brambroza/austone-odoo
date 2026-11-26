-- Documents Odoo shows on a receipt (same full reconciliation) that the receipt's cash did not pay,
-- e.g. invoices closed only by credit notes and the credit notes themselves. Kept on the run so the
-- collections page lists every document of a receipt as Odoo does; they earn no commission.
-- Idempotent; run once in the Supabase SQL Editor.
ALTER TABLE "CommissionRun"
    ADD COLUMN IF NOT EXISTS "linkedDocs" JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
