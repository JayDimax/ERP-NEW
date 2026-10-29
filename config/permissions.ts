/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * This file defines which modules/tabs each role can access.
 * When you create a user in Supabase, assign them a role from the UserRole type.
 * The system will automatically show/hide modules based on their role.
 * 
 * Usage in App.tsx:
 *   import { canAccess, getAccessibleTabs } from './config/permissions';
 *   
 *   // Check if user can access a specific tab
 *   {canAccess(currentUser?.role, 'payables') && <NavItem ... />}
 *   
 *   // Get all tabs user can access
 *   const userTabs = getAccessibleTabs(currentUser?.role);
 */

// ===== Role Definitions =====
export type UserRole =
  | 'SYSTEM_ADMIN'      // Platform administrator - full system access
  | 'ADMIN'             // Organization admin - full org access
  | 'PRESIDENT'         // Executive - dashboard, reports, approvals
  | 'FINANCE_MANAGER'   // Finance head - all finance modules
  | 'ACCOUNTANT'        // General accountant - GL, reports, journal entries
  | 'AR_SPECIALIST'     // Accounts Receivable - invoices, collections
  | 'AP_SPECIALIST'     // Accounts Payable - bills, payments, vendors
  | 'AP_CLERK'          // AP data entry - limited AP access
  | 'AP_SUPERVISOR'     // AP approvals - AP with approval rights
  | 'TREASURY'          // Treasury - banking, cash management
  | 'AUDITOR'           // Read-only access to all financial data
  | 'REGISTRAR'         // Student/training management
  | 'TRAINER'           // Trainer portal only
  | 'STUDENT';          // Student portal only

// ===== Module/Tab Definitions =====
export type ModuleTab =
  // Portals
  | 'student-portal'
  | 'trainer-portal'
  | 'feedback'
  // Financial Core
  | 'dashboard'
  | 'ledger'
  | 'journal-vouchers'
  | 'ap-journal-vouchers'
  | 'vendor-ledger'
  | 'reports'
  | 'banking'
  | 'checks'
  // AR Modules
  | 'ar'
  | 'invoices'
  | 'non-invoice-payments'
  | 'payments'
  | 'bank-deposits'
  | 'customers'
  | 'ar-calendar-tasks'
  | 'credit-debit-memo'
  | 'write-off'
  | 'reclassify'
  | 'aging-report'
  | 'soa'
  | 'customer-ledger'
  | 'collection-receipt'
  | 'collection-report'
  | 'recurring-invoices'
  | 'revenue-recognition'
  // AP Modules
  | 'payables'
  | 'ap-memos'
  | 'ap-reclassifications'
  | 'ap-aging-report'
  | 'time-expenses'
  | 'po'
  | 'goods-receipt'
  | 'recurring-bills'
  // Payroll & Budgets
  | 'payroll'
  | 'budgets'
  // Registries
  | 'sponsors'
  | 'vendors'
  | 'items'
  | 'assets'
  // Inventory
  | 'inventory'
  | 'warehouse-locations'
  | 'stock-items'
  | 'inventory-classes'
  | 'opening-inventory'
  | 'stock-levels'
  | 'stock-adjustments'
  | 'reorder-points'
  | 'inventory-transactions'
  | 'inventory-reports'
  // Operations (Training)
  | 'students'
  | 'trainers'
  | 'qualifications'
  | 'batches'
  | 'transcripts'
  | 'locations'
  | 'schedules'
  // Admin
  | 'employees'
  | 'employee-directory'
  | 'coa'
  | 'periods'
  | 'branding'
  | 'subscription'
  | 'payment-history'
  | 'users'
  | 'audit'
  | 'enrollments'
  | 'assessment-registrations'
  | 'course-fees'
  // System Admin
  | 'maintenance'
  | 'backup-restore'
  | 'tenant-mgmt'
  | 'schema'
  | 'payment-monitoring'
  | 'alumni-reports';

