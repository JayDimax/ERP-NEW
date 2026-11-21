import React, { useMemo, useState, useEffect } from 'react';
import {
  Vendor, Payable, PayableCategory, PayableStatus, InvoiceType, PaymentMethod,
  PayablePaymentMethod, WithholdingType, ChartOfAccount, JournalEntry, JournalLine, AccountClass, BankAccount, PurchaseOrder, Qualification, TaxCategoryEntry, TimeExpense, User
} from '../types';
import * as XLSX from 'xlsx';
import { AccountingService } from '../accountingService';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import { DataServiceFactory } from '../services/DataServiceFactory';
import { fetchAllOpenPayables, getPayableOutstanding } from '../services/APAgingService';
import type { PageFilter } from '../services/IDataService';
import {
  Search, Calculator, Building, Coins, AlertCircle, Calendar,
  X, Plus, FileText, Edit, Trash2, CheckCircle, Clock,
  DollarSign, ChevronDown, RefreshCw, CreditCard,
  BookOpen, Landmark, Receipt, TrendingUp, ArrowRight,
  Percent, Banknote, BarChart3, PieChart, Download, Printer, RotateCcw,
  FileSpreadsheet, Scissors, GripVertical
} from 'lucide-react';

export interface APBillFormLine {
  id?: string;
  lineNumber: number;
  lineType: 'EXPENSE' | 'ITEM' | 'DISCOUNT' | 'ADJUSTMENT';
  expenseAccountId: string;
  qualificationId?: string;
  description: string;
  taxCategoryId?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sourceExpenseId?: string;
}

