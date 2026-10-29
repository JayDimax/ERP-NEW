# AT-ERP — Repository Guidelines

## 1. Project Context

AT-ERP is a React 18 + TypeScript + Vite ERP for educational and training institutions.

Core domains include:
- Tenant administration
- RBAC
- Accounting / GL
- Accounts Receivable
- Accounts Payable
- Inventory
- Training operations
- Payroll
- Subscriptions
- Audit logs
- Backup / restore
- Student and trainer portals

Backend persistence uses Supabase.

The application entry flow is:

`index.tsx` → `App.tsx`

`App.tsx` currently handles authentication, tenant selection, tab routing, global state hydration, cross-module handlers, notifications, and view orchestration.

---

## 2. Primary Development Rule

Prefer the **smallest correct change** that satisfies the requested task.

Before creating new code:

1. Inspect the directly affected files.
2. Search for an existing implementation or pattern.
3. Reuse existing components, services, types, utilities, and conventions.
4. Modify existing code when appropriate instead of creating parallel abstractions.
5. Load additional documentation only when necessary.

Do not over-engineer localized changes.

Do not perform repository-wide exploration when targeted inspection is sufficient.

---

## 3. Project Structure

Use these locations as the primary source of truth:

- `App.tsx` — SPA controller, routing, orchestration, global handlers.
- `views/` — feature screens using `[Feature]View.tsx`.
- `components/` — shared/reusable UI components.
- `services/` — domain logic and persistence.
- `services/IDataService.ts` — persistence contract.
- `services/SupabaseDataService.ts` — active Supabase implementation.
- `services/DataServiceFactory.ts` — data-service factory.
- `types.ts` — shared entities, statuses, roles, permissions, and domain types.
- `config/app.ts` — runtime/Supabase configuration.
- `config/permissions.ts` — RBAC/module/action permissions.
- `accountingService.ts` — accounting calculations and reporting helpers.
- `db.ts` — fallback initialization and chart-of-accounts template.
- `supabase/migrations/` — database migrations.
- `supabase/functions/` — privileged Edge Functions.
- `tests/` — Vitest tests.

Root-level `views/` and `services/` are the active application paths unless imports prove otherwise.

Do not assume similarly named files under `src/` are active.

Do not assume `.disabled` migrations were applied.

---

## 4. Documentation Loading Rules

Do **not** preload or read all documentation for every task.

Start with the affected code.

Load documentation selectively:

### Architecture / Cross-Module Changes
Read:

`docs/architecture.md`

Use when changing:
- application structure
- routing
- service boundaries
- global state
- cross-module behavior
- major abstractions

### Database / Supabase Changes
Read:

`docs/database.md`

Use when changing:
- tables or columns
- migrations
- relationships
- RLS
- RPC
- Edge Functions
- persistence behavior
- tenant-scoped queries

### Business / Accounting Rules
Read:

`docs/business-rules.md`

Use when changing:
- accounting
- AR/AP
- invoicing
- payments
- payroll
- inventory posting
- enrollment financial workflows
- period closing
- state transitions
- business validations

### Documentation Discovery

Use `docs/README.md` only when the correct supporting document is unclear.

### Simple Changes

For localized UI, text, styling, straightforward bug fixes, or isolated component changes:

**Do not load domain documentation unless required to understand the behavior.**

---

## 5. Change Discipline

Do not:

- refactor unrelated code
- redesign architecture for a localized task
- introduce libraries without clear necessity
- create duplicate components
- create duplicate services
- duplicate domain types
- create unnecessary wrappers or abstractions
- rename unrelated files or symbols
- reorganize unrelated directories
- change established patterns without reason
- modify unrelated modules
- silently change existing business behavior

Preserve existing behavior unless the task explicitly requires changing it.

If a requested change conflicts with an existing business rule or architectural constraint, identify the conflict before bypassing the rule.

---

## 6. Coding Conventions

Use:

- React function components
- TypeScript
- `react-jsx`
- existing project patterns

Keep feature screens in:

`views/`

Keep reusable UI in:

`components/`

Use models from:

`types.ts`

Do not create ad hoc duplicate entity shapes when an existing model can be extended or reused.

Keep domain calculations and business logic out of JSX when practical.

Persistence must remain behind:

`IDataService`

and the active service implementation.

When adding or changing persistence operations, keep:

`IDataService.ts`

and:

`SupabaseDataService.ts`

consistent.

Use:

- camelCase for TypeScript models
- snake_case for Supabase tables/columns

Follow nearby formatting.

Do not perform formatting-only changes outside the task.

---

## 7. Supabase / Tenant Safety