// ===== Permission Matrix =====
// Maps each role to the tabs they can access
const ROLE_PERMISSIONS: Record<UserRole, ModuleTab[]> = {
  // SYSTEM_ADMIN: Full platform access
  SYSTEM_ADMIN: [
    'dashboard', 'ledger', 'journal-vouchers', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking', 'checks',
    'ar', 'invoices', 'non-invoice-payments', 'payments', 'customers', 'bank-deposits', 'ar-calendar-tasks',
    'credit-debit-memo', 'write-off', 'reclassify', 'aging-report', 'soa', 'customer-ledger', 'collection-receipt', 'collection-report',
    'recurring-invoices', 'revenue-recognition',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
    'payroll', 'budgets',
    'sponsors', 'vendors', 'items', 'assets',
    'inventory', 'warehouse-locations', 'stock-items', 'inventory-classes', 'opening-inventory', 'stock-levels', 'stock-adjustments', 'reorder-points', 'inventory-transactions', 'inventory-reports',
    'students', 'trainers', 'qualifications', 'batches', 'transcripts', 'locations', 'schedules',
    'enrollments', 'assessment-registrations', 'course-fees', 'alumni-reports',
    'employees', 'employee-directory', 'coa', 'periods', 'branding', 'subscription', 'payment-history', 'users', 'audit',
    'maintenance', 'backup-restore', 'tenant-mgmt', 'schema', 'payment-monitoring', 'feedback'
  ],

  // ADMIN: Full organization access (no system admin modules)
  ADMIN: [
    'dashboard', 'ledger', 'journal-vouchers', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking', 'checks',
    'ar', 'invoices', 'non-invoice-payments', 'payments', 'customers', 'bank-deposits', 'ar-calendar-tasks',
    'credit-debit-memo', 'write-off', 'reclassify', 'aging-report', 'soa', 'customer-ledger', 'collection-receipt', 'collection-report',
    'recurring-invoices', 'revenue-recognition',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
    'payroll', 'budgets',
    'sponsors', 'vendors', 'items', 'assets',
    'inventory', 'warehouse-locations', 'stock-items', 'inventory-classes', 'opening-inventory', 'stock-levels', 'stock-adjustments', 'reorder-points', 'inventory-transactions', 'inventory-reports',
    'students', 'trainers', 'qualifications', 'batches', 'transcripts', 'locations', 'schedules', 'alumni-reports',
    'enrollments', 'assessment-registrations', 'course-fees',
    'employees', 'employee-directory', 'coa', 'periods', 'branding', 'subscription', 'payment-history', 'users', 'audit', 'feedback'
  ],

  // PRESIDENT: Executive view - dashboards, reports, approvals
  PRESIDENT: [
    'dashboard', 'ledger', 'reports', 'banking',
    'ar', 'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses',
    'payroll', 'budgets',
    'students', 'trainers', 'qualifications', 'batches',
    'employees', 'feedback'
  ],

  // FINANCE_MANAGER: All finance modules
  FINANCE_MANAGER: [
    'dashboard', 'ledger', 'journal-vouchers', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking', 'checks',
    'invoices', 'non-invoice-payments', 'payments', 'customers', 'bank-deposits', 'recurring-invoices', 'revenue-recognition',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
    'payroll', 'budgets',
    'sponsors', 'vendors', 'items', 'assets',
    'inventory', 'warehouse-locations', 'stock-items', 'stock-levels', 'stock-adjustments', 'reorder-points', 'inventory-transactions',
    'employees', 'coa', 'periods', 'feedback'
  ],

  // ACCOUNTANT: General Ledger, Reporting, Journal Entries
  ACCOUNTANT: [
    'dashboard', 'ledger', 'journal-vouchers', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking',
    'invoices', 'non-invoice-payments', 'payments', 'customers', 'bank-deposits', 'recurring-invoices', 'revenue-recognition',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
    'budgets',
    'sponsors', 'vendors', 'items', 'assets',
    'coa', 'periods', 'feedback'
  ],

  // AR_SPECIALIST: Accounts Receivable focused
  AR_SPECIALIST: [
    'dashboard',
    'ledger',
    'journal-vouchers',
    'ar-calendar-tasks',
    'students',
    'customers',
    'invoices',
    'non-invoice-payments',
    'payments',
    'credit-debit-memo',
    'write-off',
    'reclassify',
    'aging-report',
    'soa',
    'customer-ledger',
    'collection-receipt',
    'collection-report',
    'inventory',
    'warehouse-locations',
    'stock-items',
    'inventory-classes',
    'opening-inventory',
    'stock-levels',
    'stock-adjustments',
    'reorder-points',
    'inventory-transactions',
    'feedback'
  ],

  // AP_SPECIALIST: Accounts Payable focused
  AP_SPECIALIST: [
    'dashboard', 'ledger', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking', 'checks',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
    'vendors', 'items',
    'inventory', 'stock-items', 'stock-levels',
    'feedback'
  ],

  // AP_CLERK: Limited AP data entry
  AP_CLERK: [
    'ledger', 'ap-journal-vouchers', 'reports', 'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt',
    'vendors', 'items', 'feedback'
  ],

  // AP_SUPERVISOR: AP with approvals
  AP_SUPERVISOR: [
    'dashboard', 'ledger', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking', 'checks',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills',
    'vendors', 'items',
    'inventory', 'stock-items', 'stock-levels',
    'feedback'
  ],

  // TREASURY: Banking and cash management
  TREASURY: [
    'dashboard', 'reports', 'banking', 'checks',
    'ar', // View receivables for cash forecasting
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', // View payables for cash forecasting
    'feedback'
  ],

  // AUDITOR: Read-only access to all financial data
  AUDITOR: [
    'dashboard', 'ledger', 'ap-journal-vouchers', 'vendor-ledger', 'reports', 'banking',
    'ar', 'recurring-invoices', 'revenue-recognition',
    'payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt',
    'payroll',
    'sponsors', 'vendors', 'items', 'assets',
    'inventory', 'warehouse-locations', 'stock-items', 'stock-levels', 'stock-adjustments', 'inventory-transactions',
    'coa', 'periods', 'feedback'
  ],

  // REGISTRAR: Training/Student management
  REGISTRAR: [
    'dashboard',
    'students', 'trainers', 'qualifications', 'batches', 'transcripts', 'locations', 'schedules', 'alumni-reports',
    'enrollments', 'assessment-registrations',
    'sponsors', // For scholarship management
    'feedback'
  ],

  // TRAINER: Trainer portal only
  TRAINER: [
    'trainer-portal', 'feedback'
  ],

  // STUDENT: Student portal only
  STUDENT: [
    'student-portal', 'feedback'
  ]
};

