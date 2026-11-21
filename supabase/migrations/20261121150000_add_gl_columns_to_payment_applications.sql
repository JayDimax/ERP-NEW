-- Ensure payment_applications stores GL linkage and application metadata in Supabase Cloud
-- and backfill existing applied rows from posted APPLICATION journal entries.

ALTER TABLE public.payment_applications
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS application_no text,
  ADD COLUMN IF NOT EXISTS gl_reference text,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text;

-- Backfill org_id from parent payment where missing
UPDATE public.payment_applications pa
SET org_id = p.org_id
FROM public.payments p
WHERE pa.payment_id = p.id
  AND pa.org_id IS NULL;

-- Backfill journal_entry_id and gl_reference from posted APPLICATION journal entries
UPDATE public.payment_applications pa
SET
  journal_entry_id = COALESCE(pa.journal_entry_id, je.id),
  gl_reference = COALESCE(NULLIF(BTRIM(pa.gl_reference), ''), NULLIF(BTRIM(je.gl_entry_number), ''), NULLIF(BTRIM(je.reference), '')),
  application_no = COALESCE(NULLIF(BTRIM(pa.application_no), ''), CASE WHEN je.reference LIKE 'PAYAPP-%' THEN je.reference ELSE NULL END)
FROM public.journal_entries je
WHERE UPPER(COALESCE(je.source_type, '')) = 'APPLICATION'
  AND je.source_ref = pa.id
  AND (pa.journal_entry_id IS NULL OR NULLIF(BTRIM(COALESCE(pa.gl_reference, '')), '') IS NULL);
