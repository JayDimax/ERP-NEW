-- Allow billing and receiving payments for "Other" customers (e.g., rentals or miscellaneous walk-in payers)
-- using a free-text name not linked to a sponsor, registered student, or provisional student.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS other_customer_name text;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS check_sponsor_or_student;

ALTER TABLE public.invoices
  ADD CONSTRAINT check_sponsor_or_student CHECK (
    sponsor_id IS NOT NULL
    OR student_id IS NOT NULL
    OR NULLIF(BTRIM(COALESCE(other_customer_name, '')), '') IS NOT NULL
    OR upper(COALESCE(status::text, '')) = 'VOIDED'
  );

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS other_customer_name text;