// ===== Module Groups for Sidebar Sections =====
export const MODULE_GROUPS = {
  FINANCIAL_CORE: ['dashboard', 'ledger', 'reports', 'banking', 'checks'] as ModuleTab[],
  AR_MODULES: ['ar', 'invoices', 'non-invoice-payments', 'payments', 'bank-deposits', 'customers', 'ar-calendar-tasks', 'credit-debit-memo', 'write-off', 'reclassify', 'aging-report', 'soa', 'customer-ledger', 'collection-receipt', 'collection-report', 'recurring-invoices', 'revenue-recognition', 'enrollments', 'course-fees'] as ModuleTab[],
  AP_MODULES: ['payables', 'ap-memos', 'ap-reclassifications', 'ap-aging-report', 'time-expenses', 'po', 'goods-receipt', 'recurring-bills'] as ModuleTab[],
  PAYROLL_BUDGET: ['payroll', 'budgets'] as ModuleTab[],
  REGISTRIES: ['sponsors', 'vendors', 'items', 'assets'] as ModuleTab[],
  INVENTORY: ['inventory', 'warehouse-locations', 'stock-items', 'inventory-classes', 'opening-inventory', 'stock-levels', 'stock-adjustments', 'reorder-points', 'inventory-transactions'] as ModuleTab[],
  OPERATIONS: ['students', 'trainers', 'qualifications', 'batches', 'locations', 'schedules', 'alumni-reports', 'enrollments', 'assessment-registrations'] as ModuleTab[],
  ADMIN: ['employees', 'employee-directory', 'coa', 'periods', 'branding', 'subscription', 'payment-history', 'users', 'audit', 'feedback'] as ModuleTab[],
  SYSTEM_ADMIN: ['maintenance', 'backup-restore', 'tenant-mgmt', 'schema', 'payment-monitoring', 'feedback'] as ModuleTab[],
  PORTALS: ['student-portal', 'trainer-portal', 'feedback'] as ModuleTab[],
};

