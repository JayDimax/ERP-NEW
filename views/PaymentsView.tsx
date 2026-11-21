import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AccountClass, Payment, PaymentApplication, PaymentMethod, PaymentStatus, Sponsor, Student, Invoice, BankAccount, ChartOfAccount, JournalEntry, Organization, User as AppUser } from '../types';
import { generateUUID } from '../utils/uuid';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter, PageOrder } from '../services/IDataService';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  DollarSign,
  FileSpreadsheet,
  Plus,
  Printer,
  Save,
  Search,
  CornerUpLeft,
  Wallet,
  X,
  XCircle,
  RotateCcw,
  FileText,
  CheckSquare
} from 'lucide-react';

interface PaymentsViewProps {
  currentOrgId: string;  // Current organization for org_id separation
  organization?: Organization;
  payments: Payment[];
  sponsors: Sponsor[];
  students: Student[];
  users?: AppUser[];
  invoices: Invoice[];
  bankAccounts: BankAccount[];
  accounts: ChartOfAccount[];
  journalEntries: JournalEntry[];
  currency: string;
  onAddPayment: (payment: Payment) => Promise<void> | void;
  onUpdatePayment: (payment: Payment) => Promise<void> | void;
  onDeletePayment: (id: string) => Promise<boolean>;
  onPostPayment?: (payment: Payment) => Promise<void> | void;
  onVoidPayment?: (id: string, reason: string) => Promise<void> | void;
  onApplyToInvoice?: (paymentId: string, invoiceId: string, amount: number) => Promise<void> | void;
  onReverseApplication?: (paymentId: string, applicationId: string, reason: string) => void;
  onViewJournal?: (journalEntryId: string) => void;
  initialContext?: { viewMode: ViewMode; invoice?: Invoice };
  onClearContext?: () => void;
}

type PayorType = 'SPONSOR' | 'STUDENT' | 'OTHER';
type ViewMode = 'list' | 'create-payment' | 'apply-payment' | 'payment-details';
type ListTab = 'payments' | 'applications';
type ApplicationListTab = 'unapplied' | 'applied';
type AmountFieldName = 'amountReceived' | 'ewtAmountCertified';
type PaymentRegistryColumn = {
  key: string;
  label: string;
  align: 'text-left' | 'text-center' | 'text-right';
  minWidth: number;
  sortKey?: string;
  value: (payment: Payment) => string | number;
  render: (payment: Payment) => React.ReactNode;
};

type ApplicationRegistryColumn = {
  key: string;
  label: string;
  align: 'text-left' | 'text-center' | 'text-right';
  minWidth: number;
  sortKey?: string;
  value?: (payment: Payment) => string | number;
  render: (payment: Payment) => React.ReactNode;
};

type ApplyPaymentColumn = {
  key: string;
  label: string;
  align: 'text-left' | 'text-center' | 'text-right';
  minWidth: number;
  render: (inv: Invoice, invoiceSelectionMap: Record<string, boolean>, invoiceApplyMap: Record<string, number>, transactionDescriptions: Record<string, string>, setTransactionDescriptions: React.Dispatch<React.SetStateAction<Record<string, string>>>, handleInvoiceTick: (inv: Invoice, checked: boolean) => void) => React.ReactNode;
};

const PAYMENT_PAGE_SIZE = 7;
const PAYMENT_COLUMNS = 'id,org_id,payment_no,sponsor_id,student_id,other_customer_name,payment_date,status,payment_method,ref_no,bank_account_id,check_number,check_date,amount_received,ewt_amount_certified,total_applied,customer_deposit_balance,journal_entry_id,voided_at,voided_by,void_reason,posted_at,posted_by,notes,created_at,created_by,updated_at,updated_by,is_deleted,deleted_at,deleted_by';
const PAYMENT_APPLICATION_COLUMNS = 'id,org_id,payment_id,invoice_id,application_no,amount_applied,is_reversed,reversal_reason,reversed_at,reversed_by,gl_reference,journal_entry_id,created_at,created_by,updated_at,updated_by';

interface PayorSearchOption {
  id: string;
  label: string;
  sublabel?: string;
  searchText: string;
}

