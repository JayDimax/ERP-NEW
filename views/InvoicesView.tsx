import React, { useState, useMemo, useEffect } from 'react';
import { Invoice, InvoiceLine, InvoiceStatus, Sponsor, Student, Enrollment, AssessmentRegistration, Batch, Qualification, CourseFee, ChartOfAccount, AccountClass, StudentLedger, JournalEntry, TaxCategoryEntry, Organization, User as AppUser, Payment, isProvisionalStudent } from '../types';
import { format } from 'date-fns';
import { generateUUID } from '../utils/uuid';
import { calculateInvoiceDueDate, todayISO } from '../utils/invoiceTerms';
import { BillingComputationService } from '../services/BillingComputationService';
import { DataServiceFactory } from '../services/DataServiceFactory';
import type { PageFilter, PageOrder } from '../services/IDataService';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import {
  FileText, Plus, Search, Filter, X, Save, Trash2, Edit3, Eye,
  Building2, User, Calendar, DollarSign, Percent, CheckCircle,
  XCircle, AlertTriangle, AlertCircle, Receipt, Download, Printer,
  RotateCcw, MoreHorizontal, Scissors, CornerUpLeft,
  ChevronDown, ChevronUp, MoreVertical, Ban, Wand2, Users,
  GraduationCap, CheckSquare, Square, Calculator, FileSpreadsheet, ArrowUpDown,
  BookText
} from 'lucide-react';



interface InvoicesViewProps {
  documentMode?: 'INVOICE' | 'NON_INVOICE_PAYMENT';
  invoices: Invoice[];
  payments?: Payment[];
  sponsors: Sponsor[];
  students: Student[];
  users: AppUser[];
  enrollments: Enrollment[];
  assessmentRegistrations: AssessmentRegistration[];
  batches: Batch[];
  qualifications: Qualification[];
  courseFees: CourseFee[];
  accounts: ChartOfAccount[];
  currency: string;
  isVatRegistered?: boolean;
  onAddInvoice: (invoice: Invoice) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => Promise<boolean>;
  onPostInvoice?: (invoice: Invoice) => void;
  onVoidInvoice?: (id: string, reason: string) => void;
  onUpdateEnrollment?: (enrollment: Enrollment) => void; // For updating billing status after invoice generation
  onUpdateAssessmentRegistration?: (registration: AssessmentRegistration) => void;
  journalEntries?: JournalEntry[];
  onAddStudentLedgerEntry?: (entry: StudentLedger) => void; // For AR subsidiary ledger
  onViewJournal?: (journalEntryId: string, sourceLines?: InvoiceLine[]) => void;
  organization?: Organization;
  orgId: string;
  taxCategories: TaxCategoryEntry[];
  onNavigate?: (tab: string, context?: any) => void;
  onAddStudent?: (student: Student) => Promise<Student> | void;
}

const getStudentOptionLabel = (student: Student) =>
  `${student.lastName}, ${student.firstName}${isProvisionalStudent(student) ? ' (Provisional)' : ''}`;

const compareStudentsByName = (left: Student, right: Student) => {
  const lastNameComparison = String(left.lastName || '').localeCompare(String(right.lastName || ''), undefined, { sensitivity: 'base' });
  if (lastNameComparison !== 0) return lastNameComparison;

  return String(left.firstName || '').localeCompare(String(right.firstName || ''), undefined, { sensitivity: 'base' });
};

const SearchableStudentSelect: React.FC<{
  students: Student[];
  value: string;
  onChange: (studentId: string) => void;
  onQuickAdd?: (initialQuery: string) => void;
  disabled?: boolean;
}> = ({ students, value, onChange, disabled = false, onQuickAdd }) => {
  const selectedStudent = students.find(student => student.id === value);
  const [query, setQuery] = useState(selectedStudent ? getStudentOptionLabel(selectedStudent) : '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedStudent ? getStudentOptionLabel(selectedStudent) : '');
  }, [selectedStudent?.id, selectedStudent?.firstName, selectedStudent?.middleName, selectedStudent?.lastName]);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = [...students]
      .filter(student => !normalizedQuery || !!selectedStudent || [
        student.lastName,
        student.firstName,
        student.middleName,
        student.uli,
        student.email,
      ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)))
      .sort((left, right) => {
        if (normalizedQuery && !selectedStudent) {
          const leftMatchesName = [left.lastName, left.firstName, left.middleName]
            .some(value => String(value || '').toLowerCase().includes(normalizedQuery));
          const rightMatchesName = [right.lastName, right.firstName, right.middleName]
            .some(value => String(value || '').toLowerCase().includes(normalizedQuery));

          if (leftMatchesName !== rightMatchesName) return leftMatchesName ? -1 : 1;
        }

        return compareStudentsByName(left, right);
      });

    return matches.slice(0, 60);
  }, [query, selectedStudent, students]);

  const selectStudent = (student: Student) => {
    onChange(student.id);
    setQuery(getStudentOptionLabel(student));
    setIsOpen(false);
    setActiveIndex(0);
  };

  return (
    <div
      ref={containerRef}
      className="relative mt-1"
      onBlur={event => {
        if (!containerRef.current?.contains(event.relatedTarget as Node)) setIsOpen(false);
      }}
    >
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="invoice-student-options"
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          placeholder="Search learner by name, ULI, or email..."
          className="w-full rounded-lg border py-2 pl-9 pr-9 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60"
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
              setActiveIndex(index => Math.min(index + 1, Math.max(0, filteredStudents.length - 1)));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(index => Math.max(0, index - 1));
            } else if (event.key === 'Enter' && isOpen && filteredStudents[activeIndex]) {
              event.preventDefault();
              selectStudent(filteredStudents[activeIndex]);
            } else if (event.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />
        {(query || value) && !disabled && (
          <button
            type="button"
            aria-label="Clear selected student"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(true);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {isOpen && !disabled && (
        <div id="invoice-student-options" role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
          {filteredStudents.length > 0 ? filteredStudents.map((student, index) => (
            <button
              type="button"
              role="option"
              aria-selected={student.id === value}
              key={student.id}
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectStudent(student)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-orange-50 text-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              <span className="truncate font-medium">{getStudentOptionLabel(student)}</span>
              {isProvisionalStudent(student) && (
                <span className="ml-2 shrink-0 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  Provisional
                </span>
              )}
            </button>
          )) : (
            <div className="p-3 text-center">
              <p className="text-sm text-gray-500 mb-2">No learners match "{query}".</p>
              {onQuickAdd && (
                <button
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => {
                    setIsOpen(false);
                    onQuickAdd(query);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-hover rounded shadow-xs transition-colors"
                >
                  <Plus size={13} />
                  <span>Bill as unregistered learner</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

const getCourseFeeOptionLabel = (fee: CourseFee) =>
  `${fee.feeName}${fee.feeCode ? ` - ${fee.feeCode}` : ''}`;

const SearchableCourseFeeSelect: React.FC<{
  fees: CourseFee[];
  value: string;
  onChange: (courseFeeId: string) => void;
  disabled?: boolean;
  listId?: string;
}> = ({ fees, value, onChange, disabled = false }) => {
  const selectedFee = fees.find(fee => fee.id === value);
  const [query, setQuery] = useState(selectedFee ? getCourseFeeOptionLabel(selectedFee) : '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selectedFee ? getCourseFeeOptionLabel(selectedFee) : '');
  }, [selectedFee?.id, selectedFee?.feeCode, selectedFee?.feeName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFees = useMemo(() => {
    if (!query.trim() || (selectedFee && query === getCourseFeeOptionLabel(selectedFee))) {
      return fees;
    }
    const q = query.toLowerCase();
    return fees.filter(f =>
      (f.feeName || '').toLowerCase().includes(q) ||
      (f.feeCode || '').toLowerCase().includes(q)
    );
  }, [fees, query, selectedFee]);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Search course fee by name or code"
          placeholder="Search code or fee..."
          value={query}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) onChange('');
          }}
          className="w-full rounded px-2.5 py-1 pr-7 text-[13px] font-normal text-gray-700 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
        />
        {selectedFee && !disabled && (
          <button
            type="button"
            aria-label="Clear selected course fee"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {isOpen && !disabled && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-48 w-full min-w-[240px] overflow-auto rounded-md border border-gray-200 bg-white shadow-lg py-1 text-xs"
        >
          {filteredFees.map(fee => (
            <button
              key={fee.id}
              type="button"
              role="option"
              aria-selected={fee.id === value}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange(fee.id);
                setQuery(getCourseFeeOptionLabel(fee));
                setIsOpen(false);
              }}
              className="flex w-full items-center px-3 py-1.5 text-left text-gray-700 hover:bg-orange-50 hover:text-orange-900"
            >
              {getCourseFeeOptionLabel(fee)}
            </button>
          ))}
          {filteredFees.length === 0 && (
            <div className="px-3 py-2 text-gray-400 text-center">No fees found</div>
          )}
        </div>
      )}
    </div>
  );
};

const INVOICE_PAGE_SIZE = 7;
const INVOICE_COLUMNS = 'id,org_id,invoice_no,document_type,payment_method,si_no,sponsor_id,student_id,enrollment_id,batch_id,invoice_date,due_date,status,subtotal,vat_amount,grand_total,total_ewt_amount,net_amount_due,amount_paid,balance_due,ewt_rate,is_subject_to_ewt,reference,terms,notes,journal_entry_id,posted_by,posted_at,voided_by,voided_at,void_reason,is_deleted,deleted_at,deleted_by,created_at,created_by,updated_at,updated_by,vat_pricing,vat_rate,gl_entry_number,assessment_registration_id';

const COURSE_FEE_CATEGORY_LABELS: Record<string, string> = {
  TUITION: 'Tuition',
  REGISTRATION: 'Registration',
  CERTIFICATION: 'Certification Fee',
  ASSESSMENT: 'Assessment Fee',
  MATERIALS: 'Materials',
  MISCELLANEOUS: 'Miscellaneous',
};

const getCourseFeeDescription = (fee?: CourseFee | null): string =>
  fee ? COURSE_FEE_CATEGORY_LABELS[String(fee.category || '').toUpperCase()] || fee.feeName : '';

const CurrencyLineInput: React.FC<{
  value?: number;
  disabled?: boolean;
  ariaLabel?: string;
  onValueChange: (value: number) => void;
}> = ({ value = 0, disabled, ariaLabel, onValueChange }) => {
  const formatValue = (amount: number) =>
    new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState(formatValue(value));

  useEffect(() => {
    if (!isFocused) setDraft(formatValue(value));
  }, [value, isFocused]);

  return (
    <input
      aria-label={ariaLabel}
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
      className="w-full px-2 py-1 rounded text-right text-[13px] font-normal text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
    />
  );
};

const InvoicesView: React.FC<InvoicesViewProps> = ({
  documentMode = 'INVOICE',
  invoices, payments = [], sponsors = [], students = [], users = [], currentUser = null, enrollments = [], assessmentRegistrations = [], batches = [], qualifications = [], courseFees = [], accounts = [], currency = 'PHP', isVatRegistered,
  onAddInvoice, onUpdateInvoice, onDeleteInvoice, onPostInvoice, onVoidInvoice, onUpdateEnrollment, onUpdateAssessmentRegistration, onAddStudentLedgerEntry,
  onViewJournal,
  journalEntries = [],
  organization,
  orgId,
  taxCategories,
  onNavigate,
  onAddStudent
}) => {
  const isNonInvoicePayment = documentMode === 'NON_INVOICE_PAYMENT';
  const documentLabel = isNonInvoicePayment ? 'Non-Invoice Payment' : 'Invoice';
  const documentLabelPlural = isNonInvoicePayment ? 'Non-Invoice Payments' : 'Invoices';
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM'>('LIST');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false); // Generate from enrollments wizard
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterMode, setDateFilterMode] = useState<'ALL' | 'TODAY' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | 'none' }>({ key: 'invoiceDate', direction: 'desc' });
  const [filterSponsorId, setFilterSponsorId] = useState('ALL');
  const [filterStudentId, setFilterStudentId] = useState('ALL');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());


  // Drag-and-drop column ordering state (registry table)
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'invoiceDate', 'postPeriod', 'invoiceNo', 'status', 'glReference', 'payer', 'totalAmount', 'balance', 'createdBy', 'createdOn'
  ]);
  const [draggedColumnIdx, setDraggedColumnIdx] = useState<number | null>(null);

  // Column resize state (registry table)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // --- Line Items Table Drag/Resize/Order State ---
  const [draggedLineIdx, setDraggedLineIdx] = useState<number | null>(null);
  const [lineDropIdx, setLineDropIdx] = useState<number | null>(null);
  const [lineColWidths, setLineColWidths] = useState<Record<string, number>>({});
  const lineResizeRef = React.useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);

  // Column order and drag state for line items table
  // Default: #, Type, Course Fee, Description, Tax Category, Class, Qty, Unit Price, Amount, Actions
  const defaultLineColOrder = [
    'lineNumber', 'lineType', 'courseFeeId', 'description', 'taxCategoryId', 'classificationCode', 'quantity', 'unitPrice', 'amount', 'actions'
  ];
  const [lineColOrder, setLineColOrder] = useState<string[]>(defaultLineColOrder);
  const [draggedLineColIdx, setDraggedLineColIdx] = useState<number | null>(null);

  // local copy of tax categories; we fetch from backend when form is active
  const [localTaxCats, setLocalTaxCats] = useState<TaxCategoryEntry[]>(taxCategories);
  const [backendBatchEnrolledQty, setBackendBatchEnrolledQty] = useState<Record<string, number>>({});

  // Sponsor/Student (Payer) Custom Filter State
  const [showPayerDropdown, setShowPayerDropdown] = useState(false);
  const [payerFilterMode, setPayerFilterMode] = useState<'ALL' | 'CUSTOM'>('ALL');
  const [payerSearchTerm, setPayerSearchTerm] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [serverInvoices, setServerInvoices] = useState<Invoice[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverCurrentPage, setServerCurrentPage] = useState(1);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageLoadError, setPageLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [creatorNameMap, setCreatorNameMap] = useState<Record<string, string>>({});

  // Quick Unregistered Student Billing State
  const [showQuickStudentModal, setShowQuickStudentModal] = useState(false);
  const [quickStudentFirstName, setQuickStudentFirstName] = useState('');
  const [quickStudentLastName, setQuickStudentLastName] = useState('');
  const [quickStudentMiddleName, setQuickStudentMiddleName] = useState('');
  const [quickStudentContact, setQuickStudentContact] = useState('');
  const [quickStudentEmail, setQuickStudentEmail] = useState('');
  const [quickStudentError, setQuickStudentError] = useState<string | null>(null);
  const [isSavingQuickStudent, setIsSavingQuickStudent] = useState(false);

  const handleOpenQuickStudent = (initialQuery = '') => {
    setQuickStudentError(null);
    const trimmed = initialQuery.trim();
    if (trimmed.includes(',')) {
      const [last, first] = trimmed.split(',').map(s => s.trim());
      setQuickStudentLastName(last || '');
      setQuickStudentFirstName(first || '');
    } else if (trimmed.includes(' ')) {
      const parts = trimmed.split(/\s+/);
      setQuickStudentFirstName(parts[0] || '');
      setQuickStudentLastName(parts.slice(1).join(' ') || '');
    } else {
      setQuickStudentFirstName(trimmed);
      setQuickStudentLastName('');
    }
    setQuickStudentMiddleName('');
    setQuickStudentContact('');
    setQuickStudentEmail('');
    setShowQuickStudentModal(true);
  };

  const handleCreateQuickStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickStudentFirstName.trim() || !quickStudentLastName.trim()) {
      setQuickStudentError('First name and last name are required.');
      return;
    }
    setQuickStudentError(null);
    setIsSavingQuickStudent(true);
    try {
      const newStudent: Student = {
        id: `stud-${Date.now()}`,
        orgId: orgId || organization?.id || '',
        firstName: quickStudentFirstName.trim(),
        lastName: quickStudentLastName.trim(),
        middleName: quickStudentMiddleName.trim() || undefined,
        contactNumber: quickStudentContact.trim() || undefined,
        email: quickStudentEmail.trim() || undefined,
        registrationStatus: 'PROVISIONAL',
        documents: [{
          id: `doc-provisional-${Date.now()}`,
          name: 'Provisional AR Registration',
          status: 'PENDING'
        }],
        createdAt: new Date().toISOString()
      };
      let createdStudent = newStudent;
      if (onAddStudent) {
        const res = await onAddStudent(newStudent);
        if (res && res.id) createdStudent = res;
      }
      setFormData(prev => ({
        ...prev,
        studentId: createdStudent.id,
        sponsorId: '',
        assessmentRegistrationId: prev.assessmentRegistrationId && createdStudent.id ? prev.assessmentRegistrationId : ''
      }));
      setShowQuickStudentModal(false);
      setQuickStudentFirstName('');
      setQuickStudentLastName('');
      setQuickStudentMiddleName('');
      setQuickStudentContact('');
      setQuickStudentEmail('');
    } catch (err) {
      setQuickStudentError(err instanceof Error ? err.message : 'Failed to create provisional student.');
    } finally {
      setIsSavingQuickStudent(false);
    }
  };


  // Derived: Students in the batch for annex (scoped strictly to invoice sponsor/student recipient)
  const batchStudents = React.useMemo(() => {
    if (!showViewModal || !viewingInvoice?.batchId) return [];
    const batch = batches.find(b => b.id === viewingInvoice.batchId);
    const batchEnrollments = enrollments.filter(e => {
      if (e.batchId !== viewingInvoice.batchId || e.isDeleted) return false;
      if (viewingInvoice.sponsorId) {
        const enrSponsorId = e.sponsorId || batch?.sponsorId || '';
        return enrSponsorId === viewingInvoice.sponsorId;
      }
      if (viewingInvoice.studentId) {
        return e.studentId === viewingInvoice.studentId;
      }
      return true;
    });
    return batchEnrollments.map(e => {
      const student = students.find(s => s.id === e.studentId);
      return student ? {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        studentNo: student.studentNo || student.id,
        courseName: qualifications.find(q => q.id === student.qualificationId)?.name || '',
      } : null;
    }).filter(Boolean);
  }, [showViewModal, viewingInvoice, enrollments, students, qualifications, batches]);

  // Generate from Enrollments state
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('');
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set());
  const [generateInvoiceDate, setGenerateInvoiceDate] = useState<string>(todayISO());
  const [generateDueDate, setGenerateDueDate] = useState<string>(calculateInvoiceDueDate(todayISO(), 'Net 30'));

  // Form state
  const [formData, setFormData] = useState<{
    invoiceNo: string;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'EWALLET';
    siNo: string;
    sponsorId: string;
    studentId: string;
    enrollmentId: string;
    assessmentRegistrationId: string;
    batchId: string;
    invoiceDate: string;
    dueDate: string;
    status: InvoiceStatus;
    reference?: string;
    terms?: string;
    notes: string;
    vatPricing: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT';
    vatRate: number;
    glEntryNumber?: string;
    lines: InvoiceLine[];
  }>({
    invoiceNo: '',
    paymentMethod: 'CASH',
    siNo: '',
    sponsorId: '',
    studentId: '',
    enrollmentId: '',
    assessmentRegistrationId: '',
    batchId: '',
    invoiceDate: todayISO(),
    dueDate: calculateInvoiceDueDate(todayISO(), 'Net 30'),
    status: 'ON_HOLD',
    reference: '',
    terms: 'Net 30',
    notes: '',
    vatPricing: 'INCLUSIVE',
    vatRate: 0.12,
    glEntryNumber: '',
    lines: []
  });

