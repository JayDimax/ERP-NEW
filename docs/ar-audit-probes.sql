-- Local-only audit probes. All data changes are rolled back.
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', auth_uid, 'role', 'authenticated')::text, true)
FROM public.users WHERE role = 'AR_SPECIALIST' AND is_active LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT private.erp_app_role() AS actor_role,
       private.erp_has_role('SYSTEM_ADMIN','ADMIN','FINANCE_MANAGER','ACCOUNTANT') AS journal_write_allowed;
DO $$
BEGIN
  INSERT INTO public.journal_entries(org_id,date,description,status,source_type)
  VALUES(private.erp_org_id(),CURRENT_DATE,'AR audit rollback probe','DRAFT','INVOICE');
  RAISE NOTICE 'AR journal insert SUCCEEDED';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'AR journal insert BLOCKED by RLS: %', SQLERRM;
END $$;
ROLLBACK;

BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', auth_uid, 'role', 'authenticated')::text, true)
FROM public.users WHERE role = 'STUDENT' AND is_active LIMIT 1;
SET LOCAL ROLE authenticated;
SELECT private.erp_app_role() AS actor_role;
DO $$
BEGIN
  INSERT INTO public.payments(org_id,payment_no,payment_method,amount_received,student_id)
  VALUES(private.erp_org_id(),'AR-AUDIT-' || gen_random_uuid()::text,'CASH',1,
         (SELECT id FROM public.students WHERE org_id=private.erp_org_id() LIMIT 1));
  RAISE NOTICE 'STUDENT payment insert SUCCEEDED (permission defect)';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'STUDENT payment insert correctly BLOCKED: %', SQLERRM;
END $$;
ROLLBACK;