const SearchablePayorSelect: React.FC<{
  options: PayorSearchOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
  emptyMessage?: string;
}> = ({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled = false,
  emptyMessage = 'No matching payor found.'
}) => {
  const selectedOption = options.find(opt => opt.id === value);
  const [query, setQuery] = useState(selectedOption ? selectedOption.label : '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedOption ? selectedOption.label : '');
  }, [selectedOption?.id, selectedOption?.label]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = options.filter(opt => {
      if (!normalizedQuery || (selectedOption && query === selectedOption.label)) return true;
      return opt.searchText.includes(normalizedQuery);
    });
    return matches.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [options, query, selectedOption]);

  const selectOption = (opt: PayorSearchOption) => {
    onChange(opt.id);
    setQuery(opt.label);
    setIsOpen(false);
    setActiveIndex(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative mt-1"
      onBlur={event => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) {
          setIsOpen(false);
          setQuery(selectedOption ? selectedOption.label : '');
        }
      }}
    >
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
          onFocus={() => setIsOpen(true)}
          onChange={event => {
            setQuery(event.target.value);
            if (value) onChange('');
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex(index => Math.min(index + 1, Math.max(0, filteredOptions.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(index => Math.max(0, index - 1));
            } else if (event.key === 'Enter' && isOpen && filteredOptions[activeIndex]) {
              event.preventDefault();
              selectOption(filteredOptions[activeIndex]);
            } else if (event.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />
        {(query || value) && !disabled && (
          <button
            type="button"
            aria-label={`Clear ${ariaLabel}`}
            onClick={() => {
              onChange('');
              setQuery('');
              setActiveIndex(0);
              setIsOpen(true);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {isOpen && !disabled && (
        <div role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">{emptyMessage}</div>
          ) : (
            filteredOptions.map((opt, index) => (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={opt.id === value}
                onMouseDown={event => {
                  event.preventDefault();
                  selectOption(opt);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  index === activeIndex || opt.id === value
                    ? 'bg-emerald-50 font-semibold text-emerald-900'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.sublabel && <span className="ml-2 shrink-0 text-xs text-gray-400">{opt.sublabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const PaymentsView: React.FC<PaymentsViewProps> = ({
  currentOrgId,
  organization,
  payments,
  sponsors,
  students,
  users = [],
  invoices,
  bankAccounts,
  accounts,
  journalEntries,
  currency,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onPostPayment,
  onVoidPayment,
  onApplyToInvoice,
  onReverseApplication,
  onViewJournal,
  initialContext,
  onClearContext
}) => {
  const CASH_ON_HAND_UNDEPOSITED_ID = 'CASH_ON_HAND_UNDEPOSITED_FUNDS';
  const brandColor = organization?.primaryColor || 'var(--acm-primary)';

  // View mode management
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [listTab, setListTab] = useState<ListTab>('payments');
  const [applicationListTab, setApplicationListTab] = useState<ApplicationListTab>('unapplied');
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [payorType, setPayorType] = useState<PayorType>('SPONSOR');
  const [sourceInvoiceId, setSourceInvoiceId] = useState<string | undefined>(undefined);
  
  // List filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | 'none' }>({ key: 'paymentDate', direction: 'desc' });
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [payerFilterMode, setPayerFilterMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [payerSearchTerm, setPayerSearchTerm] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [serverPayments, setServerPayments] = useState<Payment[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverCurrentPage, setServerCurrentPage] = useState(1);
  const [isLoadingPaymentPage, setIsLoadingPaymentPage] = useState(false);
  const [paymentPageError, setPaymentPageError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  
  // Application state
  const [invoiceApplyMap, setInvoiceApplyMap] = useState<Record<string, number>>({});
  const [invoiceSelectionMap, setInvoiceSelectionMap] = useState<Record<string, boolean>>({});
  const [transactionDescriptions, setTransactionDescriptions] = useState<Record<string, string>>({});
  const [openInvoicesForPayor, setOpenInvoicesForPayor] = useState<Invoice[]>([]);
  const [isFetchingOpenInvoices, setIsFetchingOpenInvoices] = useState(false);
  
  // Modals
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [reversingApplication, setReversingApplication] = useState<{ payment: Payment; application: PaymentApplication } | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [showReverseModal, setShowReverseModal] = useState(false);

  // Drag-and-drop column ordering state (registry table)
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'date', 'postPeriod', 'paymentNo', 'status', 'glReference', 'payor', 'method', 'amountReceived', 'amountApplied', 'balance', 'createdBy', 'createdOn'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);
  const [applicationColumnOrder, setApplicationColumnOrder] = useState<string[]>([
    'date', 'postPeriod', 'paymentApplicationNo', 'invoiceNo', 'status', 'glReference', 'payor', 'amountReceived', 'amountApplied', 'balance', 'applications'
  ]);
  const [draggedApplicationColumnIdx, setDraggedApplicationColumnIdx] = useState<number | null>(null);

  // Column resize state (registry table)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const [applicationColumnWidths, setApplicationColumnWidths] = useState<Record<string, number>>({});
  const applicationResizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Drag-and-drop column ordering state (apply payment table)
  const [applyPaymentColumnOrder, setApplyPaymentColumnOrder] = useState<string[]>([
    'apply', 'invoiceNo', 'date', 'postPeriod', 'transactionDescription', 'amountDue', 'applyAmount'
  ]);
  const [draggedApplyPaymentColumnIdx, setDraggedApplyPaymentColumnIdx] = useState<number | null>(null);

  // Column resize state (apply payment table)
  const [applyPaymentColumnWidths, setApplyPaymentColumnWidths] = useState<Record<string, number>>({});
  const applyPaymentResizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    paymentNo: '',
    crNo: '',
    sponsorId: '',
    studentId: '',
    otherCustomerName: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
    refNo: '',
    bankAccountId: '',
    checkNumber: '',
    checkDate: '',
    amountReceived: 0,
    ewtAmountCertified: 0,
    notes: ''
  });
  const [focusedAmountField, setFocusedAmountField] = useState<AmountFieldName | null>(null);
  const [amountInputDrafts, setAmountInputDrafts] = useState<Record<AmountFieldName, string>>({
    amountReceived: '',
    ewtAmountCertified: ''
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const selectedPayorId = payorType === 'SPONSOR'
    ? formData.sponsorId
    : payorType === 'STUDENT'
      ? formData.studentId
      : formData.otherCustomerName.trim();
  // Read-only for posted/voided payments when viewing, or for payments with certain statuses
  const isReadOnly = editingPayment && (editingPayment.status === 'POSTED' || editingPayment.status === 'VOIDED' || editingPayment.status === 'OPEN' || editingPayment.status === 'CLOSED');

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency || 'PHP'
  }).format(amount || 0);

  const formatInputCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value ?? 0);
  };

  const currencySymbol = (currency || 'PHP') === 'PHP' ? '₱' : (currency || 'PHP');
  const renderAccountingAmount = (amount: number) => (
    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 font-medium text-gray-800 tabular-nums">
      <span className="text-left">{currencySymbol}</span>
      <span className="truncate text-right">{formatInputCurrency(amount || 0)}</span>
    </span>
  );

  const formatPesoKpiAmount = (amount: number) => {
    if ((currency || 'PHP') === 'PHP') {
      return `₱${formatInputCurrency(amount)}`;
    }
    return formatCurrency(amount);
  };

  const parseInputCurrency = (value: string) => {
    const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatEditableAmount = (value: number) => {
    if (!value) return '';
    return String(value);
  };

  const normalizeAmountInput = (value: string) => {
    let normalized = value.replace(/,/g, '').replace(/\s/g, '').replace(/[^\d.]/g, '');
    const firstDecimalIndex = normalized.indexOf('.');
    if (firstDecimalIndex !== -1) {
      normalized =
        normalized.slice(0, firstDecimalIndex + 1) +
        normalized.slice(firstDecimalIndex + 1).replace(/\./g, '');
    }
    if (normalized.startsWith('.')) normalized = `0${normalized}`;
    return normalized;
  };

  const getAmountInputValue = (field: AmountFieldName) => {
    if (focusedAmountField === field) return amountInputDrafts[field];
    return formatInputCurrency(formData[field]);
  };

  const handleAmountFocus = (field: AmountFieldName, event: React.FocusEvent<HTMLInputElement>) => {
    setFocusedAmountField(field);
    setAmountInputDrafts(prev => ({
      ...prev,
      [field]: formatEditableAmount(formData[field])
    }));
    event.currentTarget.select();
  };

  const handleAmountChange = (field: AmountFieldName, rawValue: string) => {
    const normalized = normalizeAmountInput(rawValue);
    const parsedAmount = parseInputCurrency(normalized);
    setAmountInputDrafts(prev => ({ ...prev, [field]: normalized }));
    setFormData(prev => {
      if (field !== 'ewtAmountCertified') {
        return { ...prev, [field]: parsedAmount };
      }

      const ewtDelta = parsedAmount - Number(prev.ewtAmountCertified ?? 0);
      return {
        ...prev,
        amountReceived: Math.max(Number(prev.amountReceived ?? 0) - ewtDelta, 0),
        ewtAmountCertified: parsedAmount
      };
    });
  };

  const handleAmountBlur = () => {
    setFocusedAmountField(null);
  };

  const generatePaymentNo = () => {
    const year = new Date().getFullYear();
    // Filter payments by current year, exclude deleted payments
    // Note: This is a temporary number for UI display - the actual number is generated server-side
    const existingNums = payments
      .filter(p => 
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
    let nextNum = existingNums.length ? Math.max(...existingNums) + 1 : 1;
    
    // Ensure no duplicates
    while (existingSet.has(nextNum)) {
      nextNum += 1;
    }

    return `PAY-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  const generatePaymentApplicationNo = (reservedApplicationNos?: Set<string>) => {
    const year = new Date().getFullYear();
    const existingNums = payments
      .flatMap(payment => payment.applications || [])
      .map(application => {
        const match = String(application.applicationNo || '').trim().match(/^PAYAPP-\d{4}-(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);

    const existingSet = new Set(existingNums);
    let nextNum = existingNums.length ? Math.max(...existingNums) + 1 : 1;

    while (existingSet.has(nextNum) || reservedApplicationNos?.has(`PAYAPP-${year}-${String(nextNum).padStart(5, '0')}`)) {
      nextNum += 1;
    }

    return `PAYAPP-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  const getPayorName = (payment: Payment) => {
    if (payment.sponsorId) return sponsors.find(s => s.id === payment.sponsorId)?.name || '-';
    if (payment.studentId) {
      const student = students.find(s => s.id === payment.studentId);
      return student ? `${student.lastName}, ${student.firstName}` : '-';
    }
    return String(payment.otherCustomerName || '').trim() || '-';
  };

  const getInvoicePayorName = (invoice: Invoice) => {
    if (invoice.sponsorId) return sponsors.find(s => s.id === invoice.sponsorId)?.name || '-';
    if (invoice.studentId) {
      const student = students.find(s => s.id === invoice.studentId);
      return student ? `${student.lastName}, ${student.firstName}` : '-';
    }
    return String(invoice.otherCustomerName || '').trim() || '-';
  };

  const selectedSourceInvoice = useMemo(
    () => invoices.find(invoice => invoice.id === sourceInvoiceId),
    [invoices, sourceInvoiceId]
  );

  const invoiceSelectionOptions = useMemo(() => {
    const selectedId = sourceInvoiceId;
    const hasSelectedPayor = !!selectedPayorId;

    return invoices
      .filter(invoice => {
        if (invoice.orgId !== currentOrgId) return false;
        if (invoice.status === 'VOIDED') return false;
        if (selectedId && invoice.id === selectedId) return true;
        if (!hasSelectedPayor) return false;
        if (payorType === 'SPONSOR') return invoice.sponsorId === formData.sponsorId && invoice.status === 'OPEN';
        if (payorType === 'STUDENT') return invoice.studentId === formData.studentId && invoice.status === 'OPEN';
        return !invoice.sponsorId && !invoice.studentId && String(invoice.otherCustomerName || '').trim().toLowerCase() === formData.otherCustomerName.trim().toLowerCase() && invoice.status === 'OPEN';
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.invoiceDate || 0).getTime() - new Date(a.invoiceDate || 0).getTime();
        if (dateDiff !== 0) return dateDiff;
        return String(a.invoiceNo || '').localeCompare(String(b.invoiceNo || ''), undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [invoices, sourceInvoiceId, selectedPayorId, currentOrgId, payorType, formData.sponsorId, formData.studentId, formData.otherCustomerName]);

  const existingLinkedInvoicePayment = useMemo(() => {
    if (!sourceInvoiceId) return null;

    return payments.find(payment =>
      payment.id !== editingPayment?.id &&
      payment.orgId === currentOrgId &&
      !payment.isDeleted &&
      payment.status !== 'VOIDED' &&
      payment.sourceInvoiceId === sourceInvoiceId
    ) || null;
  }, [payments, editingPayment?.id, currentOrgId, sourceInvoiceId]);

  const existingLinkedInvoicePaymentStatusLabel = existingLinkedInvoicePayment
    ? (existingLinkedInvoicePayment.status === 'DRAFT'
      ? 'Draft'
      : existingLinkedInvoicePayment.status === 'CLOSED'
        ? 'Closed'
        : 'Approved')
    : '';

  const getTotalPaymentCredit = (payment: Payment) =>
    Number(payment.amountReceived ?? 0) + Number(payment.ewtAmountCertified ?? 0);

  const getAvailablePaymentBalance = (payment: Payment) => {
    const explicitBalance = Number(payment.customerDepositBalance ?? NaN);
    if (Number.isFinite(explicitBalance)) {
      return Math.max(explicitBalance, 0);
    }
    return Math.max(getTotalPaymentCredit(payment) - Number(payment.totalApplied ?? 0), 0);
  };

  const getActiveApplications = (payment: Payment) =>
    (payment.applications || []).filter(app => !app.isReversed);

  const isAppliedPayment = (payment: Payment) =>
    getActiveApplications(payment).length > 0 || Number(payment.totalApplied ?? 0) > 0;

  const activeAppliedInvoiceIds = useMemo(() => new Set(
    editingPayment ? getActiveApplications(editingPayment).map(app => app.invoiceId) : []
  ), [editingPayment?.applications]);

  const getPaymentApplicationRecords = (payment: Payment) =>
    getActiveApplications(payment)
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  const getPaymentApplicationNo = (application: PaymentApplication) => {
    const savedApplicationNo = String(application.applicationNo || '').trim();
    if (savedApplicationNo) return savedApplicationNo;

    const createdYear = application.createdAt
      ? new Date(application.createdAt).getFullYear()
      : new Date().getFullYear();
    const suffix = String(application.id || '')
      .replace(/-/g, '')
      .slice(-6)
      .toUpperCase();

    return `PAYAPP-${createdYear}-${suffix || 'PENDING'}`;
  };

  const getPaymentApplicationNumberLabel = (payment: Payment) => {
    const applications = getPaymentApplicationRecords(payment);
    if (applications.length === 0) return '-';
    return applications.map(getPaymentApplicationNo).join(', ');
  };

  const getPaymentApplicationJournalEntry = (application: PaymentApplication) => {
    const savedReference = String(application.glReference || '').trim();
    const applicationNo = getPaymentApplicationNo(application);
    const linkedInvoice = invoices.find(inv => inv.id === application.invoiceId);
    const linkedInvoiceNo = String(linkedInvoice?.invoiceNo || '').trim().toLowerCase();

    // Match in strict priority order so an earlier reversed/stale APPLICATION entry
    // with the same invoice or applicationNo never hijacks an exact journalEntryId or glReference match.
    if (application.journalEntryId) {
      const byId = journalEntries.find(je => je.id === application.journalEntryId);
      if (byId) return byId;
    }

    if (savedReference) {
      const bySavedRef = journalEntries.find(
        je => je.glEntryNumber === savedReference || je.reference === savedReference
      );
      if (bySavedRef) return bySavedRef;
    }

    const bySourceRef = journalEntries.find(
      je => String(je.sourceType || '').toUpperCase() === 'APPLICATION' && je.sourceRef === application.id
    );
    if (bySourceRef) return bySourceRef;

    if (applicationNo) {
      const byAppNo = journalEntries.find(
        je => String(je.sourceType || '').toUpperCase() === 'APPLICATION' && je.reference === applicationNo
      ) || journalEntries.find(je => je.reference === applicationNo);
      if (byAppNo) return byAppNo;
    }

    if (linkedInvoiceNo) {
      return journalEntries.find(
        je =>
          String(je.sourceType || '').toUpperCase() === 'APPLICATION' &&
          String(je.description || '').toLowerCase().includes(linkedInvoiceNo)
      );
    }

    return undefined;
  };

  const getPaymentApplicationGlReference = (application: PaymentApplication) => {
    const savedReference = String(application.glReference || '').trim();
    if (savedReference) return savedReference;

    const journalEntry = getPaymentApplicationJournalEntry(application);
    return String(journalEntry?.glEntryNumber || journalEntry?.reference || '').trim() || 'Pending';
  };

  const getPaymentApplicationGlReferenceLabel = (payment: Payment) => {
    const applications = getPaymentApplicationRecords(payment);
    if (applications.length === 0) return payment.status === 'DRAFT' ? '-' : 'Pending GL';
    return applications.map(getPaymentApplicationGlReference).join(', ');
  };

  const getPaymentJournalEntry = (payment: Payment) => {
    const savedReference = String(payment.glEntryNumber || '').trim();

    if (payment.journalEntryId) {
      const byId = journalEntries.find(je => je.id === payment.journalEntryId);
      if (byId) return byId;
    }

    if (savedReference) {
      const bySavedRef = journalEntries.find(
        je => je.glEntryNumber === savedReference || je.reference === savedReference
      );
      if (bySavedRef) return bySavedRef;
    }

    const bySourceRef = journalEntries.find(
      je => String(je.sourceType || '').toUpperCase() === 'PAYMENT' && je.sourceRef === payment.id
    );
    if (bySourceRef) return bySourceRef;

    if (payment.paymentNo) {
      return journalEntries.find(
        je => String(je.sourceType || '').toUpperCase() === 'PAYMENT' && je.reference === payment.paymentNo
      ) || journalEntries.find(je => je.reference === payment.paymentNo);
    }

    return undefined;
  };

  const getPaymentGlReference = (payment: Payment) => {
    const savedReference = String(payment.glEntryNumber || '').trim();
    if (savedReference) return savedReference;

    const journalEntry = getPaymentJournalEntry(payment);
    return String(journalEntry?.glEntryNumber || journalEntry?.reference || '').trim();
  };

  const getPaymentGlReferenceLabel = (payment: Payment) => {
    if (payment.status === 'DRAFT') return '-';
    return getPaymentGlReference(payment) || 'Pending GL';
  };

  const renderPaymentGlReference = (
    payment: Payment,
    className = 'font-medium text-gray-800'
  ) => {
    const label = getPaymentGlReferenceLabel(payment);
    const journalEntry = getPaymentJournalEntry(payment);
    const isPendingGl = label === 'Pending GL';
    const pendingClassName = `${className} ${isPendingGl ? 'text-amber-700' : ''}`;

    if (!onViewJournal || !journalEntry?.id || isPendingGl || label === '-') {
      return <span className={pendingClassName}>{label}</span>;
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onViewJournal(journalEntry.id);
        }}
        className={`${className} text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200`}
        title={`View journal entry ${label}`}
      >
        {label}
      </button>
    );
  };

  const renderPaymentApplicationGlReference = (
    application: PaymentApplication,
    className = 'font-medium text-gray-800'
  ) => {
    const label = getPaymentApplicationGlReference(application);
    const journalEntry = getPaymentApplicationJournalEntry(application);

    if (!onViewJournal || !journalEntry?.id || label === 'Pending') {
      return <span className={`${className} ${label === 'Pending' ? 'text-amber-700' : ''}`}>{label}</span>;
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onViewJournal(journalEntry.id);
        }}
        className={`${className} text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200`}
        title={`View journal entry ${label}`}
      >
        {label}
      </button>
    );
  };

  const renderPaymentApplicationGlReferences = (
    payment: Payment,
    className = 'font-medium text-gray-800'
  ) => {
    const applications = getPaymentApplicationRecords(payment);
    if (applications.length === 0) {
      return <span className={`${className} ${payment.status === 'DRAFT' ? '' : 'text-amber-700'}`}>{payment.status === 'DRAFT' ? '-' : 'Pending GL'}</span>;
    }

    return (
      <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {applications.map((application, index) => (
          <React.Fragment key={application.id || index}>
            {index > 0 && <span className="text-gray-400">,</span>}
            {renderPaymentApplicationGlReference(application, className)}
          </React.Fragment>
        ))}
      </span>
    );
  };

  const isInvoiceSettled = (invoice?: Pick<Invoice, 'status' | 'balanceDue'> | null) =>
    !!invoice && (invoice.status === 'CLOSED' || Number(invoice.balanceDue ?? 0) <= 0.01);

  const isPaymentPostedOrFinalized = (payment?: Pick<Payment, 'status' | 'postedAt' | 'journalEntryId'> | null) =>
    !!payment && payment.status !== 'DRAFT' && payment.status !== 'VOIDED' &&
    (payment.status === 'OPEN' || payment.status === 'POSTED' || payment.status === 'CLOSED' || !!payment.postedAt || !!payment.journalEntryId);

  const getApplicationStatusLabel = (payment: Payment, application: PaymentApplication) => {
    if (application.isReversed) return 'REVERSED';

    const invoice = invoices.find(inv => inv.id === application.invoiceId);
    const isConfirmed = isPaymentPostedOrFinalized(payment);
    const fullyAllocated = Number(application.amountApplied ?? 0) > 0;

    if (isConfirmed && fullyAllocated && isInvoiceSettled(invoice)) {
      return 'CLOSED';
    }

    return 'OPEN';
  };

  const getApplicationRegistryStatus = (payment: Payment): PaymentStatus => {
    if (payment.status === 'VOIDED' || payment.status === 'DRAFT') {
      return payment.status;
    }

    const activeApplications = getActiveApplications(payment);
    const availableBalance = getAvailablePaymentBalance(payment);
    const hasAppliedAmount = Number(payment.totalApplied ?? 0) > 0;

    if (activeApplications.length === 0) {
      return availableBalance <= 0.01 && (hasAppliedAmount || payment.status === 'CLOSED') ? 'CLOSED' : 'OPEN';
    }

    const allApplicationsClosed = activeApplications.every(app => getApplicationStatusLabel(payment, app) === 'CLOSED');
    return allApplicationsClosed && availableBalance <= 0.01 ? 'CLOSED' : 'OPEN';
  };

  const getPaymentRegistryStatus = (payment: Payment): PaymentStatus => {
    if (payment.status === 'VOIDED' || payment.status === 'DRAFT') {
      return payment.status;
    }

    if (
      payment.status === 'POSTED' ||
      payment.status === 'CLOSED' ||
      !!payment.postedAt ||
      !!payment.journalEntryId ||
      !!getPaymentGlReference(payment)
    ) {
      return 'POSTED';
    }

    return 'OPEN';
  };

  const canApplyPayment = (payment: Payment) =>
    (payment.status === 'OPEN' || payment.status === 'POSTED') && getAvailablePaymentBalance(payment) > 0.01;

  const getCashGlAccount = (bankId?: string) => {
    if (!bankId) return undefined;
    const normalizedName = (name?: string) => (name || '').toLowerCase();
    if (bankId === CASH_ON_HAND_UNDEPOSITED_ID) {
      return accounts.find(a => normalizedName(a.name).includes('undeposited')) ||
        accounts.find(a => normalizedName(a.name).includes('cash on hand')) ||
        accounts.find(a => a.code === '1000');
    }
    const bank = bankAccounts.find(b => b.id === bankId);
    if (bank?.glAccountId) {
      return accounts.find(a => a.id === bank.glAccountId) ||
        accounts.find(a => a.code === bank.glAccountId);
    }
    return accounts.find(a => a.id === bankId);
  };

  const getCashGlLabel = (bankId?: string) => {
    const gl = getCashGlAccount(bankId);
    if (!gl) return `${bankAccounts.find(b => b.id === bankId)?.bankName || 'Cash Account'}`;
    const code = gl.code ? `${gl.code} - ` : '';
    return `${code}${gl.name}`;
  };

  // Resolve GL accounts for payment posting
  const resolvePaymentGlAccounts = () => {
    const normalizedName = (name?: string) => (name || '').toLowerCase();
    const orgPostingAccounts = accounts.filter(a => (!a.orgId || a.orgId === currentOrgId) && !a.isHeader);
    const defaultAcctList = orgPostingAccounts.length > 0 ? orgPostingAccounts : accounts;
    const byName = (patterns: string[], acctList?: ChartOfAccount[]) => {
      const acctSet = acctList || defaultAcctList;
      return acctSet.find(a => {
        const name = normalizedName(a.name);
        return patterns.every(p => name.includes(p));
      });
    };
    const byCode = (codes: string[], acctList?: ChartOfAccount[]) => {
      const acctSet = acctList || defaultAcctList;
      return acctSet.find(a => codes.includes(a.code || ''));
    };

    const cashAccount = getCashGlAccount(formData.bankAccountId);
    const customerDepositsAccount =
      byName(['customer', 'deposit']) ||
      byName(['advance', 'customer']) ||
      byName(['unearned', 'revenue']) ||
      byCode(['2000']);

    const ewtReceivableAccount =
      byName(['creditable', 'withholding', 'tax']) ||
      byName(['cwt', '2307']) ||
      byName(['ewt', 'receivable']) ||
      byName(['withholding', 'receivable']) ||
      byCode(['14001', '14200']);

    return { cashAccount, customerDepositsAccount, ewtReceivableAccount };
  };

  // Calculate GL lines for GL Review
  const calculatePaymentGlLines = () => {
    const { cashAccount, customerDepositsAccount, ewtReceivableAccount } = resolvePaymentGlAccounts();
    const amountReceived = Number(formData.amountReceived ?? 0) || 0;
    const ewtAmount = Number(formData.ewtAmountCertified ?? 0) || 0;
    const totalCredit = amountReceived + ewtAmount;

    const lines: Array<{ account?: ChartOfAccount; description: string; debit: number; credit: number }> = [];

    // Cash account debit
    if (cashAccount) {
      lines.push({
        account: cashAccount,
        description: `Cash receipt for ${formData.paymentNo}`,
        debit: amountReceived,
        credit: 0
      });
    }

    // EWT receivable debit
    if (ewtAmount > 0 && ewtReceivableAccount) {
      lines.push({
        account: ewtReceivableAccount,
        description: `Creditable Withholding Tax (CWT 2307) for ${formData.paymentNo}`,
        debit: ewtAmount,
        credit: 0
      });
    }

    // Customer deposits credit
    if (customerDepositsAccount) {
      lines.push({
        account: customerDepositsAccount,
        description: `Customer deposits for ${formData.paymentNo}`,
        debit: 0,
        credit: totalCredit
      });
    }

    return lines;
  };

  const cashAccountOptions = useMemo(() => {
    const base = [{ id: CASH_ON_HAND_UNDEPOSITED_ID, label: 'Cash on Hand - Undeposited Funds' }];
    const mappedBanks = bankAccounts.map(bank => ({
      id: bank.id,
      label: `${bank.bankName} - ${bank.accountNumber}`
    }));
    return [...base, ...mappedBanks];
  }, [bankAccounts]);

  const defaultCashAccountId = useMemo(() => {
    const undeposited = bankAccounts.find(account => {
      const bankName = account.bankName?.toLowerCase() || '';
      const accountNumber = account.accountNumber?.toLowerCase() || '';
      return bankName.includes('undeposited funds') || accountNumber.includes('undeposited funds');
    });
    if (undeposited) return undeposited.id;
    return CASH_ON_HAND_UNDEPOSITED_ID;
  }, [bankAccounts]);

  const buildBlankPaymentForm = () => ({
    paymentNo: generatePaymentNo(),
    crNo: '',
    sponsorId: '',
    studentId: '',
    otherCustomerName: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
    refNo: '',
    bankAccountId: defaultCashAccountId,
    checkNumber: '',
    checkDate: '',
    amountReceived: 0,
    ewtAmountCertified: 0,
    notes: ''
  });

  // Initialize form for new payment
  const startNewPayment = () => {
    setEditingPayment(null);
    setSourceInvoiceId(undefined);
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setPayorType('SPONSOR');
    setFormData(buildBlankPaymentForm());
    setViewMode('create-payment');
  };

  const startNewPaymentApplication = () => {
    setApplicationListTab('unapplied');
    const paymentToApply =
      unappliedPaymentList.find(payment => canApplyPayment(payment)) ||
      appliedPaymentList.find(payment => canApplyPayment(payment));

    if (!paymentToApply) {
      alert('No open payment with available balance is ready for application. Create or post a payment first.');
      return;
    }

    loadPaymentForApplication(paymentToApply);
  };

  const discardPaymentChanges = () => {
    setEditingPayment(null);
    setSourceInvoiceId(undefined);
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setPayorType('SPONSOR');
    setFormData(buildBlankPaymentForm());
    setViewMode('list');
  };

  // Load payment for editing/viewing if it's in draft status
  const loadPaymentForEditing = (payment: Payment) => {
    if (payment.status !== 'DRAFT') {
      alert('Only Draft payments can be edited. Posted or Voided payments are read-only.');
      return;
    }
    
    setEditingPayment(payment);
    setSourceInvoiceId((payment as Payment & { sourceInvoiceId?: string }).sourceInvoiceId);
    setPayorType(payment.sponsorId ? 'SPONSOR' : payment.studentId ? 'STUDENT' : 'OTHER');
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setFormData({
      paymentNo: payment.paymentNo,
      crNo: payment.crNo || '',
      sponsorId: payment.sponsorId || '',
      studentId: payment.studentId || '',
      otherCustomerName: payment.otherCustomerName || '',
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      refNo: payment.refNo || '',
      bankAccountId: payment.bankAccountId || defaultCashAccountId,
      checkNumber: payment.checkNumber || '',
      checkDate: payment.checkDate || '',
      amountReceived: payment.amountReceived,
      ewtAmountCertified: payment.ewtAmountCertified,
      notes: payment.notes || ''
    });
    setViewMode('create-payment');
  };

  const hydratePaymentApplications = async (payment: Payment): Promise<Payment> => {
    if ((payment.applications || []).length > 0) return payment;

    try {
      const result = await DataServiceFactory.getService().fetchPage<PaymentApplication>('payment_applications', {
        page: 1,
        pageSize: 200,
        columns: '*',
        filters: [{ column: 'payment_id', operator: 'eq', value: payment.id }],
        orderBy: [{ column: 'created_at', ascending: true }]
      });
      return { ...payment, applications: result.rows };
    } catch (error) {
      console.error('[PaymentsView] Failed to load payment applications:', error);
      return payment;
    }
  };

  // Load payment for viewing in the payment interface (for all statuses)
  const loadPaymentForViewing = async (payment: Payment) => {
    const hydratedPayment = await hydratePaymentApplications(payment);
    setEditingPayment(hydratedPayment);
    setSourceInvoiceId((hydratedPayment as Payment & { sourceInvoiceId?: string }).sourceInvoiceId);
    setPayorType(hydratedPayment.sponsorId ? 'SPONSOR' : hydratedPayment.studentId ? 'STUDENT' : 'OTHER');
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setFormData({
      paymentNo: hydratedPayment.paymentNo,
      crNo: hydratedPayment.crNo || '',
      sponsorId: hydratedPayment.sponsorId || '',
      studentId: hydratedPayment.studentId || '',
      otherCustomerName: hydratedPayment.otherCustomerName || '',
      paymentDate: hydratedPayment.paymentDate,
      paymentMethod: hydratedPayment.paymentMethod,
      refNo: hydratedPayment.refNo || '',
      bankAccountId: hydratedPayment.bankAccountId || defaultCashAccountId,
      checkNumber: hydratedPayment.checkNumber || '',
      checkDate: hydratedPayment.checkDate || '',
      amountReceived: hydratedPayment.amountReceived,
      ewtAmountCertified: hydratedPayment.ewtAmountCertified,
      notes: hydratedPayment.notes || ''
    });
    setViewMode('create-payment');
  };

  const loadPaymentForDetails = async (payment: Payment) => {
    await loadPaymentForViewing(payment);
    setViewMode('payment-details');
  };

  // Load payment for applying
  const loadPaymentForApplication = (payment: Payment) => {
    setEditingPayment(payment);
    setSourceInvoiceId((payment as Payment & { sourceInvoiceId?: string }).sourceInvoiceId);
    setPayorType(payment.sponsorId ? 'SPONSOR' : payment.studentId ? 'STUDENT' : 'OTHER');
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setTransactionDescriptions({});
    setFormData({
      paymentNo: payment.paymentNo,
      crNo: payment.crNo || '',
      sponsorId: payment.sponsorId || '',
      studentId: payment.studentId || '',
      otherCustomerName: payment.otherCustomerName || '',
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      refNo: payment.refNo || '',
      bankAccountId: payment.bankAccountId || defaultCashAccountId,
      checkNumber: payment.checkNumber || '',
      checkDate: payment.checkDate || '',
      amountReceived: payment.amountReceived,
      ewtAmountCertified: payment.ewtAmountCertified,
      notes: payment.notes || ''
    });
    setViewMode('apply-payment');
  };

  const handlePrintPayment = () => {
    const printablePayment = {
      ...(editingPayment || {}),
      paymentNo: formData.paymentNo,
      crNo: formData.crNo || editingPayment?.crNo || '',
      sponsorId: formData.sponsorId || editingPayment?.sponsorId || '',
      studentId: formData.studentId || editingPayment?.studentId || '',
      paymentDate: formData.paymentDate,
      paymentMethod: formData.paymentMethod,
      refNo: formData.refNo || editingPayment?.refNo || '',
      bankAccountId: formData.bankAccountId === CASH_ON_HAND_UNDEPOSITED_ID ? undefined : (formData.bankAccountId || editingPayment?.bankAccountId || ''),
      checkNumber: formData.checkNumber || editingPayment?.checkNumber || '',
      checkDate: formData.checkDate || editingPayment?.checkDate || '',
      amountReceived: Number(formData.amountReceived ?? editingPayment?.amountReceived ?? 0),
      ewtAmountCertified: Number(formData.ewtAmountCertified ?? editingPayment?.ewtAmountCertified ?? 0),
      totalApplied: Number(editingPayment?.totalApplied ?? 0),
      customerDepositBalance: Number(editingPayment?.customerDepositBalance ?? (Number(formData.amountReceived ?? 0) + Number(formData.ewtAmountCertified ?? 0))),
      status: editingPayment?.status || 'DRAFT',
      notes: formData.notes || editingPayment?.notes || '',
      applications: editingPayment?.applications || []
    } as Payment;

    const payorName = getPayorName(printablePayment);
    const activeApplications = (printablePayment.applications || []).filter(app => !app.isReversed);
    const totalReceived = Number(printablePayment.amountReceived ?? 0) + Number(printablePayment.ewtAmountCertified ?? 0);
    const dateLabel = printablePayment.paymentDate ? format(new Date(printablePayment.paymentDate), 'MM-dd-yyyy') : '-';
    const statusLabel = getDisplayStatusLabel(printablePayment.status);
    const esc = (value: any) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const orgName = organization?.name || 'Payment Registry';
    const logoUrl = organization?.logoUrl || '';
    const voucherAccent = '#006b2d';
    const transactionDescription = printablePayment.notes || (payorName && payorName !== '-' ? `Collection from ${payorName}` : 'Payment application');

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Payment Voucher</title><style>
      @page { size: A4; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      body { margin: 0; font-family: Inter, "Open Sans", "Segoe UI", Arial, sans-serif; color:#111827; }
      .page { position: relative; width: 210mm; height: 297mm; margin: 0 auto; padding: 16mm; box-sizing: border-box; overflow: hidden; background:#fff; display:flex; flex-direction:column; }
      .muted, .sub { color:#6b7280; font-size:12px; }
      table { width:100%; border-collapse: collapse; font-size:12px; }
      .band { background:${voucherAccent} !important; color:#fff !important; font-weight:700; }
      .print-box { border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; flex:1 1 auto; display:flex; flex-direction:column; }
      .summary { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:18px; }
      .section { border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; }
      .section-title { background:${voucherAccent} !important; color:#fff !important; font-size:12px; font-weight:700; text-transform:uppercase; padding:6px 8px; }
      .section-body { padding:8px; }
      .row { display:flex; justify-content:space-between; gap:14px; padding:4px 0; font-size:12px; }
      .row span:last-child { font-weight:700; text-align:right; }
      th { padding:6px 8px; text-align:left; font-size:12px; }
      td { padding:6px 8px; border-bottom:1px solid #d1d5db; vertical-align:top; }
      td.num { text-align:right; white-space:nowrap; }
      .nothing-follows { flex:1; display:flex; align-items:center; justify-content:center; text-align:center; color:#6b7280; font-size:11px; font-style:italic; letter-spacing:.08em; padding:12px 8px; }
      .signatures { margin-top:auto; display:grid; grid-template-columns:repeat(3,1fr); border:1px solid ${voucherAccent}; border-radius:4px; overflow:hidden; flex:0 0 auto; }
      .sign-box { min-height:116px; display:flex; flex-direction:column; border-right:1px solid ${voucherAccent}; }
      .sign-box:last-child { border-right:0; }
      .sign-label { padding:10px 12px; font-size:11px; font-weight:800; text-transform:uppercase; }
      .sign-space { flex:1; margin:44px 28px 22px; border-bottom:1px solid #111827; }
      .sign-footer { background:${voucherAccent} !important; color:#fff !important; text-align:center; font-weight:800; padding:7px; font-size:11px; }
      .footer { margin-top:18px; color:#6b7280; font-size:12px; text-align:right; }
      @media print {
        body { background:#fff !important; }
        .band, .section-title, .sign-footer { background:${voucherAccent} !important; color:#fff !important; }
      }
    </style></head><body>
      <div class="page">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Tenant logo" style="max-width:300px;max-height:90px;object-fit:contain;" />` : `<div style="font-size:28px;font-weight:800;">${esc(orgName)}</div>`}
          <div style="margin-top:8px;font-size:13px;">${esc(orgName)}</div>
        </div>
        <div style="text-align:left;min-width:310px;">
          <div style="font-size:44px;font-weight:700;line-height:1;margin-bottom:8px;color:${voucherAccent};">Payment Voucher</div>
          <table style="font-size:14px;">
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Reference No.:</td><td style="padding:2px 0;text-align:right;border:0;">${esc(printablePayment.paymentNo || '-')}</td></tr>
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Date:</td><td style="padding:2px 0;text-align:right;border:0;">${esc(dateLabel)}</td></tr>
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;border:0;">Status:</td><td style="padding:2px 0;text-align:right;border:0;">${esc(statusLabel)}</td></tr>
          </table>
          <div class="muted" style="text-align:right;margin-top:6px;">Printed ${esc(new Date().toLocaleString('en-US'))}</div>
        </div>
      </div>
      <div class="summary">
        <div class="section">
          <div class="section-title">Payment Information</div>
          <div class="section-body">
          <div class="row"><span>C.R. No.</span><span>${esc(printablePayment.crNo || '-')}</span></div>
          <div class="row"><span>Payor</span><span>${esc(payorName || '-')}</span></div>
          <div class="row"><span>Payment Method</span><span>${esc(printablePayment.paymentMethod || '-')}</span></div>
          <div class="row"><span>Reference No.</span><span>${esc(printablePayment.refNo || '-')}</span></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Amount Summary</div>
          <div class="section-body">
          <div class="row"><span>Amount Received</span><span>${formatCurrency(Number(printablePayment.amountReceived ?? 0))}</span></div>
          <div class="row"><span>EWT Amount Certified</span><span>${formatCurrency(Number(printablePayment.ewtAmountCertified ?? 0))}</span></div>
          <div class="row"><span>Total Received</span><span>${formatCurrency(totalReceived)}</span></div>
          <div class="row"><span>Amount Applied</span><span>${formatCurrency(Number(printablePayment.totalApplied ?? 0))}</span></div>
          <div class="row"><span>Unapplied Balance</span><span>${formatCurrency(Number(printablePayment.customerDepositBalance ?? 0))}</span></div>
          <div class="row"><span>Status</span><span>${statusLabel}</span></div>
          </div>
        </div>
      </div>
      <div class="print-box" style="margin-top:18px;">
        ${activeApplications.length === 0 ? '<div class="sub">No applications yet.</div>' : `
          <table>
            <thead>
              <tr class="band">
                <th>Invoice</th>
                <th>Application Status</th>
                <th>Transaction Description</th>
                <th class="num">Applied Amount</th>
              </tr>
            </thead>
            <tbody>
              ${activeApplications.map(app => {
                const invoice = invoices.find(i => i.id === app.invoiceId);
                return `<tr>
                  <td>${esc(invoice?.invoiceNo || app.invoiceId)}</td>
                  <td>${esc(getApplicationStatusLabel(printablePayment, app))}</td>
                  <td>${esc(transactionDescription)}</td>
                  <td class="num">${formatCurrency(Number(app.amountApplied ?? 0))}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          <div class="nothing-follows">*** NOTHING FOLLOWS ***</div>
        `}
      </div>
      <div class="signatures">
        ${['Received By:', 'Reviewed By:', 'Acknowledged By:'].map(label => `
          <div class="sign-box">
            <div class="sign-label">${label}</div>
            <div class="sign-space"></div>
            <div class="sign-footer">NAME &amp; SIGNATURE</div>
          </div>
        `).join('')}
      </div>
      <div class="footer">Generated by ${esc(orgName)}</div>
      </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      alert('Please allow popups to print the payment.');
      return;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const handleOpenApplyPayment = () => {
    if (!editingPayment) {
      alert('Save or open a payment before applying invoices.');
      return;
    }
    if (editingPayment.status !== 'OPEN' && editingPayment.status !== 'POSTED') {
      alert('Approve the payment before applying invoices.');
      return;
    }
    if ((editingPayment.customerDepositBalance ?? 0) <= 0.01) {
      alert('This payment has already been fully applied.');
      return;
    }
    setViewMode('apply-payment');
  };

  const handleOpenReversePayment = () => {
    if (!editingPayment) {
      alert('Open a saved payment before reversing applications.');
      return;
    }
    const activeApplications = (editingPayment.applications || []).filter(app => !app.isReversed);
    if (activeApplications.length === 0) {
      alert('There are no active applications to reverse yet.');
      return;
    }

    if (activeApplications.length === 1) {
      openReverseApplicationModal(editingPayment, activeApplications[0]);
      return;
    }

    setListTab('applications');
    setViewMode('payment-details');
  };

  // Fetch invoices for payor
  useEffect(() => {
    let isMounted = true;
    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});

    if (!selectedPayorId) {
      setOpenInvoicesForPayor([]);
      return () => {
        isMounted = false;
      };
    }

    setIsFetchingOpenInvoices(true);

    Promise.resolve().then(() => {
      if (!isMounted) return;
      const fetchedPayorInvoices = invoices
        .filter(inv => {
          if (inv.orgId !== currentOrgId || inv.status === 'VOIDED') return false;
          if (activeAppliedInvoiceIds.has(inv.id)) return false;
          if (Number(inv.balanceDue ?? 0) <= 0.01 || inv.status === 'CLOSED') return false;
          if (payorType === 'SPONSOR') return inv.sponsorId === formData.sponsorId;
          if (payorType === 'STUDENT') return inv.studentId === formData.studentId;
          return !inv.sponsorId && !inv.studentId && String(inv.otherCustomerName || '').trim().toLowerCase() === formData.otherCustomerName.trim().toLowerCase();
        })
        .sort((a, b) => new Date(b.invoiceDate || 0).getTime() - new Date(a.invoiceDate || 0).getTime());
      setOpenInvoicesForPayor(fetchedPayorInvoices);
      setIsFetchingOpenInvoices(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedPayorId, payorType, formData.sponsorId, formData.studentId, formData.otherCustomerName, invoices, currentOrgId, activeAppliedInvoiceIds]);

  useEffect(() => {
    if (!editingPayment && defaultCashAccountId && !formData.bankAccountId) {
      setFormData(prev => ({ ...prev, bankAccountId: defaultCashAccountId }));
    }
  }, [editingPayment, defaultCashAccountId, formData.bankAccountId]);

  useEffect(() => {
    if (!editingPayment) return;
    const latest = payments.find(p => p.id === editingPayment.id);
    if (latest) setEditingPayment(latest);
  }, [payments, editingPayment?.id]);

  // Handle initial context for deep-linking (e.g. from InvoicesView)
  useEffect(() => {
    if (initialContext && initialContext.viewMode === 'create-payment' && initialContext.invoice) {
      const inv = initialContext.invoice;
      const existingLinkedPayment = payments.find(payment =>
        !payment.isDeleted &&
        payment.status !== 'VOIDED' &&
        payment.sourceInvoiceId === inv.id
      );

      if (existingLinkedPayment) {
        loadPaymentForViewing(existingLinkedPayment);
        if (onClearContext) onClearContext();
        return;
      }

      setEditingPayment(null);
      setSourceInvoiceId(inv.id);
      setInvoiceApplyMap({});
      setInvoiceSelectionMap({});
      setPayorType(inv.sponsorId ? 'SPONSOR' : inv.studentId ? 'STUDENT' : 'OTHER');
      const payorLabel = getInvoicePayorName(inv);
      setFormData({
        paymentNo: generatePaymentNo(),
        crNo: '',
        sponsorId: inv.sponsorId || '',
        studentId: inv.studentId || '',
        otherCustomerName: inv.otherCustomerName || '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'BANK_TRANSFER',
        refNo: '',
        bankAccountId: defaultCashAccountId,
        checkNumber: '',
        checkDate: '',
        amountReceived: inv.balanceDue,
        ewtAmountCertified: 0,
        notes: payorLabel !== '-' ? `Collection from ${payorLabel}` : 'Collection receipt'
      });
      setViewMode('create-payment');
      if (onClearContext) onClearContext();
      return;
    }

    if (initialContext && initialContext.viewMode === 'payment-details' && initialContext.invoice) {
      const inv = initialContext.invoice;
      const matches = payments.flatMap(payment =>
        (payment.applications || [])
          .filter(app => app.invoiceId === inv.id && !app.isReversed)
          .map(app => ({ payment, app }))
      );

      if (matches.length > 0) {
        const latestMatch = [...matches].sort((a, b) =>
          new Date(b.app.createdAt || b.payment.updatedAt || b.payment.createdAt || b.payment.paymentDate || 0).getTime() -
          new Date(a.app.createdAt || a.payment.updatedAt || a.payment.createdAt || a.payment.paymentDate || 0).getTime()
        )[0];

        loadPaymentForDetails(latestMatch.payment);
      } else {
        setViewMode('list');
      }

      if (onClearContext) onClearContext();
    }
  }, [initialContext, defaultCashAccountId, onClearContext, payments, sponsors, students]);

  const baseTotalCredit = formData.amountReceived + formData.ewtAmountCertified;

  const plannedAppliedTotal = useMemo(() => {
    return Object.values(invoiceApplyMap).reduce((sum: number, amount) => sum + Number(amount || 0), 0);
  }, [invoiceApplyMap]);

  const existingApplied = editingPayment?.totalApplied || 0;
  const availableToApply = Math.max((editingPayment?.customerDepositBalance ?? baseTotalCredit), 0);

  const getGlAccountLabel = (account?: ChartOfAccount, fallback = 'Unknown Account') => {
    if (!account) return fallback;
    return account.code ? `${account.code} - ${account.name}` : account.name;
  };

  const getReceivableAccountForInvoice = (invoice?: Invoice) => {
    const coa = accounts.filter(a => a.orgId === currentOrgId && !a.isHeader);
    const sponsor = invoice?.sponsorId ? sponsors.find(s => s.id === invoice.sponsorId) : undefined;
    const preferredAccountId = (sponsor as (Sponsor & { arAccountId?: string }) | undefined)?.arAccountId;
    const byName = (patterns: string[]) => coa.find(a => {
      const name = (a.name || '').toLowerCase();
      return patterns.every(pattern => name.includes(pattern));
    });

    if (invoice?.studentId && !invoice?.sponsorId) {
      return (
        byName(['accounts', 'receivable', 'student']) ||
        byName(['receivable', 'student']) ||
        coa.find(a => a.code === '11100') ||
        byName(['accounts', 'receivable']) ||
        byName(['receivable']) ||
        coa.find(a => a.class === AccountClass.ASSET)
      );
    }

    return (
      (preferredAccountId ? coa.find(a => a.id === preferredAccountId || a.code === preferredAccountId) : undefined) ||
      byName(['accounts', 'receivable']) ||
      byName(['receivable']) ||
      coa.find(a => a.class === AccountClass.ASSET)
    );
  };

  const glImpactRows = useMemo(() => {
    const glLines = calculatePaymentGlLines();
    return glLines.map(line => ({
      account: getGlAccountLabel(line.account),
      debit: line.debit,
      credit: line.credit
    }));
  }, [formData.bankAccountId, formData.amountReceived, formData.ewtAmountCertified, formData.sponsorId, formData.studentId, payorType, accounts, currentOrgId]);

  const selectedApplicationInvoices = useMemo(() => {
    return openInvoicesForPayor.filter(invoice =>
      invoiceSelectionMap[invoice.id] && Number(invoiceApplyMap[invoice.id] || 0) > 0
    );
  }, [openInvoicesForPayor, invoiceSelectionMap, invoiceApplyMap]);

  const applicationGlImpactRows = useMemo(() => {
    const { customerDepositsAccount } = resolvePaymentGlAccounts();
    const rows: Array<{ account: string; debit: number; credit: number; missing?: boolean }> = [];

    if (plannedAppliedTotal <= 0) return rows;

    rows.push({
      account: getGlAccountLabel(customerDepositsAccount, 'Customer Deposits account not configured'),
      debit: plannedAppliedTotal,
      credit: 0,
      missing: !customerDepositsAccount
    });

    selectedApplicationInvoices.forEach(invoice => {
      const arAccount = getReceivableAccountForInvoice(invoice);
      rows.push({
        account: getGlAccountLabel(arAccount, `Accounts Receivable for ${invoice.invoiceNo} not configured`),
        debit: 0,
        credit: Number(invoiceApplyMap[invoice.id] || 0),
        missing: !arAccount
      });
    });

    return rows;
  }, [accounts, currentOrgId, formData.bankAccountId, formData.sponsorId, formData.studentId, payorType, invoiceApplyMap, plannedAppliedTotal, selectedApplicationInvoices, sponsors]);

  const applicationGlHasMissingAccounts = applicationGlImpactRows.some(row => row.missing);

  const validateHeader = () => {
    if (!formData.paymentNo) return 'Payment number is required.';
    if (!formData.paymentDate) return 'Payment date is required.';
    if (!formData.bankAccountId) return 'Cash account is required.';
    if (sourceInvoiceId && !selectedSourceInvoice) return 'Select a valid invoice number before saving or approving payment.';
    if (existingLinkedInvoicePayment) {
      return `A payment already exists for invoice ${selectedSourceInvoice.invoiceNo} (${existingLinkedInvoicePayment.paymentNo}, ${existingLinkedInvoicePaymentStatusLabel}). Review, edit, or complete the existing payment instead of creating a new one.`;
    }
    if (!formData.sponsorId && !formData.studentId && !String(formData.otherCustomerName || '').trim()) return 'Select a sponsor, student, or enter an Other payor name.';
    if (!String(formData.notes || '').trim()) return 'Transaction Description is required.';
    if (!String(formData.crNo || '').trim()) return 'C.R. No. is required.';
    if (baseTotalCredit <= 0) return 'Amount received or EWT must be greater than zero.';
    return '';
  };

  const headerValidationError = validateHeader();
  const currentActiveApplications = editingPayment
    ? (editingPayment.applications || []).filter(app => !app.isReversed)
    : [];
  const canUsePaymentApplicationAction = !!editingPayment && canApplyPayment(editingPayment);
  const canUseReverseAction = currentActiveApplications.length > 0;

  const handleClosePaymentWorkspace = () => {
    setViewMode('list');
    setEditingPayment(null);
  };

  const buildPayment = (status: PaymentStatus) => {
    const paymentId = editingPayment?.id || generateUUID();
    const currentApplications = editingPayment?.applications || [];
    const trimmedCrNo = String(formData.crNo || '').trim();
    const trimmedNotes = String(formData.notes || '').trim();

    const payment: Partial<Payment> = {
      id: paymentId,
      orgId: currentOrgId,  // Always include org_id for complete data separation
      paymentNo: formData.paymentNo,
      crNo: trimmedCrNo || undefined,
      sourceInvoiceId: sourceInvoiceId || undefined,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      otherCustomerName: String(formData.otherCustomerName || '').trim() || undefined,
      paymentDate: formData.paymentDate,
      status,
      paymentMethod: formData.paymentMethod,
      refNo: formData.refNo || undefined,
      bankAccountId: formData.bankAccountId === CASH_ON_HAND_UNDEPOSITED_ID ? undefined : (formData.bankAccountId || undefined),
      checkNumber: formData.checkNumber || undefined,
      checkDate: formData.checkDate || undefined,
      amountReceived: formData.amountReceived,
      ewtAmountCertified: formData.ewtAmountCertified,
      totalApplied: existingApplied,
      customerDepositBalance: baseTotalCredit - existingApplied,
      applications: currentApplications,
      notes: trimmedNotes || undefined,
      createdAt: editingPayment?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postedAt: status === 'OPEN' ? (editingPayment?.postedAt || new Date().toISOString()) : editingPayment?.postedAt
    };

    return payment as Payment;
  };

  const handleSaveDraft = async () => {
    if (isSubmittingPayment) return;
    const error = validateHeader();
    if (error) {
      alert(error);
      return;
    }

    // Save as draft without posting to GL
    const payment = buildPayment('DRAFT');
    setIsSubmittingPayment(true);
    try {
      if (editingPayment) await onUpdatePayment(payment);
      else await onAddPayment(payment);
      if (!editingPayment) setServerCurrentPage(1);
      setRefreshKey(key => key + 1);
      setViewMode('list');
      setEditingPayment(null);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleSavePayment = async () => {
    if (isSubmittingPayment) return;
    const error = validateHeader();
    if (error) {
      alert(error);
      return;
    }

    // Approve and post to GL (Acumatica workflow)
    const payment = buildPayment('OPEN');
    setIsSubmittingPayment(true);
    try {
      if (editingPayment) {
        await onUpdatePayment(payment);
        // Call onPostPayment for existing draft payments being posted for the first time
        if (editingPayment.status === 'DRAFT' && onPostPayment) {
          await onPostPayment(payment);
        }
      } else {
        await onAddPayment(payment);
      }
      if (!editingPayment) setServerCurrentPage(1);
      setRefreshKey(key => key + 1);
      setViewMode('list');
      setEditingPayment(null);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const applySelectedInvoices = async () => {
    if (!editingPayment) {
      alert('Payment not found.');
      return;
    }

    const selected = Object.entries(invoiceApplyMap).filter(
      ([invoiceId, amt]) => invoiceSelectionMap[invoiceId] && Number(amt) > 0
    );
    if (!selected.length) {
      alert('Tick at least one invoice and enter amount to apply.');
      return;
    }

    const totalToApply = selected.reduce((sum, [_, amt]) => sum + Number(amt || 0), 0);
    if (totalToApply > availableToApply) {
      alert('Applied total exceeds available unapplied balance.');
      return;
    }

    const trimmedCrNo = String(formData.crNo || '').trim();
    const paymentWithHeaderChanges: Payment = {
      ...editingPayment,
      crNo: trimmedCrNo || undefined,
      updatedAt: new Date().toISOString()
    };
    const hasHeaderChanges = (editingPayment.crNo || '') !== (paymentWithHeaderChanges.crNo || '');

    if (hasHeaderChanges) {
      onUpdatePayment(paymentWithHeaderChanges);
      setEditingPayment(paymentWithHeaderChanges);
    }

    if (onApplyToInvoice) {
      for (const [invoiceId, amount] of selected) {
        const applyAmount = Number(amount || 0);
        const description = transactionDescriptions[invoiceId] || `Payment application for invoice ${invoices.find(inv => inv.id === invoiceId)?.invoiceNo || invoiceId}`;
        await onApplyToInvoice(paymentWithHeaderChanges.id, invoiceId, applyAmount);
      }
      setRefreshKey(key => key + 1);
    }

    if (!onApplyToInvoice) {
      const reservedApplicationNos = new Set<string>();
      const newApps: PaymentApplication[] = selected.map(([invoiceId, amount]) => ({
        id: generateUUID(),
        orgId: currentOrgId,
        paymentId: editingPayment.id,
        invoiceId,
        applicationNo: (() => {
          const applicationNo = generatePaymentApplicationNo(reservedApplicationNos);
          reservedApplicationNos.add(applicationNo);
          return applicationNo;
        })(),
        amountApplied: Number(amount || 0),
        description: transactionDescriptions[invoiceId] || `Payment application for invoice ${invoices.find(inv => inv.id === invoiceId)?.invoiceNo || invoiceId}`,
        isReversed: false,
        createdAt: new Date().toISOString()
      }));

      const updatedPayment: Payment = {
        ...paymentWithHeaderChanges,
        applications: [...(paymentWithHeaderChanges.applications || []), ...newApps],
        totalApplied: (paymentWithHeaderChanges.totalApplied || 0) + totalToApply,
        customerDepositBalance: (paymentWithHeaderChanges.customerDepositBalance || 0) - totalToApply,
        updatedAt: new Date().toISOString()
      };
      onUpdatePayment(updatedPayment);
      setRefreshKey(key => key + 1);
      setEditingPayment(updatedPayment);
    }

    setInvoiceApplyMap({});
    setInvoiceSelectionMap({});
    setTransactionDescriptions({});
    setViewMode('list');
  };

  const handleInvoiceTick = (invoice: Invoice, checked: boolean) => {
    if (checked && activeAppliedInvoiceIds.has(invoice.id)) {
      alert(`Invoice ${invoice.invoiceNo} is already applied to this payment.`);
      return;
    }

    setInvoiceSelectionMap(prev => ({ ...prev, [invoice.id]: checked }));
    if (!checked) {
      setInvoiceApplyMap(prev => ({ ...prev, [invoice.id]: 0 }));
      return;
    }

    setInvoiceApplyMap(prev => {
      const existing = prev[invoice.id] || 0;
      if (existing > 0) return prev;

      const otherSelectedTotal = Object.entries(prev).reduce((sum, [id, amount]) => {
        if (id === invoice.id) return sum;
        if (!invoiceSelectionMap[id]) return sum;
        return sum + Number(amount || 0);
      }, 0);
      const remaining = Math.max(availableToApply - otherSelectedTotal, 0);
      const suggested = Math.min(Math.max(Number(invoice.balanceDue || 0), 0), remaining);
      return { ...prev, [invoice.id]: suggested };
    });
  };

  const openReverseApplicationModal = (payment: Payment, application: PaymentApplication) => {
    setReversingApplication({ payment, application });
    setReverseReason('');
    setShowReverseModal(true);
  };

  const formatPostPeriod = (dateValue?: string) => {
    if (!dateValue) return '';
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '';
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}-${year}`;
  };

  const formatCreatedOn = (value?: string) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, 'MM-dd-yyyy');
  };

  const invoiceLabelClass = 'text-xs font-medium text-gray-500';
  const invoiceInputClass = 'w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:border-brand disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-gray-50';
  const invoiceReadOnlyClass = 'w-full mt-1 px-3 py-2 border border-brand-light rounded-lg bg-gray-50 text-gray-900 focus:border-brand';
  const invoicePostPeriodClass = 'w-full mt-1 px-3 py-2 border border-brand-light rounded-lg bg-brand/10 text-gray-900 focus:border-brand';
  const previewSectionTitleClass = 'mb-4 text-xs font-medium uppercase tracking-wide text-gray-500';
  const previewLabelClass = 'text-xs font-medium uppercase tracking-wide text-gray-500';
  const previewValueClass = 'mt-1 text-[13px] font-medium text-gray-700';
  const iconActionClass = 'p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  const renderPaymentDocumentActions = () => (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b bg-white">
      <button
        title="Discard Changes and Close"
        onClick={discardPaymentChanges}
        className={`${iconActionClass} hover:text-red-500 hover:bg-red-50`}
      >
        <RotateCcw size={20} />
      </button>
      {!isReadOnly && (
        <>
          <button
            title={headerValidationError || 'Save'}
            onClick={handleSaveDraft}
            disabled={!!headerValidationError}
            className={`${iconActionClass} hover:text-blue-500 hover:bg-blue-50`}
          >
            <Save size={20} />
          </button>
          <button
            title={headerValidationError || 'Approve'}
            onClick={handleSavePayment}
            disabled={!!headerValidationError}
            className={`${iconActionClass} hover:text-emerald-500 hover:bg-emerald-50`}
          >
            <CheckCircle size={20} />
          </button>
        </>
      )}
      <button
        title="New Payment Application"
        onClick={handleOpenApplyPayment}
        disabled={!canUsePaymentApplicationAction}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold uppercase tracking-wide text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus size={16} />
        New Payment Application
      </button>
      <button
        title="Reverse"
        onClick={handleOpenReversePayment}
        disabled={!canUseReverseAction}
        className={`${iconActionClass} hover:text-amber-500 hover:bg-amber-50`}
      >
        <CornerUpLeft size={20} />
      </button>
      <button
        title="Print"
        onClick={handlePrintPayment}
        className={`${iconActionClass} hover:text-indigo-500 hover:bg-indigo-50`}
      >
        <Printer size={20} />
      </button>
      <button
        title="Close"
        onClick={handleClosePaymentWorkspace}
        className={`${iconActionClass} hover:text-gray-900 hover:bg-gray-100`}
      >
        <X size={20} />
      </button>
    </div>
  );

  const getCreatedByName = (createdBy?: string) => {
    if (!createdBy) return '-';
    return users.find(u => u.id === createdBy)?.name || createdBy || '-';
  };

  const handleSourceInvoiceChange = (invoiceId: string) => {
    if (!invoiceId) {
      setSourceInvoiceId(undefined);
      return;
    }

    const invoice = invoices.find(item => item.id === invoiceId);
    setSourceInvoiceId(invoiceId);
    if (!invoice) return;

    const payorLabel = getInvoicePayorName(invoice);
    setPayorType(invoice.sponsorId ? 'SPONSOR' : invoice.studentId ? 'STUDENT' : 'OTHER');
    setFormData(prev => ({
      ...prev,
      sponsorId: invoice.sponsorId || '',
      studentId: invoice.studentId || '',
      otherCustomerName: invoice.otherCustomerName || '',
      amountReceived: prev.amountReceived > 0 ? prev.amountReceived : Number(invoice.balanceDue ?? 0),
      notes: String(prev.notes || '').trim() ? prev.notes : (payorLabel !== '-' ? `Collection from ${payorLabel}` : 'Collection receipt')
    }));
  };

  const getDisplayStatusLabel = (status: PaymentStatus) => {
    switch (status) {
      case 'DRAFT':
        return 'ON HOLD';
      case 'OPEN':
        return 'OPEN';
      case 'POSTED':
        return 'POSTED';
      case 'CLOSED':
        return 'CLOSED';
      case 'VOIDED':
        return 'VOIDED';
      default:
        return status;
    }
  };


  const handleSort = (columnKey: string) => {
    setSortConfig(current => {
      if (current.key !== columnKey) return { key: columnKey, direction: 'asc' as const };
      if (current.direction === 'asc') return { key: columnKey, direction: 'desc' as const };
      if (current.direction === 'desc') return { key: columnKey, direction: 'none' as const };
      return { key: columnKey, direction: 'asc' as const };
    });
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey || sortConfig.direction === 'none') {
      return <ArrowUpDown size={12} className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-emerald-400" />
      : <ChevronDown size={12} className="ml-1 text-emerald-400" />;
  };

  const getPaymentSortValue = (payment: Payment, key: string, mode: ListTab) => {
    switch (key) {
      case 'date':
      case 'paymentDate':
        return payment.paymentDate || '';
      case 'postPeriod':
        return payment.paymentDate || '';
      case 'paymentNo':
        return payment.paymentNo || '';
      case 'paymentApplicationNo':
        return getPaymentApplicationNumberLabel(payment);
      case 'status':
        return getDisplayStatusLabel(mode === 'applications' ? getApplicationRegistryStatus(payment) : getPaymentRegistryStatus(payment));
      case 'glReference':
        return mode === 'applications' ? getPaymentApplicationGlReferenceLabel(payment) : getPaymentGlReferenceLabel(payment);
      case 'payor':
        return getPayorName(payment);
      case 'method':
        return payment.paymentMethod || '';
      case 'amountReceived':
        return Number(payment.amountReceived ?? 0) + Number(payment.ewtAmountCertified ?? 0);
      case 'amountApplied':
        return Number(payment.totalApplied ?? 0);
      case 'balance':
        return Number(payment.customerDepositBalance ?? 0);
      case 'createdBy':
        return getCreatedByName(payment.createdBy);
      case 'createdOn':
        return payment.createdAt || '';
      default:
        return '';
    }
  };

  const paymentRegistryColumns: PaymentRegistryColumn[] = [
    {
      key: 'date',
      label: 'Transaction Date',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'date',
      value: (payment) => payment.paymentDate ? format(new Date(payment.paymentDate), 'MM-dd-yyyy') : '-',
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {payment.paymentDate ? format(new Date(payment.paymentDate), 'MM-dd-yyyy') : '-'}
        </span>
      )
    },
    {
      key: 'postPeriod',
      label: 'Post Period',
      align: 'text-left',
      minWidth: 112,
      sortKey: 'postPeriod',
      value: (payment) => formatPostPeriod(payment.paymentDate),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {formatPostPeriod(payment.paymentDate) || '-'}
        </span>
      )
    },
    {
      key: 'paymentNo',
      label: 'Payment No.',
      align: 'text-left',
      minWidth: 160,
      sortKey: 'paymentNo',
      value: (payment) => payment.paymentNo || '',
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {payment.paymentNo || '-'}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Payment Status',
      align: 'text-left',
      minWidth: 96,
      sortKey: 'status',
      value: (payment) => getDisplayStatusLabel(getPaymentRegistryStatus(payment)),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {getDisplayStatusLabel(getPaymentRegistryStatus(payment))}
        </span>
      )
    },
    {
      key: 'glReference',
      label: 'GL Reference No.',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'glReference',
      value: (payment) => getPaymentGlReferenceLabel(payment),
      render: (payment) => (
        renderPaymentGlReference(payment)
      )
    },
    {
      key: 'payor',
      label: 'Sponsor/Student',
      align: 'text-left',
      minWidth: 256,
      sortKey: 'payor',
      value: (payment) => getPayorName(payment),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {getPayorName(payment)}
        </span>
      )
    },
    {
      key: 'method',
      label: 'Method',
      align: 'text-left',
      minWidth: 112,
      sortKey: 'method',
      value: (payment) => payment.paymentMethod || '',
      render: (payment) => (
        <span className="font-medium text-gray-800">{payment.paymentMethod}</span>
      )
    },
    {
      key: 'amountReceived',
      label: 'Amount Received',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'amountReceived',
      value: (payment) => Number(payment.amountReceived ?? 0) + Number(payment.ewtAmountCertified ?? 0),
      render: (payment) => (
        renderAccountingAmount(payment.amountReceived + payment.ewtAmountCertified)
      )
    },
    {
      key: 'amountApplied',
      label: 'Amount Applied',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'amountApplied',
      value: (payment) => Number(payment.totalApplied ?? 0),
      render: (payment) => (
        renderAccountingAmount(payment.totalApplied)
      )
    },
    {
      key: 'balance',
      label: 'Unapplied Balance',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'balance',
      value: (payment) => Number(payment.customerDepositBalance ?? 0),
      render: (payment) => (
        renderAccountingAmount(payment.customerDepositBalance)
      )
    },
    {
      key: 'createdBy',
      label: 'Created By',
      align: 'text-left',
      minWidth: 160,
      sortKey: 'createdBy',
      value: (payment) => getCreatedByName(payment.createdBy),
      render: (payment) => (
        <span className="font-medium text-gray-800">{getCreatedByName(payment.createdBy)}</span>
      )
    },
    {
      key: 'createdOn',
      label: 'Created On',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'createdOn',
      value: (payment) => formatCreatedOn(payment.createdAt),
      render: (payment) => (
        <span className="font-medium text-gray-800">{formatCreatedOn(payment.createdAt)}</span>
      )
    }
  ];

  const registryColumns = columnOrder
    .map(key => paymentRegistryColumns.find(col => col.key === key))
    .filter(Boolean) as PaymentRegistryColumn[];

  const serverSortKeyMap: Record<string, string> = {
    date: 'payment_date',
    paymentDate: 'payment_date',
    postPeriod: 'payment_date',
    paymentNo: 'payment_no',
    status: 'status',
    glReference: 'journal_entry_id',
    method: 'payment_method',
    amountReceived: 'amount_received',
    amountApplied: 'total_applied',
    balance: 'customer_deposit_balance',
    createdOn: 'created_at'
  };
  const serverSortColumn = serverSortKeyMap[sortConfig.key] || 'payment_date';
  const serverFetchEnabled =
    listTab === 'payments' &&
    Boolean(currentOrgId) &&
    statusFilter === 'ALL' &&
    payerFilterMode !== 'CUSTOM' &&
    sortConfig.key !== 'glReference' &&
    sortConfig.key !== 'payor' &&
    sortConfig.key !== 'createdBy';

  const paymentFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (currentOrgId) {
      filters.push({ column: 'org_id', operator: 'eq', value: currentOrgId });
    }
    filters.push({ column: 'is_deleted', operator: 'eq', value: false });

    if (statusFilter !== 'ALL') {
      filters.push({
        column: 'status',
        operator: statusFilter === 'OPEN' ? 'in' : 'eq',
        value: statusFilter === 'OPEN' ? '(OPEN,POSTED)' : statusFilter
      });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    if (dateFilterMode === 'TODAY') {
      filters.push({ column: 'payment_date', operator: 'eq', value: todayStr });
    } else if (dateFilterMode === 'THIS_MONTH') {
      filters.push({ column: 'payment_date', operator: 'gte', value: monthStart });
      filters.push({ column: 'payment_date', operator: 'lte', value: monthEnd });
    } else if (dateFilterMode === 'CUSTOM') {
      if (dateFrom) filters.push({ column: 'payment_date', operator: 'gte', value: dateFrom });
      if (dateTo) filters.push({ column: 'payment_date', operator: 'lte', value: dateTo });
    }

    return filters;
  }, [currentOrgId, dateFilterMode, dateFrom, dateTo, statusFilter]);

  const paymentOrderBy = useMemo<PageOrder[]>(() => {
    if (sortConfig.direction === 'none') {
      return [
        { column: 'payment_date', ascending: false },
        { column: 'created_at', ascending: false }
      ];
    }
    return [
      { column: serverSortColumn, ascending: sortConfig.direction === 'asc' },
      { column: 'created_at', ascending: false }
    ];
  }, [serverSortColumn, sortConfig.direction]);

  useEffect(() => {
    setServerCurrentPage(1);
  }, [currentOrgId, dateFilterMode, dateFrom, dateTo, debouncedSearchTerm, listTab, payerFilterMode, payerSearchTerm, sortConfig, statusFilter]);

  useEffect(() => {
    if (!serverFetchEnabled) return;

    let isActive = true;
    setIsLoadingPaymentPage(true);
    setPaymentPageError('');

    DataServiceFactory.getService().fetchPage<Payment>('payments', {
      page: serverCurrentPage,
      pageSize: PAYMENT_PAGE_SIZE,
      columns: PAYMENT_COLUMNS,
      filters: paymentFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['payment_no', 'ref_no', 'notes'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: paymentOrderBy
    })
      .then(result => {
        if (!isActive) return;
        setServerPayments(result.rows);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[PaymentsView] Failed to load payment page:', error);
        setPaymentPageError(error instanceof Error ? error.message : 'Failed to load payments.');
        setServerPayments([]);
        setServerTotal(0);
        setServerTotalPages(1);
      })
      .finally(() => {
        if (isActive) setIsLoadingPaymentPage(false);
      });

    return () => {
      isActive = false;
    };
  }, [debouncedSearchTerm, paymentFilters, paymentOrderBy, payments.length, refreshKey, serverCurrentPage, serverFetchEnabled]);

  const applyRegistryFilters = (list: Payment[], mode: ListTab) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    return list.filter(pay => {
      const payor = getPayorName(pay).toLowerCase();
      const applicationNo = mode === 'applications' ? getPaymentApplicationNumberLabel(pay).toLowerCase() : '';
      const applicationGlReference = mode === 'applications' ? getPaymentApplicationGlReferenceLabel(pay).toLowerCase() : '';
      const matchesSearch =
        pay.paymentNo.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        applicationNo.includes(debouncedSearchTerm.toLowerCase()) ||
        (pay.crNo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        payor.includes(debouncedSearchTerm.toLowerCase()) ||
        (pay.refNo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        getPaymentGlReferenceLabel(pay).toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        applicationGlReference.includes(debouncedSearchTerm.toLowerCase());

      const effectiveStatus = mode === 'applications' ? getApplicationRegistryStatus(pay) : getPaymentRegistryStatus(pay);
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'OPEN'
          ? (effectiveStatus === 'OPEN' || effectiveStatus === 'POSTED')
          : effectiveStatus === statusFilter);

      const paymentDate = pay.paymentDate?.slice(0, 10) || '';
      let matchesDate = true;
      if (dateFilterMode === 'TODAY') {
        matchesDate = paymentDate === todayStr;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = paymentDate >= monthStart && paymentDate <= monthEnd;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate = (!dateFrom || paymentDate >= dateFrom) &&
          (!dateTo || paymentDate <= dateTo);
      }

      const matchesPayer = payerFilterMode !== 'CUSTOM' || payerSearchTerm.trim() === '' ||
        payor.includes(payerSearchTerm.toLowerCase());

      return matchesSearch && matchesStatus && matchesDate && matchesPayer;
    });
  };

  const sortRegistryPayments = (list: Payment[], mode: ListTab) => {
    return [...list].sort((a, b) => {
      if (sortConfig.direction === 'none') return 0;
      const valueA = getPaymentSortValue(a, sortConfig.key, mode);
      const valueB = getPaymentSortValue(b, sortConfig.key, mode);
      let comparison = 0;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB), undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  const filteredPayments = useMemo(() => {
    return sortRegistryPayments(applyRegistryFilters(payments, 'payments'), 'payments');
  }, [payments, debouncedSearchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, payerFilterMode, payerSearchTerm, sortConfig, sponsors, students, users]);

  const {
    currentPage: fallbackPaymentCurrentPage,
    totalPages: fallbackPaymentTotalPages,
    pageStartIndex: fallbackPaymentPageStartIndex,
    pageEndIndex: fallbackPaymentPageEndIndex,
    paginatedRows: fallbackPaginatedPayments,
    setCurrentPage: setFallbackPaymentCurrentPage
  } = usePaginatedRows(filteredPayments, [listTab, debouncedSearchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, payerFilterMode, payerSearchTerm, sortConfig], PAYMENT_PAGE_SIZE);

  const usePaymentFallbackRows = !serverFetchEnabled || !!paymentPageError;
  const paginatedPayments = usePaymentFallbackRows ? fallbackPaginatedPayments : serverPayments;
  const paymentTotalItems = usePaymentFallbackRows ? filteredPayments.length : serverTotal;
  const paymentTotalPages = usePaymentFallbackRows ? fallbackPaymentTotalPages : serverTotalPages;
  const paymentCurrentPage = usePaymentFallbackRows ? fallbackPaymentCurrentPage : serverCurrentPage;
  const paymentPageStartIndex = usePaymentFallbackRows ? fallbackPaymentPageStartIndex : (serverCurrentPage - 1) * PAYMENT_PAGE_SIZE;
  const paymentPageEndIndex = usePaymentFallbackRows ? fallbackPaymentPageEndIndex : Math.min(paymentPageStartIndex + serverPayments.length, serverTotal);
  const setPaymentCurrentPage = usePaymentFallbackRows ? setFallbackPaymentCurrentPage : setServerCurrentPage;

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert(getExportEmptyMessage()); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(c => c.label);
    const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] as string));
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 10px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:13px;color:#222;font-weight:500;}th{padding:6px 10px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:13px;background:#059669;color:#fff;font-weight:700;}td.num{text-align:right;mso-number-format:"#,##0.00"}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    rows.forEach(r => {
      html += '<tr>';
      columns.forEach(col => {
        const val = r[col.label];
        const isNum = typeof val === 'number';
        const value = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getExportFilePrefix()}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert(getExportEmptyMessage()); return; }
    const columns = getRegistryExportColumns();
    const cols = columns.map(c => c.label);
    const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s] as string));
    const orgName = organization?.name || getExportDocumentTitle();
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(getExportDocumentTitle())}</title><style>
      @page { size: landscape; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin:0; font-family:Inter,"Open Sans","Segoe UI",Arial,sans-serif; color:#111827; padding:20px; }
      h2 { margin:0 0 4px; font-size:18px; }
      .subtitle { color:#6b7280; font-size:12px; margin-bottom:16px; }
      table { width:100%; border-collapse:collapse; font-size:11px; }
      th { background:#059669; color:#fff; padding:8px 10px; text-align:left; font-weight:700; }
      td { padding:7px 10px; border-bottom:1px solid #e5e7eb; }
      tr:nth-child(even) { background:#f9fafb; }
      .num { text-align:right; }
      .footer { margin-top:16px; font-size:10px; color:#9ca3af; text-align:right; }
    </style></head><body>`;
    html += `<h2>${esc(orgName)}</h2>`;
    html += `<div class="subtitle">${esc(getExportDocumentTitle())} &mdash; Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} &mdash; ${rows.length} record(s)</div>`;
    html += '<table><thead><tr>' + cols.map(c => `<th>${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
    rows.forEach(r => {
      html += '<tr>';
      cols.forEach(c => {
        const val = r[c];
        const isNum = typeof val === 'number';
        const value = isNum ? new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) : val;
        html += `<td${isNum ? ' class="num"' : ''}>${esc(value)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<div class="footer">Generated on ${new Date().toLocaleString('en-PH')}</div>`;
    html += '</body></html>';
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 400);
    }
  };

  const paymentStats = useMemo(() => {
    const statsSource = usePaymentFallbackRows ? payments : serverPayments;
    const draftCount = statsSource.filter(p => getPaymentRegistryStatus(p) === 'DRAFT').length;
    const openCount = statsSource.filter(p => getPaymentRegistryStatus(p) === 'OPEN').length;
    const closedCount = statsSource.filter(p => getPaymentRegistryStatus(p) === 'POSTED').length;
    const unappliedPayments = statsSource.reduce((sum, payment) => {
      if (getPaymentRegistryStatus(payment) !== 'OPEN') return sum;
      return sum + getAvailablePaymentBalance(payment);
    }, 0);
    return { draftCount, openCount, closedCount, unappliedPayments };
  }, [journalEntries, payments, serverPayments, usePaymentFallbackRows]);

  const paymentApplicationBaseList = useMemo(
    () => payments.filter(payment => payment.status !== 'VOIDED'),
    [payments]
  );

  const unappliedPaymentList = useMemo(
    () => paymentApplicationBaseList.filter(payment => !isAppliedPayment(payment)),
    [paymentApplicationBaseList]
  );

  const appliedPaymentList = useMemo(
    () => paymentApplicationBaseList.filter(payment => isAppliedPayment(payment)),
    [paymentApplicationBaseList]
  );

  const paymentApplicationStats = useMemo(() => {
    const unappliedBalance = unappliedPaymentList.reduce(
      (sum, payment) => sum + getAvailablePaymentBalance(payment),
      0
    );
    const appliedAmount = appliedPaymentList.reduce(
      (sum, payment) => sum + Number(payment.totalApplied ?? 0),
      0
    );
    const remainingBalance = appliedPaymentList.reduce(
      (sum, payment) => sum + getAvailablePaymentBalance(payment),
      0
    );

    return {
      unappliedCount: unappliedPaymentList.length,
      unappliedBalance,
      appliedCount: appliedPaymentList.length,
      appliedAmount,
      remainingBalance
    };
  }, [unappliedPaymentList, appliedPaymentList]);

  const currentApplicationPayments =
    applicationListTab === 'unapplied' ? unappliedPaymentList : appliedPaymentList;

  const filteredApplicationPayments = useMemo(() => {
    return sortRegistryPayments(applyRegistryFilters(currentApplicationPayments, 'applications'), 'applications');
  }, [currentApplicationPayments, debouncedSearchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, payerFilterMode, payerSearchTerm, sortConfig, sponsors, students, users]);

  const {
    currentPage: applicationCurrentPage,
    totalPages: applicationTotalPages,
    pageStartIndex: applicationPageStartIndex,
    pageEndIndex: applicationPageEndIndex,
    paginatedRows: paginatedApplicationPayments,
    setCurrentPage: setApplicationCurrentPage
  } = usePaginatedRows(filteredApplicationPayments, [listTab, applicationListTab, debouncedSearchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, payerFilterMode, payerSearchTerm, sortConfig], PAYMENT_PAGE_SIZE);

  const filteredApplicationRemainingBalance = useMemo(() => {
    return filteredApplicationPayments.reduce((sum, payment) => sum + getAvailablePaymentBalance(payment), 0);
  }, [filteredApplicationPayments]);

  const getPaymentApplicationActionLabel = (payment: Payment) => {
    if (applicationListTab === 'unapplied') {
      return canApplyPayment(payment) ? 'Apply Payment' : 'View Payment';
    }
    return canApplyPayment(payment) ? 'Continue Apply' : 'View Details';
  };

  const handlePaymentApplicationAction = (payment: Payment) => {
    if (applicationListTab === 'unapplied') {
      if (canApplyPayment(payment)) {
        loadPaymentForApplication(payment);
        return;
      }
      loadPaymentForViewing(payment);
      return;
    }

    if (canApplyPayment(payment)) {
      loadPaymentForApplication(payment);
      return;
    }

    loadPaymentForDetails(payment);
  };

  const handlePaymentApplicationRowClick = (payment: Payment) => {
    if (applicationListTab === 'unapplied') {
      loadPaymentForViewing(payment);
      return;
    }

    loadPaymentForDetails(payment);
  };

  const getPaymentApplicationInvoiceLabel = (payment: Payment) => {
    const appliedInvoiceNos = getActiveApplications(payment)
      .map(app => invoices.find(invoice => invoice.id === app.invoiceId)?.invoiceNo || app.invoiceId)
      .filter(Boolean);

    const uniqueInvoiceNos = Array.from(new Set(appliedInvoiceNos));
    if (uniqueInvoiceNos.length > 0) {
      return uniqueInvoiceNos.join(', ');
    }

    const sourceInvoiceId = (payment as Payment & { sourceInvoiceId?: string }).sourceInvoiceId;
    if (!sourceInvoiceId) return '-';

    return invoices.find(invoice => invoice.id === sourceInvoiceId)?.invoiceNo || sourceInvoiceId;
  };

  const applicationRegistryColumns: ApplicationRegistryColumn[] = [
    {
      key: 'date',
      label: 'Transaction Date',
      align: 'text-left',
      minWidth: 128,
      sortKey: 'date',
      value: (payment) => payment.paymentDate ? format(new Date(payment.paymentDate), 'MM-dd-yyyy') : '-',
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {payment.paymentDate ? format(new Date(payment.paymentDate), 'MM-dd-yyyy') : '-'}
        </span>
      )
    },
    {
      key: 'postPeriod',
      label: 'Post Period',
      align: 'text-left',
      minWidth: 112,
      sortKey: 'postPeriod',
      value: (payment) => formatPostPeriod(payment.paymentDate),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {formatPostPeriod(payment.paymentDate) || '-'}
        </span>
      )
    },
    {
      key: 'paymentApplicationNo',
      label: 'Payment Application No.',
      align: 'text-left',
      minWidth: 200,
      sortKey: 'paymentApplicationNo',
      value: (payment) => getPaymentApplicationNumberLabel(payment),
      render: (payment) => (
        <span className="font-medium text-gray-800">{getPaymentApplicationNumberLabel(payment)}</span>
      )
    },
    {
      key: 'invoiceNo',
      label: 'Invoice No.',
      align: 'text-left',
      minWidth: 176,
      sortKey: 'invoiceNo',
      value: (payment) => getPaymentApplicationInvoiceLabel(payment),
      render: (payment) => (
        <span className="font-medium text-gray-800">{getPaymentApplicationInvoiceLabel(payment)}</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      align: 'text-left',
      minWidth: 96,
      sortKey: 'status',
      value: (payment) => getDisplayStatusLabel(getApplicationRegistryStatus(payment)),
      render: (payment) => (
        <span className="font-medium text-gray-800">{getDisplayStatusLabel(getApplicationRegistryStatus(payment))}</span>
      )
    },
    {
      key: 'glReference',
      label: 'GL Reference No.',
      align: 'text-left',
      minWidth: 160,
      sortKey: 'glReference',
      value: (payment) => getPaymentApplicationGlReferenceLabel(payment),
      render: (payment) => (
        renderPaymentApplicationGlReferences(payment)
      )
    },
    {
      key: 'payor',
      label: 'Sponsor/Student',
      align: 'text-left',
      minWidth: 256,
      sortKey: 'payor',
      value: (payment) => getPayorName(payment),
      render: (payment) => (
        <span className="font-medium text-gray-800">
          {getPayorName(payment)}
        </span>
      )
    },
    {
      key: 'amountReceived',
      label: 'Amount Received',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'amountReceived',
      value: (payment) => getTotalPaymentCredit(payment),
      render: (payment) => (
        renderAccountingAmount(getTotalPaymentCredit(payment))
      )
    },
    {
      key: 'amountApplied',
      label: 'Amount Applied',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'amountApplied',
      value: (payment) => Number(payment.totalApplied ?? 0),
      render: (payment) => (
        renderAccountingAmount(Number(payment.totalApplied ?? 0))
      )
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'text-right',
      minWidth: 128,
      sortKey: 'balance',
      value: (payment) => getAvailablePaymentBalance(payment),
      render: (payment) => (
        renderAccountingAmount(getAvailablePaymentBalance(payment))
      )
    },
    {
      key: 'applications',
      label: 'Application Count',
      align: 'text-center',
      minWidth: 112,
      value: (payment) => getActiveApplications(payment).length,
      render: (payment) => (
        <span className="font-medium text-gray-800">{getActiveApplications(payment).length}</span>
      )
    }
  ];

  const applyPaymentColumns: ApplyPaymentColumn[] = [
    {
      key: 'apply',
      label: 'Apply',
      align: 'text-center',
      minWidth: 80,
      render: (inv, invoiceSelectionMap, invoiceApplyMap, transactionDescriptions, setTransactionDescriptions, handleInvoiceTick) => (
        <input
          type="checkbox"
          checked={!!invoiceSelectionMap[inv.id]}
          onChange={e => handleInvoiceTick(inv, e.target.checked)}
        />
      )
    },
    {
      key: 'invoiceNo',
      label: 'Invoice No',
      align: 'text-left',
      minWidth: 160,
      render: (inv) => <span className="font-medium text-gray-800">{inv.invoiceNo}</span>
    },
    {
      key: 'date',
      label: 'Date',
      align: 'text-left',
      minWidth: 128,
      render: (inv) => (
        <span className="text-gray-600">
          {inv.invoiceDate ? format(new Date(inv.invoiceDate), 'MM-dd-yyyy') : '-'}
        </span>
      )
    },
    {
      key: 'postPeriod',
      label: 'Post Period',
      align: 'text-left',
      minWidth: 112,
      render: (inv) => (
        <span className="text-gray-600">
          {formatPostPeriod(inv.invoiceDate) || '-'}
        </span>
      )
    },
    {
      key: 'transactionDescription',
      label: 'Transaction Description',
      align: 'text-left',
      minWidth: 200,
      render: (inv, invoiceSelectionMap, invoiceApplyMap, transactionDescriptions, setTransactionDescriptions) => (
        <input
          type="text"
          value={transactionDescriptions[inv.id] || `Payment application for invoice ${inv.invoiceNo}`}
          onChange={e => {
            setTransactionDescriptions(prev => ({ ...prev, [inv.id]: e.target.value }));
          }}
          disabled={!invoiceSelectionMap[inv.id]}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="Enter transaction description"
        />
      )
    },
    {
      key: 'amountDue',
      label: 'Amount Due',
      align: 'text-right',
      minWidth: 128,
      render: (inv) => <span className="font-semibold text-gray-800">{formatCurrency(inv.balanceDue)}</span>
    },
    {
      key: 'applyAmount',
      label: 'Apply Amount',
      align: 'text-right',
      minWidth: 140,
      render: (inv, invoiceSelectionMap, invoiceApplyMap, transactionDescriptions, setTransactionDescriptions, handleInvoiceTick, availableToApply) => (
        <input
          type="number"
          min="0"
          step="0.01"
          disabled={!invoiceSelectionMap[inv.id]}
          max={Math.min(inv.balanceDue, availableToApply)}
          value={invoiceApplyMap[inv.id] || ''}
          onChange={e => {
            const value = parseFloat(e.target.value) || 0;
            setInvoiceApplyMap(prev => ({ ...prev, [inv.id]: Math.min(value, inv.balanceDue) }));
          }}
          className="w-36 rounded-lg border border-gray-200 bg-white px-3 py-2 text-right text-sm font-medium text-gray-800 outline-none transition-colors focus:border-emerald-400"
        />
      )
    }
  ];

  const orderedApplyPaymentColumns = applyPaymentColumnOrder
    .map(key => applyPaymentColumns.find(col => col.key === key))
    .filter(Boolean) as ApplyPaymentColumn[];

  const orderedApplicationRegistryColumns = applicationColumnOrder
    .map(key => applicationRegistryColumns.find(col => col.key === key))
    .filter(Boolean) as ApplicationRegistryColumn[];

  const clearRegistryFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setDateFilterMode('ALL');
    setDateFrom('');
    setDateTo('');
    setPayerFilterMode('ALL');
    setPayerSearchTerm('');
    setShowDateDropdown(false);
    setShowPayerDropdown(false);
    setShowExportDropdown(false);
  };

  function getRegistryExportColumns(): Array<{ label: string; value: (payment: Payment) => string | number }> {
    if (listTab === 'applications') {
      return orderedApplicationRegistryColumns
        .filter((col): col is ApplicationRegistryColumn & { value: (payment: Payment) => string | number } => typeof col.value === 'function')
        .filter(col => col.key !== 'action');
    }
    return registryColumns;
  }

  function getExportRows() {
    const sourceRows = listTab === 'applications' ? filteredApplicationPayments : filteredPayments;
    const columns = getRegistryExportColumns();
    return sourceRows.map(payment => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        row[col.label] = col.value(payment);
      });
      return row;
    });
  }

  function getExportDocumentTitle() {
    if (listTab !== 'applications') return 'Payment Registry';
    return applicationListTab === 'unapplied'
      ? 'Payment Application Registry - Not Yet Applied'
      : 'Payment Application Registry - Already Applied';
  }

  function getExportFilePrefix() {
    if (listTab !== 'applications') return 'Payment_Registry';
    return applicationListTab === 'unapplied'
      ? 'Payment_Application_Registry_Not_Yet_Applied'
      : 'Payment_Application_Registry_Already_Applied';
  }

  function getExportEmptyMessage() {
    if (listTab !== 'applications') return 'No payments to export.';
    return applicationListTab === 'unapplied'
      ? 'No unapplied payment applications to export.'
      : 'No applied payment applications to export.';
  }

  const renderRegistryToolbar = (searchPlaceholder: string) => (
    <div className="bg-white border-y px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex h-9 w-64 items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50">
          <Search size={14} className="mr-2 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 border-none bg-transparent text-[13px] font-medium text-gray-700 outline-none placeholder:font-normal placeholder:text-gray-300"
          />
        </div>

        <div className="relative flex h-9 items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50">
          <span className="mr-1 text-[13px] text-gray-500">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as PaymentStatus | 'ALL')}
            className="cursor-pointer appearance-none border-none bg-transparent pr-4 text-[13px] font-bold text-gray-800 outline-none"
          >
            <option value="ALL">All</option>
            <option value="DRAFT">ON HOLD</option>
            <option value="OPEN">OPEN</option>
            <option value="POSTED">POSTED</option>
            <option value="CLOSED">CLOSED</option>
            <option value="VOIDED">VOIDED</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 text-gray-400" />
        </div>

        <div className="relative">
          <div
            onClick={() => setShowPayerDropdown(!showPayerDropdown)}
            className="relative flex h-9 max-w-[220px] cursor-pointer select-none items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50"
          >
            <span className="mr-1 truncate text-[13px] text-gray-500">Sponsor/Student:</span>
            <span className="truncate pr-5 text-[13px] font-bold text-gray-800">
              {payerFilterMode === 'ALL' ? 'All' : payerFilterMode === 'CUSTOM' && payerSearchTerm ? `"${payerSearchTerm}"` : 'Custom...'}
            </span>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 text-gray-400" />
          </div>

          {showPayerDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPayerDropdown(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                <div className="p-1">
                  <button
                    onClick={() => { setSortConfig({ key: 'payor', direction: 'asc' }); setShowPayerDropdown(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'payor' && sortConfig.direction === 'asc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                  >
                    <ChevronUp size={14} /> Sort Ascending
                  </button>
                  <button
                    onClick={() => { setSortConfig({ key: 'payor', direction: 'desc' }); setShowPayerDropdown(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'payor' && sortConfig.direction === 'desc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                  >
                    <ChevronDown size={14} /> Sort Descending
                  </button>
                </div>
                <div className="border-t border-gray-100 p-1">
                  <button
                    onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left text-[13px] text-gray-700 hover:bg-gray-100"
                  >
                    Remove Quick Filter
                  </button>
                  <button
                    onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                    className="w-full cursor-not-allowed px-3 py-1.5 text-left text-[13px] text-gray-400 hover:bg-gray-100"
                    disabled
                  >
                    Clear Filter
                  </button>
                </div>
                <div className="border-t border-gray-100 p-1">
                  <button
                    onClick={() => setPayerFilterMode('CUSTOM')}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${payerFilterMode === 'CUSTOM' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {payerFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Equal to
                  </button>
                </div>
                <div className="space-y-2 border-t border-gray-100 bg-gray-50/50 p-3">
                  <input
                    type="text"
                    placeholder="Type to search..."
                    value={payerSearchTerm}
                    onChange={(e) => {
                      setPayerSearchTerm(e.target.value);
                      if (payerFilterMode !== 'CUSTOM') setPayerFilterMode('CUSTOM');
                    }}
                    className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowPayerDropdown(false)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <div
            onClick={() => setShowDateDropdown(!showDateDropdown)}
            className="relative flex h-9 cursor-pointer select-none items-center rounded border bg-white px-3 transition-colors hover:bg-gray-50"
          >
            <span className="mr-1 text-[13px] text-gray-500">Date:</span>
            <span className="max-w-[120px] truncate pr-5 text-[13px] font-bold text-gray-800">
              {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
            </span>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 text-gray-400" />
          </div>

          {showDateDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                <div className="p-1">
                  <button
                    onClick={() => { setSortConfig({ key: 'date', direction: 'asc' }); setShowDateDropdown(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'date' && sortConfig.direction === 'asc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                  >
                    <ChevronUp size={14} /> Sort Ascending
                  </button>
                  <button
                    onClick={() => { setSortConfig({ key: 'date', direction: 'desc' }); setShowDateDropdown(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 ${sortConfig.key === 'date' && sortConfig.direction === 'desc' ? 'bg-orange-50 font-bold text-orange-600' : 'text-gray-700'}`}
                  >
                    <ChevronDown size={14} /> Sort Descending
                  </button>
                </div>
                <div className="border-t border-gray-100 p-1">
                  <button
                    onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                    className="w-full px-3 py-1.5 text-left text-[13px] text-gray-700 hover:bg-gray-100"
                  >
                    Remove Quick Filter
                  </button>
                  <button
                    onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                    className="w-full cursor-not-allowed px-3 py-1.5 text-left text-[13px] text-gray-400 hover:bg-gray-100"
                    disabled
                  >
                    Clear Filter
                  </button>
                </div>
                <div className="border-t border-gray-100 p-1">
                  <button
                    onClick={() => setDateFilterMode('CUSTOM')}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${dateFilterMode === 'CUSTOM' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                  </button>
                  <button
                    onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${dateFilterMode === 'TODAY' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                  </button>
                  <button
                    onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${dateFilterMode === 'THIS_MONTH' ? 'bg-blue-50 font-bold text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                  </button>
                </div>
                <div className="space-y-2 border-t border-gray-100 bg-gray-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] font-semibold uppercase text-gray-400">From:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                      className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[11px] font-semibold uppercase text-gray-400">To:</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); if (dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                      className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowDateDropdown(false)}
                      className="rounded bg-gray-200 px-3 py-1 text-[11px] font-bold uppercase text-gray-600 transition-colors hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => setShowDateDropdown(false)}
                      className="rounded bg-blue-600 px-4 py-1 text-[11px] font-bold uppercase text-white shadow-sm transition-colors hover:bg-blue-700"
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={clearRegistryFilters}
          className="p-2 text-gray-400 transition-colors hover:text-orange-500"
          title="Clear all filters"
        >
          <RotateCcw size={16} />
        </button>

        <div className="relative ml-auto">
          <button
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="flex h-9 select-none items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            title="Export"
          >
            <Download size={16} />
            <span>Export</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {showExportDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-xl">
                <div className="p-1">
                  <button
                    onClick={() => {
                      setShowExportDropdown(false);
                      exportToExcel();
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600" />
                    Export as Excel
                  </button>
                  <button
                    onClick={() => {
                      setShowExportDropdown(false);
                      exportToPdf();
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-[13px] text-gray-700 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <FileText size={16} className="text-red-500" />
                    Export as PDF
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const handleListTabChange = (nextTab: ListTab) => {
    setListTab(nextTab);
    setShowDateDropdown(false);
    setShowPayerDropdown(false);
    setShowExportDropdown(false);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumnIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedColumnIdx(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedColumnIdx === null || draggedColumnIdx === dropIndex) return;

    const newOrder = [...columnOrder];
    const [draggedKey] = newOrder.splice(draggedColumnIdx, 1);
    newOrder.splice(dropIndex, 0, draggedKey);

    setColumnOrder(newOrder);
    setDraggedColumnIdx(null);
  };

  const handleApplicationDragStart = (e: React.DragEvent, index: number) => {
    setDraggedApplicationColumnIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleApplicationDragEnd = (e: React.DragEvent) => {
    setDraggedApplicationColumnIdx(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleApplicationDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleApplicationDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedApplicationColumnIdx === null || draggedApplicationColumnIdx === dropIndex) return;

    const newOrder = [...applicationColumnOrder];
    const [draggedKey] = newOrder.splice(draggedApplicationColumnIdx, 1);
    newOrder.splice(dropIndex, 0, draggedKey);

    setApplicationColumnOrder(newOrder);
    setDraggedApplicationColumnIdx(null);
  };

  const handleApplyPaymentDragStart = (e: React.DragEvent, index: number) => {
    setDraggedApplyPaymentColumnIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleApplyPaymentDragEnd = (e: React.DragEvent) => {
    setDraggedApplyPaymentColumnIdx(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleApplyPaymentDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleApplyPaymentDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedApplyPaymentColumnIdx === null || draggedApplyPaymentColumnIdx === dropIndex) return;

    const newOrder = [...applyPaymentColumnOrder];
    const [draggedKey] = newOrder.splice(draggedApplyPaymentColumnIdx, 1);
    newOrder.splice(dropIndex, 0, draggedKey);

    setApplyPaymentColumnOrder(newOrder);
    setDraggedApplyPaymentColumnIdx(null);
  };

  // ===== VIEW: PAYMENT LIST (DASHBOARD) =====
  if (viewMode === 'list') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Payments and Applications</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage payment receipts and invoice application activity from one formal registry workspace.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-stretch">
            <button
              onClick={() => handleListTabChange('payments')}
              className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                listTab === 'payments'
                  ? 'bg-slate-50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              style={listTab === 'payments' ? { borderColor: brandColor, color: brandColor } : undefined}
            >
              <Wallet size={16} />
              Payments
            </button>
            <button
              onClick={() => handleListTabChange('applications')}
              className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-semibold transition-colors ${
                listTab === 'applications'
                  ? 'bg-slate-50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
              style={listTab === 'applications' ? { borderColor: brandColor, color: brandColor } : undefined}
            >
              <CheckSquare size={16} />
              Payment Applications
            </button>
          </div>
          <button
            onClick={listTab === 'payments' ? startNewPayment : startNewPaymentApplication}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-300"
          >
            <Plus size={20} />
            {listTab === 'payments' ? 'New Payment' : 'New Payment Application'}
          </button>
        </div>

        {listTab === 'payments' && (
          <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">On Hold</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{paymentStats.draftCount}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Open</p>
            <p className="mt-2 text-2xl font-semibold text-blue-600">{paymentStats.openCount}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Posted</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{paymentStats.closedCount}</p>
          </div>
          <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Unapplied Payments</p>
            <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{formatCurrency(paymentStats.unappliedPayments)}</p>
          </div>
        </div>

        {renderRegistryToolbar('Search payments...')}

        <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full font-sans">
              <thead className="border-b bg-emerald-600">
                <tr>
                  {registryColumns.map((col, idx) => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`group relative cursor-move select-none border-x border-transparent px-4 py-3 font-semibold text-white transition-colors hover:border-emerald-200 hover:bg-emerald-700 ${draggedColumnIdx === idx ? 'border-2 border-dashed border-emerald-300 bg-emerald-700 opacity-50' : ''} ${col.align}`}
                      style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}
                      title="Drag to reorder column"
                    >
                      <div
                        className={`flex items-center text-[13px] font-bold text-white ${
                          col.align === 'text-right' ? 'justify-end' : col.align === 'text-center' ? 'justify-center' : ''
                        } ${col.sortKey ? 'cursor-pointer hover:text-gray-100' : ''}`}
                        onClick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
                      >
                        {col.label} {col.sortKey && <SortIndicator columnKey={col.sortKey} />}
                      </div>
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          if (!th) return;
                          const startWidth = th.getBoundingClientRect().width;
                          resizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                          const onMouseMove = (ev: MouseEvent) => {
                            if (!resizeRef.current) return;
                            const diff = ev.clientX - resizeRef.current.startX;
                            const newWidth = Math.max(60, resizeRef.current.startWidth + diff);
                            setColumnWidths(prev => ({ ...prev, [resizeRef.current!.colKey]: newWidth }));
                          };
                          const onMouseUp = () => {
                            resizeRef.current = null;
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
                        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-emerald-400 transition-colors z-10"
                        title="Drag to resize column"
                        draggable={false}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {paymentTotalItems === 0 ? (
                  <tr>
                    <td colSpan={registryColumns.length} className="p-12 text-center text-gray-500">
                      <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-gray-700">{isLoadingPaymentPage && !usePaymentFallbackRows ? 'Loading payments...' : 'No payments recorded'}</p>
                        <p className="text-sm text-gray-500">Click "New Payment" to get started</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map(payment => (
                    <tr
                      key={payment.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => loadPaymentForViewing(payment)}
                      title={payment.status === 'DRAFT' ? 'Click to edit draft payment' : 'Click to view payment'}
                    >
                      {registryColumns.map(col => (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${col.align}`}
                          style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}
                        >
                          {col.render(payment)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <PaginationControls
              currentPage={paymentCurrentPage}
              totalPages={paymentTotalPages}
              totalItems={paymentTotalItems}
              pageStartIndex={paymentPageStartIndex}
              pageEndIndex={paymentPageEndIndex}
              onPageChange={setPaymentCurrentPage}
              itemLabel="payments"
            />
          </div>
          </>
        )}

        {listTab === 'applications' && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Not Yet Applied</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{paymentApplicationStats.unappliedCount}</p>
              </div>
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Not Yet Applied Balance</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{formatCurrency(paymentApplicationStats.unappliedBalance)}</p>
              </div>
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Already Applied</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-600">{paymentApplicationStats.appliedCount}</p>
              </div>
              <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Amount Applied</p>
                <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{formatCurrency(paymentApplicationStats.appliedAmount)}</p>
              </div>
            </div>

            {renderRegistryToolbar('Search payment applications...')}

            <div className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Payment Application Summary</h3>
                  <p className="text-sm text-gray-500">
                    Track payment records waiting for invoice application and payment records that already have invoice applications.
                  </p>
                </div>

                <div className="inline-flex rounded-lg border bg-gray-50 p-1">
                  <button
                    onClick={() => setApplicationListTab('unapplied')}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                      applicationListTab === 'unapplied'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Not Yet Applied ({unappliedPaymentList.length})
                  </button>
                  <button
                    onClick={() => setApplicationListTab('applied')}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                      applicationListTab === 'applied'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Already Applied ({appliedPaymentList.length})
                  </button>
                </div>
              </div>

              <div className="mt-4 overflow-x-scroll rounded-xl border bg-white pb-2">
                <table className="min-w-max w-full font-sans">
                  <thead className="border-b bg-emerald-600">
                    <tr>
                      {orderedApplicationRegistryColumns.map((col, idx) => (
                        <th
                          key={col.key}
                          draggable
                          onDragStart={(e) => handleApplicationDragStart(e, idx)}
                          onDragEnd={handleApplicationDragEnd}
                          onDragOver={handleApplicationDragOver}
                          onDrop={(e) => handleApplicationDrop(e, idx)}
                          className={`group relative cursor-move select-none border-x border-transparent px-4 py-3 font-semibold text-white transition-colors hover:border-emerald-200 hover:bg-emerald-700 ${draggedApplicationColumnIdx === idx ? 'border-2 border-dashed border-emerald-300 bg-emerald-700 opacity-50' : ''} ${col.align}`}
                          style={applicationColumnWidths[col.key] ? { width: applicationColumnWidths[col.key], minWidth: applicationColumnWidths[col.key] } : undefined}
                          title="Drag to reorder column"
                        >
                          <div
                            className={`flex items-center text-[13px] font-bold text-white ${
                              col.align === 'text-right' ? 'justify-end' : col.align === 'text-center' ? 'justify-center' : ''
                            } ${col.sortKey ? 'cursor-pointer hover:text-gray-100' : ''}`}
                            onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
                          >
                            {col.label} {col.sortKey && <SortIndicator columnKey={col.sortKey} />}
                          </div>
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const th = e.currentTarget.parentElement;
                              if (!th) return;
                              const startWidth = th.getBoundingClientRect().width;
                              applicationResizeRef.current = { colKey: col.key, startX: e.clientX, startWidth };
                              const onMouseMove = (ev: MouseEvent) => {
                                if (!applicationResizeRef.current) return;
                                const diff = ev.clientX - applicationResizeRef.current.startX;
                                const newWidth = Math.max(60, applicationResizeRef.current.startWidth + diff);
                                setApplicationColumnWidths(prev => ({ ...prev, [applicationResizeRef.current!.colKey]: newWidth }));
                              };
                              const onMouseUp = () => {
                                applicationResizeRef.current = null;
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
                            className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize transition-colors hover:bg-emerald-400 z-10"
                            title="Drag to resize column"
                            draggable={false}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredApplicationPayments.length === 0 ? (
                      <tr>
                        <td colSpan={orderedApplicationRegistryColumns.length} className="px-4 py-12 text-center text-gray-500">
                          <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                          {currentApplicationPayments.length === 0
                            ? (applicationListTab === 'unapplied'
                              ? 'No payments waiting for application'
                              : 'No applied payments found')
                            : 'No payment applications match the current filters'}
                        </td>
                      </tr>
                    ) : (
                      paginatedApplicationPayments.map(payment => {
                        return (
                          <tr
                            key={payment.id}
                            className="cursor-pointer transition-colors hover:bg-gray-50"
                            onClick={() => handlePaymentApplicationRowClick(payment)}
                          >
                            {orderedApplicationRegistryColumns.map(col => (
                              <td
                                key={col.key}
                                className={`px-4 py-3 ${col.align}`}
                                style={applicationColumnWidths[col.key] ? { width: applicationColumnWidths[col.key], minWidth: applicationColumnWidths[col.key] } : undefined}
                              >
                                {col.render(payment)}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationControls
                currentPage={applicationCurrentPage}
                totalPages={applicationTotalPages}
                totalItems={filteredApplicationPayments.length}
                pageStartIndex={applicationPageStartIndex}
                pageEndIndex={applicationPageEndIndex}
                onPageChange={setApplicationCurrentPage}
                itemLabel="payment applications"
              />

              <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                {applicationListTab === 'unapplied'
                  ? `Showing ${filteredApplicationPayments.length} payment(s) with no active invoice applications.`
                  : `Showing ${filteredApplicationPayments.length} payment(s) with active invoice applications and ${formatCurrency(filteredApplicationRemainingBalance)} remaining unapplied balance.`}
              </div>
            </div>
          </>
        )}

        {showVoidModal && voidingPayment && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b p-4">
                  <div className="rounded-lg bg-rose-100 p-2">
                    <AlertTriangle size={18} className="text-rose-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Void Payment</h4>
                    <p className="text-sm text-gray-500">{voidingPayment.paymentNo}</p>
                  </div>
                </div>
                <div className="p-4">
                  <label className="text-sm font-medium text-gray-700">Reason *</label>
                  <textarea
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 border-t bg-gray-50 p-4">
                  <button
                    onClick={() => {
                      setShowVoidModal(false);
                      setVoidingPayment(null);
                      setVoidReason('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!voidReason.trim()) return;
                      if (onVoidPayment) await onVoidPayment(voidingPayment.id, voidReason);
                      else await onUpdatePayment({ ...voidingPayment, status: 'VOIDED', voidReason, voidedAt: new Date().toISOString() });
                      setRefreshKey(key => key + 1);
                      setShowVoidModal(false);
                      setVoidingPayment(null);
                      setVoidReason('');
                    }}
                    disabled={!voidReason.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <XCircle size={14} />
                    Void Payment
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {showReverseModal && reversingApplication && (
          <ModalPortal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b p-4">
                  <div className="rounded-lg bg-amber-100 p-2">
                    <RotateCcw size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">Reverse Application</h4>
                    <p className="text-sm text-gray-500">{reversingApplication.payment.paymentNo}</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="text-sm text-gray-600">
                    Invoice: <span className="font-semibold text-gray-900">{invoices.find(i => i.id === reversingApplication.application.invoiceId)?.invoiceNo || reversingApplication.application.invoiceId}</span>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Reason *</label>
                    <textarea
                      value={reverseReason}
                      onChange={e => setReverseReason(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="Enter reversal reason..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t bg-gray-50 p-4">
                  <button
                    onClick={() => {
                      setShowReverseModal(false);
                      setReversingApplication(null);
                      setReverseReason('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!reverseReason.trim() || !reversingApplication) return;
                      if (onReverseApplication) {
                        onReverseApplication(reversingApplication.payment.id, reversingApplication.application.id, reverseReason);
                      }
                      setShowReverseModal(false);
                      setReversingApplication(null);
                      setReverseReason('');
                    }}
                    disabled={!reverseReason.trim()}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <RotateCcw size={14} />
                    Reverse Application
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    );
  }

  // ===== VIEW: CREATE NEW PAYMENT =====
  if (viewMode === 'create-payment') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Payments and Applications
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b bg-brand/10 p-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800">
                New Payment : {formData.paymentNo}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
             
              </p>
            </div>
          </div>
          {/* Action Toolbar */}
          {renderPaymentDocumentActions()}
          {!isReadOnly && headerValidationError && (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {headerValidationError}
            </div>
          )}

          <div className="flex-1 overflow-auto p-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              {/* Payment Information */}
              <div className="space-y-4 xl:col-span-8">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Information</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <label className={invoiceLabelClass}>Payment No.</label>
                      <input
                        value={formData.paymentNo}
                        disabled
                        className={invoiceReadOnlyClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Post Period</label>
                      <input
                        type="text"
                        value={formatPostPeriod(formData.paymentDate)}
                        readOnly
                        className={invoicePostPeriodClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Payment Date *</label>
                      <div className="relative mt-1">
                        <Calendar size={14} className="pointer-events-none absolute right-3 top-2.5 text-gray-400" />
                        <input
                          type="date"
                          value={formData.paymentDate}
                          onChange={e => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
                          disabled={isReadOnly}
                          className={invoiceInputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Payment Method *</label>
                      <select
                        value={formData.paymentMethod}
                        onChange={e => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as PaymentMethod }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      >
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHECK">Check</option>
                        <option value="CASH">Cash</option>
                        <option value="CREDIT_CARD">Credit Card</option>
                        <option value="EWALLET">E-Wallet</option>
                        <option value="OFFSET">Offset</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <label className={invoiceLabelClass}>C.R. No. *</label>
                      <input
                        value={formData.crNo}
                        onChange={e => setFormData(prev => ({ ...prev, crNo: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                        placeholder="Collection Receipt No."
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Payor Type *</label>
                      <div className="mt-2 flex gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            checked={payorType === 'SPONSOR'}
                            onChange={() => {
                              setPayorType('SPONSOR');
                              setSourceInvoiceId(undefined);
                              setFormData(prev => ({ ...prev, studentId: '', otherCustomerName: '' }));
                            }}
                            disabled={isReadOnly}
                          />
                          Sponsor
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            checked={payorType === 'STUDENT'}
                            onChange={() => {
                              setPayorType('STUDENT');
                              setSourceInvoiceId(undefined);
                              setFormData(prev => ({ ...prev, sponsorId: '', otherCustomerName: '' }));
                            }}
                            disabled={isReadOnly}
                          />
                          Student
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="radio"
                            checked={payorType === 'OTHER'}
                            onChange={() => {
                              setPayorType('OTHER');
                              setSourceInvoiceId(undefined);
                              setFormData(prev => ({ ...prev, sponsorId: '', studentId: '' }));
                            }}
                            disabled={isReadOnly}
                          />
                          Other
                        </label>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className={invoiceLabelClass}>Payor Name *</label>
                      {payorType === 'SPONSOR' ? (
                        <SearchablePayorSelect
                          ariaLabel="Select Sponsor"
                          placeholder="Search sponsor by name..."
                          emptyMessage="No matching sponsor found."
                          value={formData.sponsorId}
                          disabled={isReadOnly}
                          options={sponsors
                            .filter(s => !s.isDeleted)
                            .map(s => ({
                              id: s.id,
                              label: s.name,
                              sublabel: s.code || undefined,
                              searchText: [s.name, s.code, s.contactPerson, s.email].filter(Boolean).join(' ').toLowerCase()
                            }))}
                          onChange={sponsorId => {
                            setSourceInvoiceId(undefined);
                            setFormData(prev => ({ ...prev, sponsorId, studentId: '', otherCustomerName: '' }));
                          }}
                        />
                      ) : payorType === 'STUDENT' ? (
                        <SearchablePayorSelect
                          ariaLabel="Select Student"
                          placeholder="Search student by name, ULI, or email..."
                          emptyMessage="No matching student found."
                          value={formData.studentId}
                          disabled={isReadOnly}
                          options={students
                            .filter(s => !s.isDeleted)
                            .map(s => {
                              const fullName = `${s.lastName}, ${s.firstName}${s.middleName ? ` ${s.middleName}` : ''}`.trim();
                              return {
                                id: s.id,
                                label: fullName,
                                sublabel: s.uli || s.studentNo || undefined,
                                searchText: [s.lastName, s.firstName, s.middleName, fullName, s.uli, s.studentNo, s.email].filter(Boolean).join(' ').toLowerCase()
                              };
                            })}
                          onChange={studentId => {
                            setSourceInvoiceId(undefined);
                            setFormData(prev => ({ ...prev, studentId, sponsorId: '', otherCustomerName: '' }));
                          }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={formData.otherCustomerName}
                          onChange={e => {
                            setSourceInvoiceId(undefined);
                            setFormData(prev => ({ ...prev, otherCustomerName: e.target.value, sponsorId: '', studentId: '' }));
                          }}
                          disabled={isReadOnly}
                          className={invoiceInputClass}
                          placeholder="Enter Other payor name (e.g., Rental customer)"
                        />
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <label className={invoiceLabelClass}>Invoice No.</label>
                      <select
                        value={sourceInvoiceId || ''}
                        onChange={e => handleSourceInvoiceChange(e.target.value)}
                        disabled={isReadOnly || (!selectedPayorId && !sourceInvoiceId)}
                        className={invoiceInputClass}
                      >
                        <option value="">
                          {selectedPayorId || sourceInvoiceId ? 'No invoice / select invoice' : 'Optional — select sponsor/student first'}
                        </option>
                        {invoiceSelectionOptions.map(invoice => (
                          <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo}</option>
                        ))}
                      </select>
                      {!selectedPayorId && !sourceInvoiceId && (
                        <p className="mt-1 text-xs text-gray-500">Choose the sponsor or student first to load invoice numbers.</p>
                      )}
                      {existingLinkedInvoicePayment && (
                        <p className="mt-1 text-xs font-medium text-rose-600">
                          A payment already exists for this invoice under {existingLinkedInvoicePayment.paymentNo}. Review, edit, or complete that payment instead.
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-3">
                      <label className={invoiceLabelClass}>Transaction Description *</label>
                      <input
                        value={formData.notes}
                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                        placeholder="Payment notes or memo..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={invoiceLabelClass}>Status</label>
                      <div className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50">
                        <span className="text-[13px] font-medium text-gray-700">
                          {getDisplayStatusLabel(editingPayment?.status || 'DRAFT')}
                        </span>
                      </div>
                    </div>
                    <div className="md:col-span-4">
                      <label className={invoiceLabelClass}>GL Reference No.</label>
                      {editingPayment?.journalEntryId && onViewJournal ? (
                        <button
                          type="button"
                          onClick={() => onViewJournal(editingPayment.journalEntryId!)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-base font-normal rounded-lg bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition-all w-full justify-center shadow-sm"
                          title="Open the related journal entry"
                          style={{ cursor: 'pointer' }}
                        >
                          <FileText size={16} />
                          <span>{getPaymentGlReferenceLabel(editingPayment)}</span>
                          <span className="text-base font-normal text-emerald-600 ml-auto">{'-> View Journal Entry'}</span>
                        </button>
                      ) : (
                        <>
                          <input
                            value={editingPayment ? getPaymentGlReferenceLabel(editingPayment) : ''}
                            readOnly
                            placeholder="Generated when payment is approved"
                            className="w-full mt-1 px-3 py-2 border border-brand-light rounded-lg bg-gray-50 cursor-default focus:border-brand"
                          />
                           <p className="text-xs text-gray-400 mt-1"></p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="rounded-xl border bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Details</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className={invoiceLabelClass}>Amount Received *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getAmountInputValue('amountReceived')}
                        onFocus={e => handleAmountFocus('amountReceived', e)}
                        onChange={e => handleAmountChange('amountReceived', e.target.value)}
                        onBlur={handleAmountBlur}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>EWT Amount Certified</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={getAmountInputValue('ewtAmountCertified')}
                        onFocus={e => handleAmountFocus('ewtAmountCertified', e)}
                        onChange={e => handleAmountChange('ewtAmountCertified', e.target.value)}
                        onBlur={handleAmountBlur}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Reference No.</label>
                      <input
                        value={formData.refNo}
                        onChange={e => setFormData(prev => ({ ...prev, refNo: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                        placeholder="TRF / OR / Check Ref"
                      />
                    </div>
                    <div>
                      <label className={invoiceLabelClass}>Cash Account *</label>
                      <select
                        value={formData.bankAccountId}
                        onChange={e => setFormData(prev => ({ ...prev, bankAccountId: e.target.value }))}
                        disabled={isReadOnly}
                        className={invoiceInputClass}
                      >
                        <option value="">Select Cash Account</option>
                        {cashAccountOptions.map(account => (
                          <option key={account.id} value={account.id}>{account.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>
              </div>

              {/* GL Impact Summary */}
              <div className="space-y-4 xl:col-span-4">
                <div className="rounded-xl border bg-white p-4">
                  <h3 className={previewSectionTitleClass}>
                    GL Journal Entry Preview
                  </h3>
                  
                  {glImpactRows.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                      Configure required GL accounts before posting this payment.
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                            <th className="pb-2">GL Account</th>
                            <th className="pb-2 text-right">Debit</th>
                            <th className="pb-2 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {glImpactRows.map((row, index) => (
                            <tr key={index} className="border-t text-gray-700">
                              <td className="py-2 text-[11px] font-medium">{row.account}</td>
                              <td className="py-2 text-right text-[11px] font-medium text-gray-700">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                              <td className="py-2 text-right text-[11px] font-medium text-gray-700">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-300 font-bold text-gray-700">
                            <td className="py-3 text-[11px]">Total</td>
                            <td className="py-3 text-right text-[11px]">{formatCurrency(baseTotalCredit)}</td>
                            <td className="py-3 text-right text-[11px]">{formatCurrency(baseTotalCredit)}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-700">
                        <div className="mb-2 font-semibold">GL Entry Details</div>
                        <ul className="list-disc space-y-1 pl-4 text-[11px] font-medium">
                          <li>Journal Entry Date: {new Date(formData.paymentDate).toLocaleDateString()}</li>
                          <li>Reference: {formData.paymentNo}</li>
                          <li>Total Debit = Total Credit (balanced entry)</li>
                        </ul>
                      </div>
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-700">Click "Approve" to create this journal entry and record payment</div>
                    </>
                  )}
                </div>

                {selectedSourceInvoice && (
                  <div className="rounded-xl border bg-white p-4">
                    <h3 className={previewSectionTitleClass}>
                      Invoice Preview
                    </h3>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className={previewLabelClass}>Invoice No.</div>
                        <div className={previewValueClass}>{selectedSourceInvoice.invoiceNo}</div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className={previewLabelClass}>Invoice Date</div>
                          <div className={previewValueClass}>
                            {selectedSourceInvoice.invoiceDate ? format(new Date(selectedSourceInvoice.invoiceDate), 'MM-dd-yyyy') : '-'}
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className={previewLabelClass}>Due Date</div>
                          <div className={previewValueClass}>
                            {selectedSourceInvoice.dueDate ? format(new Date(selectedSourceInvoice.dueDate), 'MM-dd-yyyy') : '-'}
                          </div>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3 sm:col-span-2">
                          <div className={previewLabelClass}>Payor</div>
                          <div className={previewValueClass}>{getInvoicePayorName(selectedSourceInvoice)}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className={previewLabelClass}>Invoice Status</div>
                          <div className={previewValueClass}>{selectedSourceInvoice.status}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className={previewLabelClass}>Amount Paid</div>
                          <div className={previewValueClass}>{formatCurrency(Number(selectedSourceInvoice.amountPaid ?? 0))}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                          <div className={previewLabelClass}>Grand Total</div>
                          <div className={previewValueClass}>{formatCurrency(Number(selectedSourceInvoice.grandTotal ?? 0))}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <div className={previewLabelClass}>Balance Due</div>
                          <div className="mt-1 text-[13px] font-semibold text-gray-700">{formatCurrency(Number(selectedSourceInvoice.balanceDue ?? 0))}</div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="font-medium text-gray-500">Entered payment total</span>
                          <span className="font-medium text-gray-700">{formatCurrency(baseTotalCredit)}</span>
                        </div>
                        <div className="mt-2 text-[11px] font-medium text-gray-600">
                          {Math.abs(baseTotalCredit - Number(selectedSourceInvoice.balanceDue ?? 0)) <= 0.01
                            ? 'The entered payment matches the invoice balance due.'
                            : baseTotalCredit < Number(selectedSourceInvoice.balanceDue ?? 0)
                              ? `The payment is ${formatCurrency(Number(selectedSourceInvoice.balanceDue ?? 0) - baseTotalCredit)} short of the current balance due.`
                              : `The payment exceeds the current balance due by ${formatCurrency(baseTotalCredit - Number(selectedSourceInvoice.balanceDue ?? 0))}.`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== VIEW: APPLY INVOICES =====
  if (viewMode === 'apply-payment' && editingPayment) {
    const applicationDate = (editingPayment.paymentDate || new Date().toISOString()).split('T')[0];
    const applicationNoPreview = generatePaymentApplicationNo();
    const applicationGlReference = getPaymentApplicationGlReferenceLabel(editingPayment);
    const canSubmitApplication = plannedAppliedTotal > 0 && !applicationGlHasMissingAccounts;
    const applicationDateLabel = format(new Date(applicationDate), 'MM/dd/yyyy');
    const selectedPreviewInvoice = selectedApplicationInvoices[0];
    const { customerDepositsAccount } = resolvePaymentGlAccounts();
    const previewReceivableAccount = getReceivableAccountForInvoice(selectedPreviewInvoice);
    const displayApplicationGlRows = applicationGlImpactRows.length > 0
      ? applicationGlImpactRows
      : [
        {
          account: getGlAccountLabel(customerDepositsAccount, 'Customer Deposit'),
          debit: 0,
          credit: 0,
          missing: !customerDepositsAccount
        },
        {
          account: getGlAccountLabel(previewReceivableAccount, 'Accounts Receivable'),
          debit: 0,
          credit: 0,
          missing: false
        }
      ];
    const detailLabelClass = 'text-[13px] font-normal text-slate-700';
    const detailValueClass = 'text-[13px] font-normal text-slate-800';
    const readonlyPillClass = 'w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-normal text-slate-800 shadow-inner';
    const toolbarButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35';

    return (
      <div className="space-y-4 bg-slate-50/40">
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-2 text-sm font-normal text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back to Payments and Applications
          </button>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-emerald-50 bg-emerald-50/70 px-5 py-5">
            <h3 className="text-xl font-normal text-slate-900">New Pay Application : {applicationNoPreview}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-5 border-b border-slate-200 bg-white px-5 py-3">
            <button
              title="Discard Changes and Close"
              onClick={() => setViewMode('list')}
              className={toolbarButtonClass}
            >
              <RotateCcw size={21} />
            </button>
            <button
              title="Save Payment Application"
              onClick={applySelectedInvoices}
              disabled={!canSubmitApplication}
              className={toolbarButtonClass}
            >
              <Save size={20} />
            </button>
            <button
              title="Approve Payment Application"
              onClick={applySelectedInvoices}
              disabled={!canSubmitApplication}
              className={toolbarButtonClass}
            >
              <CheckCircle size={20} />
            </button>
            <button
              title="New Payment Application"
              onClick={startNewPaymentApplication}
              className={toolbarButtonClass}
            >
              <Plus size={22} />
            </button>
            <button
              title="Print"
              onClick={handlePrintPayment}
              className={toolbarButtonClass}
            >
              <Printer size={21} />
            </button>
            <button
              title="Reverse"
              onClick={handleOpenReversePayment}
              disabled={!canUseReverseAction}
              className={toolbarButtonClass}
            >
              <CornerUpLeft size={20} />
            </button>
          </div>

          {applicationGlHasMissingAccounts && plannedAppliedTotal > 0 && (
            <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Configure Customer Deposits and Accounts Receivable GL accounts before applying this payment.
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(420px,1fr)]">
              <section className="min-h-[354px] rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="mb-5 text-sm font-normal uppercase tracking-normal text-slate-800">Application Details</h3>
                <div className="grid grid-cols-1 gap-x-12 gap-y-5 md:grid-cols-2">
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Payment No.</span>
                    <span className={detailValueClass}>{editingPayment.paymentNo}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Payor Type</span>
                    <span className={detailValueClass}>{editingPayment.sponsorId ? 'Sponsor' : editingPayment.studentId ? 'Student' : 'Other'}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Post Period</span>
                    <span className={detailValueClass}>{formatPostPeriod(applicationDate)}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Payor Name</span>
                    <span className={detailValueClass}>{getPayorName(editingPayment)}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Payment Date</span>
                    <span className={detailValueClass}>{applicationDateLabel}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <label htmlFor="payment-application-cr-no" className={detailLabelClass}>C.R. No.</label>
                    <input
                      id="payment-application-cr-no"
                      value={formData.crNo}
                      onChange={e => setFormData(prev => ({ ...prev, crNo: e.target.value }))}
                      placeholder="Collection Receipt No."
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-normal text-slate-800 shadow-inner outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Payment Method</span>
                    <span className={detailValueClass}>{editingPayment.paymentMethod}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Status</span>
                    <div className={readonlyPillClass}>ON HOLD</div>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>Reference No.</span>
                    <span className={detailValueClass}>{editingPayment.refNo || '-'}</span>
                  </div>
                  <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4">
                    <span className={detailLabelClass}>GL Reference No.</span>
                    <div className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] font-normal text-slate-500 shadow-inner">
                      {applicationGlReference === '-' ? 'Generated when application is approved' : applicationGlReference}
                    </div>
                  </div>
                </div>
              </section>

              <section className="min-h-[354px] rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-4 text-sm font-normal uppercase tracking-normal text-slate-800">GL Journal Entry Preview</h3>
                <div className="overflow-hidden rounded-md border border-slate-100 shadow-sm">
                  <table className="w-full text-[13px]">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-[12px] font-normal uppercase text-slate-800">
                        <th className="px-3 py-3">GL Account</th>
                        <th className="px-3 py-3 text-right">Debit</th>
                        <th className="px-3 py-3 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayApplicationGlRows.map((row, index) => (
                        <tr key={index} className={`border-t border-slate-100 ${row.missing ? 'text-rose-700' : 'text-slate-800'}`}>
                          <td className="px-3 py-3 font-normal">{row.account}</td>
                          <td className="px-3 py-3 text-right font-normal">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                          <td className="px-3 py-3 text-right font-normal">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-slate-200 bg-white font-normal text-slate-800">
                        <td className="px-3 py-3">Total</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(plannedAppliedTotal)}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(plannedAppliedTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/80 p-4 text-[13px] text-emerald-800">
                  <div className="mb-2 font-normal">GL Entry Details</div>
                  <ul className="list-disc space-y-2 pl-5 font-normal">
                    <li>Journal Entry Date: {applicationDateLabel}</li>
                    <li>Reference: {applicationNoPreview}</li>
                    <li>Total Debit = Total Credit (balanced entry)</li>
                  </ul>
                </div>
              </section>
            </div>

            <section className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-normal uppercase tracking-normal text-slate-800">Invoice Applications</h3>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-[980px] w-full font-sans text-sm">
                  <thead className="bg-emerald-700">
                    <tr className="text-left text-sm font-normal text-white">
                      <th className="w-24 border-r border-emerald-500 px-4 py-3.5 text-center">Apply</th>
                      <th className="min-w-40 border-r border-emerald-500 px-4 py-3.5">Invoice No</th>
                      <th className="min-w-32 border-r border-emerald-500 px-4 py-3.5">Date</th>
                      <th className="min-w-32 border-r border-emerald-500 px-4 py-3.5">Post Period</th>
                      <th className="min-w-[280px] border-r border-emerald-500 px-4 py-3.5">Transaction Description</th>
                      <th className="min-w-36 border-r border-emerald-500 px-4 py-3.5 text-right">Amount Due</th>
                      <th className="min-w-40 px-4 py-3.5 text-right">Apply Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetchingOpenInvoices && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                          <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                          Fetching open invoices...
                        </td>
                      </tr>
                    )}
                    {!isFetchingOpenInvoices && openInvoicesForPayor.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                          <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                          No invoices for this payor.
                        </td>
                      </tr>
                    )}
                    {!isFetchingOpenInvoices && openInvoicesForPayor.map(inv => (
                      <tr key={inv.id} className="border-t border-slate-100 text-slate-800 hover:bg-slate-50">
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={!!invoiceSelectionMap[inv.id]}
                            onChange={e => handleInvoiceTick(inv, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="px-4 py-3.5 font-normal">{inv.invoiceNo}</td>
                        <td className="px-4 py-3.5 text-slate-600">{inv.invoiceDate ? format(new Date(inv.invoiceDate), 'MM-dd-yyyy') : '-'}</td>
                        <td className="px-4 py-3.5 text-slate-600">{formatPostPeriod(inv.invoiceDate) || '-'}</td>
                        <td className="px-4 py-3.5">
                          <input
                            type="text"
                            value={transactionDescriptions[inv.id] || `Payment application for invoice ${inv.invoiceNo}`}
                            onChange={e => setTransactionDescriptions(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            disabled={!invoiceSelectionMap[inv.id]}
                            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-inner outline-none transition-colors focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-right font-normal">{formatCurrency(inv.balanceDue)}</td>
                        <td className="px-4 py-3.5 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!invoiceSelectionMap[inv.id]}
                            max={Math.min(Math.max(Number(inv.balanceDue || 0), 0), availableToApply)}
                            value={invoiceApplyMap[inv.id] || ''}
                            onChange={e => {
                              const value = parseFloat(e.target.value) || 0;
                              setInvoiceApplyMap(prev => ({ ...prev, [inv.id]: Math.min(value, Math.max(Number(inv.balanceDue || 0), 0)) }));
                            }}
                            className="w-32 rounded-md border border-slate-200 bg-white px-3 py-2 text-right text-sm font-normal text-slate-800 shadow-inner outline-none transition-colors focus:border-emerald-500 disabled:bg-slate-50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-12 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-inner">
                <div className="flex justify-between text-sm">
                  <span className="font-normal text-slate-700">Total to Apply:</span>
                  <span className="font-normal text-slate-800">{formatCurrency(plannedAppliedTotal)}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ===== VIEW: PAYMENT DETAILS =====
  if (viewMode === 'payment-details' && editingPayment) {
    if (listTab === 'applications') {
      const activeApplications = getPaymentApplicationRecords(editingPayment);
      const primaryApplication = activeApplications[0];
      const primaryApplicationJournalEntry = primaryApplication ? getPaymentApplicationJournalEntry(primaryApplication) : undefined;
      const applicationDetailDate = (
        primaryApplicationJournalEntry?.date ||
        editingPayment.paymentDate ||
        primaryApplication?.createdAt ||
        editingPayment.updatedAt ||
        new Date().toISOString()
      ).split('T')[0];
      const applicationDetailNo = getPaymentApplicationNumberLabel(editingPayment);
      const applicationAppliedTotal = activeApplications.reduce((sum, app) => sum + Number(app.amountApplied || 0), 0);
      const applicationRemainingBalance = getAvailablePaymentBalance(editingPayment);
      const { customerDepositsAccount } = resolvePaymentGlAccounts();
      const applicationDetailGlRows = applicationAppliedTotal > 0
        ? [
          {
            account: getGlAccountLabel(customerDepositsAccount, 'Customer Deposits account not configured'),
            debit: applicationAppliedTotal,
            credit: 0,
            missing: !customerDepositsAccount
          },
          ...activeApplications.map(app => {
            const invoice = invoices.find(inv => inv.id === app.invoiceId);
            const arAccount = getReceivableAccountForInvoice(invoice);
            return {
              account: getGlAccountLabel(arAccount, `Accounts Receivable for ${invoice?.invoiceNo || app.invoiceId} not configured`),
              debit: 0,
              credit: Number(app.amountApplied || 0),
              missing: !arAccount
            };
          })
        ]
        : [];

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('list')}
              className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Back to Payments and Applications
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b bg-brand/10 p-4">
              <div>
                <h3 className="text-xl text-gray-800">
                  Payment Application : {applicationDetailNo}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Payment <span className="font-semibold text-gray-900">{editingPayment.paymentNo}</span> for <span className="font-semibold text-gray-900">{getPayorName(editingPayment)}</span>
                </p>
              </div>
            </div>

            {renderPaymentDocumentActions()}
            {primaryApplicationJournalEntry?.id && onViewJournal && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2">
                <button
                  title="View Journal Entry"
                  onClick={() => onViewJournal(primaryApplicationJournalEntry.id)}
                  className={`${iconActionClass} hover:text-emerald-500 hover:bg-emerald-50`}
                >
                  <FileText size={20} />
                </button>
              </div>
            )}

            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="space-y-4 xl:col-span-8">
                  <div className="rounded-xl border bg-white p-4">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Application Information</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className={invoiceLabelClass}>Payment Application No.</label>
                        <input value={applicationDetailNo} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Post Period</label>
                        <input value={formatPostPeriod(applicationDetailDate)} readOnly className={invoicePostPeriodClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Application Date</label>
                        <div className="relative mt-1">
                          <Calendar size={14} className="pointer-events-none absolute right-3 top-2.5 text-gray-400" />
                          <input type="date" value={applicationDetailDate} readOnly className={invoiceReadOnlyClass} />
                        </div>
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Status</label>
                        <div className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50">
                          <span className="text-[13px] font-medium text-gray-700">
                            {getDisplayStatusLabel(getApplicationRegistryStatus(editingPayment))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className={invoiceLabelClass}>Payment No.</label>
                        <input value={editingPayment.paymentNo} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>C.R. No.</label>
                        <input value={editingPayment.crNo || '-'} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Payor Type</label>
                        <input value={editingPayment.sponsorId ? 'Sponsor' : editingPayment.studentId ? 'Student' : 'Other'} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Payment Method</label>
                        <input value={editingPayment.paymentMethod} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={invoiceLabelClass}>Payor Name</label>
                        <input value={getPayorName(editingPayment)} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div className="md:col-span-2">
                        <label className={invoiceLabelClass}>GL Reference No.</label>
                        <div className={`${invoiceReadOnlyClass} flex min-h-[38px] items-center`}>
                          {renderPaymentApplicationGlReferences(editingPayment, 'text-[13px] font-medium')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-4">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Payment Details</h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className={invoiceLabelClass}>Amount Received</label>
                        <input value={formatInputCurrency(editingPayment.amountReceived)} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>EWT Amount Certified</label>
                        <input value={formatInputCurrency(editingPayment.ewtAmountCertified)} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Amount Applied</label>
                        <input value={formatInputCurrency(applicationAppliedTotal)} readOnly className={invoiceReadOnlyClass} />
                      </div>
                      <div>
                        <label className={invoiceLabelClass}>Unapplied Balance</label>
                        <input value={formatInputCurrency(applicationRemainingBalance)} readOnly className={invoicePostPeriodClass} />
                      </div>
                      <div className="md:col-span-4">
                        <label className={invoiceLabelClass}>Transaction Description</label>
                        <input value={editingPayment.notes || '-'} readOnly className={invoiceReadOnlyClass} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-4">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600">Invoice Applications</h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-emerald-600">
                          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-white">
                            <th className="px-4 py-3">Invoice Number</th>
                            <th className="px-4 py-3">Application No.</th>
                            <th className="px-4 py-3">GL Reference No.</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-right">Applied Amount</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {activeApplications.map(app => {
                            const invoice = invoices.find(i => i.id === app.invoiceId);
                            return (
                              <tr key={app.id} className="text-gray-700 hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs font-medium">{invoice?.invoiceNo || app.invoiceId}</td>
                                <td className="px-4 py-3 text-xs font-medium">{getPaymentApplicationNo(app)}</td>
                                <td className="px-4 py-3 text-xs font-medium">
                                  {renderPaymentApplicationGlReference(app, 'text-xs font-medium')}
                                </td>
                                <td className="px-4 py-3 text-xs">{app.description || '-'}</td>
                                <td className="px-4 py-3 text-center text-xs font-semibold">{getApplicationStatusLabel(editingPayment, app)}</td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(app.amountApplied)}</td>
                                <td className="px-4 py-3 text-right">
                                  {app.isReversed ? (
                                    <span className="text-xs font-semibold text-gray-400">Reversed</span>
                                  ) : onReverseApplication ? (
                                    <button
                                      type="button"
                                      onClick={() => openReverseApplicationModal(editingPayment, app)}
                                      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                    >
                                      <RotateCcw size={12} />
                                      Reverse
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 xl:col-span-4">
                  <div className="rounded-xl border bg-white p-4">
                    <h3 className={previewSectionTitleClass}>
                      GL Journal Entry Preview
                    </h3>

                    {applicationDetailGlRows.length === 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        No active invoice applications are available to preview.
                      </div>
                    ) : (
                      <>
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                              <th className="pb-2">GL Account</th>
                              <th className="pb-2 text-right">Debit</th>
                              <th className="pb-2 text-right">Credit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {applicationDetailGlRows.map((row, index) => (
                              <tr key={index} className={`border-t ${row.missing ? 'text-rose-700' : 'text-gray-700'}`}>
                                <td className="py-2 text-[11px] font-medium">{row.account}</td>
                                <td className="py-2 text-right text-[11px] font-medium">{row.debit ? formatCurrency(row.debit) : '-'}</td>
                                <td className="py-2 text-right text-[11px] font-medium">{row.credit ? formatCurrency(row.credit) : '-'}</td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-300 font-bold text-gray-700">
                              <td className="py-3 text-[11px]">Total</td>
                              <td className="py-3 text-right text-[11px]">{formatCurrency(applicationAppliedTotal)}</td>
                              <td className="py-3 text-right text-[11px]">{formatCurrency(applicationAppliedTotal)}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-700">
                          <div className="mb-2 font-semibold">GL Entry Details</div>
                          <ul className="list-disc space-y-1 pl-4 text-[11px] font-medium">
                            <li>Journal Entry Date: {new Date(applicationDetailDate).toLocaleDateString()}</li>
                            <li>Reference: {applicationDetailNo}</li>
                            <li>Debit Customer Deposits and credit Accounts Receivable</li>
                            <li>Total Debit = Total Credit (balanced entry)</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-xl border bg-white p-4">
                    <h3 className={previewSectionTitleClass}>
                      Application Preview
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className={previewLabelClass}>Applications</div>
                        <div className={previewValueClass}>{activeApplications.length}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className={previewLabelClass}>Invoices</div>
                        <div className={previewValueClass}>{getPaymentApplicationInvoiceLabel(editingPayment)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className={previewLabelClass}>Applied</div>
                        <div className={previewValueClass}>{formatCurrency(applicationAppliedTotal)}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className={previewLabelClass}>Balance</div>
                        <div className="mt-1 text-[13px] font-semibold text-gray-700">{formatCurrency(applicationRemainingBalance)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const glLines = calculatePaymentGlLines();

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} />
            Back to Payment Register
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ backgroundColor: `${brandColor}10` }}>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{editingPayment.paymentNo}</h2>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(editingPayment.paymentDate).toLocaleDateString()} â€¢ {getPayorName(editingPayment)}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Payment Status</div>
                <div className="mt-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    editingPayment.status === 'OPEN' || editingPayment.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                    editingPayment.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {editingPayment.status === 'DRAFT' ? 'On Hold' : editingPayment.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {renderPaymentDocumentActions()}

          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Details */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Payment Details</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payment Number:</dt>
                    <dd className="text-sm font-semibold text-gray-900">{editingPayment.paymentNo}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payment Date:</dt>
                    <dd className="text-sm text-gray-900">{new Date(editingPayment.paymentDate).toLocaleDateString()}</dd>
                  </div>
                  {editingPayment.crNo && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">C.R. No.:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.crNo}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payor:</dt>
                    <dd className="text-sm text-gray-900">{getPayorName(editingPayment)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">Payment Method:</dt>
                    <dd className="text-sm text-gray-900">{editingPayment.paymentMethod}</dd>
                  </div>
                  {editingPayment.refNo && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Reference No.:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.refNo}</dd>
                    </div>
                  )}
                  {editingPayment.checkNumber && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Check Number:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.checkNumber}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Amount Summary */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Amount Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount Received:</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(editingPayment.amountReceived)}</span>
                  </div>
                  {editingPayment.ewtAmountCertified > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">EWT Amount Certified:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(editingPayment.ewtAmountCertified)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold text-gray-700">Total Received:</span>
                    <span className="font-bold text-lg" style={{ color: brandColor }}>
                      {formatCurrency(editingPayment.amountReceived + editingPayment.ewtAmountCertified)}
                    </span>
                  </div>
                  <div className="pt-3 flex justify-between">
                    <span className="text-sm text-gray-600">Amount Applied:</span>
                    <span className="text-sm font-semibold text-emerald-700">{formatCurrency(editingPayment.totalApplied)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Unapplied Balance:</span>
                    <span className="text-sm font-semibold text-sky-700">{formatCurrency(editingPayment.customerDepositBalance)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GL Entry Details */}
            {(editingPayment.status === 'OPEN' || editingPayment.status === 'POSTED') && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">GL Entry Details</h3>
                <div className="rounded-lg border bg-gray-50 p-4 space-y-3 mb-4">
                  <div className="flex justify-between">
                    <dt className="text-sm font-medium text-gray-600">GL Entry Number:</dt>
                    <dd className="text-sm font-semibold text-blue-600">
                      {editingPayment.glEntryNumber || 'â€”'}
                    </dd>
                  </div>
                  {editingPayment.postedAt && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Posted Date:</dt>
                      <dd className="text-sm text-gray-900">{new Date(editingPayment.postedAt).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {editingPayment.postedBy && (
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-600">Posted By:</dt>
                      <dd className="text-sm text-gray-900">{editingPayment.postedBy}</dd>
                    </div>
                  )}
                </div>

                {/* GL Journal Lines */}
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr className="text-left text-xs uppercase font-semibold text-gray-600">
                        <th className="px-4 py-2">GL Account</th>
                        <th className="px-4 py-2 text-right">Debit</th>
                        <th className="px-4 py-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {glLines.map((line, index) => (
                        <tr key={index} className="border-t text-gray-700 hover:bg-gray-50">
                          <td className="px-4 py-2 text-xs">{line.account?.code || 'â€”'} - {line.account?.name || 'Unknown'}</td>
                          <td className="px-4 py-2 text-right font-medium text-blue-600">{line.debit ? formatCurrency(line.debit) : '-'}</td>
                          <td className="px-4 py-2 text-right font-medium text-green-600">{line.credit ? formatCurrency(line.credit) : '-'}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-gray-300 font-bold text-gray-800">
                        <td className="px-4 py-2 text-xs">Total</td>
                        <td className="px-4 py-2 text-right text-blue-600">{formatCurrency(editingPayment.amountReceived + editingPayment.ewtAmountCertified)}</td>
                        <td className="px-4 py-2 text-right text-green-600">{formatCurrency(editingPayment.amountReceived + editingPayment.ewtAmountCertified)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {editingPayment.journalEntryId && onViewJournal && (
                  <button
                    onClick={() => onViewJournal(editingPayment.journalEntryId!)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: brandColor }}
                  >
                    <ArrowRight size={16} />
                    View Full GL Entry
                  </button>
                )}
              </div>
            )}

            {/* Payment Applications */}
            {editingPayment.applications && editingPayment.applications.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Invoice Applications</h3>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr className="text-left text-xs uppercase font-semibold text-gray-600">
                        <th className="px-4 py-2">Invoice Number</th>
                        <th className="px-4 py-2">Application No.</th>
                        <th className="px-4 py-2">GL Reference No.</th>
                        <th className="px-4 py-2">Description</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-right">Applied Amount</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingPayment.applications.map((app, index) => {
                        const invoice = invoices.find(i => i.id === app.invoiceId);
                        return (
                          <tr key={index} className="border-t text-gray-700 hover:bg-gray-50">
                            <td className="px-4 py-2 text-xs font-medium">{invoice?.invoiceNo || app.invoiceId}</td>
                            <td className="px-4 py-2 text-xs font-medium">{getPaymentApplicationNo(app)}</td>
                            <td className="px-4 py-2 text-xs font-medium">
                              {renderPaymentApplicationGlReference(app, 'text-xs font-medium')}
                            </td>
                            <td className="px-4 py-2 text-xs">{app.description || '-'}</td>
                            <td className="px-4 py-2 text-center text-xs font-semibold">{getApplicationStatusLabel(editingPayment, app)}</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-700">{formatCurrency(app.amountApplied)}</td>
                            <td className="px-4 py-2 text-right">
                              {app.isReversed ? (
                                <span className="text-xs font-semibold text-gray-400">Reversed</span>
                              ) : onReverseApplication ? (
                                <button
                                  type="button"
                                  onClick={() => openReverseApplicationModal(editingPayment, app)}
                                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                                >
                                  <RotateCcw size={12} />
                                  Reverse
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transaction Description */}
            {editingPayment.notes && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 mb-4">Transaction Description</h3>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-4">{editingPayment.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentsView;

