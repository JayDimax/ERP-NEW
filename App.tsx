import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Organization, User, Student, Qualification, Trainer, Batch, Sponsor, NonStockItem, Vendor, FixedAsset, BankAccount, Location, TrainerSchedule, Employee, PayrollRun, PayrollLine, JournalEntry, JournalLine, AuditLog, Budget, BudgetLine, AccountClass, TransactionSummary, ChartOfAccount, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, PaymentHistory, Payable, AccountingPeriod, CheckVoucher, EFTBatch, GoodsReceipt, GoodsReceiptLine, BankReconciliation, WarehouseLocation, StockItem, InventoryLevel, InventoryTransaction, StockAdjustment, ReorderPoint, RecurringBill, RecurringBillHistory, RevenueSchedule, RevenueRecognitionEntry, ItemGroup, CourseFee, Enrollment, AssessmentRegistration, Invoice, InvoiceLine, Payment, PaymentApplication, BankDeposit, StudentLedger, RecurringInvoice, RecurringInvoiceHistory, AlumniEmploymentReport, TaxCategoryEntry, FeedbackTicket
} from './types';
import { AccountingService } from './accountingService';
import { DataServiceFactory } from './services/DataServiceFactory';
import { authService } from './services/AuthService';
import { AuditService } from './services/AuditService';
import { BillingComputationService } from './services/BillingComputationService';
import { config } from './config/app';
import { generateUUID } from './utils/uuid';
import { canAccess, canAccessGroup, MODULE_GROUPS, isSystemAdmin as checkSysAdmin, isTenantAdmin as checkTenantAdmin, getDefaultTab, hasFinanceAccess, hasARAccess, hasAPAccess, hasOperationsAccess } from './config/permissions';
import { useNotifications } from './components/NotificationContext';

// View Imports
import Dashboard from './views/Dashboard';
import Ledger from './views/Ledger';
import Reports from './views/Reports';
import ChartOfAccounts from './views/ChartOfAccounts';
import LoginView from './views/LoginView';
import WelcomeView from './views/WelcomeView';
import PasswordResetView from './views/PasswordResetView';
import StudentsView from './views/StudentsView';
import QualificationsView from './views/QualificationsView';
import TrainersView from './views/TrainersView';
import BatchesView from './views/BatchesView';
import LocationsView from './views/LocationsView';
import SponsorsView from './views/SponsorsView';
import SOAView from './views/SOAView';
import ARAgingReportView from './views/ARAgingReportView';
import ARWriteOffView from './views/ARWriteOffView';
import ARCreditDebitMemoView from './views/ARCreditDebitMemoView';
import ARCollectionReceiptView from './views/ARCollectionReceiptView';
import ARCollectionReportView from './views/ARCollectionReportView';
import ARCustomerLedgerView from './views/ARCustomerLedgerView';
import ReclassificationView from './views/ReclassificationView';
import ItemsView from './views/ItemsView';
import BankingView from './views/BankingView';
import AssetsView from './views/AssetsView';
import ARView from './views/ARView';
import PayablesView from './views/PayablesView';
import VendorsView from './views/VendorsView';
import SchedulesView from './views/SchedulesView';
import PurchaseOrdersView from './views/PurchaseOrdersView';
import AuditTrail from './views/AuditTrail';
import UsersManagementView from './views/UsersManagementView';
import SchemaManualView from './views/SchemaManualView';
import TenantManagementView from './views/TenantManagementView';
import BrandingView from './views/BrandingView';
import SubscriptionView from './views/SubscriptionView';
import StudentPortalView from './views/StudentPortalView';
import TrainerPortalView from './views/TrainerPortalView';
import BudgetView from './views/BudgetView';
import EmployeesView from './views/EmployeesView';
import PayrollView from './views/PayrollView';
import PaymentHistoryView from './views/PaymentHistoryView';
import PaymentMonitoringView from './views/PaymentMonitoringView';
import JournalForm from './components/JournalForm';
import MaintenanceView from './views/MaintenanceView';
import PeriodClosingView from './views/PeriodClosingView';
import CheckPrintingView from './views/CheckPrintingView';
import GoodsReceiptView from './views/GoodsReceiptView';
import APView from './views/APView';
import WarehouseLocationsView from './views/WarehouseLocationsView';
import StockItemsView from './views/StockItemsView';
import InventoryView from './views/InventoryView';
import StockAdjustmentsView from './views/StockAdjustmentsView';
import ReorderView from './views/ReorderView';
import InventoryTransactionsView from './views/InventoryTransactionsView';
import AdvancedInventoryReports from './views/AdvancedInventoryReports';
import BackupRestoreView from './views/BackupRestoreView';
// import RecurringInvoicesView from './views/RecurringInvoicesView';
import RevenueRecognitionView from './views/RevenueRecognitionView';
import CourseFeesView from './views/CourseFeesView';
import EnrollmentsView from './views/EnrollmentsView';
import AssessmentRegistrationsView from './views/AssessmentRegistrationsView';
import InvoicesView from './views/InvoicesView';
import PaymentsView from './views/PaymentsView';
import BankDepositsView from './views/BankDepositsView';
import AlumniEmploymentView from './views/AlumniEmploymentView';
import CustomerMasterListView from './views/CustomerMasterListView';
import ARCalendarTasksView from './views/ARCalendarTasksView';
import FeedbackManagementView from './views/FeedbackManagementView';
import UserProfileView from './views/UserProfileView';

// Lucide Icons
import {
  LayoutDashboard, BookText, PieChart, Landmark, Users,
  Award, GraduationCap, Layers, MapPin, Handshake,
  Truck, Box, CalendarClock, ShoppingCart, ShieldCheck,
  History, UserCog, Settings, Palette, CreditCard,
  Binary, Terminal, Receipt, Calculator, Briefcase,
  LogOut, Menu, X, PlusCircle, Building2, Wrench,
  FileText, Tag, Wallet, Activity, Loader2, Database,
  Cloud, BarChart2, CalendarCheck, Printer, Zap, Package,
  CheckCircle2, AlertCircle, HardDrive, RefreshCw, TrendingUp,
  ArrowDownToLine, UserCheck, ListTodo, MessageSquare, ClipboardCheck, UserCircle
} from 'lucide-react';

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  const normalized = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [79, 70, 229];
  }

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const factor = Math.max(0, Math.min(1, 1 - amount));
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
}

