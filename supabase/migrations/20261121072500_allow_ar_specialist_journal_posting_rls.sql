-- Allow AR_SPECIALIST to post AR-originated journal entries and journal lines
-- within their own organization (matching config/permissions.ts where AR_SPECIALIST
-- has 'post' and 'void' permissions on invoices, non-invoice-payments, and payments).
-- Preserves tenant isolation and prevents AR_SPECIALIST from deleting POSTED entries.

DROP POLICY IF EXISTS je_finance_insert ON public.journal_entries;
CREATE POLICY je_finance_insert ON public.journal_entries FOR INSERT TO authenticated
WITH CHECK (
  (private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST')
);

DROP POLICY IF EXISTS je_finance_update ON public.journal_entries;
CREATE POLICY je_finance_update ON public.journal_entries FOR UPDATE TO authenticated
USING (
  (private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST')
)
WITH CHECK (
  (private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST')
);

DROP POLICY IF EXISTS je_ar_draft_rollback_delete ON public.journal_entries;
CREATE POLICY je_ar_draft_rollback_delete ON public.journal_entries FOR DELETE TO authenticated
USING (
  (private.erp_is_system_admin() OR org_id = private.erp_org_id())
  AND private.erp_has_role('AR_SPECIALIST')
  AND upper(coalesce(status::text, '')) = 'DRAFT'
);

DROP POLICY IF EXISTS jl_finance_insert ON public.journal_lines;
CREATE POLICY jl_finance_insert ON public.journal_lines FOR INSERT TO authenticated
WITH CHECK (
  private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST')
  AND EXISTS (
    SELECT 1 FROM public.journal_entries j
    WHERE j.id = journal_entry_id
      AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())
  )
);

DROP POLICY IF EXISTS jl_finance_update ON public.journal_lines;
CREATE POLICY jl_finance_update ON public.journal_lines FOR UPDATE TO authenticated
USING (
  private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST')
  AND EXISTS (
    SELECT 1 FROM public.journal_entries j
    WHERE j.id = journal_entry_id
      AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())
  )
)
WITH CHECK (
  private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST')
  AND EXISTS (
    SELECT 1 FROM public.journal_entries j
    WHERE j.id = journal_entry_id
      AND (private.erp_is_system_admin() OR j.org_id = private.erp_org_id())
  )
);
