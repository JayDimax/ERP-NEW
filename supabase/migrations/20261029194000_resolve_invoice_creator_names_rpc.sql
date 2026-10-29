-- Tenant-scoped lookup of display names for users referenced in invoices.created_by.
-- Allows authorized tenant users to see the human-readable creator name on invoices
-- in their own organization (e.g., when created by a cross-org SYSTEM_ADMIN) without
-- exposing cross-tenant user records or sensitive user columns.
create or replace function public.get_org_invoice_creator_names(p_org_id uuid)
returns table (
  user_id uuid,
  auth_uid uuid,
  display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_org_id is null then
    return;
  end if;

  if not (private.erp_is_system_admin() or p_org_id = private.erp_org_id()) then
    raise exception 'Not authorized for this organization.';
  end if;

  return query
  with org_creators as (
    select distinct i.created_by::text as creator_key
    from public.invoices i
    where i.org_id = p_org_id
      and i.created_by is not null
  )
  select
    u.id as user_id,
    u.auth_uid,
    coalesce(
      nullif(
        btrim(
          case
            when nullif(btrim(u.last_name), '') is not null
              and lower(right(btrim(coalesce(u.name, '')), length(btrim(u.last_name)))) <> lower(btrim(u.last_name))
            then concat_ws(' ', nullif(btrim(u.name), ''), nullif(btrim(u.last_name), ''))
            else btrim(coalesce(u.name, ''))
          end
        ),
        ''
      ),
      u.email
    )::text as display_name
  from public.users u
  where u.id::text in (select creator_key from org_creators)
     or (u.auth_uid is not null and u.auth_uid::text in (select creator_key from org_creators));
end;
$$;

revoke all on function public.get_org_invoice_creator_names(uuid) from public, anon;
grant execute on function public.get_org_invoice_creator_names(uuid) to authenticated;