function rgbString(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

const ASSESSMENT_RESULT_OR_LOCKED_STATUSES = new Set<AssessmentRegistration['status']>([
  'COMPLETED',
  'COMPETENT',
  'NOT_YET_COMPETENT',
  'CANCELLED'
]);

function isAssessmentDateDue(assessmentDate?: string | null): boolean {
  if (!assessmentDate) return false;
  return assessmentDate.slice(0, 10) <= new Date().toISOString().slice(0, 10);
}

function withAutoCompletedAssessmentRegistration<T extends AssessmentRegistration>(registration: T): T {
  if (
    isAssessmentDateDue(registration.assessmentDate) &&
    !ASSESSMENT_RESULT_OR_LOCKED_STATUSES.has(registration.status)
  ) {
    return { ...registration, status: 'COMPLETED', updatedAt: registration.updatedAt || new Date().toISOString() };
  }
  return registration;
}

function normalizeOrganization(organization: Organization): Organization {
  return {
    ...organization,
    institutionType: organization.institutionType || 'TRAINING'
  };
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  // Navigation section state
  const [openSections, setOpenSections] = useState<{ financial: boolean; operations: boolean; registries: boolean; inventory: boolean; administration: boolean }>({ financial: true, operations: true, registries: true, inventory: true, administration: true });

  // Password Reset State
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [authScreen, setAuthScreen] = useState<'welcome' | 'login'>('welcome');
  const [navigationContext, setNavigationContext] = useState<any>(null);

  // Data service reference for CRUD operations
  const [dataService] = useState(() => DataServiceFactory.getService());


  const [magicLinkMessage, setMagicLinkMessage] = useState<string>('');

  // Check for password reset, email verification token or magic link callback in URL on mount
  useEffect(() => {
    const processUrlTokens = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const resetToken = urlParams.get('reset_token');
      if (resetToken) {
        setResetToken(resetToken);
        setShowPasswordReset(true);
        console.info('[App] Password reset token detected in URL');
        return;
      }

      const verifyToken = urlParams.get('verify_email_token');
      if (verifyToken) {
        await handleVerifyEmailToken(verifyToken);
      }

      const accessToken = urlParams.get('access_token') || urlParams.get('token');
      const refreshToken = urlParams.get('refresh_token');
      if (accessToken) {
        if (!config.supabase.url || !config.supabase.anonKey) {
          setMagicLinkMessage('Supabase callback detected, but Supabase credentials are missing.');
          return;
        }

        try {
          // Fetch Supabase auth user from magic link token
          const userRes = await fetch(`${config.supabase.url}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          if (!userRes.ok) {
            const errorText = await userRes.text();
            console.error('[App] Magic link user fetch failed:', userRes.status, errorText);
            setMagicLinkMessage('Magic link token invalid or expired. Please request a new one.');
            return;
          }

          const authUser = await userRes.json();
          const email = authUser?.email;
          if (!email) {
            setMagicLinkMessage('Magic link returned no email. Try using app login instead.');
            return;
          }

          // Lookup app user record by email
          const appUserColumns = 'id,name,email,last_name,profile_photo,contact_number,address,role,org_id,student_id,trainer_id,is_active';
          const appUserRes = await fetch(`${config.supabase.url}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=${appUserColumns}`, {
            headers: {
              apikey: config.supabase.anonKey,
              Authorization: `Bearer ${config.supabase.anonKey}`,
              Prefer: 'return=representation'
            }
          });

          if (!appUserRes.ok) {
            const errorText = await appUserRes.text();
            console.error('[App] App user query failed:', appUserRes.status, errorText);
            setMagicLinkMessage('Logged in with magic link, but application user record could not be loaded.');
            return;
          }

          const appUsers = await appUserRes.json();
          if (!Array.isArray(appUsers) || appUsers.length === 0) {
            setMagicLinkMessage(`No application user exists for ${email}. Please register first.`);
            return;
          }

          const su = appUsers[0];
          const user: User = {
            id: su.id,
            name: su.name || email.split('@')[0],
            email: su.email,
            lastName: su.last_name || undefined,
            profilePhoto: su.profile_photo || undefined,
            contactNumber: su.contact_number || undefined,
            address: su.address || undefined,
            role: su.role || 'ADMIN',
            orgId: su.org_id || '',
            studentId: su.student_id || undefined,
            trainerId: su.trainer_id || undefined,
            isEmailVerified: su.is_email_verified ?? true,
          };

          // Login using application-level handler
          handleLogin(user);
          setMagicLinkMessage('Magic link login successful. Redirecting...');

          // Clear query params to avoid repeated processing
          window.history.replaceState({}, '', window.location.pathname);
        } catch (error) {
          console.error('[App] Magic link processing error:', error);
          setMagicLinkMessage('Magic link processing failed. Please try again.');
        }
      }
    };

    processUrlTokens();
  }, []);

  useEffect(() => {
  document.documentElement.setAttribute("data-theme", selectedTheme);
}, [selectedTheme]);
  // Email verification handler
  const handleVerifyEmailToken = async (token: string) => {
    const { emailVerificationService } = await import('./services/EmailVerificationService');
    const entry = emailVerificationService.validateToken(token);
    if (entry) {
      emailVerificationService.markTokenUsed(token);
      // Mark user as verified in users state and persist
      setUsers(prev => prev.map(u => u.id === entry.userId ? { ...u, isEmailVerified: true } : u));
      await dataService.updateUser(entry.userId, { isEmailVerified: true });
      handleNotify('success', 'Email verified successfully! You may now log in.');
    } else {
      handleNotify('error', 'Invalid or expired verification link.');
    }
  };

  // Recurring invoice handlers removed

  // Revenue Schedule (Deferred Revenue) CRUD Handlers
  const handleAddRevenueSchedule = async (schedule: any) => {
    try {
      console.info('[App] Creating revenue schedule:', schedule.description);
      const scheduleWithOrg = { ...schedule, orgId: currentOrgId };
      const created = await dataService.createRevenueSchedule(scheduleWithOrg);
      setRevenueSchedules(prev => [...prev, created]);
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'REVENUE_SCHEDULE', created.id, `Revenue schedule: ${created.description} `);
      handleNotify('success', 'Revenue schedule created successfully');
    } catch (error) {
      console.error('[App] Error creating revenue schedule:', error);
      handleNotify('error', `Failed to create revenue schedule: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleUpdateRevenueSchedule = async (id: string, updates: any) => {
    try {
      console.info('[App] Updating revenue schedule:', id);
      const existing = revenueSchedules.find(e => e.id === id);
      const updated = await dataService.updateRevenueSchedule(id, updates);
      setRevenueSchedules(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'REVENUE_SCHEDULE', id, existing?.description, existing, { ...existing, ...updates });
      handleNotify('success', 'Revenue schedule updated successfully');
    } catch (error) {
      console.error('[App] Error updating revenue schedule:', error);
      handleNotify('error', `Failed to update revenue schedule: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleDeleteRevenueSchedule = async (id: string) => {
    try {
      console.info('[App] Deleting revenue schedule:', id);
      const existing = revenueSchedules.find(e => e.id === id);
      await dataService.deleteRevenueSchedule(id);
      setRevenueSchedules(prev => prev.filter(e => e.id !== id));
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'REVENUE_SCHEDULE', id, existing?.description);
      handleNotify('success', 'Revenue schedule deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting revenue schedule:', error);
      handleNotify('error', `Failed to delete revenue schedule: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  // Revenue Recognition Entry Handlers
  const handleAddRevenueRecognitionEntry = async (entry: any) => {
    try {
      console.info('[App] Creating revenue recognition entry');
      const entryWithOrg = { ...entry, orgId: currentOrgId };
      const created = await dataService.createRevenueRecognitionEntry(entryWithOrg);
      setRevenueRecognitionEntries(prev => [...prev, created]);
    } catch (error) {
      console.error('[App] Error creating revenue recognition entry:', error);
      handleNotify('error', `Failed to create recognition entry: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleUpdateRevenueRecognitionEntry = async (id: string, updates: any) => {
    try {
      console.info('[App] Updating revenue recognition entry:', id);
      const updated = await dataService.updateRevenueRecognitionEntry(id, updates);
      setRevenueRecognitionEntries(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
    } catch (error) {
      console.error('[App] Error updating revenue recognition entry:', error);
    }
  };

  // ============================================================================
  // PAYROLL PERSISTENCE HANDLERS
  // ============================================================================

  const handlePostPayroll = async (run: PayrollRun, lines: PayrollLine[], entry: JournalEntry, entryLines: JournalLine[]) => {
    try {
      console.info('[App] Posting payroll run:', run.id);

      // 1. Persist payroll run to Supabase
      const savedRun = await dataService.createPayrollRun(run);
      console.info('[App] Saved payroll run:', savedRun.id);

      // 2. Persist all payroll lines
      const savedLines: PayrollLine[] = [];
      for (const line of lines) {
        const savedLine = await dataService.createPayrollLine({ ...line, runId: savedRun.id });
        savedLines.push(savedLine);
      }
      console.info('[App] Saved', savedLines.length, 'payroll lines');

      // 3. Update local state
      setPayrollRuns(prev => [...prev, savedRun as PayrollRun]);
      setPayrollLines(prev => [...prev, ...savedLines as PayrollLine[]]);

      // 4. Post journal entry for GL integration
      handlePostJournal(entry, entryLines);

      handleNotify('success', `Payroll run ${run.id} posted successfully with ${savedLines.length} employee lines`);
    } catch (error) {
      console.error('[App] Error posting payroll:', error);
      handleNotify('error', `Failed to post payroll: ${error instanceof Error ? error.message : 'Unknown error'} `);

      // Fallback: At least update local state even if Supabase fails
      setPayrollRuns(prev => [...prev, run as PayrollRun]);
      setPayrollLines(prev => [...prev, ...lines as PayrollLine[]]);
      handlePostJournal(entry, entryLines);
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const session = authService.getSession();
    if (session) {
      setCurrentUser(session.user);
      setCurrentOrgId(session.user.orgId);
      console.info('[App] Restored user session:', session.user.email);
    }
  }, []);

  // Logout handler
  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    // Audit: Logout event (log before clearing user)
    if (currentUser) {
      AuditService.logout(currentOrgId, currentUser.id, currentUser.name);
    }

    await authService.logout();
    setCurrentUser(null);
    setCurrentOrgId('');
    setAuthScreen('welcome');
    console.info('[App] User logged out - JWT tokens revoked');
  };

  // If current user belongs to a suspended org, force logout and notify
  useEffect(() => {
    if (!currentUser || currentUser.role === 'SYSTEM_ADMIN') return;
    const org = organizations.find(o => o.id === currentUser.orgId && !o.isDeleted);
    if (!org) return;
    if (org.subscriptionStatus === 'SUSPENDED') {
      setSuspensionBanner('Your tenant organization has been suspended. Access restricted until reactivation.');
      setCurrentUser(null);
      setCurrentOrgId('');
      setAuthScreen('welcome');
      localStorage.removeItem('at_erp_session');
      handleNotify('error', 'Your tenant organization has been suspended. You have been logged out.');
      console.warn('[App] Logged out suspended organization user:', currentUser.email, currentUser.orgId);
    } else {
      setSuspensionBanner(null);
    }
  }, [currentUser, organizations, handleLogout]);

  // Master Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [items, setItems] = useState<NonStockItem[]>([]);
  const [courseFees, setCourseFees] = useState<CourseFee[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [assessmentRegistrations, setAssessmentRegistrations] = useState<AssessmentRegistration[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [studentLedger, setStudentLedger] = useState<StudentLedger[]>([]); // Subsidiary ledger for students
  const [bankDeposits, setBankDeposits] = useState<BankDeposit[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorTaxSettings, setVendorTaxSettings] = useState<any[]>([]);
  const [atcCategories, setAtcCategories] = useState<any[]>([]);
  const [atcItems, setAtcItems] = useState<any[]>([]);
  const [atcRates, setAtcRates] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<any[]>([]);
  const [accountingPeriods, setAccountingPeriods] = useState<any[]>([]);
  const [taxCategories, setTaxCategories] = useState<TaxCategoryEntry[]>([]);

  function getPaymentTotalCredit(payment?: Pick<Payment, 'amountReceived' | 'ewtAmountCertified'> | null): number {
    return Number(payment?.amountReceived ?? 0) + Number(payment?.ewtAmountCertified ?? 0);
  }

  function getPaymentAvailableBalance(
    payment?: Pick<Payment, 'amountReceived' | 'ewtAmountCertified' | 'totalApplied' | 'customerDepositBalance'> | null
  ): number {
    const explicitBalance = Number(payment?.customerDepositBalance ?? NaN);
    if (Number.isFinite(explicitBalance)) {
      return Math.max(explicitBalance, 0);
    }

    return Math.max(getPaymentTotalCredit(payment) - Number(payment?.totalApplied ?? 0), 0);
  }

  function isFinalizedPaymentStatus(status?: Payment['status'] | null): boolean {
    return status === 'OPEN' || status === 'POSTED' || status === 'CLOSED';
  }

  function resolveAppliedPaymentStatus(
    payment: Pick<Payment, 'status' | 'amountReceived' | 'ewtAmountCertified'>,
    totalApplied: number,
    customerDepositBalance: number
  ): Payment['status'] {
    if (!isFinalizedPaymentStatus(payment.status)) {
      return payment.status;
    }

    const normalizedBalance = Math.max(Number(customerDepositBalance ?? 0), 0);
    const totalCredit = getPaymentTotalCredit(payment);
    const fullyApplied =
      normalizedBalance <= 0.01 &&
      Math.abs(totalCredit - Number(totalApplied ?? 0)) <= 0.01;

    return fullyApplied ? 'CLOSED' : 'OPEN';
  }

  function getPersistablePaymentStatus(status?: Payment['status'] | null): Payment['status'] {
    // Some deployed databases only allow DRAFT/POSTED/VOIDED on payments, so OPEN/CLOSED
    // stay as derived UI states and finalized records persist as POSTED.
    if (status === 'OPEN' || status === 'CLOSED') {
      return 'POSTED';
    }

    return status || 'DRAFT';
  }

  function resolvePaidInvoiceStatus(
    invoice: Pick<Invoice, 'status'>,
    balanceDue: number
  ): Invoice['status'] {
    if (invoice.status === 'VOIDED') {
      return invoice.status;
    }

    return Math.max(Number(balanceDue ?? 0), 0) <= 0.01 ? 'CLOSED' : 'OPEN';
  }
  const [locations, setLocations] = useState<Location[]>([]);
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankReconciliations, setBankReconciliations] = useState<any[]>([]);
  const [recurringJournalEntries, setRecurringJournalEntries] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderLines, setPurchaseOrderLines] = useState<PurchaseOrderLine[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [recurringBillHistory, setRecurringBillHistory] = useState<RecurringBillHistory[]>([]);

  // Recurring Invoices (AR)
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [recurringInvoiceHistory, setRecurringInvoiceHistory] = useState<RecurringInvoiceHistory[]>([]);

  // Revenue Recognition & Deferred Revenue
  const [revenueSchedules, setRevenueSchedules] = useState<RevenueSchedule[]>([]);
  const [revenueRecognitionEntries, setRevenueRecognitionEntries] = useState<RevenueRecognitionEntry[]>([]);
  const [alumniReports, setAlumniReports] = useState<AlumniEmploymentReport[]>([]);
  const [feedbackTickets, setFeedbackTickets] = useState<FeedbackTicket[]>([]);

  // Inventory Management State
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [inventoryLevels, setInventoryLevels] = useState<InventoryLevel[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>([]);
  const [reorderPoints, setReorderPoints] = useState<ReorderPoint[]>([]);

  // Advanced AP Features State
  const [checkVouchers, setCheckVouchers] = useState<CheckVoucher[]>([]);
  const [eftBatches, setEftBatches] = useState<EFTBatch[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [goodsReceiptLines, setGoodsReceiptLines] = useState<GoodsReceiptLine[]>([]);

  // Financial Cycle State
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Initialize AuditService callback to add logs to state
  useEffect(() => {
    AuditService.setCallback((log: AuditLog) => {
      setAuditLogs(prev => [...prev, log]);
    });
  }, []);

  // Modals
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [journalFormEntry, setJournalFormEntry] = useState<JournalEntry | null>(null);
  const [journalFormLines, setJournalFormLines] = useState<JournalLine[]>([]);
  const [journalFormMode, setJournalFormMode] = useState<'new' | 'edit' | 'view'>('new');

  // Toast Notification State
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'error' | 'info'; message: string }>>([]);
  const [suspensionBanner, setSuspensionBanner] = useState<string | null>(null);
  const applyingPaymentKeysRef = useRef<Set<string>>(new Set());
  const glRefSequenceRef = useRef<Record<string, number>>({});
  const invoiceGlSequenceRef = useRef<Record<string, number>>({});
  const paymentApplicationSequenceRef = useRef<Record<string, number>>({});

  const extractGlSequence = (value?: string): number => {
    const ref = (value || '').trim();
    if (!ref) return 0;
    const match = ref.match(/^GL(?:\s*No\.?)?[\s-]*(\d+)$/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  const getGlSequenceKey = (orgId: string) => orgId || '__global__';
  const getPaymentApplicationSequenceKey = (orgId: string, year: number) => `${orgId || '__global__'}:${year}`;

  const extractPaymentApplicationSequence = (value?: string, year?: number): number => {
    const ref = String(value || '').trim();
    if (!ref) return 0;
    const match = ref.match(/^PAYAPP-(\d{4})-(\d+)$/i);
    if (!match) return 0;
    if (year && parseInt(match[1], 10) !== year) return 0;
    return parseInt(match[2], 10);
  };

  const formatPaymentApplicationNo = (year: number, sequence: number): string =>
    `PAYAPP-${year}-${String(sequence).padStart(5, '0')}`;

  const getHighestGlSequenceForOrg = (entries: JournalEntry[], orgId: string): number => {
    return entries.reduce((max, entry) => {
      if (entry.orgId !== orgId) return max;
      return Math.max(max, extractGlSequence(entry.glEntryNumber || entry.reference));
    }, 0);
  };

  const syncGlSequenceForOrg = (orgId: string, entries: JournalEntry[]) => {
    const key = getGlSequenceKey(orgId);
    const seq = getHighestGlSequenceForOrg(entries, orgId);
    glRefSequenceRef.current[key] = Math.max(glRefSequenceRef.current[key] || 0, seq);
  };

  const syncPaymentApplicationSequenceForOrg = (orgId: string, paymentList: Payment[]) => {
    const nextSequences = { ...paymentApplicationSequenceRef.current };
    paymentList.forEach(payment => {
      if (payment.orgId !== orgId) return;
      (payment.applications || []).forEach(application => {
        const year = application.createdAt
          ? new Date(application.createdAt).getFullYear()
          : new Date().getFullYear();
        const sequence = extractPaymentApplicationSequence(application.applicationNo, year);
        if (sequence <= 0) return;
        const key = getPaymentApplicationSequenceKey(orgId, year);
        nextSequences[key] = Math.max(nextSequences[key] || 0, sequence);
      });
    });
    paymentApplicationSequenceRef.current = nextSequences;
  };

  const generateNextPaymentApplicationNo = (orgId: string, createdAt?: string): string => {
    const applicationDate = createdAt ? new Date(createdAt) : new Date();
    const year = Number.isNaN(applicationDate.getTime())
      ? new Date().getFullYear()
      : applicationDate.getFullYear();
    const key = getPaymentApplicationSequenceKey(orgId, year);
    const nextSequence = (paymentApplicationSequenceRef.current[key] || 0) + 1;
    paymentApplicationSequenceRef.current[key] = nextSequence;
    return formatPaymentApplicationNo(year, nextSequence);
  };

  useEffect(() => {
    if (!currentOrgId) return;
    syncGlSequenceForOrg(currentOrgId, journalEntries);
    syncInvoiceGlSequenceForOrg(currentOrgId, journalEntries);
  }, [journalEntries, currentOrgId]);

  useEffect(() => {
    if (!currentOrgId) return;
    syncPaymentApplicationSequenceForOrg(currentOrgId, payments);
  }, [payments, currentOrgId]);

  const getHighestInvoiceGlSequenceForOrg = (entries: JournalEntry[], orgId: string): number => {
    return entries.reduce((max, entry) => {
      if (entry.orgId !== orgId) return max;
      if (String(entry.sourceType || '').toUpperCase() !== 'INVOICE') return max;
      return Math.max(max, extractGlSequence(entry.glEntryNumber || entry.reference));
    }, 0);
  };

  const syncInvoiceGlSequenceForOrg = (orgId: string, entries: JournalEntry[]) => {
    const key = getGlSequenceKey(orgId);
    const seq = getHighestInvoiceGlSequenceForOrg(entries, orgId);
    invoiceGlSequenceRef.current[key] = Math.max(invoiceGlSequenceRef.current[key] || 0, seq);
  };
  // Data Loading Logic
  useEffect(() => {
    async function loadData() {
      try {
        console.log("📊 App: Starting data load...");
        console.log("🔧 Config:", { useMockData: config.useMockData, supabaseConfigured: !!(config.supabase?.url && config.supabase?.anonKey) });

        const service = DataServiceFactory.getService();
        console.log(`📦 Using service: ${config.useMockData ? 'MOCK' : 'SUPABASE'} `);

        const data = await service.getInitialData();
        console.log("✅ Data loaded:", {
          organizations: data.organizations.length,
          users: data.users.length,
          students: data.students.length,
          accounts: data.accounts.length
        });

        setOrganizations(data.organizations.map(normalizeOrganization));
        setUsers(data.users);
        setStudents(data.students);
        setQualifications(data.qualifications);
        setTrainers(data.trainers);
        setBatches(data.batches);
        setSponsors(data.sponsors);
        setItems(data.items);
        setVendors(data.vendors);
        setLocations(data.locations);
        setSchedules(data.schedules);
        setEmployees(data.employees);
        setBankAccounts(data.bankAccounts);
        setBankReconciliations(data.bankReconciliations);
        setRecurringJournalEntries(data.recurringJournalEntries || []);
        setAccounts(data.accounts);
        // backfill glEntryNumber for any rows that came from the server
        // before the column existed.  If reference already contains a GL
        // formatted string we'll use that so the generator can see it later.
        let normalizedEntries = (data.journalEntries || []).map((e: any) => {
          if (!e.glEntryNumber) {
            const ref = (e.reference || '').trim();
            if (/^GL[\s-]*(\d+)$/i.test(ref)) {
              // previously backfilled pattern entries
              return { ...e, glEntryNumber: ref };
            }
            // if there's some other reference value (e.g. GUID) treat as missing
            // so we will allocate a proper sequential number below
          }
          const next = { ...e } as any;
          // Normalize legacy DB statuses/types to UI expectations
          if (next.status === 'DRAFT') next.status = 'ON_HOLD';
          if (next.sourceType === 'MANUAL' && /^JV/i.test(String(next.reference || '').trim())) {
            next.sourceType = 'JOURNAL';
          }
          return next;
        });

        // Seed the per-org GL sequence from loaded data before backfilling.
        syncGlSequenceForOrg(currentOrgId, normalizedEntries);
        syncInvoiceGlSequenceForOrg(currentOrgId, normalizedEntries);

        // Assign sequential numbers to any entries that still lack a valid
        // GL reference (either column missing or reference not matching pattern).
        const missing = normalizedEntries.filter(e => {
          const status = String(e.status || '').toUpperCase();
          const isDraftLike = status === 'DRAFT' || status === 'ON_HOLD' || status === 'REVISION_REQUESTED' || status === 'PENDING';
          return !e.glEntryNumber && !isDraftLike;
        });
        if (missing.length > 0) {
          const updates: Promise<any>[] = [];
          missing.forEach(e => {
            const newGl = generateNextGlRef();
            const isCreditDebitMemoEntry =
              String(e.sourceType || '').toUpperCase() === 'CREDIT_MEMO' ||
              /^(CM|DM|CDM|DBM)-/i.test(String(e.reference || '').trim()) ||
              String(e.description || '').toUpperCase().includes('CREDIT MEMO') ||
              String(e.description || '').toUpperCase().includes('DEBIT MEMO');
            updates.push(
              dataService.updateJournalEntry(e.id, isCreditDebitMemoEntry ? { glEntryNumber: newGl } : { glEntryNumber: newGl, reference: newGl })
                .then(updated => {
                  e.glEntryNumber = updated.glEntryNumber;
                  e.reference = isCreditDebitMemoEntry ? e.reference : updated.reference;
                })
                .catch(err => console.warn('[App] failed to backfill GL for entry', e.id, err))
            );
            // also update local copy immediately so UI shows something
            e.glEntryNumber = newGl;
            if (!isCreditDebitMemoEntry) e.reference = newGl;
          });
          Promise.all(updates)
            .then(() => console.info('[App] backfilled missing GL numbers'))
            .catch(err => console.warn('[App] failed to backfill missing GL numbers:', err));
        }

        setJournalEntries(normalizedEntries);
        const sourceAccounts = (data.accounts || []) as ChartOfAccount[];
        const sourceSponsors = (data.sponsors || []) as Sponsor[];
        const normalizedJournalLines: any[] = (data.journalLines || []).map((line: any) => ({ ...line }));

        // Backfill invoice records with their posted journal entry links so the
        // invoice screen, journal entry table, and GL reference all stay in sync.
        const invoiceBackfills = new Map<string, Partial<Invoice>>();
        const journalDescriptionBackfills = new Map<string, string>();
        const journalLineBackfills = new Map<string, Partial<JournalLine>>();
        const postedInvoiceEntries = normalizedEntries.filter((e: any) => {
          const status = String(e.status || '').toUpperCase();
          const sourceType = String(e.sourceType || '').toUpperCase();
          return status === 'POSTED' && sourceType === 'INVOICE';
        });
        const resolveEntryGlRef = (entry?: any) => (entry ? (entry.glEntryNumber || entry.reference || '').trim() : '');
        const queueInvoiceBackfill = (invoiceId: string, updates: Partial<Invoice>) => {
          const current = invoiceBackfills.get(invoiceId) || {};
          invoiceBackfills.set(invoiceId, { ...current, ...updates });
        };
        const queueJournalDescriptionBackfill = (journalEntryId: string, description: string) => {
          const nextDescription = String(description || '').trim();
          if (!journalEntryId || !nextDescription) return;
          journalDescriptionBackfills.set(journalEntryId, nextDescription);
        };
        const queueJournalLineBackfill = (journalLineId: string, updates: Partial<JournalLine>) => {
          if (!journalLineId) return;
          const current = journalLineBackfills.get(journalLineId) || {};
          journalLineBackfills.set(journalLineId, { ...current, ...updates });
        };
        const syncInvoiceArLineMemo = (journalEntryId: string, inv: any, description: string) => {
          if (!journalEntryId || !description) return;

          const preferredAccountId = sourceSponsors.find(s => s.id === inv.sponsorId)?.arAccountId;
          const entryLines = normalizedJournalLines.filter((line: any) => line.journalEntryId === journalEntryId);
          if (!entryLines.length) return;

          const arLine = resolveInvoiceArJournalLine(
            entryLines as JournalLine[],
            {
              sponsorId: inv.sponsorId,
              studentId: inv.studentId
            },
            sourceAccounts,
            preferredAccountId
          );

          if (!arLine) return;
          const currentMemo = String(arLine.memo || arLine.description || '').trim();
          if (currentMemo === description) return;

          arLine.memo = description;
          arLine.description = description;
          queueJournalLineBackfill(arLine.id, { memo: description, description });
        };
        const findMatchingInvoiceEntry = (inv: any) => {
          const sourceMatch = postedInvoiceEntries.find((e: any) => e.sourceRef === inv.id);
          if (sourceMatch) return sourceMatch;

          const invoiceGl = (inv.glEntryNumber || '').trim();
          if (invoiceGl) {
            const glMatch = postedInvoiceEntries.find((e: any) => resolveEntryGlRef(e) === invoiceGl);
            if (glMatch) return glMatch;
          }

          const invoiceNo = (inv.invoiceNo || '').trim().toLowerCase();
          if (invoiceNo) {
            const descriptionMatch = postedInvoiceEntries.find((e: any) => {
              const haystack = [
                e.description,
                e.reference,
                e.glEntryNumber,
                e.sourceRef
              ].filter(Boolean).join(' ').toLowerCase();
              return haystack.includes(invoiceNo);
            });
            if (descriptionMatch) return descriptionMatch;
          }

          return null;
        };

        let normalizedInvoices: any[] = (data.invoices || []).map((inv: any) => {
          const next = { ...inv };
          const status = String(inv.status || '').toUpperCase();
          const invoiceDescription = String(inv.notes || '').trim();

          if (inv.journalEntryId) {
            const je = normalizedEntries.find(e => e.id === inv.journalEntryId);
            const jeGl = resolveEntryGlRef(je);
            if (jeGl && inv.glEntryNumber !== jeGl) {
              queueInvoiceBackfill(inv.id, { glEntryNumber: jeGl });
              next.glEntryNumber = jeGl;
            }
            if (invoiceDescription && je && je.description?.trim() !== invoiceDescription) {
              queueJournalDescriptionBackfill(je.id, invoiceDescription);
              je.description = invoiceDescription;
            }
            syncInvoiceArLineMemo(je?.id || '', inv, invoiceDescription);
            if (je?.postedBy && !next.postedBy) {
              queueInvoiceBackfill(inv.id, { postedBy: je.postedBy });
              next.postedBy = je.postedBy;
            }
            if (je?.postedAt && !next.postedAt) {
              queueInvoiceBackfill(inv.id, { postedAt: je.postedAt });
              next.postedAt = je.postedAt;
            }
          } else if (status === 'OPEN') {
            const matchingEntry = findMatchingInvoiceEntry(inv);
            if (matchingEntry) {
              const matchedGl = resolveEntryGlRef(matchingEntry);
              const backfillUpdates: Partial<Invoice> = {
                journalEntryId: matchingEntry.id
              };

              next.journalEntryId = matchingEntry.id;
              if (invoiceDescription && matchingEntry.description?.trim() !== invoiceDescription) {
                queueJournalDescriptionBackfill(matchingEntry.id, invoiceDescription);
                matchingEntry.description = invoiceDescription;
              }
              syncInvoiceArLineMemo(matchingEntry.id, inv, invoiceDescription);

              if (matchedGl && inv.glEntryNumber !== matchedGl) {
                backfillUpdates.glEntryNumber = matchedGl;
                next.glEntryNumber = matchedGl;
              }
              if (matchingEntry.postedBy && !next.postedBy) {
                backfillUpdates.postedBy = matchingEntry.postedBy;
                next.postedBy = matchingEntry.postedBy;
              }
              if (matchingEntry.postedAt && !next.postedAt) {
                backfillUpdates.postedAt = matchingEntry.postedAt;
                next.postedAt = matchingEntry.postedAt;
              }

              queueInvoiceBackfill(inv.id, backfillUpdates);
            }
          }

          return next;
        });

        if (journalLineBackfills.size > 0) {
          Promise.allSettled(
            Array.from(journalLineBackfills.entries()).map(([id, updates]) => {
              return dataService.updateJournalLine(id, updates);
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some invoice journal line backfills failed', failures);
              } else {
                console.info('[App] backfilled invoice journal line descriptions');
              }
            })
            .catch(err => console.warn('[App] failed to backfill invoice journal line descriptions', err));
        }

        if (invoiceBackfills.size > 0) {
          Promise.allSettled(
            Array.from(invoiceBackfills.entries()).map(([id, updates]) => {
              return dataService.updateInvoice(id, updates);
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some invoice journal backfills failed', failures);
              } else {
                console.info('[App] backfilled invoice journal references');
              }
            })
            .catch(err => console.warn('[App] failed to backfill invoice journal references', err));
        }

        if (journalDescriptionBackfills.size > 0) {
          Promise.allSettled(
            Array.from(journalDescriptionBackfills.entries()).map(([id, description]) => {
              return dataService.updateJournalEntry(id, { description });
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some invoice journal description backfills failed', failures);
              } else {
                console.info('[App] backfilled invoice journal descriptions');
              }
            })
            .catch(err => console.warn('[App] failed to backfill invoice journal descriptions', err));
        }
        setJournalLines(normalizedJournalLines);
        setInvoices(normalizedInvoices);

        // Debug: Log journal data to help diagnose AR invoice issue
        console.info('[App] Loaded journal data:', {
          entriesCount: data.journalEntries?.length || 0,
          linesCount: normalizedJournalLines.length,
          sampleEntry: data.journalEntries?.[0],
          sampleLine: normalizedJournalLines?.[0],
          invoiceEntries: data.journalEntries?.filter((e: any) => e.sourceType === 'INVOICE')?.length || 0,
          invoiceLines: normalizedJournalLines?.filter((l: any) => {
            const entry = data.journalEntries?.find((e: any) => e.id === l.journalEntryId);
            return entry?.sourceType === 'INVOICE';
          })?.length || 0
        });

        setPayrollRuns(data.payrollRuns);
        setPayrollLines(data.payrollLines);
        setAuditLogs(data.auditLogs);
        setPurchaseOrders(data.purchaseOrders);
        const loadedPayments = (data.payments || []).filter(p => !p.isDeleted) as Payment[];
        const rawPaymentApplications = (data.paymentApplications || []) as PaymentApplication[];
        const paymentMap = new Map(loadedPayments.map(payment => [payment.id, payment]));
        const paymentApplicationNumberCounters = new Map<string, number>();
        const paymentApplicationNumberBackfills: Array<{ id: string; applicationNo: string }> = [];
        const paymentApplicationGlBackfills: Array<{ id: string; glReference: string }> = [];
        const paymentApplicationJournalBackfills = new Map<string, { reference: string; description: string }>();

        rawPaymentApplications.forEach(application => {
          const payment = paymentMap.get(application.paymentId);
          if (!payment?.orgId) return;
          const year = application.createdAt
            ? new Date(application.createdAt).getFullYear()
            : new Date().getFullYear();
          const sequence = extractPaymentApplicationSequence(application.applicationNo, year);
          if (sequence <= 0) return;
          const key = getPaymentApplicationSequenceKey(payment.orgId, year);
          paymentApplicationNumberCounters.set(key, Math.max(paymentApplicationNumberCounters.get(key) || 0, sequence));
        });

        const loadedPaymentApplications = rawPaymentApplications
          .slice()
          .sort((a, b) => {
            const createdAtDiff = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            if (createdAtDiff !== 0) return createdAtDiff;
            return String(a.id || '').localeCompare(String(b.id || ''));
          })
          .map(application => {
            const payment = paymentMap.get(application.paymentId);
            const orgId = payment?.orgId || currentOrgId;
            const year = application.createdAt
              ? new Date(application.createdAt).getFullYear()
              : new Date().getFullYear();
            const key = getPaymentApplicationSequenceKey(orgId, year);

            let applicationNo = String(application.applicationNo || '').trim();
            if (!applicationNo) {
              const nextSequence = (paymentApplicationNumberCounters.get(key) || 0) + 1;
              paymentApplicationNumberCounters.set(key, nextSequence);
              applicationNo = formatPaymentApplicationNo(year, nextSequence);
              paymentApplicationNumberBackfills.push({ id: application.id, applicationNo });
            }

            const applicationJournalDetail = applicationNo;
            const applicationDescription = application.description || applicationJournalDetail;
            const journalEntry = application.journalEntryId
              ? normalizedEntries.find(entry => entry.id === application.journalEntryId)
              : undefined;

            if (
              journalEntry &&
              String(journalEntry.sourceType || '').toUpperCase() === 'APPLICATION' &&
              (
                String(journalEntry.reference || '').trim() !== applicationJournalDetail ||
                String(journalEntry.description || '').trim() !== applicationDescription
              )
            ) {
              journalEntry.reference = applicationJournalDetail;
              journalEntry.description = applicationDescription;
              paymentApplicationJournalBackfills.set(journalEntry.id, {
                reference: applicationJournalDetail,
                description: applicationDescription
              });
            }

            let glReference = application.glReference;
            if (!glReference && journalEntry) {
              const resolvedGlRef = String(journalEntry?.glEntryNumber || journalEntry?.reference || '').trim();
              if (resolvedGlRef) {
                glReference = resolvedGlRef;
                paymentApplicationGlBackfills.push({ id: application.id, glReference: resolvedGlRef });
              }
            }

            return {
              ...application,
              orgId,
              applicationNo,
              glReference
            } as PaymentApplication;
          });

        if (paymentApplicationNumberBackfills.length > 0) {
          Promise.allSettled(
            paymentApplicationNumberBackfills.map((applicationBackfill) =>
              dataService.updateEntity('payment_applications', applicationBackfill.id, {
                applicationNo: applicationBackfill.applicationNo,
                updatedAt: new Date().toISOString()
              })
            )
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment application number backfills failed', failures);
              } else {
                console.info('[App] backfilled payment application numbers');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment application numbers', err));
        }

        if (paymentApplicationGlBackfills.length > 0) {
          Promise.allSettled(
            paymentApplicationGlBackfills.map((applicationBackfill) =>
              dataService.updateEntity('payment_applications', applicationBackfill.id, {
                glReference: applicationBackfill.glReference,
                updatedAt: new Date().toISOString()
              })
            )
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment application GL reference backfills failed', failures);
              } else {
                console.info('[App] backfilled payment application GL references');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment application GL references', err));
        }

        if (paymentApplicationJournalBackfills.size > 0) {
          Promise.allSettled(
            Array.from(paymentApplicationJournalBackfills.entries()).map(([id, updates]) =>
              dataService.updateJournalEntry(id, updates)
            )
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment application journal reference/details backfills failed', failures);
              } else {
                console.info('[App] backfilled payment application journal reference/details');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment application journal reference/details', err));
        }
        // backfill payment records with glEntryNumber from their journal entries
        const paymentGlBackfills: Array<{ id: string; glEntryNumber: string }> = [];
        const paymentStatusBackfills: Array<{ id: string; status: Payment['status'] }> = [];
        const paymentAmountBackfills: Array<{ id: string; amountReceived: number; totalApplied: number; customerDepositBalance: number; status: Payment['status'] }> = [];
        const paymentJournalDescriptionBackfills = new Map<string, string>();
        const paymentLineBackfills = new Map<string, Partial<JournalLine>>();
        const paymentsWithApplications = loadedPayments.map(payment => {
          const apps = loadedPaymentApplications.filter(app => app.paymentId === payment.id);
          const activeApps = apps.filter(app => !app.isReversed);
          const appliedTotal = activeApps.reduce((sum, app) => sum + (app.amountApplied || 0), 0);
          const totalApplied = payment.totalApplied ?? appliedTotal;
          const sourceInvoiceId = String((payment as Payment & { sourceInvoiceId?: string }).sourceInvoiceId || '').trim();
          const appliedInvoiceIds = Array.from(new Set(activeApps.map(app => String(app.invoiceId || '').trim()).filter(Boolean)));
          const reconciledInvoiceId = sourceInvoiceId || (appliedInvoiceIds.length === 1 ? appliedInvoiceIds[0] : '');
          const sourceInvoice = reconciledInvoiceId ? normalizedInvoices.find(invoice => invoice.id === reconciledInvoiceId) : undefined;
          const allApplicationsBelongToSourceInvoice =
            !!reconciledInvoiceId &&
            activeApps.length > 0 &&
            activeApps.every(app => app.invoiceId === reconciledInvoiceId);
          const sourceInvoiceIsSettled =
            !!sourceInvoice &&
            (String(sourceInvoice.status || '').toUpperCase() === 'CLOSED' || Number(sourceInvoice.balanceDue ?? 0) <= 0.01);
          const originalAmountReceived = Number(payment.amountReceived || 0);
          const ewtAmount = Number(payment.ewtAmountCertified || 0);
          let resolvedAmountReceived = originalAmountReceived;
          let grossReceived = resolvedAmountReceived + ewtAmount;
          const paymentTransactionDescription = resolvePaymentTransactionDescription(payment);
          let resolvedBalance = payment.customerDepositBalance ?? Math.max(grossReceived - totalApplied, 0);

          // Invoice-linked payments are meant to represent actual receipts for that invoice.
          // If the invoice is now settled and this payment only applied to that invoice, trim
          // an overstated default receipt amount down to the amount actually applied.
          const shouldReconcileSourceInvoiceReceipt =
            allApplicationsBelongToSourceInvoice &&
            resolvedBalance > 0.01 &&
            grossReceived > totalApplied + 0.01 &&
            Math.abs(resolvedBalance - (grossReceived - totalApplied)) <= 0.01;

          if (shouldReconcileSourceInvoiceReceipt) {
            resolvedAmountReceived = Math.max(totalApplied - ewtAmount, 0);
            grossReceived = resolvedAmountReceived + ewtAmount;
            resolvedBalance = 0;
          }

          const resolvedPaymentForStatus = { ...payment, amountReceived: resolvedAmountReceived };
          const resolvedStatus = resolveAppliedPaymentStatus(
            resolvedPaymentForStatus,
            totalApplied,
            resolvedBalance
          );
          const persistableResolvedStatus = getPersistablePaymentStatus(resolvedStatus);

          let glEntryNumber = payment.glEntryNumber;
          if (!glEntryNumber && payment.journalEntryId) {
            const je = normalizedEntries.find(e => e.id === payment.journalEntryId);
            if (je && je.glEntryNumber) {
              glEntryNumber = je.glEntryNumber;
              paymentGlBackfills.push({ id: payment.id, glEntryNumber: je.glEntryNumber });
            }
          }

          if (resolvedStatus !== 'CLOSED' && persistableResolvedStatus !== payment.status) {
            paymentStatusBackfills.push({ id: payment.id, status: persistableResolvedStatus });
          }

          if (payment.journalEntryId) {
            const paymentJournalEntry = normalizedEntries.find(e => e.id === payment.journalEntryId);
            if (paymentJournalEntry && String(paymentJournalEntry.description || '').trim() !== paymentTransactionDescription) {
              paymentJournalEntry.description = paymentTransactionDescription;
              paymentJournalDescriptionBackfills.set(paymentJournalEntry.id, paymentTransactionDescription);
            }
            if (paymentJournalEntry && glEntryNumber && String(paymentJournalEntry.reference || '').trim() !== glEntryNumber) {
              paymentJournalEntry.reference = glEntryNumber;
            }
          }

          if (payment.journalEntryId) {
            const entryLines = normalizedJournalLines.filter((line: any) => line.journalEntryId === payment.journalEntryId);
            const amountReceived = originalAmountReceived;
            const originalTotalCredit = amountReceived + ewtAmount;
            const resolvedTotalCredit = resolvedAmountReceived + ewtAmount;
            const cashLine = entryLines.find((line: any) => Math.abs(Number(line.debit || 0) - amountReceived) < 0.001 && Number(line.credit || 0) === 0);
            const depositsLine = entryLines.find((line: any) => Math.abs(Number(line.credit || 0) - originalTotalCredit) < 0.001);
            const ewtLine = ewtAmount > 0
              ? entryLines.find((line: any) => Math.abs(Number(line.debit || 0) - ewtAmount) < 0.001 && Number(line.credit || 0) === 0)
              : null;

            const queuePaymentLineBackfill = (line: any, description: string) => {
              if (!line || !description) return;
              const currentMemo = String(line.memo || line.description || '').trim();
              if (currentMemo === description) return;
              line.memo = description;
              line.description = description;
              const current = paymentLineBackfills.get(line.id) || {};
              paymentLineBackfills.set(line.id, { ...current, memo: description, description });
            };

            queuePaymentLineBackfill(cashLine, paymentTransactionDescription);
            queuePaymentLineBackfill(depositsLine, paymentTransactionDescription);
            if (shouldReconcileSourceInvoiceReceipt) {
              if (cashLine && Math.abs(Number(cashLine.debit || 0) - resolvedAmountReceived) > 0.001) {
                cashLine.debit = resolvedAmountReceived;
                const current = paymentLineBackfills.get(cashLine.id) || {};
                paymentLineBackfills.set(cashLine.id, { ...current, debit: resolvedAmountReceived });
              }
              if (depositsLine && Math.abs(Number(depositsLine.credit || 0) - resolvedTotalCredit) > 0.001) {
                depositsLine.credit = resolvedTotalCredit;
                const current = paymentLineBackfills.get(depositsLine.id) || {};
                paymentLineBackfills.set(depositsLine.id, { ...current, credit: resolvedTotalCredit });
              }
            }
            if (ewtLine) {
              const ewtDescription = `Creditable Withholding Tax (CWT 2307) for ${payment.paymentNo}`;
              queuePaymentLineBackfill(ewtLine, ewtDescription);
            }
          }

          if (shouldReconcileSourceInvoiceReceipt) {
            paymentAmountBackfills.push({
              id: payment.id,
              amountReceived: resolvedAmountReceived,
              totalApplied,
              customerDepositBalance: resolvedBalance,
              status: persistableResolvedStatus
            });
          }

          return {
            ...payment,
            status: resolvedStatus,
            glEntryNumber,
            applications: apps,
            amountReceived: resolvedAmountReceived,
            totalApplied,
            customerDepositBalance: resolvedBalance
          } as Payment;
        });

        if (paymentGlBackfills.length > 0) {
          Promise.all(
            paymentGlBackfills.map((p: any) => {
              return dataService.updateEntity('payments', p.id, { glEntryNumber: p.glEntryNumber });
            })
          )
            .then(() => console.info('[App] backfilled missing payment GL references'))
            .catch(err => console.warn('[App] failed to backfill payment GL references', err));
        }
        if (paymentStatusBackfills.length > 0) {
          Promise.allSettled(
            paymentStatusBackfills.map((paymentBackfill) => {
              return dataService.updateEntity('payments', paymentBackfill.id, {
                status: paymentBackfill.status,
                updatedAt: new Date().toISOString()
              });
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment status backfills failed', failures);
              } else {
                console.info('[App] backfilled payment lifecycle statuses');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment lifecycle statuses', err));
        }
        if (paymentAmountBackfills.length > 0) {
          Promise.allSettled(
            paymentAmountBackfills.map((paymentBackfill) => {
              return dataService.updateEntity('payments', paymentBackfill.id, {
                amountReceived: paymentBackfill.amountReceived,
                totalApplied: paymentBackfill.totalApplied,
                customerDepositBalance: paymentBackfill.customerDepositBalance,
                status: paymentBackfill.status,
                updatedAt: new Date().toISOString()
              });
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some invoice-linked payment amount reconciliations failed', failures);
              } else {
                console.info('[App] reconciled overstated invoice-linked payment receipts');
              }
            })
            .catch(err => console.warn('[App] failed to reconcile invoice-linked payment receipts', err));
        }
        if (paymentLineBackfills.size > 0) {
          Promise.allSettled(
            Array.from(paymentLineBackfills.entries()).map(([id, updates]) => {
              return dataService.updateJournalLine(id, updates);
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment journal line backfills failed', failures);
              } else {
                console.info('[App] backfilled payment journal line descriptions');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment journal line descriptions', err));
        }
        if (paymentJournalDescriptionBackfills.size > 0) {
          Promise.allSettled(
            Array.from(paymentJournalDescriptionBackfills.entries()).map(([id, description]) => {
              return dataService.updateJournalEntry(id, { description });
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment journal description backfills failed', failures);
              } else {
                console.info('[App] backfilled payment journal descriptions');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment journal descriptions', err));
        }
        const paymentJournalReferenceBackfills = paymentsWithApplications
          .filter(payment => payment.journalEntryId && payment.glEntryNumber)
          .filter(payment => {
            const entry = normalizedEntries.find(e => e.id === payment.journalEntryId);
            return !!entry && String(entry.reference || '').trim() !== String(payment.glEntryNumber || '').trim();
          })
          .map(payment => ({
            id: payment.journalEntryId as string,
            reference: String(payment.glEntryNumber || '').trim()
          }));
        if (paymentJournalReferenceBackfills.length > 0) {
          Promise.allSettled(
            paymentJournalReferenceBackfills.map((item: any) => {
              return dataService.updateJournalEntry(item.id, { reference: item.reference });
            })
          )
            .then(results => {
              const failures = results.filter(result => result.status === 'rejected');
              if (failures.length > 0) {
                console.warn('[App] some payment journal reference backfills failed', failures);
              } else {
                console.info('[App] backfilled payment journal references');
              }
            })
            .catch(err => console.warn('[App] failed to backfill payment journal references', err));
        }
        setJournalEntries([...normalizedEntries]);
        setJournalLines(normalizedJournalLines);
        setPayments(paymentsWithApplications);
        setFixedAssets(data.fixedAssets);
        setPayables(data.payables || []);
        setVendorTaxSettings(data.vendorTaxSettings || []);
        setAtcCategories(data.atcCategories || []);
        setAtcItems(data.atcItems || []);
        setAtcRates(data.atcRates || []);

        // Load Inventory Data
        setWarehouseLocations(data.warehouseLocations || []);
        setStockItems(data.stockItems || []);
        setInventoryLevels(data.inventoryLevels || []);
        setInventoryTransactions(data.inventoryTransactions || []);
        setStockAdjustments(data.stockAdjustments || []);
        setReorderPoints(data.reorderPoints || []);
        setEnrollments(data.enrollments || []);
        const normalizedAssessmentRegistrations = (data.assessmentRegistrations || []).map(withAutoCompletedAssessmentRegistration);
        setAssessmentRegistrations(normalizedAssessmentRegistrations);
        normalizedAssessmentRegistrations
          .filter((registration, index) => registration.status !== (data.assessmentRegistrations || [])[index]?.status)
          .forEach(registration => {
            service.updateAssessmentRegistration(registration.id, {
              status: registration.status,
              updatedAt: registration.updatedAt || new Date().toISOString()
            }).catch(error => console.warn('[App] Failed to auto-complete assessment registration:', registration.id, error));
          });
        setAlumniReports(data.alumniReports || []);
        setFeedbackTickets(data.feedbackTickets || []);

        // Load Course Fees
        setCourseFees(data.courseFees || []);
        setTaxCategories(data.taxCategories || []);
        if (data.organizations.length > 0) {
          // Get the restored session to check user's orgId
          const restoredSession = authService.getSession();
          const restoredUser = restoredSession?.user;
          const userOrgId = restoredUser?.orgId;
          const userOrgExists = data.organizations.some(o => o.id === userOrgId && !o.isDeleted);
          const isSystemAdmin = restoredUser?.role === 'SYSTEM_ADMIN';

          console.log('[App] Organization selection:', { userOrgId, userOrgExists, isSystemAdmin, user: restoredUser?.email });

          // Validate: User must have an organization OR be a SYSTEM_ADMIN
          if (restoredUser && !userOrgExists && !isSystemAdmin) {
            console.error('[App] ❌ Validation failed: User has no valid organization and is not SYSTEM_ADMIN');
            authService.logout();
            setCurrentUser(null);
            setCurrentOrgId('');
            handleNotify('error', 'Access Denied: Your organization is no longer available. Please contact your system administrator.');
            setIsLoading(false);
            return;
          }

          if (userOrgId && userOrgExists) {
            // User belongs to this org - use it
            setCurrentOrgId(userOrgId);
            console.log('[App] ✅ Set organization from user record:', userOrgId);
          } else if (isSystemAdmin && data.organizations.length > 0) {
            // SYSTEM_ADMIN: use first available organization
            setCurrentOrgId(data.organizations[0].id);
            console.log('[App] SYSTEM_ADMIN: Set organization to first available:', data.organizations[0].id);
          } else if (data.organizations.length > 0 && !restoredUser) {
            // No user logged in: use first organization for initial context
            setCurrentOrgId(data.organizations[0].id);
            console.log('[App] No logged-in user: Set organization to first available:', data.organizations[0].id);
          }
        }
        console.log("✅ State updated, data load complete");
      } catch (error) {
        console.error("❌ Critical Data Load Error:", error);
      } finally {
        console.log("🏁 Setting isLoading to false");
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch Accounting Periods when organization changes
  useEffect(() => {
    if (!currentOrgId) {
      setAccountingPeriods([]);
      return;
    }

    async function loadPeriods() {
      try {
        console.log('[App] Fetching accounting periods for org:', currentOrgId);
        const service = DataServiceFactory.getService();
        const periods = await service.getAccountingPeriodsByOrg(currentOrgId);
        console.log('[App] Loaded periods:', periods.length);
        setAccountingPeriods(periods);
      } catch (error) {
        console.error('[App] Error loading periods:', error);
        setAccountingPeriods([]);
      }
    }

    loadPeriods();
  }, [currentOrgId]);

  useEffect(() => {
    if (!currentUser) {
      setFeedbackTickets([]);
      return;
    }

    if (currentUser.role !== 'SYSTEM_ADMIN' && !currentOrgId) {
      setFeedbackTickets([]);
      return;
    }

    async function loadFeedbackTickets() {
      try {
        const service = DataServiceFactory.getService();
        const tickets = await service.getFeedbackTickets({
          orgId: currentUser.role === 'SYSTEM_ADMIN' ? undefined : currentOrgId,
          isSystemAdmin: currentUser.role === 'SYSTEM_ADMIN',
          userId: currentUser.id
        });
        setFeedbackTickets(tickets);
      } catch (error) {
        console.error('[App] Error loading feedback tickets:', error);
        handleNotify('error', 'Failed to load feedback tickets from Supabase.');
        setFeedbackTickets([]);
      }
    }

    loadFeedbackTickets();
  }, [currentUser, currentOrgId]);

  // Derived Accounting Context
  const currentOrg = useMemo(() => organizations.find(o => o.id === currentOrgId), [organizations, currentOrgId]);
  const brandColor = currentOrg?.primaryColor || '#4f46e5';
  const brandColorHover = useMemo(() => darkenHex(brandColor, 0.12), [brandColor]);
  const brandColorLight = useMemo(() => hexToRgba(brandColor, 0.08), [brandColor]);
  const brandColorRgb = useMemo(() => rgbString(brandColor), [brandColor]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--acm-primary', brandColor);
    root.style.setProperty('--acm-primary-hover', brandColorHover);
    root.style.setProperty('--acm-primary-light', brandColorLight);
    root.style.setProperty('--acm-primary-rgb', brandColorRgb);
    root.style.setProperty('--acm-sidebar-active', brandColor);
    root.style.setProperty('--acm-sidebar-hover', brandColorLight);
  }, [brandColor, brandColorHover, brandColorLight, brandColorRgb]);

  const filteredAccounts = useMemo(() => accounts.filter(a => a.orgId === currentOrgId && !a.isDeleted), [accounts, currentOrgId]);
  const activeJournalEntries = useMemo(() => journalEntries.filter(e => e.orgId === currentOrgId && !e.isDeleted), [journalEntries, currentOrgId]);
  const activeEntryIds = useMemo(() => new Set(activeJournalEntries.map(e => e.id)), [activeJournalEntries]);
  const filteredLines = useMemo(() => journalLines.filter(l => activeEntryIds.has(l.journalEntryId)), [journalLines, activeEntryIds]);
  const postedJournalEntries = useMemo(
    () => activeJournalEntries.filter(e => e.status === 'POSTED'),
    [activeJournalEntries]
  );
  const postedEntryIds = useMemo(() => new Set(postedJournalEntries.map(e => e.id)), [postedJournalEntries]);
  const postedLines = useMemo(() => journalLines.filter(l => postedEntryIds.has(l.journalEntryId)), [journalLines, postedEntryIds]);
  const summaries = useMemo(() => AccountingService.getLedgerSummaries(filteredAccounts, postedLines), [filteredAccounts, postedLines]);

  // RBAC Controls - Using centralized permissions config
  const isSysAdmin = checkSysAdmin(currentUser?.role);
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PRESIDENT' || isSysAdmin;
  const isTenantAdmin = checkTenantAdmin(currentUser?.role);
  const isFinance = hasFinanceAccess(currentUser?.role);
  const isRegistrar = hasOperationsAccess(currentUser?.role);
  const isAR = hasARAccess(currentUser?.role);
  const isAP = hasAPAccess(currentUser?.role);
  const canViewAuditTrail = currentUser?.role === 'ADMIN' || currentUser?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    if (activeTab === 'subscription' && !isSysAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isSysAdmin]);

  useEffect(() => {
    if (activeTab === 'audit' && !canViewAuditTrail) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canViewAuditTrail]);

  // Helper to check if user can access specific tab
  const userCanAccess = (tab: string) => canAccess(currentUser?.role, tab as any);

  // ============================================================================
  // PAYMENT DUE NOTIFICATION FOR TENANT ADMIN (5 days before due)
  // ============================================================================
  const paymentsDueSoon = useMemo(() => {
    if (!isTenantAdmin) return [];

    const today = new Date();
    const fiveDaysFromNow = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);

    return payments.filter(p => {
      const dueDate = new Date(p.dueDate);
      return p.orgId === currentOrgId &&
        p.status === 'PENDING' &&
        dueDate >= today &&
        dueDate <= fiveDaysFromNow;
    });
  }, [payments, currentOrgId, isTenantAdmin]);

  // Persistent notification handler
  const { addNotification } = useNotifications();
  const handleNotify = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    addNotification(type, message);
  };

  const handleLogin = (user: User) => {
    const isSystemAdmin = user.role === 'SYSTEM_ADMIN';
    const org = organizations.find(o => o.id === user.orgId && !o.isDeleted);
    const userHasOrg = !!org;

    if (!userHasOrg && !isSystemAdmin) {
      handleNotify('error', 'Access Denied: User must belong to an organization to login. Contact your system administrator.');
      console.warn('[App] Login denied: User has no valid organization and is not SYSTEM_ADMIN', user.email);
      return;
    }

    if (!isSystemAdmin && org?.subscriptionStatus === 'SUSPENDED') {
      const message = 'Access Denied: Your organization is suspended. Please contact support.';
      handleNotify('error', message);
      setSuspensionBanner(message);
      console.warn('[App] Login denied: organization suspended', user.email, user.orgId);
      return;
    }

    setSuspensionBanner(null);
    setCurrentUser(user);
    setCurrentOrgId(user.orgId || ''); // Empty string for system admin if no org
    // Store session for persistence
    const session = { user, token: btoa(JSON.stringify({ userId: user.id, email: user.email, iat: Date.now() })) };
    localStorage.setItem('at_erp_session', JSON.stringify(session));
    console.info('[App] User session stored:', user.email);

    // Audit: User login
    AuditService.login(user.orgId || '', user.id, user.name);

    // Set default tab based on role
    setActiveTab(getDefaultTab(user.role));
  };

  // helper to produce the next sequential GL reference (legacy GL00000001 style)
  const generateNextGlRef = (): string => {
    const key = getGlSequenceKey(currentOrgId);
    const stateMax = getHighestGlSequenceForOrg(journalEntries, currentOrgId);
    const currentMax = glRefSequenceRef.current[key] || 0;
    const next = Math.max(currentMax, stateMax) + 1;
    glRefSequenceRef.current[key] = next;
    return `GL${String(next).padStart(8, '0')}`;
  };

  // AR invoices now share the same system-wide GL sequence as every other
  // posted transaction so GL references reflect true posting order.
  const generateNextInvoiceGlRef = (): string => {
    return generateNextGlRef();
  };

  const resolveJournalRef = (entry?: Pick<JournalEntry, 'glEntryNumber' | 'reference'> | null): string =>
    (entry ? (entry.glEntryNumber || entry.reference || '').trim() : '');

  const resolveInvoiceTransactionDescription = (invoice?: Pick<Invoice, 'invoiceNo' | 'notes'> | null): string => {
    const note = String(invoice?.notes || '').trim();
    if (note) return note;
    return invoice ? `Sales Invoice: ${invoice.invoiceNo}` : '';
  };

  const DEFAULT_RECEIVABLE_CLASSIFICATION_CODE = '00000-00000';

  const resolveInvoiceArJournalLine = (
    lines: Pick<JournalLine, 'id' | 'accountId' | 'debit' | 'memo' | 'description'>[],
    invoice: Pick<Invoice, 'sponsorId' | 'studentId'>,
    accountsList: ChartOfAccount[] = filteredAccounts,
    preferredAccountId?: string
  ): JournalLine | null => {
    const arAccount = resolveReceivableAccount(
      {
        sponsorId: invoice.sponsorId,
        studentId: invoice.studentId,
        preferredAccountId
      },
      accountsList
    );

    if (arAccount?.id) {
      const arLine = lines.find(line => line.accountId === arAccount.id);
      if (arLine) return arLine as JournalLine;
    }

    const debitLines = lines
      .filter(line => Number(line.debit || 0) > 0)
      .sort((a, b) => Number(b.debit || 0) - Number(a.debit || 0));
    return (debitLines[0] as JournalLine) || null;
  };

  const findPostedInvoiceJournalEntry = (invoice: Invoice): JournalEntry | null => {
    const invoiceGlRef = (invoice.glEntryNumber || '').trim();
    const invoiceSourceRef = (invoice.id || '').trim();

    return journalEntries.find(entry => {
      if (entry.orgId !== currentOrgId) return false;
      if (String(entry.status || '').toUpperCase() !== 'POSTED') return false;
      if (String(entry.sourceType || '').toUpperCase() !== 'INVOICE') return false;
      if (invoice.journalEntryId && entry.id === invoice.journalEntryId) return true;
      if (invoiceSourceRef && entry.sourceRef === invoiceSourceRef) return true;
      return !!invoiceGlRef && resolveJournalRef(entry) === invoiceGlRef;
    }) || null;
  };

  const ensureStudentLedgerEntryForInvoice = (invoice: Invoice, journalRef: string, postedAt?: string) => {
    if (invoice.sponsorId || !invoice.studentId) return;
    if (!journalRef.trim()) return;
    const ledgerEntry: StudentLedger = {
      id: `sl-${invoice.id}`,
      orgId: currentOrgId,
      studentId: invoice.studentId,
      invoiceId: invoice.id,
      date: invoice.invoiceDate,
      description: `Sales Invoice ${invoice.invoiceNo} - ${journalRef}`,
      debit: invoice.netAmountDue,
      credit: 0,
      balance: invoice.netAmountDue,
      createdAt: postedAt || new Date().toISOString(),
    } as StudentLedger;

    setStudentLedger(prev => {
      if (prev.some(entry => entry.invoiceId === invoice.id)) return prev;
      return [...prev, ledgerEntry];
    });
  };

  const resolvePostingPeriodId = (explicitPeriodId?: string, entryDate?: string): string => {
    const orgPeriods = accountingPeriods.filter(p => p.orgId === currentOrgId && !p.isDeleted);
    if (explicitPeriodId && orgPeriods.some(p => p.id === explicitPeriodId)) {
      return explicitPeriodId;
    }

    const targetDate = new Date(entryDate || new Date().toISOString().split('T')[0]);
    const dateMatched = orgPeriods.filter(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return targetDate >= start && targetDate <= end;
    });

    const openMatched = dateMatched.find(p => p.status === 'OPEN');
    if (openMatched) return openMatched.id;

    const softMatched = dateMatched.find(p => p.status === 'SOFT_CLOSE');
    if (softMatched) return softMatched.id;

    const anyOpen = orgPeriods.find(p => p.status === 'OPEN');
    if (anyOpen) return anyOpen.id;

    const anySoft = orgPeriods.find(p => p.status === 'SOFT_CLOSE');
    if (anySoft) return anySoft.id;

    return '';
  };

  const resolveInvoiceFallbackPeriodId = (entryDate?: string): string => {
    const orgPeriods = accountingPeriods.filter(p => p.orgId === currentOrgId && !p.isDeleted);
    if (orgPeriods.length === 0) return '';

    const targetDate = new Date(entryDate || new Date().toISOString().split('T')[0]);
    const dateMatched = orgPeriods.filter(p => {
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      return targetDate >= start && targetDate <= end;
    });

    const pickByPriority = (periods: typeof orgPeriods) =>
      periods.find(p => p.status === 'OPEN') ||
      periods.find(p => p.status === 'SOFT_CLOSE') ||
      periods.find(p => p.status === 'HARD_CLOSE') ||
      periods.find(p => p.status === 'LOCKED') ||
      null;

    const datePriority = pickByPriority(dateMatched);
    if (datePriority) return datePriority.id;

    const orgPriority = pickByPriority(orgPeriods);
    if (orgPriority) return orgPriority.id;

    const latestPeriod = [...orgPeriods].sort((a, b) => {
      const endA = new Date(a.endDate || a.startDate).getTime();
      const endB = new Date(b.endDate || b.startDate).getTime();
      return endB - endA;
    })[0];

    return latestPeriod?.id || '';
  };

  const DEFAULT_JOURNAL_CLASSIFICATION_CODE = '00000-00000';
  const isDefaultJournalClassificationAccount = (account?: ChartOfAccount | null): boolean =>
    !!account && !account.isHeader && account.class !== AccountClass.REVENUE && account.class !== AccountClass.EXPENSE;

  const resolveJournalLineClassificationCode = (
    line: Pick<JournalLine, 'accountId' | 'classificationCode'> & { qualificationId?: string },
    accountsList: ChartOfAccount[] = filteredAccounts
  ): string => {
    const account = accountsList.find(a => a.id === line.accountId);
    if (!account) return String(line.classificationCode || '').trim();

    if (isDefaultJournalClassificationAccount(account)) {
      return DEFAULT_JOURNAL_CLASSIFICATION_CODE;
    }

    if (account.class === AccountClass.REVENUE || account.class === AccountClass.EXPENSE) {
      const selectedQualificationId = String((line as any).qualificationId || account.qualificationId || '').trim();
      const selectedQualificationCode = selectedQualificationId
        ? (qualifications.find(q => q.id === selectedQualificationId)?.code || '')
        : '';
      if (selectedQualificationCode) return selectedQualificationCode;

      const existingCode = String(line.classificationCode || '').trim();
      if (existingCode && existingCode !== DEFAULT_JOURNAL_CLASSIFICATION_CODE) {
        return existingCode;
      }
      return '';
    }

    return String(line.classificationCode || '').trim();
  };

  const normalizeJournalLineForSave = (line: JournalLine): JournalLine & { qualificationId?: string; classificationCode?: string } => {
    const account = filteredAccounts.find(a => a.id === line.accountId);
    const classificationCode = resolveJournalLineClassificationCode(line, filteredAccounts);
    const qualificationId = isDefaultJournalClassificationAccount(account)
      ? ''
      : (classificationCode
          ? (qualifications.find(q => q.code === classificationCode)?.id || (line as any).qualificationId || account?.qualificationId || '')
          : (line as any).qualificationId || account?.qualificationId || '');

    return {
      ...line,
      classificationCode,
      qualificationId
    } as JournalLine & { qualificationId?: string; classificationCode?: string };
  };

  const roundCurrencyAmount = (value: number): number => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

  const validateJournalLinesBalanced = (linesToValidate: JournalLine[]): { valid: boolean; message?: string } => {
    if (!linesToValidate.length) {
      return { valid: false, message: 'Cannot post journal entry: at least one journal line is required.' };
    }

    const hasNegativeAmount = linesToValidate.some(line => Number(line.debit || 0) < 0 || Number(line.credit || 0) < 0);
    if (hasNegativeAmount) {
      return { valid: false, message: 'Cannot post journal entry: debit and credit amounts cannot be negative.' };
    }

    const debitTotal = roundCurrencyAmount(linesToValidate.reduce((sum, line) => sum + Number(line.debit || 0), 0));
    const creditTotal = roundCurrencyAmount(linesToValidate.reduce((sum, line) => sum + Number(line.credit || 0), 0));
    const difference = roundCurrencyAmount(Math.abs(debitTotal - creditTotal));

    if (debitTotal <= 0 || creditTotal <= 0) {
      return { valid: false, message: 'Cannot post journal entry: total debits and credits must both be greater than zero.' };
    }

    if (difference > 0.01) {
      return {
        valid: false,
        message: `Cannot post journal entry: debits (${debitTotal.toFixed(2)}) do not equal credits (${creditTotal.toFixed(2)}).`
      };
    }

    return { valid: true };
  };

  const handlePostJournal = async (entry: Partial<JournalEntry>, lines: JournalLine[]): Promise<JournalEntry | null> => {
    const sourceType = String(entry.sourceType || '').toUpperCase();
    let resolvedPeriodId = resolvePostingPeriodId(entry.periodId, entry.date);
    if (!resolvedPeriodId && sourceType === 'INVOICE') {
      resolvedPeriodId = resolveInvoiceFallbackPeriodId(entry.date);
    }
    if (!resolvedPeriodId) {
      handleNotify('error', 'Cannot post journal entry: no open accounting period found for this date.');
      return null;
    }

    const fullEntry = {
      ...entry,
      id: entry.id || `je-${Date.now()}`,
      orgId: currentOrgId,
      periodId: resolvedPeriodId,
      status: 'POSTED',
      createdBy: currentUser?.id || 'system',
      createdAt: new Date().toISOString()
    } as JournalEntry;

    const postingGlRef = (fullEntry.glEntryNumber || '').trim() || generateNextGlRef();
    fullEntry.glEntryNumber = postingGlRef;
    fullEntry.reference = fullEntry.reference || postingGlRef;

    try {
      console.info('[App] Posting journal entry:', fullEntry.id, fullEntry.sourceType);
      console.info('[App] Lines to save:', lines.length, 'Sample line:', lines[0]);
      const normalizedLines = lines.map(normalizeJournalLineForSave);
      const balanceValidation = validateJournalLinesBalanced(normalizedLines);
      if (!balanceValidation.valid) {
        handleNotify('error', balanceValidation.message || 'Cannot post journal entry: journal lines are not balanced.');
        return null;
      }

      const savedEntry = await dataService.createJournalEntry(fullEntry);
      const normalizedSavedEntry = {
        ...savedEntry,
        sourceType: (savedEntry.sourceType === 'MANUAL' && /^JV/i.test(String(savedEntry.reference || '').trim()))
          ? 'JOURNAL'
          : savedEntry.sourceType
      };

      // if the database did not yet have the gl_entry_number column the value
      // will be dropped on round‑trip; copy it back so the UI and subsequent
      // generators continue to work until the column is added.
      if (!normalizedSavedEntry.glEntryNumber && fullEntry.glEntryNumber) {
        normalizedSavedEntry.glEntryNumber = fullEntry.glEntryNumber;
      }

      // Update lines with the actual saved entry ID (UUID generated by Supabase)
      const linesWithActualId = normalizedLines.map(line => ({
        ...line,
        journalEntryId: normalizedSavedEntry.id,
        orgId: currentOrgId
      }));

      const savedLines = await dataService.createJournalLines(linesWithActualId);
      const sourceLineClassMap = new Map(
        normalizedLines.map(line => [line.id, String((line as any).classificationCode || '').trim()])
      );
      const savedLinesWithSourceClass = savedLines.map((savedLine, idx) => {
        const sourceLine = normalizedLines.find(line => line.id === savedLine.id) || normalizedLines[idx];
        const classificationCode = String(
          (sourceLine && sourceLineClassMap.get(sourceLine.id)) || (savedLine as any).classificationCode || ''
        ).trim();
        const qualificationId = classificationCode
          ? (qualifications.find(q => q.code === classificationCode)?.id || (savedLine as any).qualificationId || '')
          : (savedLine as any).qualificationId || '';
        return classificationCode
          ? ({ ...savedLine, classificationCode, qualificationId } as JournalLine & { classificationCode?: string; qualificationId?: string })
          : savedLine;
      });

      setJournalEntries(prev => [...prev, normalizedSavedEntry]);
      setJournalLines(prev => [...prev, ...savedLinesWithSourceClass]);

      // Audit: Journal entry posted
      AuditService.post(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'JOURNAL_ENTRY',
        normalizedSavedEntry.id,
        normalizedSavedEntry.id,
        `Posted ${normalizedSavedEntry.sourceType}: ${normalizedSavedEntry.description} (${savedLines.length} lines)`
      );

      return normalizedSavedEntry;
    } catch (error) {
      console.error('[App] Error posting journal entry:', error);
      // Notify user that GL posting failed
      const source = (entry.sourceType || '').toUpperCase();
      if (source === 'INVOICE') {
        handleNotify('error', 'Failed to post journal entry to GL; invoice remains unposted.');
      } else {
        handleNotify('error', 'Failed to post journal entry to GL.');
      }

      // Audit the failure for diagnostics
      AuditService.post(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'JOURNAL_ENTRY',
        fullEntry.id,
        fullEntry.id,
        `Failed to post ${fullEntry.sourceType}: ${fullEntry.description}`
      );

      // indicate to caller that posting did not succeed
      return null;
    }
  };

  const handleSaveJournalDraft = async (entry: Partial<JournalEntry>, lines: JournalLine[]): Promise<JournalEntry | null> => {
    const resolvedPeriodId = resolvePostingPeriodId(entry.periodId, entry.date);
    if (!resolvedPeriodId) {
      handleNotify('error', 'Cannot save journal entry draft: no open accounting period found for this date.');
      return null;
    }

    const fullEntry = {
      ...entry,
      id: entry.id || `je-${Date.now()}`,
      orgId: currentOrgId,
      periodId: resolvedPeriodId,
      status: 'ON_HOLD',
      createdBy: currentUser?.id || 'system',
      createdAt: new Date().toISOString()
    } as JournalEntry;

    try {
      console.info('[App] Saving journal entry draft:', fullEntry.id, fullEntry.sourceType);
      const normalizedLines = lines.map(normalizeJournalLineForSave);
      const savedEntry = await dataService.createJournalEntry(fullEntry);
      const normalizedSavedEntry = {
        ...savedEntry,
        status: savedEntry.status === 'DRAFT' ? 'ON_HOLD' : savedEntry.status,
        sourceType: (savedEntry.sourceType === 'MANUAL' && /^JV/i.test(String(savedEntry.reference || '').trim()))
          ? 'JOURNAL'
          : savedEntry.sourceType
      };

      if (!normalizedSavedEntry.reference && fullEntry.reference) {
        normalizedSavedEntry.reference = fullEntry.reference;
      }

      const linesWithActualId = normalizedLines.map(line => ({
        ...line,
        journalEntryId: normalizedSavedEntry.id,
        orgId: currentOrgId
      }));

      const savedLines = await dataService.createJournalLines(linesWithActualId);
      const sourceLineClassMap = new Map(
        normalizedLines.map(line => [line.id, String((line as any).classificationCode || '').trim()])
      );
      const savedLinesWithSourceClass = savedLines.map((savedLine, idx) => {
        const sourceLine = normalizedLines.find(line => line.id === savedLine.id) || normalizedLines[idx];
        const classificationCode = String(
          (sourceLine && sourceLineClassMap.get(sourceLine.id)) || (savedLine as any).classificationCode || ''
        ).trim();
        const qualificationId = classificationCode
          ? (qualifications.find(q => q.code === classificationCode)?.id || (savedLine as any).qualificationId || '')
          : (savedLine as any).qualificationId || '';
        return classificationCode
          ? ({ ...savedLine, classificationCode, qualificationId } as JournalLine & { classificationCode?: string; qualificationId?: string })
          : savedLine;
      });

      setJournalEntries(prev => [...prev, normalizedSavedEntry]);
      setJournalLines(prev => [...prev, ...savedLinesWithSourceClass]);

      AuditService.create(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'JOURNAL_ENTRY',
        normalizedSavedEntry.id,
        `Draft ${normalizedSavedEntry.sourceType}: ${normalizedSavedEntry.description}`
      );

      handleNotify('success', 'Journal entry saved as draft (ON HOLD).');
      return normalizedSavedEntry;
    } catch (error) {
      console.error('[App] Error saving journal draft:', error);
      handleNotify('error', 'Failed to save journal entry draft.');
      return null;
    }
  };

  const handleUpdateJournalDraft = async (entryId: string, entry: Partial<JournalEntry>, lines: JournalLine[]): Promise<JournalEntry | null> => {
    const existingEntry = journalEntries.find(e => e.id === entryId);
    if (!existingEntry) {
      handleNotify('error', 'Journal entry draft not found.');
      return null;
    }

    const normalizedStatus = String(existingEntry.status || '').toUpperCase();
    if (normalizedStatus === 'POSTED' || normalizedStatus === 'REVERSED') {
      handleNotify('error', 'Posted or reversed journal entries cannot be updated.');
      return null;
    }

    const resolvedPeriodId = resolvePostingPeriodId(entry.periodId || existingEntry.periodId, entry.date || existingEntry.date);
    if (!resolvedPeriodId) {
      handleNotify('error', 'Cannot update journal entry draft: no open accounting period found for this date.');
      return null;
    }

    try {
      const { lines: _existingEntryLines, ...existingEntryWithoutLines } = existingEntry as JournalEntry & { lines?: unknown };
      const { lines: _incomingEntryLines, ...incomingEntryWithoutLines } = entry as Partial<JournalEntry> & { lines?: unknown };
      const updatedEntry = {
        ...existingEntryWithoutLines,
        ...incomingEntryWithoutLines,
        id: entryId,
        orgId: currentOrgId,
        periodId: resolvedPeriodId,
        status: 'ON_HOLD' as const,
        createdBy: existingEntry.createdBy || currentUser?.id || 'system',
        createdAt: existingEntry.createdAt || new Date().toISOString(),
        updatedBy: currentUser?.id || 'system',
        updatedAt: new Date().toISOString()
      } as JournalEntry;

      const savedEntry = await dataService.updateJournalEntry(entryId, updatedEntry);
      const normalizedSavedEntry = {
        ...savedEntry,
        status: savedEntry.status === 'DRAFT' ? 'ON_HOLD' : savedEntry.status,
        sourceType: (savedEntry.sourceType === 'MANUAL' && /^JV/i.test(String(savedEntry.reference || '').trim()))
          ? 'JOURNAL'
          : savedEntry.sourceType
      } as JournalEntry;

      const existingLines = journalLines.filter(line => line.journalEntryId === entryId);
      const normalizedLines = lines.map(normalizeJournalLineForSave).map(line => ({
        ...line,
        journalEntryId: entryId,
        orgId: currentOrgId
      }));

      const savedLines: JournalLine[] = [];
      for (let idx = 0; idx < normalizedLines.length; idx++) {
        const sourceLine = normalizedLines[idx];
        const existingLine = existingLines[idx];
        if (existingLine) {
          const updatedLine = await dataService.updateJournalLine(existingLine.id, {
            ...sourceLine,
            id: existingLine.id,
            journalEntryId: entryId
          });
          savedLines.push(updatedLine);
        } else {
          const createdLine = await dataService.createJournalLine(sourceLine as JournalLine);
          savedLines.push(createdLine);
        }
      }

      const extraLines = existingLines.slice(normalizedLines.length);
      for (const line of extraLines) {
        await dataService.deleteJournalLine(line.id);
      }

      setJournalEntries(prev => prev.map(e => e.id === entryId ? normalizedSavedEntry : e));
      const savedLineIds = new Set(savedLines.map(line => line.id));
      const extraLineIds = new Set(extraLines.map(line => line.id));
      setJournalLines(prev => [
        ...prev.filter(line => line.journalEntryId !== entryId || (!savedLineIds.has(line.id) && !extraLineIds.has(line.id))),
        ...savedLines
      ]);

      AuditService.update(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'JOURNAL_ENTRY',
        entryId,
        normalizedSavedEntry.reference || normalizedSavedEntry.glEntryNumber || entryId,
        existingEntry,
        normalizedSavedEntry
      );

      handleNotify('success', 'Journal entry draft updated.');
      return normalizedSavedEntry;
    } catch (error) {
      console.error('[App] Error updating journal draft:', error);
      handleNotify('error', 'Failed to update journal entry draft.');
      return null;
    }
  };

  const handleSaveOrPostJournal = (entry: Partial<JournalEntry>, lines: JournalLine[]) => {
    const status = (entry.status || 'ON_HOLD').toString().toUpperCase();
    if (status === 'ON_HOLD' || status === 'DRAFT') {
      return handleSaveJournalDraft(entry, lines);
    }
    return handlePostJournal(entry, lines);
  };

  const handleApproveJournal = async (entryId: string, referenceOverride?: string) => {
    try {
      const stateEntry = journalEntries.find(e => e.id === entryId);
      const persistedEntry = await dataService.getJournalEntryById(entryId);
      const entry = persistedEntry || stateEntry;
      if (!entry) return;

      const isCreditDebitMemoEntry =
        String(entry.sourceType || '').toUpperCase() === 'CREDIT_MEMO' ||
        /^(CM|DM|CDM|DBM)-/i.test(String(referenceOverride || '').trim()) ||
        /^(CM|DM|CDM|DBM)-/i.test(String(entry.reference || '').trim()) ||
        String(entry.description || '').toUpperCase().includes('CREDIT MEMO') ||
        String(entry.description || '').toUpperCase().includes('DEBIT MEMO');
      const memoReference = String(referenceOverride || entry.reference || '').trim();

      const updatedEntry = {
        ...entry,
        status: 'POSTED' as const,
        approvedBy: currentUser?.id,
        approvedAt: new Date().toISOString()
      };

      if (!updatedEntry.glEntryNumber) {
        updatedEntry.glEntryNumber = generateNextGlRef();
      }

      updatedEntry.reference = isCreditDebitMemoEntry
        ? (memoReference || updatedEntry.reference)
        : (updatedEntry.reference || updatedEntry.glEntryNumber);

      const savedEntry = await dataService.updateJournalEntry(entryId, updatedEntry);
      const normalizedSavedEntry = {
        ...savedEntry,
        status: savedEntry.status === 'DRAFT' ? 'ON_HOLD' : savedEntry.status,
        sourceType: (savedEntry.sourceType === 'MANUAL' && /^JV/i.test(String(savedEntry.reference || '').trim()))
          ? 'JOURNAL'
          : savedEntry.sourceType
      };

      setJournalEntries(prev => prev.map(e => e.id === entryId ? normalizedSavedEntry : e));
      handleNotify('success', 'Journal entry approved and posted');

      // Audit
      AuditService.post(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'JOURNAL_ENTRY',
        entryId,
        entryId,
        `Approved and posted draft journal: ${entry.reference} `
      );
    } catch (error) {
      console.error('[App] Error approving journal entry:', error);
      handleNotify('error', 'Failed to approve journal entry');
    }
  };

  const reverseJournalEntry = async (entryId: string): Promise<JournalEntry | null> => {
    const originalEntry = journalEntries.find(entry => entry.id === entryId);
    const normalizedStatus = String(originalEntry?.status || '').toUpperCase();
    const isReversalEntry = String(originalEntry?.sourceType || '').toUpperCase() === 'REVERSAL' || Boolean(originalEntry?.originalEntryId);
    const hasExistingReversal = journalEntries.some(entry => entry.originalEntryId === entryId);

    if (!originalEntry) {
      handleNotify('error', 'Journal entry not found.');
      return null;
    }

    if (normalizedStatus !== 'POSTED') {
      handleNotify('error', 'Only posted journal entries can be reversed.');
      return null;
    }

    if (isReversalEntry) {
      handleNotify('error', 'This journal entry is already a reversal and cannot be reversed again.');
      return null;
    }

    if (hasExistingReversal) {
      handleNotify('error', 'This journal entry has already been reversed.');
      return null;
    }

    try {
      const reversalEntry = await dataService.reverseJournalEntry(entryId);
      const reversalLines = await dataService.getJournalLinesByEntry(reversalEntry.id);
      const originalReferenceNo =
        String(originalEntry?.glEntryNumber || originalEntry?.reference || originalEntry?.id || '').trim();

      const normalizedReversalEntry = {
        ...reversalEntry,
        sourceRef: originalReferenceNo || reversalEntry.sourceRef,
        sourceType: reversalEntry.sourceType === 'MANUAL' ? 'JOURNAL' : reversalEntry.sourceType
      } as JournalEntry;

      setJournalEntries(prev => {
        const reversalExists = prev.some(entry => entry.id === normalizedReversalEntry.id);
        const reversedAt = normalizedReversalEntry.reversedAt || new Date().toISOString();
        const reversedBy = normalizedReversalEntry.reversedBy || currentUser?.id || 'system';
        const reversalReason =
          normalizedReversalEntry.reversalReason ||
          `Auto-generated reversal for ${originalEntry?.glEntryNumber || originalEntry?.reference || entryId}`;

        const next = prev.map(entry => (
          entry.id === entryId
            ? { ...entry, status: 'REVERSED', reversedAt, reversedBy, reversalReason }
            : entry
        ));

        return reversalExists ? next : [...next, normalizedReversalEntry];
      });

      setJournalLines(prev => {
        const existingIds = new Set(prev.map(line => line.id));
        const newLines = reversalLines.filter(line => !existingIds.has(line.id));
        return newLines.length > 0 ? [...prev, ...newLines] : prev;
      });

      AuditService.reverse(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'JOURNAL_ENTRY',
        normalizedReversalEntry.id,
        normalizedReversalEntry.glEntryNumber || normalizedReversalEntry.reference || normalizedReversalEntry.id,
        `Reversed ${originalEntry?.glEntryNumber || originalEntry?.reference || entryId} with ${reversalLines.length} lines`
      );

      handleNotify(
        'success',
        `Reversal posted: ${normalizedReversalEntry.glEntryNumber || normalizedReversalEntry.reference || normalizedReversalEntry.id}`
      );

      return normalizedReversalEntry;
    } catch (error) {
      console.error('[App] Error reversing journal entry:', error);
      handleNotify(
        'error',
        error instanceof Error ? error.message : 'Failed to reverse journal entry'
      );
      return null;
    }
  };

  const handleReverseOpenedJournal = async (): Promise<void> => {
    if (!journalFormEntry?.id) {
      handleNotify('error', 'No journal entry is currently open.');
      return;
    }

    const liveEntry = journalEntries.find(entry => entry.id === journalFormEntry.id);
    if (!liveEntry) {
      handleNotify('error', 'The opened journal entry could not be found.');
      return;
    }

    if (String(liveEntry.status || '').toUpperCase() !== 'POSTED') {
      handleNotify('error', 'Only the opened posted journal entry can be reversed from this view.');
      return;
    }

    const reversed = await reverseJournalEntry(liveEntry.id);
    if (!reversed) return;

    setShowJournalForm(false);
    setJournalFormEntry(null);
    setJournalFormLines([]);
    setJournalFormMode('new');
  };

  const handleViewJournal = (journalEntryId: string, sourceLines?: InvoiceLine[]) => {
    const normalizedId = journalEntryId.trim();
    const entry = journalEntries.find(e =>
      e.id === normalizedId ||
      (e.glEntryNumber || '').trim() === normalizedId ||
      (e.reference || '').trim() === normalizedId ||
      (e.sourceRef || '').trim() === normalizedId
    );
    if (!entry) return;

    const sourceType = String(entry.sourceType || '').toUpperCase();
    const sourceInvoice = sourceType === 'INVOICE'
      ? invoices.find(inv =>
          inv.orgId === currentOrgId &&
          (
            inv.id === entry.sourceRef ||
            inv.invoiceNo === entry.sourceRef ||
            inv.glEntryNumber === entry.sourceRef
          )
        )
      : null;

    setJournalFormEntry(
      sourceInvoice?.notes
        ? { ...entry, description: sourceInvoice.notes }
        : entry
    );

    const entryLines = journalLines.filter(line => line.journalEntryId === entry.id);
    const enrichedLines = sourceType === 'INVOICE'
      ? (() => {
          const sourceInvoiceLines = (sourceLines && sourceLines.length > 0)
            ? sourceLines
            : (() => {
                return sourceInvoice?.lines || [];
              })();
          const invoiceLines = (sourceInvoiceLines || [])
            .slice()
            .sort((a, b) => (a.lineNumber || 0) - (b.lineNumber || 0))
            .map((line: any) => String(line.classificationCode || '').trim());
          if (invoiceLines.length === 0) return entryLines;

          let invoiceLineIndex = 0;
          return entryLines.map(line => {
            const account = filteredAccounts.find(account => account.id === line.accountId);
            const isRevenueOrExpense = account?.class === AccountClass.REVENUE || account?.class === AccountClass.EXPENSE;
            if (!isRevenueOrExpense) return line;

            const existingClassCode = String((line as any).classificationCode || '').trim();
            const classificationCode = existingClassCode || invoiceLines[invoiceLineIndex] || '';
            const qualificationId = classificationCode
              ? (qualifications.find(q => q.code === classificationCode)?.id || (line as any).qualificationId || '')
              : (line as any).qualificationId || '';
            invoiceLineIndex += 1;

            return classificationCode
              ? ({ ...line, classificationCode, qualificationId } as JournalLine & { classificationCode?: string; qualificationId?: string })
              : line;
          });
        })()
      : entryLines;
    setJournalFormLines(enrichedLines);
    setJournalFormMode('view');
    setShowJournalForm(true);
  };

  const navigateTo = (tab: string, context?: any) => {
    setActiveTab(tab);
    setLedgerSearchTerm('');
    setNavigationContext(context);
  };

  const handleConvertToBill = (po: PurchaseOrder) => {
    setActiveTab('payables');
    handleNotify('info', `PO ${po.reference} converted for Bill processing.`);
  };

  const handleAddPayable = async (payable: Payable) => {
    try {
      const fullPayable = {
        ...payable,
        orgId: currentOrgId,
        createdBy: currentUser?.id || 'system'
      } as Payable;
      const savedPayable = await dataService.createPayable(fullPayable);
      setPayables(prev => [...prev, savedPayable]);

      // Audit: Payable created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', savedPayable.id, payable.payableNumber);

      handleNotify('success', `Payable ${payable.payableNumber} created successfully`);
    } catch (error) {
      console.error('[App] Error creating payable:', error);
      handleNotify('error', 'Failed to create payable in Supabase.');
      throw error;
    }
  };

  const handleUpdatePayable = async (id: string, updates: Partial<Payable>) => {
    try {
      console.info('[App] Updating payable:', id);
      const existing = payables.find(p => p.id === id);
      const updated = await dataService.updatePayable(id, updates);
      setPayables(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));

      // Audit: Payable updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', id, existing?.payableNumber, existing, { ...existing, ...updates });

      handleNotify('success', 'Payable updated successfully');
    } catch (error) {
      console.error('[App] Error updating payable:', error);
      handleNotify('error', 'Failed to update payable in Supabase.');
      throw error;
    }
  };

  const handleDeletePayable = async (id: string) => {
    try {
      console.info('[App] Deleting payable:', id);
      const existing = payables.find(p => p.id === id);
      await dataService.deletePayable(id);
      setPayables(prev => prev.filter(p => p.id !== id));

      // Audit: Payable deleted
      AuditService.delete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYABLE', id, existing?.payableNumber);

      handleNotify('success', 'Payable deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting payable:', error);
      handleNotify('error', 'Failed to delete payable in Supabase.');
      throw error;
    }
  };

  const handleApproveException = async (payableId: string, notes: string) => {
    try {
      console.info('[App] Approving 3-way match exception for payable:', payableId, 'Notes:', notes);
      const payable = payables.find(p => p.id === payableId);
      if (!payable) {
        handleNotify('error', 'Payable not found');
        return;
      }

      // Update payable status to approved with exception notes
      const exceptionNotes = `3-way Match Exception Approved: ${notes} `;
      const updates: Partial<Payable> = {
        status: 'approved',
        notes: exceptionNotes,
        approvedBy: currentUser?.id || 'system',
        approvedAt: new Date().toISOString()
      };

      await handleUpdatePayable(payableId, updates);

      // Log audit action for exception approval
      AuditService.logAction(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'PAYABLE_EXCEPTION_APPROVED',
        payableId,
        `3-way Match Exception: ${notes} `
      );

      handleNotify('success', '3-Way Match exception approved successfully');
    } catch (error) {
      console.error('[App] Error approving exception:', error);
      handleNotify('error', 'Failed to approve exception. Please try again.');
    }
  };

  // ============================================================================
  // ORGANIZATION & USER HANDLERS WITH SUPABASE PERSISTENCE
  // ============================================================================

  const handleAddOrganization = async (org: Organization) => {
    try {
      console.info('[App] Creating organization:', org.name);
      const savedOrg = await dataService.createOrganization(org);
      setOrganizations(prev => [...prev, normalizeOrganization(savedOrg)]);

      // Audit: Organization created
      AuditService.create(savedOrg.id, currentUser?.id || 'system', currentUser?.name || 'System', 'ORGANIZATION', savedOrg.id, org.name);

      handleNotify('success', `Organization "${org.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating organization:', error);
      handleNotify('error', 'Failed to create organization. Falling back to memory storage.');
      // Fallback to memory storage if Supabase fails
      setOrganizations(prev => [...prev, normalizeOrganization(org)]);
    }
  };

  const handleUpdateOrganization = async (id: string, updates: Partial<Organization>) => {
    const existing = organizations.find(o => o.id === id);
    if (!existing) {
      console.warn('[App] Organization not found for update:', id);
      return;
    }

    const optimisticOrg = normalizeOrganization({ ...existing, ...updates });
    setOrganizations(prev => prev.map(o => o.id === id ? optimisticOrg : o));

    try {
      console.info('[App] Updating organization in datasource:', id, updates);
      const updatedFromDb = await dataService.updateOrganization(id, updates);
      const merged = normalizeOrganization({ ...optimisticOrg, ...updatedFromDb });
      setOrganizations(prev => prev.map(o => o.id === id ? merged : o));

      AuditService.update(id, currentUser?.id || 'system', currentUser?.name || 'System', 'ORGANIZATION', id, existing?.name, existing, merged);
      handleNotify('success', 'Organization updated successfully');
    } catch (error) {
      console.error('[App] Error updating organization:', error);
      handleNotify('error', 'Failed to update organization. Reverting to previous state.');
      setOrganizations(prev => prev.map(o => o.id === id ? existing : o));
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    try {
      console.info('[App] Deleting organization:', id);
      const existing = organizations.find(o => o.id === id);
      await dataService.deleteOrganization(id);
      setOrganizations(prev => prev.filter(o => o.id !== id));

      // Audit: Organization deleted
      AuditService.hardDelete(id, currentUser?.id || 'system', currentUser?.name || 'System', 'ORGANIZATION', id, existing?.name);

      handleNotify('success', 'Organization deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting organization:', error);
      handleNotify('error', 'Failed to delete organization. Falling back to memory storage.');
      // Fallback to memory storage
      setOrganizations(prev => prev.filter(o => o.id !== id));
    }
  };

  // ============================================================================
  // BACKUP & RESTORE HANDLER
  // ============================================================================

  const handleRestoreBackup = async (backupData: any) => {
    try {
      console.info('[App] Restoring backup for organization:', backupData.metadata?.orgId);

      // Update all state with restored data
      if (backupData.data.organizations?.length) setOrganizations(backupData.data.organizations.map(normalizeOrganization));
      if (backupData.data.users?.length) setUsers(backupData.data.users);
      if (backupData.data.students?.length) setStudents(backupData.data.students);
      if (backupData.data.qualifications?.length) setQualifications(backupData.data.qualifications);
      if (backupData.data.trainers?.length) setTrainers(backupData.data.trainers);
      if (backupData.data.batches?.length) setBatches(backupData.data.batches);
      if (backupData.data.sponsors?.length) setSponsors(backupData.data.sponsors);
      if (backupData.data.vendors?.length) setVendors(backupData.data.vendors);
      if (backupData.data.employees?.length) setEmployees(backupData.data.employees);
      if (backupData.data.payrollRuns?.length) setPayrollRuns(backupData.data.payrollRuns);
      if (backupData.data.journalEntries?.length) setJournalEntries(backupData.data.journalEntries);
      if (backupData.data.journalEntryLines?.length) setJournalLines(backupData.data.journalEntryLines);
      if (backupData.data.auditLogs?.length) setAuditLogs(backupData.data.auditLogs);
      if (backupData.data.budgets?.length) setBudgets(backupData.data.budgets);
      if (backupData.data.accounts?.length) setAccounts(backupData.data.accounts);
      if (backupData.data.purchaseOrders?.length) setPurchaseOrders(backupData.data.purchaseOrders);
      if (backupData.data.paymentHistory?.length) setPaymentHistory(backupData.data.paymentHistory);
      if (backupData.data.payables?.length) setPayables(backupData.data.payables);
      if (backupData.data.accountingPeriods?.length) setAccountingPeriods(backupData.data.accountingPeriods);
      if (backupData.data.checkVouchers?.length) setCheckVouchers(backupData.data.checkVouchers);
      if (backupData.data.eftBatches?.length) setEftBatches(backupData.data.eftBatches);
      if (backupData.data.goodsReceipts?.length) setGoodsReceipts(backupData.data.goodsReceipts);
      if (backupData.data.bankReconciliations?.length) setBankReconciliations(backupData.data.bankReconciliations);
      if (backupData.data.warehouseLocations?.length) setWarehouseLocations(backupData.data.warehouseLocations);
      if (backupData.data.stockItems?.length) setStockItems(backupData.data.stockItems);
      if (backupData.data.inventoryLevels?.length) setInventoryLevels(backupData.data.inventoryLevels);
      if (backupData.data.inventoryTransactions?.length) setInventoryTransactions(backupData.data.inventoryTransactions);
      if (backupData.data.stockAdjustments?.length) setStockAdjustments(backupData.data.stockAdjustments);
      if (backupData.data.nonStockItems?.length) setItems(backupData.data.nonStockItems);
      if (backupData.data.fixedAssets?.length) setFixedAssets(backupData.data.fixedAssets);
      if (backupData.data.bankAccounts?.length) setBankAccounts(backupData.data.bankAccounts);
      if (backupData.data.locations?.length) setLocations(backupData.data.locations);

      // Audit: Backup restored
      AuditService.logAction(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'BACKUP_RESTORED',
        'BACKUP',
        currentOrgId,
        `Backup from ${backupData.metadata?.createdAt}, records: ${JSON.stringify(backupData.metadata?.recordCounts)} `
      );

      handleNotify('success', `Backup restored successfully.${Object.values(backupData.metadata?.recordCounts || {}).reduce((a: number, b: number) => a + b, 0)} records restored.`);
    } catch (error) {
      console.error('[App] Error restoring backup:', error);
      handleNotify('error', `Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleCreateFeedbackTicket = async (ticket: FeedbackTicket) => {
    try {
      const savedTicket = await dataService.createFeedbackTicket(ticket);
      setFeedbackTickets(prev => [...prev, savedTicket]);
      AuditService.create(ticket.orgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FEEDBACK_TICKET', savedTicket.id, savedTicket.title);
      handleNotify('success', 'Feedback ticket submitted successfully');
    } catch (error) {
      console.error('[App] Error creating feedback ticket:', error);
      handleNotify('error', `Failed to submit feedback to Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const handleUpdateFeedbackTicket = async (id: string, updates: Partial<FeedbackTicket>) => {
    if (currentUser?.role !== 'SYSTEM_ADMIN') {
      handleNotify('error', 'Only system administrators can update feedback status.');
      return;
    }

    try {
      const updatedTicket = await dataService.updateFeedbackTicket(id, updates);
      setFeedbackTickets(prev => prev.map(ticket => ticket.id === id ? { ...ticket, ...updatedTicket } : ticket));
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FEEDBACK_TICKET', id, updatedTicket.title, undefined, updatedTicket);
      handleNotify('success', 'Feedback status updated');
    } catch (error) {
      console.error('[App] Error updating feedback ticket:', error);
      handleNotify('error', `Failed to update feedback in Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ============================================================================
  // USER CRUD HANDLERS WITH SUPABASE PERSISTENCE
  // ============================================================================

  const handleAddUser = async (user: User) => {
    // Require authenticated Supabase session
    const session = authService.getSession();
    if (!session || !session.user) {
      handleNotify('error', 'You must be logged in with a valid Supabase account to create users.');
      return;
    }
    // RBAC: SYSTEM_ADMIN can create for any org, ADMIN only for their own org, others denied
    const isSysAdmin = session.user.role === 'SYSTEM_ADMIN';
    const isAdmin = session.user.role === 'ADMIN';
    const adminOrgId = session.user.orgId || currentOrgId;
    const creatingForOwnOrg = !user.orgId || user.orgId === session.user.orgId || user.orgId === currentOrgId || user.orgId === adminOrgId;
    if (!isSysAdmin && !(isAdmin && creatingForOwnOrg)) {
      handleNotify('error', 'You do not have permission to create users for this organization.');
      return;
    }
    // Use session user for audit
    const auditUserId = session.user.id;
    const auditUserName = session.user.name;
    try {
      console.info('[App] Creating user:', user.email);
      // SYSTEM_ADMIN can set any orgId, ADMIN is forced to their own org
      const userWithOrg = isSysAdmin ? { ...user } : { ...user, orgId: adminOrgId };
      const savedUser = await dataService.createUser(userWithOrg, { preferUserToken: true });
      setUsers(prev => [...prev, savedUser]);
      // Audit: User created
      AuditService.create(currentOrgId, auditUserId, auditUserName, 'USER', savedUser.id, user.name);
      // Email Verification: Send verification email if not verified
      if (!savedUser.isEmailVerified) {
        const { emailVerificationService } = await import('./services/EmailVerificationService');
        const { emailSenderService } = await import('./services/EmailSenderService');
        const tokenEntry = emailVerificationService.generateToken(savedUser.id, savedUser.email);
        await emailSenderService.sendVerificationEmail(savedUser.email, tokenEntry.token);
        handleNotify('info', `Verification email sent to ${savedUser.email} `);
      }
      handleNotify('success', `User "${user.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating user:', error);
      handleNotify('error', 'Failed to create user. Falling back to memory storage.');
      // Fallback to memory storage
      const userWithOrg = isSysAdmin ? { ...user } : { ...user, orgId: session.user.orgId };
      setUsers(prev => [...prev, userWithOrg]);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      console.info('[App] Deleting user:', id);
      const existing = users.find(u => u.id === id);
      await dataService.deleteUser(id);
      setUsers(prev => prev.filter(u => u.id !== id));

      // Audit: User deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'USER', id, existing?.name);

      handleNotify('success', 'User deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting user:', error);
      handleNotify('error', 'Failed to delete user. Falling back to memory storage.');
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleUpdateCurrentUserProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;

    const cleanUpdates: Partial<User> = {
      name: updates.name ?? '',
      lastName: updates.lastName || undefined,
      email: updates.email ?? '',
      contactNumber: updates.contactNumber || undefined,
      address: updates.address || undefined,
      profilePhoto: updates.profilePhoto || undefined
    };

    try {
      const updated = await dataService.updateUser(currentUser.id, {
        ...cleanUpdates,
        updatedAt: new Date().toISOString()
      } as Partial<User>);
      const mergedUser = { ...currentUser, ...cleanUpdates, ...updated };

      setCurrentUser(mergedUser);
      setUsers(prev => prev.map(user => user.id === currentUser.id ? { ...user, ...mergedUser } : user));
      authService.updateStoredUser(mergedUser);
      localStorage.setItem('at_erp_session', JSON.stringify({
        user: mergedUser,
        token: btoa(JSON.stringify({ userId: mergedUser.id, email: mergedUser.email, iat: Date.now() }))
      }));
      handleNotify('success', 'Profile updated successfully');
    } catch (error) {
      console.error('[App] Error updating profile:', error);
      const mergedUser = { ...currentUser, ...cleanUpdates };

      setCurrentUser(mergedUser);
      setUsers(prev => prev.map(user => user.id === currentUser.id ? { ...user, ...mergedUser } : user));
      authService.updateStoredUser(mergedUser);
      localStorage.setItem('at_erp_session', JSON.stringify({
        user: mergedUser,
        token: btoa(JSON.stringify({ userId: mergedUser.id, email: mergedUser.email, iat: Date.now() }))
      }));
      handleNotify('error', 'Profile saved locally, but Supabase update failed.');
    }
  };

  const handleRegisterWithPersistence = async (org: Organization, admin: User) => {
    try {
      console.info('[App] Registering new organization and admin user');

      // Create organization
      const savedOrg = await dataService.createOrganization(org);
      setOrganizations(p => [...p, normalizeOrganization(savedOrg)]);

      // Create admin user
      const savedAdmin = await dataService.createUser(admin);
      setUsers(p => [...p, savedAdmin]);

      setCurrentUser(savedAdmin);
      setCurrentOrgId(savedOrg.id);
      setActiveTab('dashboard');

      // Audit: New organization registered
      AuditService.log({
        orgId: savedOrg.id,
        userId: savedAdmin.id,
        userName: savedAdmin.name,
        action: 'CREATE',
        entityType: 'ORGANIZATION',
        entityId: savedOrg.id,
        entityName: savedOrg.name,
        details: `New organization registered with admin user: ${savedAdmin.name} `
      });

      handleNotify('success', `Welcome! Organization "${org.name}" registered successfully`);
      console.info('[App] Registration complete');
    } catch (error) {
      console.error('[App] Error during registration:', error);
      handleNotify('error', 'Registration failed. Falling back to memory storage.');
      // Fallback to memory storage
      setOrganizations(p => [...p, normalizeOrganization(org)]);
      setUsers(p => [...p, admin]);
      setCurrentUser(admin);
      setCurrentOrgId(org.id);
      setActiveTab('dashboard');
    }
  };

  // ============================================================================
  // STUDENT CRUD HANDLERS WITH SUPABASE PERSISTENCE & REFERENTIAL INTEGRITY
  // ============================================================================

  const handleAddStudent = async (student: Student) => {
    try {
      console.info('[App] Creating student:', student.uli);
      const studentWithOrg = { ...student, orgId: currentOrgId };
      const savedStudent = await dataService.createStudent(studentWithOrg);
      setStudents(prev => [...prev, savedStudent]);

      // Audit: Student created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', savedStudent.id, `${student.firstName} ${student.lastName} `);

      handleNotify('success', `Student "${student.firstName} ${student.lastName}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating student:', error);
      handleNotify('error', 'Failed to create student. Falling back to memory storage.');
      const studentWithOrg = { ...student, orgId: currentOrgId };
      setStudents(prev => [...prev, studentWithOrg]);
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', student.id, `${student.firstName} ${student.lastName} `);
    }
  };

  const handleUpdateStudent = async (student: Student) => {
    try {
      console.info('[App] Updating student:', student.id);
      const existing = students.find(s => s.id === student.id);
      const mergedStudent = existing
        ? {
            ...existing,
            ...student,
            profilePhoto: student.profilePhoto ?? existing.profilePhoto,
            documents: student.documents ?? existing.documents,
          }
        : student;
      const updated = await dataService.updateStudent(student.id, mergedStudent);
      setStudents(prev => prev.map(s => s.id === student.id ? updated : s));

      // Audit: Student updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', student.id, `${mergedStudent.firstName} ${mergedStudent.lastName} `, existing, mergedStudent);

      handleNotify('success', 'Student record updated successfully');
    } catch (error) {
      console.error('[App] Error updating student:', error);
      handleNotify('error', 'Failed to update student. Falling back to memory storage.');
      setStudents(prev => prev.map(s => s.id === student.id ? {
        ...s,
        ...student,
        profilePhoto: student.profilePhoto ?? s.profilePhoto,
        documents: student.documents ?? s.documents,
      } : s));
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      console.info('[App] Checking student usage before deletion:', id);
      const existing = students.find(s => s.id === id);

      // Check if student is used in other modules
      const usage = await dataService.checkStudentUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete student.Referenced in: ${usage.usedIn.join(', ')} `;
        handleNotify('error', message);
        return false; // Return false to indicate deletion failed
      }

      // Proceed with hard delete (Supabase table doesn't support soft delete)
      console.info('[App] Deleting student:', id);
      await dataService.deleteStudent(id);
      setStudents(prev => prev.filter(s => s.id !== id));

      // Audit: Student deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'STUDENT', id, existing ? `${existing.firstName} ${existing.lastName} ` : undefined);

      handleNotify('success', 'Student record deleted successfully');
      return true; // Return true to indicate successful deletion
    } catch (error) {
      console.error('[App] Error deleting student:', error);
      handleNotify('error', 'Failed to delete student. Falling back to memory storage.');
      // Fallback to hard delete in memory
      setStudents(prev => prev.filter(s => s.id !== id));
      return true;
    }
  };

  const handleBatchAddStudents = async (newStudents: Student[]) => {
    try {
      console.info('[App] Batch adding students:', newStudents.length);
      const studentsWithOrg = newStudents.map(s => ({ ...s, orgId: currentOrgId }));

      // Create each student
      const savedStudents = await Promise.all(
        studentsWithOrg.map(s => dataService.createStudent(s))
      );

      setStudents(prev => [...prev, ...savedStudents]);
      handleNotify('success', `${newStudents.length} students imported successfully`);
    } catch (error) {
      console.error('[App] Error batch adding students:', error);
      handleNotify('error', 'Failed to import students. Falling back to memory storage.');
      // Fallback to memory storage
      const studentsWithOrg = newStudents.map(s => ({ ...s, orgId: currentOrgId }));
      setStudents(prev => [...prev, ...studentsWithOrg]);
    }
  };

  // ============================================================================
  // TRAINER CRUD HANDLERS WITH SUPABASE PERSISTENCE & REFERENTIAL INTEGRITY
  // ============================================================================

  const handleAddTrainer = async (trainer: Trainer) => {
    try {
      console.info('[App] Creating trainer:', `${trainer.firstName} ${trainer.lastName} `);
      const trainerWithOrg = { ...trainer, orgId: currentOrgId };
      const savedTrainer = await dataService.createTrainer(trainerWithOrg);
      setTrainers(prev => [...prev, savedTrainer]);

      // Audit: Trainer created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'TRAINER', savedTrainer.id, `${trainer.firstName} ${trainer.lastName} `);

      handleNotify('success', `Trainer "${trainer.firstName} ${trainer.lastName}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating trainer:', error);
      handleNotify('error', 'Failed to create trainer. Falling back to memory storage.');
      const trainerWithOrg = { ...trainer, orgId: currentOrgId };
      setTrainers(prev => [...prev, trainerWithOrg]);
    }
  };

  const handleUpdateTrainer = async (trainer: Trainer) => {
    try {
      console.info('[App] Updating trainer:', trainer.id);
      const existing = trainers.find(t => t.id === trainer.id);
      const updated = await dataService.updateTrainer(trainer.id, trainer);
      setTrainers(prev => prev.map(t => t.id === trainer.id ? updated : t));

      // Audit: Trainer updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'TRAINER', trainer.id, `${trainer.firstName} ${trainer.lastName} `, existing, trainer);

      handleNotify('success', 'Trainer record updated successfully');
    } catch (error) {
      console.error('[App] Error updating trainer:', error);
      handleNotify('error', 'Failed to update trainer. Falling back to memory storage.');
      setTrainers(prev => prev.map(t => t.id === trainer.id ? trainer : t));
    }
  };

  const handleDeleteTrainer = async (id: string) => {
    try {
      console.info('[App] Checking trainer usage before deletion:', id);
      const existing = trainers.find(t => t.id === id);

      // Check if trainer is used in other modules
      const usage = await dataService.checkTrainerUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete trainer.Referenced in: ${usage.usedIn.join(', ')} `;
        handleNotify('error', message);
        return false; // Return false to indicate deletion failed
      }

      // Proceed with hard delete
      console.info('[App] Deleting trainer:', id);
      await dataService.deleteTrainer(id);
      setTrainers(prev => prev.filter(t => t.id !== id));

      // Audit: Trainer deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'TRAINER', id, existing ? `${existing.firstName} ${existing.lastName} ` : undefined);

      handleNotify('success', 'Trainer record deleted successfully');
      return true; // Return true to indicate successful deletion
    } catch (error) {
      console.error('[App] Error deleting trainer:', error);
      handleNotify('error', 'Failed to delete trainer. Falling back to memory storage.');
      // Fallback to hard delete in memory
      setTrainers(prev => prev.filter(t => t.id !== id));
      return true;
    }
  };

  // ============================================================================
  // QUALIFICATION CRUD HANDLERS WITH SUPABASE PERSISTENCE & REFERENTIAL INTEGRITY
  // ============================================================================

  const handleAddQualification = async (qualification: Qualification) => {
    try {
      console.info('[App] Creating qualification:', qualification.code);
      const qualWithOrg = { ...qualification, orgId: currentOrgId };
      const savedQual = await dataService.createQualification(qualWithOrg);
      setQualifications(prev => [...prev, savedQual]);

      // Audit: Qualification created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'QUALIFICATION', savedQual.id, qualification.name);

      handleNotify('success', `Qualification "${qualification.name}" registered successfully`);
    } catch (error) {
      console.error('[App] Error creating qualification:', error);
      handleNotify('error', 'Failed to create qualification. Falling back to memory storage.');
      const qualWithOrg = { ...qualification, orgId: currentOrgId };
      setQualifications(prev => [...prev, qualWithOrg]);
    }
  };

  const handleUpdateQualification = async (qualification: Qualification) => {
    try {
      console.info('[App] Updating qualification:', qualification.id);
      const existing = qualifications.find(q => q.id === qualification.id);
      const updated = await dataService.updateQualification(qualification.id, qualification);
      setQualifications(prev => prev.map(q => q.id === qualification.id ? updated : q));

      // Audit: Qualification updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'QUALIFICATION', qualification.id, qualification.name, existing, qualification);

      handleNotify('success', 'Qualification record updated successfully');
    } catch (error) {
      console.error('[App] Error updating qualification:', error);
      handleNotify('error', 'Failed to update qualification. Falling back to memory storage.');
      setQualifications(prev => prev.map(q => q.id === qualification.id ? qualification : q));
    }
  };

  const handleDeleteQualification = async (id: string) => {
    try {
      console.info('[App] Checking qualification usage before deletion:', id);
      const existing = qualifications.find(q => q.id === id);

      // Check if qualification is used in other modules
      const usage = await dataService.checkQualificationUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete qualification.Referenced in: ${usage.usedIn.join(', ')} `;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting qualification:', id);
      await dataService.deleteQualification(id);
      setQualifications(prev => prev.filter(q => q.id !== id));

      // Audit: Qualification deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'QUALIFICATION', id, existing?.name);

      handleNotify('success', 'Qualification record deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting qualification:', error);
      handleNotify('error', 'Failed to delete qualification. Falling back to memory storage.');
      setQualifications(prev => prev.filter(q => q.id !== id));
      return true;
    }
  };

  // ======================== LOCATION CRUD HANDLERS ========================

  const handleAddLocation = async (location: Location) => {
    try {
      console.info('[App] Creating new location:', location);
      // Ensure orgId is set
      location.orgId = currentOrgId;

      const created = await dataService.createLocation(location);
      console.info('[App] Location created successfully:', created);
      setLocations(prev => [...prev, created]);

      // Audit: Location created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'LOCATION', created.id, location.name);

      handleNotify('success', 'Location registered successfully');
    } catch (error) {
      console.error('[App] Error creating location:', error);
      handleNotify('error', 'Failed to save location. Falling back to memory storage.');
      // Fallback to local state
      location.orgId = currentOrgId;
      setLocations(prev => [...prev, location]);
    }
  };

  const handleUpdateLocation = async (location: Location) => {
    try {
      console.info('[App] Updating location:', location);
      const existing = locations.find(l => l.id === location.id);
      const updated = await dataService.updateLocation(location.id, location);
      console.info('[App] Location updated successfully:', updated);
      setLocations(prev => prev.map(l => l.id === location.id ? location : l));

      // Audit: Location updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'LOCATION', location.id, location.name, existing, location);

      handleNotify('success', 'Location updated successfully');
    } catch (error) {
      console.error('[App] Error updating location:', error);
      handleNotify('error', 'Failed to update location. Falling back to memory storage.');
      setLocations(prev => prev.map(l => l.id === location.id ? location : l));
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      console.info('[App] Checking location usage before deletion:', id);
      const existing = locations.find(l => l.id === id);

      // Check if location is used in other modules
      const usage = await dataService.checkLocationUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete location.Referenced in: ${usage.usedIn.join(', ')} `;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting location:', id);
      await dataService.deleteLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));

      // Audit: Location deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'LOCATION', id, existing?.name);

      handleNotify('success', 'Location deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting location:', error);
      handleNotify('error', 'Failed to delete location. Falling back to memory storage.');
      setLocations(prev => prev.filter(l => l.id !== id));
      return true;
    }
  };

  // ======================== SCHEDULE CRUD HANDLERS ========================

  const handleAddSchedule = async (schedule: TrainerSchedule) => {
    try {
      console.info('[App] Creating new schedule:', schedule);
      // Ensure orgId is set
      schedule.orgId = currentOrgId;

      const created = await dataService.createSchedule(schedule);
      console.info('[App] Schedule created successfully:', created);
      setSchedules(prev => [...prev, created]);

      // Audit: Schedule created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SCHEDULE', created.id);

      handleNotify('success', 'Schedule registered successfully');
    } catch (error) {
      console.error('[App] Error creating schedule:', error);
      handleNotify('error', 'Failed to save schedule. Falling back to memory storage.');
      // Fallback to local state
      schedule.orgId = currentOrgId;
      setSchedules(prev => [...prev, schedule]);
    }
  };

  const handleUpdateSchedule = async (schedule: TrainerSchedule) => {
    try {
      console.info('[App] Updating schedule:', schedule);
      const existing = schedules.find(s => s.id === schedule.id);
      const updated = await dataService.updateSchedule(schedule.id, schedule);
      console.info('[App] Schedule updated successfully:', updated);
      setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));

      // Audit: Schedule updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SCHEDULE', schedule.id, undefined, existing, schedule);

      handleNotify('success', 'Schedule updated successfully');
    } catch (error) {
      console.error('[App] Error updating schedule:', error);
      handleNotify('error', 'Failed to update schedule. Falling back to memory storage.');
      setSchedules(prev => prev.map(s => s.id === schedule.id ? schedule : s));
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      console.info('[App] Checking schedule usage before deletion:', id);

      // Check if schedule is used in other modules
      const usage = await dataService.checkScheduleUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete schedule.Referenced in: ${usage.usedIn.join(', ')} `;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting schedule:', id);
      await dataService.deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));

      // Audit: Schedule deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SCHEDULE', id);

      handleNotify('success', 'Schedule deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting schedule:', error);
      handleNotify('error', 'Failed to delete schedule. Falling back to memory storage.');
      setSchedules(prev => prev.filter(s => s.id !== id));
      return true;
    }
  };

  // ============================================================================
  // BATCH CRUD Handlers
  // ============================================================================

  const getBatchFundingSponsorId = (batch?: Batch | null) => String((batch as any)?.sponsorId || (batch as any)?.sponsor_id || '').trim();

  const mapBatchBillingRulesToEnrollments = (batch: Batch, sourceEnrollments: Enrollment[]) => {
    const sponsorId = getBatchFundingSponsorId(batch);
    if (!sponsorId) return sourceEnrollments;

    const classification = BillingComputationService.classifyEnrollmentsByBatchCap({
      batches: [batch],
      enrollments: sourceEnrollments,
      courseFees
    }, batch.id);

    return classification.classifiedEnrollments.map(enrollment => ({
      ...enrollment,
      sponsorId: enrollment.sponsorId || sponsorId,
      updatedAt: new Date().toISOString()
    }));
  };

  const persistEnrollmentBillingUpdates = async (updates: Enrollment[]) => {
    await Promise.all(updates.map(enrollment =>
      dataService.updateEntity('enrollments', enrollment.id, {
        sponsorId: enrollment.sponsorId,
        billingType: enrollment.billingType,
        updatedAt: enrollment.updatedAt
      } as Partial<Enrollment>).catch(error => {
        console.warn('[App] Failed to persist enrollment billing mapping:', enrollment.id, error);
        return null;
      })
    ));
  };

  const applyBatchBillingContractToEnrollments = async (batch: Batch, extraEnrollment?: Enrollment) => {
    const sponsorId = getBatchFundingSponsorId(batch);
    if (!sponsorId) return;

    const batchEnrollmentRows = enrollments
      .filter(enrollment => enrollment.batchId === batch.id && !enrollment.isDeleted)
      .filter(enrollment => !extraEnrollment || enrollment.id !== extraEnrollment.id);
    const sourceRows = extraEnrollment ? [...batchEnrollmentRows, extraEnrollment] : batchEnrollmentRows;

    if (sourceRows.length === 0) return;

    const updates = mapBatchBillingRulesToEnrollments(batch, sourceRows);
    const updateMap = new Map(updates.map(enrollment => [enrollment.id, enrollment]));

    setEnrollments(prev => prev.map(enrollment => {
      return updateMap.get(enrollment.id) || enrollment;
    }));

    await persistEnrollmentBillingUpdates(updates);
  };

  const handleAddBatch = async (batch: Batch) => {
    try {
      const batchWithOrg = { ...batch, orgId: currentOrgId };
      console.info('[App] Creating batch:', batchWithOrg);
      const created = await dataService.createBatch(batchWithOrg);
      console.info('[App] Batch created successfully:', created);
      setBatches(prev => [...prev, created]);
      await applyBatchBillingContractToEnrollments(created);

      // Audit: Batch created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BATCH', created.id, batch.name || batch.batchCode);

      handleNotify('success', 'Batch created successfully');
    } catch (error) {
      console.error('[App] Error creating batch:', error);
      handleNotify('error', 'Failed to save batch. Falling back to memory storage.');
      batch.orgId = currentOrgId;
      setBatches(prev => [...prev, batch]);
    }
  };

  const handleUpdateBatch = async (batch: Batch) => {
    try {
      console.info('[App] Updating batch:', batch);
      const existing = batches.find(b => b.id === batch.id);
      const updated = await dataService.updateBatch(batch.id, batch);
      console.info('[App] Batch updated successfully:', updated);
      setBatches(prev => prev.map(b => b.id === batch.id ? updated : b));
      await applyBatchBillingContractToEnrollments(updated);

      // Audit: Batch updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BATCH', batch.id, batch.name || batch.batchCode, existing, batch);

      handleNotify('success', 'Batch updated successfully');
    } catch (error) {
      console.error('[App] Error updating batch:', error);
      handleNotify('error', 'Failed to update batch. Falling back to memory storage.');
      setBatches(prev => prev.map(b => b.id === batch.id ? batch : b));
    }
  };

  const handleDeleteBatch = async (id: string) => {
    try {
      console.info('[App] Deleting batch:', id);
      const existing = batches.find(b => b.id === id);
      await dataService.deleteBatch(id);
      setBatches(prev => prev.filter(b => b.id !== id));

      // Audit: Batch deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BATCH', id, existing?.name || existing?.batchCode);

      handleNotify('success', 'Batch deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting batch:', error);
      handleNotify('error', 'Failed to delete batch. Falling back to memory storage.');
      setBatches(prev => prev.filter(b => b.id !== id));
      return true;
    }
  };

  // ============================================================================
  // SPONSOR CRUD Handlers
  // ============================================================================

  const handleAddSponsor = async (sponsor: Sponsor) => {
    try {
      const sponsorWithOrg = { ...sponsor, orgId: currentOrgId };
      console.info('[App] Creating sponsor:', sponsorWithOrg);
      const created = await dataService.createSponsor(sponsorWithOrg);
      setSponsors(prev => [...prev, created]);

      // Audit: Sponsor created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SPONSOR', created.id, sponsor.name);

      handleNotify('success', `Sponsor "${created.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating sponsor:', error);
      handleNotify('error', 'Failed to create sponsor. Falling back to memory storage.');
      setSponsors(prev => [...prev, { ...sponsor, orgId: currentOrgId }]);
    }
  };

  const handleUpdateSponsor = async (sponsor: Sponsor) => {
    try {
      console.info('[App] Updating sponsor:', sponsor);
      const existing = sponsors.find(s => s.id === sponsor.id);
      const updated = await dataService.updateSponsor(sponsor.id, sponsor);
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? updated : s));

      // Audit: Sponsor updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SPONSOR', sponsor.id, sponsor.name, existing, sponsor);

      handleNotify('success', `Sponsor "${updated.name}" updated successfully`);
    } catch (error) {
      console.error('[App] Error updating sponsor:', error);
      handleNotify('error', 'Failed to update sponsor. Falling back to memory storage.');
      setSponsors(prev => prev.map(s => s.id === sponsor.id ? sponsor : s));
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    try {
      console.info('[App] Checking sponsor usage before deletion:', id);
      const existing = sponsors.find(s => s.id === id);

      // Check if sponsor is used in other modules
      const usage = await dataService.checkSponsorUsage(id);
      if (usage.isUsed) {
        const message = `Cannot delete sponsor.Referenced in: ${usage.usedIn.join(', ')} `;
        handleNotify('error', message);
        return false;
      }

      // Proceed with hard delete
      console.info('[App] Deleting sponsor:', id);
      await dataService.deleteSponsor(id);
      setSponsors(prev => prev.filter(s => s.id !== id));

      // Audit: Sponsor deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'SPONSOR', id, existing?.name);

      handleNotify('success', 'Sponsor deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting sponsor:', error);
      handleNotify('error', 'Failed to delete sponsor. Falling back to memory storage.');
      setSponsors(prev => prev.filter(s => s.id !== id));
      return true;
    }
  };

  // ============================================================================
  // BANK ACCOUNT CRUD HANDLERS
  // ============================================================================

  const handleAddBankAccount = async (bank: Partial<BankAccount>) => {
    try {
      console.info('[App] Creating bank account:', bank.bankName);
      const bankWithOrg = { ...bank, orgId: currentOrgId } as BankAccount;
      const created = await dataService.createBankAccount(bankWithOrg);
      setBankAccounts(prev => [...prev, created]);

      // Audit: Bank account created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_ACCOUNT', created.id, `${bank.bankName} - ${bank.accountNumber} `);

      handleNotify('success', `Bank account "${created.bankName}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating bank account:', error);
      handleNotify('error', `Failed to create bank account: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleUpdateBankAccount = async (id: string, updates: Partial<BankAccount>) => {
    try {
      console.info('[App] Updating bank account:', id, updates);
      const existing = bankAccounts.find(b => b.id === id);
      const updated = await dataService.updateBankAccount(id, updates);
      setBankAccounts(prev => prev.map(b => b.id === id ? updated : b));

      // Audit: Bank account updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_ACCOUNT', id, existing?.bankName, existing, { ...existing, ...updates });

      handleNotify('success', 'Bank account updated successfully');
    } catch (error) {
      console.error('[App] Error updating bank account:', error);
      handleNotify('error', `Failed to update bank account: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    try {
      console.info('[App] Deleting bank account:', id);
      const existing = bankAccounts.find(b => b.id === id);
      await dataService.deleteBankAccount(id);
      setBankAccounts(prev => prev.filter(b => b.id !== id));

      // Audit: Bank account deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_ACCOUNT', id, existing?.bankName);

      handleNotify('success', 'Bank account deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting bank account:', error);
      handleNotify('error', `Failed to delete bank account: ${error instanceof Error ? error.message : 'Unknown error'} `);
      return false;
    }
  };

  // Bank Reconciliation CRUD Handlers
  const handleAddBankReconciliation = async (reconciliation: any) => {
    try {
      console.info('[App] Creating bank reconciliation:', reconciliation.bankAccountId, reconciliation.asOfDate);
      const reconciliationWithOrg = { ...reconciliation, orgId: currentOrgId };
      const created = await dataService.createBankReconciliation(reconciliationWithOrg);
      setBankReconciliations(prev => [...prev, created]);

      // Audit: Bank reconciliation created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_RECONCILIATION', created.id, `Reconciliation as of ${created.asOfDate} `);

      handleNotify('success', 'Bank reconciliation saved successfully');
    } catch (error) {
      console.error('[App] Error creating bank reconciliation:', error);
      handleNotify('error', `Failed to save reconciliation: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleUpdateBankReconciliation = async (id: string, updates: any) => {
    try {
      console.info('[App] Updating bank reconciliation:', id, updates);
      const existing = bankReconciliations.find(r => r.id === id);
      const updated = await dataService.updateBankReconciliation(id, updates);
      setBankReconciliations(prev => prev.map(r => r.id === id ? updated : r));

      // Audit: Bank reconciliation updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_RECONCILIATION', id, existing?.asOfDate, existing, { ...existing, ...updates });

      handleNotify('success', 'Bank reconciliation updated successfully');
    } catch (error) {
      console.error('[App] Error updating bank reconciliation:', error);
      handleNotify('error', `Failed to update reconciliation: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleDeleteBankReconciliation = async (id: string) => {
    try {
      console.info('[App] Deleting bank reconciliation:', id);
      const existing = bankReconciliations.find(r => r.id === id);
      await dataService.deleteBankReconciliation(id);
      setBankReconciliations(prev => prev.filter(r => r.id !== id));

      // Audit: Bank reconciliation deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_RECONCILIATION', id, existing?.asOfDate);

      handleNotify('success', 'Bank reconciliation deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting bank reconciliation:', error);
      handleNotify('error', `Failed to delete reconciliation: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  // Recurring Journal Entry CRUD Handlers
  const handleAddRecurringJournalEntry = async (entry: any) => {
    try {
      console.info('[App] Creating recurring journal entry:', entry.name);
      const entryWithOrg = { ...entry, orgId: currentOrgId };
      const created = await dataService.createRecurringJournalEntry(entryWithOrg);
      setRecurringJournalEntries(prev => [...prev, created]);

      // Audit: Recurring journal entry created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'RECURRING_JOURNAL_ENTRY', created.id, `Recurring entry: ${created.name} `);

      handleNotify('success', 'Recurring journal entry created successfully');
    } catch (error) {
      console.error('[App] Error creating recurring journal entry:', error);
      handleNotify('error', `Failed to create recurring entry: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleUpdateRecurringJournalEntry = async (id: string, updates: any) => {
    try {
      console.info('[App] Updating recurring journal entry:', id);
      const existing = recurringJournalEntries.find(e => e.id === id);
      const updated = await dataService.updateRecurringJournalEntry(id, updates);
      setRecurringJournalEntries(prev => prev.map(e => e.id === id ? updated : e));

      // Audit: Recurring journal entry updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'RECURRING_JOURNAL_ENTRY', id, existing?.name, existing, { ...existing, ...updates });

      handleNotify('success', 'Recurring journal entry updated successfully');
    } catch (error) {
      console.error('[App] Error updating recurring journal entry:', error);
      handleNotify('error', `Failed to update recurring entry: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleDeleteRecurringJournalEntry = async (id: string) => {
    try {
      console.info('[App] Deleting recurring journal entry:', id);
      const existing = recurringJournalEntries.find(e => e.id === id);
      await dataService.deleteRecurringJournalEntry(id);
      setRecurringJournalEntries(prev => prev.filter(e => e.id !== id));

      // Audit: Recurring journal entry deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'RECURRING_JOURNAL_ENTRY', id, existing?.name);

      handleNotify('success', 'Recurring journal entry deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting recurring journal entry:', error);
      handleNotify('error', `Failed to delete recurring entry: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleRunRecurringEntry = async (id: string) => {
    try {
      console.info('[App] Running recurring journal entry:', id);
      const entry = recurringJournalEntries.find(e => e.id === id);
      if (!entry) {
        handleNotify('error', 'Recurring entry not found');
        return;
      }

      // Import RecurringJournalEntryService to use its logic
      const { RecurringJournalEntryService } = await import('./services/RecurringJournalEntryService');

      // Check if entry is due
      if (!RecurringJournalEntryService.isDueToRun(entry)) {
        handleNotify('warning', 'This recurring entry is not due to run yet');
        return;
      }

      // Generate journal entry from template
      const entryDate = new Date().toISOString().split('T')[0];
      const generatedId = crypto.randomUUID();
      const { entry: journalEntryData, lines: journalLineData } = RecurringJournalEntryService.generateEntryFromTemplate(
        entry,
        entryDate,
        generatedId
      );

      // Create journal entry with lines
      const newJournalEntry: Partial<JournalEntry> = {
        ...journalEntryData,
        orgId: currentOrgId,
        createdBy: currentUser?.id || 'system',
        createdAt: new Date().toISOString()
      };

      const created = await dataService.createJournalEntry(newJournalEntry as JournalEntry);
      setJournalEntries(prev => [...prev, created]);

      // Update the recurring entry with execution info
      const updatedEntry = RecurringJournalEntryService.updateAfterExecution(entry, created.id);
      const updated = await dataService.updateRecurringJournalEntry(id, updatedEntry);
      setRecurringJournalEntries(prev => prev.map(e => e.id === id ? updated : e));

      // Audit
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'JOURNAL_ENTRY', created.id, `Auto - generated from recurring entry: ${entry.name} `);

      handleNotify('success', 'Recurring journal entry executed and posted successfully');
    } catch (error) {
      console.error('[App] Error running recurring journal entry:', error);
      handleNotify('error', `Failed to execute recurring entry: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  // Check Voucher CRUD Handlers
  const handleAddCheckVoucher = async (check: Partial<CheckVoucher>) => {
    try {
      console.info('[App] Creating check voucher:', check.checkNumber);
      const checkWithOrg = { ...check, orgId: currentOrgId } as CheckVoucher;
      const created = await dataService.createCheckVoucher(checkWithOrg);
      setCheckVouchers(prev => [...prev, created]);

      // Audit: Check voucher created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'CHECK_VOUCHER', created.id, `Check #${check.checkNumber} `);

      handleNotify('success', `Check #${created.checkNumber} created successfully`);
      return created;
    } catch (error) {
      console.error('[App] Error creating check voucher:', error);
      handleNotify('error', `Failed to create check: ${error instanceof Error ? error.message : 'Unknown error'} `);
      return null;
    }
  };

  const handleUpdateCheckVoucher = async (id: string, updates: Partial<CheckVoucher>) => {
    try {
      console.info('[App] Updating check voucher:', id, updates);
      const existing = checkVouchers.find(c => c.id === id);
      const updated = await dataService.updateCheckVoucher(id, updates);
      setCheckVouchers(prev => prev.map(c => c.id === id ? updated : c));

      // Audit: Check voucher updated (include status changes)
      const statusChange = updates.status && existing?.status !== updates.status
        ? `Status: ${existing?.status} → ${updates.status} `
        : undefined;
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'CHECK_VOUCHER', id, `Check #${existing?.checkNumber} `, existing, { ...existing, ...updates });

      handleNotify('success', 'Check voucher updated successfully');
      return updated;
    } catch (error) {
      console.error('[App] Error updating check voucher:', error);
      handleNotify('error', `Failed to update check: ${error instanceof Error ? error.message : 'Unknown error'} `);
      return null;
    }
  };

  const handleDeleteCheckVoucher = async (id: string) => {
    try {
      console.info('[App] Deleting check voucher:', id);
      const existing = checkVouchers.find(c => c.id === id);
      await dataService.deleteCheckVoucher(id);
      setCheckVouchers(prev => prev.filter(c => c.id !== id));

      // Audit: Check voucher deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'CHECK_VOUCHER', id, `Check #${existing?.checkNumber} `);

      handleNotify('success', 'Check voucher deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting check voucher:', error);
      handleNotify('error', `Failed to delete check: ${error instanceof Error ? error.message : 'Unknown error'} `);
      return false;
    }
  };

  const handleAddVendor = async (vendor: Partial<Vendor>) => {
    try {
      console.info('[App] Creating vendor:', vendor.name);
      const vendorWithOrg = { ...vendor, orgId: currentOrgId } as Vendor;
      const created = await dataService.createVendor(vendorWithOrg);
      setVendors(prev => [...prev, created]);

      // Audit: Vendor created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'VENDOR', created.id, vendor.name);

      handleNotify('success', `Vendor "${created.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating vendor:', error);
      handleNotify('error', 'Failed to create vendor. Falling back to memory storage.');
      setVendors(prev => [...prev, { ...vendor, orgId: currentOrgId, id: `ven - ${Date.now()} ` } as Vendor]);
    }
  };

  const handleUpdateVendor = async (id: string, updates: Partial<Vendor>) => {
    try {
      console.info('[App] Updating vendor:', id, updates);
      const existing = vendors.find(v => v.id === id);
      const updated = await dataService.updateVendor(id, updates);
      setVendors(prev => prev.map(v => v.id === id ? updated : v));

      // Audit: Vendor updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'VENDOR', id, existing?.name, existing, { ...existing, ...updates });

      handleNotify('success', 'Vendor updated successfully');
    } catch (error) {
      console.error('[App] Error updating vendor:', error);
      handleNotify('error', 'Failed to update vendor. Falling back to memory storage.');
      setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
    }
  };

  const handleDeleteVendor = async (id: string) => {
    try {
      console.info('[App] Deleting vendor:', id);
      const existing = vendors.find(v => v.id === id);
      await dataService.deleteVendor(id);
      setVendors(prev => prev.filter(v => v.id !== id));

      // Audit: Vendor deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'VENDOR', id, existing?.name);

      handleNotify('success', 'Vendor deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting vendor:', error);
      handleNotify('error', 'Failed to delete vendor. Falling back to memory storage.');
      setVendors(prev => prev.filter(v => v.id !== id));
      return true;
    }
  };

  // ============================================================================
  // INVENTORY MANAGEMENT CRUD HANDLERS
  // ============================================================================

  // Warehouse Locations CRUD
  const handleAddWarehouseLocation = async (location: Omit<WarehouseLocation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating warehouse location:', location.name);
      const newLocation = await dataService.createWarehouseLocation({ ...location, orgId: currentOrgId } as WarehouseLocation);
      setWarehouseLocations([...warehouseLocations, newLocation]);
      handleNotify('success', `Location "${location.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error adding warehouse location:', error);
      handleNotify('error', 'Failed to create location. Falling back to memory storage.');
      const locWithId: WarehouseLocation = { ...location, orgId: currentOrgId, id: `loc - ${Date.now()} `, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setWarehouseLocations([...warehouseLocations, locWithId]);
    }
  };

  const handleUpdateWarehouseLocation = async (id: string, updates: Partial<WarehouseLocation>) => {
    try {
      console.info('[App] Updating warehouse location:', id);
      const updated = await dataService.updateWarehouseLocation(id, updates);
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? updated : l));
      handleNotify('success', 'Location updated successfully');
    } catch (error) {
      console.error('[App] Error updating warehouse location:', error);
      handleNotify('error', 'Failed to update location. Falling back to memory storage.');
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  };

  const handleDeleteWarehouseLocation = async (id: string) => {
    try {
      console.info('[App] Deleting warehouse location:', id);
      await dataService.deleteWarehouseLocation(id);
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? { ...l, isDeleted: true } : l));
      handleNotify('success', 'Location deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting warehouse location:', error);
      handleNotify('error', 'Failed to delete location. Falling back to memory storage.');
      setWarehouseLocations(warehouseLocations.map(l => l.id === id ? { ...l, isDeleted: true } : l));
    }
  };

  // Stock Items CRUD
  const handleAddStockItem = async (item: Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating stock item:', item.name);
      const newItem = await dataService.createStockItem({ ...item, orgId: currentOrgId } as StockItem);
      setStockItems([...stockItems, newItem]);
      handleNotify('success', `Item "${item.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error adding stock item:', error);
      handleNotify('error', 'Failed to create item. Falling back to memory storage.');
      const itemWithId: StockItem = { ...item, orgId: currentOrgId, id: `item - ${Date.now()} `, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setStockItems([...stockItems, itemWithId]);
    }
  };

  const handleUpdateStockItem = async (id: string, updates: Partial<StockItem>) => {
    try {
      console.info('[App] Updating stock item:', id);
      const updated = await dataService.updateStockItem(id, updates);
      setStockItems(stockItems.map(i => i.id === id ? updated : i));
      handleNotify('success', 'Item updated successfully');
    } catch (error) {
      console.error('[App] Error updating stock item:', error);
      handleNotify('error', 'Failed to update item. Falling back to memory storage.');
      setStockItems(stockItems.map(i => i.id === id ? { ...i, ...updates } : i));
    }
  };

  const handleDeleteStockItem = async (id: string) => {
    try {
      console.info('[App] Deleting stock item:', id);
      await dataService.deleteStockItem(id);
      setStockItems(stockItems.map(i => i.id === id ? { ...i, isDeleted: true } : i));
      handleNotify('success', 'Item deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting stock item:', error);
      handleNotify('error', 'Failed to delete item. Falling back to memory storage.');
      setStockItems(stockItems.map(i => i.id === id ? { ...i, isDeleted: true } : i));
    }
  };

  // Inventory Levels CRUD
  const handleAddInventoryLevel = async (level: Omit<InventoryLevel, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating inventory level');
      const newLevel = await dataService.createInventoryLevel({ ...level, orgId: currentOrgId } as InventoryLevel);
      setInventoryLevels([...inventoryLevels, newLevel]);
      handleNotify('success', 'Inventory level created successfully');
    } catch (error) {
      console.error('[App] Error adding inventory level:', error);
      handleNotify('error', 'Failed to create inventory level. Falling back to memory storage.');
      const levelWithId: InventoryLevel = { ...level, orgId: currentOrgId, id: `level - ${Date.now()} `, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setInventoryLevels([...inventoryLevels, levelWithId]);
    }
  };

  const handleUpdateInventoryLevel = async (id: string, updates: Partial<InventoryLevel>) => {
    try {
      console.info('[App] Updating inventory level:', id);
      const updated = await dataService.updateInventoryLevel(id, updates);
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? updated : l));
      handleNotify('success', 'Inventory level updated successfully');
    } catch (error) {
      console.error('[App] Error updating inventory level:', error);
      handleNotify('error', 'Failed to update inventory level. Falling back to memory storage.');
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  };

  const handleDeleteInventoryLevel = async (id: string) => {
    try {
      console.info('[App] Deleting inventory level:', id);
      await dataService.deleteInventoryLevel(id);
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? { ...l, isDeleted: true } : l));
      handleNotify('success', 'Inventory level deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting inventory level:', error);
      handleNotify('error', 'Failed to delete inventory level. Falling back to memory storage.');
      setInventoryLevels(inventoryLevels.map(l => l.id === id ? { ...l, isDeleted: true } : l));
    }
  };

  // Stock Adjustments CRUD
  const handleAddStockAdjustment = async (adjustment: Omit<StockAdjustment, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating stock adjustment');
      const newAdjustment = await dataService.createStockAdjustment({ ...adjustment, orgId: currentOrgId } as StockAdjustment);
      setStockAdjustments([...stockAdjustments, newAdjustment]);
      handleNotify('success', 'Stock adjustment created successfully');
    } catch (error) {
      console.error('[App] Error adding stock adjustment:', error);
      handleNotify('error', 'Failed to create adjustment. Falling back to memory storage.');
      const adjWithId: StockAdjustment = { ...adjustment, orgId: currentOrgId, id: `adj - ${Date.now()} `, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setStockAdjustments([...stockAdjustments, adjWithId]);
    }
  };

  const handleUpdateStockAdjustment = async (id: string, updates: Partial<StockAdjustment>) => {
    try {
      console.info('[App] Updating stock adjustment:', id);
      const updated = await dataService.updateStockAdjustment(id, updates);
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? updated : a));
      handleNotify('success', 'Stock adjustment updated successfully');
    } catch (error) {
      console.error('[App] Error updating stock adjustment:', error);
      handleNotify('error', 'Failed to update adjustment. Falling back to memory storage.');
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? { ...a, ...updates } : a));
    }
  };

  const handleDeleteStockAdjustment = async (id: string) => {
    try {
      console.info('[App] Deleting stock adjustment:', id);
      await dataService.deleteStockAdjustment(id);
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? { ...a, isDeleted: true } : a));
      handleNotify('success', 'Stock adjustment deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting stock adjustment:', error);
      handleNotify('error', 'Failed to delete adjustment. Falling back to memory storage.');
      setStockAdjustments(stockAdjustments.map(a => a.id === id ? { ...a, isDeleted: true } : a));
    }
  };

  // Reorder Points CRUD
  const handleAddReorderPoint = async (point: Omit<ReorderPoint, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.info('[App] Creating reorder point');
      const newPoint = await dataService.createReorderPoint({ ...point, orgId: currentOrgId } as ReorderPoint);
      setReorderPoints([...reorderPoints, newPoint]);
      handleNotify('success', 'Reorder point created successfully');
    } catch (error) {
      console.error('[App] Error adding reorder point:', error);
      handleNotify('error', 'Failed to create reorder point. Falling back to memory storage.');
      const pointWithId: ReorderPoint = { ...point, orgId: currentOrgId, id: `reorder - ${Date.now()} `, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isDeleted: false } as any;
      setReorderPoints([...reorderPoints, pointWithId]);
    }
  };

  const handleUpdateReorderPoint = async (id: string, updates: Partial<ReorderPoint>) => {
    try {
      console.info('[App] Updating reorder point:', id);
      const updated = await dataService.updateReorderPoint(id, updates);
      setReorderPoints(reorderPoints.map(p => p.id === id ? updated : p));
      handleNotify('success', 'Reorder point updated successfully');
    } catch (error) {
      console.error('[App] Error updating reorder point:', error);
      handleNotify('error', 'Failed to update reorder point. Falling back to memory storage.');
      setReorderPoints(reorderPoints.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  };

  const handleDeleteReorderPoint = async (id: string) => {
    try {
      console.info('[App] Deleting reorder point:', id);
      await dataService.deleteReorderPoint(id);
      setReorderPoints(reorderPoints.map(p => p.id === id ? { ...p, isDeleted: true } : p));
      handleNotify('success', 'Reorder point deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting reorder point:', error);
      handleNotify('error', 'Failed to delete reorder point. Falling back to memory storage.');
      setReorderPoints(reorderPoints.map(p => p.id === id ? { ...p, isDeleted: true } : p));
    }
  };

  // ============================================================================
  // FIXED ASSET CRUD HANDLERS
  // ============================================================================

  const handleAddFixedAsset = async (asset: FixedAsset) => {
    try {
      console.info('[App] Creating fixed asset:', asset.name);
      const assetWithOrg = { ...asset, orgId: currentOrgId };
      const savedAsset = await dataService.createFixedAsset(assetWithOrg);
      setFixedAssets(prev => [...prev, savedAsset]);

      // Audit: Fixed asset created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FIXED_ASSET', savedAsset.id, `${asset.code} - ${asset.name} `);

      handleNotify('success', `Fixed asset "${asset.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating fixed asset:', error);
      handleNotify('error', 'Failed to create fixed asset. Falling back to memory storage.');
      const assetWithOrg = { ...asset, orgId: currentOrgId };
      setFixedAssets(prev => [...prev, assetWithOrg]);
    }
  };

  const handleUpdateFixedAsset = async (id: string, updates: Partial<FixedAsset>) => {
    try {
      console.info('[App] Updating fixed asset:', id);
      const existing = fixedAssets.find(a => a.id === id);
      const updated = await dataService.updateFixedAsset(id, updates);
      setFixedAssets(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));

      // Audit: Fixed asset updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FIXED_ASSET', id, existing?.name, existing, { ...existing, ...updates });

      handleNotify('success', 'Fixed asset updated successfully');
    } catch (error) {
      console.error('[App] Error updating fixed asset:', error);
      handleNotify('error', 'Failed to update fixed asset. Falling back to memory storage.');
      setFixedAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }
  };

  const handleDeleteFixedAsset = async (id: string) => {
    try {
      console.info('[App] Deleting fixed asset:', id);
      const existing = fixedAssets.find(a => a.id === id);
      await dataService.deleteFixedAsset(id);
      setFixedAssets(prev => prev.filter(a => a.id !== id));

      // Audit: Fixed asset deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'FIXED_ASSET', id, existing?.name);

      handleNotify('success', 'Fixed asset deleted successfully');
    } catch (error) {
      console.error('[App] Error archiving fixed asset:', error);
      handleNotify('error', 'Failed to archive fixed asset.');
      return false;
    }
  };

  // ============================================================================
  // ALUMNI EMPLOYMENT REPORT HANDLERS
  // ============================================================================

  const handleAddAlumniReport = async (report: AlumniEmploymentReport) => {
    try {
      console.info('[App] Creating alumni report for student:', report.studentId);
      const reportWithOrg = { ...report, orgId: currentOrgId };
      const saved = await dataService.createAlumniReport(reportWithOrg);
      setAlumniReports(prev => [...prev, saved]);
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ALUMNI_REPORT', saved.id, `Employment report for student: ${report.studentId} `);
      handleNotify('success', 'Alumni employment report created successfully');
    } catch (error) {
      console.error('[App] Error creating alumni report:', error);
      handleNotify('error', 'Failed to create alumni report');
    }
  };

  const handleUpdateAlumniReport = async (report: AlumniEmploymentReport) => {
    try {
      console.info('[App] Updating alumni report:', report.id);
      const updated = await dataService.updateAlumniReport(report.id, report);
      setAlumniReports(prev => prev.map(r => r.id === report.id ? { ...r, ...updated } : r));
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ALUMNI_REPORT', report.id, `Updated report for student: ${report.studentId} `, {}, report);
      handleNotify('success', 'Alumni employment report updated successfully');
    } catch (error) {
      console.error('[App] Error updating alumni report:', error);
      handleNotify('error', 'Failed to update alumni report');
    }
  };

  const handleDeleteAlumniReport = async (id: string) => {
    try {
      console.info('[App] Deleting alumni report:', id);
      await dataService.deleteAlumniReport(id);
      setAlumniReports(prev => prev.filter(r => r.id !== id));
      AuditService.delete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ALUMNI_REPORT', id, 'Alumni employment report');
      handleNotify('success', 'Alumni employment report deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting alumni report:', error);
      handleNotify('error', 'Failed to delete alumni report');
    }
  };

  // ============================================================================
  // ARCHIVE HANDLERS
  // ============================================================================

  const handleRestoreFromArchive = async (type: string, id: string) => {
    try {
      console.info(`[App] Restoring ${type} from archive: `, id);

      const tableName = mapTypeToTable[type];
      if (!tableName) throw new Error(`Unknown type: ${type} `);

      await dataService.restoreEntity(tableName, id);

      // Update local state
      updateState(type, id, { isDeleted: false });

      // Audit: Restored
      AuditService.logAction(currentOrgId, currentUser?.id || "system", currentUser?.name || "System", "RESTORED", type, id);

      handleNotify('success', `${type} restored successfully`);
    } catch (error) {
      console.error(`[App] Error restoring ${type}: `, error);
      handleNotify('error', `Failed to restore ${type} `);
    }
  };

  const handlePermanentDelete = async (type: string, id: string) => {
    try {
      console.info(`[App] Permanent delete ${type}: `, id);

      const tableName = mapTypeToTable[type];
      if (!tableName) throw new Error(`Unknown type: ${type} `);

      await dataService.permanentDeleteEntity(tableName, id);

      // Update local state - remove from list
      removeFromState(type, id);

      // Audit: Permanent Delete
      AuditService.logAction(currentOrgId, currentUser?.id || "system", currentUser?.name || "System", "PERMANENT_DELETE", type, id);

      handleNotify('success', `${type} deleted permanently`);
    } catch (error) {
      console.error(`[App] Error permanent deleting ${type}: `, error);
      handleNotify('error', `Failed to permanently delete ${type} `);
    }
  };

  // Type to Table / State mapping helper
  const mapTypeToTable: Record<string, string> = {
    'STUDENT': 'students',
    'TRAINER': 'trainers',
    'QUALIFICATION': 'qualifications',
    'BATCH': 'batches',
    'LOCATION': 'locations',
    'SPONSOR': 'sponsors',
    'VENDOR': 'vendors',
    'EMPLOYEE': 'employees',
    'ITEM': 'items',
    'PO': 'purchase_orders',
    'BANK_ACCOUNT': 'bank_accounts',
    'FIXED_ASSET': 'fixed_assets',
    'ACCOUNT': 'chart_of_accounts',
    'RECURRING_INVOICE': 'recurring_invoices',
    'REVENUE_SCHEDULE': 'revenue_schedules',
    'PAYABLE': 'payables',
    'CHECK_VOUCHERS': 'check_vouchers',
    'BANK_RECONCILIATION': 'bank_reconciliations',
    'RECURRING_JOURNAL_ENTRY': 'recurring_journal_entries',
    'STOCK_ITEM': 'stock_items',
    'WAREHOUSE_LOCATION': 'warehouse_locations',
    'INVENTORY_LEVEL': 'inventory_levels',
    'STOCK_ADJUSTMENT': 'stock_adjustments',
    'REORDER_POINT': 'reorder_points',
    'GOODS_RECEIPT': 'goods_receipts',
    'EFT_BATCH': 'eft_batches',
    'ORGANIZATION': 'organizations',
    'USER': 'users',
    'INVOICE': 'invoices',
    'INVOICE_LINE': 'invoice_lines'
  };

  const updateState = (type: string, id: string, updates: any) => {
    switch (type) {
      case 'STUDENT': setStudents(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'TRAINER': setTrainers(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'QUALIFICATION': setQualifications(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'BATCH': setBatches(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'LOCATION': setLocations(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'SPONSOR': setSponsors(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'VENDOR': setVendors(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'EMPLOYEE': setEmployees(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'ITEM': setItems(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'PO': setPurchaseOrders(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'BANK_ACCOUNT': setBankAccounts(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'FIXED_ASSET': setFixedAssets(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'ACCOUNT': setAccounts(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'RECURRING_INVOICE': setRecurringInvoices(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'REVENUE_SCHEDULE': setRevenueSchedules(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'PAYABLE': setPayables(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'CHECK_VOUCHER': setCheckVouchers(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'BANK_RECONCILIATION': setBankReconciliations(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'RECURRING_JOURNAL_ENTRY': setRecurringJournalEntries(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'STOCK_ITEM': setStockItems(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'WAREHOUSE_LOCATION': setWarehouseLocations(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'INVENTORY_LEVEL': setInventoryLevels(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'STOCK_ADJUSTMENT': setStockAdjustments(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'REORDER_POINT': setReorderPoints(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'GOODS_RECEIPT': setGoodsReceipts(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'EFT_BATCH': setEftBatches(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'ORGANIZATION': setOrganizations(prev => prev.map(x => x.id === id ? normalizeOrganization({ ...x, ...updates }) : x)); break;
      case 'USER': setUsers(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
      case 'INVOICE': setInvoices(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x)); break;
    }
  };

  const removeFromState = (type: string, id: string) => {
    switch (type) {
      case 'STUDENT': setStudents(prev => prev.filter(x => x.id !== id)); break;
      case 'TRAINER': setTrainers(prev => prev.filter(x => x.id !== id)); break;
      case 'QUALIFICATION': setQualifications(prev => prev.filter(x => x.id !== id)); break;
      case 'BATCH': setBatches(prev => prev.filter(x => x.id !== id)); break;
      case 'LOCATION': setLocations(prev => prev.filter(x => x.id !== id)); break;
      case 'SPONSOR': setSponsors(prev => prev.filter(x => x.id !== id)); break;
      case 'VENDOR': setVendors(prev => prev.filter(x => x.id !== id)); break;
      case 'EMPLOYEE': setEmployees(prev => prev.filter(x => x.id !== id)); break;
      case 'ITEM': setItems(prev => prev.filter(x => x.id !== id)); break;
      case 'PO': setPurchaseOrders(prev => prev.filter(x => x.id !== id)); break;
      case 'BANK_ACCOUNT': setBankAccounts(prev => prev.filter(x => x.id !== id)); break;
      case 'FIXED_ASSET': setFixedAssets(prev => prev.filter(x => x.id !== id)); break;
      case 'ACCOUNT': setAccounts(prev => prev.filter(x => x.id !== id)); break;
      case 'RECURRING_INVOICE': setRecurringInvoices(prev => prev.filter(x => x.id !== id)); break;
      case 'REVENUE_SCHEDULE': setRevenueSchedules(prev => prev.filter(x => x.id !== id)); break;
      case 'PAYABLE': setPayables(prev => prev.filter(x => x.id !== id)); break;
      case 'CHECK_VOUCHER': setCheckVouchers(prev => prev.filter(x => x.id !== id)); break;
      case 'BANK_RECONCILIATION': setBankReconciliations(prev => prev.filter(x => x.id !== id)); break;
      case 'RECURRING_JOURNAL_ENTRY': setRecurringJournalEntries(prev => prev.filter(x => x.id !== id)); break;
      case 'STOCK_ITEM': setStockItems(prev => prev.filter(x => x.id !== id)); break;
      case 'WAREHOUSE_LOCATION': setWarehouseLocations(prev => prev.filter(x => x.id !== id)); break;
      case 'INVENTORY_LEVEL': setInventoryLevels(prev => prev.filter(x => x.id !== id)); break;
      case 'STOCK_ADJUSTMENT': setStockAdjustments(prev => prev.filter(x => x.id !== id)); break;
      case 'REORDER_POINT': setReorderPoints(prev => prev.filter(x => x.id !== id)); break;
      case 'GOODS_RECEIPT': setGoodsReceipts(prev => prev.filter(x => x.id !== id)); break;
      case 'EFT_BATCH': setEftBatches(prev => prev.filter(x => x.id !== id)); break;
      case 'ORGANIZATION': setOrganizations(prev => prev.filter(x => x.id !== id)); break;
      case 'USER': setUsers(prev => prev.filter(x => x.id !== id)); break;
      case 'INVOICE': setInvoices(prev => prev.filter(x => x.id !== id)); break;
    }
  };

  const handleDepreciate = async (assetId: string) => {
    try {
      const asset = fixedAssets.find(a => a.id === assetId);
      if (!asset) {
        handleNotify('error', 'Asset not found');
        return;
      }

      // Calculate monthly depreciation: Purchase Cost / (Useful Life Years * 12)
      const monthlyDepreciation = asset.purchaseCost / (asset.usefulLifeYears * 12);

      // Generate entry ID
      const entryId = `depr - ${Date.now()} `;

      // Create depreciation lines with proper journalEntryId reference
      const deprLines: JournalLine[] = [
        {
          id: `line - ${Date.now()} -debit`,
          journalEntryId: entryId,
          orgId: currentOrgId,
          accountId: '', // Depreciation expense account-will use blank for now
          debit: monthlyDepreciation,
          credit: 0,
          description: `Depreciation expense - ${asset.name} `,
          assetId: assetId
        },
        {
          id: `line - ${Date.now()} -credit`,
          journalEntryId: entryId,
          orgId: currentOrgId,
          accountId: asset.glAccountId, // Fixed Asset account
          debit: 0,
          credit: monthlyDepreciation,
          description: `Accumulated depreciation - ${asset.name} `,
          assetId: assetId
        }
      ];

      // Create depreciation journal entry with double-entry accounting
      const newEntry: JournalEntry = {
        id: entryId,
        orgId: currentOrgId,
        periodId: '', // Will need period context
        date: new Date().toISOString().split('T')[0],
        description: `Monthly depreciation for ${asset.name}`,
        reference: `DEP - ${new Date().getFullYear()} -${Math.floor(Math.random() * 100000).toString().padStart(5, '0')} `,
        status: 'POSTED',
        createdBy: currentUser?.id || 'system',
        sourceType: 'DEPRECIATION',
        createdAt: new Date().toISOString(),
        isDeleted: false
      };

      // Add journal entry lines separately
      const newLines: JournalLine[] = deprLines.map(line => ({
        ...line,
        journalEntryId: entryId
      }));

      // Add to journal entries and lines
      setJournalEntries(prev => [...prev, newEntry]);
      setJournalLines(prev => [...prev, ...newLines]);

      // Update accumulated depreciation on the asset
      const newAccumulated = (asset.accumulatedDepreciation || 0) + monthlyDepreciation;
      await handleUpdateFixedAsset(assetId, { accumulatedDepreciation: newAccumulated });

      // Audit: Depreciation recorded
      AuditService.log({
        orgId: currentOrgId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        action: 'POST',
        entityType: 'FIXED_ASSET',
        entityId: assetId,
        entityName: asset.name,
        details: `Depreciation: ${monthlyDepreciation.toFixed(2)} | New Accumulated: ${newAccumulated.toFixed(2)} `
      });

      handleNotify('success', `Depreciation of ${monthlyDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2 })} recorded successfully`);
    } catch (error) {
      console.error('[App] Error recording depreciation:', error);
      handleNotify('error', 'Failed to record depreciation');
    }
  };

  // Item Catalog Handlers
  const handleAddItem = async (item: NonStockItem) => {
    try {
      console.info('[App] Creating item:', item.name);
      const itemWithOrg = { ...item, orgId: currentOrgId };
      const savedItem = await dataService.createItem(itemWithOrg);
      setItems(prev => [...prev, savedItem]);

      // Audit: Item created
      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ITEM', savedItem.id, `${item.code} - ${item.name} `);

      handleNotify('success', `Item "${item.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating item:', error);
      handleNotify('error', 'Failed to create item. Falling back to memory storage.');
      const itemWithOrg = { ...item, orgId: currentOrgId };
      setItems(prev => [...prev, itemWithOrg]);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<NonStockItem>) => {
    try {
      console.info('[App] Updating item:', id);
      const existing = items.find(i => i.id === id);
      const updated = await dataService.updateItem(id, updates);
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));

      // Audit: Item updated
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ITEM', id, existing?.name, existing, { ...existing, ...updates });

      handleNotify('success', 'Item updated successfully');
    } catch (error) {
      console.error('[App] Error updating item:', error);
      handleNotify('error', 'Failed to update item. Falling back to memory storage.');
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      console.info('[App] Deleting item:', id);
      const existing = items.find(i => i.id === id);
      await dataService.deleteItem(id);
      setItems(prev => prev.filter(i => i.id !== id));

      // Audit: Item deleted
      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ITEM', id, existing?.name);

      handleNotify('success', 'Item deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting item:', error);
      handleNotify('error', 'Failed to delete item. Falling back to memory storage.');
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  // ===== Course Fee CRUD Handlers =====
  const handleAddCourseFee = async (fee: CourseFee) => {
    try {
      console.info('[App] Creating course fee:', fee.feeName);
      const feeWithOrg = { ...fee, orgId: currentOrgId };
      const savedFee = await dataService.createCourseFee(feeWithOrg);
      setCourseFees(prev => [...prev, savedFee]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'COURSE_FEE', savedFee.id, `${fee.feeCode} - ${fee.feeName} `);
      handleNotify('success', `Course fee "${fee.feeName}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating course fee:', error);
      handleNotify('error', `Failed to create course fee: ${error instanceof Error ? error.message : 'Unknown error'} `);
      throw error; // Re-throw so bulk creation can detect the failure
    }
  };

  const handleUpdateCourseFee = async (fee: CourseFee) => {
    try {
      console.info('[App] Updating course fee:', fee.id);
      const existing = courseFees.find(f => f.id === fee.id);
      const updated = await dataService.updateCourseFee(fee.id, fee);
      setCourseFees(prev => prev.map(f => f.id === fee.id ? updated : f));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'COURSE_FEE', fee.id, fee.feeName, existing, fee);
      handleNotify('success', `Course fee "${fee.feeName}" updated successfully`);
    } catch (error) {
      console.error('[App] Error updating course fee:', error);
      handleNotify('error', `Failed to update course fee: ${error instanceof Error ? error.message : 'Unknown error'} `);
    }
  };

  const handleDeleteCourseFee = async (id: string): Promise<boolean> => {
    try {
      console.info('[App] Deleting course fee:', id);
      const existing = courseFees.find(f => f.id === id);
      await dataService.deleteCourseFee(id);
      setCourseFees(prev => prev.filter(f => f.id !== id));

      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'COURSE_FEE', id, existing?.feeName);
      handleNotify('success', 'Course fee deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting course fee:', error);
      handleNotify('error', `Failed to delete course fee: ${error instanceof Error ? error.message : 'Unknown error'} `);
      return false;
    }
  };

  // ===== Enrollment CRUD Handlers =====
  const handleAddEnrollment = async (enrollment: Enrollment) => {
    try {
      console.info('[App] Creating enrollment for student:', enrollment.studentId);
      const batch = batches.find(b => b.id === enrollment.batchId);
      const draftEnrollment = {
        ...enrollment,
        orgId: currentOrgId,
        sponsorId: getBatchFundingSponsorId(batch) || enrollment.sponsorId,
        billingType: enrollment.billingType || 'BILLABLE'
      } as Enrollment;
      let enrollmentWithOrg = batch
        ? mapBatchBillingRulesToEnrollments(batch, [
          ...enrollments.filter(e => e.batchId === enrollment.batchId && !e.isDeleted),
          draftEnrollment
        ]).find(e => e.id === draftEnrollment.id) || draftEnrollment
        : draftEnrollment;

      try {
        enrollmentWithOrg = await dataService.createEntity('enrollments', enrollmentWithOrg);
      } catch (persistError) {
        console.warn('[App] Failed to persist enrollment; keeping it in app state:', persistError);
      }

      setEnrollments(prev => [...prev, enrollmentWithOrg]);
      if (batch) {
        await applyBatchBillingContractToEnrollments(batch, enrollmentWithOrg);
      }

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ENROLLMENT', enrollmentWithOrg.id, enrollment.enrollmentCode || enrollment.id);
      handleNotify('success', 'Student enrolled successfully');
    } catch (error) {
      console.error('[App] Error creating enrollment:', error);
      handleNotify('error', 'Failed to create enrollment.');
    }
  };

  const handleUpdateEnrollment = async (enrollment: Enrollment) => {
    try {
      console.info('[App] Updating enrollment:', enrollment.id);
      const existing = enrollments.find(e => e.id === enrollment.id);
      const batch = batches.find(b => b.id === enrollment.batchId);
      const updatedEnrollment = {
        ...enrollment,
        sponsorId: getBatchFundingSponsorId(batch) || enrollment.sponsorId,
        updatedAt: new Date().toISOString()
      } as Enrollment;

      setEnrollments(prev => prev.map(e => e.id === enrollment.id ? { ...e, ...updatedEnrollment } : e));
      try {
        await dataService.updateEntity('enrollments', updatedEnrollment.id, updatedEnrollment);
      } catch (persistError) {
        console.warn('[App] Failed to persist enrollment update; keeping it in app state:', persistError);
      }
      if (batch) {
        await applyBatchBillingContractToEnrollments(batch, updatedEnrollment);
      }

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ENROLLMENT', enrollment.id, enrollment.enrollmentCode, existing, enrollment);
      handleNotify('success', 'Enrollment updated successfully');
    } catch (error) {
      console.error('[App] Error updating enrollment:', error);
      handleNotify('error', 'Failed to update enrollment.');
    }
  };

  const handleDeleteEnrollment = async (id: string): Promise<boolean> => {
    try {
      console.info('[App] Deleting enrollment:', id);
      const existing = enrollments.find(e => e.id === id);
      const deletedEnrollment = { ...existing, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id } as Enrollment;
      setEnrollments(prev => prev.map(e => e.id === id ? { ...e, ...deletedEnrollment } : e));
      try {
        await dataService.updateEntity('enrollments', id, {
          isDeleted: true,
          deletedAt: deletedEnrollment.deletedAt,
          deletedBy: deletedEnrollment.deletedBy
        } as Partial<Enrollment>);
      } catch (persistError) {
        console.warn('[App] Failed to persist enrollment delete; keeping it in app state:', persistError);
      }
      const batch = existing ? batches.find(b => b.id === existing.batchId) : undefined;
      if (batch) {
        await applyBatchBillingContractToEnrollments(batch);
      }

      AuditService.softDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ENROLLMENT', id, existing?.enrollmentCode);
      handleNotify('success', 'Enrollment removed successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting enrollment:', error);
      handleNotify('error', 'Failed to delete enrollment.');
      return false;
    }
  };

  // ===== Assessment Registration CRUD Handlers =====
  const handleAddAssessmentRegistration = async (registration: AssessmentRegistration) => {
    try {
      console.info('[App] Creating assessment registration:', registration.registrationCode);
      const registrationWithOrg = withAutoCompletedAssessmentRegistration({ ...registration, orgId: currentOrgId });
      const savedRegistration = await dataService.createAssessmentRegistration(registrationWithOrg);
      setAssessmentRegistrations(prev => [...prev, withAutoCompletedAssessmentRegistration(savedRegistration)]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ASSESSMENT_REGISTRATION', savedRegistration.id, savedRegistration.registrationCode || savedRegistration.id);
      handleNotify('success', 'Assessment registration created successfully');
    } catch (error) {
      console.error('[App] Error creating assessment registration:', error);
      handleNotify('error', `Failed to create assessment registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleUpdateAssessmentRegistration = async (registration: AssessmentRegistration) => {
    try {
      console.info('[App] Updating assessment registration:', registration.id);
      const existing = assessmentRegistrations.find(r => r.id === registration.id);
      const normalizedRegistration = withAutoCompletedAssessmentRegistration(registration);
      const updatedRegistration = await dataService.updateAssessmentRegistration(registration.id, {
        ...normalizedRegistration,
        updatedAt: new Date().toISOString()
      });
      setAssessmentRegistrations(prev => prev.map(r => r.id === registration.id ? { ...r, ...withAutoCompletedAssessmentRegistration(updatedRegistration) } : r));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ASSESSMENT_REGISTRATION', registration.id, registration.registrationCode, existing, normalizedRegistration);
      handleNotify('success', 'Assessment registration updated successfully');
    } catch (error) {
      console.error('[App] Error updating assessment registration:', error);
      handleNotify('error', `Failed to update assessment registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteAssessmentRegistration = async (id: string): Promise<boolean> => {
    try {
      console.info('[App] Deleting assessment registration:', id);
      const existing = assessmentRegistrations.find(r => r.id === id);
      await dataService.deleteAssessmentRegistration(id);
      setAssessmentRegistrations(prev => prev.filter(r => r.id !== id));

      AuditService.hardDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ASSESSMENT_REGISTRATION', id, existing?.registrationCode);
      handleNotify('success', 'Assessment registration deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting assessment registration:', error);
      handleNotify('error', `Failed to delete assessment registration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  // ===== Invoice CRUD Handlers =====
  const isMissingInvoiceTaxCategory = (value?: string | null) => {
    const normalized = String(value || '').trim();
    return !normalized || normalized.toLowerCase() === 'none';
  };

  const validateInvoiceRequiredFields = (invoiceDraft?: Pick<Invoice, 'notes' | 'lines'> | null) => {
    const missingFields: string[] = [];
    if (!String(invoiceDraft?.notes || '').trim()) {
      missingFields.push('Transaction Description');
    }
    if ((invoiceDraft?.lines || []).some(line => isMissingInvoiceTaxCategory(line.taxCategoryId))) {
      missingFields.push('Tax Category');
    }
    return missingFields;
  };

  const buildInvoiceRequiredFieldMessage = (missingFields: string[]) => {
    if (missingFields.length === 0) return '';
    if (missingFields.length === 2) {
      return 'Transaction Description and Tax Category for every line item are required before saving or approving the invoice.';
    }
    if (missingFields[0] === 'Tax Category') {
      return 'Tax Category must be selected for every line item before saving or approving the invoice.';
    }
    return 'Transaction Description is required before saving or approving the invoice.';
  };

  const isInvoiceAlreadyPosted = (invoice?: Pick<Invoice, 'status' | 'journalEntryId' | 'postedAt' | 'glEntryNumber'> | null) =>
    !!invoice && (
      invoice.status === 'OPEN' ||
      !!invoice.journalEntryId ||
      !!invoice.postedAt ||
      !!String(invoice.glEntryNumber || '').trim()
    );

  const handleAddInvoice = async (invoice: Invoice) => {
    try {
      console.info('[App] Creating invoice:', invoice.invoiceNo);
      const creatorId = invoice.createdBy || currentUser?.id || 'system';
      const createdAt = invoice.createdAt || new Date().toISOString();
      invoice = {
        ...invoice,
        createdBy: creatorId,
        createdAt
      };

      const requiredFieldIssues = validateInvoiceRequiredFields(invoice);
      if (requiredFieldIssues.length > 0) {
        handleNotify('error', buildInvoiceRequiredFieldMessage(requiredFieldIssues));
        return;
      }

      // ── Accounting Posting: trigger if status is OPEN ──────────
      const matchedPostedJournal = invoice.status === 'OPEN' ? findPostedInvoiceJournalEntry(invoice) : null;
      if (invoice.status === 'OPEN' && !invoice.journalEntryId && matchedPostedJournal) {
        const resolvedGlRef = resolveJournalRef(matchedPostedJournal) || invoice.glEntryNumber || generateNextInvoiceGlRef();
        invoice = {
          ...invoice,
          journalEntryId: matchedPostedJournal.id,
          glEntryNumber: resolvedGlRef,
          postedBy: matchedPostedJournal.postedBy || invoice.postedBy || currentUser?.id || 'system',
          postedAt: matchedPostedJournal.postedAt || invoice.postedAt || new Date().toISOString()
        };
      }
      if (invoice.status === 'OPEN' && !invoice.journalEntryId && !matchedPostedJournal) {
        const postingResult = await postInvoiceToGL(invoice);
        if (postingResult) {
          invoice = {
            ...invoice,
            journalEntryId: postingResult.jeId,
            glEntryNumber: postingResult.glRef,
            postedBy: currentUser?.id || 'system',
            postedAt: postingResult.now
          };
        } else {
          // posting failed – don't mark the invoice as open
          invoice.status = 'DRAFT';
          handleNotify('warning', 'Invoice saved as draft because GL posting failed. Please try posting again later.');
        }
      }

      if (invoice.status === 'OPEN') {
        const matchedSavedJournal = matchedPostedJournal || (
          invoice.journalEntryId
            ? journalEntries.find(entry => entry.id === invoice.journalEntryId && entry.orgId === currentOrgId)
            : null
        );
        const journalRef = resolveJournalRef(matchedSavedJournal) || invoice.glEntryNumber;
        ensureStudentLedgerEntryForInvoice(invoice, journalRef, invoice.postedAt);
      }

      const invoiceWithOrg = { ...invoice, orgId: currentOrgId, createdBy: creatorId, createdAt };
      const saved = await dataService.createInvoice(invoiceWithOrg);
      const normalizedSavedInvoice = {
        ...saved,
        createdBy: saved.createdBy || creatorId,
        createdAt: saved.createdAt || createdAt,
        journalEntryId: invoice.journalEntryId || saved.journalEntryId,
        glEntryNumber: invoice.glEntryNumber || saved.glEntryNumber,
        postedBy: invoice.postedBy || saved.postedBy,
        postedAt: invoice.postedAt || saved.postedAt
      };
      setInvoices(prev => [...prev, normalizedSavedInvoice]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'INVOICE', normalizedSavedInvoice.id, invoice.invoiceNo);
      handleNotify('success', `Invoice ${invoice.invoiceNo} created successfully`);
    } catch (error) {
      console.error('[App] Error creating invoice:', error);
      handleNotify('error', 'Failed to create invoice.');
    }
  };

  const resolveReceivableAccount = (
    params: { sponsorId?: string; studentId?: string; preferredAccountId?: string },
    accountsList: ChartOfAccount[] = filteredAccounts
  ) => {
    const coa = accountsList;
    const byName = (patterns: string[]) => coa.find(a => {
      const name = (a.name || '').toLowerCase();
      return patterns.every(p => name.includes(p));
    });

    if (params.preferredAccountId) {
      const preferred = coa.find(a => a.id === params.preferredAccountId);
      if (preferred) return preferred;
    }

    if (params.sponsorId) {
      return (
        coa.find(a => a.code === '11110') ||
        byName(['receivable', 'sponsor']) ||
        byName(['accounts', 'receivable', 'sponsor']) ||
        byName(['accounts', 'receivable']) ||
        coa.find(a => a.code === '1200') ||
        byName(['receivable'])
      );
    }

    if (params.studentId) {
      return (
        coa.find(a => a.code === '11100') ||
        byName(['receivable', 'student']) ||
        byName(['accounts', 'receivable', 'student']) ||
        byName(['accounts', 'receivable']) ||
        coa.find(a => a.code === '1200') ||
        byName(['receivable'])
      );
    }

    return byName(['accounts', 'receivable']) || coa.find(a => a.code === '1200') || byName(['receivable']);
  };

  const postInvoiceToGL = async (invoice: Invoice): Promise<{ jeId: string, glRef: string, now: string } | null> => {
    const now = new Date().toISOString();
    const jeId = crypto.randomUUID();
    const requiredFieldIssues = validateInvoiceRequiredFields(invoice);

    if (requiredFieldIssues.length > 0) {
      handleNotify('error', buildInvoiceRequiredFieldMessage(requiredFieldIssues));
      return null;
    }
    const invoiceTransactionDescription = String(invoice.notes || '').trim();

    // ── Generate sequential AR invoice GL reference number scoped to org ──
    // if the invoice already contains a reference use it, otherwise allocate
    // the next invoice-specific value.

    // ── Find GL accounts ───────────────────────────────────────────────────
    const sponsor = invoice.sponsorId ? sponsors.find(s => s.id === invoice.sponsorId) : null;
    const arAccount = resolveReceivableAccount({
      sponsorId: invoice.sponsorId,
      studentId: invoice.studentId,
      preferredAccountId: (sponsor as any)?.arAccountId
    });
    const arAccountId = arAccount?.id;

    const vatPayableId =
      filteredAccounts.find(a => a.code === '2200')?.id ||
      filteredAccounts.find(a => (a.name || '').toLowerCase().includes('output vat'))?.id ||
      filteredAccounts.find(a => (a.name || '').toLowerCase().includes('vat payable'))?.id ||
      filteredAccounts.find(a => (a.name || '').toLowerCase().includes('output tax'))?.id ||
      filteredAccounts.find(a => (a.name || '').toLowerCase().includes('tax payable'))?.id ||
      filteredAccounts.find(a => (a.name || '').toLowerCase().includes('sales tax'))?.id ||
      filteredAccounts.find(a => /\bvat\b/i.test(a.name || ''))?.id;

    if (!arAccountId) {
      handleNotify('error', 'Cannot post GL: Accounts Receivable account is not configured.');
      return null;
    } else if (invoice.vatAmount > 0 && !vatPayableId) {
      handleNotify('error', 'Cannot post GL: Output VAT account (2200) not found.');
      return null;
    }

    // ── Build journal lines ─────────────────────────────────────────────
    const glRef = (invoice.glEntryNumber || '').trim() || generateNextInvoiceGlRef();
    const jLines: JournalLine[] = [];
    jLines.push({
      id: `${jeId}-ar`,
      orgId: currentOrgId,
      journalEntryId: jeId,
      accountId: arAccountId,
      debit: invoice.grandTotal,
      credit: 0,
      classificationCode: DEFAULT_RECEIVABLE_CLASSIFICATION_CODE,
      description: invoiceTransactionDescription,
      memo: invoiceTransactionDescription,
      contactId: invoice.sponsorId || invoice.studentId || undefined,
      contactType: invoice.sponsorId ? 'SPONSOR' : invoice.studentId ? 'STUDENT' : undefined,
    } as JournalLine);

    const invoiceLines = invoice.lines || [];
    const vatGrouped: Record<string, number> = {};

    invoiceLines.forEach((line, idx) => {
      const revenueAccountId =
        line.glAccountId ||
        filteredAccounts.find(a => a.code === '4000')?.id ||
        filteredAccounts.find(a => (a.name || '').toLowerCase().includes('tuition'))?.id ||
        filteredAccounts.find(a => (a.name || '').toLowerCase().includes('revenue'))?.id ||
        filteredAccounts.find(a => (a.name || '').toLowerCase().includes('income'))?.id;

      const lineType = String((line as any).lineType || (line.courseFeeId ? 'COURSE_FEE' : 'MANUAL')).toUpperCase();
      const numericNetAmount = Number(line.netAmount);
      const numericGrossAmount = Number(line.grossAmount);
      const numericVatAmount = Number(line.vatAmount || 0);
      const numericLineAmount = Number(line.amount || 0);
      const signedNetAmount = Number.isFinite(numericNetAmount)
        ? numericNetAmount
        : Number.isFinite(numericGrossAmount)
          ? numericGrossAmount - numericVatAmount
          : invoice.vatPricing === 'INCLUSIVE'
            ? numericLineAmount - numericVatAmount
            : numericLineAmount;
      const netRevenue = lineType === 'DISCOUNT'
        ? -Math.abs(signedNetAmount || numericLineAmount)
        : signedNetAmount;

      // Group VAT by Account
      if (Math.abs(line.vatAmount || 0) > 0.01) {
        const taxCat = taxCategories.find(tc => tc.id === line.taxCategoryId);
        const vatAccountId = taxCat?.outputAccountId || vatPayableId;
        if (vatAccountId) {
          vatGrouped[vatAccountId] = (vatGrouped[vatAccountId] || 0) + line.vatAmount;
        }
      }

      if (revenueAccountId && netRevenue > 0) {
        jLines.push({
          id: `${jeId}-rev-${idx}`,
          orgId: currentOrgId,
          journalEntryId: jeId,
          accountId: revenueAccountId,
          debit: 0,
          credit: netRevenue,
          description: line.description || `Revenue: ${glRef} Line ${idx + 1}`,
          memo: line.description || `Revenue: ${glRef} Line ${idx + 1}`,
          contactId: invoice.sponsorId || invoice.studentId || undefined,
          contactType: invoice.sponsorId ? 'SPONSOR' : invoice.studentId ? 'STUDENT' : undefined,
          classificationCode: line.classificationCode,
        } as JournalLine);
      } else if (revenueAccountId && netRevenue < 0) {
        jLines.push({
          id: `${jeId}-adj-${idx}`,
          orgId: currentOrgId,
          journalEntryId: jeId,
          accountId: revenueAccountId,
          debit: Math.abs(netRevenue),
          credit: 0,
          description: line.description || `Discount/Adjustment: ${glRef} Line ${idx + 1}`,
          memo: line.description || `Discount/Adjustment: ${glRef} Line ${idx + 1}`,
          contactId: invoice.sponsorId || invoice.studentId || undefined,
          contactType: invoice.sponsorId ? 'SPONSOR' : invoice.studentId ? 'STUDENT' : undefined,
          classificationCode: line.classificationCode,
        } as JournalLine);
      }
    });

    // Add grouped VAT lines
    Object.entries(vatGrouped).forEach(([accountId, amount], idx) => {
      if (Math.abs(amount) > 0.01) {
        jLines.push({
          id: `${jeId}-vat-${idx}`,
          orgId: currentOrgId,
          journalEntryId: jeId,
          accountId: accountId,
          debit: amount < 0 ? Math.abs(amount) : 0,
          credit: amount > 0 ? amount : 0,
          description: `Output VAT: ${glRef} (Invoice: ${invoice.invoiceNo})`,
          memo: `Output VAT: ${glRef} (Invoice: ${invoice.invoiceNo})`,
        } as JournalLine);
      }
    });

    const jeEntry: Partial<JournalEntry> = {
      id: jeId,
      orgId: currentOrgId,
      date: invoice.invoiceDate,
      reference: glRef,
      glEntryNumber: glRef,
      description: invoiceTransactionDescription,
      sourceType: 'INVOICE',
      sourceRef: invoice.id,
      status: 'POSTED',
      createdBy: currentUser?.id || 'system',
      createdAt: now,
    };

    const savedJournalEntry = await handlePostJournal(jeEntry, jLines);
    return {
      jeId: savedJournalEntry?.id || jeId,
      glRef,
      now
    };
  };

  const handleUpdateInvoice = async (invoice: Invoice) => {
    try {
      console.info('[App] Updating invoice:', invoice.id);
      const existing = invoices.find(i => i.id === invoice.id);
      if (isInvoiceAlreadyPosted(existing)) {
        handleNotify('error', 'This invoice is already posted and can no longer be updated.');
        return;
      }
      const existingJournalEntryId = invoice.journalEntryId || existing?.journalEntryId;
      const existingGlEntryNumber = invoice.glEntryNumber || existing?.glEntryNumber;
      invoice = {
        ...invoice,
        createdBy: invoice.createdBy || existing?.createdBy,
        createdAt: invoice.createdAt || existing?.createdAt || new Date().toISOString()
      };

      const requiredFieldIssues = validateInvoiceRequiredFields(invoice);
      if (requiredFieldIssues.length > 0) {
        handleNotify('error', buildInvoiceRequiredFieldMessage(requiredFieldIssues));
        return;
      }

      const transactionDescription = String(invoice.notes || '').trim();
      const matchedPostedJournal = invoice.status === 'OPEN' ? findPostedInvoiceJournalEntry(invoice) : null;
      if (invoice.status === 'OPEN' && !existingJournalEntryId && matchedPostedJournal) {
        const resolvedGlRef = resolveJournalRef(matchedPostedJournal) || invoice.glEntryNumber || existingGlEntryNumber || generateNextInvoiceGlRef();
        invoice = {
          ...invoice,
          journalEntryId: matchedPostedJournal.id,
          glEntryNumber: resolvedGlRef,
          postedBy: matchedPostedJournal.postedBy || invoice.postedBy || currentUser?.id || 'system',
          postedAt: matchedPostedJournal.postedAt || invoice.postedAt || new Date().toISOString()
        };
      }

      // ── Accounting Posting: trigger when status transitions to OPEN ──────────
      const invoiceTransactionDescription = transactionDescription;
      const linkedPostedJournal = matchedPostedJournal || (
        existingJournalEntryId
          ? journalEntries.find(entry => entry.id === existingJournalEntryId && entry.orgId === currentOrgId)
          : null
      );
      if (invoice.status === 'OPEN' && linkedPostedJournal && String(linkedPostedJournal.description || '').trim() !== invoiceTransactionDescription) {
        try {
          const updatedJournal = await dataService.updateJournalEntry(linkedPostedJournal.id, {
            description: invoiceTransactionDescription
          });
          setJournalEntries(prev => prev.map(entry =>
            entry.id === linkedPostedJournal.id
              ? { ...entry, ...(updatedJournal as JournalEntry), description: invoiceTransactionDescription }
              : entry
          ));
        } catch (descriptionError) {
          console.warn('[App] Failed to sync invoice journal description:', descriptionError);
        }
      }
      if (invoice.status === 'OPEN' && linkedPostedJournal) {
        const linkedSponsor = invoice.sponsorId ? sponsors.find(s => s.id === invoice.sponsorId) : null;
        const linkedInvoiceLines = journalLines.filter(line =>
          line.journalEntryId === linkedPostedJournal.id && line.orgId === currentOrgId
        );
        const linkedArLine = resolveInvoiceArJournalLine(
          linkedInvoiceLines,
          {
            sponsorId: invoice.sponsorId,
            studentId: invoice.studentId
          },
          filteredAccounts,
          (linkedSponsor as any)?.arAccountId
        );

        if (linkedArLine && String(linkedArLine.memo || linkedArLine.description || '').trim() !== invoiceTransactionDescription) {
          try {
            const updatedLine = await dataService.updateJournalLine(linkedArLine.id, {
              memo: invoiceTransactionDescription,
              description: invoiceTransactionDescription
            });
            setJournalLines(prev => prev.map(line =>
              line.id === linkedArLine.id
                ? {
                    ...line,
                    ...(updatedLine as JournalLine),
                    memo: invoiceTransactionDescription,
                    description: invoiceTransactionDescription
                  }
                : line
            ));
          } catch (lineSyncError) {
            console.warn('[App] Failed to sync invoice journal line description:', lineSyncError);
          }
        }
      }
      if (invoice.status === 'OPEN' && !existingJournalEntryId && !matchedPostedJournal) {
        const postingResult = await postInvoiceToGL(invoice);
        if (postingResult) {
          const { jeId, glRef, now } = postingResult;
          invoice = {
            ...invoice,
            journalEntryId: jeId,
            glEntryNumber: glRef,
            postedBy: currentUser?.id || 'system',
            postedAt: now
          };

          // ── Subsidiary Ledger entries ───────────────────────────────────────
          // Walk-in student invoice → debit student ledger
          if (invoice.studentId && !invoice.sponsorId) {
            setStudentLedger(prev => [...prev, {
              id: `sl - ${jeId} `,
              orgId: currentOrgId,
              studentId: invoice.studentId!,
              invoiceId: invoice.id,
              date: invoice.invoiceDate,
              description: `Sales Invoice ${invoice.invoiceNo} – ${glRef} `,
              debit: invoice.netAmountDue,
              credit: 0,
              balance: invoice.netAmountDue,
              createdAt: now,
            } as StudentLedger]);
          }

          // Sponsor invoice → distribute across enrolled students in the batch
          if (invoice.sponsorId) {
            const invoiceBatch = invoice.batchId ? batches.find(batch => batch.id === invoice.batchId) : undefined;
            const coveredSource = enrollments.filter(e =>
              !e.isDeleted &&
              (!invoice.batchId || e.batchId === invoice.batchId) &&
              (
                e.sponsorId === invoice.sponsorId ||
                (!!invoiceBatch && getBatchFundingSponsorId(invoiceBatch) === invoice.sponsorId)
              )
            );
            const covered = invoiceBatch
              ? mapBatchBillingRulesToEnrollments(invoiceBatch, coveredSource).filter(e => e.billingType === 'BILLABLE')
              : coveredSource.filter(e => String(e.billingType || 'BILLABLE') === 'BILLABLE');
            const perStudent = covered.length > 0 ? invoice.netAmountDue / covered.length : 0;
            const sponsorName = sponsors.find(s => s.id === invoice.sponsorId)?.name || 'Sponsor';
            const newEntries: StudentLedger[] = covered.map((e, idx) => ({
              id: `sl - ${jeId} -${idx} `,
              orgId: currentOrgId,
              studentId: e.studentId!,
              invoiceId: invoice.id,
              date: invoice.invoiceDate,
              description: `Sponsor - billed(${sponsorName}): Invoice ${invoice.invoiceNo} – ${glRef} `,
              debit: 0,
              credit: perStudent,
              balance: 0,
              sponsorId: invoice.sponsorId,
              createdAt: now,
            } as StudentLedger));
            setStudentLedger(prev => [...prev, ...newEntries]);
          }

          handleNotify('success', `Invoice ${invoice.invoiceNo} approved and posted to GL as ${glRef} `);
        } else {
          // posting failed
          handleNotify('error', 'Unable to post invoice to GL; it remains in draft status.');
          invoice.status = existing?.status || 'DRAFT';
        }
      }

      if (invoice.status === 'OPEN') {
        const matchedSavedJournal = matchedPostedJournal || (
          invoice.journalEntryId
            ? journalEntries.find(entry => entry.id === invoice.journalEntryId && entry.orgId === currentOrgId)
            : null
        );
        const journalRef = resolveJournalRef(matchedSavedJournal) || invoice.glEntryNumber || existingGlEntryNumber;
        ensureStudentLedgerEntryForInvoice(invoice, journalRef, invoice.postedAt);
      }

      // ── Persist the invoice update ──────────────────────────────────────────
      const updated = await dataService.updateInvoice(invoice.id, invoice);
      setInvoices(prev => prev.map(i => i.id === invoice.id ? {
        ...i,
        ...updated,
        journalEntryId: invoice.journalEntryId || updated.journalEntryId || existingJournalEntryId,
        glEntryNumber: invoice.glEntryNumber || updated.glEntryNumber || existingGlEntryNumber,
        updatedAt: new Date().toISOString()
      } : i));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'INVOICE', invoice.id, invoice.invoiceNo, existing, invoice);
      if (invoice.status !== 'OPEN' || existing?.status === 'OPEN') {
        handleNotify('success', `Invoice ${invoice.invoiceNo} updated successfully`);
      }
    } catch (error) {
      console.error('[App] Error updating invoice:', error);
      handleNotify('error', 'Failed to update invoice.');
    }
  };


  const handleDeleteInvoice = async (id: string): Promise<boolean> => {
    try {
      console.info('[App] Deleting invoice:', id);
      const existing = invoices.find(i => i.id === id);
      await dataService.deleteInvoice(id);
      setInvoices(prev => prev.filter(i => i.id !== id));

      AuditService.softDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'INVOICE', id, existing?.invoiceNo);
      handleNotify('success', 'Invoice deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting invoice:', error);
      handleNotify('error', 'Failed to delete invoice.');
      return false;
    }
  };


  const handleVoidInvoice = async (id: string, reason: string) => {
    try {
      const invoice = invoices.find(i => i.id === id);
      if (!invoice) return;

      // 1. Block void if active payment applications
      const activeApplications = payments
        .flatMap(p => p.applications || [])
        .filter(app => app.invoiceId === id && !app.isReversed);
      if (activeApplications.length > 0) {
        handleNotify('error', 'Cannot void invoice: active payment applications exist. Reverse all applications first.');
        return;
      }

      // 2. Create GL_Journal reversal entry (VOID)
      // Find original journal entry for this invoice
      const origJournal = journalEntries.find(j => j.sourceType === 'INVOICE' && j.sourceRef === id && j.status === 'POSTED');
      if (origJournal) {
        // Reverse all lines: swap debit/credit
        const origLines = journalLines.filter(l => l.journalEntryId === origJournal.id);
        const reversedLines = origLines.map(l => ({
          ...l,
          id: `${l.id} -VOID`,
          journalEntryId: `${origJournal.id} -VOID`,
          debit: l.credit,
          credit: l.debit,
          createdAt: new Date().toISOString(),
          updatedAt: undefined
        }));
        const voidJournal: JournalEntry = {
          ...origJournal,
          id: `${origJournal.id} -VOID`,
          status: 'POSTED',
          sourceType: 'VOID',
          reference: `${origJournal.reference} -VOID`,
          description: `[VOID] ${origJournal.description} `,
          createdAt: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          postedBy: currentUser?.id || 'system',
          sourceRef: id,
          isDeleted: false
        };
        setJournalEntries(prev => [...prev, voidJournal]);
        setJournalLines(prev => [...prev, ...reversedLines]);
        AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'JOURNAL_ENTRY', voidJournal.id, voidJournal.reference);
      }

      // 3. Reset enrollment.billingStatus to 'UNBILLED' if linked
      if (invoice.enrollmentId) {
        const enrollment = enrollments.find(e => e.id === invoice.enrollmentId);
        if (enrollment && enrollment.billingStatus !== 'UNBILLED') {
          const updatedEnrollment = { ...enrollment, billingStatus: 'UNBILLED', updatedAt: new Date().toISOString() };
          setEnrollments(prev => prev.map(e => e.id === enrollment.id ? updatedEnrollment : e));
          AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ENROLLMENT', enrollment.id, enrollment.enrollmentCode, enrollment, updatedEnrollment);
        }
      }

      // 4. Mark invoice as voided in database
      await dataService.voidInvoice(id, currentUser?.id || 'system', reason);

      const voidedInvoice = {
        ...invoice,
        status: 'VOIDED' as const,
        voidedAt: new Date().toISOString(),
        voidedBy: currentUser?.id,
        voidReason: reason
      };
      setInvoices(prev => prev.map(i => i.id === id ? voidedInvoice : i));
      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'INVOICE', id, invoice.invoiceNo, invoice, voidedInvoice);
      handleNotify('success', `Invoice ${invoice.invoiceNo} voided`);
    } catch (error) {
      console.error('[App] Error voiding invoice:', error);
      handleNotify('error', 'Failed to void invoice.');
    }
  };

  // ===== Payment CRUD Handlers =====
  type PaymentWithSource = Payment & { sourceInvoiceId?: string };

  const resolvePaymentPostingAccounts = (payment: Payment) => {
    const coa = accounts.filter(a => a.orgId === currentOrgId);
    const byName = (patterns: string[]) => coa.find(a => {
      const name = (a.name || '').toLowerCase();
      return patterns.every(p => name.includes(p));
    });
    const byCode = (codes: string[]) => coa.find(a => codes.includes(a.code || ''));
    const byId = (id?: string) => (id ? coa.find(a => a.id === id) : undefined);

    const selectedBank = bankAccounts.find(b => b.id === payment.bankAccountId && b.orgId === currentOrgId);
    const bankLinkedAccount = selectedBank?.glAccountId
      ? coa.find(a => a.id === selectedBank.glAccountId) || coa.find(a => a.code === selectedBank.glAccountId)
      : undefined;

    const cashAccount = bankLinkedAccount ||
      byId(payment.bankAccountId) ||
      byName(['undeposited']) ||
      byName(['cash', 'hand']) ||
      byName(['cash']) ||
      byName(['bank']) ||
      byCode(['1000', '1010']);

    const customerDepositsAccount =
      byName(['customer', 'deposit']) ||
      byName(['advance', 'customer']) ||
      byName(['unearned', 'revenue']) ||
      coa.find(a => a.code === '2000');

    const ewtReceivableAccount =
      byName(['creditable', 'withholding', 'tax']) ||
      byName(['cwt', '2307']) ||
      byName(['ewt', 'receivable']) ||
      byName(['withholding', 'receivable']) ||
      coa.find(a => a.code === '14001') ||
      coa.find(a => a.code === '14200');

    return { cashAccount, customerDepositsAccount, ewtReceivableAccount };
  };

  const resolveArAccountForInvoice = (payment: Payment, invoice: Invoice) => {
    const coa = accounts.filter(a => a.orgId === currentOrgId);
    const arFromInvoiceJournal = (() => {
      const postedInvoiceEntry = invoice.journalEntryId
        ? journalEntries.find(
          je => je.id === invoice.journalEntryId && je.orgId === currentOrgId && je.status === 'POSTED'
        )
        : journalEntries.find(
          je =>
            je.orgId === currentOrgId &&
            je.status === 'POSTED' &&
            je.sourceType === 'INVOICE' &&
            je.sourceRef === invoice.id
        );
      const invoiceEntry = postedInvoiceEntry || journalEntries.find(
        je =>
          je.orgId === currentOrgId &&
          je.status === 'POSTED' &&
          je.sourceType === 'INVOICE' &&
          !!invoice.glEntryNumber &&
          (je.glEntryNumber === invoice.glEntryNumber || je.reference === invoice.glEntryNumber)
      );
      if (!invoiceEntry) return undefined;

      const invoiceLines = journalLines.filter(
        l => l.journalEntryId === invoiceEntry.id && l.orgId === currentOrgId
      );
      if (!invoiceLines.length) return undefined;

      const debitLines = invoiceLines.filter(l => (l.debit || 0) > 0);
      if (!debitLines.length) return undefined;

      // Use the primary debit line from the posted invoice to guarantee consistency
      // between invoice posting and payment-application credit.
      const primaryDebitLine = debitLines.sort((a, b) => (b.debit || 0) - (a.debit || 0))[0];
      return primaryDebitLine ? coa.find(a => a.id === primaryDebitLine.accountId) : undefined;
    })();

    if (arFromInvoiceJournal) return arFromInvoiceJournal;

    const sponsor = (invoice.sponsorId || payment.sponsorId)
      ? sponsors.find(s => s.id === (invoice.sponsorId || payment.sponsorId))
      : null;

    return resolveReceivableAccount({
      sponsorId: invoice.sponsorId || payment.sponsorId,
      studentId: invoice.studentId || payment.studentId,
      preferredAccountId: (sponsor as any)?.arAccountId
    });
  };

  const getNextPaymentNo = () => {
    const year = new Date().getFullYear();
    // Filter payments by: current org, current year, NOT deleted
    const existingNums = payments
      .filter(p => 
        p.orgId === currentOrgId && 
        !p.isDeleted && 
        p.paymentNo?.startsWith(`PAY-${year}-`)
      )
      .map(p => {
        const parts = p.paymentNo.split('-');
        const n = parseInt(parts[2] || '0', 10);
        return Number.isFinite(n) ? n : 0;
      })
      .filter(n => n > 0);
    
    const existingSet = new Set(existingNums);
    let next = existingNums.length ? Math.max(...existingNums) + 1 : 1;
    
    // Ensure no duplicates in the set
    while (existingSet.has(next)) {
      next += 1;
    }
    
    return `PAY-${year}-${String(next).padStart(5, '0')}`;
  };

  const getConflictingInvoiceLinkedPayment = (sourceInvoiceId?: string, excludePaymentId?: string) => {
    const normalizedInvoiceId = String(sourceInvoiceId || '').trim();
    if (!normalizedInvoiceId) return undefined;

    return payments.find(existingPayment =>
      existingPayment.orgId === currentOrgId &&
      existingPayment.id !== excludePaymentId &&
      !existingPayment.isDeleted &&
      existingPayment.status !== 'VOIDED' &&
      String(existingPayment.sourceInvoiceId || '').trim() === normalizedInvoiceId
    );
  };

  const formatPaymentWorkflowStatus = (status?: Payment['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'OPEN':
      case 'POSTED':
      case 'CLOSED':
        return 'Approved';
      case 'VOIDED':
        return 'Voided';
      default:
        return 'Saved';
    }
  };

  const validatePaymentInvoiceLink = (payment?: PaymentWithSource, excludePaymentId?: string): string => {
    const sourceInvoiceId = String(payment?.sourceInvoiceId || '').trim();
    if (!sourceInvoiceId) {
      return 'Invoice No. is required before saving or approving payment.';
    }

    const sourceInvoice = invoices.find(invoice =>
      invoice.id === sourceInvoiceId &&
      invoice.orgId === currentOrgId &&
      !invoice.isDeleted
    );

    if (!sourceInvoice) {
      return 'Selected invoice could not be found for this organization.';
    }

    if (sourceInvoice.status === 'VOIDED') {
      return `Invoice ${sourceInvoice.invoiceNo} has been voided and cannot be tagged to a payment.`;
    }

    const payorMatches = (
      (sourceInvoice.sponsorId || '') === (payment?.sponsorId || '') &&
      (sourceInvoice.studentId || '') === (payment?.studentId || '')
    );
    if (!payorMatches) {
      return `Invoice ${sourceInvoice.invoiceNo} is linked to a different payor. Select the matching sponsor or student before saving this payment.`;
    }

    const conflictingPayment = getConflictingInvoiceLinkedPayment(sourceInvoiceId, excludePaymentId ?? payment?.id);
    if (conflictingPayment) {
      return `A payment already exists for invoice ${sourceInvoice.invoiceNo} (${conflictingPayment.paymentNo}, ${formatPaymentWorkflowStatus(conflictingPayment.status)}). Review, edit, or complete the existing payment instead of creating a new one.`;
    }

    return '';
  };

  const handleAddPayment = async (payment: PaymentWithSource) => {
    try {
      console.info('[App] Creating payment:', payment.paymentNo);
      
      // CRITICAL: Validate that payment.orgId matches current org
      // This prevents any cross-org data pollution
      if (!payment.orgId || payment.orgId !== currentOrgId) {
        console.error('[App] Payment orgId mismatch:', { 
          paymentOrgId: payment.orgId, 
          currentOrgId,
          match: payment.orgId === currentOrgId
        });
        handleNotify('error', 'Cannot create payment for another organization.');
        return;
      }

      const paymentToCreate: PaymentWithSource = {
        ...payment,
        // orgId is already set by PaymentsView - do not override
        createdBy: payment.createdBy || currentUser?.id || 'system',
        updatedAt: new Date().toISOString()
        // Note: paymentNo will be server-generated atomically by payments-write edge function
      };

      const invoiceLinkError = validatePaymentInvoiceLink(paymentToCreate);
      if (invoiceLinkError) {
        handleNotify('error', invoiceLinkError);
        return;
      }

      if (paymentToCreate.status === 'DRAFT' || paymentToCreate.status === 'OPEN') {
        const requiredFieldsError = validatePaymentRequiredFields(paymentToCreate);
        if (requiredFieldsError) {
          handleNotify('error', requiredFieldsError);
          return;
        }
      }

      const paymentToSave = paymentToCreate;
      console.debug('[App] Payment object before save:', paymentToSave);
      const savedPayment = await dataService.createEntity('payments', paymentToSave);
      const persistedPayment = {
        ...paymentToSave,
        ...(savedPayment as PaymentWithSource),
        crNo: (savedPayment as Payment)?.crNo ?? paymentToSave.crNo,
        sourceInvoiceId: (savedPayment as PaymentWithSource)?.sourceInvoiceId ?? paymentToSave.sourceInvoiceId
      } as PaymentWithSource;
      setPayments(prev => [...prev, persistedPayment]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', persistedPayment.id, persistedPayment.paymentNo);

      // If this payment is meant to be posted immediately, post the record we just inserted.
      // This avoids a second create call while the initial insert is still settling.
      if (paymentToCreate.status === 'OPEN') {
        await handlePostPayment(persistedPayment, { useExistingRecord: true });
        return;
      }

      handleNotify('success', `Payment ${persistedPayment.paymentNo} created successfully`);
    } catch (error) {
      console.error('[App] Error creating payment:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      handleNotify('error', `Failed to create payment: ${errorMsg}`);
    }
  };

  const handleUpdatePayment = async (payment: PaymentWithSource) => {
    try {
      console.info('[App] Updating payment:', payment.id);
      const existing = payments.find(p => p.id === payment.id);
      if (!existing) {
        handleNotify('error', 'Payment not found.');
        return;
      }
      if (existing.orgId !== currentOrgId) {
        handleNotify('error', 'Cross-organization payment update is not allowed.');
        return;
      }
      if (existing.status === 'DRAFT') {
        const requiredFieldsError = validatePaymentRequiredFields(payment);
        if (requiredFieldsError) {
          handleNotify('error', requiredFieldsError);
          return;
        }
      }

      const updates: PaymentWithSource = {
        ...payment,
        orgId: currentOrgId,
        sourceInvoiceId: payment.sourceInvoiceId ?? (existing as PaymentWithSource).sourceInvoiceId,
        updatedAt: new Date().toISOString()
      };
      const invoiceLinkError = validatePaymentInvoiceLink(updates, existing.id);
      if (invoiceLinkError) {
        handleNotify('error', invoiceLinkError);
        return;
      }
      const savedPayment = await dataService.updateEntity('payments', payment.id, updates);
      const persistedPayment = {
        ...existing,
        ...updates,
        ...(savedPayment as PaymentWithSource),
        crNo: (savedPayment as Payment)?.crNo ?? updates.crNo ?? existing.crNo,
        sourceInvoiceId: (savedPayment as PaymentWithSource)?.sourceInvoiceId ?? updates.sourceInvoiceId
      } as PaymentWithSource;
      setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, ...persistedPayment } : p));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', payment.id, payment.paymentNo, existing, payment);
      handleNotify('success', `Payment ${payment.paymentNo} updated successfully`);
    } catch (error) {
      console.error('[App] Error updating payment:', error);
      handleNotify('error', 'Failed to update payment.');
    }
  };

  type PostPaymentOptions = {
    useExistingRecord?: boolean;
  };

  const resolvePaymentTransactionDescription = (payment?: Pick<Payment, 'paymentNo' | 'notes'> | null): string => {
    const note = String(payment?.notes || '').trim();
    if (note) return note;
    return payment ? `Payment ${payment.paymentNo}` : '';
  };

  const validatePaymentRequiredFields = (payment?: Pick<PaymentWithSource, 'crNo' | 'notes' | 'sourceInvoiceId'> | null): string => {
    const missingFields: string[] = [];
    if (!String(payment?.sourceInvoiceId || '').trim()) missingFields.push('Invoice No.');
    if (!String(payment?.notes || '').trim()) missingFields.push('Transaction Description');
    if (!String(payment?.crNo || '').trim()) missingFields.push('C.R. No.');

    if (missingFields.length === 0) return '';
    if (missingFields.length === 1) {
      return `${missingFields[0]} is required before saving or approving payment.`;
    }
    return `${missingFields.join(' and ')} are required before saving or approving payment.`;
  };

  const handlePostPayment = async (payment: PaymentWithSource, options: PostPaymentOptions = {}) => {
    try {
      const existing = options.useExistingRecord ? payment : payments.find(p => p.id === payment.id);
      const postingTs = new Date().toISOString();
      const paymentToApprove: PaymentWithSource = {
        ...payment,
        orgId: payment.orgId || currentOrgId,
        sourceInvoiceId: payment.sourceInvoiceId,
        status: 'OPEN',
        postedAt: payment.postedAt || postingTs,
        postedBy: payment.postedBy || currentUser?.id || 'system',
        updatedAt: postingTs
      };
      const paymentToApproveRecord = paymentToApprove;
      const paymentRequiredFieldsError = validatePaymentRequiredFields(paymentToApproveRecord);
      if (paymentRequiredFieldsError) {
        handleNotify('error', paymentRequiredFieldsError);
        return;
      }
      const invoiceLinkError = validatePaymentInvoiceLink(paymentToApproveRecord, paymentToApprove.id);
      if (invoiceLinkError) {
        handleNotify('error', invoiceLinkError);
        return;
      }
      const paymentTransactionDescription = resolvePaymentTransactionDescription(paymentToApproveRecord);
      if (paymentToApprove.orgId !== currentOrgId || (existing && existing.orgId !== currentOrgId)) {
        handleNotify('error', 'Cross-organization payment approval is not allowed.');
        return;
      }

      // Skip GL if already posted before and linked.
      if (existing?.journalEntryId) {
        const savedPayment = await dataService.updateEntity('payments', paymentToApprove.id, paymentToApproveRecord);
        const persistedPayment = {
          ...paymentToApproveRecord,
          ...(savedPayment as PaymentWithSource),
          crNo: (savedPayment as Payment)?.crNo ?? paymentToApproveRecord.crNo,
          sourceInvoiceId: (savedPayment as PaymentWithSource)?.sourceInvoiceId ?? paymentToApproveRecord.sourceInvoiceId
        } as PaymentWithSource;
        if (existing) {
          setPayments(prev => prev.map(p => p.id === paymentToApprove.id ? { ...p, ...persistedPayment } : p));
        } else {
          setPayments(prev => [...prev, persistedPayment]);
        }
        AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', paymentToApprove.id, paymentToApprove.paymentNo, existing, paymentToApproveRecord);
        handleNotify('success', `Payment ${paymentToApprove.paymentNo} approved successfully`);
        return;
      }

      const { cashAccount, customerDepositsAccount, ewtReceivableAccount } = resolvePaymentPostingAccounts(paymentToApprove);
      const amountReceived = Number(paymentToApprove.amountReceived ?? 0) || 0;
      const ewtAmount = Number(paymentToApprove.ewtAmountCertified ?? 0) || 0;

      if (!cashAccount) {
        handleNotify('error', 'Cannot approve payment: cash/bank GL account not found.');
        return;
      }
      if (!customerDepositsAccount) {
        handleNotify('error', 'Cannot approve payment: Customer Deposits account is not configured.');
        return;
      }
      if (ewtAmount > 0 && !ewtReceivableAccount) {
        handleNotify('error', 'Cannot approve payment: Creditable Withholding Tax (CWT 2307) account is not configured (required when EWT Amount > 0).');
        return;
      }

      const totalCredit = amountReceived + ewtAmount;
      const paymentGlRef = (paymentToApproveRecord.glEntryNumber || '').trim() || generateNextGlRef();
      const paymentEntry: Partial<JournalEntry> = {
        orgId: currentOrgId,
        periodId: '',
        date: paymentToApproveRecord.paymentDate,
        description: paymentTransactionDescription,
        reference: paymentGlRef,
        glEntryNumber: paymentGlRef,
        status: 'POSTED',
        sourceType: 'PAYMENT',
        sourceRef: paymentToApprove.id,
        createdBy: currentUser?.id || 'system',
        createdAt: postingTs
      };

      const paymentLines: JournalLine[] = [
        {
          id: `jl-${Date.now()}-1`,
          journalEntryId: '',
          orgId: currentOrgId,
          accountId: cashAccount.id,
          debit: amountReceived,
          credit: 0,
          description: paymentTransactionDescription,
          memo: paymentTransactionDescription,
          classificationCode: DEFAULT_RECEIVABLE_CLASSIFICATION_CODE
        },
        ...(ewtAmount > 0 && ewtReceivableAccount ? [{
          id: `jl-${Date.now()}-2`,
          journalEntryId: '',
          orgId: currentOrgId,
          accountId: ewtReceivableAccount.id,
          debit: ewtAmount,
          credit: 0,
          description: `Creditable Withholding Tax (CWT 2307) for ${paymentToApproveRecord.paymentNo}`,
          memo: `Creditable Withholding Tax (CWT 2307) for ${paymentToApproveRecord.paymentNo}`
        }] : []),
        {
          id: `jl-${Date.now()}-3`,
          journalEntryId: '',
          orgId: currentOrgId,
          accountId: customerDepositsAccount.id,
          debit: 0,
          credit: totalCredit,
          description: paymentTransactionDescription,
          memo: paymentTransactionDescription,
          classificationCode: DEFAULT_RECEIVABLE_CLASSIFICATION_CODE
        }
      ];

      const savedEntry = await handlePostJournal(paymentEntry, paymentLines);
      if (!savedEntry) {
        handleNotify('error', `Payment ${paymentToApprove.paymentNo} approval failed because GL posting was not saved.`);
        return;
      }

      const finalizedPayment = {
        ...paymentToApproveRecord,
        journalEntryId: savedEntry.id,
        glEntryNumber: savedEntry.glEntryNumber || generateNextGlRef(),
        postedBy: currentUser?.id || 'system',
        postedAt: postingTs,
        updatedAt: new Date().toISOString()
      };
      const savedPayment = existing
        ? await dataService.updateEntity('payments', finalizedPayment.id, finalizedPayment)
        : await dataService.createEntity('payments', finalizedPayment);
      const persistedPayment = {
        ...finalizedPayment,
        ...(savedPayment as PaymentWithSource),
        crNo: (savedPayment as Payment)?.crNo ?? finalizedPayment.crNo,
        sourceInvoiceId: (savedPayment as PaymentWithSource)?.sourceInvoiceId ?? finalizedPayment.sourceInvoiceId
      } as PaymentWithSource;
      if (existing) {
        setPayments(prev => prev.map(p => p.id === finalizedPayment.id ? { ...finalizedPayment, ...persistedPayment } : p));
      } else {
        setPayments(prev => [...prev, persistedPayment]);
      }

      if (existing) {
        AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', finalizedPayment.id, finalizedPayment.paymentNo, existing, finalizedPayment);
      } else {
        AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', finalizedPayment.id, finalizedPayment.paymentNo);
      }
      handleNotify('success', `Payment ${finalizedPayment.paymentNo} approved successfully`);
    } catch (error) {
      console.error('[App] Error posting payment:', error);
      handleNotify('error', 'Failed to approve payment.');
    }
  };

  const handleDeletePayment = async (id: string): Promise<boolean> => {
    try {
      console.info('[App] Deleting payment:', id);
      const existing = payments.find(p => p.id === id);
      if (!existing) return false;
      if (existing.orgId !== currentOrgId) {
        handleNotify('error', 'Cross-organization payment delete is not allowed.');
        return false;
      }
      await dataService.archiveEntity('payments', id, currentUser?.id || 'system');
      setPayments(prev => prev.map(p => p.id === id ? { ...p, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id } : p));

      AuditService.softDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', id, existing?.paymentNo);
      handleNotify('success', 'Payment deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting payment:', error);
      handleNotify('error', 'Failed to delete payment.');
      return false;
    }
  };

  const handleVoidPayment = async (id: string, reason: string) => {
    try {
      const payment = payments.find(p => p.id === id);
      if (payment) {
        if (payment.orgId !== currentOrgId) {
          handleNotify('error', 'Cross-organization payment void is not allowed.');
          return;
        }
        const voidedPayment = {
          ...payment,
          status: 'VOIDED' as const,
          voidedAt: new Date().toISOString(),
          voidedBy: currentUser?.id,
          voidReason: reason
        };
        await dataService.updateEntity('payments', id, voidedPayment);
        setPayments(prev => prev.map(p => p.id === id ? voidedPayment : p));
        AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PAYMENT', id, payment.paymentNo, payment, voidedPayment);
        handleNotify('success', `Payment ${payment.paymentNo} voided`);
      }
    } catch (error) {
      console.error('[App] Error voiding payment:', error);
      handleNotify('error', 'Failed to void payment.');
    }
  };

  // ===== Payment Application Handler (APPL) =====
  const handleApplyToInvoice = async (
    paymentId: string,
    invoiceId: string,
    amount: number,
    paymentOverride?: PaymentWithSource
  ) => {
    const payment = paymentOverride || payments.find(p => p.id === paymentId);
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!payment || !invoice) return;
    if (payment.orgId !== currentOrgId || invoice.orgId !== currentOrgId) {
      handleNotify('error', 'Cross-organization payment application is not allowed.');
      return;
    }
    if (amount <= 0) {
      handleNotify('error', 'Apply amount must be greater than zero.');
      return;
    }
    if (!isFinalizedPaymentStatus(payment.status)) {
      handleNotify('error', 'Only posted or finalized payments can be applied to invoices.');
      return;
    }
    const applicationValidation = BillingComputationService.validatePaymentApplication(payment, amount);
    const availablePaymentBalance = applicationValidation.availableBalance;
    if (!applicationValidation.isValid) {
      handleNotify('error', 'Apply amount exceeds the remaining unapplied balance of this payment.');
      return;
    }
    const applyKey = `${paymentId}:${invoiceId}`;
    if (applyingPaymentKeysRef.current.has(applyKey)) {
      return;
    }
    const existingActiveApplication = (payment.applications || []).find(app => app.invoiceId === invoiceId && !app.isReversed);
    if (existingActiveApplication) {
      handleNotify('info', `Invoice ${invoice.invoiceNo} already has an active payment application.`);
      return;
    }
    applyingPaymentKeysRef.current.add(applyKey);

    try {
      // 1. Resolve GL accounts with org-aware dynamic mapping.
      const { customerDepositsAccount } = resolvePaymentPostingAccounts(payment);
      const arAcct = resolveArAccountForInvoice(payment, invoice);
      const depositsAcct = customerDepositsAccount;
      if (!depositsAcct || !arAcct) {
        handleNotify('error', 'Cannot apply payment: required deposit/AR GL accounts are not configured.');
        return;
      }

      const applicationId = generateUUID();
      const applicationTs = new Date().toISOString();
      const generatedApplicationNo = generateNextPaymentApplicationNo(currentOrgId, applicationTs);

      // Persist application first to avoid duplicate GL posting on retries.
      const newApplication = {
        id: applicationId,
        orgId: currentOrgId,
        paymentId,
        invoiceId,
        applicationNo: generatedApplicationNo,
        amountApplied: amount,
        description: `Payment application for invoice ${invoice.invoiceNo}`,
        isReversed: false,
        createdBy: currentUser?.id || 'system',
        createdAt: applicationTs,
        updatedAt: applicationTs
      };
      const savedApplication = await dataService.createEntity('payment_applications', newApplication) as PaymentApplication;
      const applicationNo = String(savedApplication.applicationNo || generatedApplicationNo).trim() || generatedApplicationNo;
      const applicationJournalDetail = applicationNo;
      const applicationDescription = `Payment application for invoice ${invoice.invoiceNo}`;

      // Reuse an existing GL entry for this application id if present (idempotent)
      let savedApplicationEntry = journalEntries.find(
        je => je.sourceType === 'APPLICATION' && je.sourceRef === savedApplication.id && je.status === 'POSTED'
      );
      if (!savedApplicationEntry) {
        const applEntry: Partial<JournalEntry> = {
          orgId: currentOrgId,
          periodId: invoice.periodId || '',
          date: new Date().toISOString().split('T')[0],
          reference: applicationJournalDetail,
          description: applicationDescription,
          status: 'POSTED',
          sourceType: 'APPLICATION',
          sourceRef: savedApplication.id,
          createdBy: currentUser?.id,
          createdAt: applicationTs
        };
        const applLines: JournalLine[] = [
          {
            id: `jl-${Date.now()}-1`,
            journalEntryId: '',
            orgId: currentOrgId,
            accountId: depositsAcct.id,
            debit: amount,
            credit: 0,
            description: applicationJournalDetail,
            memo: applicationJournalDetail
          },
          {
            id: `jl-${Date.now()}-2`,
            journalEntryId: '',
            orgId: currentOrgId,
            accountId: arAcct.id,
            debit: 0,
            credit: amount,
            description: applicationJournalDetail,
            memo: applicationJournalDetail
          }
        ];
        const posted = await handlePostJournal(applEntry, applLines);
        if (!posted) {
          handleNotify('error', `Payment application to ${invoice.invoiceNo} saved, but GL posting failed.`);
          return;
        }
        savedApplicationEntry = posted;
      }

      if (
        savedApplicationEntry &&
        (
          String(savedApplicationEntry.reference || '').trim() !== applicationJournalDetail ||
          String(savedApplicationEntry.description || '').trim() !== applicationDescription
        )
      ) {
        try {
          const alignedApplicationEntry = await dataService.updateJournalEntry(savedApplicationEntry.id, {
            reference: applicationJournalDetail,
            description: applicationDescription
          });
          savedApplicationEntry = {
            ...savedApplicationEntry,
            ...alignedApplicationEntry
          };
        } catch (journalAlignErr) {
          console.warn('[App] Payment application journal reference/details alignment skipped:', journalAlignErr);
        }
      }

      // Best-effort linkage update (auto-stripped if columns are missing in DB schema)
      const applicationUpdatedAt = new Date().toISOString();
      try {
        await dataService.updateEntity('payment_applications', savedApplication.id, {
          glReference: savedApplicationEntry.glEntryNumber || savedApplicationEntry.reference,
          journalEntryId: savedApplicationEntry.id,
          updatedAt: applicationUpdatedAt
        });
      } catch (linkErr) {
        console.warn('[App] Payment application GL linkage update skipped due schema mismatch:', linkErr);
      }

      const persistedApplication: PaymentApplication = {
        ...savedApplication,
        orgId: currentOrgId,
        applicationNo,
        glReference: savedApplicationEntry.glEntryNumber || savedApplicationEntry.reference,
        journalEntryId: savedApplicationEntry.id,
        updatedAt: applicationUpdatedAt
      };

      // 2. Persist Payment application totals.
      const existingPaymentApplications = payment.applications || [];
      const nextPaymentApplications = [...existingPaymentApplications, persistedApplication];
      const nextTotalApplied = (payment.totalApplied || 0) + amount;
      const isSingleInvoiceReceipt =
        String((payment as PaymentWithSource).sourceInvoiceId || '').trim() === invoiceId &&
        nextPaymentApplications
          .filter(app => !app.isReversed)
          .every(app => app.invoiceId === invoiceId);
      const shouldReconcileReceiptAmountToApplication =
        isSingleInvoiceReceipt &&
        getPaymentTotalCredit(payment) > nextTotalApplied + 0.01;
      const reconciledAmountReceived = shouldReconcileReceiptAmountToApplication
        ? Math.max(nextTotalApplied - Number(payment.ewtAmountCertified || 0), 0)
        : Number(payment.amountReceived || 0);
      const reconciledDepositBalance = shouldReconcileReceiptAmountToApplication
        ? 0
        : applicationValidation.projectedBalance;
      const updatedPayment = {
        ...payment,
        amountReceived: reconciledAmountReceived,
        applications: nextPaymentApplications,
        totalApplied: nextTotalApplied,
        customerDepositBalance: reconciledDepositBalance,
        status: resolveAppliedPaymentStatus(
          { ...payment, amountReceived: reconciledAmountReceived },
          nextTotalApplied,
          reconciledDepositBalance
        ),
        updatedAt: new Date().toISOString()
      };
      const persistedPaymentStatus = getPersistablePaymentStatus(updatedPayment.status);
      await dataService.updateEntity('payments', paymentId, {
        amountReceived: updatedPayment.amountReceived,
        totalApplied: updatedPayment.totalApplied,
        customerDepositBalance: updatedPayment.customerDepositBalance,
        status: persistedPaymentStatus,
        updatedAt: updatedPayment.updatedAt
      });

      if (shouldReconcileReceiptAmountToApplication && payment.journalEntryId) {
        const paymentEntryLines = journalLines.filter(line => line.journalEntryId === payment.journalEntryId);
        const previousAmountReceived = Number(payment.amountReceived || 0);
        const previousTotalCredit = previousAmountReceived + Number(payment.ewtAmountCertified || 0);
        const reconciledTotalCredit = reconciledAmountReceived + Number(payment.ewtAmountCertified || 0);
        const cashLine = paymentEntryLines.find(line =>
          Math.abs(Number(line.debit || 0) - previousAmountReceived) < 0.001 &&
          Number(line.credit || 0) === 0
        );
        const depositsLine = paymentEntryLines.find(line =>
          Math.abs(Number(line.credit || 0) - previousTotalCredit) < 0.001
        );
        const lineUpdates: Promise<JournalLine>[] = [];

        if (cashLine && Math.abs(Number(cashLine.debit || 0) - reconciledAmountReceived) > 0.001) {
          lineUpdates.push(dataService.updateJournalLine(cashLine.id, { debit: reconciledAmountReceived }));
        }
        if (depositsLine && Math.abs(Number(depositsLine.credit || 0) - reconciledTotalCredit) > 0.001) {
          lineUpdates.push(dataService.updateJournalLine(depositsLine.id, { credit: reconciledTotalCredit }));
        }
        if (lineUpdates.length > 0) {
          const updatedLines = await Promise.all(lineUpdates);
          setJournalLines(prev => prev.map(line => {
            const updatedLine = updatedLines.find(item => item.id === line.id);
            return updatedLine ? { ...line, ...updatedLine } : line;
          }));
        }
      }

      setPayments(prev => prev.map(p => p.id === paymentId ? updatedPayment : p));

      // 3. Persist Invoice balance/status update.
      const newAmountPaid = (invoice.amountPaid || 0) + amount;
      const newBalanceDue = Math.max((invoice.balanceDue || 0) - amount, 0);
      const newStatus = resolvePaidInvoiceStatus(invoice, newBalanceDue);
      const updatedInvoice = await dataService.updateInvoice(invoiceId, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, ...(updatedInvoice as Invoice) } : i));

      handleNotify('success', `Applied ${invoice.invoiceNo} via ${applicationNo}. GL Ref: ${savedApplicationEntry.glEntryNumber || savedApplicationEntry.reference}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('idx_unique_active_application') || msg.includes('duplicate key value')) {
        handleNotify('info', `Invoice ${invoice.invoiceNo} already has an active application for this payment.`);
        return;
      }
      console.error('[App] Error applying payment to invoice:', error);
      handleNotify('error', `Failed to apply payment to ${invoice.invoiceNo}.`);
    } finally {
      applyingPaymentKeysRef.current.delete(applyKey);
    }
  };

  // ===== Payment Application Reversal Handler (RVRS) =====
  const handleReverseApplication = async (paymentId: string, applicationId: string, reason: string) => {
    // 1. Update Payment Application State
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;
    if (payment.orgId !== currentOrgId) {
      handleNotify('error', 'Cross-organization reversal is not allowed.');
      return;
    }
    const application = (payment.applications || []).find(app => app.id === applicationId);
    if (!application) return;
    const invoice = invoices.find(i => i.id === application.invoiceId);
    if (!invoice) return;
    if (invoice.orgId !== currentOrgId) {
      handleNotify('error', 'Cross-organization reversal is not allowed.');
      return;
    }

    // Mark application as reversed
    const updatedApplications = (payment.applications || []).map(app =>
      app.id === applicationId
        ? { ...app, isReversed: true, reversalReason: reason, reversedAt: new Date().toISOString() }
        : app
    );
    const reversedAmount = application.amountApplied;
    const updatedPayment = {
      ...payment,
      applications: updatedApplications,
      totalApplied: (payment.totalApplied || 0) - reversedAmount,
      customerDepositBalance: getPaymentAvailableBalance(payment) + reversedAmount,
      status: resolveAppliedPaymentStatus(
        payment,
        (payment.totalApplied || 0) - reversedAmount,
        getPaymentAvailableBalance(payment) + reversedAmount
      ),
      updatedAt: new Date().toISOString()
    };
    const persistedPaymentStatus = getPersistablePaymentStatus(updatedPayment.status);
    await dataService.updateEntity('payment_applications', applicationId, {
      isReversed: true,
      reversalReason: reason,
      reversedAt: new Date().toISOString(),
      reversedBy: currentUser?.id || 'system',
      updatedAt: new Date().toISOString()
    });
    await dataService.updateEntity('payments', paymentId, {
      totalApplied: updatedPayment.totalApplied,
      customerDepositBalance: updatedPayment.customerDepositBalance,
      status: persistedPaymentStatus,
      updatedAt: updatedPayment.updatedAt
    });
    setPayments(prev => prev.map(p => p.id === paymentId ? updatedPayment : p));

    // 2. Update Invoice Balance and Status
    const newAmountPaid = Math.max((invoice.amountPaid || 0) - reversedAmount, 0);
    const newBalanceDue = (invoice.balanceDue || 0) + reversedAmount;
    const newStatus = resolvePaidInvoiceStatus(invoice, newBalanceDue);
    const updatedInvoice = {
      ...invoice,
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    await dataService.updateInvoice(invoice.id, {
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      status: newStatus,
      updatedAt: updatedInvoice.updatedAt
    });
    setInvoices(prev => prev.map(i => i.id === invoice.id ? updatedInvoice : i));

    // 3. Create GL Journal Entry for RVRS
    const { customerDepositsAccount } = resolvePaymentPostingAccounts(payment);
    const arAcct = resolveArAccountForInvoice(payment, invoice);
    const depositsAcct = customerDepositsAccount;
    if (arAcct && depositsAcct) {
      const rvrsEntry: Partial<JournalEntry> = {
        orgId: currentOrgId,
        periodId: invoice.periodId,
        date: new Date().toISOString().split('T')[0],
        description: `Reversal of Payment Application for Invoice ${invoice.invoiceNo}`,
        reference: `RVRS - ${invoice.invoiceNo} -${Date.now()} `,
        status: 'POSTED',
        sourceType: 'REVERSAL',
        sourceRef: invoice.id,
        createdBy: currentUser?.id || 'system',
        createdAt: new Date().toISOString()
      };
      const rvrsLines: JournalLine[] = [
        {
          id: `jl-${Date.now()}-1`,
          journalEntryId: '',
          orgId: currentOrgId,
          accountId: arAcct.id,
          debit: reversedAmount,
          credit: 0,
          description: 'Restore Accounts Receivable'
        },
        {
          id: `jl-${Date.now()}-2`,
          journalEntryId: '',
          orgId: currentOrgId,
          accountId: depositsAcct.id,
          debit: 0,
          credit: reversedAmount,
          description: 'Restore Customer Deposits'
        }
      ];
      await handlePostJournal(rvrsEntry, rvrsLines);
    }
  };

  // ===== Bank Deposit CRUD Handlers =====
  const handleAddBankDeposit = async (deposit: BankDeposit) => {
    try {
      console.info('[App] Creating bank deposit:', deposit.depositNo);
      const depositWithOrg = { ...deposit, orgId: currentOrgId };
      setBankDeposits(prev => [...prev, depositWithOrg]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_DEPOSIT', depositWithOrg.id, deposit.depositNo);
      handleNotify('success', `Deposit ${deposit.depositNo} created successfully`);
    } catch (error) {
      console.error('[App] Error creating bank deposit:', error);
      handleNotify('error', 'Failed to create bank deposit.');
    }
  };

  const handleUpdateBankDeposit = async (deposit: BankDeposit) => {
    try {
      console.info('[App] Updating bank deposit:', deposit.id);
      const existing = bankDeposits.find(d => d.id === deposit.id);
      setBankDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, ...deposit, updatedAt: new Date().toISOString() } : d));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_DEPOSIT', deposit.id, deposit.depositNo, existing, deposit);
      handleNotify('success', `Deposit ${deposit.depositNo} updated successfully`);
    } catch (error) {
      console.error('[App] Error updating bank deposit:', error);
      handleNotify('error', 'Failed to update bank deposit.');
    }
  };

  const handleDeleteBankDeposit = async (id: string): Promise<boolean> => {
    try {
      console.info('[App] Deleting bank deposit:', id);
      const existing = bankDeposits.find(d => d.id === id);
      setBankDeposits(prev => prev.map(d => d.id === id ? { ...d, isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: currentUser?.id } : d));

      AuditService.softDelete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_DEPOSIT', id, existing?.depositNo);
      handleNotify('success', 'Bank deposit deleted successfully');
      return true;
    } catch (error) {
      console.error('[App] Error deleting bank deposit:', error);
      handleNotify('error', 'Failed to delete bank deposit.');
      return false;
    }
  };

  const handleVoidBankDeposit = async (id: string, reason: string) => {
    try {
      const deposit = bankDeposits.find(d => d.id === id);
      if (deposit) {
        const voidedDeposit = {
          ...deposit,
          status: 'VOIDED' as const,
          voidedAt: new Date().toISOString(),
          voidedBy: currentUser?.id,
          voidReason: reason
        };
        setBankDeposits(prev => prev.map(d => d.id === id ? voidedDeposit : d));
        AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'BANK_DEPOSIT', id, deposit.depositNo, deposit, voidedDeposit);
        handleNotify('success', `Deposit ${deposit.depositNo} voided`);
      }
    } catch (error) {
      console.error('[App] Error voiding bank deposit:', error);
      handleNotify('error', 'Failed to void bank deposit.');
    }
  };

  // ===== Employee CRUD Handlers =====
  const handleAddEmployee = async (employee: Employee) => {
    try {
      console.info('[App] Creating employee:', employee.lastName);
      const empWithOrg = { ...employee, orgId: currentOrgId };
      const savedEmployee = await dataService.createEmployee(empWithOrg);
      setEmployees(prev => [...prev, savedEmployee]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'EMPLOYEE', savedEmployee.id, `${employee.firstName} ${employee.lastName} `);
      handleNotify('success', `Employee "${employee.firstName} ${employee.lastName}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating employee:', error);
      handleNotify('error', 'Failed to create employee. Falling back to memory storage.');
      const empWithOrg = { ...employee, orgId: currentOrgId };
      setEmployees(prev => [...prev, empWithOrg]);
    }
  };

  const handleUpdateEmployee = async (employee: Employee) => {
    try {
      console.info('[App] Updating employee:', employee.id);
      const existing = employees.find(e => e.id === employee.id);
      const updated = await dataService.updateEmployee(employee.id, employee);
      setEmployees(prev => prev.map(e => e.id === employee.id ? { ...e, ...updated } : e));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'EMPLOYEE', employee.id, `${employee.firstName} ${employee.lastName} `, existing, updated);
      handleNotify('success', 'Employee updated successfully');
    } catch (error) {
      console.error('[App] Error updating employee:', error);
      handleNotify('error', 'Failed to update employee. Falling back to memory storage.');
      setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      console.info('[App] Deleting employee:', id);
      const existing = employees.find(e => e.id === id);
      await dataService.deleteEmployee(id);
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, isDeleted: true, deletedAt: new Date().toISOString() } : e));

      AuditService.delete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'EMPLOYEE', id, `${existing?.firstName} ${existing?.lastName} `);
      handleNotify('success', 'Employee deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting employee:', error);
      handleNotify('error', 'Failed to delete employee. Falling back to memory storage.');
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, isDeleted: true, deletedAt: new Date().toISOString() } : e));
    }
  };

  // ===== Chart of Accounts CRUD Handlers =====
  const handleAddAccount = async (account: ChartOfAccount) => {
    try {
      console.info('[App] Creating account:', account.name);
      const acctWithOrg = { ...account, orgId: currentOrgId };
      const savedAccount = await dataService.createAccount(acctWithOrg);
      setAccounts(prev => [...prev, savedAccount]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ACCOUNT', savedAccount.id, `${account.code} - ${account.name} `);
      handleNotify('success', `Account "${account.code} - ${account.name}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating account:', error);
      handleNotify('error', 'Failed to create account. Falling back to memory storage.');
      const acctWithOrg = { ...account, orgId: currentOrgId };
      setAccounts(prev => [...prev, acctWithOrg]);
    }
  };

  const handleUpdateAccount = async (account: ChartOfAccount) => {
    try {
      console.info('[App] Updating account:', account.id);
      const existing = accounts.find(a => a.id === account.id);
      const updated = await dataService.updateAccount(account.id, account);
      setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, ...updated } : a));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ACCOUNT', account.id, `${account.code} - ${account.name} `, existing, updated);
      handleNotify('success', 'Account updated successfully');
    } catch (error) {
      console.error('[App] Error updating account:', error);
      handleNotify('error', 'Failed to update account. Falling back to memory storage.');
      setAccounts(prev => prev.map(a => a.id === account.id ? account : a));
    }
  };

  const handleDeleteAccount = async (id: string) => {
    try {
      console.info('[App] Deleting account:', id);
      const existing = accounts.find(a => a.id === id);
      await dataService.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));

      AuditService.delete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'ACCOUNT', id, existing?.name);
      handleNotify('success', 'Account deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting account:', error);
      handleNotify('error', 'Failed to delete account. Falling back to memory storage.');
      setAccounts(prev => prev.filter(a => a.id !== id));
    }
  };

  // ===== Purchase Order CRUD Handlers =====
  const handleAddPurchaseOrder = async (po: PurchaseOrder) => {
    try {
      console.info('[App] Creating purchase order:', po.reference);
      const poWithOrg = { ...po, orgId: currentOrgId };
      const savedPO = await dataService.createPurchaseOrder(poWithOrg);
      setPurchaseOrders(prev => [...prev, savedPO]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PURCHASE_ORDER', savedPO.id, po.reference);
      handleNotify('success', `Purchase Order "${po.reference}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating purchase order:', error);
      handleNotify('error', 'Failed to create purchase order. Falling back to memory storage.');
      const poWithOrg = { ...po, orgId: currentOrgId };
      setPurchaseOrders(prev => [...prev, poWithOrg]);
    }
  };

  const handleUpdatePurchaseOrderStatus = async (id: string, status: string) => {
    try {
      console.info('[App] Updating purchase order status:', id, status);
      const existing = purchaseOrders.find(p => p.id === id);

      // Generate GL Entry Number when approving
      let updatePayload: any = { status: status as any };
      if (status === 'APPROVED' && existing && !existing.glEntryNumber) {
        // use unified sequential reference
        const glEntryNumber = generateNextGlRef();
        updatePayload.glEntryNumber = glEntryNumber;
        updatePayload.approvedBy = currentUser?.id;
        updatePayload.approvedAt = new Date().toISOString();
      }

      const updated = await dataService.updatePurchaseOrder(id, updatePayload);
      setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'PURCHASE_ORDER', id, existing?.reference, { status: existing?.status }, { status });

      if (status === 'APPROVED' && updatePayload.glEntryNumber) {
        handleNotify('success', `Purchase order approved.GL Entry #: ${updatePayload.glEntryNumber} `);
      } else {
        handleNotify('success', 'Purchase order status updated successfully');
      }
    } catch (error) {
      console.error('[App] Error updating purchase order:', error);
      handleNotify('error', 'Failed to update purchase order. Falling back to memory storage.');
      setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, status: status as any } : p));
    }
  };

  // ===== Goods Receipt CRUD Handlers =====
  const handleAddGoodsReceipt = async (gr: GoodsReceipt) => {
    try {
      console.info('[App] Creating goods receipt:', gr.grNumber);
      const grWithOrg = { ...gr, orgId: currentOrgId };
      const savedGR = await dataService.createGoodsReceipt(grWithOrg);
      setGoodsReceipts(prev => [...prev, savedGR]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'GOODS_RECEIPT', savedGR.id, gr.grNumber);
      handleNotify('success', `Goods Receipt "${gr.grNumber}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating goods receipt:', error);
      handleNotify('error', 'Failed to create goods receipt. Falling back to memory storage.');
      const grWithOrg = { ...gr, orgId: currentOrgId };
      setGoodsReceipts(prev => [...prev, grWithOrg]);
    }
  };

  const handleUpdateGoodsReceipt = async (id: string, updates: Partial<GoodsReceipt>) => {
    try {
      console.info('[App] Updating goods receipt:', id);
      const existing = goodsReceipts.find(g => g.id === id);
      const updated = await dataService.updateGoodsReceipt(id, updates);
      setGoodsReceipts(prev => prev.map(g => g.id === id ? { ...g, ...updated } : g));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'GOODS_RECEIPT', id, existing?.grNumber, existing, { ...existing, ...updates });
      handleNotify('success', 'Goods receipt updated successfully');
    } catch (error) {
      console.error('[App] Error updating goods receipt:', error);
      handleNotify('error', 'Failed to update goods receipt. Falling back to memory storage.');
      setGoodsReceipts(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
    }
  };

  const handleDeleteGoodsReceipt = async (id: string) => {
    try {
      console.info('[App] Deleting goods receipt:', id);
      const existing = goodsReceipts.find(g => g.id === id);
      await dataService.deleteGoodsReceipt(id);
      setGoodsReceipts(prev => prev.filter(g => g.id !== id));

      AuditService.delete(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'GOODS_RECEIPT', id, existing?.grNumber);
      handleNotify('success', 'Goods receipt deleted successfully');
    } catch (error) {
      console.error('[App] Error deleting goods receipt:', error);
      handleNotify('error', 'Failed to delete goods receipt. Falling back to memory storage.');
      setGoodsReceipts(prev => prev.filter(g => g.id !== id));
    }
  };

  // ===== EFT Batch CRUD Handlers =====
  const handleAddEFTBatch = async (batch: EFTBatch) => {
    try {
      console.info('[App] Creating EFT batch:', batch.batchNumber);
      const batchWithOrg = { ...batch, orgId: currentOrgId };
      const savedBatch = await dataService.createEFTBatch(batchWithOrg);
      setEftBatches(prev => [...prev, savedBatch]);

      AuditService.create(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'EFT_BATCH', savedBatch.id, batch.batchNumber);
      handleNotify('success', `EFT Batch "${batch.batchNumber}" created successfully`);
    } catch (error) {
      console.error('[App] Error creating EFT batch:', error);
      handleNotify('error', 'Failed to create EFT batch. Falling back to memory storage.');
      const batchWithOrg = { ...batch, orgId: currentOrgId };
      setEftBatches(prev => [...prev, batchWithOrg]);
    }
  };

  const handleUpdateEFTBatch = async (id: string, updates: Partial<EFTBatch>) => {
    try {
      console.info('[App] Updating EFT batch:', id);
      const existing = eftBatches.find(b => b.id === id);
      const updated = await dataService.updateEFTBatch(id, updates);
      setEftBatches(prev => prev.map(b => b.id === id ? { ...b, ...updated } : b));

      AuditService.update(currentOrgId, currentUser?.id || 'system', currentUser?.name || 'System', 'EFT_BATCH', id, existing?.batchNumber, existing, { ...existing, ...updates });
      handleNotify('success', 'EFT batch updated successfully');
    } catch (error) {
      console.error('[App] Error updating EFT batch:', error);
      handleNotify('error', 'Failed to update EFT batch. Falling back to memory storage.');
      setEftBatches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    }
  };

  const handleDeleteEFTBatch = async (id: string) => {
    try {
      console.info('[App] Archiving EFT batch:', id);
      const existing = eftBatches.find(b => b.id === id);

      // Proceed with archival
      await dataService.archiveEntity('eft_batches', id, currentUser?.id || 'system');

      // Update local state by removing from active list
      setEftBatches(prev => prev.filter(b => b.id !== id));

      // Audit: EFT batch archived
      AuditService.archive(
        currentOrgId,
        currentUser?.id || 'system',
        currentUser?.name || 'System',
        'EFT_BATCH',
        id,
        existing?.batchNumber
      );

      handleNotify('success', 'EFT batch moved to archive');
      return true;
    } catch (error) {
      console.error('[App] Error archiving EFT batch:', error);
      handleNotify('error', 'Failed to archive EFT batch.');
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white gap-8">
        <style>{`@keyframes progressBar { 0% { transform: translateX(-100%);} 100% { transform: translateX(100%);} }`}</style>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-4">
            <img
              src="/accountech-logo.png"
              alt="Accountech logo"
              className="h-24 w-24 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] md:h-28 md:w-28"
            />
            <div className="text-center md:text-left">
              <h1 className="text-5xl font-black tracking-tight leading-none">
                <span className="bg-gradient-to-r from-[#d8b35b] via-[#f5de9e] to-[#b78422] bg-clip-text text-transparent">
                  Accoun
                </span>
                <span className="text-white">Tech.</span>
              </h1>
              <p className="mt-2 italic text-[10px] font-bold uppercase tracking-[0.32em] text-slate-400">
                SMART SOLUTIONS FOR THE MODERN ECONOMY
              </p>
            </div>
          </div>
        </div>
        <div className="w-72">
          <div className="h-2 rounded-full overflow-hidden bg-slate-800 border border-slate-700">
            <div className="h-full w-1/3 bg-gradient-to-r from-[#F47721] via-[#FCA311] to-[#F47721] animate-[progressBar_2.5s_linear_infinite]" />
          </div>
          <div className="mt-3 text-center text-xs uppercase font-semibold tracking-[0.2em] text-slate-400">Loading training architecture...</div>
        </div>
      </div>
    );
  }

  // Show Password Reset View
  if (showPasswordReset) {
    return (
      <PasswordResetView
        onBackToLogin={() => {
          setShowPasswordReset(false);
          setResetToken(null);
          setAuthScreen('login');
          // Clear URL parameter
          window.history.replaceState({}, '', window.location.pathname);
        }}
        resetToken={resetToken}
      />
    );
  }

  if (!currentUser) {
    if (authScreen === 'welcome') {
      return (
        <WelcomeView
          onLoginClick={() => setAuthScreen('login')}
        />
      );
    }

    return (
      <LoginView
        onLogin={handleLogin}
        onRegister={handleRegisterWithPersistence}
        onForgotPassword={() => setShowPasswordReset(true)}
        onBackToWelcome={() => setAuthScreen('welcome')}
        organizations={organizations}
        users={users}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {suspensionBanner && (
        <div className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 w-[min(90vw,720px)] rounded-lg border border-rose-300 bg-rose-50 text-rose-900 px-4 py-3 shadow-lg flex items-center gap-2">
          <AlertCircle size={18} className="text-rose-600" />
          <span className="text-sm font-semibold">{suspensionBanner}</span>
          <button className="ml-auto text-rose-700 underline text-xs" onClick={() => setSuspensionBanner(null)}>Dismiss</button>
        </div>
      )}
      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 flex items-center gap-3 ${toast.type === 'success' ? 'bg-brand/10 border-brand-light text-brand' :
              toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}
          >
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-brand shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-red-500 shrink-0" />}
            {toast.type === 'info' && <AlertCircle size={18} className="text-blue-500 shrink-0" />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="ml-auto text-current opacity-50 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <aside className={`${sidebarOpen ? 'w-80' : 'w-20'} bg-white flex flex-col transition-all duration-500 z-50 border-r border-slate-200`}>
        <div className="p-6 flex items-center justify-center border-b border-slate-200 bg-slate-50">
          {sidebarOpen ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg overflow-hidden shrink-0"
                style={{
                  backgroundColor: brandColor,
                  border: `2px solid ${currentOrg?.primaryColor || brandColor}`
                }}
              >
                {currentOrg?.logoUrl ? <img src={currentOrg.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={24} />}
              </div>
              <div className="w-full text-center">
                <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">{currentOrg?.name || 'No Organization'}</h1>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">{currentUser.role.replace('_', ' ')}</p>
              </div>
            </div>
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto text-white shadow-xl"
              style={{
                backgroundColor: brandColor,
                border: `2px solid ${currentOrg?.primaryColor || brandColor}`
              }}
            >
              <Building2 size={20} />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-8 px-4 scrollbar-hide">
          {/* Navigation Items (unchanged logic) */}
          {!isSysAdmin && (
            <>
              {currentUser.role === 'STUDENT' && (
                <div className="mb-8">
                  {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Learner Portal</p>}
              <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'student-portal'} onClick={() => setActiveTab('student-portal')} compact={!sidebarOpen} brandColor={brandColor} />
            </div>
          )}

          {currentUser.role === 'TRAINER' && (
            <div className="mb-8">
              {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Instructor Portal</p>}
              <NavItem icon={<LayoutDashboard size={20} />} label="Trainer Console" active={activeTab === 'trainer-portal'} onClick={() => setActiveTab('trainer-portal')} compact={!sidebarOpen} brandColor={brandColor} />
            </div>
          )}

          {currentUser.role === 'AR_SPECIALIST' && (
            <div className="space-y-6">
              <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<ListTodo size={18} />} label="Calendar & Tasks" active={activeTab === 'ar-calendar-tasks'} onClick={() => navigateTo('ar-calendar-tasks')} compact={!sidebarOpen} brandColor={brandColor} />

              <NavSection label="Billing & Receivables" isOpen={openSections.registries} onToggle={() => setOpenSections(prev => ({ ...prev, registries: !prev.registries }))} compact={!sidebarOpen}>
                <NavItem icon={<Users size={18} />} label="Customer List" active={activeTab === 'customers'} onClick={() => navigateTo('customers')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<FileText size={18} />} label="Invoice" active={activeTab === 'invoices'} onClick={() => navigateTo('invoices')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<Wallet size={18} />} label="Payments and Applications" active={activeTab === 'payments'} onClick={() => navigateTo('payments')} compact={!sidebarOpen} brandColor={brandColor} />
              </NavSection>

              <NavSection label="Collections & Adjustments" isOpen={openSections.operations} onToggle={() => setOpenSections(prev => ({ ...prev, operations: !prev.operations }))} compact={!sidebarOpen}>
                <NavItem icon={<Zap size={18} />} label="Write Offs" active={activeTab === 'write-off'} onClick={() => navigateTo('write-off')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<CreditCard size={18} />} label="Credit/Debit Memo" active={activeTab === 'credit-debit-memo'} onClick={() => navigateTo('credit-debit-memo')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<RefreshCw size={18} />} label="Reclassify" active={activeTab === 'reclassify'} onClick={() => navigateTo('reclassify')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<Receipt size={18} />} label="Collection Receipt" active={activeTab === 'collection-receipt'} onClick={() => navigateTo('collection-receipt')} compact={!sidebarOpen} brandColor={brandColor} />
              </NavSection>

              <NavSection label="AR Reports" isOpen={openSections.inventory} onToggle={() => setOpenSections(prev => ({ ...prev, inventory: !prev.inventory }))} compact={!sidebarOpen}>
                <NavItem icon={<BarChart2 size={18} />} label="Collection Report" active={activeTab === 'collection-report'} onClick={() => navigateTo('collection-report')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<PieChart size={18} />} label="Aging Report" active={activeTab === 'aging-report'} onClick={() => navigateTo('aging-report')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<FileText size={18} />} label="Statement (SOA)" active={activeTab === 'soa'} onClick={() => navigateTo('soa')} compact={!sidebarOpen} brandColor={brandColor} />
              </NavSection>

              <NavSection label="Ledgers & Audit" isOpen={openSections.financial} onToggle={() => setOpenSections(prev => ({ ...prev, financial: !prev.financial }))} compact={!sidebarOpen}>
                <NavItem icon={<BookText size={18} />} label="General Ledger" active={activeTab === 'ledger'} onClick={() => navigateTo('ledger')} compact={!sidebarOpen} brandColor={brandColor} />
                <NavItem icon={<BookText size={18} />} label="Customer Ledger" active={activeTab === 'customer-ledger'} onClick={() => navigateTo('customer-ledger')} compact={!sidebarOpen} brandColor={brandColor} />
              </NavSection>
            </div>
          )}

          {currentUser.role === 'TRAINER' && (
            <div className="mb-8">
              {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">Instructor Portal</p>}
              <NavItem icon={<LayoutDashboard size={20} />} label="Trainer Console" active={activeTab === 'trainer-portal'} onClick={() => navigateTo('trainer-portal')} compact={!sidebarOpen} brandColor={brandColor} />
            </div>
          )}

          {isFinance && currentUser.role !== 'AR_SPECIALIST' && (
            <NavSection
              label="Finance"
              isOpen={openSections.financial}
              onToggle={() => setOpenSections(prev => ({ ...prev, financial: !prev.financial }))}
              compact={!sidebarOpen}
            >
              <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<BookText size={18} />} label="General Ledger" active={activeTab === 'ledger'} onClick={() => navigateTo('ledger')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<PieChart size={18} />} label="Reports" active={activeTab === 'reports'} onClick={() => navigateTo('reports')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Landmark size={18} />} label="Cash Management" active={activeTab === 'banking'} onClick={() => navigateTo('banking')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Printer size={18} />} label="Check Printing" active={activeTab === 'checks'} onClick={() => navigateTo('checks')} compact={!sidebarOpen} brandColor={brandColor} />
              {userCanAccess('ar') && <NavItem icon={<Receipt size={18} />} label="Accounts Receivable" active={activeTab === 'ar'} onClick={() => navigateTo('ar')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('revenue-recognition') && <NavItem icon={<TrendingUp size={18} />} label="Revenue Recognition" active={activeTab === 'revenue-recognition'} onClick={() => navigateTo('revenue-recognition')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('customers') && <NavItem icon={<Users size={18} />} label="Learners & Customers" active={activeTab === 'customers'} onClick={() => navigateTo('customers')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('invoices') && <NavItem icon={<FileText size={18} />} label="Invoices" active={activeTab === 'invoices'} onClick={() => navigateTo('invoices')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('payments') && <NavItem icon={<Wallet size={18} />} label="Payments and Applications" active={activeTab === 'payments'} onClick={() => navigateTo('payments')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('bank-deposits') && <NavItem icon={<ArrowDownToLine size={18} />} label="Bank Deposits" active={activeTab === 'bank-deposits'} onClick={() => navigateTo('bank-deposits')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('course-fees') && <NavItem icon={<Receipt size={18} />} label="Course Fees" active={activeTab === 'course-fees'} onClick={() => navigateTo('course-fees')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('enrollments') && <NavItem icon={<UserCheck size={18} />} label="Enrollments" active={activeTab === 'enrollments'} onClick={() => navigateTo('enrollments')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('payables') && <NavItem icon={<CreditCard size={18} />} label="Accounts Payable" active={activeTab === 'payables'} onClick={() => navigateTo('payables')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('po') && <NavItem icon={<ShoppingCart size={18} />} label="Purchase Orders" active={activeTab === 'po'} onClick={() => navigateTo('po')} compact={!sidebarOpen} brandColor={brandColor} />}
              {userCanAccess('goods-receipt') && <NavItem icon={<Package size={18} />} label="Goods Receipt" active={activeTab === 'goods-receipt'} onClick={() => navigateTo('goods-receipt')} compact={!sidebarOpen} brandColor={brandColor} />}
              <NavItem icon={<Briefcase size={18} />} label="Payroll" active={activeTab === 'payroll'} onClick={() => navigateTo('payroll')} compact={!sidebarOpen} brandColor={brandColor} />
            </NavSection>
          )}

          {isRegistrar && currentUser.role !== 'AR_SPECIALIST' && (
            <NavSection
              label="Operations"
              isOpen={openSections.operations}
              onToggle={() => setOpenSections(prev => ({ ...prev, operations: !prev.operations }))}
              compact={!sidebarOpen}
            >
              <NavItem icon={<LayoutDashboard size={20} />} label="Registrar Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Users size={20} />} label="Learners" active={activeTab === 'students'} onClick={() => navigateTo('students')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<GraduationCap size={20} />} label="Trainers" active={activeTab === 'trainers'} onClick={() => navigateTo('trainers')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Award size={20} />} label="Qualifications" active={activeTab === 'qualifications'} onClick={() => navigateTo('qualifications')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Layers size={20} />} label="Training Batches" active={activeTab === 'batches'} onClick={() => navigateTo('batches')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<ClipboardCheck size={20} />} label="Assessment Registrations" active={activeTab === 'assessment-registrations'} onClick={() => navigateTo('assessment-registrations')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<MapPin size={20} />} label="Locations" active={activeTab === 'locations'} onClick={() => navigateTo('locations')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<CalendarClock size={20} />} label="Scheduling" active={activeTab === 'schedules'} onClick={() => navigateTo('schedules')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<UserCheck size={20} />} label="Alumni Reports" active={activeTab === 'alumni-reports'} onClick={() => navigateTo('alumni-reports')} compact={!sidebarOpen} brandColor={brandColor} />
            </NavSection>
          )}

          {isFinance && currentUser.role !== 'AR_SPECIALIST' && (
            <NavSection
              label="Registries"
              isOpen={openSections.registries}
              onToggle={() => setOpenSections(prev => ({ ...prev, registries: !prev.registries }))}
              compact={!sidebarOpen}
            >
              <NavItem icon={<Handshake size={20} />} label="Sponsors" active={activeTab === 'sponsors'} onClick={() => navigateTo('sponsors')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Truck size={20} />} label="Vendors" active={activeTab === 'vendors'} onClick={() => navigateTo('vendors')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Tag size={20} />} label="Item Catalog (Non-Stock)" active={activeTab === 'items'} onClick={() => navigateTo('items')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Box size={20} />} label="Fixed Assets" active={activeTab === 'assets'} onClick={() => navigateTo('assets')} compact={!sidebarOpen} brandColor={brandColor} />
            </NavSection>
          )}

          {isFinance && currentUser.role !== 'AR_SPECIALIST' && (
            <NavSection
              label="Inventory"
              isOpen={openSections.inventory}
              onToggle={() => setOpenSections(prev => ({ ...prev, inventory: !prev.inventory }))}
              compact={!sidebarOpen}
            >
              <NavItem icon={<Package size={20} />} label="Stock Dashboard" active={activeTab === 'inventory'} onClick={() => navigateTo('inventory')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<MapPin size={20} />} label="Warehouse Locations" active={activeTab === 'warehouse-locations'} onClick={() => navigateTo('warehouse-locations')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Box size={20} />} label="Stock Items" active={activeTab === 'stock-items'} onClick={() => navigateTo('stock-items')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Layers size={20} />} label="Stock Levels" active={activeTab === 'stock-levels'} onClick={() => navigateTo('stock-levels')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<AlertCircle size={20} />} label="Stock Adjustments" active={activeTab === 'stock-adjustments'} onClick={() => navigateTo('stock-adjustments')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Zap size={20} />} label="Reorder Points" active={activeTab === 'reorder-points'} onClick={() => navigateTo('reorder-points')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<History size={20} />} label="Transactions" active={activeTab === 'inventory-transactions'} onClick={() => navigateTo('inventory-transactions')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<TrendingUp size={20} />} label="Analytics" active={activeTab === 'inventory-reports'} onClick={() => navigateTo('inventory-reports')} compact={!sidebarOpen} brandColor={brandColor} />
            </NavSection>
          )}

          {isAdmin && currentUser.role !== 'AR_SPECIALIST' && (
            <NavSection
              label="Administration"
              isOpen={openSections.administration}
              onToggle={() => setOpenSections(prev => ({ ...prev, administration: !prev.administration }))}
              compact={!sidebarOpen}
            >
              <NavItem icon={<Users size={20} />} label="Employees" active={activeTab === 'employees'} onClick={() => navigateTo('employees')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Settings size={20} />} label="G/L Setup (COA)" active={activeTab === 'coa'} onClick={() => navigateTo('coa')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<CalendarCheck size={20} />} label="Period Closing" active={activeTab === 'periods'} onClick={() => navigateTo('periods')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Palette size={20} />} label="Branding & Motif" active={activeTab === 'branding'} onClick={() => navigateTo('branding')} compact={!sidebarOpen} brandColor={brandColor} />
              <div className="relative">
                <NavItem icon={<CreditCard size={20} />} label="Payment History" active={activeTab === 'payment-history'} onClick={() => navigateTo('payment-history')} compact={!sidebarOpen} brandColor={brandColor} />
                {paymentsDueSoon.length > 0 && (
                  <div className="absolute top-2 right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-full">
                    {paymentsDueSoon.length}
                  </div>
                )}
              </div>
              <NavItem icon={<UserCog size={20} />} label="Security/RBAC" active={activeTab === 'users'} onClick={() => navigateTo('users')} compact={!sidebarOpen} brandColor={brandColor} />
              {canViewAuditTrail && <NavItem icon={<History size={20} />} label="Audit Trail" active={activeTab === 'audit'} onClick={() => navigateTo('audit')} compact={!sidebarOpen} brandColor={brandColor} />}
            </NavSection>
          )}
            </>
          )}

          {isSysAdmin && (
            <div className="mb-8">
              {sidebarOpen && <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] mb-4 px-4">System Administration</p>}
              <NavItem icon={<Wrench size={20} />} label="Maintenance" active={activeTab === 'maintenance'} onClick={() => navigateTo('maintenance')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<HardDrive size={20} />} label="Backup & Restore" active={activeTab === 'backup-restore'} onClick={() => navigateTo('backup-restore')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Terminal size={20} />} label="Tenant Mgmt" active={activeTab === 'tenant-mgmt'} onClick={() => navigateTo('tenant-mgmt')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Wallet size={20} />} label="Subscription" active={activeTab === 'subscription'} onClick={() => navigateTo('subscription')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<Binary size={20} />} label="Data Schema" active={activeTab === 'schema'} onClick={() => navigateTo('schema')} compact={!sidebarOpen} brandColor={brandColor} />
              <NavItem icon={<BarChart2 size={20} />} label="Payment Monitoring" active={activeTab === 'payment-monitoring'} onClick={() => navigateTo('payment-monitoring')} compact={!sidebarOpen} brandColor={brandColor} />
            </div>
          )}
        </nav>

        {/* System Data Engine Status Badge - SYSTEM_ADMIN only */}
        {sidebarOpen && isSysAdmin && (
          <div className="px-8 mb-4">
            <div className={`p - 3 rounded-2xl border flex items-center gap-3 transition-all ${config.useMockData ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'} `}>
              {config.useMockData ? <Database size={16} /> : <Cloud size={16} />}
              <div className="min-w-0">
                <p className="text-[8px] uppercase tracking-widest leading-none mb-1">Engine Active</p>
                <p className="text-[10px] uppercase truncate">{config.useMockData ? 'MOCK_LOCAL' : 'SUPABASE_CLOUD'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 mt-auto border-t border-slate-200">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title={!sidebarOpen ? 'Logout' : undefined}
            aria-label={!sidebarOpen ? 'Logout' : undefined}
            className="w-full flex items-center gap-3 p-3 text-slate-600 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-100"
          >
            <LogOut size={20} />
            {sidebarOpen && <span className="text-xs font-black uppercase tracking-widest">Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header and Content Area (unchanged) */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all border border-slate-100"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] ml-4">{showJournalForm ? 'new journal entry' : activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigateTo('profile')}
                title="Profile"
                aria-label="Profile"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                  activeTab === 'profile'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <UserCircle size={16} />
              </button>
              {userCanAccess('feedback') && (
                <button
                  type="button"
                  onClick={() => navigateTo('feedback')}
                  title={isSysAdmin ? 'Users Feedback' : 'Feedback Ticket'}
                  aria-label={isSysAdmin ? 'Users Feedback' : 'Feedback Ticket'}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
                    activeTab === 'feedback'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare size={16} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-black text-slate-800 leading-none">{currentUser.name}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{currentUser.role.replace('_', ' ')}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-black border-2 border-white shadow-xl uppercase overflow-hidden">
                {currentUser.profilePhoto ? (
                  <img src={currentUser.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  `${currentUser.name.substring(0, 1)}${(currentUser.lastName || currentUser.name.substring(1, 2)).substring(0, 1)}`.toUpperCase()
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-10 scrollbar-hide">
          {showJournalForm ? (
            <div className="w-full max-w-none">
              <JournalForm
                accounts={filteredAccounts}
                students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
                trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)}
                sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
                batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
                items={items.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
                qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
                entries={activeJournalEntries}
                payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
                entryToEdit={journalFormEntry || undefined}
                linesToEdit={journalFormLines}
                mode={journalFormMode}
                onReverse={handleReverseOpenedJournal}
                onClose={() => {
                  setShowJournalForm(false);
                  setJournalFormEntry(null);
                  setJournalFormLines([]);
                  setJournalFormMode('new');
                }}
                onSubmit={(entry, lines) => {
                  handleSaveOrPostJournal(entry, lines);
                  setShowJournalForm(false);
                  setJournalFormEntry(null);
                  setJournalFormLines([]);
                  setJournalFormMode('new');
                }}
              />
            </div>
          ) : (
            <>
          {/* View Router (unchanged) */}
          {activeTab === 'profile' && currentUser && (
            <UserProfileView
              currentUser={currentUser}
              brandColor={brandColor}
              onUpdateProfile={handleUpdateCurrentUserProfile}
            />
          )}

          {activeTab === 'student-portal' && currentUser.studentId && (
            <StudentPortalView
              student={students.find(s => s.id === currentUser.studentId)!}
              batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)}
              locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)}
              schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              entries={activeJournalEntries}
              lines={journalLines}
              brandColor={brandColor}
              onUpdateStudent={handleUpdateStudent}
            />
          )}

          {activeTab === 'trainer-portal' && currentUser.trainerId && (
            <TrainerPortalView
              trainer={trainers.find(t => t.id === currentUser.trainerId)!}
              batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)}
              schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              brandColor={brandColor}
              onUpdateTrainer={handleUpdateTrainer}
            />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              summaries={summaries}
              currency={currentOrg?.currency}
              lines={filteredLines}
              accounts={filteredAccounts}
              currentUser={currentUser}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              sponsors={sponsors.filter(sp => sp.orgId === currentOrgId && !sp.isDeleted)}
              batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              entries={activeJournalEntries}
              enrollments={enrollments.filter(e => e.orgId === currentOrgId && !e.isDeleted)}
              payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
              invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
            />
          )}
          {activeTab === 'ar-calendar-tasks' && (
            <ARCalendarTasksView
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
              currentUser={currentUser}
              brandColor={brandColor}
              onNotify={handleNotify}
            />
          )}
          {activeTab === 'ledger' && <Ledger orgId={currentOrgId} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)} payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)} students={students} sponsors={sponsors} trainers={trainers} batches={batches} items={items} qualifications={qualifications} users={users} onPostEntry={handleSaveOrPostJournal} onApproveJournal={handleApproveJournal} onReverseJournal={reverseJournalEntry} currentUser={currentUser} initialSearchTerm={ledgerSearchTerm} />}
          {activeTab === 'reports' && <Reports summaries={summaries} accounts={filteredAccounts} entries={postedJournalEntries} lines={postedLines} qualifications={qualifications} batches={batches} orgName={currentOrg?.name} currency={currentOrg?.currency} logoUrl={currentOrg?.logoUrl} />}
          {activeTab === 'collection-report' && (
            <ARCollectionReportView
              payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              users={users.filter(u => u.orgId === currentOrgId && !u.isDeleted)}
              currency={currentOrg?.currency || 'USD'}
              brandColor={brandColor}
              orgName={currentOrg?.name}
              preparedBy="AR Specialist"
              onViewJournal={handleViewJournal}
            />
          )}

          {activeTab === 'ar' && <ARView entries={activeJournalEntries} lines={filteredLines} students={students} sponsors={sponsors} items={items} accounts={filteredAccounts} bankAccounts={bankAccounts} taxCategories={taxCategories} onPostInvoice={handlePostJournal} onApproveInvoice={handleApproveJournal} currentUser={currentUser} onNotify={handleNotify} orgId={currentOrgId} />}
          {activeTab === 'revenue-recognition' && <RevenueRecognitionView orgId={currentOrgId} currency={currentOrg?.currency || 'USD'} schedules={revenueSchedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} entries={revenueRecognitionEntries.filter(e => e.orgId === currentOrgId)} customers={[...students.map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName} ` })), ...sponsors.map(sp => ({ id: sp.id, name: sp.name }))]} accounts={filteredAccounts} onCreateSchedule={handleAddRevenueSchedule} onUpdateSchedule={handleUpdateRevenueSchedule} onDeleteSchedule={handleDeleteRevenueSchedule} onCreateEntry={handleAddRevenueRecognitionEntry} onUpdateEntry={handleUpdateRevenueRecognitionEntry} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'ap' && <APView orgId={currentOrgId} payables={payables} checks={checkVouchers} purchaseOrders={purchaseOrders} purchaseOrderLines={purchaseOrderLines} goodsReceipts={goodsReceipts} goodsReceiptLines={goodsReceiptLines} vendors={vendors} accounts={filteredAccounts} entries={activeJournalEntries} items={items} lines={filteredLines} bankAccounts={bankAccounts} currentUserId={currentUser?.id} recurringBills={recurringBills} recurringBillHistory={recurringBillHistory} onCreatePayable={handleAddPayable} onUpdatePayable={handleUpdatePayable} onDeletePayable={handleDeletePayable} onApproveException={handleApproveException} onPostBill={handlePostJournal} onCreateRecurringBill={(bill) => setRecurringBills(prev => [...prev, { ...bill, id: Date.now().toString() } as RecurringBill])} onUpdateRecurringBill={(id, updates) => setRecurringBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))} onDeleteRecurringBill={(id) => setRecurringBills(prev => prev.filter(b => b.id !== id))} onNotify={handleNotify} />}
          {activeTab === 'payables' && <PayablesView orgId={currentOrgId} payables={payables} vendors={vendors} accounts={filteredAccounts} entries={activeJournalEntries} bankAccounts={bankAccounts} vendorTaxSettings={vendorTaxSettings} atcCategories={atcCategories} atcItems={atcItems} atcRates={atcRates} currentUserId={currentUser?.id} onCreatePayable={handleAddPayable} onUpdatePayable={handleUpdatePayable} onDeletePayable={handleDeletePayable} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'po' && <PurchaseOrdersView orgId={currentOrgId} purchaseOrders={purchaseOrders} vendors={vendors} items={items} onCreatePO={handleAddPurchaseOrder} onUpdateStatus={handleUpdatePurchaseOrderStatus} onConvertToBill={handleConvertToBill} />}
          {activeTab === 'goods-receipt' && <GoodsReceiptView orgId={currentOrgId} goodsReceipts={goodsReceipts} purchaseOrders={purchaseOrders.filter(po => po.orgId === currentOrgId)} vendors={vendors} accounts={filteredAccounts} currentUserId={currentUser?.id} onCreateGoodsReceipt={handleAddGoodsReceipt} onUpdateGoodsReceipt={handleUpdateGoodsReceipt} onDeleteGoodsReceipt={handleDeleteGoodsReceipt} onPostJournal={handlePostJournal} onNotify={handleNotify} />}

          {activeTab === 'coa' && <ChartOfAccounts accounts={filteredAccounts} lines={postedLines} qualifications={qualifications} onAddAccount={handleAddAccount} onUpdateAccount={handleUpdateAccount} onDeleteAccount={handleDeleteAccount} />}
          {activeTab === 'periods' && <PeriodClosingView orgId={currentOrgId} periods={accountingPeriods} payables={payables} entries={activeJournalEntries} accounts={filteredAccounts} currentUserId={currentUser?.id} onCreatePeriod={async (p) => { try { const service = DataServiceFactory.getService(); const periodWithOrgAndUser = { ...p, orgId: currentOrgId, createdBy: currentUser?.id }; const created = await service.createAccountingPeriod(periodWithOrgAndUser); setAccountingPeriods(prev => [...prev, created]); handleNotify('success', 'Period created successfully'); } catch (error) { console.error('Error creating period:', error); handleNotify('error', 'Failed to create period'); } }} onUpdatePeriod={async (id, u) => { try { const service = DataServiceFactory.getService(); const updated = await service.updateAccountingPeriod(id, u); setAccountingPeriods(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p)); handleNotify('success', 'Period updated successfully'); } catch (error) { console.error('Error updating period:', error); handleNotify('error', 'Failed to update period'); } }} onPostJournal={handlePostJournal} onNotify={handleNotify} />}
          {activeTab === 'items' && <ItemsView items={items.filter(i => i.orgId === currentOrgId && !i.isDeleted)} accounts={filteredAccounts} onAddItem={handleAddItem} onUpdateItem={handleUpdateItem} onDeleteItem={handleDeleteItem} />}
          {activeTab === 'sponsors' && (
            <SponsorsView
              orgId={currentOrgId}
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              accounts={filteredAccounts}
              entries={activeJournalEntries}
              lines={filteredLines}
              currency={currentOrg?.currency || 'USD'}
              onAddSponsor={handleAddSponsor}
              onUpdateSponsor={handleUpdateSponsor}
              onDeleteSponsor={handleDeleteSponsor}
            />
          )}
          {activeTab === 'vendors' && <VendorsView orgId={currentOrgId} vendors={vendors.filter(v => v.orgId === currentOrgId && !v.isDeleted)} accounts={filteredAccounts} lines={filteredLines} onAddVendor={handleAddVendor} onUpdateVendor={handleUpdateVendor} onDeleteVendor={handleDeleteVendor} onNotify={handleNotify} />}
          {activeTab === 'assets' && <AssetsView assets={fixedAssets.filter(a => a.orgId === currentOrgId && !a.isDeleted)} accounts={filteredAccounts} lines={filteredLines} entries={activeJournalEntries} onDepreciate={handleDepreciate} onAddAsset={handleAddFixedAsset} onUpdateAsset={handleUpdateFixedAsset} onDeleteAsset={handleDeleteFixedAsset} onNotify={handleNotify} />}

          {/* Inventory Management Views */}
          {activeTab === 'inventory' && <InventoryView items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} reorderPoints={reorderPoints.filter(r => !r.isDeleted)} currency={currentOrg?.currency || 'USD'} onSelectItem={(itemId) => setActiveTab('stock-items')} />}
          {activeTab === 'warehouse-locations' && <WarehouseLocationsView orgId={currentOrgId} locations={warehouseLocations.filter(l => !l.isDeleted)} onAdd={handleAddWarehouseLocation} onUpdate={handleUpdateWarehouseLocation} onDelete={handleDeleteWarehouseLocation} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} organization={currentOrg} />}
          {activeTab === 'stock-items' && <StockItemsView orgId={currentOrgId} items={stockItems.filter(i => !i.isDeleted)} accounts={filteredAccounts} onAdd={handleAddStockItem} onUpdate={handleUpdateStockItem} onDelete={handleDeleteStockItem} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} organization={currentOrg} />}
          {activeTab === 'stock-levels' && <InventoryView items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} reorderPoints={reorderPoints.filter(r => !r.isDeleted)} currency={currentOrg?.currency || 'USD'} organization={currentOrg} />}
          {activeTab === 'stock-adjustments' && <StockAdjustmentsView adjustments={stockAdjustments.filter(a => !a.isDeleted)} items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} locations={warehouseLocations.filter(l => !l.isDeleted)} accounts={filteredAccounts} onAdd={handleAddStockAdjustment} onUpdate={handleUpdateStockAdjustment} onDelete={handleDeleteStockAdjustment} onPostGL={handlePostJournal} currency={currentOrg?.currency || 'USD'} currentUserId={currentUser?.id} isLoading={isLoading} organization={currentOrg} />}
          {activeTab === 'reorder-points' && <ReorderView reorderPoints={reorderPoints.filter(r => !r.isDeleted)} items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} onAdd={handleAddReorderPoint} onUpdate={handleUpdateReorderPoint} onDelete={handleDeleteReorderPoint} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} organization={currentOrg} />}
          {activeTab === 'inventory-transactions' && <InventoryTransactionsView orgId={currentOrgId} transactions={inventoryTransactions.filter(t => !t.isDeleted)} items={stockItems.filter(i => !i.isDeleted)} locations={warehouseLocations.filter(l => !l.isDeleted)} currency={currentOrg?.currency || 'USD'} isLoading={isLoading} organization={currentOrg} />}
          {activeTab === 'inventory-reports' && <AdvancedInventoryReports items={stockItems.filter(i => !i.isDeleted)} levels={inventoryLevels.filter(l => !l.isDeleted)} transactions={inventoryTransactions.filter(t => !t.isDeleted)} lines={filteredLines} currency={currentOrg?.currency || 'USD'} organization={currentOrg} />}
          {activeTab === 'banking' && <BankingView bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)} summaries={summaries} accounts={filteredAccounts} entries={activeJournalEntries} lines={filteredLines} bankReconciliations={bankReconciliations} onAddBankAccount={handleAddBankAccount} onUpdateBankAccount={handleUpdateBankAccount} onDeleteBankAccount={handleDeleteBankAccount} onAddBankReconciliation={handleAddBankReconciliation} onUpdateBankReconciliation={handleUpdateBankReconciliation} onDeleteBankReconciliation={handleDeleteBankReconciliation} onPostTransfer={handlePostJournal} onToggleClearLine={id => setJournalLines(prev => prev.map(l => l.id === id ? { ...l, isCleared: !l.isCleared } : l))} onNotify={handleNotify} />}
          {activeTab === 'checks' && <CheckPrintingView orgId={currentOrgId} checks={checkVouchers} bankAccounts={bankAccounts} vendors={vendors} payables={payables} accounts={filteredAccounts} entries={activeJournalEntries} currentUserId={currentUser?.id} onCreateCheck={handleAddCheckVoucher} onUpdateCheck={handleUpdateCheckVoucher} onDeleteCheck={handleDeleteCheckVoucher} onPostJournal={handlePostJournal} onNotify={handleNotify} />}

          {activeTab === 'branding' && currentOrg && <BrandingView organization={currentOrg} onUpdate={o => handleUpdateOrganization(o.id, o)} />}
          {activeTab === 'subscription' && isSysAdmin && currentOrg && (
            <div className="system-owner-minimal">
              <SubscriptionView organization={currentOrg} onUpdate={o => handleUpdateOrganization(o.id, o)} />
            </div>
          )}
          {activeTab === 'payment-history' && currentOrg && <PaymentHistoryView payments={paymentHistory.filter(p => p.orgId === currentOrgId)} currency={currentOrg.currency} organization={currentOrg} />}

          {activeTab === 'payroll' && <PayrollView employees={employees.filter(e => e.orgId === currentOrgId && !e.isDeleted)} payrollRuns={payrollRuns} payrollLines={payrollLines} accounts={filteredAccounts} bankAccounts={bankAccounts} entries={activeJournalEntries} orgName={currentOrg?.name} onPostPayroll={handlePostPayroll} />}
          {activeTab === 'students' && <StudentsView orgId={currentOrgId} students={students.filter(s => s.orgId === currentOrgId)} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} brandColor={brandColor} onAddStudent={handleAddStudent} onUpdateStudent={handleUpdateStudent} onDeleteStudent={handleDeleteStudent} onBatchAddStudents={handleBatchAddStudents} />}
          {activeTab === 'trainers' && <TrainersView organization={currentOrg} trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} onAddTrainer={handleAddTrainer} onUpdateTrainer={handleUpdateTrainer} onDeleteTrainer={handleDeleteTrainer} />}
          {activeTab === 'qualifications' && <QualificationsView organization={currentOrg} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} onAddQualification={handleAddQualification} onUpdateQualification={handleUpdateQualification} onDeleteQualification={handleDeleteQualification} />}
          {activeTab === 'course-fees' && <CourseFeesView courseFees={courseFees.filter(f => f.orgId === currentOrgId && !f.isDeleted)} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} accounts={filteredAccounts} currency={currentOrg?.currency || 'PHP'} onAddCourseFee={handleAddCourseFee} onUpdateCourseFee={handleUpdateCourseFee} onDeleteCourseFee={handleDeleteCourseFee} />}
          {activeTab === 'batches' && <BatchesView organization={currentOrg} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)} sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)} schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} onAddBatch={handleAddBatch} onUpdateBatch={handleUpdateBatch} onDeleteBatch={handleDeleteBatch} onNotify={handleNotify} />}
          {activeTab === 'alumni-reports' && (
            <AlumniEmploymentView
              organization={currentOrg}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              enrollments={enrollments.filter(e => e.orgId === currentOrgId && !e.isDeleted)}
              alumniReports={alumniReports.filter(r => r.orgId === currentOrgId)}
              batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              onAddReport={handleAddAlumniReport}
              onUpdateReport={handleUpdateAlumniReport}
              onDeleteReport={handleDeleteAlumniReport}
            />
          )}
          {activeTab === 'enrollments' && <EnrollmentsView orgId={currentOrgId} enrollments={enrollments.filter(e => e.orgId === currentOrgId && !e.isDeleted)} students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} currency={currentOrg?.currency || 'PHP'} onAddEnrollment={handleAddEnrollment} onUpdateEnrollment={handleUpdateEnrollment} onDeleteEnrollment={handleDeleteEnrollment} />}
          {activeTab === 'assessment-registrations' && (
            <AssessmentRegistrationsView
              registrations={assessmentRegistrations.filter(r => r.orgId === currentOrgId && !r.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
              onAddRegistration={handleAddAssessmentRegistration}
              onUpdateRegistration={handleUpdateAssessmentRegistration}
              onDeleteRegistration={handleDeleteAssessmentRegistration}
            />
          )}
          {activeTab === 'invoices' && <InvoicesView
            invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
            payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
            sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
            students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
            users={users.filter(u => u.orgId === currentOrgId && !u.isDeleted)}
            enrollments={enrollments.filter(e => e.orgId === currentOrgId && !e.isDeleted)}
            assessmentRegistrations={assessmentRegistrations.filter(r => r.orgId === currentOrgId && !r.isDeleted)}
            batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
            qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)}
            courseFees={courseFees.filter(f => f.orgId === currentOrgId && !f.isDeleted)}
            accounts={filteredAccounts}
            currency={currentOrg?.currency || 'PHP'}
            isVatRegistered={currentOrg?.isVatRegistered || false}
            onAddInvoice={handleAddInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onVoidInvoice={handleVoidInvoice}
            onUpdateEnrollment={handleUpdateEnrollment}
            onUpdateAssessmentRegistration={handleUpdateAssessmentRegistration}
            onAddStudentLedgerEntry={entry => setStudentLedger(prev => [...prev, entry])}
            journalEntries={activeJournalEntries}
            onViewJournal={handleViewJournal}
            onNavigate={navigateTo}
            organization={currentOrg}
            orgId={currentOrgId}
            taxCategories={taxCategories}
          />}
          {activeTab === 'payments' && <PaymentsView
            currentOrgId={currentOrgId}
            organization={currentOrg}
            payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
            sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
            students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
            users={users.filter(u => u.orgId === currentOrgId && !u.isDeleted)}
            invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
            bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
            accounts={filteredAccounts}
            journalEntries={activeJournalEntries}
            currency={currentOrg?.currency || 'PHP'}
            onAddPayment={handleAddPayment}
            onUpdatePayment={handleUpdatePayment}
            onPostPayment={handlePostPayment}
            onDeletePayment={handleDeletePayment}
            onVoidPayment={handleVoidPayment}
            onApplyToInvoice={handleApplyToInvoice}
            onReverseApplication={handleReverseApplication}
            onViewJournal={handleViewJournal}
            initialContext={navigationContext}
            onClearContext={() => setNavigationContext(null)}
          />}
          {activeTab === 'bank-deposits' && <BankDepositsView
            deposits={bankDeposits.filter(d => d.orgId === currentOrgId && !d.isDeleted)}
            bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
            payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
            currency={currentOrg?.currency || 'PHP'}
            onAddDeposit={handleAddBankDeposit}
            onUpdateDeposit={handleUpdateBankDeposit}
            onDeleteDeposit={handleDeleteBankDeposit}
            onVoidDeposit={handleVoidBankDeposit}
            onPostDeposit={async (deposit) => {
              // 1. Update deposit status in state
              setBankDeposits(prev => prev.map(d => d.id === deposit.id ? { ...deposit, status: 'POSTED', postedAt: new Date().toISOString() } : d));

              // 2. Find COA accounts for Undeposited Funds (1000) and Bank Account (1010)
              const coa = accounts.filter(a => a.orgId === currentOrgId);
              const undepositedAcct = coa.find(a => a.code === '1000');
              const bankAcct = coa.find(a => a.code === '1010' && a.id === deposit.bankAccountId);
              // Fallback: if not found by id, just use code 1010
              const bankAccount = bankAccounts.find(b => b.id === deposit.bankAccountId);
              const bankAcctById = coa.find(a => a.id === bankAccount?.accountId);
              const finalBankAcct = bankAcctById || bankAcct;

              if (undepositedAcct && finalBankAcct) {
                // 3. Create Journal Entry for DEPOSIT
                const entry: Partial<JournalEntry> = {
                  orgId: currentOrgId,
                  periodId: deposit.periodId || '',
                  date: deposit.depositDate,
                  description: `Bank Deposit #${deposit.depositNo} `,
                  reference: `DEPOSIT - ${deposit.depositNo} `,
                  status: 'POSTED',
                  sourceType: 'DEPOSIT',
                  sourceRef: deposit.id,
                  createdBy: currentUser?.id || 'system',
                  createdAt: new Date().toISOString(),
                  postedBy: currentUser?.id || 'system',
                  postedAt: new Date().toISOString()
                };
                const lines: JournalLine[] = [
                  {
                    id: `jl-${Date.now()}-1`,
                    journalEntryId: '',
                    orgId: currentOrgId,
                    accountId: finalBankAcct.id,
                    debit: deposit.totalAmount,
                    credit: 0,
                    description: 'Deposit to Bank'
                  },
                  {
                    id: `jl-${Date.now()}-2`,
                    journalEntryId: '',
                    orgId: currentOrgId,
                    accountId: undepositedAcct.id,
                    debit: 0,
                    credit: deposit.totalAmount,
                    description: 'Clear Undeposited Funds'
                  }
                ];
                await handlePostJournal(entry, lines);
              }

              // 4. Mark included payments as deposited
              if (deposit.lines && deposit.lines.length > 0) {
                setPayments(prev => prev.map(p => {
                  const included = deposit.lines?.some(l => l.paymentId === p.id);
                  if (included) {
                    return { ...p, status: 'DEPOSITED', bankAccountId: deposit.bankAccountId, postedAt: new Date().toISOString() };
                  }
                  return p;
                }));
              }

              // 5. Notify
              handleNotify('success', `Deposit #${deposit.depositNo} posted and journal entry created.`);
            }}
          />}
          {activeTab === 'locations' && <LocationsView organization={currentOrg} locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} onAddLocation={handleAddLocation} onUpdateLocation={handleUpdateLocation} onDeleteLocation={handleDeleteLocation} />}
          {activeTab === 'schedules' && <SchedulesView organization={currentOrg} batches={batches.filter(b => b.orgId === currentOrgId && !b.isDeleted)} schedules={schedules.filter(s => s.orgId === currentOrgId && !s.isDeleted)} trainers={trainers.filter(t => t.orgId === currentOrgId && !t.isDeleted)} qualifications={qualifications.filter(q => q.orgId === currentOrgId && !q.isDeleted)} locations={locations.filter(l => l.orgId === currentOrgId && !l.isDeleted)} onAddSchedule={handleAddSchedule} onUpdateSchedule={handleUpdateSchedule} onDeleteSchedule={handleDeleteSchedule} />}

          {activeTab === 'employees' && <EmployeesView
            employees={employees.filter(e => e.orgId === currentOrgId && !e.isDeleted)}
            organization={currentOrg}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
          />}
          {activeTab === 'users' && <UsersManagementView
            users={users.filter(u => u.orgId === currentOrgId)}
            students={students.filter(s => s.orgId === currentOrgId)}
            trainers={trainers.filter(t => t.orgId === currentOrgId)}
            organization={currentOrg}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
          />}
          {activeTab === 'audit' && canViewAuditTrail && <AuditTrail orgId={currentOrgId} logs={auditLogs} brandColor={brandColor} />}
          {activeTab === 'maintenance' && (
            <div className="system-owner-minimal">
              <MaintenanceView logs={auditLogs} onExport={() => { }} onImport={() => { }} />
            </div>
          )}
          {activeTab === 'backup-restore' && (
            <div className="system-owner-minimal">
              <BackupRestoreView
                organizations={organizations}
                currentOrgId={currentOrgId}
                currentUserId={currentUser?.id || ''}
                currentUserName={currentUser?.email || 'System'}
                allData={{
                  organizations, users, students, qualifications, trainers, batches, sponsors,
                  vendors, employees, payrollRuns, journalEntries, JournalLines: journalLines, auditLogs,
                  budgets: [], chartOfAccounts: accounts, purchaseOrders, paymentHistory, payables, accountingPeriods,
                  checkVouchers, eftBatches, goodsReceipts, bankReconciliations, warehouseLocations,
                  stockItems, inventoryLevels, inventoryTransactions, stockAdjustments, nonStockItems: items,
                  fixedAssets, bankAccounts, locations
                }}
                onRestore={handleRestoreBackup}
                onNotify={handleNotify}
                currency={currentOrg?.currency || 'USD'}
              />
            </div>
          )}
          {activeTab === 'tenant-mgmt' && (
            <div className="system-owner-minimal">
              <TenantManagementView organizations={organizations} onAddTenant={handleAddOrganization} onUpdateTenant={(id, updates) => handleUpdateOrganization(id, updates)} />
            </div>
          )}
          {activeTab === 'schema' && (
            <div className="system-owner-minimal">
              <SchemaManualView />
            </div>
          )}
          {activeTab === 'payment-monitoring' && (
            <div className="system-owner-minimal">
              <PaymentMonitoringView payments={payments} organizations={organizations} />
            </div>
          )}
          {activeTab === 'feedback' && (
            <div className={isSysAdmin ? 'system-owner-minimal' : undefined}>
              <FeedbackManagementView
                tickets={feedbackTickets}
                currentUser={currentUser}
                currentOrgId={currentOrgId}
                organizations={organizations}
                users={users}
                brandColor={brandColor}
                onCreateTicket={handleCreateFeedbackTicket}
                onUpdateTicket={handleUpdateFeedbackTicket}
                onNotify={handleNotify}
              />
            </div>
          )}
          {activeTab === 'soa' && (
            <SOAView
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              entries={activeJournalEntries}
              lines={filteredLines}
              accounts={filteredAccounts}
              currency={currentOrg?.currency || 'USD'}
              brandColor={brandColor}
              orgName={currentOrg?.name || 'Institution'}
            />
          )}
          {activeTab === 'aging-report' && (
            <ARAgingReportView
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              entries={activeJournalEntries}
              lines={filteredLines}
              accounts={filteredAccounts}
              invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
              currency={currentOrg?.currency || 'USD'}
              brandColor={brandColor}
            />
          )}
          {activeTab === 'write-off' && (
            <ARWriteOffView
              orgId={currentOrgId}
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
              users={users.filter(u => u.orgId === currentOrgId && !u.isDeleted)}
              entries={activeJournalEntries}
              lines={filteredLines}
              accounts={filteredAccounts}
              currency={currentOrg?.currency || 'USD'}
              onPostJournal={handlePostJournal}
              onSaveJournal={handleSaveJournalDraft}
              onApproveJournal={handleApproveJournal}
              onViewJournal={handleViewJournal}
              onNotify={handleNotify}
              initialContext={navigationContext}
              onClearContext={() => setNavigationContext(null)}
              organization={currentOrg}
              brandColor={brandColor}
            />
          )}
          {activeTab === 'reclassify' && (
            <ReclassificationView
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              entries={activeJournalEntries}
              lines={filteredLines}
              accounts={filteredAccounts}
              currency={currentOrg?.currency || 'USD'}
              brandColor={brandColor}
              currentUser={currentUser}
              onPostJournal={handlePostJournal}
              onViewJournal={handleViewJournal}
              onNotify={handleNotify}
            />
          )}
          {activeTab === 'credit-debit-memo' && (
            <ARCreditDebitMemoView
              orgId={currentOrgId}
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              invoices={invoices.filter(i => i.orgId === currentOrgId && !i.isDeleted)}
              users={users.filter(u => u.orgId === currentOrgId && !u.isDeleted)}
              entries={activeJournalEntries}
              lines={filteredLines}
              accounts={filteredAccounts}
              currency={currentOrg?.currency || 'USD'}
              onPostJournal={handlePostJournal}
              onSaveJournal={handleSaveJournalDraft}
              onUpdateJournal={handleUpdateJournalDraft}
              onApproveJournal={handleApproveJournal}
              onReverseJournal={reverseJournalEntry}
              onViewJournal={handleViewJournal}
              onNotify={handleNotify}
              organization={currentOrg}
              brandColor={brandColor}
            />
          )}
          {activeTab === 'collection-receipt' && (
            <ARCollectionReceiptView
              entries={activeJournalEntries}
              lines={filteredLines}
              payments={payments.filter(p => p.orgId === currentOrgId && !p.isDeleted)}
              bankAccounts={bankAccounts.filter(b => b.orgId === currentOrgId && !b.isDeleted)}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              currency={currentOrg?.currency || 'USD'}
              brandColor={brandColor}
            />
          )}
          {activeTab === 'customer-ledger' && (
            <ARCustomerLedgerView
              entries={activeJournalEntries}
              lines={filteredLines}
              accounts={filteredAccounts}
              students={students.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              sponsors={sponsors.filter(s => s.orgId === currentOrgId && !s.isDeleted)}
              currency={currentOrg?.currency || 'USD'}
              brandColor={brandColor}
            />
          )}

          {activeTab === 'customers' && (
            <CustomerMasterListView
              sponsors={sponsors}
              students={students}
              invoices={invoices}
              enrollments={enrollments}
              batches={batches}
              qualifications={qualifications}
              accounts={accounts}
              brandColor={brandColor}
              onAddSponsor={handleAddSponsor}
              onUpdateSponsor={handleUpdateSponsor}
              onDeleteSponsor={handleDeleteSponsor}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onBatchAddStudents={handleBatchAddStudents}
              onNotify={handleNotify}
            />
          )}

            </>
          )}
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="modal-overlay-graceful fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-[#06162B]/90 px-4 text-white backdrop-blur-xl">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
              backgroundSize: '120px 120px',
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(59,130,246,0.24),transparent_34%),radial-gradient(circle_at_50%_70%,rgba(0,0,0,0.8),transparent_58%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,13,28,0.35)_0%,rgba(4,13,28,0.84)_100%)]" />
          <div className="absolute left-[12%] top-[20%] h-56 w-56 rounded-full bg-[#F47721]/10 blur-3xl" />
          <div className="absolute right-[14%] bottom-[18%] h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="modal-panel-graceful relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-3xl md:p-8">
            <div className="flex items-start gap-4">
              <div className="modal-icon-graceful flex h-12 w-12 shrink-0 items-center justify-center text-[#F47721]">
                <LogOut size={32} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold uppercase tracking-tight text-white">Confirm Logout</h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                  You are about to end your current ERP session.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs font-medium leading-relaxed text-slate-300">
                Any unsaved changes in open forms may be lost.
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="rounded-full border border-white/10 bg-slate-900/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:border-[#F47721]/40 hover:text-[#F47721]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full bg-[#F47721] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_50px_rgba(244,119,33,0.35)] transition-all hover:bg-[#E06610] active:scale-95"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  compact: boolean;
  brandColor: string;
}

function NavItem({ icon, label, active, onClick, compact, brandColor }: NavItemProps) {
  const activeIconUsesBrandStroke = active && ['Customer List', 'Invoice', 'Learners & Customers', 'Invoices'].includes(label);

  return (
    <button
      onClick={onClick}
      title={compact ? label : undefined}
      aria-label={compact ? label : undefined}
      className={`w-full border border-transparent text-left flex items-center gap-4 p-3.5 rounded-2xl outline-none transition-colors group focus:outline-none ${active ? 'text-white shadow-none' : 'text-slate-600 hover:text-brand hover:bg-brand/10 focus-visible:bg-brand/10'} `}
      style={{
        ...(active ? { backgroundColor: brandColor, borderColor: brandColor, boxShadow: 'none' } : {}),
      } as React.CSSProperties}
    >
      <div
        className={`shrink-0 transition-transform duration-500 ${
          activeIconUsesBrandStroke
            ? 'flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 shadow-sm'
            : active
              ? 'scale-110 text-white'
              : 'group-hover:scale-110 text-slate-500 group-hover:text-brand'
        } `}
        style={activeIconUsesBrandStroke ? { color: brandColor } : undefined}
      >
        {icon}
      </div>
      {!compact && <span className="text-[11px] uppercase tracking-widest truncate">{label}</span>}
    </button>
  );
}

interface NavSectionProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  compact: boolean;
  children: React.ReactNode;
}

function NavSection({ label, isOpen, onToggle, compact, children }: NavSectionProps) {
  return (
    <div className="mb-8">
      <button
        onClick={onToggle}
        title={compact ? label : undefined}
        aria-label={compact ? label : undefined}
        className="w-full flex items-center justify-between mb-4 px-4 pb-3 border-b border-slate-200 group"
      >
        {!compact && (
          <p className="text-left text-[10px] text-slate-500 uppercase tracking-[0.3em] group-hover:text-brand transition-colors">
            {label}
          </p>
        )}
        <span className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''} `}>
          ▼
        </span>
      </button>
      {isOpen && <div className="space-y-1">{children}</div>}
    </div>
  );
}