// ===== Helper Functions =====

/**
 * Check if a role can access a specific tab/module
 */
export function canAccess(role: UserRole | string | undefined, tab: ModuleTab): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.includes(tab);
}

/**
 * Get all tabs a role can access
 */
export function getAccessibleTabs(role: UserRole | string | undefined): ModuleTab[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as UserRole] || [];
}

/**
 * Check if a role can access ANY tab in a group (for showing/hiding sidebar sections)
 */
export function canAccessGroup(role: UserRole | string | undefined, group: ModuleTab[]): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return group.some(tab => permissions.includes(tab));
}

/**
 * Check if role has admin-level access
 */
export function isAdminRole(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  return ['SYSTEM_ADMIN', 'ADMIN', 'PRESIDENT'].includes(role);
}

/**
 * Check if role is system admin
 */
export function isSystemAdmin(role: UserRole | string | undefined): boolean {
  return role === 'SYSTEM_ADMIN';
}

/**
 * Check if role is tenant admin (ADMIN or PRESIDENT)
 */
export function isTenantAdmin(role: UserRole | string | undefined): boolean {
  return role === 'ADMIN' || role === 'PRESIDENT';
}

/**
 * Check if role has finance access
 */
export function hasFinanceAccess(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  return ['SYSTEM_ADMIN', 'ADMIN', 'PRESIDENT', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AR_SPECIALIST', 'AP_SPECIALIST', 'AP_SUPERVISOR', 'TREASURY', 'AUDITOR'].includes(role);
}

/**
 * Check if role has AR access
 */
export function hasARAccess(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  return canAccessGroup(role, MODULE_GROUPS.AR_MODULES);
}

/**
 * Check if role has AP access
 */
export function hasAPAccess(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  return canAccessGroup(role, MODULE_GROUPS.AP_MODULES);
}

/**
 * Check if role has operations/registrar access
 */
export function hasOperationsAccess(role: UserRole | string | undefined): boolean {
  if (!role) return false;
  return canAccessGroup(role, MODULE_GROUPS.OPERATIONS);
}

/**
 * Get the default landing tab for a role
 */
export function getDefaultTab(role: UserRole | string | undefined): ModuleTab {
  if (!role) return 'dashboard';

  switch (role) {
    case 'STUDENT':
      return 'student-portal';
    case 'TRAINER':
      return 'trainer-portal';
    case 'SYSTEM_ADMIN':
      return 'tenant-mgmt';
    case 'AR_SPECIALIST':
      return 'dashboard';
    case 'AP_SPECIALIST':
    case 'AP_CLERK':
    case 'AP_SUPERVISOR':
      return 'payables';
    case 'REGISTRAR':
      return 'students';
    case 'TREASURY':
      return 'banking';
    default:
      return 'dashboard';
  }
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole | string | undefined): string {
  if (!role) return 'Unknown';

  const names: Record<string, string> = {
    SYSTEM_ADMIN: 'System Administrator',
    ADMIN: 'Organization Admin',
    PRESIDENT: 'President/Executive',
    FINANCE_MANAGER: 'Finance Manager',
    ACCOUNTANT: 'Accountant',
    AR_SPECIALIST: 'AR Specialist',
    AP_SPECIALIST: 'AP Specialist',
    AP_CLERK: 'AP Clerk',
    AP_SUPERVISOR: 'AP Supervisor',
    TREASURY: 'Treasury',
    AUDITOR: 'Auditor',
    REGISTRAR: 'Registrar',
    TRAINER: 'Trainer',
    STUDENT: 'Student'
  };

  return names[role] || role.replace(/_/g, ' ');
}

// ===== Action Permissions (for future use with edit/delete/approve actions) =====
export type ActionPermission = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'post' | 'void';

const ROLE_ACTIONS: Partial<Record<UserRole, Partial<Record<ModuleTab, ActionPermission[]>>>> = {
  AR_SPECIALIST: {
    'students': ['view', 'create'],
    'invoices': ['view', 'create', 'edit', 'post', 'void'],
    'non-invoice-payments': ['view', 'create', 'edit', 'post', 'void'],
    'payments': ['view', 'create', 'edit', 'post', 'void'],
  },
  PRESIDENT: {
    'ap-reclassifications': ['view'],
  },
  TREASURY: {
    'ap-reclassifications': ['view'],
  },
  // AUDITOR can only view
  AUDITOR: {
    'dashboard': ['view'],
    'ledger': ['view'],
    'reports': ['view'],
    'ar': ['view'],
    'payables': ['view'],
    'ap-memos': ['view'],
    'ap-reclassifications': ['view'],
    'audit': ['view'],
    // ... etc
  },
  // AP_CLERK can view and create, but not approve
  AP_CLERK: {
    'ledger': ['view'],
    'ap-journal-vouchers': ['view'],
    'reports': ['view'],
    'payables': ['view', 'create', 'edit'],
    'ap-memos': ['view', 'create', 'edit'],
    'ap-reclassifications': ['view', 'create', 'edit'],
    'po': ['view', 'create', 'edit'],
    'goods-receipt': ['view', 'create', 'edit'],
    'vendors': ['view'],
    'items': ['view'],
  },
  AP_SPECIALIST: {
    'ledger': ['view'],
    'ap-journal-vouchers': ['view'],
    'reports': ['view'],
    'payables': ['view', 'create', 'edit'],
  },
  AP_SUPERVISOR: {
    'ledger': ['view'],
    'ap-journal-vouchers': ['view'],
    'reports': ['view'],
    'payables': ['view', 'create', 'edit', 'delete', 'approve', 'post', 'void'],
  },
  REGISTRAR: {
    'students': ['view', 'create', 'edit'],
    'trainers': ['view', 'create', 'edit'],
    'qualifications': ['view'],
    'batches': ['view', 'create', 'edit'],
    'enrollments': ['view', 'create', 'edit'],
    'assessment-registrations': ['view', 'create', 'edit'],
    'transcripts': ['view', 'create', 'edit'],
    'sponsors': ['view'],
  }
};

/**
 * Check if role can perform action on module
 */
export function canPerformAction(
  role: UserRole | string | undefined,
  tab: ModuleTab,
  action: ActionPermission
): boolean {
  if (!role) return false;

  // System admin and admin can do everything
  if (role === 'SYSTEM_ADMIN' || role === 'ADMIN') return true;

  const roleActions = ROLE_ACTIONS[role as UserRole];
  if (!roleActions) {
    // If no specific restrictions, allow all actions if they have access to the tab
    return canAccess(role, tab);
  }

  const tabActions = roleActions[tab];
  if (!tabActions) {
    // No specific tab restrictions
    return canAccess(role, tab);
  }

  return tabActions.includes(action);
}
