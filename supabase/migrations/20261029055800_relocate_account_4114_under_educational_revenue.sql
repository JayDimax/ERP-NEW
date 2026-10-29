-- Migration: 20261029055800_relocate_account_4114_under_educational_revenue.sql
-- Relocates account 4114 (Processing Fee (TESDA)) under 4100 Educational Revenue within the same organization
-- and converts it from an accidental root header into an active posting sub-account (when it has no child accounts).

WITH target_parents AS (
  SELECT DISTINCT ON (p.org_id)
    p.org_id,
    p.id AS parent_id
  FROM public.chart_of_accounts AS p
  WHERE p.is_header = true
    AND (
      LOWER(TRIM(p.name)) = 'educational revenue'
      OR p.code = '4100'
    )
  ORDER BY
    p.org_id,
    CASE WHEN LOWER(TRIM(p.name)) = 'educational revenue' THEN 0 ELSE 1 END,
    p.code ASC
)
UPDATE public.chart_of_accounts AS child
SET
  parent_id = tp.parent_id,
  class = 'REVENUE',
  is_header = CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.chart_of_accounts AS sub
      WHERE sub.parent_id = child.id
    ) THEN child.is_header
    ELSE false
  END,
  is_active = true
FROM target_parents AS tp
WHERE child.org_id = tp.org_id
  AND child.code = '4114'
  AND child.id <> tp.parent_id
  AND (
    child.parent_id IS DISTINCT FROM tp.parent_id
    OR child.class IS DISTINCT FROM 'REVENUE'
    OR child.is_header = true
    OR child.is_active = false
  );
