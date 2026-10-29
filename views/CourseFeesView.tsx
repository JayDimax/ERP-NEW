import React, { useState, useMemo } from 'react';
import { CourseFee, CourseFeeCategory, CourseFeeFundingType, Qualification, ChartOfAccount } from '../types';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import PaginationControls, { usePaginatedRows } from '../components/PaginationControls';
import {
  Search, Plus, DollarSign, Trash2, X, GraduationCap,
  Edit2, Loader2, CheckCircle, AlertCircle, Receipt,
  Percent, Hash, ToggleLeft, ToggleRight, FileText, Copy,
  ChevronDown, RotateCcw
} from 'lucide-react';

interface CourseFeesViewProps {
  courseFees: CourseFee[];
  qualifications: Qualification[];
  accounts: ChartOfAccount[];
  currency?: string;
  onAddCourseFee: (fee: CourseFee) => void | Promise<void>;
  onUpdateCourseFee: (fee: CourseFee) => void | Promise<void>;
  onDeleteCourseFee: (id: string) => void | Promise<boolean>;
  onNotify?: (type: 'success' | 'error' | 'info' | 'warning', message: string) => void;
}

const CATEGORY_OPTIONS: { value: CourseFeeCategory; label: string; color: string }[] = [
  { value: 'TUITION', label: 'Tuition', color: 'bg-blue-100 text-blue-700' },
  { value: 'REGISTRATION', label: 'Registration', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'CERTIFICATION', label: 'Certification', color: 'bg-purple-100 text-purple-700' },
  { value: 'ASSESSMENT', label: 'Assessment', color: 'bg-amber-100 text-amber-700' },
  { value: 'MATERIALS', label: 'Materials', color: 'bg-rose-100 text-rose-700' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous', color: 'bg-gray-100 text-gray-700' },
];

const FUNDING_TYPE_OPTIONS: { value: CourseFeeFundingType; label: string; color: string }[] = [
  { value: 'SPONSORED', label: 'Sponsored', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'PRIVATE', label: 'Private', color: 'bg-sky-100 text-sky-700' },
  { value: 'TESDA_SCHOLARSHIP', label: 'TESDA Scholarship', color: 'bg-teal-100 text-teal-700' },
];

export const getAvailableFeeCode = (
  qualificationCode: string | undefined,
  existingCodes: Iterable<string>
): string => {
  const prefix = qualificationCode?.substring(0, 3).toUpperCase() || 'FEE';
  const usedCodes = new Set(Array.from(existingCodes, code => code.trim().toUpperCase()));
  let sequence = 1;
  let candidate = '';

  do {
    candidate = `${prefix}-FEE-${String(sequence).padStart(3, '0')}`;
    sequence++;
  } while (usedCodes.has(candidate));

  return candidate;
};

const CourseFeesView: React.FC<CourseFeesViewProps> = ({
  courseFees, qualifications, accounts, currency = 'PHP', onAddCourseFee, onUpdateCourseFee, onDeleteCourseFee, onNotify
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterQualification, setFilterQualification] = useState<string>('');
  const [filterFundingType, setFilterFundingType] = useState<CourseFeeFundingType | ''>('');
  const [filterCategory, setFilterCategory] = useState<CourseFeeCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingFee, setEditingFee] = useState<CourseFee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Bulk creation state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const emptyBulkRow = (): Partial<CourseFee> & { _key: string } => ({
    _key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    feeCode: '',
    feeName: '',
    amount: 0,
    glAccountId: '',
    category: undefined,
    description: '',
    isSubjectToEwt: false,
    ewtRate: undefined,
    isActive: true,
  });
  const [bulkRows, setBulkRows] = useState<(Partial<CourseFee> & { _key: string })[]>([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
  const [bulkContext, setBulkContext] = useState<{ qualificationId: string; fundingType: CourseFeeFundingType | '' }>({
    qualificationId: '',
    fundingType: '',
  });

  const [formData, setFormData] = useState<Partial<CourseFee>>({
    feeCode: '',
    qualificationId: '',
    fundingType: undefined,
    feeName: '',
    amount: 0,
    glAccountId: '',
    taxCategoryId: '',
    isSubjectToEwt: false,
    ewtRate: undefined,
    category: undefined,
    description: '',
    isActive: true
  });

  const filteredFees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return courseFees
      .filter(f => {
        if (f.isDeleted) return false;

        const qualification = qualifications.find(q => q.id === f.qualificationId);
        const account = accounts.find(a => a.id === f.glAccountId);
        const categoryLabel = CATEGORY_OPTIONS.find(cat => cat.value === f.category)?.label || '';
        const searchableText = [
          f.feeName,
          f.feeCode,
          f.description || '',
          qualification?.code || '',
          qualification?.name || '',
          f.fundingType === 'TESDA_SCHOLARSHIP' ? 'TESDA Scholarship' :
            f.fundingType === 'SPONSORED' ? 'Sponsored' :
              f.fundingType === 'PRIVATE' ? 'Private' : 'Unclassified',
          account?.code || '',
          account?.name || '',
          categoryLabel,
        ].join(' ').toLowerCase();

        const matchesSearch = normalizedSearch === '' || searchableText.includes(normalizedSearch);
        const matchesQualification = !filterQualification || f.qualificationId === filterQualification;
        const matchesFundingType = !filterFundingType || f.fundingType === filterFundingType;
        const matchesCategory = !filterCategory || f.category === filterCategory;
        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' ? f.isActive : !f.isActive);

        return matchesSearch && matchesQualification && matchesFundingType && matchesCategory && matchesStatus;
      })
      .sort((a, b) => a.feeName.localeCompare(b.feeName));
  }, [courseFees, searchTerm, filterQualification, filterFundingType, filterCategory, statusFilter, qualifications, accounts]);

  const {
    currentPage,
    totalPages,
    pageStartIndex,
    pageEndIndex,
    paginatedRows: paginatedFees,
    setCurrentPage,
  } = usePaginatedRows(
    filteredFees,
    [searchTerm, filterQualification, filterFundingType, filterCategory, statusFilter],
    7
  );

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    !!filterQualification ||
    !!filterFundingType ||
    !!filterCategory ||
    statusFilter !== 'ALL';

  const revenueAccounts = useMemo(() =>
    accounts.filter(a => a.class === 'REVENUE' && !a.isHeader && a.isActive !== false),
    [accounts]
  );

  const resetForm = () => {
    setFormError(null);
    setFormData({
      feeCode: '',
      qualificationId: '',
      fundingType: undefined,
      feeName: '',
      amount: 0,
      glAccountId: '',
      taxCategoryId: '',
      isSubjectToEwt: false,
      ewtRate: undefined,
      category: undefined,
      description: '',
      isActive: true
    });
    setEditingFee(null);
  };

  // Bulk creation helpers
  const addBulkRow = () => setBulkRows(prev => [...prev, emptyBulkRow()]);
  const removeBulkRow = (key: string) => setBulkRows(prev => prev.length > 1 ? prev.filter(r => r._key !== key) : prev);
  const updateBulkRow = (key: string, field: string, value: any) => {
    setBulkRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r));
  };
  const openBulkModal = () => {
    setBulkRows([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
    setBulkContext({ qualificationId: '', fundingType: '' });
    setShowBulkModal(true);
  };

  const handleBulkSubmit = async () => {
    if (!bulkContext.qualificationId || !bulkContext.fundingType) {
      onNotify?.('error', 'Select one qualification and one funding type for this fee schedule.');
      return;
    }

    const startedRows = bulkRows.filter(r =>
      !!r.feeName?.trim() ||
      !!r.feeCode?.trim() ||
      !!r.glAccountId ||
      !!r.category ||
      Number(r.amount) > 0
    );
    const incompleteRows = startedRows
      .map((row) => ({
        rowNumber: bulkRows.indexOf(row) + 1,
        missing: [
          !row.feeName?.trim() && 'fee name',
          !(Number(row.amount) > 0) && 'amount',
          !row.category && 'category',
          !row.glAccountId && 'G/L account',
        ].filter(Boolean),
      }))
      .filter(row => row.missing.length > 0);

    if (incompleteRows.length > 0) {
      onNotify?.(
        'error',
        incompleteRows
          .map(row => `Row ${row.rowNumber}: ${row.missing.join(', ')} required`)
          .join(' • ')
      );
      return;
    }

    const validRows = bulkRows.filter(r =>
      r.feeName && r.glAccountId && r.category && Number(r.amount) > 0
    );
    if (validRows.length === 0) {
      onNotify?.('error', 'Please fill in at least one complete row. Course, funding type, name, amount, category, and GL account are required.');
      return;
    }

    setIsBulkSubmitting(true);
    let errorCount = 0;

    const reservedCodes = new Set(courseFees.map(fee => fee.feeCode.trim().toUpperCase()));
    const getNextFeeCode = (qualificationId: string): string => {
      const qual = qualifications.find(q => q.id === qualificationId);
      const code = getAvailableFeeCode(qual?.code, reservedCodes);
      reservedCodes.add(code);
      return code;
    };
    const localErrors: string[] = [];

    try {
      for (const row of validRows) {
        const feeCode = (row.feeCode || getNextFeeCode(bulkContext.qualificationId)).trim().toUpperCase();
        if (reservedCodes.has(feeCode) && row.feeCode) {
          errorCount++;
          localErrors.push(`${row.feeName}: Fee code "${feeCode}" already exists.`);
          continue;
        }
        reservedCodes.add(feeCode);

        try {
          const newFee: CourseFee = {
            id: generateUUID(),
            orgId: '',
            feeCode,
            qualificationId: bulkContext.qualificationId,
            fundingType: bulkContext.fundingType,
            feeName: row.feeName!,
            amount: Number(row.amount) || 0,
            glAccountId: row.glAccountId!,
            taxCategoryId: row.taxCategoryId,
            isSubjectToEwt: row.isSubjectToEwt || false,
            ewtRate: row.isSubjectToEwt ? row.ewtRate : undefined,
            category: row.category as CourseFeeCategory | undefined,
            description: row.description,
            isActive: row.isActive ?? true,
            createdAt: new Date().toISOString(),
          };
          await onAddCourseFee(newFee);
        } catch {
          errorCount++;
        }
      }

      if (localErrors.length > 0) {
        onNotify?.('error', localErrors.join(' • '));
      }
      if (errorCount === 0) {
        setShowBulkModal(false);
      }
    } catch (error) {
      onNotify?.('error', `Bulk creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  const generateFeeCode = (qualificationId: string) => {
    const qual = qualifications.find(q => q.id === qualificationId);
    return getAvailableFeeCode(qual?.code, courseFees.map(fee => fee.feeCode));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const missingFields = [
      !formData.qualificationId && 'course',
      !formData.fundingType && 'funding type',
      !formData.feeName?.trim() && 'fee name',
      Number(formData.amount) <= 0 && 'amount greater than zero',
      !formData.category && 'category',
      !formData.glAccountId && 'G/L revenue account',
    ].filter(Boolean);

    if (missingFields.length > 0) {
      setFormError(`Please provide: ${missingFields.join(', ')}.`);
      return;
    }

    const feeCode = (formData.feeCode || generateFeeCode(formData.qualificationId!)).trim().toUpperCase();
    const duplicateFee = courseFees.find(fee =>
      fee.id !== editingFee?.id &&
      fee.feeCode.trim().toUpperCase() === feeCode
    );
    if (duplicateFee) {
      const duplicateMessage = `Fee code "${feeCode}" is already used by "${duplicateFee.feeName}".`;
      setFormError(duplicateMessage);
      onNotify?.('error', duplicateMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingFee) {
        const updatedFee: CourseFee = {
          ...editingFee,
          feeCode,
          qualificationId: formData.qualificationId!,
          fundingType: formData.fundingType!,
          feeName: formData.feeName!,
          amount: Number(formData.amount) || 0,
          glAccountId: formData.glAccountId!,
          taxCategoryId: formData.taxCategoryId,
          isSubjectToEwt: formData.isSubjectToEwt || false,
          ewtRate: formData.isSubjectToEwt ? formData.ewtRate : undefined,
          category: formData.category,
          description: formData.description,
          isActive: formData.isActive ?? true,
          updatedAt: new Date().toISOString()
        };
        await onUpdateCourseFee(updatedFee);
      } else {
        const newFee: CourseFee = {
          id: generateUUID(),
          orgId: '', // Will be set by App.tsx handler
          feeCode,
          qualificationId: formData.qualificationId!,
          fundingType: formData.fundingType!,
          feeName: formData.feeName!,
          amount: Number(formData.amount) || 0,
          glAccountId: formData.glAccountId!,
          taxCategoryId: formData.taxCategoryId,
          isSubjectToEwt: formData.isSubjectToEwt || false,
          ewtRate: formData.isSubjectToEwt ? formData.ewtRate : undefined,
          category: formData.category,
          description: formData.description,
          isActive: formData.isActive ?? true,
          createdAt: new Date().toISOString()
        };
        await onAddCourseFee(newFee);
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving course fee:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course fee?')) return;

    setDeletingId(id);
    try {
      await onDeleteCourseFee(id);
    } catch (error) {
      onNotify?.('error', `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = (fee: CourseFee) => {
    setEditingFee(fee);
    setFormData({
      feeCode: fee.feeCode,
      qualificationId: fee.qualificationId,
      fundingType: fee.fundingType,
      feeName: fee.feeName,
      amount: fee.amount,
      glAccountId: fee.glAccountId,
      taxCategoryId: fee.taxCategoryId || '',
      isSubjectToEwt: fee.isSubjectToEwt,
      ewtRate: fee.ewtRate,
      category: fee.category,
      description: fee.description || '',
      isActive: fee.isActive
    });
    setShowModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getCategoryBadge = (category?: CourseFeeCategory) => {
    if (!category) return null;
    const cat = CATEGORY_OPTIONS.find(c => c.value === category);
    if (!cat) return null;
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${cat.color}`}>
        {cat.label}
      </span>
    );
  };

  const getFundingTypeBadge = (fundingType?: CourseFeeFundingType) => {
    const option = FUNDING_TYPE_OPTIONS.find(f => f.value === fundingType);
    if (!option) {
      return (
        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-500">
          Unclassified
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${option.color}`}>
        {option.label}
      </span>
    );
  };

  const getQualificationName = (qualId: string) => {
    const qual = qualifications.find(q => q.id === qualId);
    return qual ? `${qual.code} - ${qual.name}` : 'Unknown';
  };

  const getAccountName = (accId: string) => {
    const acc = accounts.find(a => a.id === accId);
    return acc ? `${acc.code} - ${acc.name}` : 'Not mapped';
  };

  // Summary stats
  const totalFees = filteredFees.length;
  const activeFees = filteredFees.filter(f => f.isActive).length;
  const totalAmount = filteredFees.reduce((sum, f) => sum + f.amount, 0);
  const ewtFees = filteredFees.filter(f => f.isSubjectToEwt).length;

  return (
    <div className="space-y-8 pb-20 relative animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Course Fees Catalog</h2>
          <p className="text-sm text-gray-500 font-normal italic">Manage fee structures linked to qualifications and courses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openBulkModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-brand border border-brand rounded hover:bg-brand-light transition-all font-medium text-sm active:scale-95"
          >
            <Copy size={16} /> Bulk Create
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-brand/20 font-medium text-sm active:scale-95"
          >
            <Plus size={18} /> New Course Fee
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Fees</p>
          <p className="text-2xl font-bold text-gray-800">{totalFees}</p>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Active</p>
          <p className="text-2xl font-bold text-gray-800">{activeFees}</p>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Total Value</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white p-6 rounded-md border border-gray-200 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">EWT Subject</p>
          <p className="text-2xl font-bold text-gray-800">{ewtFees}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-y px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors cursor-pointer group w-full max-w-md">
            <Search size={14} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search course fees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-medium text-gray-700 flex-1 placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Course:</span>
            <select
              value={filterQualification}
              onChange={(e) => setFilterQualification(e.target.value)}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[220px]"
            >
              <option value="">All</option>
              {qualifications.filter(q => !q.isDeleted).map(q => (
                <option key={q.id} value={q.id}>{q.code} - {q.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Category:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as CourseFeeCategory | '')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="">All</option>
              {CATEGORY_OPTIONS.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <div className="relative border rounded flex items-center bg-white h-9 px-3 hover:bg-gray-50 transition-colors">
            <span className="text-[13px] text-gray-500 mr-1">Funding:</span>
            <select
              value={filterFundingType}
              onChange={(e) => setFilterFundingType(e.target.value as CourseFeeFundingType | '')}
              className="bg-transparent border-none outline-none text-[13px] font-bold text-gray-800 pr-4 appearance-none cursor-pointer max-w-[180px]"
            >
              <option value="">All</option>
              <option value="SPONSORED">Sponsored</option>
              <option value="PRIVATE">Private</option>
              <option value="TESDA_SCHOLARSHIP">TESDA Scholarship</option>
            </select>
            <ChevronDown size={14} className="text-gray-400 absolute right-2 pointer-events-none" />
          </div>

          <button
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setFilterQualification('');
              setFilterFundingType('');
              setFilterCategory('');
            }}
            className={`p-2 transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            title="Clear all filters"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full font-sans">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Fee Details</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Course</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Funding Type</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Amount</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">GL Account</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Tax/EWT</th>
              <th className="px-4 py-3 text-left text-[13px] font-bold text-white">Status</th>
              <th className="px-4 py-3 text-right text-[13px] font-bold text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedFees.length > 0 ? paginatedFees.map(fee => (
              <tr key={fee.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-brand/10 flex items-center justify-center text-brand border border-brand-light shadow-sm shrink-0">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-800 leading-tight">{fee.feeName}</div>
                      <div className="text-xs text-brand font-mono mt-0.5">{fee.feeCode}</div>
                      {fee.category && <div className="mt-1">{getCategoryBadge(fee.category)}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <GraduationCap size={14} className="text-gray-400" />
                    <div>
                      <span className="block truncate max-w-[200px]">{getQualificationName(fee.qualificationId)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getFundingTypeBadge(fee.fundingType)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="text-sm font-semibold text-brand font-mono">
                    {formatCurrency(fee.amount)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-gray-600 truncate max-w-[180px]">
                    {getAccountName(fee.glAccountId)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {fee.isSubjectToEwt ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">EWT</span>
                        {fee.ewtRate && (
                          <span className="text-xs text-gray-500">{(fee.ewtRate * 100).toFixed(1)}%</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No EWT</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {fee.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand bg-brand/10 px-2 py-1 rounded border border-brand-light">
                      <CheckCircle size={12} /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(fee)}
                      disabled={deletingId === fee.id}
                      className="p-2 hover:bg-brand-light text-gray-400 hover:text-brand rounded-lg transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(fee.id)}
                      disabled={deletingId === fee.id}
                      className="p-2 hover:bg-rose-50 text-gray-300 hover:text-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === fee.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                  <FileText size={40} className="mx-auto mb-2 text-gray-300" />
                  {hasActiveFilters
                    ? 'Try adjusting your search or filters.'
                    : 'No course fees defined. Create a fee structure to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredFees.length}
          pageStartIndex={pageStartIndex}
          pageEndIndex={pageEndIndex}
          onPageChange={setCurrentPage}
          itemLabel="course fees"
        />
      </div>

      {/* Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-brand/20"><DollarSign size={20} /></div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">
                  {editingFee ? 'Edit Course Fee' : 'New Course Fee'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="sticky top-0 z-10 flex items-start gap-3 rounded border border-rose-300 bg-rose-50 px-4 py-3 text-rose-800 shadow-sm"
                >
                  <AlertCircle size={20} className="mt-0.5 shrink-0 text-rose-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Course fee could not be saved</p>
                    <p className="mt-0.5 break-words text-sm">{formError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="shrink-0 text-rose-400 hover:text-rose-700"
                    aria-label="Dismiss error"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="space-y-4">
                {/* Course Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Course / Qualification *</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.qualificationId || ''}
                    onChange={e => {
                      const qualId = e.target.value;
                      setFormData({
                        ...formData,
                        qualificationId: qualId,
                        feeCode: formData.feeCode || (qualId ? generateFeeCode(qualId) : '')
                      });
                    }}
                  >
                    <option value="">Select a course...</option>
                    {qualifications.filter(q => !q.isDeleted).map(q => (
                      <option key={q.id} value={q.id}>{q.code} - {q.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Funding Type *</label>
                  <select
                    required
                    aria-required="true"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.fundingType || ''}
                    onChange={e => setFormData({ ...formData, fundingType: e.target.value as CourseFeeFundingType })}
                  >
                    <option value="">Select funding type...</option>
                    <option value="SPONSORED">Sponsored</option>
                    <option value="PRIVATE">Private</option>
                    <option value="TESDA_SCHOLARSHIP">TESDA Scholarship</option>
                  </select>
                </div>

                {/* Fee Code and Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Code</label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        placeholder="Auto-generated if blank"
                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium font-mono"
                        value={formData.feeCode || ''}
                        onChange={e => setFormData({ ...formData, feeCode: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Name *</label>
                    <input
                      required
                      placeholder="e.g. Tuition Fee - First Semester"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                      value={formData.feeName || ''}
                      onChange={e => setFormData({ ...formData, feeName: e.target.value })}
                    />
                  </div>
                </div>

                {/* Amount and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{currency}</span>
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="w-full pl-14 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium font-mono"
                        value={formData.amount || ''}
                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category *</label>
                    <select
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                      value={formData.category || ''}
                      onChange={e => setFormData({ ...formData, category: e.target.value as CourseFeeCategory || undefined })}
                    >
                      <option value="">Select category...</option>
                      {CATEGORY_OPTIONS.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* GL Account */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">G/L Revenue Account *</label>
                  <select
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium"
                    value={formData.glAccountId || ''}
                    onChange={e => setFormData({ ...formData, glAccountId: e.target.value })}
                  >
                    <option value="">Select revenue account...</option>
                    {revenueAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 italic mt-1">Income will be posted to this G/L account when the fee is invoiced.</p>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                  <textarea
                    placeholder="Optional description of this fee..."
                    rows={2}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium resize-none"
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Tax / EWT Section */}
                <div className="p-4 bg-amber-50/50 rounded border border-amber-100 space-y-4">
                  <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-2">
                    <Receipt size={12} /> Tax & Withholding
                  </label>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isSubjectToEwt: !formData.isSubjectToEwt })}
                      className={`flex items-center gap-2 px-4 py-2 rounded border transition-colors ${formData.isSubjectToEwt
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : 'bg-white border-gray-200 text-gray-500'
                        }`}
                    >
                      {formData.isSubjectToEwt ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      <span className="text-sm font-medium">Subject to EWT</span>
                    </button>

                    {formData.isSubjectToEwt && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-gray-500">EWT Rate:</label>
                        <div className="relative w-24">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            placeholder="2"
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded outline-none focus:border-brand text-sm font-medium pr-8"
                            value={formData.ewtRate !== undefined ? (formData.ewtRate * 100) : ''}
                            onChange={e => {
                              const val = e.target.value;
                              setFormData({ ...formData, ewtRate: val ? parseFloat(val) / 100 : undefined });
                            }}
                          />
                          <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 italic">
                    Enable this if Expanded Withholding Tax should be applied when billing this fee.
                  </p>
                </div>

                {/* Active Status */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`flex items-center gap-2 px-4 py-2 rounded border transition-colors ${formData.isActive
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-gray-100 border-gray-200 text-gray-500'
                      }`}
                  >
                    {formData.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    <span className="text-sm font-medium">{formData.isActive ? 'Active' : 'Inactive'}</span>
                  </button>
                  <span className="text-xs text-gray-500">Inactive fees won't appear in billing options.</span>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-brand text-white rounded text-sm font-semibold shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {editingFee ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editingFee ? 'Update Fee' : 'Create Fee'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}

      {/* Bulk Creation Modal */}
      {showBulkModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-4xl overflow-hidden animate-in zoom-in duration-200 border border-gray-200">
            <div className="p-5 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand text-white rounded shadow-brand/20"><Copy size={20} /></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">Bulk Create Course Fees</h3>
                  <p className="text-xs text-gray-500">Create one fee schedule for a qualification and funding source.</p>
                </div>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>

            {/* Fee schedule context */}
            <div className="px-6 pt-5 pb-3">
              <div className="p-4 bg-brand/10 border border-brand-light rounded">
                <div className="mb-3">
                  <p className="text-xs font-semibold text-brand uppercase tracking-wide">Fee Schedule</p>
                  <p className="mt-1 text-xs text-gray-600">All fee lines below will belong to this qualification and funding type.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-gray-600">Qualification *</span>
                    <select
                      required
                      value={bulkContext.qualificationId}
                      onChange={e => setBulkContext(previous => ({ ...previous, qualificationId: e.target.value }))}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded text-sm focus:border-brand outline-none"
                    >
                      <option value="">Select qualification...</option>
                      {qualifications.filter(q => !q.isDeleted).map(q => (
                        <option key={q.id} value={q.id}>{q.code} - {q.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold text-gray-600">Funding Type *</span>
                    <select
                      required
                      value={bulkContext.fundingType}
                      onChange={e => setBulkContext(previous => ({ ...previous, fundingType: e.target.value as CourseFeeFundingType | '' }))}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded text-sm focus:border-brand outline-none"
                    >
                      <option value="">Select funding type...</option>
                      <option value="SPONSORED">Sponsored</option>
                      <option value="PRIVATE">Private</option>
                      <option value="TESDA_SCHOLARSHIP">TESDA Scholarship</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* Rows Table */}
            <div className="px-6 pb-4 max-h-[50vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-2 text-left text-xs font-semibold text-gray-400 uppercase w-8">#</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-gray-400 uppercase">Fee Name *</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-gray-400 uppercase w-28">Amount *</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-gray-400 uppercase">Category *</th>
                    <th className="py-2 px-2 text-left text-xs font-semibold text-gray-400 uppercase">GL Account *</th>
                    <th className="py-2 pl-2 text-center text-xs font-semibold text-gray-400 uppercase w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, idx) => {
                    const isValid = !!(row.feeName && row.glAccountId && row.category && Number(row.amount) > 0);
                    return (
                      <tr key={row._key} className={`border-b border-gray-100 ${isValid ? 'bg-emerald-50/30' : ''}`}>
                        <td className="py-2 pr-2 text-xs text-gray-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <input
                            placeholder="e.g. Tuition Fee"
                            className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none"
                            value={row.feeName || ''}
                            onChange={e => updateBulkRow(row._key, 'feeName', e.target.value)}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm font-mono focus:border-brand outline-none"
                            value={row.amount || ''}
                            onChange={e => updateBulkRow(row._key, 'amount', parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none"
                            value={row.category || ''}
                            onChange={e => updateBulkRow(row._key, 'category', e.target.value || undefined)}
                          >
                            <option value="">Select...</option>
                            {CATEGORY_OPTIONS.map(cat => (
                              <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none"
                            value={row.glAccountId || ''}
                            onChange={e => updateBulkRow(row._key, 'glAccountId', e.target.value)}
                          >
                            <option value="">Select...</option>
                            {revenueAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pl-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeBulkRow(row._key)}
                            disabled={bulkRows.length <= 1}
                            className="p-1 text-gray-300 hover:text-rose-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addBulkRow}
                className="mt-3 flex items-center gap-1.5 text-sm text-brand hover:text-brand font-medium transition-colors"
              >
                <Plus size={16} /> Add Row
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {bulkRows.filter(r => r.feeName && r.qualificationId && r.fundingType && r.glAccountId && r.category && Number(r.amount) > 0).length} of {bulkRows.length} rows ready to save
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkSubmit}
                  disabled={isBulkSubmitting || bulkRows.filter(r => r.feeName && r.qualificationId && r.fundingType && r.glAccountId && r.category && Number(r.amount) > 0).length === 0}
                  className="px-8 py-2.5 bg-brand text-white rounded text-sm font-semibold shadow-brand/20 active:scale-95 transition-all hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isBulkSubmitting ? (
                    <><Loader2 size={16} className="animate-spin" /> Creating...</>
                  ) : (
                    <>Create {bulkRows.filter(r => r.feeName && r.qualificationId && r.fundingType && r.glAccountId && r.category && Number(r.amount) > 0).length} Fee{bulkRows.filter(r => r.feeName && r.qualificationId && r.fundingType && r.glAccountId && r.category && Number(r.amount) > 0).length !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
</ModalPortal>
      )}


    </div>
  );
};

export default CourseFeesView;

