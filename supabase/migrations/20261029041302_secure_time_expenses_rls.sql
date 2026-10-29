-- Migration: 20261029041302_secure_time_expenses_rls.sql
-- Standardizes Row Level Security (RLS) and table privileges for public.time_expenses
-- Aligns tenant isolation and SYSTEM_ADMIN / AP role access with private.erp_org_id() and private.erp_has_role()

ALTER TABLE public.time_expenses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.time_expenses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_expenses TO authenticated;

DROP POLICY IF EXISTS "time expenses tenant access" ON public.time_expenses;
DROP POLICY IF EXISTS "time_expenses_insert_own" ON public.time_expenses;
DROP POLICY IF EXISTS time_expenses_tenant_select ON public.time_expenses;
DROP POLICY IF EXISTS time_expenses_ap_insert ON public.time_expenses;
DROP POLICY IF EXISTS time_expenses_ap_update ON public.time_expenses;
DROP POLICY IF EXISTS time_expenses_ap_delete ON public.time_expenses;

CREATE POLICY time_expenses_tenant_select ON public.time_expenses
  FOR SELECT TO authenticated
  USING (
    (SELECT private.erp_is_system_admin())
    OR org_id = (SELECT private.erp_org_id())
  );

CREATE POLICY time_expenses_ap_insert ON public.time_expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (SELECT private.erp_is_system_admin())
      OR org_id = (SELECT private.erp_org_id())
    )
    AND (SELECT private.erp_has_role(
      'SYSTEM_ADMIN',
      'ADMIN',
      'PRESIDENT',
      'FINANCE_MANAGER',
      'ACCOUNTANT',
      'AP_SPECIALIST',
      'AP_CLERK',
      'AP_SUPERVISOR'
    ))
  );

CREATE POLICY time_expenses_ap_update ON public.time_expenses
  FOR UPDATE TO authenticated
  USING (
    (
      (SELECT private.erp_is_system_admin())
      OR org_id = (SELECT private.erp_org_id())
    )
    AND (SELECT private.erp_has_role(
      'SYSTEM_ADMIN',
      'ADMIN',
      'PRESIDENT',
      'FINANCE_MANAGER',
      'ACCOUNTANT',
      'AP_SPECIALIST',
      'AP_CLERK',
      'AP_SUPERVISOR'
    ))
  )
  WITH CHECK (
    (
      (SELECT private.erp_is_system_admin())
      OR org_id = (SELECT private.erp_org_id())
    )
    AND (SELECT private.erp_has_role(
      'SYSTEM_ADMIN',
      'ADMIN',
      'PRESIDENT',
      'FINANCE_MANAGER',
      'ACCOUNTANT',
      'AP_SPECIALIST',
      'AP_CLERK',
      'AP_SUPERVISOR'
    ))
  );

CREATE POLICY time_expenses_ap_delete ON public.time_expenses
  FOR DELETE TO authenticated
  USING (
    (
      (SELECT private.erp_is_system_admin())
      OR org_id = (SELECT private.erp_org_id())
    )
    AND (SELECT private.erp_has_role(
      'SYSTEM_ADMIN',
      'ADMIN',
      'PRESIDENT',
      'FINANCE_MANAGER',
      'ACCOUNTANT',
      'AP_SPECIALIST',
      'AP_CLERK',
      'AP_SUPERVISOR'
    ))
  );