Runtime configuration uses:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENV`

Privileged operations may use Edge Functions from:

`supabase/functions/`

Common soft-delete fields include:

- `is_deleted`
- `deleted_at`
- `deleted_by`

Tenant-specific data must remain scoped by:

`orgId`

Never remove or weaken tenant isolation merely to simplify a query or make a feature work.

Before modifying a tenant-sensitive query, verify its organization scope.

Do not expose service-role credentials to client-side code.

---

## 8. Accounting Invariants

Accounting correctness has priority over implementation convenience.

Always preserve these invariants:

- Journal entries must balance before posting.
- Posted/finalized documents must not be casually mutated.
- Existing posted/voided guards must remain enforced.
- Financial transactions must preserve their audit trail.
- Related balances and statuses must remain synchronized.
- Closing/locked periods must respect existing restrictions.
- Inventory-generated GL entries must remain consistent with inventory transactions.

Never bypass an accounting validation merely to make a workflow or test pass.

Prefer reversal/correction workflows over destructive modification of posted financial records where the existing architecture supports them.

---

## 9. Cross-Module Integrity

Treat these relationships carefully:

`Sponsor → Enrollment → Assessment → Invoice → Payment → GL`

Changes affecting one part of this chain may affect downstream records.

Before modifying these workflows:

1. Trace the affected data path.
2. Identify related state transitions.
3. Check financial impact.
4. Check tenant scope.
5. Check existing tests.
6. Update dependent balances/statuses when required by existing rules.

Student and trainer users must remain linked to their corresponding records.

Inventory adjustments that generate accounting entries must preserve item, location, stock-level, and GL consistency.

---

## 10. High-Risk Areas

Treat changes involving the following as **high risk**:

- journal posting
- ledger calculations
- trial balance
- balance sheet
- income statement
- financial statements
- AR/AP balances
- invoices and payments
- payroll calculations
- tax/statutory calculations
- inventory costing
- inventory → GL posting
- period closing
- migrations
- RLS
- tenant isolation
- authentication
- RBAC
- privileged Edge Functions

For high-risk changes:

1. Read the relevant business/database documentation.
2. Inspect the existing implementation.
3. Trace affected data flow.
4. Identify invariants before editing.
5. Make the smallest safe change.
6. Add or update focused tests when behavior changes.
7. Run relevant tests.
8. Run the production build when appropriate.

Do not perform broad refactoring as part of a high-risk fix unless explicitly requested.

---

## 11. Testing Strategy

Tests use:

- Vitest
- React Testing Library

Tests are located in:

`tests/`

Prefer **focused testing**, not the entire suite by default.

For a view change:
- test user-visible behavior
- mock service calls where appropriate

For service/domain changes:
- test calculations
- state transitions
- validation rules
- edge cases

For accounting changes:
- test balancing
- posting restrictions
- affected totals/statuses
- relevant failure conditions

Run broader tests when the change affects shared infrastructure or multiple modules.

Never change a valid test simply to make an incorrect implementation pass.

---

## 12. Commands

Development:

`npm run dev`

Production build:

`npm run build`

Tests:

`npm test`

Single test:

`npm test -- tests/<TestFile>.test.tsx --run`

Watch mode:

`npm run test:watch`

Prefer the narrowest relevant verification command first.

---

## 13. Search and Context Efficiency

Minimize unnecessary context usage.

For each task:

1. Identify the likely affected module.
2. Inspect the most relevant files first.
3. Search for exact symbols/functions/components when possible.
4. Expand investigation only when dependencies require it.
5. Read only relevant documentation.
6. Avoid repeatedly reading unchanged large files.
7. Avoid scanning generated/build/vendor directories.
8. Stop investigating once enough context exists to make the change safely.

Do not read the entire repository before starting implementation.

Do not reread files already understood unless new evidence requires it.

---

## 14. Implementation Workflow

For normal tasks:

**Inspect → Understand → Change → Verify → Stop**

Use a short plan only when the task spans multiple files, modules, or business rules.

Do not produce elaborate implementation plans for trivial changes.

For complex or high-risk tasks:

**Inspect → Relevant Docs → Trace Dependencies → Plan → Implement → Test → Review**

Keep planning proportional to task complexity.

---

## 15. Completion Rules

Before declaring a task complete:

- requested behavior is implemented
- existing relevant behavior is preserved
- no unnecessary architecture was introduced
- no unrelated files were modified
- TypeScript/build errors caused by the change are resolved
- relevant tests pass
- tenant isolation remains intact
- accounting/business invariants remain intact

Report concisely:

1. What changed
2. Important files changed
3. Verification performed
4. Any unresolved risk or follow-up

Do not provide lengthy explanations when a concise completion summary is sufficient.

---

## 16. Priority Order

When instructions conflict, prioritize:

1. Data integrity
2. Accounting correctness
3. Tenant isolation and security
4. Explicit business rules
5. Existing project architecture
6. Existing reusable implementation
7. Requested feature behavior
8. Minimal implementation
9. Code cleanliness

Never sacrifice data integrity, accounting correctness, tenant isolation, or security merely to reduce code size.