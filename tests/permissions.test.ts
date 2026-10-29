import { describe, expect, it } from 'vitest';
import { ActionPermission, canAccess, canPerformAction, getDefaultTab, ModuleTab } from '../config/permissions';

describe('AP, AR, and Registrar permissions', () => {
  it('grants ADMIN access and full edit privileges across every organization module', () => {
    const allTenantModules: ModuleTab[] = [
      // Financial Core
      'dashboard', 'ledger', 'journal-vouchers', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking', 'checks',
      // AR Modules
      'ar', 'invoices', 'non-invoice-payments', 'payments', 'bank-deposits', 'customers',
      'ar-calendar-tasks', 'credit-debit-memo', 'write-off', 'reclassify',
      'aging-report', 'soa', 'customer-ledger', 'collection-receipt', 'collection-report',
      'recurring-invoices', 'revenue-recognition',
      // AP Modules
      'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
      // Payroll & Budgets
      'payroll', 'budgets',
      // Registries
      'sponsors', 'vendors', 'items', 'assets',
      // Inventory
      'inventory', 'warehouse-locations', 'stock-items', 'inventory-classes', 'opening-inventory',
      'stock-levels', 'stock-adjustments', 'reorder-points', 'inventory-transactions', 'inventory-reports',
      // Operations (Training)
      'students', 'trainers', 'qualifications', 'batches', 'transcripts', 'locations', 'schedules',
      'alumni-reports', 'enrollments', 'assessment-registrations', 'course-fees',
      // Organization Admin
      'employees', 'employee-directory', 'coa', 'periods', 'branding', 'payment-history', 'users', 'audit', 'feedback',
    ];
    const actions: ActionPermission[] = ['view', 'create', 'edit', 'delete', 'approve', 'post', 'void'];

    for (const tab of allTenantModules) {
      expect(canAccess('ADMIN', tab), `ADMIN should access ${tab}`).toBe(true);
      for (const action of actions) {
        expect(canPerformAction('ADMIN', tab, action), `ADMIN should ${action} on ${tab}`).toBe(true);
      }
    }

    // Platform-only cross-tenant tabs remain restricted to SYSTEM_ADMIN
    const systemOnlyTabs: ModuleTab[] = ['maintenance', 'backup-restore', 'tenant-mgmt', 'schema', 'payment-monitoring'];
    for (const tab of systemOnlyTabs) {
      expect(canAccess('ADMIN', tab)).toBe(false);
    }
  });

  it('keeps AP clerk entry separate from AP supervisor approval', () => {
    expect(canPerformAction('AP_CLERK', 'payables', 'create')).toBe(true);
    expect(canPerformAction('AP_CLERK', 'payables', 'approve')).toBe(false);
    expect(canPerformAction('AP_SUPERVISOR', 'payables', 'approve')).toBe(true);
    expect(canPerformAction('AP_SUPERVISOR', 'payables', 'void')).toBe(true);
  });

  it('keeps read-only financial roles from mutating payables', () => {
    expect(canAccess('AUDITOR', 'payables')).toBe(true);
    expect(canPerformAction('AUDITOR', 'payables', 'view')).toBe(true);
    expect(canPerformAction('AUDITOR', 'payables', 'edit')).toBe(false);
    expect(canPerformAction('AUDITOR', 'payables', 'approve')).toBe(false);
  });

  it('gives Registrar explicit enrollment and assessment access', () => {
    expect(canAccess('REGISTRAR', 'enrollments')).toBe(true);
    expect(canAccess('REGISTRAR', 'assessment-registrations')).toBe(true);
    expect(canPerformAction('REGISTRAR', 'assessment-registrations', 'edit')).toBe(true);
    expect(canPerformAction('REGISTRAR', 'assessment-registrations', 'delete')).toBe(false);
    expect(getDefaultTab('REGISTRAR')).toBe('students');
  });

  it('does not grant Registrar access to AP or AR financial documents', () => {
    expect(canAccess('REGISTRAR', 'payables')).toBe(false);
    expect(canAccess('REGISTRAR', 'invoices')).toBe(false);
    expect(canPerformAction('REGISTRAR', 'payments', 'create')).toBe(false);
  });
});
