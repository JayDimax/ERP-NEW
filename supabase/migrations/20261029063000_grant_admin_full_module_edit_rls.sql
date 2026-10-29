-- Migration: 20261029063000_grant_admin_full_module_edit_rls.sql
-- Ensures organization ADMIN role has full tenant-scoped edit privileges across all modules,
-- including Users/RBAC update & delete policies (with privilege-escalation guards) and
-- standardized exchange_rates RLS policies.

-- ============================================================================
-- 1. Users & Security (public.users): Tenant-scoped ADMIN edit/delete + self-profile update
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_users_update_security()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Service role / privileged Edge Functions bypass client-level restrictions
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF NOT private.erp_is_system_admin() THEN
    IF upper(coalesce(OLD.role::text, '')) = 'SYSTEM_ADMIN' THEN
      RAISE EXCEPTION 'Only System Administrators may modify a SYSTEM_ADMIN account.'
        USING ERRCODE = '42501';
    END IF;

    IF upper(coalesce(NEW.role::text, '')) = 'SYSTEM_ADMIN' THEN
      RAISE EXCEPTION 'Only System Administrators may assign the SYSTEM_ADMIN role.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'Cannot move a user across organizations.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.auth_uid IS DISTINCT FROM OLD.auth_uid THEN
      RAISE EXCEPTION 'Cannot modify linked authentication UID from client.'
        USING ERRCODE = '42501';
    END IF;

    -- Non-ADMIN users updating their own profile cannot alter role or security fields
    IF NOT private.erp_has_role('ADMIN') THEN
      IF upper(coalesce(NEW.role::text, '')) IS DISTINCT FROM upper(coalesce(OLD.role::text, ''))
         OR NEW.is_active IS DISTINCT FROM OLD.is_active
         OR NEW.student_id IS DISTINCT FROM OLD.student_id
         OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id
         OR NEW.failed_login_attempts IS DISTINCT FROM OLD.failed_login_attempts
         OR NEW.locked_until IS DISTINCT FROM OLD.locked_until THEN
        RAISE EXCEPTION 'Only Organization Administrators may modify user roles or security attributes.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_users_update_security ON public.users;
CREATE TRIGGER trg_enforce_users_update_security
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_users_update_security();

DROP POLICY IF EXISTS users_self_or_admin_update ON public.users;
CREATE POLICY users_self_or_admin_update ON public.users
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT private.erp_is_system_admin())
    OR (auth_uid = (SELECT auth.uid()))
    OR (
      org_id = (SELECT private.erp_org_id())
      AND (SELECT private.erp_has_role('ADMIN'))
      AND upper(coalesce(role::text, '')) <> 'SYSTEM_ADMIN'
    )
  )
  WITH CHECK (
    (SELECT private.erp_is_system_admin())
    OR (
      (auth_uid = (SELECT auth.uid()) OR (SELECT private.erp_has_role('ADMIN')))
      AND org_id = (SELECT private.erp_org_id())
      AND upper(coalesce(role::text, '')) <> 'SYSTEM_ADMIN'
    )
  );

DROP POLICY IF EXISTS users_admin_delete ON public.users;
CREATE POLICY users_admin_delete ON public.users
  FOR DELETE
  TO authenticated
  USING (
    (SELECT private.erp_is_system_admin())
    OR (
      org_id = (SELECT private.erp_org_id())
      AND (SELECT private.erp_has_role('ADMIN'))
      AND upper(coalesce(role::text, '')) <> 'SYSTEM_ADMIN'
    )
  );

-- ============================================================================
-- 2. Exchange Rates (public.exchange_rates): Fix legacy users.id = auth.uid() policies
-- ============================================================================

REVOKE ALL ON public.exchange_rates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;

DROP POLICY IF EXISTS exchange_rates_view_org ON public.exchange_rates;
DROP POLICY IF EXISTS exchange_rates_insert_org ON public.exchange_rates;
DROP POLICY IF EXISTS exchange_rates_update_org ON public.exchange_rates;
DROP POLICY IF EXISTS exchange_rates_delete_org ON public.exchange_rates;
DROP POLICY IF EXISTS exchange_rates_tenant_select ON public.exchange_rates;
DROP POLICY IF EXISTS exchange_rates_finance_write ON public.exchange_rates;

CREATE POLICY exchange_rates_tenant_select ON public.exchange_rates
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.erp_is_system_admin())
    OR org_id = (SELECT private.erp_org_id())
  );

CREATE POLICY exchange_rates_finance_write ON public.exchange_rates
  FOR ALL
  TO authenticated
  USING (
    ((SELECT private.erp_is_system_admin()) OR org_id = (SELECT private.erp_org_id()))
    AND (SELECT private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY'))
  )
  WITH CHECK (
    ((SELECT private.erp_is_system_admin()) OR org_id = (SELECT private.erp_org_id()))
    AND (SELECT private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'TREASURY'))
  );

-- ============================================================================
-- 3. AP Memos (public.ap_memos): Allow ADMIN/Finance delete on unposted drafts only
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ap_memos TO authenticated;

DROP POLICY IF EXISTS ap_memos_admin_delete ON public.ap_memos;
CREATE POLICY ap_memos_admin_delete ON public.ap_memos
  FOR DELETE
  TO authenticated
  USING (
    ((SELECT private.erp_is_system_admin()) OR org_id = (SELECT private.erp_org_id()))
    AND (SELECT private.erp_has_role('SYSTEM_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'AP_SUPERVISOR'))
    AND upper(coalesce(status::text, '')) IN ('DRAFT', 'CANCELLED')
  );