const brandColor = organization?.primaryColor || '#059669';

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (brandColor && brandColor !== '#059669') {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);
  const isPaidInvoice = (invoice?: Pick<Invoice, 'status' | 'balanceDue'> | null) =>
    !!invoice && (invoice.status === 'CLOSED' || Number(invoice.balanceDue ?? 0) <= 0);
  const resolvedViewingInvoice = React.useMemo(
    () => (viewingInvoice ? invoices.find(i => i.id === viewingInvoice.id) || viewingInvoice : null),
    [viewingInvoice, invoices]
  );
  const resolvedPrintingInvoice = React.useMemo(
    () => (printingInvoice ? invoices.find(i => i.id === printingInvoice.id) || printingInvoice : null),
    [printingInvoice, invoices]
  );

  const isInvoicePosted = (invoice?: Pick<Invoice, 'status' | 'journalEntryId' | 'postedAt' | 'glEntryNumber'> | null) =>
    !!invoice && (
      invoice.status === 'OPEN' ||
      !!invoice.journalEntryId ||
      !!invoice.postedAt ||
      !!String(invoice.glEntryNumber || '').trim()
    );

  // Check if form should be read-only (posted invoices are locked)
  const isReadOnly = isInvoicePosted(editingInvoice);
  const isMissingInvoiceTaxCategory = (value?: string | null) => {
    const normalized = String(value || '').trim();
    return !normalized || normalized.toLowerCase() === 'none';
  };
  const invoicePrintAccent = '#006b2d';
  const signatoryLabels = ['PREPARED BY:', 'REVIEWED BY:', 'APPROVED BY:'];

  const validateInvoiceRequiredFields = (invoiceDraft: Pick<Invoice, 'notes' | 'lines'> | null | undefined) => {
    const missingFields: string[] = [];
    if (!String(invoiceDraft?.notes || '').trim()) {
      missingFields.push('Transaction Description');
    }
    if ((invoiceDraft?.lines || []).some(line => isMissingInvoiceTaxCategory(line.taxCategoryId))) {
      missingFields.push('Tax Category');
    }
    return missingFields;
  };

  const getLineType = (line: InvoiceLine) =>
    String((line as any).lineType || (line.courseFeeId ? 'COURSE_FEE' : 'MANUAL')).toUpperCase();

  const validateInvoiceLineRules = (invoiceDraft: Pick<Invoice, 'lines' | 'grandTotal'> | { lines?: InvoiceLine[] } | null | undefined) => {
    const lines = invoiceDraft?.lines || [];
    const issues: string[] = [];
    lines.forEach((line, index) => {
      const lineType = getLineType(line);
      if (lineType === 'DISCOUNT' && Number(line.amount || 0) > 0) {
        issues.push(`Line ${index + 1}: Discount lines must be zero or negative.`);
      }
    });
    const totals = calculateTotals(lines);
    if (totals.grandTotal < -0.01) {
      issues.push('Final invoice total cannot be negative.');
    }
    return issues;
  };

  const invoiceRequiredFieldIssues = validateInvoiceRequiredFields(formData);
  const canSubmitInvoice = invoiceRequiredFieldIssues.length === 0;
  const invoiceRequiredFieldMessage = invoiceRequiredFieldIssues.length > 0
    ? (
        invoiceRequiredFieldIssues.length === 2
          ? 'Transaction Description and Tax Category for every line item are required before saving or approving the invoice.'
          : invoiceRequiredFieldIssues[0] === 'Tax Category'
            ? 'Tax Category must be selected for every line item before saving or approving the invoice.'
            : 'Transaction Description is required before saving or approving the invoice.'
      )
    : '';
  const getLinkedSavedPayment = (invoice?: Pick<Invoice, 'id'> | null) => {
    if (!invoice?.id) return null;
    return payments.find(payment =>
      !payment.isDeleted &&
      payment.status !== 'VOIDED' &&
      payment.sourceInvoiceId === invoice.id
    ) || null;
  };

  const hasActivePaymentApplication = (invoice?: Pick<Invoice, 'id'> | null) => {
    if (!invoice?.id) return false;
    return payments.some(payment =>
      !payment.isDeleted &&
      payment.status !== 'VOIDED' &&
      (payment.applications || []).some(app => app.invoiceId === invoice.id && !app.isReversed)
    );
  };

  const linkedSavedPayment = editingInvoice ? getLinkedSavedPayment(editingInvoice) : null;
  const hasInvoiceApplication = editingInvoice ? hasActivePaymentApplication(editingInvoice) : false;
  const canPayInvoice =
    !!editingInvoice &&
    editingInvoice.status === 'OPEN' &&
    !isPaidInvoice(editingInvoice) &&
    !linkedSavedPayment &&
    !hasInvoiceApplication;
  const payButtonTitle = linkedSavedPayment
    ? `Payment ${linkedSavedPayment.paymentNo} is already saved for this invoice`
    : hasInvoiceApplication
      ? 'This invoice already has a payment application'
      : 'Pay';
  const canUseInvoiceActions = editingInvoice?.status === 'OPEN';
  const invoiceActionUnavailableTitle = editingInvoice
    ? 'Only open invoices can use this action.'
    : 'Save and approve the invoice before using this action.';

  // Generate next invoice number
  const generateInvoiceNo = () => {
    const year = new Date().getFullYear();
    const prefix = isNonInvoicePayment ? 'CINV' : 'INV';
    const existingNums = invoices
      .filter(i => i.invoiceNo?.startsWith(`${prefix}-${year}-`))
      .map(i => parseInt(i.invoiceNo?.split('-')[2] || '0'))
      .filter(n => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`;
  };

  // Calculate totals (simple version without VatService)
  const calculateTotals = (lines: InvoiceLine[]) => {
    const subtotal = lines.reduce((sum, l) => sum + (l.netAmount || 0), 0);
    const vatAmount = lines.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
    // grand total should be subtotal + vat, not sum of gross amounts
    const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;
    return {
      subtotal,
      vatAmount,
      grandTotal,
      totalEwtAmount: 0,
      netAmountDue: grandTotal,
      balanceDue: grandTotal
    };
  };

  // Reset form
  const resetForm = () => {
    const invoiceDate = todayISO();
    const terms = 'Net 30';
    setFormData({
      invoiceNo: generateInvoiceNo(),
      paymentMethod: 'CASH',
      siNo: '',
      sponsorId: '',
      studentId: '',
      enrollmentId: '',
      assessmentRegistrationId: '',
      batchId: '',
      invoiceDate,
      dueDate: calculateInvoiceDueDate(invoiceDate, terms),
      status: 'ON_HOLD',
      reference: '',
      terms,
      notes: '',
      vatPricing: 'INCLUSIVE',
      vatRate: 0.12,
      glEntryNumber: '',
      lines: []
    });
    setEditingInvoice(null);
    setViewMode('LIST');
  };

  // Open form for new invoice
  const handleNew = () => {
    resetForm();
    setViewMode('FORM');
  };

  const handleInvoiceDateChange = (invoiceDate: string) => {
    setFormData(prev => ({
      ...prev,
      invoiceDate,
      dueDate: calculateInvoiceDueDate(invoiceDate, prev.terms),
    }));
  };

  const handleTermsChange = (terms: string) => {
    setFormData(prev => ({
      ...prev,
      terms,
      dueDate: calculateInvoiceDueDate(prev.invoiceDate, terms),
    }));
  };

  const hydrateInvoiceForForm = async (invoice: Invoice): Promise<Invoice> => {
    if ((invoice.lines || []).length > 0) return invoice;

    try {
      return await DataServiceFactory.getService().getInvoiceById(invoice.id) || invoice;
    } catch (error) {
      console.error('[InvoicesView] Failed to load invoice lines:', error);
      return invoice;
    }
  };

  // Open modal for editing
  const handleEdit = async (invoice: Invoice) => {
    const hydratedInvoice = await hydrateInvoiceForForm(invoice);
    setEditingInvoice(hydratedInvoice);
    const normalizedStatus = hydratedInvoice.status === 'DRAFT' ? 'ON_HOLD' : hydratedInvoice.status;
    setFormData({
      invoiceNo: hydratedInvoice.invoiceNo,
      paymentMethod: hydratedInvoice.paymentMethod || 'CASH',
      siNo: hydratedInvoice.siNo || '',
      sponsorId: hydratedInvoice.sponsorId || '',
      studentId: hydratedInvoice.studentId || '',
      enrollmentId: hydratedInvoice.enrollmentId || '',
      assessmentRegistrationId: hydratedInvoice.assessmentRegistrationId || '',
      batchId: hydratedInvoice.batchId || '',
      invoiceDate: hydratedInvoice.invoiceDate,
      dueDate: hydratedInvoice.dueDate,
      status: normalizedStatus,
      reference: hydratedInvoice.reference || '',
      terms: hydratedInvoice.terms || '',
      notes: hydratedInvoice.notes || '',
      vatPricing: hydratedInvoice.vatPricing || 'INCLUSIVE',
      vatRate: hydratedInvoice.vatRate || 0.12,
      glEntryNumber: hydratedInvoice.glEntryNumber || '',
      lines: hydratedInvoice.lines || []
    });
    setViewMode('FORM');
  };

  // keep localTaxCats in sync with prop; fetch from backend if still empty
  // keep in sync with parent property
  useEffect(() => {
    if (taxCategories && taxCategories.length > 0) {
      console.debug('[InvoicesView] prop taxCategories', taxCategories.length);
      setLocalTaxCats(taxCategories);
    } else {
      console.debug('[InvoicesView] prop taxCategories empty or undefined');
    }
  }, [taxCategories]);

  // refresh tax categories when invoice form becomes active (viewMode changes)
  useEffect(() => {
    if (viewMode === 'FORM' && orgId) {
      console.debug('[InvoicesView] viewMode FORM; fetching tax categories for org', orgId);
      import('../services/DataServiceFactory').then(({ DataServiceFactory }) => {
        DataServiceFactory.getService()
          .fetchTaxCategories(orgId)
          .then(cats => {
            console.debug('[InvoicesView] fetched tax categories', cats);
            if (!cats || cats.length === 0) {
              console.warn('[InvoicesView] no tax categories returned for org', orgId);
            }
            setLocalTaxCats(cats);
          })
          .catch(err => console.error('Failed to fetch tax categories', err));
      });
    }
  }, [viewMode, orgId]);

  // Helper to get Classification Code (Class)
  const getClassificationCode = (accountId?: string) => {
    if (!accountId) return ''; // No account selected
    const account = accounts.find(a => a.id === accountId);
    if (!account) return '';

    // If Revenue or Expense, use Batch Qualification Code or Student Qualification Code
    if (account.class === AccountClass.REVENUE || account.class === AccountClass.EXPENSE) {
      if (formData.batchId) {
        const batch = batches.find(b => b.id === formData.batchId);
        if (batch) {
          const qual = qualifications.find(q => q.id === batch.qualificationId);
          return qual?.code || '';
        }
      } else if (formData.studentId) {
        const student = students.find(s => s.id === formData.studentId);
        if (student && (student as any).qualificationId) {
           const qual = qualifications.find(q => q.id === (student as any).qualificationId);
           return qual?.code || '';
        }
      }
      return ''; // Fallback if unable to find a qualification code for revenue/expense
    } else {
      // Asset, Liability, Equity
      return '0000-0000';
    }
  };

  const getInvoiceLineClassificationCode = (line: InvoiceLine) => {
    const existingCode = String(line.classificationCode || '').trim();
    if (existingCode) return existingCode;

    if (line.courseFeeId) {
      const fee = courseFees.find(f => f.id === line.courseFeeId);
      if (fee?.glAccountId) {
        return getClassificationCode(fee.glAccountId);
      }
    }

    return getClassificationCode(line.glAccountId);
  };

  const getInvoiceQualificationId = () => {
    if (formData.batchId) {
      return batches.find(batch => batch.id === formData.batchId)?.qualificationId || '';
    }
    if (formData.assessmentRegistrationId) {
      return assessmentRegistrations.find(registration => registration.id === formData.assessmentRegistrationId)?.qualificationId || '';
    }
    return '';
  };

  const getSelectableCourseFeesForLine = (line: InvoiceLine) => {
    if (isNonInvoicePayment || !formData.batchId) {
      return courseFees
        .filter(fee => fee.isActive !== false && !fee.isDeleted)
        .sort((left, right) => {
          const nameComparison = String(left.feeName || '').localeCompare(String(right.feeName || ''), undefined, { sensitivity: 'base' });
          if (nameComparison !== 0) return nameComparison;
          return String(left.feeCode || '').localeCompare(String(right.feeCode || ''), undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    const qualificationId = getInvoiceQualificationId();
    const batchSponsorId = formData.batchId
      ? getBatchSponsorId(batches.find(batch => batch.id === formData.batchId))
      : '';
    const registrationSponsorId = formData.assessmentRegistrationId
      ? assessmentRegistrations.find(registration => registration.id === formData.assessmentRegistrationId)?.sponsorId || ''
      : '';
    const fundingType = getCourseFeeFundingTypeForSponsorId(
      batchSponsorId || registrationSponsorId || formData.sponsorId
    );
    const matchingFees = courseFees.filter(fee =>
      fee.isActive &&
      !fee.isDeleted &&
      (!qualificationId || fee.qualificationId === qualificationId) &&
      fee.fundingType === fundingType
    );

    if (line.courseFeeId && !matchingFees.some(fee => fee.id === line.courseFeeId)) {
      const existingFee = courseFees.find(fee => fee.id === line.courseFeeId);
      return existingFee ? [...matchingFees, existingFee] : matchingFees;
    }

    return matchingFees;
  };

  // whenever the list of tax categories changes, recompute net/vat/gross for existing lines
  // but do NOT touch the visible amount â€“ leave whatever the user entered intact
  useEffect(() => {
    console.debug('[InvoicesView] localTaxCats changed', localTaxCats.length);
    if (viewMode === 'FORM' && formData.lines.length > 0 && localTaxCats.length > 0) {
      setFormData(prev => {
        const updated = prev.lines.map(line => {
          const { netAmount, vatAmount, grossAmount } = computeAmounts(line);
          return { ...line, netAmount, vatAmount, grossAmount };
        });
        return { ...prev, lines: updated };
      });
    }
  }, [localTaxCats, viewMode, formData.lines.length]);

  const handlePrintPreview = (invoice: Invoice) => {
    setPrintingInvoice(invoice);
    setShowPrintModal(true);
  };

  const handleWriteOffNavigation = () => {
    if (!editingInvoice) return;
    onNavigate?.('write-off', { invoice: editingInvoice });
  };

  const handleCreateAdjustmentNavigation = () => {
    if (!editingInvoice) return;
    onNavigate?.('credit-debit-memo', { invoice: editingInvoice });
  };

  const handleVoidInvoiceClick = () => {
    if (!editingInvoice) return;
    setVoidingInvoice(editingInvoice);
    setVoidReason('');
    setShowVoidModal(true);
  };

  // Handle sponsor change - auto-fill EWT rate
  const handleSponsorChange = (sponsorId: string) => {
    setFormData(prev => ({
      ...prev,
      sponsorId
    }));
  };

  const getBatchStudentIds = (batchId: string) => {
    const enrolledStudentIds = enrollments
      .filter(e => e.batchId === batchId && !e.isDeleted)
      .map(e => e.studentId)
      .filter(Boolean);

    if (enrolledStudentIds.length > 0) {
      return Array.from(new Set(enrolledStudentIds));
    }

    const batch = batches.find(b => b.id === batchId);
    return Array.from(new Set(batch?.studentIds || []));
  };

  const getBilledStudentIdsForPrivateBatch = (batchId: string) => {
    return new Set(
      invoices
        .filter(inv =>
          inv.batchId === batchId &&
          inv.status !== 'VOIDED' &&
          inv.id !== editingInvoice?.id &&
          !inv.sponsorId &&
          !!inv.studentId
        )
        .map(inv => inv.studentId as string)
    );
  };

  const getBillingComputationContext = (overrideEnrollments?: Enrollment[]) => ({
    batches,
    enrollments: overrideEnrollments || enrollments,
    courseFees,
    sponsors,
    invoices,
    payments,
    journalEntries
  });

  const sortEnrollmentsForBillingCap = (rows: Enrollment[]) => {
    if (!rows[0]?.batchId) return rows;
    return BillingComputationService.getValidEnrollments(getBillingComputationContext(rows), rows[0].batchId);
  };

  const getBatchSponsorId = (batch?: Batch | null) => {
    return BillingComputationService.getBatchSponsorId(batch);
  };

  const getCourseFeeFundingTypeForSponsorId = (sponsorId?: string) => {
    return BillingComputationService.getCourseFeeFundingTypeForSponsor(getBillingComputationContext(), sponsorId);
  };

  const getBatchCourseFeeFundingType = (batch?: Batch | null, sponsorId?: string, studentId?: string) =>
    BillingComputationService.getBatchCourseFeeFundingType(getBillingComputationContext(), batch, sponsorId, studentId);

  const isSponsoredBatchContext = (batch?: Batch | null, fallbackSponsorId = '') => {
    return !!getBatchSponsorId(batch) || !!String(fallbackSponsorId || '').trim();
  };

  const getEnrollmentSponsorId = (enrollment: Enrollment) => {
    return BillingComputationService.getEnrollmentSponsorId(enrollment, batches.find(batch => batch.id === enrollment.batchId));
  };

  const getBillableSponsoredEnrollments = (rows: Enrollment[]) => {
    const byBatch = new Map<string, Enrollment[]>();

    rows
      .filter(e =>
        !!getEnrollmentSponsorId(e)
      )
      .forEach(e => {
        const batchId = e.batchId || (e as any).batch_id || '';
        if (!batchId) return;
        if (!byBatch.has(batchId)) byBatch.set(batchId, []);
        byBatch.get(batchId)!.push(e);
      });

    return Array.from(byBatch.entries()).flatMap(([batchId, batchRows]) => {
      const batch = batches.find(b => b.id === batchId);
      if (!isSponsoredBatchContext(batch)) return sortEnrollmentsForBillingCap(batchRows);
      return BillingComputationService.classifyEnrollmentsByBatchCap(
        getBillingComputationContext(batchRows),
        batchId
      ).billableEnrollments;
    });
  };

  const getSponsoredBatchEnrolledQuantity = (batch: Batch, fallbackSponsorId = '', targetStudentId = '') => {
    if (targetStudentId) return 1;
    const activeSponsorId = fallbackSponsorId !== undefined ? fallbackSponsorId : getBatchSponsorId(batch);
    const cacheKey = activeSponsorId ? `${batch.id}:${activeSponsorId}` : batch.id;
    const backendQty = Number(backendBatchEnrolledQty[cacheKey] || (activeSponsorId ? 0 : backendBatchEnrolledQty[batch.id]) || 0);
    if (backendQty > 0) return backendQty;
    return BillingComputationService.getValidEnrolledQty(
      getBillingComputationContext(),
      batch.id,
      activeSponsorId || undefined,
      targetStudentId || undefined
    );
  };

  const fetchBackendCourseFeeInvoice = async (batchId: string, sponsorId?: string) => {
    try {
      const { DataServiceFactory } = await import('../services/DataServiceFactory');
      const service = DataServiceFactory.getService() as any;
      if (typeof service.fetchBillingCourseFeeInvoice !== 'function') return null;
      const rows = await service.fetchBillingCourseFeeInvoice(batchId, sponsorId);
      const qty = Number(rows?.[0]?.quantity ?? 0);
      const cacheKey = sponsorId ? `${batchId}:${sponsorId}` : batchId;
      if (qty > 0) {
        setBackendBatchEnrolledQty(prev => ({ ...prev, [cacheKey]: qty }));
      }
      return Array.isArray(rows) ? rows : null;
    } catch (error) {
      console.warn('[InvoicesView] Backend billing computation unavailable; using local preview.', error);
      return null;
    }
  };

  const applyQuantityToLines = (lines: InvoiceLine[], qty: number) => {
    return lines.map(line => {
      if (getLineType(line) !== 'COURSE_FEE') return line;
      const unitPrice = Number(line.unitPrice || 0);
      const amount = Math.round(qty * unitPrice * 100) / 100;
      const recalculatedLine = {
        ...line,
        quantity: qty,
        amount
      };
      const { netAmount, vatAmount, grossAmount } = computeAmounts(recalculatedLine);
      return {
        ...recalculatedLine,
        netAmount,
        vatAmount,
        grossAmount
      };
    });
  };

  const getCourseFeeLineQuantity = (fallbackQty = 1) => {
    const selectedBatch = batches.find(batch => batch.id === formData.batchId);
    if (!selectedBatch) return fallbackQty;
    return getSponsoredBatchEnrolledQuantity(selectedBatch, formData.sponsorId, formData.studentId) ||
      BillingComputationService.getValidEnrolledQty(getBillingComputationContext(), selectedBatch.id, formData.sponsorId || undefined, formData.studentId || undefined) ||
      fallbackQty;
  };

  const applySponsoredBatchQuantityToLines = (batch: Batch, lines: InvoiceLine[], fallbackSponsorId = '') => {
    const qty = getSponsoredBatchEnrolledQuantity(batch, fallbackSponsorId, formData.studentId) ||
      BillingComputationService.getValidEnrolledQty(getBillingComputationContext(), batch.id, fallbackSponsorId || formData.sponsorId || undefined, formData.studentId || undefined);
    if (qty <= 0) return lines;

    return applyQuantityToLines(lines, qty);
  };

  const getBatchContractAdjustedLines = (lines: InvoiceLine[], batchId?: string, fallbackSponsorId = '') => {
    const batch = batchId ? batches.find(b => b.id === batchId) : null;
    if (!batch) return lines;
    return applySponsoredBatchQuantityToLines(batch, lines, fallbackSponsorId !== undefined ? fallbackSponsorId : getBatchSponsorId(batch));
  };

  const invoiceLinesChanged = (left: InvoiceLine[], right: InvoiceLine[]) => {
    if (left.length !== right.length) return true;
    return left.some((line, index) => {
      const next = right[index];
      return line.quantity !== next.quantity ||
        line.amount !== next.amount ||
        line.netAmount !== next.netAmount ||
        line.vatAmount !== next.vatAmount ||
        line.grossAmount !== next.grossAmount;
    });
  };

  const getBillableStudentsForBatch = (batchId: string, includeStudentId?: string) => {
    const batch = batches.find(b => b.id === batchId);
    const batchEnrollments = enrollments.filter(e => e.batchId === batchId && !e.isDeleted);
    const privateEnrollmentStudentIds = new Set(
      batchEnrollments
        .filter(e => !e.sponsorId && (!batch?.sponsorId || e.sponsorId === ''))
        .map(e => e.studentId)
    );

    const batchStudents = getBatchStudentIds(batchId)
      .map(id => students.find(s => s.id === id))
      .filter((s): s is Student => !!s && !s.isDeleted);

    const billedStudentIds = getBilledStudentIdsForPrivateBatch(batchId);
    return batchStudents.filter(student => {
      if (privateEnrollmentStudentIds.size > 0 && !privateEnrollmentStudentIds.has(student.id) && student.id !== includeStudentId) {
        return false;
      }
      return !billedStudentIds.has(student.id) || student.id === includeStudentId;
    });
  };

  const getBillableSponsoredEnrollmentsForBatch = (batchId: string) => {
    return getBillableSponsoredEnrollments(
      enrollments.filter(e => e.batchId === batchId && e.billingStatus === 'UNBILLED')
    );
  };

  const isBatchFullyBilled = (batch: Batch) => {
    const validEnrs = enrollments.filter(e => e.batchId === batch.id && !e.isDeleted);
    if (validEnrs.length === 0) return false;
    return validEnrs.every(e => e.billingStatus === 'BILLED');
  };

  const isPrivateBatchFullyBilled = (batch: Batch) => {
    return isBatchFullyBilled(batch);
  };

  useEffect(() => {
    if (viewMode !== 'FORM' || !formData.batchId || formData.lines.length === 0) return;

    setFormData(prev => {
      const adjustedLines = getBatchContractAdjustedLines(prev.lines, prev.batchId, prev.sponsorId);
      if (!invoiceLinesChanged(prev.lines, adjustedLines)) return prev;
      return { ...prev, lines: adjustedLines };
    });
  }, [viewMode, formData.batchId, formData.sponsorId, formData.lines, batches, enrollments, backendBatchEnrolledQty]);

  // Recalculate VAT for all lines when VAT settings change or during initial edit load
  useEffect(() => {
    if (viewMode === 'FORM' && formData.lines.length > 0) {
      setFormData(prev => {
        let linesChanged = false;
        const sponsor = sponsors.find(s => s.id === prev.sponsorId);
        const taxType = sponsor?.taxType || 'NON_VAT';
        const isInclusive = prev.vatPricing === 'INCLUSIVE';

        const mappedLines = prev.lines.map(line => {
          const { netAmount, vatAmount, grossAmount } = computeAmounts(line as InvoiceLine);
          if (line.netAmount !== netAmount || line.vatAmount !== vatAmount || line.grossAmount !== grossAmount) {
            linesChanged = true;
            return {
              ...line,
              netAmount,
              vatAmount,
              grossAmount
            };
          }
          return line;
        });

        if (linesChanged) {
          return { ...prev, lines: mappedLines };
        }
        return prev;
      });
    }
  }, [viewMode, formData.vatPricing, formData.vatRate, formData.sponsorId, sponsors]);

  // Handle batch change - auto-fill sponsor, quantity, and line items (with mixed cohort subgroup support)
  const handleBatchChange = async (batchId: string, targetSponsorId?: string, targetStudentId?: string) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) {
      setFormData(prev => ({
        ...prev,
        batchId: '',
        lines: prev.lines.filter(l => l.lineType !== 'COURSE_FEE' || !l.courseFeeId)
      }));
      return;
    }

    const fundingGroups = BillingComputationService.getBatchFundingGroups(getBillingComputationContext(), batchId);

    let resolvedSponsorId = targetSponsorId !== undefined
      ? targetSponsorId
      : (formData.sponsorId || '');
    let resolvedStudentId = targetStudentId !== undefined
      ? targetStudentId
      : (formData.studentId || '');

    if (!resolvedSponsorId && !resolvedStudentId) {
      if (fundingGroups.length === 1) {
        if (fundingGroups[0].sponsorId) {
          resolvedSponsorId = fundingGroups[0].sponsorId;
        } else {
          const studentsInBatch = getBillableStudentsForBatch(batchId);
          resolvedStudentId = studentsInBatch[0]?.id || '';
        }
      } else if (fundingGroups.length > 1) {
        const batchSponsor = getBatchSponsorId(batch);
        const matchingSponsor = fundingGroups.find(g => g.sponsorId && g.sponsorId === batchSponsor);
        if (matchingSponsor && matchingSponsor.unbilledLearners > 0) {
          resolvedSponsorId = matchingSponsor.sponsorId!;
        } else {
          const firstUnbilledSponsor = fundingGroups.find(g => g.sponsorId && g.unbilledLearners > 0);
          if (firstUnbilledSponsor) {
            resolvedSponsorId = firstUnbilledSponsor.sponsorId!;
          } else {
            const studentsInBatch = getBillableStudentsForBatch(batchId);
            resolvedStudentId = studentsInBatch[0]?.id || '';
          }
        }
      } else {
        resolvedSponsorId = getBatchSponsorId(batch);
      }
    }

    const backendFeeRows = resolvedStudentId
      ? null
      : await fetchBackendCourseFeeInvoice(batchId, resolvedSponsorId || undefined);
    const backendQty = Number(backendFeeRows?.[0]?.quantity ?? 0);

    const computedInvoice = BillingComputationService.computeCourseFeeInvoice(
      getBillingComputationContext(),
      batchId,
      resolvedSponsorId || undefined,
      resolvedStudentId || undefined
    );
    const expectedFundingType = getBatchCourseFeeFundingType(batch, resolvedSponsorId || undefined, resolvedStudentId || undefined);
    const activeQualificationFees = courseFees.filter(f =>
      f.qualificationId === batch.qualificationId &&
      f.isActive &&
      !f.isDeleted
    );
    let exactFundingFees = activeQualificationFees.filter(f => f.fundingType === expectedFundingType);
    if (exactFundingFees.length === 0 && expectedFundingType === 'TESDA_SCHOLARSHIP') {
      exactFundingFees = activeQualificationFees.filter(f => f.fundingType === 'SPONSORED');
    }

    const qualificationFees = exactFundingFees
      .sort((left, right) =>
        String(left.category || '').localeCompare(String(right.category || '')) ||
        left.feeName.localeCompare(right.feeName)
      );

    const manualLines = formData.lines.filter(line => getLineType(line) !== 'COURSE_FEE');
    const shouldPreserveManualLines = manualLines.length > 0
      ? window.confirm('Preserve manually added discount/adjustment lines after loading this batch?')
      : false;

    const newLines: InvoiceLine[] = qualificationFees.map((fee, idx) => {
      const computedLine = computedInvoice.lines.find(line => line.courseFeeId === fee.id);
      const backendLine = backendFeeRows?.find(row => row.courseFeeId === fee.id || row.course_fee_id === fee.id);
      const qty = resolvedStudentId
        ? (computedInvoice.enrolledQty || 1)
        : (Number(backendLine?.quantity ?? backendQty) || computedInvoice.enrolledQty || 0);
      const unitPrice = fee.amount || 0;

      const code = (() => {
         const account = accounts.find(a => a.id === fee.glAccountId);
         if (!account) return '';
         if (account.class === AccountClass.REVENUE || account.class === AccountClass.EXPENSE) {
             const qual = qualifications.find(q => q.id === batch.qualificationId);
             return qual?.code || '';
         }
         return '0000-0000';
      })();

      const draftLine = {
        id: generateUUID(),
        invoiceId: editingInvoice?.id || '',
        lineNumber: idx + 1,
        description: getCourseFeeDescription(fee),
        courseFeeId: fee.id,
        lineType: 'COURSE_FEE' as any,
        quantity: qty,
        unitPrice,
        netAmount: computedLine?.netAmount || 0,
        vatAmount: computedLine?.vatAmount || 0,
        grossAmount: computedLine?.grossAmount || 0,
        amount: computedLine?.amount || Math.round(qty * unitPrice * 100) / 100,
        glAccountId: fee.glAccountId,
        taxCategoryId: fee.taxCategoryId || '',
        classificationCode: code
      } as InvoiceLine;
      const computed = computeAmounts(draftLine);
      return { ...draftLine, ...computed };
    });
    const preservedLines = shouldPreserveManualLines
      ? manualLines.map((line, index) => ({ ...line, lineNumber: newLines.length + index + 1 }))
      : [];
    const nextLines = [...newLines, ...preservedLines].map((line, index) => ({ ...line, lineNumber: index + 1 }));

    setFormData(prev => ({
      ...prev,
      batchId,
      assessmentRegistrationId: '',
      sponsorId: resolvedSponsorId,
      studentId: resolvedSponsorId ? '' : resolvedStudentId,
      lines: nextLines
    }));
  };

  const handleAssessmentRegistrationChange = (registrationId: string) => {
    const registration = assessmentRegistrations.find(r => r.id === registrationId);
    if (!registration) {
      setFormData(prev => ({ ...prev, assessmentRegistrationId: '', lines: [] }));
      return;
    }

    const student = students.find(s => s.id === registration.studentId);
    const qualification = qualifications.find(q => q.id === registration.qualificationId);
    const assessmentFees = courseFees.filter(f =>
      f.qualificationId === registration.qualificationId &&
      f.fundingType === getCourseFeeFundingTypeForSponsorId(registration.sponsorId) &&
      f.isActive &&
      !f.isDeleted &&
      f.category === 'ASSESSMENT'
    );

    const feeSources = assessmentFees.length > 0
      ? assessmentFees
      : [{
          id: '',
          feeName: `Assessment Fee - ${qualification?.name || 'Qualification'}`,
          amount: Number(registration.totalFees || 0),
          glAccountId: undefined,
          taxCategoryId: undefined
        } as Partial<CourseFee>];

    const lines: InvoiceLine[] = feeSources.map((fee, idx) => {
      const amount = Number(fee.amount || 0);
      const draftLine = {
        id: generateUUID(),
        invoiceId: editingInvoice?.id || '',
        orgId,
        lineNumber: idx + 1,
        description: fee.feeName || `Assessment Fee - ${qualification?.name || 'Qualification'}`,
        courseFeeId: fee.id || undefined,
        assessmentRegistrationId: registration.id,
        quantity: 1,
        unitPrice: amount,
        amount,
        netAmount: amount,
        vatAmount: 0,
        grossAmount: amount,
        glAccountId: fee.glAccountId,
        taxCategoryId: fee.taxCategoryId || '',
        classificationCode: qualification?.code || getClassificationCode(fee.glAccountId)
      } as InvoiceLine;
      const computed = computeAmounts(draftLine);
      return { ...draftLine, ...computed };
    });

    setFormData(prev => ({
      ...prev,
      assessmentRegistrationId: registration.id,
      batchId: '',
      enrollmentId: '',
      sponsorId: '',
      studentId: registration.studentId,
      notes: prev.notes || `Assessment-only billing: ${student ? `${student.firstName} ${student.lastName}` : 'Candidate'} - ${qualification?.name || 'Qualification'}`,
      lines
    }));
  };

  // Add line
  const handleAddLine = (lineType: 'DISCOUNT' | 'ADJUSTMENT' | 'MANUAL' = 'MANUAL') => {
    const defaultUnitPrice = lineType === 'DISCOUNT' ? -1 : 0;
    const newLine: InvoiceLine = {
      id: generateUUID(),
      invoiceId: editingInvoice?.id || '',
      orgId,
      lineNumber: formData.lines.length + 1,
      description: '',
      lineType: lineType as any,
      quantity: 1,
      unitPrice: defaultUnitPrice,
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      amount: lineType === 'DISCOUNT' ? -1 : 0,
      taxCategoryId: '',
      classificationCode: ''
    };
    const computed = computeAmounts(newLine);
    Object.assign(newLine, computed);
    setFormData(prev => ({ ...prev, lines: [...prev.lines, newLine] }));
  };

  const exportLineItemsToExcel = () => {
    const columns = lineColOrder.map(colKey => {
      switch (colKey) {
        case 'lineNumber': return { label: '#', getter: (line: InvoiceLine) => line.lineNumber };
        case 'lineType': return { label: 'Type', getter: (line: InvoiceLine) => getLineType(line) };
        case 'classificationCode': return { label: 'Class', getter: (line: InvoiceLine) => line.classificationCode || '-' };
        case 'courseFeeId': return { label: 'Course Fee', getter: (line: InvoiceLine) => courseFees.find(cf => cf.id === line.courseFeeId)?.feeName || (line.courseFeeId || '-') };
        case 'description': return { label: 'Description', getter: (line: InvoiceLine) => line.description || '-' };
        case 'taxCategoryId': return { label: 'Tax Category', getter: (line: InvoiceLine) => localTaxCats.find(tc => tc.id === line.taxCategoryId)?.description || (line.taxCategoryId || '-') };
        case 'quantity': return { label: 'Qty', getter: (line: InvoiceLine) => line.quantity };
        case 'unitPrice': return { label: 'Unit Price (₱)', getter: (line: InvoiceLine) => formatInputCurrency(line.unitPrice) };
        case 'amount': return { label: 'Amount (₱)', getter: (line: InvoiceLine) => formatInputCurrency(line.amount) };
        default: return null;
      }
    }).filter(Boolean) as { label: string; getter: (line: InvoiceLine) => any }[];
    if (formData.lines.length === 0) { alert('No line items to export.'); return; }
    const headers = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/><style>td{padding:6px 8px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:12px;}th{padding:6px 8px;border:1px solid #ccc;font-family:Inter,Open Sans,Segoe UI,Arial,sans-serif;font-size:12px;background:#059669;color:#fff;font-weight:700;}</style></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>';
    formData.lines.forEach(line => {
      html += '<tr>' + columns.map(c => `<td>${esc(c.getter(line))}</td>`).join('') + '</tr>';
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_LineItems_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // helper â€“ calculate amounts based on selected tax category
  //
  // The amount calculation always revolves around a *base* value which
  // helper â€“ calculate amounts based on selected tax category
  //
  // The amount calculation always revolves around a *base* value which
  // originally represented the gross figure but we now display the net
  // amount in the invoice lines. By default the base is computed as quantity
  // Ã— unitPrice, but if an explicit `line.amount` value is present we treat
  // that as the base so manual adjustments (e.g. import or override) are
  // respected.
  //
  // VAT is now always computed using a unified formula for special tax
  // category codes (VATGOODS, VATSERV, NVGOODS, NVSERV, EXMPTGOODS,
  // EXMPTSERV, ZEROGOODS, ZEROSERV).  The formula is:
  //
  //     vat = amount Ã· 1.12 Ã— rate
  //
  // with rate 12% for the first six codes and 0% for the zeroâ€‘rated ones.
  // This reflects the user's request to treat nonâ€‘VAT, exempt, and regular
  // categories identically for output VAT computation.  For all other
  // categories we fall back to the previous inclusive/exclusive logic.

  const extractVat = (amount: number, cat?: TaxCategoryEntry): number => {
    if (!cat) return 0;
    const code = (cat.code || '').toUpperCase();
    let rateOverride: number | undefined;
    if (/^(VATGOODS|VATSERV)$/.test(code)) {
      // use prescribed formula: line amount is assumed inclusive
      // vat = amount / 1.12 * 12%
      rateOverride = 0.12;
    } else if (/^(NVGOODS|NVSERV|EXMPTGOODS|EXMPTSERV|ZEROGOODS|ZEROSERV)$/.test(code)) {
      // these categories are treated as 0% vat using the same base formula
      rateOverride = 0;
    }
    if (rateOverride !== undefined) {
      return Math.round((amount / 1.12 * rateOverride) * 100) / 100;
    }
    // nonâ€‘special categories: use existing rate based logic
    if (typeof cat.rate === 'number') {
      const r = cat.rate > 1 ? cat.rate / 100 : cat.rate;
      if (cat.isInclusive) {
        return Math.round((amount / (1 + r) * r) * 100) / 100;
      }
      return Math.round(amount * r * 100) / 100;
    }
    return 0;
  };

  const computeAmounts = (line: InvoiceLine) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    // start with qty*price but allow explicit override
    let base = Math.round(qty * price * 100) / 100;
    if (line.amount !== undefined && line.amount !== null && Number(line.amount) !== 0) {
      base = line.amount;
    }

    let netAmount = base;
    let vatAmount = 0;
    let grossAmount = base;

    if (line.taxCategoryId) {
      const cat = localTaxCats.find(c => c.id === line.taxCategoryId);
      if (cat) {
        vatAmount = extractVat(base, cat);
        const code = String(cat.code || '').toUpperCase();
        const isPrescribedInclusiveVat = /^(VATGOODS|VATSERV)$/.test(code);
        const isInclusive = isPrescribedInclusiveVat || Boolean(cat.isInclusive);
        if (isInclusive) {
          netAmount = Math.round((base - vatAmount) * 100) / 100;
          grossAmount = base;
        } else {
          netAmount = base;
          grossAmount = Math.round((base + vatAmount) * 100) / 100;
        }
      }
    }
    return { netAmount, vatAmount, grossAmount };
  };

  // Update line
  const handleUpdateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    setFormData(prev => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };

      // Auto-tag class when GL Account changes
      if (field === 'glAccountId') {
          lines[index].classificationCode = getClassificationCode(value as string);
      }

      if (field === 'lineType') {
        const nextType = String(value || 'MANUAL').toUpperCase();
        if (nextType === 'COURSE_FEE' && !lines[index].courseFeeId) {
          lines[index].lineType = 'MANUAL' as any;
        }
        if (nextType === 'DISCOUNT') {
          const currentUnitPrice = Number(lines[index].unitPrice || lines[index].amount || 0);
          const currentAmount = Number(lines[index].amount || 0);
          lines[index].unitPrice = -Math.abs(currentUnitPrice || currentAmount || 1);
          lines[index].amount = -Math.abs(currentAmount || (Number(lines[index].quantity || 1) * Math.abs(lines[index].unitPrice)));
        } else if (nextType === 'COURSE_FEE' && lines[index].courseFeeId) {
          lines[index].unitPrice = Math.abs(Number(lines[index].unitPrice || 0));
          lines[index].amount = Math.abs(Number(lines[index].amount || 0));
        }
      }

      // when qty or unit price change, we may want to autoâ€‘populate the amount
      if ((field === 'quantity' || field === 'unitPrice')) {
        const qty = lines[index].quantity || 0;
        const upr = lines[index].unitPrice || 0;
        const rawAmount = Math.round(qty * upr * 100) / 100;
        lines[index].amount = getLineType(lines[index]) === 'DISCOUNT'
          ? -Math.abs(rawAmount)
          : rawAmount;
      }

      if (field === 'amount' && getLineType(lines[index]) === 'DISCOUNT') {
        lines[index].amount = -Math.abs(Number(lines[index].amount || 0));
      }

      // Recompute net/vat/gross when any of the relevant fields change
      if (field === 'quantity' || field === 'unitPrice' || field === 'taxCategoryId' || field === 'amount' || field === 'lineType') {
        const { netAmount, vatAmount, grossAmount } = computeAmounts(lines[index]);
        lines[index].netAmount = netAmount;
        lines[index].vatAmount = vatAmount;
        lines[index].grossAmount = grossAmount;
        // do not touch `amount` when tax category changes â€“ user value stays
        // if the user edited the amount directly we already set it above
      }
      return { ...prev, lines };
    });
  };

  // Remove line
  const handleRemoveLine = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index).map((l, i) => ({ ...l, lineNumber: i + 1 }))
    }));
  };

  // Apply course fee to line
  const handleApplyCourseFee = (index: number, courseFeeId: string) => {
    const fee = courseFees.find(f => f.id === courseFeeId);
    if (!fee) {
      const updatedLines = [...formData.lines];
      updatedLines[index] = {
        ...updatedLines[index],
        courseFeeId: '',
        lineType: 'MANUAL',
        classificationCode: ''
      };
      setFormData(prev => ({ ...prev, lines: updatedLines }));
      return;
    }
    if (fee) {
      const qual = qualifications.find(q => q.id === fee.qualificationId);
      const qualCode = qual?.code || '';
      const currentLineType = getLineType(formData.lines[index]);
      const nextLineType = currentLineType === 'DISCOUNT' || currentLineType === 'ADJUSTMENT'
        ? currentLineType
        : 'COURSE_FEE';
      const qty = getCourseFeeLineQuantity(formData.lines[index].quantity || 1);
      const baseUnitPrice = Number(fee.amount || 0);
      const unitPrice = nextLineType === 'DISCOUNT' ? -Math.abs(baseUnitPrice) : baseUnitPrice;
      const amount = Math.round(qty * unitPrice * 100) / 100;
      const tempLine: InvoiceLine = {
        ...formData.lines[index],
        quantity: qty,
        unitPrice,
        amount,
        taxCategoryId: fee.taxCategoryId || formData.lines[index].taxCategoryId || ''
      };
      const { netAmount, vatAmount, grossAmount } = computeAmounts(tempLine);

      const updatedLines = [...formData.lines];
      updatedLines[index] = {
        ...updatedLines[index],
        courseFeeId,
        lineType: nextLineType as any,
        description: nextLineType === 'DISCOUNT' ? `Discount - ${fee.feeName}` : getCourseFeeDescription(fee),
        quantity: qty,
        unitPrice,
        netAmount,
        vatAmount,
        grossAmount,
        amount,
        glAccountId: fee.glAccountId || updatedLines[index].glAccountId,
        taxCategoryId: fee.taxCategoryId || updatedLines[index].taxCategoryId,
        classificationCode: qualCode || getClassificationCode(fee.glAccountId || updatedLines[index].glAccountId)
      };

      setFormData(prev => ({ ...prev, lines: updatedLines }));
    }
  };

  const markAssessmentRegistrationBilled = (invoice: Invoice) => {
    if (!invoice.assessmentRegistrationId || !onUpdateAssessmentRegistration) return;
    const registration = assessmentRegistrations.find(r => r.id === invoice.assessmentRegistrationId);
    if (!registration) return;
    onUpdateAssessmentRegistration({
      ...registration,
      status: 'BILLED',
      billingStatus: 'BILLED',
      billedAmount: invoice.grandTotal,
      invoiceId: invoice.id,
      updatedAt: new Date().toISOString()
    });
  };

  // Save invoice
  const handleSave = () => {
    if (isReadOnly) {
      alert('This invoice is already posted and can no longer be saved as draft.');
      return;
    }
    const requiredFieldIssues = validateInvoiceRequiredFields(formData);
    if (requiredFieldIssues.length > 0) {
      alert(invoiceRequiredFieldMessage || 'Required invoice fields are missing.');
      return;
    }
    if (!formData.sponsorId && !formData.studentId) {
      alert('Please select a customer or student.');
      return;
    }
    if (formData.lines.length === 0) {
      alert('Please add at least one line item.');
      return;
    }
    if (!String(formData.notes || '').trim()) {
      alert('Transaction description is required before saving the invoice.');
      return;
    }
    const invoiceLineRuleIssues = validateInvoiceLineRules(formData);
    if (invoiceLineRuleIssues.length > 0) {
      alert(invoiceLineRuleIssues.join('\n'));
      return;
    }

    const invoiceLines = getBatchContractAdjustedLines(formData.lines, formData.batchId, formData.sponsorId);
    const totals = calculateTotals(invoiceLines);

    const invoice: Invoice = {
      id: editingInvoice?.id || generateUUID(),
      orgId: editingInvoice?.orgId || '',
      invoiceNo: formData.invoiceNo,
      documentType: documentMode,
      paymentMethod: isNonInvoicePayment ? formData.paymentMethod : undefined,
      siNo: isNonInvoicePayment ? String(formData.siNo || '').trim() || undefined : undefined,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      enrollmentId: formData.enrollmentId || undefined,
      assessmentRegistrationId: formData.assessmentRegistrationId || undefined,
      batchId: formData.batchId || undefined,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      status: formData.status === 'DRAFT' ? 'ON_HOLD' : formData.status,
      vatPricing: formData.vatPricing,
      vatRate: formData.vatRate,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      totalEwtAmount: 0,
      netAmountDue: totals.grandTotal,
      amountPaid: isNonInvoicePayment ? totals.grandTotal : (editingInvoice?.amountPaid || 0),
      balanceDue: isNonInvoicePayment ? 0 : totals.grandTotal - (editingInvoice?.amountPaid || 0),
      reference: formData.reference || undefined,
      terms: formData.terms || undefined,
      notes: String(formData.notes || '').trim() || undefined,
      lines: invoiceLines.map(l => ({ ...l, invoiceId: editingInvoice?.id || '', assessmentRegistrationId: l.assessmentRegistrationId || formData.assessmentRegistrationId || undefined })),
      createdBy: editingInvoice?.createdBy,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (editingInvoice) {
      onUpdateInvoice(invoice);
    } else {
      onAddInvoice(invoice);
    }
    setRefreshKey(key => key + 1);
    markAssessmentRegistrationBilled(invoice);

    resetForm();
    setViewMode('LIST');
  };

  // Approve invoice
  const handleApprove = () => {
    if (isReadOnly) {
      alert('This invoice is already posted and can no longer be approved.');
      return;
    }
    const requiredFieldIssues = validateInvoiceRequiredFields(formData);
    if (requiredFieldIssues.length > 0) {
      alert(invoiceRequiredFieldMessage || 'Required invoice fields are missing.');
      return;
    }
    if (!formData.sponsorId && !formData.studentId) {
      alert('Please select a customer or student.');
      return;
    }
    if (formData.lines.length === 0) {
      alert('Please add at least one line item.');
      return;
    }
    if (!String(formData.notes || '').trim()) {
      alert('Transaction description is required before approving the invoice.');
      return;
    }
    const invoiceLineRuleIssues = validateInvoiceLineRules(formData);
    if (invoiceLineRuleIssues.length > 0) {
      alert(invoiceLineRuleIssues.join('\n'));
      return;
    }

    const invoiceLines = getBatchContractAdjustedLines(formData.lines, formData.batchId, formData.sponsorId);
    const totals = calculateTotals(invoiceLines);

    const invoice: Invoice = {
      id: editingInvoice?.id || generateUUID(),
      orgId: editingInvoice?.orgId || '',
      invoiceNo: formData.invoiceNo,
      documentType: documentMode,
      paymentMethod: isNonInvoicePayment ? formData.paymentMethod : undefined,
      siNo: isNonInvoicePayment ? String(formData.siNo || '').trim() || undefined : undefined,
      sponsorId: formData.sponsorId || undefined,
      studentId: formData.studentId || undefined,
      enrollmentId: formData.enrollmentId || undefined,
      assessmentRegistrationId: formData.assessmentRegistrationId || undefined,
      batchId: formData.batchId || undefined,
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate,
      status: 'OPEN',
      vatPricing: formData.vatPricing,
      vatRate: formData.vatRate,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      totalEwtAmount: 0,
      netAmountDue: totals.grandTotal,
      amountPaid: isNonInvoicePayment ? totals.grandTotal : (editingInvoice?.amountPaid || 0),
      balanceDue: isNonInvoicePayment ? 0 : totals.grandTotal - (editingInvoice?.amountPaid || 0),
      reference: formData.reference || undefined,
      terms: formData.terms || undefined,
      notes: String(formData.notes || '').trim() || undefined,
      lines: invoiceLines.map(l => ({ ...l, invoiceId: editingInvoice?.id || '', assessmentRegistrationId: l.assessmentRegistrationId || formData.assessmentRegistrationId || undefined })),
      createdBy: editingInvoice?.createdBy,
      createdAt: editingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postedAt: new Date().toISOString()
    };

    if (editingInvoice) {
      onUpdateInvoice(invoice);
    } else {
      onAddInvoice(invoice);
    }
    setRefreshKey(key => key + 1);
    markAssessmentRegistrationBilled(invoice);

    resetForm();
    setViewMode('LIST');
  };

  // Post invoice
  const handlePost = (invoice: Invoice) => {
    // Subsidiary Ledger: For sponsor-billed invoices, create StudentLedger entries for each student in the batch
    if (invoice.sponsorId && onAddStudentLedgerEntry) {
      // Find all enrollments for this sponsor and batch
      const coveredEnrollments = getBillableSponsoredEnrollments(
        enrollments.filter(e => e.sponsorId === invoice.sponsorId && (!invoice.batchId || e.batchId === invoice.batchId))
      );
      // Distribute netAmountDue equally if possible, else use enrollment.feeAmount or fallback
      const perStudentAmount = coveredEnrollments.length > 0 ? invoice.netAmountDue / coveredEnrollments.length : 0;
      coveredEnrollments.forEach(e => {
        onAddStudentLedgerEntry({
          id: generateUUID(),
          orgId: invoice.orgId,
          studentId: e.studentId,
          invoiceId: invoice.id,
          date: invoice.invoiceDate,
          description: `Sponsor-billed: ${sponsors.find(s => s.id === invoice.sponsorId)?.name || 'Sponsor'} Invoice ${invoice.invoiceNo}`,
          debit: 0,
          credit: perStudentAmount,
          balance: 0, // Will be recomputed in ledger view
          sponsorId: invoice.sponsorId,
          createdAt: new Date().toISOString(),
        });
      });
    }
    if (onPostInvoice) {
      onPostInvoice({ ...invoice, status: 'OPEN', postedAt: new Date().toISOString() });
    } else {
      onUpdateInvoice({ ...invoice, status: 'OPEN', postedAt: new Date().toISOString() });
    }
    setRefreshKey(key => key + 1);
  };

  // Void invoice
  const handleVoid = () => {
    if (voidingInvoice && voidReason.trim()) {
      if (onVoidInvoice) {
        onVoidInvoice(voidingInvoice.id, voidReason);
      } else {
        onUpdateInvoice({
          ...voidingInvoice,
          status: 'VOIDED',
          voidedAt: new Date().toISOString(),
          voidReason
        });
      }
      setRefreshKey(key => key + 1);
      setShowVoidModal(false);
      setVoidingInvoice(null);
      setVoidReason('');
    }
  };

  // Toggle row expansion
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const serverSortKeyMap: Record<string, string> = {
    invoiceDate: 'invoice_date',
    postPeriod: 'invoice_date',
    invoiceNo: 'invoice_no',
    status: 'status',
    glReference: 'gl_entry_number',
    totalAmount: 'grand_total',
    balance: 'balance_due',
    createdOn: 'created_at'
  };
  const serverSortColumn = serverSortKeyMap[sortConfig.key] || 'invoice_date';
  const serverFetchEnabled =
    Boolean(orgId) &&
    payerFilterMode !== 'CUSTOM' &&
    sortConfig.key !== 'payer' &&
    sortConfig.key !== 'createdBy';

  const invoiceFilters = useMemo(() => {
    const filters: PageFilter[] = [];
    if (orgId) {
      filters.push({ column: 'org_id', operator: 'eq', value: orgId });
    }
    filters.push({ column: 'document_type', operator: 'eq', value: documentMode });

    if (statusFilter !== 'ALL') {
      filters.push({
        column: 'status',
        operator: 'eq',
        value: statusFilter === 'ON_HOLD' ? 'ON_HOLD' : statusFilter
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    if (dateFilterMode === 'TODAY') {
      filters.push({ column: 'invoice_date', operator: 'eq', value: today });
    } else if (dateFilterMode === 'THIS_MONTH') {
      filters.push({ column: 'invoice_date', operator: 'gte', value: firstDayOfMonth });
      filters.push({ column: 'invoice_date', operator: 'lte', value: today });
    } else if (dateFilterMode === 'CUSTOM') {
      if (dateFrom) filters.push({ column: 'invoice_date', operator: 'gte', value: dateFrom });
      if (dateTo) filters.push({ column: 'invoice_date', operator: 'lte', value: dateTo });
    }

    if (filterSponsorId !== 'ALL') {
      filters.push({ column: 'sponsor_id', operator: 'eq', value: filterSponsorId });
    }
    if (filterStudentId !== 'ALL') {
      filters.push({ column: 'student_id', operator: 'eq', value: filterStudentId });
    }

    return filters;
  }, [dateFilterMode, dateFrom, dateTo, documentMode, filterSponsorId, filterStudentId, orgId, statusFilter]);

  const invoiceOrderBy = useMemo<PageOrder[]>(() => {
    if (sortConfig.direction === 'none') {
      return [{ column: 'invoice_date', ascending: false }];
    }
    return [{ column: serverSortColumn, ascending: sortConfig.direction === 'asc' }];
  }, [serverSortColumn, sortConfig.direction]);

  useEffect(() => {
    setServerCurrentPage(1);
  }, [debouncedSearchTerm, dateFilterMode, dateFrom, dateTo, filterSponsorId, filterStudentId, orgId, payerFilterMode, payerSearchTerm, sortConfig, statusFilter]);

  useEffect(() => {
    if (!serverFetchEnabled) return;

    let isActive = true;
    setIsLoadingPage(true);
    setPageLoadError('');

    DataServiceFactory.getService().fetchPage<Invoice>('invoices', {
      page: serverCurrentPage,
      pageSize: INVOICE_PAGE_SIZE,
      columns: INVOICE_COLUMNS,
      filters: invoiceFilters,
      search: debouncedSearchTerm.trim()
        ? {
          columns: ['invoice_no', 'reference', 'gl_entry_number', 'notes'],
          term: debouncedSearchTerm
        }
        : undefined,
      orderBy: invoiceOrderBy
    })
      .then(result => {
        setServerInvoices(Array.isArray(result?.rows) ? result.rows : []);
        setServerTotal(result.total);
        setServerTotalPages(result.totalPages);
        const rows = Array.isArray(result?.rows) ? result.rows : [];
        const creatorIds = rows.map((r: any) => r.createdBy).filter(Boolean);
        const dataService = DataServiceFactory.getService();
        if (typeof (dataService as any).getInvoiceCreatorNames === 'function' && orgId) {
          (dataService as any).getInvoiceCreatorNames(orgId).then((map: any) => {
            if (map && isActive) setCreatorNameMap(prev => ({ ...prev, ...map }));
          }).catch(() => {});
        }
      })
      .catch(error => {
        if (!isActive) return;
        console.error('[InvoicesView] Failed to load invoice page:', error);
        setPageLoadError(error instanceof Error ? error.message : 'Failed to load invoices.');
        setServerInvoices([]);
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
  }, [debouncedSearchTerm, invoiceFilters, invoiceOrderBy, refreshKey, serverCurrentPage, serverFetchEnabled]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if ((inv.documentType || 'INVOICE') !== documentMode) return false;
      const matchesSearch =
        inv.invoiceNo?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        inv.reference?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        getInvoiceGlRef(inv).toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        getInvoicePayerName(inv).toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        sponsors.find(s => s.id === inv.sponsorId)?.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        students.find(s => s.id === inv.studentId)?.firstName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      const normalizedStatus = inv.status === 'DRAFT' ? 'ON_HOLD' : inv.status;
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ON_HOLD' ? (normalizedStatus === 'ON_HOLD') : normalizedStatus === statusFilter);
      
      let matchesDate = true;
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      if (dateFilterMode === 'TODAY') {
        matchesDate = inv.invoiceDate === today;
      } else if (dateFilterMode === 'THIS_MONTH') {
        matchesDate = inv.invoiceDate >= firstDayOfMonth && inv.invoiceDate <= today;
      } else if (dateFilterMode === 'CUSTOM') {
        matchesDate = (!dateFrom || inv.invoiceDate >= dateFrom) && 
                      (!dateTo || inv.invoiceDate <= dateTo);
      }
      
      // Sponsor/Student (Payer) filter
      let matchesPayer = true;
      if (payerFilterMode === 'CUSTOM' && payerSearchTerm.trim() !== '') {
        let payerName = '';
        if (inv.sponsorId) {
          payerName = sponsors.find(s => s.id === inv.sponsorId)?.name || '';
        } else if (inv.studentId) {
          const st = students.find(s => s.id === inv.studentId);
          payerName = st ? `${st.lastName}, ${st.firstName}` : '';
        }
        matchesPayer = payerName.toLowerCase().includes(payerSearchTerm.trim().toLowerCase());
      } else {
        const matchesSponsor = filterSponsorId === 'ALL' || inv.sponsorId === filterSponsorId;
        const matchesStudent = filterStudentId === 'ALL' || inv.studentId === filterStudentId;
        matchesPayer = matchesSponsor && matchesStudent;
      }

      return matchesSearch && matchesStatus && matchesDate && matchesPayer;
    }).sort((a, b) => {
      if (sortConfig.direction === 'none') return 0;
      
      const key = sortConfig.key;
      let valA: any = (a as any)[key];
      let valB: any = (b as any)[key];

      // Handle specific keys that need derivation
      if (key === 'payer') {
        const payerA = getInvoicePayerName(a);
        const payerB = getInvoicePayerName(b);
        valA = payerA || '';
        valB = payerB || '';
      }

      if (key === 'invoiceDate') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (key === 'postPeriod') {
        const dateA = new Date(a.invoiceDate);
        const dateB = new Date(b.invoiceDate);
        valA = Number.isNaN(dateA.getTime()) ? 0 : (dateA.getFullYear() * 100) + (dateA.getMonth() + 1);
        valB = Number.isNaN(dateB.getTime()) ? 0 : (dateB.getFullYear() * 100) + (dateB.getMonth() + 1);
      }

      if (key === 'createdBy') {
        valA = getCreatedByName(a.createdBy);
        valB = getCreatedByName(b.createdBy);
      }

      if (key === 'createdOn') {
        valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (key === 'totalAmount') {
        valA = a.grandTotal;
        valB = b.grandTotal;
      }

      if (key === 'balance') {
        valA = a.balanceDue;
        valB = b.balanceDue;
      }

      if (typeof valA === 'string') {
        const comparison = valA.localeCompare(valB);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      const comparison = (valA || 0) - (valB || 0);
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [invoices, debouncedSearchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, filterSponsorId, filterStudentId, sponsors, students, users, sortConfig, payerFilterMode, payerSearchTerm]);

  const {
    currentPage: fallbackCurrentPage,
    totalPages: fallbackTotalPages,
    pageStartIndex: fallbackPageStartIndex,
    pageEndIndex: fallbackPageEndIndex,
    paginatedRows: fallbackPaginatedInvoices,
    setCurrentPage: setFallbackCurrentPage
  } = usePaginatedRows(filteredInvoices, [debouncedSearchTerm, statusFilter, dateFilterMode, dateFrom, dateTo, filterSponsorId, filterStudentId, payerFilterMode, payerSearchTerm, sortConfig], INVOICE_PAGE_SIZE);

  const useFallbackRows = !serverFetchEnabled || !!pageLoadError;
  const paginatedInvoices = useFallbackRows ? fallbackPaginatedInvoices : (serverInvoices || []);
  const totalInvoices = useFallbackRows ? filteredInvoices.length : serverTotal;
  const totalPages = useFallbackRows ? fallbackTotalPages : serverTotalPages;
  const currentPage = useFallbackRows ? fallbackCurrentPage : serverCurrentPage;
  const pageStartIndex = useFallbackRows ? fallbackPageStartIndex : (serverCurrentPage - 1) * INVOICE_PAGE_SIZE;
  const pageEndIndex = useFallbackRows ? fallbackPageEndIndex : Math.min(pageStartIndex + (serverInvoices?.length || 0), serverTotal);
  const setCurrentPage = useFallbackRows ? setFallbackCurrentPage : setServerCurrentPage;

  // Summary stats
  const stats = useMemo(() => {
    const draft = invoices.filter(i => i.status === 'DRAFT' || i.status === 'ON_HOLD');
    const open = invoices.filter(i => i.status === 'OPEN');
    const closed = invoices.filter(i => i.status === 'CLOSED');
    const voided = invoices.filter(i => i.status === 'VOIDED');
    const totalOutstanding = open.reduce((sum, i) => sum + i.balanceDue, 0);
    const totalEwt = invoices.filter(i => i.status !== 'VOIDED').reduce((sum, i) => sum + i.totalEwtAmount, 0);
    return { draft, open, closed, voided, totalOutstanding, totalEwt };
  }, [invoices]);

  // Header Sort Toggle
  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={12} className="ml-1 text-blue-600" /> 
      : <ChevronDown size={12} className="ml-1 text-blue-600" />;
  };

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: currency || 'PHP' }).format(amount);
  };
  const currencySymbol = (currency || 'PHP') === 'PHP' ? '₱' : (currency || 'PHP');
  const formatCurrencyNumber = (amount: number) =>
    new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
  const renderAccountingAmount = (amount: number) => (
    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 font-medium text-gray-800 tabular-nums">
      <span className="text-left">{currencySymbol}</span>
      <span className="truncate text-right">{formatCurrencyNumber(amount)}</span>
    </span>
  );

  const getStatusBadge = (status: InvoiceStatus, className = '') => {
    const badges: Record<InvoiceStatus, { bg: string; text: string; label: string; title?: string }> = {
      'DRAFT': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'ON HOLD', title: 'Invoice saved as draft, pending approval' },
      'ON_HOLD': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'ON HOLD', title: 'Invoice saved as draft, pending approval' },
      'OPEN': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'OPEN' },
      'CLOSED': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'CLOSED' },
      'VOIDED': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'VOIDED' }
    };
    const badge = badges[status];
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.bg} ${badge.text} ${className}`} title={badge.title || ''}>{badge.label}</span>;
  };

  function getSponsorName(id?: string) {
    return sponsors.find(s => s.id === id)?.name || '-';
  }
  function getStudentName(id?: string) {
    const s = students.find(st => st.id === id);
    return s ? `${s.lastName}, ${s.firstName}` : '-';
  }
  function getInvoicePayerName(invoice: Pick<Invoice, 'documentType' | 'sponsorId' | 'studentId'>) {
    if (invoice.sponsorId) return getSponsorName(invoice.sponsorId);
    if (invoice.studentId) return getStudentName(invoice.studentId);
    return '-';
  }
  const getBatchCode = (id?: string) => batches.find(b => b.id === id)?.batchCode || '-';
  const normalizeGlReference = (value?: string) => {
    const ref = (value || '').trim();
    if (!ref) return '';
    const match = ref.match(/^GL(?:\s*No\.?)?[\s-]*(\d+)$/i);
    if (!match) return '';
    return `GL${match[1].padStart(8, '0')}`;
  };
  const resolveInvoiceJournalTarget = (invoice: Invoice) => {
    const sourceInvoiceId = (invoice.id || '').trim();
    const invoiceGlRef = (invoice.glEntryNumber || '').trim();
    const matchedJournal = journalEntries.find(j =>
      j.id === invoice.journalEntryId ||
      (sourceInvoiceId && String(j.sourceType || '').toUpperCase() === 'INVOICE' && j.sourceRef === sourceInvoiceId) ||
      (invoiceGlRef && (j.glEntryNumber || j.reference || '').trim() === invoiceGlRef)
    );

    return (
      matchedJournal?.id ||
      invoice.journalEntryId ||
      matchedJournal?.glEntryNumber ||
      matchedJournal?.reference ||
      invoiceGlRef ||
      ''
    ).trim();
  };

  const getInvoiceGlRef = (invoice: Invoice) => {
    if (invoice.journalEntryId) {
      const je = journalEntries.find(j =>
        j.id === invoice.journalEntryId ||
        (String(j.sourceType || '').toUpperCase() === 'INVOICE' && j.sourceRef === invoice.id)
      );
      const glNum = normalizeGlReference(je?.glEntryNumber || je?.reference);
      if (glNum) return glNum;
    }
    const sourceMatch = journalEntries.find(j =>
      String(j.sourceType || '').toUpperCase() === 'INVOICE' &&
      j.sourceRef === invoice.id
    );
    const sourceGlNum = normalizeGlReference(sourceMatch?.glEntryNumber || sourceMatch?.reference);
    if (sourceGlNum) return sourceGlNum;
    const invoiceGlNum = normalizeGlReference(invoice.glEntryNumber);
    if (invoiceGlNum) return invoiceGlNum;
    return '-';
  };

  const editingInvoiceJournalEntry = useMemo(() => {
    if (!editingInvoice) return null;
    const journalTarget = resolveInvoiceJournalTarget(editingInvoice);
    const invoiceGlRef = (editingInvoice.glEntryNumber || '').trim();
    return journalEntries.find(j =>
      j.id === editingInvoice.journalEntryId ||
      (journalTarget && j.id === journalTarget) ||
      (String(j.sourceType || '').toUpperCase() === 'INVOICE' && j.sourceRef === editingInvoice.id) ||
      (invoiceGlRef && (j.glEntryNumber || j.reference || '').trim() === invoiceGlRef)
    ) || null;
  }, [editingInvoice, journalEntries]);

  const escapeHtml = (value: any): string =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatInputCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
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

  function getCreatedByName(createdBy?: string) {
    if (!createdBy) return '-';
    if (createdBy === 'system') return 'System';
    const user = users.find(u => u.id === createdBy);
    if (creatorNameMap[createdBy]) return creatorNameMap[createdBy];
    if (currentUser && (currentUser.id === createdBy || (currentUser as any).authUid === createdBy)) {
      const parts = [currentUser.name, currentUser.lastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : currentUser.email || createdBy;
    }
    const matchedUser = users.find(u => u.id === createdBy || (u as any).authUid === createdBy) || user;
    if (matchedUser) {
      if (matchedUser.lastName && matchedUser.name && !matchedUser.name.includes(matchedUser.lastName)) {
        return `${matchedUser.name} ${matchedUser.lastName}`;
      }
      return matchedUser.name || matchedUser.email || createdBy;
    }
    return createdBy;
  };

  const parseInputCurrency = (value: string) => {
    const cleaned = value.replace(/,/g, '').replace(/[₱\s]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // ── Export helpers ──────────────────────────────────────────────
  const getDisplayStatusLabel = (s: InvoiceStatus) => {
    const map: Record<InvoiceStatus, string> = { DRAFT: 'ON HOLD', ON_HOLD: 'ON HOLD', OPEN: 'OPEN', CLOSED: 'CLOSED', VOIDED: 'VOIDED' };
    return map[s] || s;
  };

  type RelatedTransactionHistoryRow = {
    id: string;
    date: string;
    transactionType: 'Invoice' | 'Payment' | 'Application';
    referenceNo: string;
    glReference: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    balanceAfter: number;
    status: string;
    statusClass: string;
    actionJournalTarget?: string;
  };

  const getRelatedTransactionStatusClass = (status: string) => {
    switch (status) {
      case 'POSTED':
      case 'OPEN':
      case 'CLOSED':
        return 'bg-emerald-100 text-emerald-700';
      case 'ON HOLD':
      case 'DRAFT':
        return 'bg-blue-100 text-blue-700';
      case 'VOIDED':
      case 'REVERSED':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getPaymentApplicationGlReference = (application: any) => {
    const directReference = normalizeGlReference(application?.glReference);
    if (directReference) return directReference;
    const journalEntry = journalEntries.find(j => j.id === application?.journalEntryId);
    const journalReference = normalizeGlReference(journalEntry?.glEntryNumber || journalEntry?.reference);
    return journalReference || '-';
  };

  const activeRelatedHistoryInvoice = showViewModal ? resolvedViewingInvoice : editingInvoice;

  const relatedTransactionHistoryRows = useMemo<RelatedTransactionHistoryRow[]>(() => {
    if (!activeRelatedHistoryInvoice) return [];

    const invoiceAmount = Number(activeRelatedHistoryInvoice.netAmountDue ?? activeRelatedHistoryInvoice.grandTotal ?? 0);
    const events: Array<Omit<RelatedTransactionHistoryRow, 'balanceAfter'> & { sequence: number; affectsBalance?: boolean }> = [
      {
        id: `invoice-${activeRelatedHistoryInvoice.id}`,
        date: activeRelatedHistoryInvoice.invoiceDate || activeRelatedHistoryInvoice.createdAt || '',
        transactionType: 'Invoice',
        referenceNo: activeRelatedHistoryInvoice.invoiceNo || '-',
        glReference: getInvoiceGlRef(activeRelatedHistoryInvoice),
        description: activeRelatedHistoryInvoice.notes || 'Invoice created',
        debitAmount: invoiceAmount,
        creditAmount: 0,
        status: getDisplayStatusLabel(activeRelatedHistoryInvoice.status),
        statusClass: getRelatedTransactionStatusClass(getDisplayStatusLabel(activeRelatedHistoryInvoice.status)),
        actionJournalTarget: resolveInvoiceJournalTarget(activeRelatedHistoryInvoice),
        sequence: 0,
        affectsBalance: true,
      },
    ];

    payments
      .filter(payment =>
        !payment.isDeleted &&
        payment.status !== 'VOIDED' &&
        (
          payment.sourceInvoiceId === activeRelatedHistoryInvoice.id ||
          (payment.applications || []).some(app => app.invoiceId === activeRelatedHistoryInvoice.id && !app.isReversed)
        )
      )
      .forEach((payment, paymentIndex) => {
        const activeApplications = (payment.applications || []).filter(
          app => app.invoiceId === activeRelatedHistoryInvoice.id && !app.isReversed
        );
        const paymentStatus = payment.status === 'POSTED' || payment.status === 'OPEN' || payment.status === 'CLOSED'
          ? 'POSTED'
          : payment.status;
        const paymentGlReference = normalizeGlReference(payment.glEntryNumber) || '-';
        const paymentJournalTarget = payment.journalEntryId || payment.glEntryNumber || '';

        if (payment.sourceInvoiceId === activeRelatedHistoryInvoice.id) {
          events.push({
            id: `payment-${payment.id}`,
            date: payment.paymentDate || payment.createdAt || '',
            transactionType: 'Payment',
            referenceNo: payment.paymentNo || '-',
            glReference: paymentGlReference,
            description: payment.notes || 'Payment received',
            debitAmount: 0,
            creditAmount: Number(payment.amountReceived || 0),
            status: paymentStatus,
            statusClass: getRelatedTransactionStatusClass(paymentStatus),
            actionJournalTarget: paymentJournalTarget,
            sequence: 10 + paymentIndex * 10,
            affectsBalance: activeApplications.length === 0,
          });
        }

        activeApplications.forEach((application, applicationIndex) => {
          const applicationStatus = application.isReversed ? 'REVERSED' : 'POSTED';
          events.push({
            id: `application-${application.id}`,
            date: application.createdAt || payment.paymentDate || payment.createdAt || '',
            transactionType: 'Application',
            referenceNo: application.applicationNo || `${payment.paymentNo}-APP-${applicationIndex + 1}`,
            glReference: getPaymentApplicationGlReference(application),
            description: `Payment applied from ${payment.paymentNo || 'payment'}`,
            debitAmount: 0,
            creditAmount: Number(application.amountApplied || 0),
            status: applicationStatus,
            statusClass: getRelatedTransactionStatusClass(applicationStatus),
            actionJournalTarget: application.journalEntryId || application.glReference,
            sequence: 11 + paymentIndex * 10 + applicationIndex,
            affectsBalance: true,
          });
        });
      });

    let runningBalance = 0;
    return events
      .sort((a, b) => {
        const dateDiff = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
        return dateDiff || a.sequence - b.sequence;
      })
      .map(event => {
        if (event.affectsBalance !== false) {
          runningBalance += event.debitAmount - event.creditAmount;
        }
        return {
          id: event.id,
          date: event.date,
          transactionType: event.transactionType,
          referenceNo: event.referenceNo,
          glReference: event.glReference,
          description: event.description,
          debitAmount: event.debitAmount,
          creditAmount: event.creditAmount,
          balanceAfter: runningBalance,
          status: event.status,
          statusClass: event.statusClass,
          actionJournalTarget: event.actionJournalTarget,
        };
      });
  }, [activeRelatedHistoryInvoice, payments, journalEntries]);

  const {
    currentPage: relatedHistoryPage,
    totalPages: relatedHistoryTotalPages,
    pageStartIndex: relatedHistoryStartIndex,
    pageEndIndex: relatedHistoryEndIndex,
    paginatedRows: paginatedRelatedHistoryRows,
    setCurrentPage: setRelatedHistoryPage,
  } = usePaginatedRows(relatedTransactionHistoryRows, [activeRelatedHistoryInvoice?.id, showViewModal], 5);

  const renderRelatedTransactionHistory = () => (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-col gap-3 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-gray-800">Related Transaction History</h4>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-500" title="Payments and applications linked to this invoice">
              i
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-gray-500">
            View payments, applications, adjustments, and other transactions linked to this invoice.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showViewModal) setShowViewModal(false);
            onNavigate?.('customer-ledger', { invoice: activeRelatedHistoryInvoice });
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-100"
        >
          <BookText size={14} />
          View Customer Ledger
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-[12px]">
          <thead className="bg-white text-[10px] uppercase tracking-wide text-gray-500">
            <tr className="border-b border-gray-200">
              <th className="px-3 py-3 text-left font-black">Date</th>
              <th className="px-3 py-3 text-left font-black">Transaction Type</th>
              <th className="px-3 py-3 text-left font-black">Reference No.</th>
              <th className="px-3 py-3 text-left font-black">GL Reference No.</th>
              <th className="px-3 py-3 text-left font-black">Description</th>
              <th className="px-3 py-3 text-right font-black">Debit / Charges ({currency || 'PHP'})</th>
              <th className="px-3 py-3 text-right font-black">Credit / Payments ({currency || 'PHP'})</th>
              <th className="px-3 py-3 text-right font-black">Balance After ({currency || 'PHP'})</th>
              <th className="px-3 py-3 text-left font-black">Status</th>
              <th className="px-3 py-3 text-center font-black">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRelatedHistoryRows.map(row => {
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">
                    {row.date ? format(new Date(row.date), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">{row.transactionType}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">{row.referenceNo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-600">{row.glReference}</td>
                  <td className="min-w-56 px-3 py-3 text-gray-600">{row.description}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">
                    {row.debitAmount > 0 ? formatCurrency(row.debitAmount) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-gray-700">
                    {row.creditAmount > 0 ? formatCurrency(row.creditAmount) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-gray-800">
                    {formatCurrency(row.balanceAfter)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-gray-700">{row.status}</td>
                  <td className="px-3 py-3 text-center">
                    {row.actionJournalTarget && onViewJournal ? (
                      <button
                        type="button"
                        onClick={() => onViewJournal(row.actionJournalTarget!)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                        title="View related journal entry"
                      >
                        <Eye size={15} />
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={relatedHistoryPage}
        totalPages={relatedHistoryTotalPages}
        totalItems={relatedTransactionHistoryRows.length}
        pageStartIndex={relatedHistoryStartIndex}
        pageEndIndex={relatedHistoryEndIndex}
        onPageChange={setRelatedHistoryPage}
        itemLabel="transactions"
      />
    </div>
  );

  const getRegistryExportColumns = () => {
    const allColumns = [
      { key: 'invoiceDate', label: 'Date', value: (inv: Invoice) => inv.invoiceDate ? format(new Date(inv.invoiceDate), 'MM-dd-yyyy') : '-' },
      { key: 'postPeriod', label: 'Post Period', value: (inv: Invoice) => formatPostPeriod(inv.invoiceDate) || '-' },
      { key: 'invoiceNo', label: 'Invoice No.', value: (inv: Invoice) => inv.invoiceNo || '-' },
      { key: 'status', label: 'Status', value: (inv: Invoice) => getDisplayStatusLabel(inv.status) },
      { key: 'glReference', label: 'GL Reference No.', value: (inv: Invoice) => getInvoiceGlRef(inv) },
      { key: 'payer', label: 'Sponsor/Student', value: (inv: Invoice) => getInvoicePayerName(inv) },
      { key: 'totalAmount', label: 'Grand Total', value: (inv: Invoice) => inv.grandTotal ?? 0 },
      { key: 'balance', label: 'Balance', value: (inv: Invoice) => inv.balanceDue ?? 0 },
      { key: 'createdBy', label: 'Created By', value: (inv: Invoice) => getCreatedByName(inv.createdBy) },
      { key: 'createdOn', label: 'Created On', value: (inv: Invoice) => formatCreatedOn(inv.createdAt) },
    ];

    const ordered = columnOrder.map(key => allColumns.find(c => c.key === key)).filter(Boolean) as typeof allColumns;
    return ordered;
  };

  const getExportRows = () => {
    const columns = getRegistryExportColumns();
    return filteredInvoices.map(inv => {
      const row: Record<string, any> = {};
      columns.forEach(col => {
        row[col.label] = col.value(inv);
      });
      return row;
    });
  };

  const exportToExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No invoices to export.'); return; }
    const columns = getRegistryExportColumns();
    const headers = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
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
    a.download = `Invoice_Registry_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const rows = getExportRows();
    if (rows.length === 0) { alert('No invoices to export.'); return; }
    const columns = getRegistryExportColumns();
    const cols = columns.map(c => c.label);
    const esc = (v: any) => escapeHtml(v);
    const orgName = organization?.name || 'Invoice Registry';
    let html = `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice Registry</title><style>
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
    html += `<div class="subtitle">Invoice Registry &mdash; Exported ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} &mdash; ${rows.length} record(s)</div>`;
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

  const buildInvoiceA4Html = (invoice: Invoice): string => {
    const billedTo = getInvoicePayerName(invoice);
    const billAddress = invoice.sponsorId
      ? (sponsors.find(s => s.id === invoice.sponsorId)?.address || '-')
      : (() => {
        const s = students.find(st => st.id === invoice.studentId);
        return s ? [s.street, s.barangay, s.district, s.city, s.province].filter(Boolean).join(', ') : '-';
      })();
    const glRef = getInvoiceGlRef(invoice);
    const orgName = organization?.name || 'Tenant Organization';
    const logoUrl = organization?.logoUrl || '';
    const notesText = invoice.notes || `Invoice No: ${invoice.invoiceNo} - ${billedTo}`;
    const signatoriesHtml = signatoryLabels.map(label => `
      <div class="sign-box">
        <div class="sign-label">${escapeHtml(label)}</div>
        <div class="sign-line"></div>
        <div class="sign-footer">NAME &amp; SIGNATURE</div>
      </div>
    `).join('');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Invoice ${escapeHtml(invoice.invoiceNo)}</title>
    <style>
      @page { size: A4; margin: 0; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      body { margin: 0; font-family: Inter, "Open Sans", "Segoe UI", Arial, sans-serif; color:#111827; }
      .page { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 16mm; box-sizing: border-box; overflow: hidden; }
      .content { position: relative; z-index: 1; }
      .watermark {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(-20deg);
        font-size: 78px;
        font-weight: 900;
        color: rgba(16, 185, 129, 0.16);
        letter-spacing: 0.2em;
        pointer-events: none;
        user-select: none;
        z-index: 0;
      }
      .muted { color:#6b7280; font-size:12px; }
      table { width:100%; border-collapse: collapse; font-size:12px; }
      .band { background:${invoicePrintAccent} !important; color:#fff !important; font-weight:700; }
      .totals { margin-left:auto; width:300px; font-size:12px; }
      .totals div { display:flex; justify-content:space-between; padding:4px 0; }
      .totals .grand { font-weight:700; border-top:1px solid ${invoicePrintAccent}; margin-top:4px; padding-top:6px; }
      .print-box { border:1px solid ${invoicePrintAccent}; border-radius:4px; overflow:hidden; }
      .notes { margin-top:28px; font-size:12px; }
      .notes-title { color:${invoicePrintAccent}; font-weight:800; text-transform:uppercase; margin-bottom:6px; }
      .signatories { margin-top:18px; display:grid; grid-template-columns:repeat(3,1fr); border:1px solid ${invoicePrintAccent}; border-radius:4px; overflow:hidden; }
      .sign-box { min-height:116px; display:flex; flex-direction:column; border-right:1px solid ${invoicePrintAccent}; }
      .sign-box:last-child { border-right:0; }
      .sign-label { padding:10px 12px; font-size:11px; font-weight:800; text-transform:uppercase; }
      .sign-line { margin:44px 28px 22px; border-bottom:1px solid #111827; flex:1; }
      .sign-footer { background:${invoicePrintAccent} !important; color:#fff !important; text-align:center; font-weight:800; padding:7px; font-size:11px; }
      @media print {
        body { background:#fff !important; }
        .band, .sign-footer { background:${invoicePrintAccent} !important; color:#fff !important; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      ${isPaidInvoice(invoice) ? '<div class="watermark">PAID</div>' : ''}
      <div class="content">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Tenant logo" style="max-width:300px;max-height:90px;object-fit:contain;" />` : `<div style="font-size:28px;font-weight:800;">${escapeHtml(orgName)}</div>`}
          <div style="margin-top:8px;font-size:13px;">${escapeHtml(orgName)}</div>
        </div>
        <div style="text-align:left;min-width:310px;">
          <div style="font-size:44px;font-weight:700;line-height:1;margin-bottom:8px;">Invoice</div>
          <table style="font-size:14px;">
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;">Reference No.:</td><td style="padding:2px 0;text-align:right;">${escapeHtml(invoice.invoiceNo)}</td></tr>
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;">Date:</td><td style="padding:2px 0;text-align:right;">${escapeHtml(invoice.invoiceDate)}</td></tr>
            <tr><td style="padding:2px 8px 2px 0;font-weight:700;">Due Date:</td><td style="padding:2px 0;text-align:right;">${escapeHtml(invoice.dueDate)}</td></tr>
          </table>
        </div>
      </div>
      <div style="margin-top:6px;font-size:13px;white-space:pre-line;">${escapeHtml(organization?.taxId || '')}</div>

      <table class="print-box" style="margin-top:18px;">
        <thead>
          <tr class="band">
            <th style="padding:4px;text-align:left;">BILL TO:</th>
            <th style="padding:4px;text-align:left;">SHIP TO:</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px 4px;vertical-align:top;white-space:pre-line;">${escapeHtml(`${billedTo}\n${billAddress}`)}</td>
            <td style="padding:6px 4px;vertical-align:top;white-space:pre-line;">${escapeHtml(`${billedTo}\n${billAddress}`)}</td>
          </tr>
        </tbody>
      </table>

      <table class="print-box" style="margin-top:14px;">
        <thead>
          <tr class="band">
            <th style="padding:4px;text-align:left;">CUSTOMER REF. NBR.</th>
            <th style="padding:4px;text-align:left;">TERMS</th>
            <th style="padding:4px;text-align:left;">CONTACT</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:4px;">${escapeHtml(glRef)}</td>
            <td style="padding:4px;">${escapeHtml(invoice.terms || '-')}</td>
            <td style="padding:4px;">${escapeHtml(invoice.sponsorId ? (sponsors.find(s => s.id === invoice.sponsorId)?.contactPerson || '-') : (students.find(s => s.id === invoice.studentId)?.contactNumber || '-'))}</td>
          </tr>
        </tbody>
      </table>

      <table class="print-box" style="margin-top:18px;">
        <thead>
          <tr class="band">
            <th style="padding:6px;text-align:left;">NO.</th>
            <th style="padding:6px;text-align:left;">ITEM</th>
            <th style="padding:6px;text-align:right;">QTY.</th>
            <th style="padding:6px;text-align:right;">UOM</th>
            <th style="padding:6px;text-align:right;">UNIT PRICE</th>
            <th style="padding:6px;text-align:right;">DISC.</th>
            <th style="padding:6px;text-align:right;">TOTAL AMOUNT</th>
          </tr>
        </thead>
        <tbody>${(invoice.lines || []).map((line, idx) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(line.description)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(line.quantity || 0)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">EA</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(line.unitPrice || 0))}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">0%</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(line.amount || 0))}</td>
          </tr>
        `).join('')}</tbody>
      </table>

      <div class="totals">
        <div><span class="muted">Subtotal</span><strong>${escapeHtml(formatCurrency(invoice.subtotal || 0))}</strong></div>
        <div><span class="muted">VAT</span><strong>${escapeHtml(formatCurrency(invoice.vatAmount || 0))}</strong></div>
        <div class="grand"><span>Grand Total</span><span>${escapeHtml(formatCurrency(invoice.grandTotal || 0))}</span></div>
        <div><span class="muted">Net Amount Due</span><strong>${escapeHtml(formatCurrency(invoice.netAmountDue || 0))}</strong></div>
        <div><span class="muted">Amount Paid</span><strong>${escapeHtml(formatCurrency(invoice.amountPaid || 0))}</strong></div>
        <div class="grand"><span>Balance Due</span><span>${escapeHtml(formatCurrency(invoice.balanceDue || 0))}</span></div>
      </div>

      <div class="notes">
        <div class="notes-title">Notes</div>
        <div>${escapeHtml(notesText)}</div>
      </div>
      <div class="signatories">${signatoriesHtml}</div>
      </div>
    </div>
  </body>
</html>`;
  };

  const buildInvoiceA4PrintHtml = (invoice: Invoice): string => {
    const html = buildInvoiceA4Html(invoice);
    return html.replace(
      '</body>',
      `<script>
        window.addEventListener('load', function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 250);
        });
        window.addEventListener('afterprint', function () {
          window.close();
        });
      </script></body>`
    );
  };

  const handlePrintA4 = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Popup blocked. Please allow popups to print the invoice.');
      return;
    }

    const html = buildInvoiceA4PrintHtml(invoice);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Revenue accounts for line items
  const revenueAccounts = useMemo(() =>
    accounts.filter(a => a.class === AccountClass.REVENUE && !a.isHeader && a.isActive),
    [accounts]
  );

  const formTotals = useMemo(() => {
    const sponsor = sponsors.find(s => s.id === formData.sponsorId);
    const totals = calculateTotals(formData.lines);
    return totals;
  }, [formData.lines, formData.sponsorId, sponsors]);

  const getAccountLabel = (account?: ChartOfAccount | null, fallback = 'Unmapped G/L Account') => {
    if (!account) return fallback;
    return `${account.code ? `${account.code} - ` : ''}${account.name}`;
  };

  const glJournalPreview = useMemo(() => {
    const sponsor = formData.sponsorId ? sponsors.find(s => s.id === formData.sponsorId) : null;
    const cashOnHandAccount = accounts.find(a =>
      !a.isHeader && a.class === AccountClass.ASSET && String(a.name || '').trim().toLowerCase() === 'cash on hand'
    );
    const operatingBankAccount = accounts.find(a =>
      !a.isHeader && a.class === AccountClass.ASSET && String(a.name || '').trim().toLowerCase() === 'cash in bank - operating'
    );
    const receivableAccount =
      accounts.find(a => a.id === (sponsor as any)?.arAccountId) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('accounts receivable') && a.class === AccountClass.ASSET && !a.isHeader) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('receivable') && a.class === AccountClass.ASSET && !a.isHeader);
    const debitAccount = isNonInvoicePayment
      ? formData.paymentMethod === 'BANK_TRANSFER' ? operatingBankAccount : cashOnHandAccount
      : receivableAccount;

    const fallbackRevenueAccount =
      accounts.find(a => a.code === '4000') ||
      accounts.find(a => (a.name || '').toLowerCase().includes('tuition') && a.class === AccountClass.REVENUE && !a.isHeader) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('revenue') && a.class === AccountClass.REVENUE && !a.isHeader) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('income') && a.class === AccountClass.REVENUE && !a.isHeader);

    const fallbackVatAccount =
      accounts.find(a => a.code === '2200') ||
      accounts.find(a => (a.name || '').toLowerCase().includes('output vat')) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('vat payable')) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('output tax')) ||
      accounts.find(a => (a.name || '').toLowerCase().includes('tax payable')) ||
      accounts.find(a => /\bvat\b/i.test(a.name || ''));

    const lines: Array<{ key: string; accountLabel: string; description: string; debit: number; credit: number; missing?: boolean }> = [];
    const grandTotal = Number(formTotals.grandTotal || 0);

    if (grandTotal > 0) {
      lines.push({
        key: 'debit',
        accountLabel: getAccountLabel(
          debitAccount,
          isNonInvoicePayment
            ? formData.paymentMethod === 'BANK_TRANSFER' ? 'Cash in Bank - Operating' : 'Cash on Hand'
            : 'Accounts Receivable'
        ),
        description: formData.sponsorId ? getSponsorName(formData.sponsorId) : getStudentName(formData.studentId),
        debit: grandTotal,
        credit: 0,
        missing: !debitAccount,
      });
    }

    formData.lines.forEach((line, idx) => {
      const account = accounts.find(a => a.id === line.glAccountId) || fallbackRevenueAccount;
      const netRevenue = Number(line.netAmount || 0);
      if (netRevenue > 0) {
        lines.push({
          key: `rev-${line.id || idx}`,
          accountLabel: getAccountLabel(account, 'Revenue Account Not Set'),
          description: line.description || `Invoice line ${idx + 1}`,
          debit: 0,
          credit: netRevenue,
          missing: !account,
        });
      } else if (netRevenue < 0) {
        lines.push({
          key: `disc-${line.id || idx}`,
          accountLabel: getAccountLabel(account, 'Discount/Adjustment Account Not Set'),
          description: line.description || `Invoice line ${idx + 1}`,
          debit: Math.abs(netRevenue),
          credit: 0,
          missing: !account,
        });
      }
    });

    const vatGrouped = new Map<string, { account?: ChartOfAccount; amount: number }>();
    formData.lines.forEach(line => {
      const amount = Number(line.vatAmount || 0);
      if (Math.abs(amount) <= 0.01) return;
      const taxCat = localTaxCats.find(tc => tc.id === line.taxCategoryId);
      const account = accounts.find(a => a.id === taxCat?.outputAccountId) || fallbackVatAccount;
      const key = account?.id || 'missing-vat';
      const current = vatGrouped.get(key) || { account, amount: 0 };
      current.amount += amount;
      vatGrouped.set(key, current);
    });

    vatGrouped.forEach((entry, key) => {
      const amount = Math.round(entry.amount * 100) / 100;
      lines.push({
        key: `vat-${key}`,
        accountLabel: getAccountLabel(entry.account, 'Output VAT Account Not Set'),
        description: `Output VAT: ${formData.invoiceNo}`,
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        missing: !entry.account,
      });
    });

    const totalDebit = Math.round(lines.reduce((sum, line) => sum + line.debit, 0) * 100) / 100;
    const totalCredit = Math.round(lines.reduce((sum, line) => sum + line.credit, 0) * 100) / 100;
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    return { lines, totalDebit, totalCredit, isBalanced };
  }, [accounts, formData, formTotals.grandTotal, localTaxCats, sponsors, students]);

  // ============================================
  // GENERATE FROM ENROLLMENTS LOGIC
  // ============================================

  // Get unbilled enrollments grouped by sponsor
  const unbilledEnrollmentsBySponsor = useMemo(() => {
    const grouped = new Map<string, Enrollment[]>();

    getBillableSponsoredEnrollments(enrollments.filter(e => e.billingStatus === 'UNBILLED'))
      .forEach(e => {
        const sponsorId = getEnrollmentSponsorId(e);
        if (!sponsorId) return;
        if (!grouped.has(sponsorId)) {
          grouped.set(sponsorId, []);
        }
        grouped.get(sponsorId)!.push(e);
      });

    return grouped;
  }, [enrollments, batches]);

  // Get sponsors with unbilled enrollments
  const sponsorsWithUnbilledEnrollments = useMemo(() => {
    return sponsors.filter(s => unbilledEnrollmentsBySponsor.has(s.id) && !s.isDeleted);
  }, [sponsors, unbilledEnrollmentsBySponsor]);

  // Sponsored batches hide once billed. Private batches stay available until every student is billed.
  // Keep currently selected batch visible while editing its own invoice.
  const selectableBatches = useMemo(() => {
    return batches.filter(batch => {
      if (batch.isDeleted) return false;
      if (batch.id === editingInvoice?.batchId) return true;
      return !isBatchFullyBilled(batch);
    });
  }, [batches, editingInvoice?.id, enrollments]);

  const selectedBatchFundingGroups = useMemo(() => {
    if (!formData.batchId) return [];
    return BillingComputationService.getBatchFundingGroups(getBillingComputationContext(), formData.batchId);
  }, [formData.batchId, enrollments, batches, sponsors, courseFees]);

  const batchStudentsForBilling = useMemo(() => {
    if (!formData.batchId) return [] as Student[];
    return getBillableStudentsForBatch(formData.batchId, editingInvoice?.studentId || formData.studentId);
  }, [formData.batchId, formData.studentId, editingInvoice?.studentId, enrollments, students, batches, invoices, editingInvoice?.id]);

  const selectableAssessmentRegistrations = useMemo(() => {
    return assessmentRegistrations.filter(registration =>
      !registration.isDeleted &&
      registration.status !== 'CANCELLED' &&
      (
        registration.billingStatus !== 'BILLED' ||
        registration.id === formData.assessmentRegistrationId ||
        registration.id === editingInvoice?.assessmentRegistrationId
      )
    );
  }, [assessmentRegistrations, formData.assessmentRegistrationId, editingInvoice?.assessmentRegistrationId]);

  // Get unbilled enrollments for selected sponsor
  const unbilledEnrollmentsForSponsor = useMemo(() => {
    if (!selectedSponsorId) return [];
    return unbilledEnrollmentsBySponsor.get(selectedSponsorId) || [];
  }, [selectedSponsorId, unbilledEnrollmentsBySponsor]);

  // Calculate preview totals for selected enrollments
  const generatePreviewTotals = useMemo(() => {
    if (selectedEnrollmentIds.size === 0) {
      return { subtotal: 0, vatAmount: 0, grandTotal: 0, netAmountDue: 0, lineItems: [], vatPricing: 'EXEMPT' as const, vatRate: 0 };
    }

    const sponsor = sponsors.find(s => s.id === selectedSponsorId);
    const vatPricing: 'EXCLUSIVE' | 'INCLUSIVE' | 'EXEMPT' = sponsor?.taxType === 'VAT' ? 'INCLUSIVE' : 'EXEMPT';
    const vatRate = 0.12; // Assuming a fixed VAT rate for generated invoices

    const enrollmentsByBatch = new Map<string, Enrollment[]>();
    selectedEnrollmentIds.forEach(enrollmentId => {
      const enrollment = enrollments.find(e => e.id === enrollmentId);
      if (enrollment) {
        const batchId = enrollment.batchId;
        if (!enrollmentsByBatch.has(batchId)) {
          enrollmentsByBatch.set(batchId, []);
        }
        enrollmentsByBatch.get(batchId)!.push(enrollment);
      }
    });

    let subtotal = 0;
    const lineItems: {
      batchId?: string;
      courseFeeId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      netAmount: number;
      vatAmount: number;
      grossAmount: number;
      amount: number;
      glAccountId?: string;
      taxCategoryId?: string;
      classificationCode?: string;
    }[] = [];

    enrollmentsByBatch.forEach((batchEnrollments, batchId) => {
      const batch = batches.find(b => b.id === batchId);
      const qualification = batch ? qualifications.find(q => q.id === batch.qualificationId) : null;
      const quantity = batch
        ? BillingComputationService.getValidEnrolledQty(getBillingComputationContext(), batch.id)
        : batchEnrollments.length;
      const activeCourseFees = courseFees.filter(cf =>
        cf.qualificationId === batch?.qualificationId &&
        cf.fundingType === getBatchCourseFeeFundingType(batch) &&
        cf.isActive &&
        !cf.isDeleted
      );
      const feeSources: Array<Partial<CourseFee>> = activeCourseFees.length > 0
        ? activeCourseFees
        : [{
            feeName: qualification
              ? `${qualification.name} - ${batch?.batchCode || 'Batch'}`
              : `Training Fee - ${batch?.batchCode || 'Unknown Batch'}`,
            amount: batchEnrollments[0]?.totalFees || 0
          }];

      feeSources.forEach(fee => {
        const unitPrice = Number(fee.amount || 0);
        const amount = Math.round(quantity * unitPrice * 100) / 100;
        const tempLine: InvoiceLine = {
          id: '',
          orgId,
          lineNumber: 0,
          description: 'category' in fee
            ? getCourseFeeDescription(fee as CourseFee)
            : (fee.feeName || ''),
          courseFeeId: fee.id,
          lineType: 'COURSE_FEE' as any,
          quantity,
          unitPrice,
          netAmount: amount,
          vatAmount: 0,
          grossAmount: amount,
          amount,
          glAccountId: fee.glAccountId,
          taxCategoryId: fee.taxCategoryId || ''
        } as any;
        const { netAmount, vatAmount, grossAmount } = computeAmounts(tempLine);

        const description = qualification
          ? `${fee.feeName || qualification.name} - ${batch?.batchCode || 'Batch'} (${quantity} student${quantity > 1 ? 's' : ''})`
          : `${fee.feeName || 'Training Fee'} - ${batch?.batchCode || 'Unknown Batch'} (${quantity} student${quantity > 1 ? 's' : ''})`;

        lineItems.push({
          batchId,
          courseFeeId: fee.id,
          description,
          quantity,
          unitPrice,
          netAmount,
          vatAmount,
          grossAmount,
          amount: grossAmount,
          glAccountId: fee.glAccountId,
          taxCategoryId: fee.taxCategoryId,
          classificationCode: qualification?.code || getClassificationCode(fee.glAccountId)
        });

        subtotal += netAmount;
      });
    });

    const vatAmount = lineItems.reduce((sum, l) => sum + l.vatAmount, 0);
    const grandTotal = lineItems.reduce((sum, l) => sum + l.grossAmount, 0);

    return { subtotal, vatAmount, grandTotal, netAmountDue: grandTotal, lineItems, vatPricing, vatRate };
  }, [selectedEnrollmentIds, selectedSponsorId, enrollments, batches, qualifications, courseFees, sponsors]);

  // Reset generate modal state
  const resetGenerateModal = () => {
    const invoiceDate = todayISO();
    setSelectedSponsorId('');
    setSelectedEnrollmentIds(new Set());
    setGenerateInvoiceDate(invoiceDate);
    setGenerateDueDate(calculateInvoiceDueDate(invoiceDate, 'Net 30'));
  };

  const handleGenerateInvoiceDateChange = (invoiceDate: string) => {
    setGenerateInvoiceDate(invoiceDate);
    setGenerateDueDate(calculateInvoiceDueDate(invoiceDate, 'Net 30'));
  };

  // Toggle enrollment selection
  const toggleEnrollmentSelection = (enrollmentId: string) => {
    setSelectedEnrollmentIds(prev => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  // Select/deselect all enrollments for sponsor
  const toggleAllEnrollments = () => {
    if (selectedEnrollmentIds.size === unbilledEnrollmentsForSponsor.length) {
      setSelectedEnrollmentIds(new Set());
    } else {
      setSelectedEnrollmentIds(new Set(unbilledEnrollmentsForSponsor.map(e => e.id)));
    }
  };

  // Handle generate invoice submission
  const handleGenerateInvoice = () => {
    if (selectedEnrollmentIds.size === 0) {
      alert('Please select at least one enrollment to bill.');
      return;
    }

    const sponsor = sponsors.find(s => s.id === selectedSponsorId);
    if (!sponsor) {
      alert('Please select a sponsor.');
      return;
    }

    const { subtotal, vatAmount, grandTotal, netAmountDue, lineItems, vatPricing, vatRate } = generatePreviewTotals;

    // Create invoice lines
    const invoiceLines: InvoiceLine[] = lineItems.map((item, idx) => ({
      id: generateUUID(),
      invoiceId: '', // Will be set below
      orgId,
      lineNumber: idx + 1,
      description: item.description,
      courseFeeId: item.courseFeeId,
      lineType: 'COURSE_FEE' as any,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      netAmount: item.netAmount,
      vatAmount: item.vatAmount,
      grossAmount: item.grossAmount,
      amount: item.grossAmount, // Use grossAmount for line item amount
      glAccountId: item.glAccountId,
      taxCategoryId: item.taxCategoryId,
      classificationCode: item.classificationCode
    }));

    // Create the invoice
    const invoiceId = generateUUID();
    const selectedBatchIds = Array.from(new Set(lineItems.map(item => item.batchId).filter(Boolean))) as string[];
    const invoice: Invoice = {
      id: invoiceId,
      orgId,
      invoiceNo: generateInvoiceNo(),
      sponsorId: selectedSponsorId,
      batchId: selectedBatchIds.length === 1 ? selectedBatchIds[0] : undefined,
      invoiceDate: generateInvoiceDate,
      dueDate: generateDueDate,
      status: 'ON_HOLD',
      vatPricing: vatPricing,
      vatRate: vatRate,
      subtotal,
      vatAmount,
      grandTotal,
      totalEwtAmount: 0,
      netAmountDue: grandTotal,
      amountPaid: 0,
      balanceDue: grandTotal,
      terms: 'Net 30',
      notes: `Generated from ${selectedEnrollmentIds.size} enrollment(s)`,
      lines: invoiceLines.map(l => ({ ...l, invoiceId })),
      createdBy: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add the invoice
    onAddInvoice(invoice);
    setRefreshKey(key => key + 1);

    // Update enrollment billing status to BILLED
    if (onUpdateEnrollment) {
      selectedEnrollmentIds.forEach(enrollmentId => {
        const enrollment = enrollments.find(e => e.id === enrollmentId);
        if (enrollment) {
          onUpdateEnrollment({
            ...enrollment,
            billingStatus: 'BILLED',
            updatedAt: new Date().toISOString()
          });
        }
      });
    }

    // Close modal and reset
    setShowGenerateModal(false);
    resetGenerateModal();
  };

  return (
    <div className="space-y-6">
      {viewMode === 'LIST' ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{documentLabelPlural}</h2>
              <p className="text-sm italic text-gray-500">{isNonInvoicePayment ? 'Record cash sales that do not create receivables' : 'Manage your invoices and billing'}</p>
            </div>
            <div className="flex items-center gap-3">
              {!isNonInvoicePayment && sponsorsWithUnbilledEnrollments.length > 0 && (
                <button
                  onClick={() => setShowGenerateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-purple-50 transition-colors text-purple-600 border-purple-300"
                >
                  <Wand2 size={18} />
                  Generate from Enrollments
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 rounded-full">
                    {Array.from(unbilledEnrollmentsBySponsor.values()).reduce((sum: number, arr) => sum + (arr as any[]).length, 0)}
                  </span>
                </button>
              )}
              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors bg-emerald-600 hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-300"
              >
                <Plus size={20} />
                New {documentLabel}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">On Hold</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.draft.length}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Open</p>
              <p className="mt-2 text-2xl font-semibold text-blue-600">{stats.open.length}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Closed</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-600">{stats.closed.length}</p>
            </div>
            <div className="bg-white rounded-md border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Outstanding</p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: brandColor }}>{formatCurrency(stats.totalOutstanding)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border-y px-4 py-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar - Far Left */}
              <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-64">
                <Search size={14} className="text-gray-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
                />
              </div>

              {/* Status Filter */}
              <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
                <span className="text-[13px] text-gray-500 mr-1">Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'ALL')}
                  className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
                >
                  <option value="ALL">All</option>
                  <option value="ON_HOLD">ON HOLD</option>
                  <option value="OPEN">OPEN</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="VOIDED">VOIDED</option>
                </select>
                <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
              </div>

              {/* Sponsor/Student Filter Dropdown */}
              <div className="relative">
                <div
                  onClick={() => setShowPayerDropdown(!showPayerDropdown)}
                  className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none max-w-[220px]"
                >
                  <span className="text-[13px] text-gray-500 mr-1 truncate">Sponsor/Student:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate">
                    {payerFilterMode === 'ALL' ? 'All' : payerFilterMode === 'CUSTOM' && payerSearchTerm ? `"${payerSearchTerm}"` : 'Custom...'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showPayerDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPayerDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button
                          onClick={() => { setSortConfig({ key: 'payer', direction: 'asc' }); setShowPayerDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'payer' && sortConfig.direction === 'asc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronUp size={14} /> Sort Ascending
                        </button>
                        <button
                          onClick={() => { setSortConfig({ key: 'payer', direction: 'desc' }); setShowPayerDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'payer' && sortConfig.direction === 'desc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronDown size={14} /> Sort Descending
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button
                          onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                        >
                          Remove Quick Filter
                        </button>
                        <button
                          onClick={() => { setPayerFilterMode('ALL'); setPayerSearchTerm(''); setShowPayerDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-100 cursor-not-allowed"
                          disabled
                        >
                          Clear Filter
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button
                          onClick={() => setPayerFilterMode('CUSTOM')}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${payerFilterMode === 'CUSTOM' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {payerFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Equal to
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Type to search..."
                            value={payerSearchTerm}
                            onChange={(e) => {
                              setPayerSearchTerm(e.target.value);
                              if (payerFilterMode !== 'CUSTOM') setPayerFilterMode('CUSTOM');
                            }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button
                            onClick={() => setShowPayerDropdown(false)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Date Filter Dropdown */}
              <div className="relative">
                <div 
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer select-none"
                >
                  <span className="text-[13px] text-gray-500 mr-1">Date:</span>
                  <span className="text-[13px] font-bold text-gray-800 pr-5 truncate max-w-[120px]">
                    {dateFilterMode === 'ALL' ? 'All' : dateFilterMode === 'TODAY' ? 'Today' : dateFilterMode === 'THIS_MONTH' ? 'This Month' : 'Between...'}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
                </div>

                {showDateDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDateDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button 
                          onClick={() => { setSortConfig({ key: 'invoiceDate', direction: 'asc' }); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'invoiceDate' && sortConfig.direction === 'asc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronUp size={14} /> Sort Ascending
                        </button>
                        <button 
                          onClick={() => { setSortConfig({ key: 'invoiceDate', direction: 'desc' }); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 flex items-center gap-2 ${sortConfig.key === 'invoiceDate' && sortConfig.direction === 'desc' ? 'font-bold text-orange-600 bg-orange-50' : 'text-gray-700'}`}
                        >
                          <ChevronDown size={14} /> Sort Descending
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button 
                          onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-gray-100"
                        >
                          Remove Quick Filter
                        </button>
                        <button 
                          onClick={() => { setDateFilterMode('ALL'); setDateFrom(''); setDateTo(''); setShowDateDropdown(false); }}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-400 hover:bg-gray-100 cursor-not-allowed"
                          disabled
                        >
                          Clear Filter
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-1">
                        <button 
                          onClick={() => { setDateFilterMode('CUSTOM'); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'CUSTOM' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {dateFilterMode === 'CUSTOM' && <CheckSquare size={14} />} Is Between
                        </button>
                        <button 
                          onClick={() => { setDateFilterMode('TODAY'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'TODAY' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {dateFilterMode === 'TODAY' && <CheckSquare size={14} />} Today
                        </button>
                        <button 
                          onClick={() => { setDateFilterMode('THIS_MONTH'); setShowDateDropdown(false); }}
                          className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 ${dateFilterMode === 'THIS_MONTH' ? 'font-bold text-blue-600 bg-blue-50' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                          {dateFilterMode === 'THIS_MONTH' && <CheckSquare size={14} />} This Month
                        </button>
                      </div>

                      <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">From:</span>
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); if(dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 font-semibold uppercase w-8">To:</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); if(dateFilterMode !== 'CUSTOM') setDateFilterMode('CUSTOM'); }}
                            className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-[12px] font-bold text-gray-800 outline-none focus:border-blue-400"
                          />
                        </div>
                        <div className="flex justify-end items-center gap-2 pt-1">
                          <button 
                            onClick={() => setShowDateDropdown(false)}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-bold text-gray-600 uppercase transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => { setShowDateDropdown(false); }}
                            className="px-4 py-1 bg-blue-600 hover:bg-blue-700 rounded text-[11px] font-bold text-white uppercase transition-colors shadow-sm"
                          >
                            OK
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Reset Button */}
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                  setDateFilterMode('ALL');
                  setDateFrom('');
                  setDateTo('');
                  setFilterSponsorId('ALL');
                  setFilterStudentId('ALL');
                }}
                className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                title="Clear all filters"
              >
                <RotateCcw size={16} />
              </button>

              {/* Export Dropdown */}
              <div className="relative ml-auto">
                <button
                  onClick={() => setShowExportDropdown(!showExportDropdown)}
                  className="flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-[13px] font-semibold shadow-sm select-none"
                  title="Export"
                >
                  <Download size={16} />
                  <span>Export</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {showExportDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)}></div>
                    <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-gray-200 shadow-xl rounded-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setShowExportDropdown(false);
                            exportToExcel();
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 rounded transition-colors"
                        >
                          <FileSpreadsheet size={16} className="text-emerald-600" />
                          Export as Excel
                        </button>
                        <button
                          onClick={() => {
                            setShowExportDropdown(false);
                            exportToPdf();
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 rounded transition-colors"
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

          {/* Invoice List */}
          {/* ──────────────────────────────────────────────────────────
              COLUMN CONFIG — Reorder items below to rearrange columns.
              Each entry drives BOTH the header and the data cell.
              ────────────────────────────────────────────────────────── */}
          {(() => {
            const baseColumns = [
              // ── 1. Date ───────────────────────────────────
              {
                key: 'invoiceDate',
                label: 'Transaction Date',
                sortKey: 'invoiceDate',
                width: 'w-32',
                align: 'text-left' as const,
                render: (inv: any) => inv.invoiceDate,
              },
              {
                key: 'postPeriod',
                label: 'Post Period',
                sortKey: 'postPeriod',
                width: 'w-28',
                align: 'text-left' as const,
                render: (inv: any) => formatPostPeriod(inv.invoiceDate) || '-',
              },
              // ── 2. Invoice No. ────────────────────────────
              {
                key: 'invoiceNo',
                label: isNonInvoicePayment ? 'Cash Invoice Number' : 'Invoice No.',
                sortKey: 'invoiceNo',
                width: 'w-40',
                align: 'text-left' as const,
                render: (inv: any) => inv.invoiceNo,
              },
              // ── 3. Status ─────────────────────────────────
              {
                key: 'status',
                label: 'Status',
                sortKey: 'status',
                width: 'w-24',
                align: 'text-left' as const,
                render: (inv: any) => getDisplayStatusLabel(inv.status),
              },
              // ── 4. GL Reference No. ───────────────────────
              {
                key: 'glReference',
                label: 'GL Reference No.',
                sortKey: 'glReference',
                width: 'w-32',
                align: 'text-left' as const,
                render: (inv: any) => getInvoiceGlRef(inv),
              },
              // ── 5. Sponsor/Student ───────────────────────
              {
                key: 'payer',
                label: 'Sponsor/Student',
                sortKey: 'payer',
                width: 'w-64',
                align: 'text-left' as const,
                render: (inv: Invoice) => getInvoicePayerName(inv),
              },
              // ── 6. Grand Total ────────────────────────────
              {
                key: 'totalAmount',
                label: 'Grand Total',
                sortKey: 'totalAmount',
                width: 'w-32',
                align: 'text-right' as const,
                render: (inv: any) => renderAccountingAmount(inv.grandTotal),
              },
              // ── 7. Balance ────────────────────────────────
              {
                key: 'balance',
                label: 'Balance',
                sortKey: 'balance',
                width: 'w-32',
                align: 'text-right' as const,
                render: (inv: any) => renderAccountingAmount(Number(inv.balanceDue ?? 0)),
              },
              {
                key: 'createdBy',
                label: 'Created By',
                sortKey: 'createdBy',
                width: 'w-40',
                align: 'text-left' as const,
                render: (inv: any) => getCreatedByName(inv.createdBy),
              },
              {
                key: 'createdOn',
                label: 'Created On',
                sortKey: 'createdOn',
                width: 'w-32',
                align: 'text-left' as const,
                render: (inv: any) => formatCreatedOn(inv.createdAt),
              },
            ];

            const registryColumns = columnOrder.map(key => baseColumns.find(c => c.key === key)).filter(Boolean) as typeof baseColumns;

            const handleDragStart = (e: React.DragEvent, index: number) => {
              setDraggedColumnIdx(index);
              e.dataTransfer.effectAllowed = 'move';
              if (e.target instanceof HTMLElement) {
                e.target.style.opacity = '0.5';
              }
            };

            const handleDragEnd = (e: React.DragEvent) => {
              setDraggedColumnIdx(null);
              if (e.target instanceof HTMLElement) {
                e.target.style.opacity = '1';
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

            return (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full font-sans">
                  <thead className="bg-emerald-600 border-b">
                    <tr>
                      {registryColumns.map((col, idx) => (
                        <th
                          key={col.key}
                          draggable
                          onDragStart={(e) => handleDragStart(e, idx)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx)}
                          className={`px-4 py-3 ${col.align} cursor-move font-semibold text-white ${draggedColumnIdx === idx ? 'bg-emerald-700 border-dashed border-2 border-emerald-300 opacity-50' : ''} group select-none transition-colors border-x border-transparent hover:bg-emerald-700 hover:border-emerald-200 relative`}
                          style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}
                          title="Drag to reorder column"
                        >
                          <div
                            className={`flex items-center ${col.align === 'text-right' ? 'justify-end' : ''} text-[13px] font-bold text-white ${col.sortKey ? 'cursor-pointer hover:text-gray-100' : ''}`}
                            onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
                          >
                            {col.label} {col.sortKey && <SortIndicator columnKey={col.sortKey} />}
                          </div>
                          {/* Resize handle */}
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
                    {totalInvoices === 0 ? (
                      <tr>
                        <td colSpan={registryColumns.length} className="px-4 py-12 text-center text-gray-500">
                          <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                          No invoices found
                        </td>
                      </tr>
                    ) : (
                      paginatedInvoices.map(inv => (
                        <tr
                          key={inv.id}
                          className={`cursor-pointer transition-colors`}
                          onClick={() => handleEdit(inv)}
                          title={inv.status === 'OPEN' ? 'Read-only: Invoice is approved and locked' : 'Click to edit'}
                        >
                          {registryColumns.map(col => (
                          <td key={col.key} className={`px-4 py-3 ${col.align}`} style={columnWidths[col.key] ? { width: columnWidths[col.key], minWidth: columnWidths[col.key] } : undefined}>
                            {col.key === 'invoiceDate' && inv.invoiceDate ? (
                              <span className="font-medium text-gray-800">{format(new Date(inv.invoiceDate), 'MM-dd-yyyy')}</span>
                            ) : (
                              <span className="font-medium text-gray-800">{col.render(inv)}</span>
                            )}
                          </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalInvoices}
                  pageStartIndex={pageStartIndex}
                  pageEndIndex={pageEndIndex}
                  onPageChange={setCurrentPage}
                  itemLabel="invoices"
                />
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {/* New/Edit Invoice Page */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col min-h-[80vh]">

            <div className="flex items-center justify-between p-4 border-b bg-brand/10">
              <div>

                <h3 className="text-xl font-bold text-gray-800" style={{ color: brandColor }}>
                  {isNonInvoicePayment ? 'Cash Invoice Number' : 'Invoice No'}: {formData.invoiceNo}
                  {(formData.sponsorId || formData.studentId) && ` - ${formData.sponsorId ? getSponsorName(formData.sponsorId) : getStudentName(formData.studentId)}`}
                </h3>
              </div>
            </div>
            {/* Action Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
              <button
                title="Discard Changes and Close"
                onClick={resetForm}
                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <RotateCcw size={20} />
              </button>
              {!isReadOnly && (
                <>
                  <button
                    title="Save as Draft"
                    onClick={handleSave}
                    disabled={!canSubmitInvoice}
                    className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={20} />
                  </button>
                  <button
                    title="Approve"
                    onClick={handleApprove}
                    disabled={!canSubmitInvoice}
                    className="p-2 text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle size={20} />
                  </button>
                </>
              )}
              <button
                title="Add New Record"
                onClick={handleNew}
                className="p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
              >
                <Plus size={20} />
              </button>
              <button
                title="Cancel"
                onClick={resetForm}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
              <div className="h-6 w-px bg-gray-200 mx-2" />
              <button
                title={payButtonTitle}
                disabled={!canPayInvoice}
                onClick={() => onNavigate?.('payments', { viewMode: 'create-payment', invoice: editingInvoice })}
                className={`p-2 rounded-lg transition-colors font-black text-[10px] leading-none flex items-center justify-center ${canPayInvoice ? 'text-emerald-600 hover:bg-emerald-50' : 'text-gray-300 cursor-not-allowed'}`}
                style={{ width: '36px', height: '36px' }}
              >
                PAY
              </button>
              <button
                title="Print"
                onClick={() => {
                  if (editingInvoice) handlePrintPreview(editingInvoice);
                  else alert('Please save the invoice before printing.');
                }}
                className="p-2 text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Printer size={20} />
              </button>
              <div className="relative group">
                <button
                  title="More Actions"
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreHorizontal size={20} />
                </button>
                <div className="absolute left-0 mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleWriteOffNavigation}
                      disabled={!canUseInvoiceActions}
                      title={canUseInvoiceActions ? 'Write off this invoice' : invoiceActionUnavailableTitle}
                      className="w-full text-left px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      <Scissors size={16} /> Write Off
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateAdjustmentNavigation}
                      disabled={!canUseInvoiceActions}
                      title={canUseInvoiceActions ? 'Create an invoice adjustment' : invoiceActionUnavailableTitle}
                      className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      <CornerUpLeft size={16} /> Create Adjustment
                    </button>
                    <button
                      type="button"
                      onClick={handleVoidInvoiceClick}
                      disabled={!canUseInvoiceActions}
                      title={canUseInvoiceActions ? 'Void this invoice' : invoiceActionUnavailableTitle}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      <Ban size={16} /> Void Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {!isReadOnly && invoiceRequiredFieldMessage && (
              <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {invoiceRequiredFieldMessage}
              </div>
            )}

            <div className="flex-1 p-6">
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-6 items-start">
                <div className="space-y-8 min-w-0">
              {/* Batch / Sponsor / Dates row */}
              <div className="bg-brand/5 rounded-lg p-4 border border-brand/20">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">

                  {!isNonInvoicePayment && <div className="min-w-0 lg:col-span-4">
                    <label className="text-xs font-medium text-gray-500">Walk-in Assessment Candidate</label>
                    <select
                      value={formData.assessmentRegistrationId}
                      onChange={e => handleAssessmentRegistrationChange(e.target.value)}
                      disabled={isReadOnly}
                      className="mt-1 px-3 py-2 border border-brand/20 rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Select walk-in candidate --</option>
                      {selectableAssessmentRegistrations.map(registration => {
                        const student = students.find(s => s.id === registration.studentId);
                        const qualification = qualifications.find(q => q.id === registration.qualificationId);
                        return (
                          <option key={registration.id} value={registration.id}>
                            {student ? `${student.lastName}, ${student.firstName}` : 'Candidate'} - {qualification?.name || 'Qualification'} ({registration.registrationCode || registration.id})
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-brand mt-1">Select the registered walk-in candidate to bill assessment fees without a training batch.</p>
                  </div>}

                  {/* batch in center */}
                  {!isNonInvoicePayment && <div className="min-w-0 lg:col-span-4">
                    <label className="text-xs font-medium text-gray-500">Select Batch</label>
                    <select
                      aria-label="Select Batch"
                      value={formData.batchId}
                      onChange={e => handleBatchChange(e.target.value)}
                      disabled={isReadOnly}
                      className="mt-2 px-3 py-2 border border-brand/20 rounded-lg focus:ring-2 focus:ring-brand/30 focus:border-brand w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Select Batch --</option>
                      {selectableBatches.map(b => (
                        <option key={b.id} value={b.id}>{b.batchCode} - {qualifications.find(q => q.id === b.qualificationId)?.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-brand mt-1">Select a batch to load course fees. Mixed cohorts support billing specific sponsors or private students.</p>

                    {formData.batchId && selectedBatchFundingGroups.length > 1 && (
                      <div className="mt-2.5 p-3 bg-brand/5 border border-brand/20 rounded-lg">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-bold text-brand uppercase tracking-wide">
                            Mixed Cohort ({selectedBatchFundingGroups.length} Funding Groups)
                          </span>
                          <span className="text-[11px] text-gray-500">
                            Select funding recipient
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedBatchFundingGroups.map(group => {
                            const isSelected = group.sponsorId
                              ? formData.sponsorId === group.sponsorId
                              : (!formData.sponsorId && !!formData.studentId);
                            return (
                              <button
                                key={group.sponsorId || 'private'}
                                type="button"
                                onClick={() => {
                                  if (group.sponsorId) {
                                    handleBatchChange(formData.batchId, group.sponsorId, '');
                                  } else {
                                    const firstPrivate = getBillableStudentsForBatch(formData.batchId)[0]?.id || '';
                                    handleBatchChange(formData.batchId, '', firstPrivate);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-brand text-white border-brand shadow-xs'
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-brand/40 hover:bg-gray-50'
                                }`}
                              >
                                {group.sponsorName}
                                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                  {group.unbilledLearners} unbilled
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>}
                  {/* sponsor and student side by side */}
                  <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isNonInvoicePayment ? 'lg:col-span-8' : 'lg:col-span-4'}`}>
                    <div className="min-w-0">
                      <label className="text-xs font-medium text-gray-500">{isNonInvoicePayment || !formData.batchId ? 'Customer / Sponsor' : 'Sponsor'}</label>
                      <select
                        aria-label="Customer / Sponsor"
                        value={formData.sponsorId}
                        onChange={e => {
                          const newSponsorId = e.target.value;
                          handleSponsorChange(newSponsorId);
                          if (formData.batchId) {
                            handleBatchChange(formData.batchId, newSponsorId, '');
                          } else if (newSponsorId) {
                            setFormData(prev => ({ ...prev, studentId: '', assessmentRegistrationId: prev.assessmentRegistrationId || '' }));
                          }
                        }}
                        disabled={(!!formData.studentId && !formData.assessmentRegistrationId) || isReadOnly}
                        className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <option value="">Select Sponsor</option>
                        {sponsors.filter(s => isNonInvoicePayment || !formData.batchId || (s.customerType || 'SPONSOR') === 'SPONSOR').map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-500">Student</label>
                        {!isReadOnly && !formData.sponsorId && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickStudent()}
                            className="text-[11px] font-semibold text-brand hover:underline flex items-center gap-0.5"
                            title="Bill an unregistered walk-in student by entering their name"
                          >
                            <Plus size={11} /> Bill Unregistered
                          </button>
                        )}
                      </div>
                      <SearchableStudentSelect
                        students={formData.batchId ? batchStudentsForBilling : students.filter(student => !student.isDeleted)}
                        value={formData.studentId}
                        onQuickAdd={!isReadOnly && !formData.sponsorId ? handleOpenQuickStudent : undefined}
                        onChange={studentId => {
                          if (formData.batchId) {
                            handleBatchChange(formData.batchId, '', studentId);
                          } else {
                            setFormData(prev => ({ ...prev, studentId, sponsorId: '', assessmentRegistrationId: prev.assessmentRegistrationId && studentId ? prev.assessmentRegistrationId : '' }));
                          }
                        }}
                        disabled={(!!formData.sponsorId && !formData.assessmentRegistrationId) || isReadOnly}
                      />
                      {formData.studentId && isProvisionalStudent(students.find(s => s.id === formData.studentId)) && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                          <AlertCircle size={12} className="shrink-0 text-amber-600" />
                          <span>Provisional learner (billed before registrar registration)</span>
                        </div>
                      )}
                      <div style={{ display: 'none' }}
                      />
                    </div>
                  </div>
                  {/* dates on right */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(9rem,1fr)] lg:col-span-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Invoice Date *</label>
                      <input
                        type="date"
                        value={formData.invoiceDate}
                        onChange={e => handleInvoiceDateChange(e.target.value)}
                        disabled={isReadOnly}
                        className="w-full min-w-[10rem] mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Due Date *</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                        disabled={isReadOnly}
                        className="w-full min-w-[10rem] mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Post Period</label>
                      <input
                        type="text"
                        value={formatPostPeriod(formData.invoiceDate)}
                        readOnly
                        className="w-full mt-1 px-3 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-200 bg-orange-50 text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Invoice No. */}
                <div>
                  <label className="text-xs font-medium text-gray-500">{isNonInvoicePayment ? 'Cash Invoice Number' : 'Invoice No.'}</label>
                  <input
                    type="text"
                    value={formData.invoiceNo}
                    readOnly
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 bg-gray-50 text-gray-900"
                  />
                </div>
                {isNonInvoicePayment && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Payment Method *</label>
                    <select
                      value={formData.paymentMethod}
                      onChange={event => setFormData(prev => ({
                        ...prev,
                        paymentMethod: event.target.value as 'CASH' | 'BANK_TRANSFER' | 'EWALLET'
                      }))}
                      disabled={isReadOnly}
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="CASH">Cash on Hand</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="EWALLET">Ewallet</option>
                    </select>
                  </div>
                )}
                {isNonInvoicePayment && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">SI No. <span className="font-normal text-gray-400">(Optional)</span></label>
                    <input
                      type="text"
                      value={formData.siNo}
                      onChange={event => setFormData(prev => ({ ...prev, siNo: event.target.value }))}
                      disabled={isReadOnly}
                      placeholder="Enter sales invoice number"
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                )}
                {/* Reference */}
                <div>
                  <label className="text-xs font-medium text-gray-500">External Reference</label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={e => setFormData({ ...formData, reference: e.target.value })}
                    disabled={isReadOnly}
                    placeholder="QRM-00000 or P.O. Number"
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Terms</label>
                  <select
                    value={formData.terms}
                    onChange={e => handleTermsChange(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="COD">COD</option>
                    <option value="Net 7">Net 7</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Transaction Description *</label>
                  <input
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    disabled={isReadOnly}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="Invoice notes or memo..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <div className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50">
                    <span className="text-[13px] font-medium text-gray-700">
                      {getDisplayStatusLabel(formData.status)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    GL Reference
                    {editingInvoice?.status === 'OPEN' && (
                      <span className="text-emerald-600 text-xs font-bold">✓ POSTED</span>
                    )}
                  </label>
                  <div className="mt-1">
                    {editingInvoice?.journalEntryId || editingInvoice?.status === 'OPEN' ? (
                      (() => {
                        const relatedJournalEntry = editingInvoiceJournalEntry;
                        const journalTarget = editingInvoice ? resolveInvoiceJournalTarget(editingInvoice as Invoice) : '';
                        const glNum = (
                          normalizeGlReference(relatedJournalEntry?.glEntryNumber) ||
                          normalizeGlReference(relatedJournalEntry?.reference) ||
                          normalizeGlReference(editingInvoice?.glEntryNumber) ||
                          `GL${editingInvoice?.journalEntryId?.slice(-8).toUpperCase()}`
                        ).trim();
                        if (!journalTarget) {
                          return (
                            <>
                              <input
                                value={formData.glEntryNumber || ''}
                                readOnly
                                placeholder="Generated when invoice is approved"
                                className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-orange-200 cursor-default"
                              />
                              <p className="text-xs text-gray-400 mt-1"></p>
                            </>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (!onViewJournal) return;
                              onViewJournal(
                                journalTarget,
                                (formData.lines || []).map(line => ({
                                  ...line,
                                  classificationCode: getInvoiceLineClassificationCode(line)
                                }))
                              );
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-base font-normal rounded-lg bg-emerald-50 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition-all w-full justify-center shadow-sm"
                            title="Open the related journal entry"
                            style={{ cursor: 'pointer' }}
                          >
                            <Receipt size={16} />
                            <span>{glNum}</span>
                            <span className="text-base font-normal text-emerald-600 ml-auto">→ View Journal Entry</span>
                          </button>
                        );
                      })()
                    ) : (
                      <>
                      <input
                        value={formData.glEntryNumber || ''}
                        readOnly
                        placeholder="Generated when invoice is approved"
                        className="w-full mt-1 px-3 py-2 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-orange-200 cursor-default"
                      />
                      <p className="text-xs text-gray-400 mt-1"></p>
                    </>
                  )}
                  </div>
                </div>
              </div>



              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700">Line Items</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportLineItemsToExcel}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      <FileSpreadsheet size={16} /> Export Line Items
                    </button>
                    <button
                      onClick={() => handleAddLine('MANUAL')}
                      disabled={isReadOnly}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-dashed hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} /> Add Line
                    </button>
                    <button
                      onClick={() => handleAddLine('DISCOUNT')}
                      disabled={isReadOnly}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Scissors size={16} /> Discount
                    </button>
                  </div>
                </div>

                {viewMode === 'FORM' && localTaxCats.length === 0 && (
                  <div className="p-2 text-red-600 bg-red-100 text-xs">
                    âš ï¸  No tax categories loaded. Please ensure your organization has entries in the <code>tax_categories</code> table and that RLS policies permit access.
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--app-text-size-13)' }}>
                    <thead className="bg-gray-50">
                      <tr>
                        {/* Column definitions for line items table */}
                        {(() => {
                          const lineColDefs = {
                            lineNumber: { key: 'lineNumber', label: '#', align: 'text-left', width: 40 },
                            lineType: { key: 'lineType', label: 'Type', align: 'text-left', width: 110 },
                            classificationCode: { key: 'classificationCode', label: 'Class', align: 'text-left', width: 120 },
                            courseFeeId: { key: 'courseFeeId', label: 'Course Fee', align: 'text-left', width: 120 },
                            description: { key: 'description', label: 'Description', align: 'text-left', width: 180 },
                            taxCategoryId: { key: 'taxCategoryId', label: 'Tax Category *', align: 'text-right', width: 120 },
                            quantity: { key: 'quantity', label: 'Qty', align: 'text-right', width: 80 },
                            unitPrice: { key: 'unitPrice', label: 'Unit Price (₱)', align: 'text-right', width: 110 },
                            amount: { key: 'amount', label: 'Amount (₱)', align: 'text-right', width: 110 },
                            actions: { key: 'actions', label: '', align: 'text-center', width: 40 },
                          };
                          const lineCellStyle = { fontFamily: 'var(--font-sans)', fontSize: 'var(--app-text-size-13)' };
                          return lineColOrder.map((colKey, idx) => {
                            const col = lineColDefs[colKey];
                            return (
                              <th
                                key={col.key}
                                className={`px-3 py-2 ${col.align} relative select-none ${draggedLineColIdx === idx ? 'bg-gray-100 border-dashed border-2 border-gray-300 opacity-50' : ''}`}
                                style={lineColWidths[col.key] ? { width: lineColWidths[col.key], minWidth: lineColWidths[col.key] } : { minWidth: col.width, width: col.width }}
                                draggable={!isReadOnly && col.key !== 'actions'}
                                onDragStart={e => {
                                  if (isReadOnly || col.key === 'actions') return;
                                  setDraggedLineColIdx(idx);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragEnd={e => {
                                  setDraggedLineColIdx(null);
                                }}
                                onDragOver={e => {
                                  if (isReadOnly || col.key === 'actions') return;
                                  e.preventDefault();
                                }}
                                onDrop={e => {
                                  if (isReadOnly || col.key === 'actions' || draggedLineColIdx === null || draggedLineColIdx === idx) return;
                                  e.preventDefault();
                                  const newOrder = [...lineColOrder];
                                  const [draggedKey] = newOrder.splice(draggedLineColIdx, 1);
                                  newOrder.splice(idx, 0, draggedKey);
                                  setLineColOrder(newOrder);
                                  setDraggedLineColIdx(null);
                                }}
                                title={col.key !== 'actions' ? 'Drag to reorder column' : undefined}
                              >
                                <div className="flex items-center">
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
                                      className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize hover:bg-orange-400 transition-colors z-10"
                                      title="Drag to resize column"
                                      draggable={false}
                                    />
                                  )}
                                </div>
                              </th>
                            );
                          });
                        })()}
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                            No line items. Click "Add Line" to add items.
                          </td>
                        </tr>
                      ) : (
                        formData.lines.map((line, idx) => {
                          const isDragging = draggedLineIdx === idx;
                          const isDropTarget = lineDropIdx === idx && draggedLineIdx !== null && draggedLineIdx !== idx;
                          // Render cells in the current column order
                          const lineColDefs = {
                            lineNumber: { key: 'lineNumber' },
                            lineType: { key: 'lineType' },
                            classificationCode: { key: 'classificationCode' },
                            courseFeeId: { key: 'courseFeeId' },
                            description: { key: 'description' },
                            taxCategoryId: { key: 'taxCategoryId' },
                            quantity: { key: 'quantity' },
                            unitPrice: { key: 'unitPrice' },
                            amount: { key: 'amount' },
                            actions: { key: 'actions' },
                          };
                          return (
                            <tr
                              key={line.id || idx}
                              className={`border-t ${isDragging ? 'opacity-40 bg-orange-100' : isDropTarget ? 'bg-orange-50 border-2 border-orange-400' : ''}`}
                              draggable={!isReadOnly}
                              onDragStart={e => {
                                if (isReadOnly) return;
                                setDraggedLineIdx(idx);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={e => {
                                setDraggedLineIdx(null);
                                setLineDropIdx(null);
                              }}
                              onDragOver={e => {
                                if (isReadOnly) return;
                                e.preventDefault();
                                setLineDropIdx(idx);
                              }}
                              onDrop={e => {
                                if (isReadOnly || draggedLineIdx === null || draggedLineIdx === idx) return;
                                e.preventDefault();
                                const newLines = [...formData.lines];
                                const [dragged] = newLines.splice(draggedLineIdx, 1);
                                newLines.splice(idx, 0, dragged);
                                // Re-number lineNumber fields
                                newLines.forEach((l, i) => l.lineNumber = i + 1);
                                setFormData(prev => ({ ...prev, lines: newLines }));
                                setDraggedLineIdx(null);
                                setLineDropIdx(null);
                              }}
                              style={{ cursor: isReadOnly ? 'default' : 'move' }}
                            >
                              {lineColOrder.map(colKey => {
                                switch (colKey) {
                                  case 'lineNumber':
                                    return <td key={colKey} className="px-3 py-2 text-gray-400" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>{line.lineNumber}</td>;
                                  case 'lineType':
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <select
                                        value={getLineType(line)}
                                        onChange={e => handleUpdateLine(idx, 'lineType', e.target.value as any)}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 rounded text-[12px] font-semibold text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        <option value="COURSE_FEE">COURSE FEE</option>
                                        <option value="DISCOUNT">DISCOUNT</option>
                                        <option value="ADJUSTMENT">ADJUSTMENT</option>
                                        <option value="MANUAL">MANUAL</option>
                                      </select>
                                    </td>;
                                  case 'classificationCode': {
                                    // Find qualification code via courseFeeId
                                    let qualCode = '';
                                    if (line.courseFeeId) {
                                      const fee = courseFees.find(f => f.id === line.courseFeeId);
                                      if (fee) {
                                        const qual = qualifications.find(q => q.id === fee.qualificationId);
                                        qualCode = qual?.code || '';
                                      }
                                    }
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <span className="block text-[13px] font-normal text-gray-700">{qualCode || <span className="text-gray-300">—</span>}</span>
                                    </td>;
                                  }
                                  case 'courseFeeId':
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      {(isNonInvoicePayment || !formData.batchId) ? (
                                        <SearchableCourseFeeSelect
                                          fees={getSelectableCourseFeesForLine(line)}
                                          value={line.courseFeeId || ''}
                                          onChange={courseFeeId => handleApplyCourseFee(idx, courseFeeId)}
                                          disabled={isReadOnly}
                                          listId={`non-invoice-course-fees-${line.id || idx}`}
                                        />
                                      ) : (
                                        <select
                                          value={line.courseFeeId || ''}
                                          onChange={e => handleApplyCourseFee(idx, e.target.value)}
                                          disabled={isReadOnly}
                                          className="w-full px-3 py-1 rounded text-[13px] font-normal text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                          <option value="">-- Select --</option>
                                          {getSelectableCourseFeesForLine(line).map(cf => (
                                            <option key={cf.id} value={cf.id} style={{ fontFamily: 'var(--font-sans)' }}>{cf.feeCode} - {cf.feeName}</option>
                                          ))}
                                        </select>
                                      )}
                                    </td>;
                                  case 'description':
                                    const linkedCourseFee = line.courseFeeId
                                      ? courseFees.find(fee => fee.id === line.courseFeeId)
                                      : undefined;
                                    const isCourseFeeDescription = getLineType(line) === 'COURSE_FEE' && !!linkedCourseFee && !!formData.batchId;
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <input
                                        type="text"
                                        value={isCourseFeeDescription ? getCourseFeeDescription(linkedCourseFee) : line.description}
                                        onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                                        disabled={isReadOnly || isCourseFeeDescription}
                                        placeholder="Description"
                                        className="w-full px-2 py-1 rounded text-[13px] font-normal text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                      />
                                    </td>;
                                  case 'taxCategoryId':
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <select
                                        aria-label={`Tax Category line ${idx + 1}`}
                                        value={line.taxCategoryId || ''}
                                        onChange={e => handleUpdateLine(idx, 'taxCategoryId', e.target.value)}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 rounded text-[13px] font-normal text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                      >
                                        <option value="">-- None --</option>
                                        {localTaxCats.map(tc => (
                                          <option key={tc.id} value={tc.id}>
                                            {tc.code || tc.description || tc.id} {tc.rate ? `(${tc.rate}%)` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </td>;
                                  case 'quantity':
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <input
                                        aria-label={`Quantity line ${idx + 1}`}
                                        type="number"
                                        min="0"
                                        value={line.quantity}
                                        onChange={e => handleUpdateLine(idx, 'quantity', Math.max(parseInt(e.target.value) || 0, 0))}
                                        onFocus={e => e.currentTarget.select()}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 rounded text-right text-[13px] font-normal text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                      />
                                    </td>;
                                  case 'unitPrice':
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="text-[13px] font-normal text-gray-500">₱</span>
                                        <CurrencyLineInput
                                          ariaLabel={`Unit Price line ${idx + 1}`}
                                          value={line.unitPrice}
                                          onValueChange={value => handleUpdateLine(idx, 'unitPrice', value)}
                                          disabled={isReadOnly}
                                        />
                                      </div>
                                    </td>;
                                  case 'amount':
                                    return <td key={colKey} className="px-3 py-2 text-right" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="text-[13px] font-normal text-gray-500">₱</span>
                                        <CurrencyLineInput
                                          ariaLabel={`Amount line ${idx + 1}`}
                                          value={line.amount}
                                          onValueChange={value => handleUpdateLine(idx, 'amount', value)}
                                          disabled={isReadOnly}
                                        />
                                      </div>
                                    </td>;
                                  case 'actions':
                                    return <td key={colKey} className="px-3 py-2" style={lineColWidths[colKey] ? { width: lineColWidths[colKey], minWidth: lineColWidths[colKey] } : undefined}>
                                      {!isReadOnly && (
                                        <button
                                          onClick={() => handleRemoveLine(idx)}
                                          className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </td>;
                                  default:
                                    return null;
                                }
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(formTotals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VAT:</span>
                    <span>{formatCurrency(formTotals.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Grand Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(formTotals.grandTotal)}</span>
                  </div>
                </div>
              </div>
                </div>

                <aside className="xl:sticky xl:top-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b bg-gray-50">
                    <h4 className="text-sm font-black uppercase tracking-wide text-gray-700">GL Journal Entry Preview</h4>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-3 pb-3 text-[11px] font-black uppercase" style={{ color: brandColor }}>
                      <div>GL Account</div>
                      <div className="text-right">Debit ({currency || 'PHP'})</div>
                      <div className="text-right">Credit ({currency || 'PHP'})</div>
                    </div>

                    <div className="divide-y divide-gray-200 border-y border-gray-200">
                      {glJournalPreview.lines.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                          Add line items to preview the journal entry.
                        </div>
                      ) : (
                        glJournalPreview.lines.map(line => (
                          <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-3 py-4 text-sm">
                            <div className="min-w-0">
                              <p className={`font-semibold leading-5 ${line.missing ? 'text-amber-700' : 'text-gray-800'}`}>{line.accountLabel}</p>
                              <p className="mt-1 text-xs font-medium text-gray-500 leading-5">{line.description || '-'}</p>
                            </div>
                            <div className="text-right font-semibold text-gray-800">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</div>
                            <div className="text-right font-semibold text-gray-800">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</div>
                          </div>
                        ))
                      )}

                      {glJournalPreview.lines.length > 0 && (
                        <div className="grid grid-cols-[minmax(0,1fr)_96px_96px] gap-3 py-4 text-sm font-black" style={{ color: brandColor }}>
                          <div>Total</div>
                          <div className="text-right">{formatCurrency(glJournalPreview.totalDebit)}</div>
                          <div className="text-right">{formatCurrency(glJournalPreview.totalCredit)}</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                      <h5 className="font-black text-emerald-800">GL Entry Details</h5>
                      <ul className="mt-3 space-y-2 text-sm text-emerald-800">
                        <li className="flex gap-2"><span>•</span><span>Journal Entry Date: {formData.invoiceDate || '-'}</span></li>
                        <li className="flex gap-2"><span>•</span><span>Reference: {formData.invoiceNo || '-'}</span></li>
                        <li className="flex gap-2"><span>•</span><span>Customer: {formData.sponsorId ? getSponsorName(formData.sponsorId) : getStudentName(formData.studentId)}</span></li>
                        <li className="flex gap-2">
                          <span>•</span>
                          <span>{glJournalPreview.isBalanced ? 'Total Debit = Total Credit' : 'Journal entry is not balanced'}</span>
                        </li>
                      </ul>
                    </div>

                    <div className={`mt-5 rounded-lg border p-4 text-sm font-semibold ${glJournalPreview.isBalanced ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                      {editingInvoice?.status === 'OPEN'
                        ? 'Posted journal entry preview based on this invoice.'
                        : 'Preview only - journal entry will be created upon posting the invoice.'}
                    </div>
                  </div>
                </aside>
              </div>
              {editingInvoice && (
                <div className="mt-6">
                  {renderRelatedTransactionHistory()}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* View Invoice Modal */}

      {
        showViewModal && resolvedViewingInvoice && (
          <ModalPortal>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden relative">
                {/* PAID Watermark Overlay */}
                {isPaidInvoice(resolvedViewingInvoice) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-20deg)',
                      pointerEvents: 'none',
                      opacity: 0.18,
                      fontSize: 'calc(5rem * var(--app-font-scale))',
                      fontWeight: 900,
                      color: '#10B981',
                      zIndex: 30,
                      textShadow: '2px 2px 8px #fff',
                      letterSpacing: '0.2em',
                      userSelect: 'none',
                    }}
                  >
                    PAID
                  </div>
                )}
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Invoice {resolvedViewingInvoice.invoiceNo}</h3>
                    <p className="text-sm text-gray-500">{resolvedViewingInvoice.invoiceDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePrintPreview(resolvedViewingInvoice)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      title="Open A4 Print View"
                    >
                      <Printer size={15} />
                      Print A4
                    </button>
                    {getStatusBadge(resolvedViewingInvoice.status)}
                    <button onClick={() => setShowViewModal(false)} className="p-1 hover:bg-gray-200 rounded">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                  {/* Bill To */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Bill To</p>
                      <p className="font-medium text-gray-800">
                        {getInvoicePayerName(resolvedViewingInvoice)}
                      </p>
                      {resolvedViewingInvoice.batchId && (
                        <p className="text-sm text-gray-500">Batch: {getBatchCode(resolvedViewingInvoice.batchId)}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-gray-500 mb-1">Due Date</p>
                      <p className="font-medium text-gray-800">{resolvedViewingInvoice.dueDate}</p>
                      {resolvedViewingInvoice.terms && (
                        <p className="text-sm text-gray-500">Terms: {resolvedViewingInvoice.terms}</p>
                      )}
                    </div>
                  </div>

                  {/* Lines */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Class</th>
                          <th className="px-4 py-2 text-left">Description</th>
                          <th className="px-4 py-2 text-right">Qty</th>
                          <th className="px-4 py-2 text-right">Unit Price</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resolvedViewingInvoice.lines?.map((line, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2 text-xs text-gray-500">{line.classificationCode || 'None'}</td>
                            <td className="px-4 py-2">{line.description}</td>
                            <td className="px-4 py-2 text-right">{line.quantity}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(line.unitPrice)}</td>
                            <td className="px-4 py-2 text-right">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="flex justify-end">
                    <div className="w-72 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(resolvedViewingInvoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">VAT:</span>
                        <span>{formatCurrency(resolvedViewingInvoice.vatAmount)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">Grand Total:</span>
                        <span className="font-bold">{formatCurrency(resolvedViewingInvoice.grandTotal)}</span>
                      </div>
                      {resolvedViewingInvoice.isSubjectToEwt && (
                        <div className="flex justify-between text-purple-600">
                          <span>Less: EWT ({((resolvedViewingInvoice.ewtRate || 0) * 100).toFixed(0)}%):</span>
                          <span>({formatCurrency(resolvedViewingInvoice.totalEwtAmount)})</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2" style={{ color: brandColor }}>
                        <span className="font-bold">Net Amount Due:</span>
                        <span className="font-bold">{formatCurrency(resolvedViewingInvoice.netAmountDue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Less: Payments:</span>
                        <span className="text-green-600">({formatCurrency(resolvedViewingInvoice.amountPaid)})</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 text-lg">
                        <span className="font-bold">Balance Due:</span>
                        <span className="font-bold" style={{ color: resolvedViewingInvoice.balanceDue > 0 ? brandColor : '#10B981' }}>
                          {formatCurrency(resolvedViewingInvoice.balanceDue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {resolvedViewingInvoice.notes && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{resolvedViewingInvoice.notes}</p>
                    </div>
                  )}

                  {/* Related Transaction History */}
                  {renderRelatedTransactionHistory()}

                  {/* Annex: Student Breakdown for Sponsor/Batch Invoices */}
                  {resolvedViewingInvoice.sponsorId && resolvedViewingInvoice.batchId && batchStudents?.length > 0 && (
                    <div className="mt-10 print:break-before-page">
                      <h4 className="text-lg font-bold text-gray-800 mb-2">Annex: Student Breakdown</h4>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">Student Name</th>
                              <th className="px-4 py-2 text-left">Student ID</th>
                              <th className="px-4 py-2 text-left">Course</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchStudents.map((student, idx) => (
                              <tr key={student.id || idx} className="border-t">
                                <td className="px-4 py-2">{student.name}</td>
                                <td className="px-4 py-2">{student.studentNo}</td>
                                <td className="px-4 py-2">{student.courseName}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      {showPrintModal && resolvedPrintingInvoice && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Invoice Preview</h3>
                  <p className="text-sm text-gray-500">{resolvedPrintingInvoice.invoiceNo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintA4(resolvedPrintingInvoice)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Printer size={15} />
                    Print A4
                  </button>
                  <button onClick={() => setShowPrintModal(false)} className="p-1 hover:bg-gray-200 rounded">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-200 p-6">
                <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg overflow-hidden">
                  <iframe
                    title={`Invoice ${resolvedPrintingInvoice.invoiceNo} A4 preview`}
                    srcDoc={buildInvoiceA4Html(resolvedPrintingInvoice)}
                    className="block w-[210mm] h-[297mm] border-0 bg-white"
                  />
                </div>
              </div>
            </div>
            </div>
          </ModalPortal>
        )}

      {/* Void Modal */}
      {
        showVoidModal && voidingInvoice && (
          <ModalPortal>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-4 border-b flex items-center gap-3">
                  <div className="p-2 bg-rose-100 rounded-lg">
                    <AlertTriangle size={20} className="text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">Void Invoice</h3>
                    <p className="text-sm text-gray-500">{voidingInvoice.invoiceNo}</p>
                  </div>
                </div>
                <div className="p-4">
                  <label className="text-sm font-medium text-gray-700">Reason for voiding *</label>
                  <textarea
                    value={voidReason}
                    onChange={e => setVoidReason(e.target.value)}
                    rows={3}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-200"
                    placeholder="Enter reason..."
                  />
                </div>
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                  <button
                    onClick={() => { setShowVoidModal(false); setVoidingInvoice(null); setVoidReason(''); }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVoid}
                    disabled={!voidReason.trim()}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                  >
                    Void Invoice
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

      {/* Generate from Enrollments Modal */}
      {
        showGenerateModal && (
          <ModalPortal>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-purple-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Wand2 size={20} className="text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Generate Invoice from Enrollments</h3>
                      <p className="text-sm text-gray-500">Select unbilled enrollments to create a draft invoice</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowGenerateModal(false); resetGenerateModal(); }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Step 1: Select Sponsor */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                      <Building2 size={16} className="text-gray-400" />
                      Step 1: Select Sponsor
                    </label>
                    <select
                      value={selectedSponsorId}
                      onChange={e => {
                        setSelectedSponsorId(e.target.value);
                        setSelectedEnrollmentIds(new Set());
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                    >
                      <option value="">-- Select a Sponsor --</option>
                      {sponsorsWithUnbilledEnrollments.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({unbilledEnrollmentsBySponsor.get(s.id)?.length || 0} unbilled)
                          {s.taxType === 'VAT' ? ' - VAT' : ''}
                          {s.ewtRate ? ` - EWT ${(s.ewtRate * 100).toFixed(0)}%` : ''}
                        </option>
                      ))}
                    </select>
                    {selectedSponsorId && (
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                        {(() => {
                          const sponsor = sponsors.find(s => s.id === selectedSponsorId);
                          return (
                            <>
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${sponsor?.taxType === 'VAT' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                Tax Type: {sponsor?.taxType || 'NON_VAT'}
                              </span>
                              {sponsor?.ewtRate && (
                                <span className="flex items-center gap-1">
                                  <Percent size={14} className="text-purple-500" />
                                  EWT Rate: {(sponsor.ewtRate * 100).toFixed(1)}%
                                </span>
                              )}
                              {sponsor?.tin && (
                                <span className="text-gray-400">TIN: {sponsor.tin}</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Invoice Dates */}
                  {selectedSponsorId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                          <Calendar size={16} className="text-gray-400" />
                          Invoice Date
                        </label>
                        <input
                          type="date"
                          value={generateInvoiceDate}
                          onChange={e => handleGenerateInvoiceDateChange(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                          <Calendar size={16} className="text-gray-400" />
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={generateDueDate}
                          onChange={e => setGenerateDueDate(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-200"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Select Enrollments */}
                  {selectedSponsorId && unbilledEnrollmentsForSponsor.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Users size={16} className="text-gray-400" />
                          Step 2: Select Enrollments to Bill
                        </label>
                        <button
                          onClick={toggleAllEnrollments}
                          className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                        >
                          {selectedEnrollmentIds.size === unbilledEnrollmentsForSponsor.length ? (
                            <>
                              <XCircle size={14} /> Deselect All
                            </>
                          ) : (
                            <>
                              <CheckCircle size={14} /> Select All ({unbilledEnrollmentsForSponsor.length})
                            </>
                          )}
                        </button>
                      </div>

                      <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left w-10">
                                <button onClick={toggleAllEnrollments}>
                                  {selectedEnrollmentIds.size === unbilledEnrollmentsForSponsor.length
                                    ? <CheckSquare size={18} className="text-purple-600" />
                                    : <Square size={18} className="text-gray-400" />
                                  }
                                </button>
                              </th>
                              <th className="px-3 py-2 text-left">Student</th>
                              <th className="px-3 py-2 text-left">Batch</th>
                              <th className="px-3 py-2 text-left">Qualification</th>
                              <th className="px-3 py-2 text-right">Fee Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {unbilledEnrollmentsForSponsor.map(enrollment => {
                              const student = students.find(s => s.id === enrollment.studentId);
                              const batch = batches.find(b => b.id === enrollment.batchId);
                              const qualification = batch ? qualifications.find(q => q.id === batch.qualificationId) : null;
                              const courseFee = courseFees.find(cf =>
                                cf.qualificationId === batch?.qualificationId &&
                                cf.fundingType === getBatchCourseFeeFundingType(batch) &&
                                cf.isActive &&
                                !cf.isDeleted
                              );
                              const feeAmount = courseFee?.amount || enrollment.totalFees || 0;
                              const isSelected = selectedEnrollmentIds.has(enrollment.id);

                              return (
                                <tr
                                  key={enrollment.id}
                                  className={`cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-purple-50' : ''}`}
                                  onClick={() => toggleEnrollmentSelection(enrollment.id)}
                                >
                                  <td className="px-3 py-2">
                                    {isSelected
                                      ? <CheckSquare size={18} className="text-purple-600" />
                                      : <Square size={18} className="text-gray-400" />
                                    }
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      <GraduationCap size={14} className="text-gray-400" />
                                      <span className="font-medium">{student?.firstName} {student?.lastName}</span>
                                    </div>
                                    {student?.uli && <span className="text-xs text-gray-400 ml-5">{student.uli}</span>}
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{batch?.batchCode || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">{qualification?.name || '-'}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(feeAmount)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Preview Totals */}
                  {selectedEnrollmentIds.size > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Receipt size={16} />
                        Invoice Preview
                      </h4>

                      {/* Preview Line Items */}
                      <div className="mb-4 space-y-2">
                        {generatePreviewTotals.lineItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-600">
                              {item.description}
                            </span>
                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="border-t pt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Subtotal:</span>
                          <span className="font-medium">{formatCurrency(generatePreviewTotals.subtotal)}</span>
                        </div>
                        {generatePreviewTotals.vatAmount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Add: VAT (12%):</span>
                            <span>{formatCurrency(generatePreviewTotals.vatAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-medium">Grand Total:</span>
                          <span className="font-bold text-lg">{formatCurrency(generatePreviewTotals.grandTotal)}</span>
                        </div>

                        <div className="flex justify-between border-t pt-2" style={{ color: brandColor }}>
                          <span className="font-bold">Net Amount Due:</span>
                          <span className="font-bold text-lg">{formatCurrency(generatePreviewTotals.netAmountDue)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                  <div className="text-sm text-gray-500">
                    {selectedEnrollmentIds.size > 0 && (
                      <span className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500" />
                        {selectedEnrollmentIds.size} enrollment(s) selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { setShowGenerateModal(false); resetGenerateModal(); }}
                      className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerateInvoice}
                      disabled={selectedEnrollmentIds.size === 0}
                      className="flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ backgroundColor: selectedEnrollmentIds.size > 0 ? brandColor : '#9CA3AF' }}
                    >
                      <Save size={18} />
                      Generate Draft Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      {showQuickStudentModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-4 border-b flex items-center justify-between bg-brand/5 border-brand/20">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-brand" />
                  <h3 className="text-sm font-bold text-gray-800">Bill Unregistered Learner</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickStudentModal(false);
                    setQuickStudentError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateQuickStudent} className="p-5 space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 leading-relaxed">
                  Enter the learner's basic info to bill them immediately. A provisional record is created so you can issue the invoice now, and the Registrar can complete full registration and TESDA compliance documents later.
                </div>

                {quickStudentError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{quickStudentError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="e.g. Maria"
                      value={quickStudentFirstName}
                      onChange={e => setQuickStudentFirstName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Santos"
                      value={quickStudentLastName}
                      onChange={e => setQuickStudentLastName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Middle Name <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Reyes"
                    value={quickStudentMiddleName}
                    onChange={e => setQuickStudentMiddleName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Contact Number <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="09171234567"
                      value={quickStudentContact}
                      onChange={e => setQuickStudentContact(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Email Address <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="maria@example.com"
                      value={quickStudentEmail}
                      onChange={e => setQuickStudentEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickStudentModal(false);
                      setQuickStudentError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingQuickStudent}
                    className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-semibold hover:bg-brand-hover shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {isSavingQuickStudent ? 'Saving...' : 'Create & Select for Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default InvoicesView;