const CurrencyLineInput: React.FC<{
  value?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}> = ({ value = 0, disabled, onValueChange }) => {
  const formatValue = (amount: number) =>
    new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState(formatValue(value));

  useEffect(() => {
    if (!isFocused) setDraft(formatValue(value));
  }, [value, isFocused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      disabled={disabled}
      onFocus={event => {
        setIsFocused(true);
        setDraft(String(value ?? 0));
        window.setTimeout(() => event.currentTarget.select(), 0);
      }}
      onChange={event => {
        const nextDraft = event.target.value;
        if (!/^-?[\d,]*\.?\d{0,2}$/.test(nextDraft)) return;
        setDraft(nextDraft);
        const parsed = Number(nextDraft.replace(/,/g, ''));
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onBlur={() => {
        setIsFocused(false);
        setDraft(formatValue(value));
      }}
      className="w-full px-2 py-1 rounded text-right text-[13px] font-normal text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed border border-gray-200 focus:border-brand outline-none"
    />
  );
};

interface PayablesViewProps {
  view?: 'bills' | 'aging';
  orgId: string;
  payables: Payable[];
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  qualifications: Qualification[];
  entries: JournalEntry[];
  bankAccounts?: BankAccount[];
  purchaseOrders?: PurchaseOrder[];
  vendorTaxSettings?: any[];
  atcCategories?: any[];
  atcItems?: any[];
  atcRates?: any[];
  employees?: User[];
  taxCategories?: TaxCategoryEntry[];
  currentUserId?: string;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canApprove?: boolean;
  canPay?: boolean;
  canCancel?: boolean;
  onCreatePayable: (payable: Payable) => Payable | Promise<Payable>;
  onUpdatePayable: (id: string, updates: Partial<Payable>) => void | Promise<void>;
  onDeletePayable: (id: string) => void | Promise<void>;
  onPostJournal?: (entry: Partial<JournalEntry>, lines: JournalLine[]) => JournalEntry | null | Promise<JournalEntry | null>;
  onJournalChanged?: () => void | Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', message: string) => void;
}

type APTab = 'list' | 'aging' | 'reconciliation';

const PAYABLE_CATEGORIES: { value: PayableCategory; label: string }[] = [
  { value: 'utilities', label: 'Utilities' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'training_materials', label: 'Training Materials' },
  { value: 'contractor_services', label: 'Contractor Services' },
  { value: 'assessments', label: 'Assessments' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'government_obligations', label: 'Government Obligations' },
  { value: 'scholarship_advances', label: 'Scholarship Advances' },
  { value: 'employee_reimbursements', label: 'Employee Reimbursements' },
  { value: 'other', label: 'Other' },
];

const INVOICE_TYPES: { value: InvoiceType; label: string; color: string }[] = [
  { value: 'standard', label: 'Standard Invoice', color: 'text-gray-600' },
  { value: 'prepayment', label: 'Prepayment/Advance', color: 'text-violet-600' },
];

const PAYMENT_METHODS: { value: PayablePaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'AUTO_DEBIT', label: 'Auto Debit' },
  { value: 'EWALLET', label: 'E-Wallet' },
];

const STATUS_CONFIG: Record<PayableStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  for_approval: { label: 'On Hold', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  approved: { label: 'Posted', color: 'text-brand', bgColor: 'bg-brand/10', borderColor: 'border-brand-light' },
  paid: { label: 'Paid', color: 'text-brand', bgColor: 'bg-brand/10', borderColor: 'border-brand-light' },
  partially_paid: { label: 'Partially Paid', color: 'text-violet-600', bgColor: 'bg-violet-50', borderColor: 'border-violet-200' },
  cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
};

const formatPayableDate = (value?: string) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const PAGE_SIZE = 10;
const PAYABLE_COLUMNS = 'id,org_id,vendor_id,payable_number,category,qualification_id,description,amount,bill_date,due_date,payment_date,currency,status,reference_document,journal_entry_id,gl_account_id,expense_account_id,expense_allocations,claimed_by,employee_id,notes,withholding_type,atc_item_id,atc_rate_id,applied_rate_percent,withholding_amount,net_payable,paid_amount,memo_adjustment_total,invoice_type,input_vat_amount,input_vat_account_id,payment_method,payment_bank_account_id,check_number,check_date,reversal_journal_id,created_by,approved_by,paid_by,created_at,updated_at,approved_at,paid_at,is_deleted,deleted_at,deleted_by';

const getPayableVatInclusiveAmount = (payable: Payable) =>
  Math.round((Number(payable.amount || 0) + Number(payable.inputVatAmount || 0)) * 100) / 100;
const getPayableClaimant = (payable: Payable) => {
  if (payable.claimedBy?.trim()) return payable.claimedBy.trim();
  const claimant = payable.notes?.match(/(?:Reimburse|Claimed by):\s*([^\r\n]+)/i)?.[1]?.trim();
  return claimant || '—';
};
const normalizeClaimant = (value?: string) => (value || '').trim().toLocaleLowerCase();
const getPayeeKey = (payable: Payable) =>
  payable.vendorId ? `vendor:${payable.vendorId}` : `employee:${payable.employeeId || ''}`;

const PayablesView: React.FC<PayablesViewProps> = ({
  view = 'bills',
  orgId,
  payables,
  vendors,
  accounts,
  qualifications = [],
  entries,
  bankAccounts = [],
  purchaseOrders = [],
  vendorTaxSettings = [],
  atcCategories = [],
  atcItems = [],
  atcRates = [],
  employees = [],
  taxCategories = [],
  currentUserId,
  canCreate = false,
  canEdit = false,
  canDelete = false,
  canApprove = false,
  canPay = false,
  canCancel = false,
  onCreatePayable,
  onUpdatePayable,
  onDeletePayable,
  onPostJournal,
  onJournalChanged,
  onNotify
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [activeTab, setActiveTab] = useState<APTab>(view === 'aging' ? 'aging' : 'list');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayableStatus | 'all'>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPostGLModal, setShowPostGLModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedPayable, setSelectedPayable] = useState<Payable | null>(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [paymentPayables, setPaymentPayables] = useState<Payable[]>([]);
  const [paymentAllocations, setPaymentAllocations] = useState<Record<string, number>>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverPayables, setServerPayables] = useState<Payable[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');
  const [agingPayables, setAgingPayables] = useState<Payable[] | null>(null);
  const [isLoadingAging, setIsLoadingAging] = useState(false);
  const [agingLoadError, setAgingLoadError] = useState('');
  const [isSavingPayable, setIsSavingPayable] = useState(false);
  const [timeExpenses, setTimeExpenses] = useState<TimeExpense[]>([]);
  const claimableEmployees = useMemo(
    () => employees
      .filter(employee => employee.role !== 'SYSTEM_ADMIN' && employee.role !== 'STUDENT' && !employee.isDeleted)
      .sort((a, b) => {
        if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
        if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
        return a.name.localeCompare(b.name);
      }),
    [employees],
  );

  // Form state for Create/Edit
  const [formData, setFormData] = useState<Partial<Payable>>({
    vendorId: '',
    payableNumber: '',
    category: 'other',
    qualificationId: '',
    description: '',
    amount: 0,
    billDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date().toISOString().slice(0, 10),
    currency: 'PHP',
    status: 'for_approval',
    referenceDocument: '',
    glAccountId: '',
    expenseAccountId: '',
    claimedBy: '',
    employeeId: '',
    notes: '',
    withholdingType: undefined,
    appliedRatePercent: 0,
    withholdingAmount: 0,
    netPayable: 0,
    invoiceType: 'standard',
    inputVatAmount: 0,
  });

  // Payment form state
  const [paymentData, setPaymentData] = useState({
    paymentMethod: 'BANK_TRANSFER' as PayablePaymentMethod,
    bankAccountId: '',
    checkNumber: '',
    checkDate: '',
    amountPaid: 0,
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const allocatedPaymentTotal = Object.values(paymentAllocations).reduce((sum, amount) => sum + (Number(amount) || 0), 0);
  const vendorPaymentOutstanding = paymentPayables.reduce((sum, payable) => sum + getPayableOutstanding(payable), 0);
  const [inlineDescriptionDrafts, setInlineDescriptionDrafts] = useState<Record<string, string>>({});
  const [savingDescriptionId, setSavingDescriptionId] = useState<string | null>(null);

  const isConsolidatedTimeExpensePayable = (payable: Payable): boolean =>
    payable.category === 'employee_reimbursements' &&
    Boolean(payable.expenseAllocations?.some(alloc => Boolean(alloc.sourceExpenseId)) || payable.expenseAllocations?.length);

  const isAutoGeneratedExpenseCodeDescription = (payable: Payable): boolean => {
    if (!isConsolidatedTimeExpensePayable(payable)) return false;
    const desc = (payable.description || '').trim();
    if (!desc) return false;
    return /^Employee reimbursement for .+:\s*(F\.?R\.?\s*No\.?|RFQ)/i.test(desc);
  };

  const isAutoGeneratedExpenseCodeReference = (payable: Payable): boolean => {
    if (!isConsolidatedTimeExpensePayable(payable)) return false;
    const ref = (payable.referenceDocument || '').trim();
    if (!ref) return false;
    return /^(F\.?R\.?\s*No\.?|RFQ)/i.test(ref);
  };

  const getEditablePayableDescription = (payable: Payable): string => {
    if (payable.status === 'for_approval' && isAutoGeneratedExpenseCodeDescription(payable)) {
      return '';
    }
    return payable.description || '';
  };

  const handleInlineDescriptionSave = async (payable: Payable) => {
    if (!canEdit || payable.status !== 'for_approval' || !!payable.journalEntryId) return;
    const draft = inlineDescriptionDrafts[payable.id];
    if (draft === undefined) return;
    const nextDescription = draft.trim();
    const currentDisplayed = getEditablePayableDescription(payable).trim();
    const hasAutoGeneratedRef = isAutoGeneratedExpenseCodeReference(payable);
    const hasAutoGeneratedDesc = isAutoGeneratedExpenseCodeDescription(payable);

    if (nextDescription === currentDisplayed && !hasAutoGeneratedDesc) {
      setInlineDescriptionDrafts(prev => {
        const next = { ...prev };
        delete next[payable.id];
        return next;
      });
      return;
    }

    const updates: Partial<Payable> = {
      description: nextDescription,
      ...(hasAutoGeneratedRef ? { referenceDocument: '' } : {}),
      updatedAt: new Date().toISOString(),
    };

    setSavingDescriptionId(payable.id);
    try {
      await onUpdatePayable(payable.id, updates);
      setServerPayables(prev => prev.map(row => row.id === payable.id ? { ...row, ...updates } : row));
      setInlineDescriptionDrafts(prev => {
        const next = { ...prev };
        delete next[payable.id];
        return next;
      });
      setRefreshKey(key => key + 1);
    } catch {
      // Keep draft so the user can retry if save failed
    } finally {
      setSavingDescriptionId(null);
    }
  };

  // ============================================================================
  // MULTI-TENANT FILTERING
  // ============================================================================
  const orgPayables = useMemo(() =>
    (view === 'aging' && agingPayables !== null ? agingPayables : payables)
      .filter(p => p.orgId === orgId && !p.isDeleted),
    [agingPayables, orgId, payables, view]
  );

  const orgVendors = useMemo(() =>
    vendors.filter(v => v.orgId === orgId && !v.isDeleted),
    [vendors, orgId]
  );

  const orgAccounts = useMemo(() =>
    accounts.filter(a => a.orgId === orgId && !a.isDeleted),
    [accounts, orgId]
  );

  const orgEntries = useMemo(() =>
    entries.filter(e => e.orgId === orgId && e.status !== 'REVERSED'),
    [entries, orgId]
  );

  const orgBankAccounts = useMemo(() =>
    bankAccounts.filter(b => b.orgId === orgId && !b.isDeleted),
    [bankAccounts, orgId]
  );

  const orgVendorTaxSettings = useMemo(() =>
    vendorTaxSettings.filter((s: any) => s.orgId === orgId),
    [vendorTaxSettings, orgId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (!orgId) return;
    DataServiceFactory.getService().getTimeExpensesByOrg(orgId)
      .then(setTimeExpenses)
      .catch(error => console.error('[PayablesView] Failed to load linked time expenses:', error));
  }, [orgId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, orgId, statusFilter, vendorFilter]);

  const payableFilters = useMemo(() => {
    const filters: PageFilter[] = [
      { column: 'org_id', operator: 'eq', value: orgId },
      { column: 'is_deleted', operator: 'eq', value: false }
    ];

    if (statusFilter !== 'all') {
      filters.push({ column: 'status', operator: 'eq', value: statusFilter });
    }
    if (vendorFilter !== 'all') {
      filters.push({ column: 'vendor_id', operator: 'eq', value: vendorFilter });
    }

    return filters;
  }, [orgId, statusFilter, vendorFilter]);

  useEffect(() => {
    if (!orgId || activeTab !== 'list') return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<Payable>('payables', {
      page: currentPage,
      pageSize: PAGE_SIZE,
      columns: PAYABLE_COLUMNS,
      filters: payableFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['payable_number', 'description', 'reference_document'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: [{ column: 'bill_date', ascending: false }, { column: 'created_at', ascending: false }]
    })
      .then(result => {
        if (!isActive) return;
        setServerPayables(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[PayablesView] Failed to load payable page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load payables.');
        setServerPayables([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingPage(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeTab, currentPage, debouncedSearchTerm, orgId, payableFilters, refreshKey]);

  useEffect(() => {
    if (!orgId || view !== 'aging') return;

    let isActive = true;
    setIsLoadingAging(true);
    setAgingLoadError('');
    setAgingPayables(null);

    fetchAllOpenPayables(DataServiceFactory.getService(), orgId, PAYABLE_COLUMNS)
      .then(rows => {
        if (isActive) setAgingPayables(rows);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[PayablesView] Failed to load AP aging transactions:', error);
        setAgingLoadError(error instanceof Error ? error.message : 'Failed to load AP aging transactions.');
      })
      .finally(() => {
        if (isActive) setIsLoadingAging(false);
      });

    return () => {
      isActive = false;
    };
  }, [orgId, view]);

  // Bills may capitalize an asset or recognize an expense.
  const expenseAccounts = useMemo(() =>
    orgAccounts.filter(a => (a.class === AccountClass.EXPENSE || a.class === AccountClass.ASSET) && !a.isHeader),
    [orgAccounts]
  );

  const liabilityAccounts = useMemo(() =>
    orgAccounts.filter(a => a.class === AccountClass.LIABILITY && !a.isHeader),
    [orgAccounts]
  );

  const assetAccounts = useMemo(() =>
    orgAccounts.filter(a => a.class === AccountClass.ASSET && !a.isHeader),
    [orgAccounts]
  );

  // Find AP control account and withholding tax payable account
  const apControlAccount = useMemo(() =>
    liabilityAccounts.find(a => a.code?.startsWith('2100') || a.name.toLowerCase().includes('accounts payable')),
    [liabilityAccounts]
  );

  const withholdingTaxAccount = useMemo(() =>
    liabilityAccounts.find(a => a.name.toLowerCase().includes('withholding') || a.code?.startsWith('2150')),
    [liabilityAccounts]
  );

  const inputVatAccount = useMemo(() =>
    assetAccounts.find(a => a.name.toLowerCase().includes('input vat') || a.name.toLowerCase().includes('input tax') || a.code?.startsWith('1170')),
    [assetAccounts]
  );

  // ============================================================================
  // AUTO-GENERATE REFERENCE NUMBER
  // ============================================================================
  const nextPayableNumber = useMemo(() => {
    const prefix = 'BILL';
    const year = new Date().getFullYear();
    const matcher = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
    const highestSequence = payables
      .filter(payable => payable.orgId === orgId)
      .reduce((highest, payable) => {
        const match = payable.payableNumber?.match(matcher);
        return match ? Math.max(highest, Number(match[1])) : highest;
      }, 0);

    return `${prefix}-${year}-${String(highestSequence + 1).padStart(5, '0')}`;
  }, [formData.invoiceType, orgId, payables]);

  useEffect(() => {
    if (showCreateModal) {
      setFormData(prev => prev.payableNumber === nextPayableNumber
        ? prev
        : { ...prev, payableNumber: nextPayableNumber });
    }
  }, [showCreateModal, nextPayableNumber]);

  // ============================================================================
  // AUTO-RESOLVE WITHHOLDING FROM VENDOR TAX SETTINGS
  // ============================================================================
  useEffect(() => {
    if (!formData.vendorId) {
      setFormData(prev => {
        if (!prev.withholdingType && !prev.appliedRatePercent && !prev.withholdingAmount) return prev;
        return {
          ...prev,
          withholdingType: undefined,
          appliedRatePercent: 0,
          withholdingAmount: 0,
        };
      });
      return;
    }

    const setting = orgVendorTaxSettings.find((s: any) => s.vendorId === formData.vendorId && s.isActive);
    if (!setting) {
      setFormData(prev => {
        if (!prev.withholdingType && !prev.appliedRatePercent && !prev.withholdingAmount) return prev;
        return {
          ...prev,
          withholdingType: undefined,
          appliedRatePercent: 0,
          withholdingAmount: 0,
        };
      });
      return;
    }

    // Resolve rate from atcRates
    let rateRow: any | undefined = undefined;
    if (setting.atcRateId) {
      rateRow = atcRates.find((r: any) => r.id === setting.atcRateId);
    } else if (setting.atcItemId && setting.withholdingType) {
      const candidates = atcRates.filter((r: any) => r.atcItemId === setting.atcItemId && r.withholdingType === setting.withholdingType);
      candidates.sort((a: any, b: any) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
      rateRow = candidates[0];
    }

    const rate = rateRow?.ratePercent ?? 0;
    setFormData(prev => {
      if (prev.withholdingType === setting.withholdingType && prev.appliedRatePercent === rate) return prev;
      return { ...prev, withholdingType: setting.withholdingType, appliedRatePercent: rate };
    });
  }, [formData.vendorId, orgVendorTaxSettings, atcRates]);

  // ============================================================================
  // AUTO-CALCULATE WITHHOLDING & NET PAYABLE
  // ============================================================================
  useEffect(() => {
    const amount = formData.amount || 0;
    const rate = formData.appliedRatePercent || 0;
    const inputVat = formData.inputVatAmount || 0;
    const withholdingAmount = Number((amount * rate).toFixed(2));
    // For credit memos, net payable is negative
    const netPayable = Number((amount + inputVat - withholdingAmount).toFixed(2));

    setFormData(prev => {
      if (prev.withholdingAmount === withholdingAmount && prev.netPayable === netPayable) return prev;
      return {
        ...prev,
        withholdingAmount,
        netPayable,
      };
    });
  }, [formData.amount, formData.appliedRatePercent, formData.inputVatAmount, formData.invoiceType]);

  // Auto-calculate due date based on vendor payment terms
  useEffect(() => {
    if (formData.vendorId && formData.billDate) {
      const vendor = orgVendors.find(v => v.id === formData.vendorId);
      if (vendor?.paymentTermsDays !== undefined) {
        const billDate = new Date(formData.billDate);
        billDate.setDate(billDate.getDate() + vendor.paymentTermsDays);
        setFormData(prev => ({ ...prev, dueDate: billDate.toISOString().slice(0, 10) }));
      }
    }
  }, [formData.vendorId, formData.billDate, orgVendors]);

  // ============================================================================
  // FILTERING & SEARCHING
  // ============================================================================
  const filteredPayables = useMemo(() => {
    const normalizedSearch = debouncedSearchTerm.trim().toLowerCase();

    return orgPayables
      .filter(p => {
        const vendorName = orgVendors.find(v => v.id === p.vendorId)?.name || '';
        const statusLabel = STATUS_CONFIG[p.status]?.label || '';
        const qualification = qualifications.find(q => q.id === p.qualificationId);
        const categoryLabel = qualification ? `${qualification.code} ${qualification.name}` : (PAYABLE_CATEGORIES.find(c => c.value === p.category)?.label || p.category);
        const searchableText = [
          p.payableNumber,
          p.description,
          vendorName,
          p.referenceDocument || '',
          p.billDate,
          p.dueDate,
          categoryLabel,
          statusLabel,
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        const matchesVendor = vendorFilter === 'all' || p.vendorId === vendorFilter;

        return matchesSearch && matchesStatus && matchesVendor;
      })
      .sort((a, b) => (b.billDate || '').localeCompare(a.billDate || ''));
  }, [orgPayables, debouncedSearchTerm, statusFilter, vendorFilter, orgVendors, qualifications]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedPayables,
    setCurrentPage: setFallbackCurrentPage
  } = usePaginatedRows(filteredPayables, [debouncedSearchTerm, statusFilter, vendorFilter], PAGE_SIZE);

  const useFallbackRows = !orgId || !!pageLoadError;
  const paginatedPayables = useFallbackRows ? fallbackPaginatedPayables : serverPayables;
  const totalItems = useFallbackRows ? filteredPayables.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const activePage = useFallbackRows ? fallbackCurrentPage : currentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (currentPage - 1) * PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + serverPayables.length, serverTotal);
  const handlePageChange = useFallbackRows ? setFallbackCurrentPage : setCurrentPage;
  const payablePaymentEligible = (payable: Payable) =>
    (payable.status === 'approved' || payable.status === 'partially_paid') && !!payable.journalEntryId;
  const eligiblePagePayables = paginatedPayables.filter(payablePaymentEligible);
  const allEligiblePageSelected = eligiblePagePayables.length > 0 && eligiblePagePayables.every(payable => selectedPaymentIds.includes(payable.id));

  const togglePagePaymentSelection = () => {
    const pageIds = eligiblePagePayables.map(payable => payable.id);
    setSelectedPaymentIds(current => allEligiblePageSelected
      ? current.filter(id => !pageIds.includes(id))
      : Array.from(new Set([...current, ...pageIds]))
    );
  };

  useEffect(() => {
    setSelectedPaymentIds([]);
  }, [activePage, debouncedSearchTerm, statusFilter, vendorFilter, orgId]);

  const hasActiveListFilters =
    searchTerm.trim() !== '' ||
    statusFilter !== 'all' ||
    vendorFilter !== 'all';

  const handleExportExcel = () => {
    const rows = filteredPayables.map(payable => {
      const qualification = qualifications.find(item => item.id === payable.qualificationId);
      const category = qualification
        ? `${qualification.code} - ${qualification.name}`
        : PAYABLE_CATEGORIES.find(item => item.value === payable.category)?.label || payable.category;

      return {
        'Bill Date': payable.billDate,
        'Due Date': payable.dueDate,
        'Document Number': payable.payableNumber,
        Vendor: orgVendors.find(vendor => vendor.id === payable.vendorId)?.name || 'Unknown Vendor',
        'Claimed By': getPayableClaimant(payable),
        Category: category,
        Description: payable.description,
        Amount: getPayableVatInclusiveAmount(payable),
        'Input VAT': payable.inputVatAmount || 0,
        Withholding: payable.withholdingAmount || 0,
        'Net Payable': payable.netPayable || payable.amount,
        'Paid Amount': payable.paidAmount || 0,
        Outstanding: getPayableOutstanding(payable),
        Status: STATUS_CONFIG[payable.status]?.label || payable.status,
        'Reference Document': payable.referenceDocument || '',
      };
    });

    if (rows.length === 0) {
      onNotify('info', 'There are no matching payables to export.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = Object.keys(rows[0]).map(key => ({
      wch: Math.min(45, Math.max(key.length + 2, ...rows.map(row => String(row[key as keyof typeof row] ?? '').length + 2))),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Payables');
    XLSX.writeFile(workbook, `Payables_${new Date().toISOString().slice(0, 10)}.xlsx`);
    onNotify('success', `Exported ${rows.length} payable${rows.length === 1 ? '' : 's'} to Excel.`);
  };

  // ============================================================================
  // SUMMARY METRICS
  // ============================================================================
  const summaryMetrics = useMemo(() => {
    const openPayables = orgPayables.filter(p => p.status !== 'paid' && p.status !== 'cancelled');
    const total = openPayables.reduce((sum, p) => sum + getPayableOutstanding(p), 0);
    const forApproval = orgPayables.filter(p => p.status === 'for_approval').reduce((sum, p) => sum + getPayableOutstanding(p), 0);
    const approved = orgPayables.filter(p => p.status === 'approved' || p.status === 'partially_paid').reduce((sum, p) => sum + getPayableOutstanding(p), 0);
    const paid = orgPayables.reduce((sum, p) => sum + (p.paidAmount || (p.status === 'paid' ? (p.netPayable || p.amount) : 0)), 0);

    const today = new Date();
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoon = openPayables.filter(p =>
      new Date(p.dueDate) <= sevenDaysFromNow
    ).reduce((sum, p) => sum + getPayableOutstanding(p), 0);

    const overdue = openPayables.filter(p => new Date(p.dueDate) < today)
      .reduce((sum, p) => sum + getPayableOutstanding(p), 0);

    return { total, forApproval, approved, paid, dueSoon, overdue };
  }, [orgPayables]);

  // ============================================================================
  // AGING BUCKETS
  // ============================================================================
  const agingBuckets = useMemo(() => {
    const today = new Date();
    const buckets = {
      current: { count: 0, amount: 0 },
      days30: { count: 0, amount: 0 },
      days60: { count: 0, amount: 0 },
      days90: { count: 0, amount: 0 },
      days120Plus: { count: 0, amount: 0 }
    };

    const openPayables = orgPayables.filter(p =>
      p.status !== 'paid' && p.status !== 'cancelled' &&
      (vendorFilter === 'all' || p.vendorId === vendorFilter)
    );

    openPayables.forEach(p => {
      const dueDate = new Date(p.dueDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = getPayableOutstanding(p);

      if (daysOverdue <= 0) {
        buckets.current.count++;
        buckets.current.amount += amount;
      } else if (daysOverdue <= 30) {
        buckets.days30.count++;
        buckets.days30.amount += amount;
      } else if (daysOverdue <= 60) {
        buckets.days60.count++;
        buckets.days60.amount += amount;
      } else if (daysOverdue <= 90) {
        buckets.days90.count++;
        buckets.days90.amount += amount;
      } else {
        buckets.days120Plus.count++;
        buckets.days120Plus.amount += amount;
      }
    });

    return buckets;
  }, [orgPayables, vendorFilter]);

  // ============================================================================
  // VENDOR BALANCES FOR RECONCILIATION
  // ============================================================================
  const vendorBalances = useMemo(() => {
    const balances: Record<string, { vendor: Vendor; balance: number; invoiceCount: number }> = {};

    orgPayables.filter(p => p.status !== 'cancelled').forEach(p => {
      if (!balances[p.vendorId]) {
        const vendor = orgVendors.find(v => v.id === p.vendorId);
        if (vendor) {
          balances[p.vendorId] = { vendor, balance: 0, invoiceCount: 0 };
        }
      }
      if (balances[p.vendorId]) {
        const amount = getPayableOutstanding(p);
        if (p.status === 'paid') {
          // Paid invoices don't add to balance
        } else if (p.invoiceType === 'credit_memo') {
          balances[p.vendorId].balance -= Math.abs(amount);
        } else {
          balances[p.vendorId].balance += amount;
        }
        balances[p.vendorId].invoiceCount++;
      }
    });

    return Object.values(balances).sort((a, b) => b.balance - a.balance);
  }, [orgPayables, orgVendors]);

  // Total AP Subledger
  const totalApSubledger = useMemo(() =>
    vendorBalances.reduce((sum, v) => sum + v.balance, 0),
    [vendorBalances]
  );

  // ============================================================================
  // FORM HANDLERS
  // ============================================================================
  const resetForm = () => {
    setFormData({
      vendorId: '',
      payableNumber: '',
      category: 'other',
      qualificationId: '',
      description: '',
      amount: 0,
      billDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      currency: 'PHP',
      status: 'for_approval',
      referenceDocument: '',
      glAccountId: '',
      expenseAccountId: '',
      claimedBy: '',
      employeeId: '',
      notes: '',
      withholdingType: undefined,
      appliedRatePercent: 0,
      withholdingAmount: 0,
      netPayable: 0,
      invoiceType: 'standard',
      inputVatAmount: 0,
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: 0,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
  };

  const populateEditForm = (payable: Payable) => {
    const recordedClaimant = getPayableClaimant(payable).replace(/^—$/, '');
    const selectedEmployee = claimableEmployees.find(employee => employee.id === payable.employeeId)
      || claimableEmployees.find(employee => normalizeClaimant(employee.name) === normalizeClaimant(recordedClaimant));
    setSelectedPayable(payable);
    setFormData({
      vendorId: payable.vendorId,
      payableNumber: payable.payableNumber,
      category: payable.category,
      qualificationId: payable.qualificationId || '',
      description: getEditablePayableDescription(payable),
      amount: payable.amount,
      billDate: payable.billDate,
      dueDate: payable.dueDate,
      currency: payable.currency || 'PHP',
      status: payable.status,
      referenceDocument: payable.status === 'for_approval' && isAutoGeneratedExpenseCodeReference(payable)
        ? ''
        : (payable.referenceDocument || ''),
      glAccountId: payable.glAccountId || '',
      expenseAccountId: payable.expenseAccountId || '',
      expenseAllocations: payable.expenseAllocations || [],
      claimedBy: selectedEmployee?.name || recordedClaimant,
      employeeId: selectedEmployee?.id || '',
      notes: payable.notes || '',
      withholdingType: payable.withholdingType,
      appliedRatePercent: payable.appliedRatePercent || 0,
      withholdingAmount: payable.withholdingAmount || 0,
      netPayable: payable.netPayable || payable.amount,
      invoiceType: payable.invoiceType || 'standard',
      inputVatAmount: payable.inputVatAmount || 0,
    });
    setShowEditModal(true);
  };

  const openEditModal = async (payable: Payable) => {
    try {
      const result = await DataServiceFactory.getService().fetchPage<Payable>('payables', {
        page: 1,
        pageSize: 1,
        columns: PAYABLE_COLUMNS,
        filters: [
          { column: 'id', operator: 'eq', value: payable.id },
          { column: 'org_id', operator: 'eq', value: orgId }
        ]
      });
      populateEditForm(result.rows[0] || payable);
    } catch (error) {
      console.error('[PayablesView] Failed to refresh payable for editing:', error);
      populateEditForm(payable);
      onNotify('info', 'Using the currently loaded bill details because the latest record could not be refreshed.');
    }
  };

  const openViewModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setShowViewModal(true);
  };

  const openPaymentModal = async (payable: Payable) => {
    if (!canPay) {
      onNotify('error', 'You do not have permission to pay AP bills.');
      return;
    }
    const payeeKey = getPayeeKey(payable);
    let vendorPayables = orgPayables.filter(candidate =>
      getPayeeKey(candidate) === payeeKey &&
      payablePaymentEligible(candidate) &&
      getPayableOutstanding(candidate) > 0
    );
    try {
      const result = await DataServiceFactory.getService().fetchPage<Payable>('payables', {
        page: 1,
        pageSize: 200,
        columns: PAYABLE_COLUMNS,
        filters: [
          { column: 'org_id', operator: 'eq', value: orgId },
          { column: payable.vendorId ? 'vendor_id' : 'employee_id', operator: 'eq', value: payable.vendorId || payable.employeeId },
          { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
          { column: 'is_deleted', operator: 'eq', value: false }
        ],
        orderBy: [{ column: 'due_date', ascending: true }, { column: 'bill_date', ascending: true }]
      });
      vendorPayables = result.rows.filter(candidate => payablePaymentEligible(candidate) && getPayableOutstanding(candidate) > 0);
    } catch (error) {
      console.error('[PayablesView] Failed to load vendor payables for payment:', error);
    }
    setSelectedPayable(payable);
    setPaymentPayables(vendorPayables);
    const remainingAmount = getPayableOutstanding(payable);
    setPaymentAllocations(allocatePaymentOldestFirst(vendorPayables, remainingAmount));
    setPaymentData({
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: remainingAmount,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const allocatePaymentOldestFirst = (payablesToAllocate: Payable[], paymentAmount: number) => {
    let remaining = Math.max(0, paymentAmount);
    return [...payablesToAllocate]
      .sort((a, b) => (a.dueDate || a.billDate).localeCompare(b.dueDate || b.billDate))
      .reduce<Record<string, number>>((allocations, payable) => {
        const allocated = Math.min(getPayableOutstanding(payable), remaining);
        allocations[payable.id] = Math.round(allocated * 100) / 100;
        remaining = Math.round((remaining - allocated) * 100) / 100;
        return allocations;
      }, {});
  };

  const openMultiplePaymentModal = async () => {
    const selected = paginatedPayables.filter(payable =>
      selectedPaymentIds.includes(payable.id) &&
      payablePaymentEligible(payable)
    );
    if (selected.length === 0) {
      onNotify('error', 'Select at least one approved payable to process.');
      return;
    }
    const payeeKeys = Array.from(new Set(selected.map(getPayeeKey)));
    if (payeeKeys.length !== 1) {
      onNotify('error', 'Multiple payments can only be processed for one supplier or claimant at a time.');
      return;
    }
    const selectedPayee = selected[0];
    let vendorPayables = orgPayables.filter(payable =>
      getPayeeKey(payable) === payeeKeys[0] && payablePaymentEligible(payable) && getPayableOutstanding(payable) > 0
    );
    try {
      const result = await DataServiceFactory.getService().fetchPage<Payable>('payables', {
        page: 1,
        pageSize: 200,
        columns: PAYABLE_COLUMNS,
        filters: [
          { column: 'org_id', operator: 'eq', value: orgId },
          { column: selectedPayee.vendorId ? 'vendor_id' : 'employee_id', operator: 'eq', value: selectedPayee.vendorId || selectedPayee.employeeId },
          { column: 'status', operator: 'in', value: ['approved', 'partially_paid'] },
          { column: 'is_deleted', operator: 'eq', value: false }
        ],
        orderBy: [{ column: 'due_date', ascending: true }, { column: 'bill_date', ascending: true }]
      });
      vendorPayables = result.rows.filter(payable => payablePaymentEligible(payable) && getPayableOutstanding(payable) > 0);
    } catch (error) {
      console.error('[PayablesView] Failed to load vendor payables for allocation:', error);
    }
    const totalOutstanding = vendorPayables.reduce((sum, payable) => sum + getPayableOutstanding(payable), 0);
    const initialPayment = Math.min(
      selected.reduce((sum, payable) => sum + getPayableOutstanding(payable), 0),
      totalOutstanding
    );
    setSelectedPayable(null);
    setPaymentPayables(vendorPayables);
    setPaymentAllocations(allocatePaymentOldestFirst(vendorPayables, initialPayment));
    setPaymentData({
      paymentMethod: 'BANK_TRANSFER',
      bankAccountId: '',
      checkNumber: '',
      checkDate: '',
      amountPaid: initialPayment,
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const openPostGLModal = (payable: Payable) => {
    setSelectedPayable(payable);
    setShowPostGLModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      onNotify('error', 'You do not have permission to create AP bills.');
      return;
    }

    const isEmployeeReimbursement = formData.category === 'employee_reimbursements' && !!formData.expenseAllocations?.length;
    if (!formData.vendorId && !isEmployeeReimbursement) {
      onNotify('error', 'Please select a vendor.');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      onNotify('error', 'Please enter a valid amount.');
      return;
    }
    if (!formData.expenseAccountId && formData.invoiceType === 'standard') {
      onNotify('error', 'Please select an expense account.');
      return;
    }
    if (!formData.qualificationId && !formData.expenseAllocations?.length) {
      onNotify('error', 'Please select a class.');
      return;
    }
    const selectedEmployee = claimableEmployees.find(employee => employee.id === formData.employeeId);
    if (formData.expenseAllocations?.length && !selectedEmployee) {
      onNotify('error', 'Please select the employee who claimed the consolidated expenses.');
      return;
    }
    const allocationTotal = (formData.expenseAllocations || []).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
    if (formData.expenseAllocations?.some(allocation => !allocation.expenseAccountId || !allocation.qualificationId || !(Number(allocation.amount) > 0))) {
      onNotify('error', 'Every consolidated expense line requires an expense account, class, and amount greater than zero.');
      return;
    }

    const selectedVendor = orgVendors.find(v => v.id === formData.vendorId);
    if (!selectedVendor && !isEmployeeReimbursement) {
      onNotify('error', 'Selected vendor not found.');
      return;
    }

    const apAccountId = formData.glAccountId || selectedVendor?.apAccountId || apControlAccount?.id;

    const newPayable: Payable = {
      id: `pay-${Date.now()}`,
      orgId,
      vendorId: formData.vendorId || undefined,
      payableNumber: nextPayableNumber,
      category: (formData.category || (isEmployeeReimbursement ? 'employee_reimbursements' : 'supplies')) as PayableCategory,
      qualificationId: formData.qualificationId,
      description: formData.description || (selectedVendor ? `Payable from ${selectedVendor.name}` : `Reimbursement for ${selectedEmployee?.name || 'Employee'}`),
      amount: formData.amount!,
      billDate: formData.billDate!,
      dueDate: formData.dueDate!,
      paymentDate: undefined,
      currency: formData.currency || 'PHP',
      status: 'for_approval',
      referenceDocument: formData.referenceDocument,
      journalEntryId: undefined,
      glAccountId: apAccountId,
      expenseAccountId: formData.expenseAccountId,
      expenseAllocations: formData.expenseAllocations,
      claimedBy: selectedEmployee?.name || undefined,
      employeeId: selectedEmployee?.id || undefined,
      notes: formData.notes,
      withholdingType: formData.withholdingType,
      atcItemId: undefined,
      atcRateId: undefined,
      appliedRatePercent: formData.appliedRatePercent,
      withholdingAmount: formData.withholdingAmount,
      netPayable: formData.expenseAllocations?.length
        ? Math.round((allocationTotal + Number(formData.inputVatAmount || 0) - Number(formData.withholdingAmount || 0)) * 100) / 100
        : formData.netPayable,
      invoiceType: formData.invoiceType,
      inputVatAmount: formData.inputVatAmount,
      createdBy: currentUserId,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    setIsSavingPayable(true);
    try {
      const savedPayable = await onCreatePayable(newPayable);
      setServerPayables(current => [
        savedPayable,
        ...current.filter(payable => payable.id !== savedPayable.id),
      ].slice(0, PAGE_SIZE));
      setServerTotal(total => total + 1);
      setCurrentPage(1);
      setShowCreateModal(false);
      resetForm();
      setRefreshKey(key => key + 1);
    } finally {
      setIsSavingPayable(false);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onNotify('error', 'You do not have permission to edit AP bills.');
      return;
    }

    if (!selectedPayable) return;

    const isEmployeeReimbursement = formData.category === 'employee_reimbursements' && !!formData.expenseAllocations?.length;
    if (!formData.vendorId && !isEmployeeReimbursement) {
      onNotify('error', 'Please select a vendor.');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      onNotify('error', 'Please enter a valid amount.');
      return;
    }
    if (!formData.qualificationId && !formData.expenseAllocations?.length) {
      onNotify('error', 'Please select a class.');
      return;
    }
    const selectedEmployee = claimableEmployees.find(employee => employee.id === formData.employeeId);
    if (formData.expenseAllocations?.length && !selectedEmployee) {
      onNotify('error', 'Please select the employee who claimed the consolidated expenses.');
      return;
    }
    const allocationTotal = (formData.expenseAllocations || []).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
    if (formData.expenseAllocations?.some(allocation => !allocation.expenseAccountId || !allocation.qualificationId || !(Number(allocation.amount) > 0))) {
      onNotify('error', 'Every consolidated expense line requires an expense account, class, and amount greater than zero.');
      return;
    }

    const updates: Partial<Payable> = {
      vendorId: formData.vendorId || undefined,
      payableNumber: formData.payableNumber,
      category: formData.category as PayableCategory,
      qualificationId: formData.qualificationId,
      description: formData.description,
      amount: formData.expenseAllocations?.length ? allocationTotal : formData.amount,
      billDate: formData.billDate,
      dueDate: formData.dueDate,
      currency: formData.currency,
      status: formData.status as PayableStatus,
      referenceDocument: formData.referenceDocument,
      glAccountId: formData.glAccountId,
      expenseAccountId: formData.expenseAccountId,
      expenseAllocations: formData.expenseAllocations,
      claimedBy: selectedEmployee?.name || undefined,
      employeeId: selectedEmployee?.id || undefined,
      notes: formData.notes,
      withholdingType: formData.withholdingType,
      appliedRatePercent: formData.appliedRatePercent,
      withholdingAmount: formData.withholdingAmount,
      netPayable: formData.expenseAllocations?.length
        ? Math.round((allocationTotal + Number(formData.inputVatAmount || 0) - Number(formData.withholdingAmount || 0)) * 100) / 100
        : formData.netPayable,
      invoiceType: formData.invoiceType,
      inputVatAmount: formData.inputVatAmount,
      updatedAt: new Date().toISOString(),
    };

    onUpdatePayable(selectedPayable.id, updates);
    setRefreshKey(key => key + 1);
    onNotify('success', `Payable ${formData.payableNumber} updated successfully.`);
    setShowEditModal(false);
    setSelectedPayable(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      onNotify('error', 'You do not have permission to delete AP bills.');
      return;
    }
    const payable = [...serverPayables, ...orgPayables].find(p => p.id === id);
    if (payable?.status === 'paid') {
      onNotify('error', 'Cannot delete a paid payable.');
      return;
    }
    if (payable?.journalEntryId) {
      onNotify('error', 'Cannot delete a payable that has been posted to GL. Reverse the journal entry first.');
      return;
    }

    try {
      await onDeletePayable(id);
      setServerPayables(current => current.filter(item => item.id !== id));
      setServerTotal(current => Math.max(0, current - 1));
      setRefreshKey(key => key + 1);
      setConfirmDelete(null);
    } catch {
      // App-level handler reports the persistence error.
    }
  };

  const handleStatusChange = (id: string, newStatus: PayableStatus) => {
    const payable = [...serverPayables, ...orgPayables].find(p => p.id === id);
    if (!payable) return;

    const updates: Partial<Payable> = {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    if (newStatus === 'approved') {
      updates.approvedBy = currentUserId;
      updates.approvedAt = new Date().toISOString();
    } else if (newStatus === 'paid') {
      updates.paidBy = currentUserId;
      updates.paidAt = new Date().toISOString();
      updates.paymentDate = new Date().toISOString().slice(0, 10);
    }

    onUpdatePayable(id, updates);
    setRefreshKey(key => key + 1);
    onNotify('success', `Payable status updated to ${STATUS_CONFIG[newStatus].label}.`);
  };

  // ============================================================================
  // POST TO GL HANDLER
  // ============================================================================
  const handleApprovePayable = async (payableToPost: Payable) => {
    if (!canApprove) {
      onNotify('error', 'You do not have permission to approve or post AP bills.');
      return;
    }
    const expenseAllocations = payableToPost.expenseAllocations || [];
    const allocatedTotal = expenseAllocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
    const invalidAllocation = expenseAllocations.find(allocation =>
      !allocation.expenseAccountId
      || !allocation.qualificationId
      || !(Number(allocation.amount) > 0)
      || !orgAccounts.some(account => account.id === allocation.expenseAccountId && (account.class === 'EXPENSE' || account.class === 'ASSET') && !account.isHeader)
    );
    const apAccount = orgAccounts.find(a => a.id === payableToPost.glAccountId) || apControlAccount;

    if (!apAccount) {
      onNotify('error', 'AP Control Account not found. Please set up your chart of accounts.');
      return;
    }
    if (invalidAllocation) {
      onNotify('error', 'One or more allocations use an invalid Expense or Asset account or amount.');
      return;
    }
    if (expenseAllocations.length && Math.abs(allocatedTotal - Number(payableToPost.amount)) > 0.01) {
      onNotify('error', 'The consolidated expense allocations do not equal the AP Bill amount.');
      return;
    }
    if (!expenseAllocations.length && !orgAccounts.some(account =>
      account.id === payableToPost.expenseAccountId
      && (account.class === 'EXPENSE' || account.class === 'ASSET')
      && !account.isHeader
    )) {
      onNotify('error', 'Select a valid Expense or Asset account.');
      return;
    }
    if (!currentUserId) return onNotify('error', 'A signed-in user is required to approve a bill.');
    try {
      const expectedNetPayable = Math.round((
        Number(payableToPost.amount || 0) +
        Number(payableToPost.inputVatAmount || 0) -
        Number(payableToPost.withholdingAmount || 0)
      ) * 100) / 100;
      if (Math.abs(Number(payableToPost.netPayable || 0) - expectedNetPayable) > 0.01) {
        await DataServiceFactory.getService().updatePayable(payableToPost.id, {
          netPayable: expectedNetPayable,
          updatedAt: new Date().toISOString(),
        });
      }
      const result = await DataServiceFactory.getService().postPayableBill(payableToPost.id, currentUserId);
      await onJournalChanged?.();
      setRefreshKey(key => key + 1);
      onNotify('success', result.idempotent
        ? `${payableToPost.payableNumber} was already posted and is available in AP Journal Vouchers and Journal Entries.`
        : `Bill journal posted for ${payableToPost.payableNumber} and is now available in AP Journal Vouchers and Journal Entries.`);
      setShowPostGLModal(false);
      setShowViewModal(false);
      setSelectedPayable(null);
    } catch (error) {
      console.error('[PayablesView] Bill posting failed:', error);
      onNotify('error', error instanceof Error ? error.message : 'Bill approval failed.');
    }
  };

  const handleCancelPayable = async (payable: Payable) => {
    if (!canCancel) {
      onNotify('error', 'You do not have permission to cancel AP bills.');
      return;
    }
    if (!currentUserId) return onNotify('error', 'A signed-in user is required to cancel a bill.');
    const reason = window.prompt(`Reason for cancelling ${payable.payableNumber}:`)?.trim();
    if (!reason) return;
    try {
      await DataServiceFactory.getService().cancelPayable(payable.id, currentUserId, reason);
      setShowViewModal(false);
      setSelectedPayable(null);
      setRefreshKey(key => key + 1);
      onNotify('success', payable.journalEntryId
        ? `${payable.payableNumber} was cancelled with a reversing journal.`
        : `${payable.payableNumber} was cancelled.`);
    } catch (error) {
      console.error('[PayablesView] Payable cancellation failed:', error);
      onNotify('error', error instanceof Error ? error.message : 'Unable to cancel the bill.');
    }
  };

  // ============================================================================
  // PAYMENT HANDLER
  // ============================================================================
  const handleProcessPayment = async () => {
    if (!canPay) {
      onNotify('error', 'You do not have permission to pay AP bills.');
      return;
    }
    if (paymentPayables.length === 0 || isProcessingPayment) {
      onNotify('error', 'Cannot process payment.');
      return;
    }

    if (!paymentData.amountPaid || paymentData.amountPaid <= 0) {
      onNotify('error', 'Please enter a valid payment amount.');
      return;
    }

    const bankAccount = orgBankAccounts.find(b => b.id === paymentData.bankAccountId);
    const cashAccount = paymentData.paymentMethod === 'CASH'
      ? assetAccounts.find(a => !a.isHeader && a.name.toLowerCase().includes('cash'))
      : orgAccounts.find(a => a.id === bankAccount?.glAccountId && a.class === 'ASSET' && !a.isHeader);

    if (!cashAccount) {
      onNotify('error', paymentData.paymentMethod === 'CASH'
        ? 'Configure a Cash asset account before paying by cash.'
        : 'Select a bank account with a valid linked GL asset account.');
      return;
    }
    const payableAmounts = paymentPayables
      .map(payable => ({
        payable,
        amount: Math.max(0, paymentAllocations[payable.id] || 0),
        apAccount: orgAccounts.find(a => a.id === payable.glAccountId) || apControlAccount
      }))
      .filter(item => item.amount > 0);
    if (payableAmounts.length === 0) {
      onNotify('error', 'Allocate the payment to at least one invoice.');
      return;
    }
    if (payableAmounts.some(item => item.amount - getPayableOutstanding(item.payable) > 0.005)) {
      onNotify('error', 'An allocation cannot exceed its invoice outstanding balance.');
      return;
    }
    if (payableAmounts.some(item => !item.apAccount)) {
      onNotify('error', 'AP Account not found for one or more selected payables.');
      return;
    }
    const totalPayment = payableAmounts.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(paymentData.amountPaid - totalPayment) > 0.005) {
      onNotify('error', 'The payment amount must equal the total outstanding balance of the selected bills.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      if (!currentUserId) throw new Error('A signed-in user is required to post a payment.');
      const paymentEventId = crypto.randomUUID();
      await DataServiceFactory.getService().postPayablePayment({
        paymentEventId,
        payableIds: payableAmounts.map(item => item.payable.id),
        amounts: payableAmounts.map(item => item.amount),
        cashAccountId: cashAccount.id,
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        actorId: currentUserId,
      });
      setRefreshKey(key => key + 1);
      onNotify('success', `Payment of \u20B1${formatCurrency(totalPayment)} allocated across ${payableAmounts.length} bill${payableAmounts.length === 1 ? '' : 's'}.`);
      setShowPaymentModal(false);
      setSelectedPayable(null);
      setPaymentPayables([]);
      setPaymentAllocations({});
      setSelectedPaymentIds([]);
      resetPaymentForm();
    } catch (error) {
      console.error('[PayablesView] Failed to process payment:', error);
      onNotify('error', 'Payment processing failed. Please review the journal and payable statuses before retrying.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getVendorName = (vendorId: string) => orgVendors.find(v => v.id === vendorId)?.name || 'Unknown Vendor';

  const getCategoryLabel = (payable: Payable) => {
    const qualification = qualifications.find(q => q.id === payable.qualificationId);
    return qualification ? `${qualification.code} - ${qualification.name}` : (PAYABLE_CATEGORIES.find(c => c.value === payable.category)?.label || 'Unassigned');
  };

  // ============================================================================
  // RENDER: SUMMARY CARDS
  // ============================================================================
  const SummaryCard = ({ label, value, color, icon: Icon }: { label: string; value: string; color: string; icon: React.ElementType }) => (
    <div className="bg-white rounded border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
          <p className={`text-lg font-semibold mt-1 ${color}`}>{"\u20B1"}{value}</p>
        </div>
        <div className={`w-12 h-12 rounded ${color === 'text-brand' ? 'bg-brand/10' : color.replace('text-', 'bg-').replace('600', '100')} flex items-center justify-center`}>
          <Icon className={color} size={24} />
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: TAB CONTENT
  // ============================================================================
  const renderListTab = () => (
    <>
      {/* Filters & Search */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search payables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PayableStatus | 'all')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[170px]"
            >
              <option value="all">All</option>
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="all">All</option>
              {orgVendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setVendorFilter('all');
            }}
            className={`p-2 transition-colors ${hasActiveListFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>

          <button
            type="button"
            onClick={openMultiplePaymentModal}
            disabled={selectedPaymentIds.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded bg-brand px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            <Landmark size={15} /> Process Payment{selectedPaymentIds.length > 0 ? ` (${selectedPaymentIds.length})` : ''}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex h-9 items-center gap-2 rounded border border-brand bg-white px-3 text-xs font-semibold text-brand shadow-sm transition-colors hover:bg-brand/5"
          >
            <Download size={15} /> Export Excel
          </button>

          <p className="ml-auto text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{totalItems}</span> matching payable{totalItems !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Payables Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  aria-label="Select all payable bills eligible for payment on this page"
                  checked={allEligiblePageSelected}
                  onChange={togglePagePaymentSelection}
                  disabled={eligiblePagePayables.length === 0}
                  className="h-4 w-4 rounded border-white/60 accent-white disabled:opacity-40"
                />
              </th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Date / Due</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Doc # / Type</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Claimed By</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Description</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Amount</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Balance</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoadingPage && !useFallbackRows ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  Loading payables...
                </td>
              </tr>
            ) : totalItems > 0 ? (
              paginatedPayables.map(payable => {
                const statusConfig = STATUS_CONFIG[payable.status];
                const isOverdue = payable.status !== 'paid' && payable.status !== 'cancelled' && new Date(payable.dueDate) < new Date();
                const invoiceTypeConfig = INVOICE_TYPES.find(t => t.value === payable.invoiceType);
                const remainingBalance = getPayableOutstanding(payable);
                const isPosted = !!payable.journalEntryId;
                const claimant = employees.find(employee => employee.id === payable.employeeId)?.name || getPayableClaimant(payable);

                return (
                  <tr
                    key={payable.id}
                    tabIndex={0}
                    onClick={() => openViewModal(payable)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openViewModal(payable);
                      }
                    }}
                    className="cursor-pointer hover:bg-gray-50 focus:bg-brand/5 focus:outline-none transition-colors group"
                  >
                    <td className="px-3 py-3 text-center" onClick={event => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${payable.payableNumber} for payment`}
                        checked={selectedPaymentIds.includes(payable.id)}
                        disabled={!payablePaymentEligible(payable)}
                        onChange={() => setSelectedPaymentIds(current => current.includes(payable.id)
                          ? current.filter(id => id !== payable.id)
                          : [...current, payable.id]
                        )}
                        className="h-4 w-4 rounded border-gray-300 accent-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-30"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-gray-800">{formatPayableDate(payable.billDate)}</span>
                        <span className={`text-xs ${isOverdue ? 'text-rose-600 font-semibold' : 'text-gray-400'}`}>
                          Due: {formatPayableDate(payable.dueDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono font-semibold text-brand">{payable.payableNumber}</span>
                        <span className={`text-xs font-semibold ${invoiceTypeConfig?.color || 'text-gray-500'}`}>
                          {invoiceTypeConfig?.label || 'Standard'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand border border-brand-light flex items-center justify-center font-bold text-xs">
                          {claimant === '—' ? '—' : claimant.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{claimant}</p>
                          <p className="text-xs text-gray-500">{payable.expenseAllocations?.length ? `${payable.expenseAllocations.length} consolidated expense${payable.expenseAllocations.length === 1 ? '' : 's'}` : 'No claimant specified'}</p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={event => {
                        if (canEdit && payable.status === 'for_approval' && !isPosted) {
                          event.stopPropagation();
                        }
                      }}
                    >
                      {(() => {
                        const isInlineDescriptionEditable = canEdit && payable.status === 'for_approval' && !isPosted;
                        const displayedDescription = getEditablePayableDescription(payable);
                        const displayedReference = payable.status === 'for_approval' && isAutoGeneratedExpenseCodeReference(payable)
                          ? ''
                          : (payable.referenceDocument || '');

                        return (
                          <div className="flex flex-col gap-1">
                            {isInlineDescriptionEditable ? (
                              <input
                                type="text"
                                aria-label={`Description for ${payable.payableNumber}`}
                                value={inlineDescriptionDrafts[payable.id] ?? displayedDescription}
                                disabled={savingDescriptionId === payable.id}
                                placeholder="Enter description..."
                                onClick={event => event.stopPropagation()}
                                onChange={event => {
                                  const nextValue = event.target.value;
                                  setInlineDescriptionDrafts(prev => ({ ...prev, [payable.id]: nextValue }));
                                }}
                                onBlur={() => {
                                  void handleInlineDescriptionSave(payable);
                                }}
                                onKeyDown={event => {
                                  event.stopPropagation();
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.currentTarget.blur();
                                  } else if (event.key === 'Escape') {
                                    event.preventDefault();
                                    setInlineDescriptionDrafts(prev => {
                                      const next = { ...prev };
                                      delete next[payable.id];
                                      return next;
                                    });
                                    event.currentTarget.blur();
                                  }
                                }}
                                className="w-full min-w-[220px] rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 placeholder:font-normal placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10 disabled:opacity-60"
                              />
                            ) : (
                              <span className="text-sm font-medium text-gray-800">{displayedDescription || '—'}</span>
                            )}
                            {displayedReference ? (
                              <span className="text-xs text-gray-500">{displayedReference}</span>
                            ) : !isConsolidatedTimeExpensePayable(payable) ? (
                              <span className="text-xs text-gray-500">No reference document</span>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-sm text-gray-700">{"\u20B1"}{formatCurrency(getPayableVatInclusiveAmount(payable))}</span>
                        {Number(payable.inputVatAmount || 0) > 0 && (
                          <span className="text-xs text-gray-400">VAT inclusive</span>
                        )}
                        {payable.withholdingAmount > 0 && (
                          <span className="text-xs text-brand">-{"\u20B1"}{formatCurrency(payable.withholdingAmount)} WHT</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                      <span className="text-brand">
                        {"\u20B1"}{formatCurrency(remainingBalance)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                          {statusConfig.label}
                        </span>
                        {isPosted && (
                          <span className="text-xs text-brand font-semibold flex items-center gap-0.5">
                            <BookOpen size={10} /> GL Posted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payable.status !== 'paid' && payable.status !== 'cancelled' && (
                          <>
                            <button
                              disabled={!canEdit || isPosted || payable.status === 'approved'}
                              onClick={event => {
                                event.stopPropagation();
                                openEditModal(payable);
                              }}
                              className="p-1.5 hover:bg-brand-light rounded-lg text-brand transition-colors disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                              title={payable.status === 'approved' ? 'Approved bills cannot be edited' : 'Edit'}
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              disabled={!canDelete || isPosted || payable.status === 'approved'}
                              onClick={event => {
                                event.stopPropagation();
                                setConfirmDelete(payable.id);
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-rose-500 transition-colors disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
                              title={payable.status === 'approved' ? 'Approved bills cannot be deleted' : 'Delete'}
                            >
                              <Trash2 size={16} />
                            </button>
                            {canApprove && payable.status === 'for_approval' && (
                              <button
                                onClick={event => {
                                  event.stopPropagation();
                                  void handleApprovePayable(payable);
                                }}
                                className="p-1.5 hover:bg-brand-light rounded-lg text-brand transition-colors"
                                title={payable.expenseAllocations?.length ? `Approve ${payable.expenseAllocations.length} consolidated expenses` : 'Approve'}
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  {pageLoadError
                    ? 'Unable to load payables from Supabase.'
                    : hasActiveListFilters
                      ? 'Try adjusting your search or filters.'
                      : 'No payables found. Create your first payable to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={activePage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={handlePageChange}
          itemLabel="payables"
        />
      </div>
    </>
  );

  const renderAgingTab = () => (
    <div className="space-y-6">
      {isLoadingAging && (
        <div role="status" className="flex items-center gap-2 rounded border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <RefreshCw size={16} className="animate-spin" />
          Loading all open AP transactions…
        </div>
      )}
      {agingLoadError && (
        <div role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>AP Aging could not be loaded from Supabase: {agingLoadError}</span>
        </div>
      )}
      {/* Vendor Filter for Aging */}
      <div className="flex items-center gap-4 bg-white p-4 rounded border shadow-sm">
        <div className="relative">
          <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded focus:border-brand outline-none text-sm appearance-none cursor-pointer"
          >
            <option value="all">All Vendors</option>
            {orgVendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
        <span className="text-sm text-gray-500">As of {new Date().toLocaleDateString()}</span>
      </div>

      {/* Aging Buckets */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { key: 'current', label: 'Current', color: 'emerald', data: agingBuckets.current },
          { key: 'days30', label: '1-30 Days', color: 'blue', data: agingBuckets.days30 },
          { key: 'days60', label: '31-60 Days', color: 'amber', data: agingBuckets.days60 },
          { key: 'days90', label: '61-90 Days', color: 'orange', data: agingBuckets.days90 },
          { key: 'days120Plus', label: '90+ Days', color: 'rose', data: agingBuckets.days120Plus },
        ].map(bucket => (
          <div key={bucket.key} className={`bg-white rounded border border-gray-200 p-5 shadow-sm`}>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{bucket.label}</p>
            <p className={`text-lg font-semibold mt-2 text-${bucket.color}-600`}>
              {"\u20B1"}{formatCurrency(bucket.data.amount)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{bucket.data.count} invoice{bucket.data.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* Aging Summary */}
      <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 className="text-brand" size={20} />
          Aging Summary by Vendor
        </h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left text-xs font-bold text-gray-400 uppercase">Vendor</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">Current</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">1-30</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">31-60</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">61-90</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">90+</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {vendorBalances.filter(v => v.balance > 0).map(({ vendor, balance }) => {
              const vendorPayables = orgPayables.filter(p =>
                p.vendorId === vendor.id &&
                p.status !== 'paid' &&
                p.status !== 'cancelled'
              );
              const today = new Date();
              const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 };

              vendorPayables.forEach(p => {
                const dueDate = new Date(p.dueDate);
                const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                const amount = getPayableOutstanding(p);

                if (daysOverdue <= 0) buckets.current += amount;
                else if (daysOverdue <= 30) buckets.d30 += amount;
                else if (daysOverdue <= 60) buckets.d60 += amount;
                else if (daysOverdue <= 90) buckets.d90 += amount;
                else buckets.d120 += amount;
              });

              return (
                <tr key={vendor.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 text-sm font-medium text-gray-700">{vendor.name}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.current > 0 ? formatCurrency(buckets.current) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.d30 > 0 ? formatCurrency(buckets.d30) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.d60 > 0 ? formatCurrency(buckets.d60) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-brand">{buckets.d90 > 0 ? formatCurrency(buckets.d90) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono text-rose-600">{buckets.d120 > 0 ? formatCurrency(buckets.d120) : '-'}</td>
                  <td className="py-3 text-right text-sm font-mono font-bold text-gray-800">{formatCurrency(balance)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td className="py-3 text-sm font-bold text-gray-800">TOTAL</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.current.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.days30.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.days60.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-brand">{formatCurrency(agingBuckets.days90.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-bold text-rose-600">{formatCurrency(agingBuckets.days120Plus.amount)}</td>
              <td className="py-3 text-right text-sm font-mono font-semibold text-brand">{formatCurrency(totalApSubledger)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const renderReconciliationTab = () => (
    <div className="space-y-6">
      {/* GL vs Subledger Summary */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand/10 rounded border border-brand-light">
              <PieChart className="text-brand" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">AP Subledger Total</h3>
          </div>
          <p className="text-xl font-semibold text-brand">{"\u20B1"}{formatCurrency(totalApSubledger)}</p>
          <p className="text-xs text-gray-500 mt-2">Sum of all vendor balances</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-brand/10 rounded border border-brand-light">
              <BookOpen className="text-brand" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">AP Control Account</h3>
          </div>
          <p className="text-xl font-semibold text-brand">
            {"\u20B1"}{formatCurrency(apControlAccount ? summaryMetrics.total : 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">{apControlAccount?.name || 'Not configured'}</p>
        </div>
      </div>

      {/* Vendor Balances */}
      <div className="bg-white rounded border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Building className="text-brand" size={20} />
          Vendor Balances (Subledger)
        </h3>
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 text-left text-xs font-bold text-gray-400 uppercase">Vendor</th>
              <th className="py-3 text-left text-xs font-bold text-gray-400 uppercase">TIN</th>
              <th className="py-3 text-center text-xs font-bold text-gray-400 uppercase">Invoices</th>
              <th className="py-3 text-right text-xs font-bold text-gray-400 uppercase">Balance</th>
            </tr>
          </thead>
          <tbody>
            {vendorBalances.map(({ vendor, balance, invoiceCount }) => (
              <tr key={vendor.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">
                      {vendor.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{vendor.name}</span>
                  </div>
                </td>
                <td className="py-3 text-sm font-mono text-gray-500">{vendor.tin || '-'}</td>
                <td className="py-3 text-center text-sm text-gray-600">{invoiceCount}</td>
                <td className={`py-3 text-right text-sm font-mono font-semibold ${balance > 0 ? 'text-brand' : balance < 0 ? 'text-brand' : 'text-gray-400'}`}>
                  {"\u20B1"}{formatCurrency(balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={3} className="py-3 text-sm font-bold text-gray-800">TOTAL SUBLEDGER</td>
              <td className="py-3 text-right text-sm font-mono font-semibold text-brand">{"\u20B1"}{formatCurrency(totalApSubledger)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <div className="space-y-8">
      {(showCreateModal || (showEditModal && selectedPayable)) ? (
        <PayableFormPage
          title={showCreateModal ? 'Create Bill' : `Edit: ${selectedPayable?.payableNumber}`}
          formData={formData}
          setFormData={setFormData}
          vendors={orgVendors}
          accounts={orgAccounts}
          expenseAccounts={expenseAccounts}
          liabilityAccounts={liabilityAccounts}
          qualifications={qualifications}
          claimableEmployees={claimableEmployees}
          taxCategories={taxCategories}
          apControlAccount={apControlAccount}
          withholdingTaxAccount={withholdingTaxAccount}
          inputVatAccount={inputVatAccount}
          currency={formData.currency || 'PHP'}
          onSubmit={showCreateModal ? handleCreate : handleUpdate}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedPayable(null);
            resetForm();
          }}
          submitLabel={showCreateModal ? 'Create Bill' : 'Save Changes'}
          isEdit={showEditModal}
          isSubmitting={isSavingPayable}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 tracking-tight">{view === 'aging' ? 'AP AGING REPORT' : 'AP BILLS'}</h2>
              <p className="text-sm text-gray-500 font-normal italic">{view === 'aging' ? 'Review outstanding vendor balances by aging period.' : 'Manage vendor invoices and process payments.'}</p>
            </div>
            {view === 'bills' && canCreate && <div className="flex gap-3">
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-brand/20 font-medium text-sm active:scale-95"
              >
                <Plus size={18} /> New Bill
              </button>
            </div>}
          </div>

          {/* Tabs */}
          {view === 'bills' && <div className="flex gap-2 border-b border-gray-200">
            {[
              { key: 'list', label: 'Bill List', icon: FileText },
              { key: 'reconciliation', label: 'Reconciliation', icon: RefreshCw },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as APTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.key
                  ? 'text-brand border-brand'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <SummaryCard label="Total Open" value={formatCurrency(summaryMetrics.total)} color="text-brand" icon={Coins} />
            <SummaryCard label="On Hold" value={formatCurrency(summaryMetrics.forApproval)} color="text-amber-700" icon={Clock} />
            <SummaryCard label="Approved" value={formatCurrency(summaryMetrics.approved)} color="text-brand" icon={CheckCircle} />
            <SummaryCard label="Due Soon (7d)" value={formatCurrency(summaryMetrics.dueSoon)} color="text-violet-600" icon={Calendar} />
            <SummaryCard label="Overdue" value={formatCurrency(summaryMetrics.overdue)} color="text-rose-600" icon={AlertCircle} />
            <SummaryCard label="Total Paid" value={formatCurrency(summaryMetrics.paid)} color="text-brand" icon={CreditCard} />
          </div>

          {/* Tab Content */}
          {view === 'aging' ? renderAgingTab() : (
            <>
              {activeTab === 'list' && renderListTab()}
              {activeTab === 'reconciliation' && renderReconciliationTab()}
            </>
          )}

          {/* View Modal */}
          {showViewModal && selectedPayable && (
            <PayableDetailModal
              payable={selectedPayable}
              vendor={orgVendors.find(v => v.id === selectedPayable.vendorId)}
              accounts={orgAccounts}
              qualifications={qualifications}
              taxCategories={taxCategories}
              timeExpenses={timeExpenses}
              onClose={() => { setShowViewModal(false); setSelectedPayable(null); }}
              onApprove={() => { void handleApprovePayable(selectedPayable); }}
              onProcessPayment={() => { setShowViewModal(false); openPaymentModal(selectedPayable); }}
              onCancel={() => { void handleCancelPayable(selectedPayable); }}
              onPostGL={() => { setShowViewModal(false); openPostGLModal(selectedPayable); }}
              canPost={!selectedPayable.journalEntryId && selectedPayable.status === 'for_approval'}
              canApprove={canApprove}
              canCancel={canCancel}
              canPay={canPay && payablePaymentEligible(selectedPayable) && getPayableOutstanding(selectedPayable) > 0}
            />
          )}

          {/* Post to GL Modal (available from payable details, not the list table) */}
          {showPostGLModal && selectedPayable && (
            <ModalPortal>
              <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                <div className="bg-white rounded shadow-md w-full max-w-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center border border-brand-light">
                      <BookOpen className="text-brand" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Post to General Ledger</h3>
                      <p className="text-sm text-gray-500">{selectedPayable.payableNumber}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded p-4">
                    Confirm posting this payable to the general ledger.
                  </p>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => { setShowPostGLModal(false); setSelectedPayable(null); }}
                      className="flex-1 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void handleApprovePayable(selectedPayable)}
                      className="flex-1 py-2.5 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover"
                    >
                      Post to GL
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* Payment Modal */}
          {showPaymentModal && paymentPayables.length > 0 && (
            <ModalPortal>
              <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                <div className="bg-white rounded-md shadow-md w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-brand text-white rounded shadow-brand/20">
                        <Landmark size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">Vendor Payment Allocation</h3>
                        <p className="text-xs text-gray-500">
                          {paymentPayables.length > 1
                            ? `${getVendorName(paymentPayables[0].vendorId)} · ${paymentPayables.length} open bills`
                            : `${paymentPayables[0].payableNumber} • ${getVendorName(paymentPayables[0].vendorId)}`}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setShowPaymentModal(false); setSelectedPayable(null); setPaymentPayables([]); setPaymentAllocations({}); }} className="text-gray-400 hover:text-gray-600">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* Outstanding Balance */}
                    <div className="bg-amber-50 rounded p-4 border border-amber-100">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-amber-800">Total Outstanding</span>
                        <span className="text-xl font-semibold text-brand">
                          {"\u20B1"}{formatCurrency(vendorPaymentOutstanding)}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between border-t border-amber-100 pt-2 text-xs">
                        <span className="text-amber-700">Allocated: {"\u20B1"}{formatCurrency(allocatedPaymentTotal)}</span>
                        <span className={Math.abs(paymentData.amountPaid - allocatedPaymentTotal) <= 0.005 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-600'}>
                          Unallocated: {"\u20B1"}{formatCurrency(Math.max(0, paymentData.amountPaid - allocatedPaymentTotal))}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Allocations · Oldest First</label>
                        <button
                          type="button"
                          onClick={() => setPaymentAllocations(allocatePaymentOldestFirst(paymentPayables, paymentData.amountPaid))}
                          className="text-xs font-semibold text-brand hover:underline"
                        >
                          Auto-allocate
                        </button>
                      </div>
                      <div className="max-h-52 overflow-y-auto rounded border border-gray-200 divide-y divide-gray-100">
                        {paymentPayables.map(payable => (
                          <div key={payable.id} className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-700">{payable.payableNumber}</p>
                              <p className="truncate text-xs text-gray-400">Due {formatPayableDate(payable.dueDate)} · Balance {"\u20B1"}{formatCurrency(getPayableOutstanding(payable))}</p>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max={getPayableOutstanding(payable)}
                              step="0.01"
                              aria-label={`Payment allocation for ${payable.payableNumber}`}
                              className="w-32 shrink-0 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-right font-mono text-sm outline-none focus:border-brand"
                              value={paymentAllocations[payable.id] || ''}
                              onChange={event => {
                                const value = Math.min(getPayableOutstanding(payable), Math.max(0, Number(event.target.value) || 0));
                                setPaymentAllocations(current => ({ ...current, [payable.id]: value }));
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Method</label>
                      <select
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium appearance-none"
                        value={paymentData.paymentMethod}
                        onChange={e => setPaymentData({ ...paymentData, paymentMethod: e.target.value as PaymentMethod })}
                      >
                        {PAYMENT_METHODS.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bank Account */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pay From (Bank Account)</label>
                      <select
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-medium appearance-none"
                        value={paymentData.bankAccountId}
                        onChange={e => setPaymentData({ ...paymentData, bankAccountId: e.target.value })}
                      >
                        <option value="">Select Bank Account...</option>
                        {orgBankAccounts.map(b => (
                          <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                        ))}
                      </select>
                    </div>

                    {/* Check Details (if check payment) */}
                    {paymentData.paymentMethod.toUpperCase() === 'CHECK' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Number</label>
                          <input
                            type="text"
                            placeholder="Check #"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm font-mono"
                            value={paymentData.checkNumber}
                            onChange={e => setPaymentData({ ...paymentData, checkNumber: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Check Date</label>
                          <input
                            type="date"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                            value={paymentData.checkDate}
                            onChange={e => setPaymentData({ ...paymentData, checkDate: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Amount & Date */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Amount</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={vendorPaymentOutstanding}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none font-mono text-sm focus:border-brand"
                          value={paymentData.amountPaid}
                          onChange={event => {
                            const amountPaid = Math.min(vendorPaymentOutstanding, Math.max(0, Number(event.target.value) || 0));
                            setPaymentData(current => ({ ...current, amountPaid }));
                            setPaymentAllocations(allocatePaymentOldestFirst(paymentPayables, amountPaid));
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Date</label>
                        <input
                          type="date"
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                          value={paymentData.paymentDate}
                          onChange={e => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => { setShowPaymentModal(false); setSelectedPayable(null); setPaymentPayables([]); setPaymentAllocations({}); resetPaymentForm(); }}
                        disabled={isProcessingPayment}
                        className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleProcessPayment}
                        disabled={isProcessingPayment}
                        className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isProcessingPayment ? <RefreshCw size={16} className="animate-spin" /> : <Landmark size={16} />}
                        {isProcessingPayment ? 'Processing…' : `Process ${paymentPayables.length} Payment${paymentPayables.length === 1 ? '' : 's'}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}

          {/* Delete Confirmation */}
          {confirmDelete && (
            <ModalPortal>
              <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                <div className="bg-white rounded shadow-md w-full max-w-md p-6 animate-in zoom-in duration-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
                      <AlertCircle className="text-rose-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Delete Payable?</h3>
                      <p className="text-sm text-gray-500">This action cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(confirmDelete)}
                      className="flex-1 py-2.5 bg-rose-600 text-white rounded text-sm font-bold hover:bg-rose-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </ModalPortal>
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// PAYABLE FORM PAGE COMPONENT
// ============================================================================
interface PayableFormPageProps {
  title: string;
  formData: Partial<Payable>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Payable>>>;
  vendors: Vendor[];
  accounts: ChartOfAccount[];
  expenseAccounts: ChartOfAccount[];
  liabilityAccounts: ChartOfAccount[];
  qualifications: Qualification[];
  claimableEmployees: User[];
  taxCategories?: TaxCategoryEntry[];
  apControlAccount?: ChartOfAccount;
  withholdingTaxAccount?: ChartOfAccount;
  inputVatAccount?: ChartOfAccount;
  currency?: string;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitLabel: string;
  isEdit?: boolean;
  isSubmitting?: boolean;
}

const PayableFormPage: React.FC<PayableFormPageProps> = ({
  title,
  formData,
  setFormData,
  vendors,
  accounts,
  expenseAccounts,
  liabilityAccounts,
  qualifications,
  claimableEmployees,
  taxCategories = [],
  apControlAccount,
  withholdingTaxAccount,
  inputVatAccount,
  currency = 'PHP',
  onSubmit,
  onClose,
  submitLabel,
  isEdit = false,
  isSubmitting = false,
}) => {
  // Format currency helper
  const formatCurrency = (val?: number) =>
    (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Initialize line items from formData.expenseAllocations or default single line
  const [lines, setLines] = useState<APBillFormLine[]>(() => {
    if (formData.expenseAllocations && formData.expenseAllocations.length > 0) {
      return formData.expenseAllocations.map((alloc, idx) => ({
        lineNumber: alloc.lineNumber ?? idx + 1,
        lineType: (alloc.lineType as any) || 'EXPENSE',
        qualificationId: alloc.qualificationId || formData.qualificationId || '',
        expenseAccountId: alloc.expenseAccountId || formData.expenseAccountId || '',
        description: alloc.description || '',
        taxCategoryId: alloc.taxCategoryId || '',
        quantity: alloc.quantity ?? 1,
        unitPrice: alloc.unitPrice !== undefined ? alloc.unitPrice : Number(alloc.amount || 0),
        amount: Number(alloc.amount || 0),
        sourceExpenseId: alloc.sourceExpenseId,
      }));
    }
    return [{
      lineNumber: 1,
      lineType: 'EXPENSE',
      qualificationId: formData.qualificationId || (qualifications[0]?.id || ''),
      expenseAccountId: formData.expenseAccountId || (expenseAccounts[0]?.id || ''),
      description: formData.description || '',
      taxCategoryId: '',
      quantity: 1,
      unitPrice: Number(formData.amount || 0),
      amount: Number(formData.amount || 0),
    }];
  });

  const LINE_ITEMS_PAGE_SIZE = 10;
  const canEditLines = !isEdit || formData.status === 'for_approval';
  const {
    currentPage: linePage,
    totalPages: lineTotalPages,
    pageStartIndex: linePageStartIndex,
    pageEndIndex: linePageEndIndex,
    paginatedRows: paginatedLines,
    setCurrentPage: setLinePage,
  } = usePaginatedRows(lines, [], LINE_ITEMS_PAGE_SIZE);

  // Table Column Order & Drag/Resize State
  const defaultLineColOrder = [
    'lineNumber', 'lineType', 'qualificationId', 'expenseAccountId', 'description', 'taxCategoryId', 'quantity', 'unitPrice', 'amount', 'actions'
  ];
  const [lineColOrder, setLineColOrder] = useState<string[]>(defaultLineColOrder);
  const [draggedLineColIdx, setDraggedLineColIdx] = useState<number | null>(null);
  const [draggedLineIdx, setDraggedLineIdx] = useState<number | null>(null);
  const [lineDropIdx, setLineDropIdx] = useState<number | null>(null);
  const [lineColWidths, setLineColWidths] = useState<Record<string, number>>({});
  const lineResizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Synchronize lines with formData and recalculate tax & net totals
  const recalculateAndSync = (
    newLines: APBillFormLine[],
    whtType = formData.withholdingType,
    whtRate = formData.appliedRatePercent
  ) => {
    setLines(newLines);

    let grossSubtotal = 0;
    let totalVat = 0;

    const allocations = newLines.map((line, idx) => {
      const lineAmt = Number(line.amount || 0);
      const isDiscount = line.lineType === 'DISCOUNT';

      let lineVat = 0;
      if (line.taxCategoryId && taxCategories.length > 0) {
        const cat = taxCategories.find(c => c.id === line.taxCategoryId);
        if (cat) {
          const code = (cat.code || '').toUpperCase().replace(/[\s_-]+/g, '');
          if (code === 'VATGOODS' || code === 'VATSERV' || cat.rate === 12) {
            lineVat = Math.round((lineAmt - lineAmt / 1.12) * 100) / 100;
          } else if (cat.rate && cat.rate > 0) {
            const r = cat.rate > 1 ? cat.rate / 100 : cat.rate;
            lineVat = cat.isInclusive
              ? Math.round((lineAmt / (1 + r) * r) * 100) / 100
              : Math.round(lineAmt * r * 100) / 100;
          }
        }
      }

      if (isDiscount) {
        grossSubtotal -= Math.abs(lineAmt);
      } else {
        grossSubtotal += lineAmt;
        totalVat += lineVat;
      }

      return {
        lineNumber: idx + 1,
        lineType: line.lineType,
        expenseAccountId: line.expenseAccountId,
        qualificationId: line.qualificationId,
        description: line.description,
        amount: Math.abs(lineAmt),
        taxCategoryId: line.taxCategoryId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        sourceExpenseId: line.sourceExpenseId,
      };
    });

    grossSubtotal = Math.round(grossSubtotal * 100) / 100;
    totalVat = Math.round(totalVat * 100) / 100;

    let whtAmount = 0;
    if (whtType && whtRate && whtRate > 0) {
      const taxBase = Math.max(0, grossSubtotal - totalVat);
      whtAmount = Math.round(taxBase * (whtRate / 100) * 100) / 100;
    }

    const netPayable = Math.round((grossSubtotal - whtAmount) * 100) / 100;

    setFormData(prev => ({
      ...prev,
      amount: grossSubtotal,
      inputVatAmount: totalVat,
      withholdingType: whtType,
      appliedRatePercent: whtRate,
      withholdingAmount: whtAmount,
      netPayable: netPayable,
      expenseAllocations: allocations,
      expenseAccountId: newLines[0]?.expenseAccountId || prev.expenseAccountId,
      qualificationId: newLines[0]?.qualificationId || prev.qualificationId,
    }));
  };

  const handleAddLine = (type: 'EXPENSE' | 'DISCOUNT' = 'EXPENSE') => {
    if (!canEditLines) return;
    const newLine: APBillFormLine = {
      lineNumber: lines.length + 1,
      lineType: type,
      qualificationId: formData.qualificationId || qualifications[0]?.id || '',
      expenseAccountId: formData.expenseAccountId || expenseAccounts[0]?.id || '',
      description: type === 'DISCOUNT' ? 'Vendor / Reimbursement Discount' : '',
      taxCategoryId: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0,
    };
    const nextLines = [...lines, newLine];
    recalculateAndSync(nextLines);
    setLinePage(Math.ceil(nextLines.length / LINE_ITEMS_PAGE_SIZE));
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length <= 1) {
      const resetLine: APBillFormLine = {
        lineNumber: 1,
        lineType: 'EXPENSE',
        qualificationId: qualifications[0]?.id || '',
        expenseAccountId: expenseAccounts[0]?.id || '',
        description: '',
        taxCategoryId: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      };
      recalculateAndSync([resetLine]);
      return;
    }
    const filtered = lines.filter((_, i) => i !== idx).map((l, i) => ({ ...l, lineNumber: i + 1 }));
    recalculateAndSync(filtered);
  };

  const handleUpdateLine = (idx: number, field: keyof APBillFormLine, value: any) => {
    const updated = lines.map((l, i) => {
      if (i !== idx) return l;
      const modified = { ...l, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : l.quantity;
        const price = field === 'unitPrice' ? Number(value) : l.unitPrice;
        modified.amount = Math.round(qty * price * 100) / 100;
      }
      return modified;
    });
    recalculateAndSync(updated);
  };

  const handleRowDrop = (targetIdx: number) => {
    if (draggedLineIdx === null || draggedLineIdx === targetIdx) return;
    const reordered = [...lines];
    const [moved] = reordered.splice(draggedLineIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    const updated = reordered.map((l, i) => ({ ...l, lineNumber: i + 1 }));
    recalculateAndSync(updated);
    setDraggedLineIdx(null);
    setLineDropIdx(null);
  };

  // Export line items to Excel (.xls)
  const exportLineItemsToExcel = () => {
    if (lines.length === 0) {
      alert('No line items to export.');
      return;
    }
    const columns = lineColOrder.map(colKey => {
      switch (colKey) {
        case 'lineNumber': return { label: '#', getter: (l: APBillFormLine) => l.lineNumber };
        case 'lineType': return { label: 'Type', getter: (l: APBillFormLine) => l.lineType };
        case 'qualificationId': return { label: 'Class', getter: (l: APBillFormLine) => qualifications.find(q => q.id === l.qualificationId)?.name || '-' };
        case 'expenseAccountId': return { label: 'Expense Account', getter: (l: APBillFormLine) => expenseAccounts.find(a => a.id === l.expenseAccountId)?.name || '-' };
        case 'description': return { label: 'Description', getter: (l: APBillFormLine) => l.description || '-' };
        case 'taxCategoryId': return { label: 'Tax Category', getter: (l: APBillFormLine) => taxCategories.find(tc => tc.id === l.taxCategoryId)?.code || '-' };
        case 'quantity': return { label: 'Qty', getter: (l: APBillFormLine) => l.quantity };
        case 'unitPrice': return { label: 'Unit Price (₱)', getter: (l: APBillFormLine) => Number(l.unitPrice || 0).toFixed(2) };
        case 'amount': return { label: 'Amount (₱)', getter: (l: APBillFormLine) => Number(l.amount || 0).toFixed(2) };
        default: return null;
      }
    }).filter(Boolean) as { label: string; getter: (l: APBillFormLine) => any }[];

    const headers = columns.map(c => c.label);
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 8px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:12px;}th{padding:6px 8px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:12px;background:#059669;color:#fff;font-weight:700;}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    lines.forEach(line => {
      html += '<tr>' + columns.map(c => `<td>${esc(c.getter(line))}</td>`).join('') + '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bill_LineItems_${formData.payableNumber || new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Live General Ledger Journal Entry Preview
  const glJournalPreview = useMemo(() => {
    type PreviewLine = {
      key: string;
      accountLabel: string;
      description: string;
      debit: number;
      credit: number;
      missing?: boolean;
    };

    const previewLines: PreviewLine[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    const vatAmt = Number(formData.inputVatAmount || 0);
    const whtAmt = Number(formData.withholdingAmount || 0);
    const linesNetSubtotal = Math.round(
      lines.reduce((sum, line) => {
        const amt = Number(line.amount || 0);
        return line.lineType === 'DISCOUNT' ? sum - Math.abs(amt) : sum + amt;
      }, 0) * 100
    ) / 100;
    const explicitNetPayable = Number(formData.netPayable || 0);
    // Consolidated Time & Expenses bills store VAT-exclusive line amounts with inputVatAmount added on top
    // to form netPayable (matching post_payable_bill). Manual VAT-inclusive lines include VAT in line.amount.
    const lineAmountsExcludeVat =
      vatAmt > 0 &&
      explicitNetPayable > 0 &&
      Math.abs((linesNetSubtotal + vatAmt - whtAmt) - explicitNetPayable) < 0.02;

    // 1. Expense/Asset Accounts (Debit)
    lines.forEach((line, idx) => {
      const amt = Number(line.amount || 0);
      if (amt <= 0 && line.lineType !== 'DISCOUNT') return;

      const account = expenseAccounts.find(a => a.id === line.expenseAccountId);
      if (!account) return;
      const accountLabel = `${account.code} - ${account.name}`;

      let lineVat = 0;
      if (!lineAmountsExcludeVat && line.taxCategoryId && taxCategories.length > 0) {
        const cat = taxCategories.find(c => c.id === line.taxCategoryId);
        if (cat) {
          const code = (cat.code || '').toUpperCase().replace(/[\s_-]+/g, '');
          if (code === 'VATGOODS' || code === 'VATSERV' || cat.rate === 12) {
            lineVat = Math.round((amt - amt / 1.12) * 100) / 100;
          }
        }
      }

      const netExpense = Math.max(0, Math.round((amt - lineVat) * 100) / 100);

      if (line.lineType === 'DISCOUNT') {
        previewLines.push({
          key: `discount-${idx}`,
          accountLabel,
          description: line.description || `Discount (Line #${line.lineNumber})`,
          debit: 0,
          credit: amt,
          missing: !account,
        });
        totalCredit += amt;
      } else {
        previewLines.push({
          key: `expense-${idx}`,
          accountLabel,
          description: line.description || `Bill Line #${line.lineNumber}`,
          debit: netExpense,
          credit: 0,
          missing: !account,
        });
        totalDebit += netExpense;
      }
    });

    // 2. Input VAT (Debit)
    if (vatAmt > 0) {
      const vatAcct = inputVatAccount || accounts.find(a => a.name.toLowerCase().includes('input vat') || a.code?.startsWith('1170'));
      previewLines.push({
        key: 'input-vat',
        accountLabel: vatAcct ? `${vatAcct.code} - ${vatAcct.name}` : '1170 - Input Tax / VAT',
        description: 'Input VAT on purchase/bill',
        debit: vatAmt,
        credit: 0,
        missing: !vatAcct,
      });
      totalDebit += vatAmt;
    }

    // 3. Withholding Tax Payable (Credit)
    if (whtAmt > 0) {
      const whtAcct = withholdingTaxAccount || liabilityAccounts.find(a => a.name.toLowerCase().includes('withholding') || a.code?.startsWith('2150'));
      previewLines.push({
        key: 'wht-payable',
        accountLabel: whtAcct ? `${whtAcct.code} - ${whtAcct.name}` : '2150 - Expanded Withholding Tax Payable',
        description: `${formData.withholdingType || 'Expanded'} Withholding Tax`,
        debit: 0,
        credit: whtAmt,
        missing: !whtAcct,
      });
      totalCredit += whtAmt;
    }

    // 4. Accounts Payable Control Account (Credit)
    const netPayable = Number(formData.netPayable || Math.round((totalDebit - totalCredit) * 100) / 100);
    if (netPayable > 0) {
      const apAcct = apControlAccount || liabilityAccounts.find(a => a.code?.startsWith('2100') || a.name.toLowerCase().includes('accounts payable'));
      previewLines.push({
        key: 'ap-control',
        accountLabel: apAcct ? `${apAcct.code} - ${apAcct.name}` : '2100 - Accounts Payable',
        description: formData.claimedBy ? `AP Reimbursement - ${formData.claimedBy}` : 'Accounts Payable Liability',
        debit: 0,
        credit: netPayable,
        missing: !apAcct,
      });
      totalCredit += netPayable;
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return {
      lines: previewLines,
      totalDebit,
      totalCredit,
      isBalanced,
    };
  }, [
    lines,
    formData.inputVatAmount,
    formData.withholdingAmount,
    formData.netPayable,
    formData.withholdingType,
    formData.claimedBy,
    expenseAccounts,
    accounts,
    inputVatAccount,
    withholdingTaxAccount,
    apControlAccount,
    liabilityAccounts,
    taxCategories
  ]);

  const GL_PREVIEW_PAGE_SIZE = 5;
  const {
    currentPage: glPreviewPage,
    totalPages: glPreviewTotalPages,
    pageStartIndex: glPreviewPageStartIndex,
    pageEndIndex: glPreviewPageEndIndex,
    paginatedRows: paginatedGlPreviewLines,
    setCurrentPage: setGlPreviewPage,
  } = usePaginatedRows(glJournalPreview.lines, [], GL_PREVIEW_PAGE_SIZE);

  // Column definitions for the interactive table
  const lineColDefs: Record<string, { key: string; label: string; align: string; width: number }> = {
    lineNumber: { key: 'lineNumber', label: '#', align: 'text-left', width: 45 },
    lineType: { key: 'lineType', label: 'Type', align: 'text-left', width: 110 },
    qualificationId: { key: 'qualificationId', label: 'Class', align: 'text-left', width: 140 },
    expenseAccountId: { key: 'expenseAccountId', label: 'Expense / Asset Account *', align: 'text-left', width: 200 },
    description: { key: 'description', label: 'Description', align: 'text-left', width: 220 },
    taxCategoryId: { key: 'taxCategoryId', label: 'Tax Category', align: 'text-left', width: 140 },
    quantity: { key: 'quantity', label: 'Qty', align: 'text-right', width: 75 },
    unitPrice: { key: 'unitPrice', label: 'Unit Price (₱)', align: 'text-right', width: 110 },
    amount: { key: 'amount', label: 'Amount (₱)', align: 'text-right', width: 110 },
    actions: { key: 'actions', label: '', align: 'text-center', width: 45 },
  };

  const isReimbursement = formData.category === 'employee_reimbursements';

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="bg-white rounded-xl shadow-sm w-full overflow-hidden border border-gray-200">
        {/* Top bar */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand text-white rounded shadow-brand/20">
              <Calculator size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
              <p className="text-xs text-gray-500">
                {isReimbursement ? 'Employee Reimbursement Bill' : 'Accounts Payable Vendor Bill'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-brand transition-colors"
          >
            <ArrowRight size={18} className="rotate-180" /> Back to bills
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
            {/* Left Column: Bill Header, Description, Tax Settings & Status */}
            <div className="space-y-5">
              {/* Header Row: Document Type & Category */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Type</label>
                  <div className="flex gap-2">
                    {INVOICE_TYPES.map(type => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, invoiceType: type.value }))}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded border transition-all ${formData.invoiceType === type.value
                            ? 'bg-brand text-white border-brand'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-brand-light'
                          }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category *</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.category || 'supplies'}
                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as PayableCategory }))}
                  >
                    {PAYABLE_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Header Row: Vendor & Claimant */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Building size={12} /> Vendor {isReimbursement ? '(optional for employee reimbursement)' : '*'}
                  </label>
                  <select
                    required={!isReimbursement}
                    disabled={isEdit}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium disabled:opacity-60"
                    value={formData.vendorId || ''}
                    onChange={e => setFormData(prev => ({ ...prev, vendorId: e.target.value }))}
                  >
                    <option value="">{isReimbursement ? 'No vendor — reimburse employee directly' : 'Select Vendor...'}</option>
                    {vendors.filter(v => v.status !== 'blocked').map(v => (
                      <option key={v.id} value={v.id}>{v.name} {v.tin ? `(${v.tin})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Claimed By / Employee {isReimbursement ? '*' : '(optional)'}
                  </label>
                  <select
                    required={isReimbursement}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.employeeId || ''}
                    onChange={e => {
                      const employee = claimableEmployees.find(item => item.id === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        employeeId: employee?.id || '',
                        claimedBy: employee?.name || '',
                      }));
                    }}
                  >
                    <option value="">Select employee...</option>
                    {claimableEmployees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} — {employee.role === 'ADMIN' ? 'Tenant Admin' : employee.role.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference & Date Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document # *</label>
                  <input
                    type="text"
                    required
                    readOnly
                    aria-readonly="true"
                    className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded outline-none text-sm font-mono font-semibold text-brand cursor-not-allowed"
                    value={formData.payableNumber || ''}
                  />
                  {!isEdit && <p className="text-[11px] text-gray-400">Assigned automatically in sequence.</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Calendar size={12} /> Bill Date *
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.billDate || ''}
                    onChange={e => setFormData(prev => ({ ...prev, billDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date *</label>
                  <input
                    type="date"
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.dueDate || ''}
                    onChange={e => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Description & Reference Document */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Bill Description / Memo
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of the bill..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.description || ''}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Reference Document
                  </label>
                  <input
                    type="text"
                    placeholder="Vendor Invoice #, OR #, etc."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                    value={formData.referenceDocument || ''}
                    onChange={e => setFormData(prev => ({ ...prev, referenceDocument: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Internal Notes</label>
                <input
                  type="text"
                  placeholder="Additional notes for accounting or approvals..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none text-sm"
                  value={formData.notes || ''}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              {/* Withholding Tax Controls */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
                    <Percent size={14} className="text-brand" /> Withholding Tax Settings (BIR Form 2307 / 2306)
                  </p>
                  <span className="text-[11px] text-gray-500 font-medium">Auto-deducted from gross payable</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Withholding Type</label>
                    <select
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded outline-none text-xs"
                      value={formData.withholdingType || ''}
                      onChange={e => recalculateAndSync(lines, (e.target.value || undefined) as WithholdingType | undefined, formData.appliedRatePercent)}
                    >
                      <option value="">None</option>
                      <option value="EXPANDED">Expanded (2307)</option>
                      <option value="FINAL">Final (2306)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      disabled={!formData.withholdingType}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded outline-none font-mono text-xs disabled:opacity-50"
                      value={formData.appliedRatePercent || ''}
                      onChange={e => recalculateAndSync(lines, formData.withholdingType, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">WHT Amount</label>
                    <input
                      type="text"
                      readOnly
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded outline-none font-mono text-xs font-semibold text-gray-700 cursor-not-allowed"
                      value={`₱${formatCurrency(formData.withholdingAmount)}`}
                    />
                  </div>
                </div>
              </div>

              {/* Status (Edit mode) */}
              {isEdit && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.status || 'for_approval'}
                    onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as PayableStatus }))}
                  >
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Right Column: GL Journal Entry Preview & Totals Card */}
            <div className="space-y-4">
              {/* GL Journal Entry Preview Card */}
              <aside className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-brand" />
                    <h4 className="text-xs font-black uppercase tracking-wide text-gray-700">GL Journal Preview</h4>
                    {glJournalPreview.lines.length > 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-bold">
                        {glJournalPreview.lines.length} entries
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${glJournalPreview.isBalanced
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                    {glJournalPreview.isBalanced ? 'Balanced' : 'Unbalanced'}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_75px_75px] gap-2 pb-1.5 text-[10px] font-black uppercase text-brand border-b">
                    <div>GL Account</div>
                    <div className="text-right">Debit</div>
                    <div className="text-right">Credit</div>
                  </div>

                  <div className="divide-y divide-gray-100 text-xs">
                    {glJournalPreview.lines.length === 0 ? (
                      <div className="py-4 text-center text-gray-400 text-xs">
                        Add line items to preview GL journal entry.
                      </div>
                    ) : (
                      paginatedGlPreviewLines.map(line => (
                        <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_75px_75px] gap-2 py-2 text-[11px]">
                          <div className="min-w-0 pr-1">
                            <p className={`font-semibold truncate ${line.missing ? 'text-amber-700' : 'text-gray-800'}`} title={line.accountLabel}>
                              {line.accountLabel}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate" title={line.description}>{line.description}</p>
                          </div>
                          <div className="text-right font-mono font-medium text-gray-800">
                            {line.debit > 0 ? `₱${formatCurrency(line.debit)}` : '—'}
                          </div>
                          <div className="text-right font-mono font-medium text-gray-800">
                            {line.credit > 0 ? `₱${formatCurrency(line.credit)}` : '—'}
                          </div>
                        </div>
                      ))
                    )}

                    {glJournalPreview.lines.length > 0 && (
                      <div className="grid grid-cols-[minmax(0,1fr)_75px_75px] gap-2 pt-2.5 font-bold text-xs text-brand border-t-2">
                        <div>Total</div>
                        <div className="text-right font-mono">₱{formatCurrency(glJournalPreview.totalDebit)}</div>
                        <div className="text-right font-mono">₱{formatCurrency(glJournalPreview.totalCredit)}</div>
                      </div>
                    )}
                  </div>

                  <div className="rounded border border-emerald-100 bg-emerald-50/60 p-2.5 text-[11px] text-emerald-900 space-y-1">
                    <p className="font-bold uppercase tracking-wider text-emerald-800 text-[10px]">Accrual Summary</p>
                    <p className="truncate"><span className="text-emerald-700 font-medium">Payee:</span> {formData.claimedBy || (vendors.find(v => v.id === formData.vendorId)?.name || 'Direct Reimbursement')}</p>
                    <p className="font-semibold text-emerald-700">
                      {glJournalPreview.isBalanced ? '✓ Total Debits = Total Credits' : '⚠ Debits and Credits do not match'}
                    </p>
                  </div>
                </div>
                <PaginationControls
                  currentPage={glPreviewPage}
                  totalPages={glPreviewTotalPages}
                  totalItems={glJournalPreview.lines.length}
                  pageStartIndex={glPreviewPageStartIndex}
                  pageEndIndex={glPreviewPageEndIndex}
                  onPageChange={setGlPreviewPage}
                  itemLabel="entries"
                />
              </aside>

              {/* Financial Totals Card */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b pb-2">
                  Financial Summary
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Gross Subtotal:</span>
                    <span className="font-mono font-semibold text-gray-800">
                      ₱{formatCurrency(formData.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600">
                    <span>Input VAT ({formData.inputVatAmount ? 'Creditable' : '0%'}):</span>
                    <span className="font-mono font-semibold text-gray-800">
                      ₱{formatCurrency(formData.inputVatAmount)}
                    </span>
                  </div>
                  {Number(formData.withholdingAmount || 0) > 0 && (
                    <div className="flex justify-between items-center text-rose-600">
                      <span>Less: Withholding Tax:</span>
                      <span className="font-mono font-semibold">
                        -₱{formatCurrency(formData.withholdingAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t text-sm font-bold">
                    <span className="text-brand">Net Payable:</span>
                    <span className="font-mono text-base font-black text-brand">
                      ₱{formatCurrency(formData.netPayable || formData.amount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* INTERACTIVE LINE ITEMS TABLE                                     */}
          {/* ================================================================ */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-semibold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                  <span>Line Items</span>
                  {lines.length > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs font-bold">
                      {lines.length} lines
                    </span>
                  )}
                </h4>
                <p className="text-xs text-gray-500">
                  Configure line items, classes, and expense accounts. Drag headers to reorder columns or edges to resize.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={exportLineItemsToExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 transition shadow-sm"
                >
                  <FileSpreadsheet size={15} /> Export Line Items
                </button>
                {canEditLines && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAddLine('EXPENSE')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-dashed border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition shadow-sm"
                    >
                      <Plus size={15} /> Add Line
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLine('DISCOUNT')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 transition shadow-sm"
                    >
                      <Scissors size={15} /> Discount
                    </button>
                  </>
                )}
              </div>
            </div>

            {taxCategories.length === 0 && (
              <div className="p-2.5 text-amber-800 bg-amber-50 border border-amber-200 rounded text-xs">
                ⚠️ No tax categories configured for this tenant. Lines will default to 0% VAT.
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ fontFamily: 'var(--font-sans)' }}>
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {lineColOrder.map((colKey, idx) => {
                        const col = lineColDefs[colKey];
                        if (!col) return null;
                        return (
                          <th
                            key={col.key}
                            className={`px-3 py-2.5 ${col.align} relative select-none font-bold text-gray-600 uppercase text-[11px] tracking-wider ${draggedLineColIdx === idx ? 'bg-gray-200 border-dashed border-2 border-gray-400 opacity-50' : ''
                              }`}
                            style={lineColWidths[col.key] ? { width: lineColWidths[col.key], minWidth: lineColWidths[col.key] } : { minWidth: col.width, width: col.width }}
                            draggable={col.key !== 'actions'}
                            onDragStart={e => {
                              if (col.key === 'actions') return;
                              setDraggedLineColIdx(idx);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDraggedLineColIdx(null)}
                            onDragOver={e => {
                              if (col.key === 'actions') return;
                              e.preventDefault();
                            }}
                            onDrop={e => {
                              if (col.key === 'actions' || draggedLineColIdx === null || draggedLineColIdx === idx) return;
                              e.preventDefault();
                              const newOrder = [...lineColOrder];
                              const [draggedKey] = newOrder.splice(draggedLineColIdx, 1);
                              newOrder.splice(idx, 0, draggedKey);
                              setLineColOrder(newOrder);
                              setDraggedLineColIdx(null);
                            }}
                            title={col.key !== 'actions' ? 'Drag to reorder column' : undefined}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span>{col.label}</span>
                              {/* Resize handle */}
                              {col.key !== 'actions' && (
                                <div
                                  onMouseDown={e => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const th = e.currentTarget.parentElement?.parentElement;
                                    if (!th) return;
                                    const startWidth = th.getBoundingClientRect().width;
                                    lineResizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                                    const onMouseMove = (ev: MouseEvent) => {
                                      if (!lineResizeRef.current) return;
                                      const diff = ev.clientX - lineResizeRef.current.startX;
                                      const newWidth = Math.max(40, lineResizeRef.current.startWidth + diff);
                                      setLineColWidths(prev => ({ ...prev, [lineResizeRef.current!.colKey]: newWidth }));
                                    };
                                    const onMouseUp = () => {
                                      lineResizeRef.current = null;
                                      document.removeEventListener('mousemove', onMouseMove);
                                      document.removeEventListener('mouseup', onMouseUp);
                                      document.body.style.cursor = '';
                                      document.body.style.userSelect = '';
                                    };
                                    document.addEventListener('mousemove', onMouseMove);
                                    document.addEventListener('mouseup', onMouseUp);
                                    document.body.style.cursor = 'col-resize';
                                    document.body.style.userSelect = 'none';
                                  }}
                                  className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-brand transition-colors z-10"
                                  title="Drag to resize column"
                                  draggable={false}
                                />
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {paginatedLines.map((line, pageIdx) => {
                      const idx = linePageStartIndex + pageIdx;
                      const isDragging = draggedLineIdx === idx;
                      const isDropTarget = lineDropIdx === idx;
                      return (
                        <tr
                          key={line.sourceExpenseId || idx}
                          draggable
                          onDragStart={e => {
                            setDraggedLineIdx(idx);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedLineIdx(null);
                            setLineDropIdx(null);
                          }}
                          onDragOver={e => {
                            e.preventDefault();
                            if (lineDropIdx !== idx) setLineDropIdx(idx);
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            handleRowDrop(idx);
                          }}
                          className={`transition-colors ${isDragging ? 'opacity-40 bg-gray-100' : isDropTarget ? 'bg-brand/10 border-t-2 border-brand' : 'hover:bg-gray-50/80'
                            } ${line.lineType === 'DISCOUNT' ? 'bg-rose-50/40' : ''}`}
                        >
                          {lineColOrder.map(colKey => {
                            switch (colKey) {
                              case 'lineNumber':
                                return (
                                  <td
                                    key={colKey}
                                    className="px-2 py-2 text-center text-xs font-semibold text-gray-400 cursor-grab active:cursor-grabbing select-none"
                                    title="Drag to reorder row"
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      <GripVertical size={13} className="text-gray-400" />
                                      <span>{line.lineNumber}</span>
                                    </div>
                                  </td>
                                );
                              case 'lineType':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <select
                                      value={line.lineType}
                                      onChange={e => handleUpdateLine(idx, 'lineType', e.target.value)}
                                      className={`w-full px-2 py-1 text-xs font-semibold rounded border outline-none ${line.lineType === 'DISCOUNT'
                                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                                          : 'bg-white border-gray-200 text-gray-700'
                                        }`}
                                    >
                                      <option value="EXPENSE">Expense</option>
                                      <option value="ITEM">Item</option>
                                      <option value="DISCOUNT">Discount</option>
                                      <option value="ADJUSTMENT">Adjustment</option>
                                    </select>
                                  </td>
                                );
                              case 'qualificationId':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <select
                                      required
                                      value={line.qualificationId || ''}
                                      onChange={e => handleUpdateLine(idx, 'qualificationId', e.target.value)}
                                      className="w-full px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-700 outline-none focus:border-brand"
                                      aria-label={`Expense line ${idx + 1} class`}
                                    >
                                      <option value="">Select Class...</option>
                                      {qualifications.map(q => (
                                        <option key={q.id} value={q.id}>{q.code} - {q.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              case 'expenseAccountId':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <select
                                      required
                                      value={line.expenseAccountId || ''}
                                      onChange={e => handleUpdateLine(idx, 'expenseAccountId', e.target.value)}
                                      className="w-full px-2 py-1 text-xs rounded border border-brand-light bg-brand/5 text-gray-800 font-medium outline-none focus:border-brand"
                                      aria-label={`Expense line ${idx + 1} account`}
                                    >
                                      <option value="">Select account...</option>
                                      {expenseAccounts.map(a => (
                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              case 'description':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <input
                                      type="text"
                                      placeholder="Line description..."
                                      value={line.description || ''}
                                      onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                                      className="w-full px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-700 outline-none focus:border-brand"
                                      aria-label={`Expense line ${idx + 1} description`}
                                    />
                                  </td>
                                );
                              case 'taxCategoryId':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <select
                                      value={line.taxCategoryId || ''}
                                      onChange={e => handleUpdateLine(idx, 'taxCategoryId', e.target.value)}
                                      className="w-full px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-700 outline-none focus:border-brand"
                                    >
                                      <option value="">None / 0%</option>
                                      {taxCategories.map(tc => (
                                        <option key={tc.id} value={tc.id}>{tc.code} ({tc.rate}%)</option>
                                      ))}
                                    </select>
                                  </td>
                                );
                              case 'quantity':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="any"
                                      value={line.quantity}
                                      onChange={e => handleUpdateLine(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                      className="w-full px-2 py-1 text-right text-xs rounded border border-gray-200 bg-white text-gray-700 outline-none font-mono"
                                    />
                                  </td>
                                );
                              case 'unitPrice':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <div className="flex items-center gap-1 justify-end">
                                      <span className="text-xs font-normal text-gray-500">₱</span>
                                      <CurrencyLineInput
                                        value={line.unitPrice}
                                        onValueChange={val => handleUpdateLine(idx, 'unitPrice', val)}
                                      />
                                    </div>
                                  </td>
                                );
                              case 'amount':
                                return (
                                  <td key={colKey} className="px-2 py-2">
                                    <div className="flex items-center gap-1 justify-end">
                                      <span className="text-xs font-normal text-gray-500">₱</span>
                                      <CurrencyLineInput
                                        value={line.amount}
                                        onValueChange={val => handleUpdateLine(idx, 'amount', val)}
                                      />
                                    </div>
                                  </td>
                                );
                              case 'actions':
                                return (
                                  <td key={colKey} className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLine(idx)}
                                      className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                      title="Delete line"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </td>
                                );
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={linePage}
                totalPages={lineTotalPages}
                totalItems={lines.length}
                pageStartIndex={linePageStartIndex}
                pageEndIndex={linePageEndIndex}
                onPageChange={setLinePage}
                itemLabel="lines"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-brand text-white rounded text-sm font-semibold shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// PAYABLE DETAIL MODAL COMPONENT
// ============================================================================
interface PayableDetailModalProps {
  payable: Payable;
  vendor?: Vendor;
  accounts: ChartOfAccount[];
  qualifications: Qualification[];
  taxCategories: TaxCategoryEntry[];
  timeExpenses: TimeExpense[];
  onClose: () => void;
  onApprove: () => void;
  onProcessPayment: () => void;
  onCancel: () => void;
  onPostGL: () => void;
  canPost: boolean;
  canPay: boolean;
  canApprove: boolean;
  canCancel: boolean;
}

const PayableDetailModal: React.FC<PayableDetailModalProps> = ({
  payable,
  vendor,
  accounts,
  qualifications = [],
  taxCategories = [],
  timeExpenses = [],
  onClose,
  onApprove,
  onProcessPayment,
  onCancel,
  onPostGL,
  canPost,
  canPay,
  canApprove,
  canCancel,
}) => {
  const statusConfig = STATUS_CONFIG[payable.status];
  const expenseAccount = accounts.find(a => a.id === payable.expenseAccountId);
  const glAccount = accounts.find(a => a.id === payable.glAccountId);
  const invoiceTypeConfig = INVOICE_TYPES.find(t => t.value === payable.invoiceType);
  const formatCurrency = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const remainingBalance = getPayableOutstanding(payable);
  const isTwelvePercentVat = (category?: TaxCategoryEntry) => {
    const code = String(category?.code || '').toUpperCase().replace(/[\s_-]+/g, '');
    return Number(category?.rate) === 12 && (code === 'VATGOODS' || code === 'VATSERV');
  };
  const legacyVatBySourceId = new Map((payable.expenseAllocations || []).map(allocation => {
    const expense = timeExpenses.find(item => item.id === allocation.sourceExpenseId);
    const category = taxCategories.find(item => item.id === expense?.taxCategoryId);
    const gross = Number(allocation.amount || 0);
    const vat = isTwelvePercentVat(category) ? Math.round((gross - gross / 1.12) * 100) / 100 : 0;
    return [allocation.sourceExpenseId, vat] as const;
  }));
  const derivedLegacyVat = Number(payable.inputVatAmount || 0) > 0 ? 0 : Math.round(
    Array.from(legacyVatBySourceId.values()).reduce((sum, vat) => sum + vat, 0) * 100
  ) / 100;
  const inputVatAmount = Number(payable.inputVatAmount || 0) + derivedLegacyVat;
  const grossPayable = Number(payable.netPayable || (Number(payable.amount) + inputVatAmount - Number(payable.withholdingAmount || 0)));

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
        <div className="bg-white rounded-md shadow-md w-full max-w-xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
          <div className="p-6 border-b flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand text-white rounded shadow-brand/20">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">{payable.payableNumber}</h3>
                <p className="text-xs text-gray-500">{vendor?.name || 'Unknown Vendor'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Status & Amount */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1.5 text-xs font-bold uppercase rounded-full ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                  {statusConfig.label}
                </span>
                <span className={`text-xs font-semibold ${invoiceTypeConfig?.color}`}>
                  {invoiceTypeConfig?.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-800">{"\u20B1"}{formatCurrency(grossPayable)}</p>
                {remainingBalance !== (payable.netPayable || payable.amount) && (
                  <p className="text-xs text-brand font-semibold">Balance: {"\u20B1"}{formatCurrency(remainingBalance)}</p>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Class</p>
                <p className="text-gray-700 font-medium">
                  {(() => {
                    const qualification = qualifications.find(q => q.id === payable.qualificationId);
                    return qualification ? `${qualification.code} - ${qualification.name}` : (PAYABLE_CATEGORIES.find(c => c.value === payable.category)?.label || 'Unassigned');
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Expense Account</p>
                <p className="text-gray-700 font-medium">{expenseAccount ? `${expenseAccount.code} - ${expenseAccount.name}` : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Invoice Date</p>
                <p className="text-gray-700 font-medium">{payable.billDate}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Due Date</p>
                <p className="text-gray-700 font-medium">{payable.dueDate}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Gross Amount</p>
                <p className="text-gray-700 font-mono">{"\u20B1"}{formatCurrency(payable.amount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Input VAT</p>
                <p className="text-gray-700 font-mono">{"\u20B1"}{formatCurrency(inputVatAmount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Withholding</p>
                <p className="text-gray-700 font-mono">{"\u20B1"}{formatCurrency(payable.withholdingAmount || 0)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Paid Amount</p>
                <p className="text-brand font-mono font-semibold">{"\u20B1"}{formatCurrency(payable.paidAmount || 0)}</p>
              </div>
              {payable.referenceDocument && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Reference Document</p>
                  <p className="text-gray-700 font-medium">{payable.referenceDocument}</p>
                </div>
              )}
              {payable.description && (
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Description</p>
                  <p className="text-gray-700">{payable.description}</p>
                </div>
              )}
            </div>

            {!!payable.expenseAllocations?.length && (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Bill amount breakdown</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {payable.expenseAllocations.map((allocation, index) => {
                    const allocationAccount = accounts.find(account => account.id === allocation.expenseAccountId);
                    return <div key={allocation.sourceExpenseId || index} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm">
                      <div><p className="font-medium text-gray-700">{allocation.description || `Expense line ${index + 1}`}</p><p className="mt-0.5 text-xs text-gray-400">{allocationAccount ? `${allocationAccount.code} - ${allocationAccount.name}` : 'Expense account'}</p></div>
                      <p className="font-mono font-semibold text-gray-800">{"\u20B1"}{formatCurrency(Number(allocation.amount || 0))}</p>
                    </div>;
                  })}
                  <div className="grid grid-cols-[1fr_auto] gap-4 border-t-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold">
                    <p className="text-right text-gray-600">Total payable</p><p className="font-mono text-gray-900">{"\u20B1"}{formatCurrency(grossPayable)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* GL Status */}
            {payable.journalEntryId && (
              <div className="bg-brand/10 rounded p-4 border border-brand-light">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-brand" size={16} />
                  <span className="text-sm font-semibold text-brand">Posted to General Ledger</span>
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="bg-gray-50 rounded p-4 text-xs text-gray-500 space-y-1">
              <p>Created: {new Date(payable.createdAt).toLocaleString()}</p>
              {payable.approvedAt && <p>Approved: {new Date(payable.approvedAt).toLocaleString()}</p>}
              {payable.paidAt && <p>Paid: {new Date(payable.paidAt).toLocaleString()}</p>}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded transition-colors"
              >
                Close
              </button>
              {canPost && canApprove && (
                <button
                  onClick={onPostGL}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                >
                  <BookOpen size={16} /> Post to GL
                </button>
              )}
              {canApprove && payable.status === 'for_approval' && !canPost && (
                <button
                  onClick={onApprove}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={16} /> Approve
                </button>
              )}
              {canPay && (
                <button
                  onClick={onProcessPayment}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-bold hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
                >
                  <Landmark size={16} /> Pay
                </button>
              )}
              {canCancel && (payable.status === 'for_approval' || (payable.status === 'approved' && !(payable.paidAmount || 0))) && (
                <button
                  onClick={onCancel}
                  className="flex-1 py-3 border border-rose-200 text-rose-700 rounded text-sm font-bold hover:bg-rose-50 transition-colors"
                >
                  Cancel Bill
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default PayablesView;

