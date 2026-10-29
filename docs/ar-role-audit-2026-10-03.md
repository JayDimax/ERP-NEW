# AR role and workflow audit — 2026-10-03

Verdict: REQUEST CHANGES. Confidence: high for database permission probes; medium for workflows traced in code.

## Environment and validation

Started the existing local Supabase project ERP-NEW. Database container `supabase_db_ERP-NEW` is healthy, with API at http://127.0.0.1:54321 and Studio at http://127.0.0.1:54323. No reset or migration deployment was performed.

- Production build: passed; existing bundle-size and mixed-import warnings remain.
- Six focused test files: 36 passed, 2 failed. Run with `NODE_ENV=test`; inherited production mode initially caused React `act` failures. Remaining failures in `tests/ARView.test.tsx` target obsolete default-view labels/buttons, so they do not establish a runtime crash.
- JournalWorkflowService: 5 tests passed. No PaymentWorkflowService or InvoiceTermsService test file was found by that additional invocation; those names did not add coverage.
- Live local database: AR journal insert rejected by RLS; STUDENT payment insert accepted. Both tests used transactions followed by ROLLBACK. Reproduction SQL: `docs/ar-audit-probes.sql`.
- No connected browser was available. No full browser login, persisted invoice/payment lifecycle, print/export, or Edge Function end-to-end test was completed. Unit tests mock persistence and cannot validate database permissions.

## Findings

### P1 — AR posting and adjustment workflows cannot write journals

`supabase/migrations/20260919140000_enable_comprehensive_rls.sql:218` permits journal entry and line writes for SYSTEM_ADMIN, ADMIN, FINANCE_MANAGER, and ACCOUNTANT, excluding AR_SPECIALIST. This matches the active local policies. The rollback probe under a real AR auth mapping returned SQLSTATE 42501 for a journal INSERT.

`services/SupabaseDataService.ts:5460` writes journal entries directly through REST. Invoice GL posting, write-offs, memo drafts/posting, and reclassification use this path. AR can insert an invoice but its GL write fails; App has a fallback that saves the invoice as a draft. These advertised actions therefore cannot complete as AR with the active policies.

Suggested fix: introduce tenant-scoped, source-specific transactional AR posting RPCs or privileged endpoints with explicit actor authorization. Align journal-line permissions with the chosen posting path; do not grant unrestricted manual GL mutation merely to unblock invoice posting.

### P1 — A permissive payment policy defeats role restrictions

Active policy `Enable insert for authenticated users only` uses WITH CHECK (true), alongside `payments_ar_insert`. Its source is `supabase/migrations/20260907000000_cloud_baseline.sql:7634`. Permissive policies combine with OR, so the restrictive policy does not constrain this policy.

The rollback probe authenticated as STUDENT successfully inserted a valid payment. The test used its own tenant; cross-tenant insertion was not exercised. The policy itself contains no tenant condition. Authorization in `payments-write` does not protect direct table inserts.

Suggested fix: remove the legacy permissive policy in a new migration and verify allowed AR inserts, denied student/trainer inserts, and denied other-tenant inserts against the deployed policy set.

### P1 — Memo and write-off posting do not synchronize invoice balances

`App.tsx:7861` and `App.tsx:7898` supply journal callbacks to adjustment screens but no invoice-update callback. `handleApproveJournal` at `App.tsx:2406` updates journal state only. Active database inspection found no journal-entry/line triggers that update invoices.

The allocation screens consume stored `invoice.balanceDue`. After an authorized finance user posts an adjustment, GL-based reports can reflect the reduction while invoices and payment application retain the old balance. Example: a 100 invoice with a 100 write-off can remain selectable with balanceDue=100. Fixing AR journal RLS alone leaves this integrity issue.

Suggested fix: persist invoice allocations and atomically update adjustment, GL, invoice balance/status, and reversal effects. Use the same balance calculation in payment validation and reporting.

### P1 — Multi-invoice memo allocations are lost on save

`views/ARCreditDebitMemoView.tsx:828` stores only `selectedInvoiceIdList[0]` in sourceRef, while journal lines contain the aggregate memo amount and free-text reason. Per-invoice amounts are not persisted. Reopening reconstructs amounts from current balances (`:698`) rather than the original allocation.

Example: selecting two invoices and allocating 30 and 70 saves one source invoice reference with a total of 100; the original split cannot be recovered reliably.

Suggested fix: persist typed allocation rows containing invoice ID and amount, and reload those exact rows for editing, posting, reversal, and audit.

### P1 — Aging uses journal date and FIFO credits rather than invoice terms/applications

`views/ARAgingReportView.tsx:178` resolves due date from journal fields and falls back to entry.date. The active journal schema has none of those due-date fields, and the provided invoices are used for number lookup rather than due-date resolution. `:214` applies all customer credits to the oldest charges, disregarding invoice payment applications.

An invoice dated today but due in 30 days ages from today. Paying a newer invoice can incorrectly reduce an older invoice's aging bucket.

Suggested fix: build aging from invoice due dates and actual application/adjustment allocations, with an explicit as-of cutoff and separate handling for unapplied credits.

### P2 — Navigation, action matrix, and database permissions disagree

- Reclassify and Collection Report are AR sidebar destinations (`App.tsx:7018`, `:7023`) but are missing from ModuleTab and AR role permissions. They currently render because navigateTo sets arbitrary tabs and these views lack module guards; a general route guard would make them inaccessible.
- AR action settings allow all actions by default on unspecified accessible modules (`config/permissions.ts:515` onward). This includes journal and inventory approvals/deletions even where view-specific role checks or RLS deny them.
- Invoice/payment delete is denied by ROLE_ACTIONS but allowed by active AR DELETE database policies. Delete callbacks are present, but no active delete control was found in these two views; this is a policy mismatch, not a proven clickable bypass.
- Register Learner deliberately grants create/view only. Customer List contains an edit branch, but editingStudent is only assigned null, so no reachable learner-edit UI was confirmed.

Suggested fix: define every active destination, enforce module access at routing, use explicit action allowlists, and match UI actions with server-side permissions. Decide whether AR inventory and manual journal access is intended before changing those grants.

## Workflow assessment

| Workflow | Result |
| --- | --- |
| AR login mapping | Two AR accounts have auth_uid mappings; browser login not tested |
| Learner registration | UI create permission and DB insert policy align; live submission not tested |
| Invoice entry and billing calculations | InvoicesView and mixed-batch tests pass with test-mode React |
| Invoice GL posting as AR | Blocked by active journal RLS |
| Payment entry | AR policy allows entry; direct table insertion also incorrectly allows STUDENT |
| Payment approval/application | Code reviewed; no persisted end-to-end test completed |
| Write-off, credit/debit memo, reclassification | Journal writes blocked as AR; balance/allocation defects remain after unblocking |
| Aging | Due-date and allocation correctness defects found by code inspection |
| Reports, SOA, receipts, print/export | Wiring inspected; browser behavior not verified |

Prioritize the journal posting path and unrestricted payment policy, then transactional balance/allocation handling and aging. Expand tests to include AR-authenticated database integration and complete invoice → payment → application → reversal workflows.
