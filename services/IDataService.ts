
import {
  Organization, User, Student, Qualification, Trainer, Batch,
  Sponsor, NonStockItem, Vendor, BankAccount, Location,
  TrainerSchedule, Employee, PayrollRun, PayrollLine,
  JournalEntry, JournalLine, JournalVoucher, JournalVoucherLine, AuditLog, PurchaseOrder, PaymentHistory, FixedAsset, Payable, Bill,
  CheckVoucher, BankReconciliation, RecurringJournalEntry, AccountingPeriod, ExchangeRate,
  StockItem, InventoryTransaction, InventoryLevel, WarehouseLocation, StockAdjustment, ReorderPoint,
  RecurringInvoice, RevenueSchedule, RevenueRecognitionEntry, ChartOfAccount, GoodsReceipt, RecurringBill,
  CourseFee, AlumniEmploymentReport, Enrollment, AssessmentRegistration, Invoice, InvoiceLine, TaxCategoryEntry, Payment, PaymentApplication,
  FeedbackTicket, InventoryClass, OpeningInventoryDocument, TimeExpense, APMemo, APReclassification, TranscriptRecord, BatchTranscriptRecord
} from '../types';

export interface TrainerUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface QualificationUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface LocationUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface ScheduleUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface SponsorUsageCheck {
  isUsed: boolean;
  usedIn: string[];
}

export interface InitialData {
  organizations: Organization[];
  users: User[];
  students: Student[];
  qualifications: Qualification[];
  trainers: Trainer[];
  batches: Batch[];
  sponsors: Sponsor[];
  items: NonStockItem[];
  vendors: Vendor[];
  locations: Location[];
  schedules: TrainerSchedule[];
  employees: Employee[];
  bankAccounts: BankAccount[];
  bankReconciliations: BankReconciliation[];
  recurringJournalEntries: RecurringJournalEntry[];
  accounts: any[]; // ChartOfAccount[]
  journalEntries: JournalEntry[];
  journalLines: JournalLine[];
  bills: Bill[];
  payables: Payable[];
  payrollRuns: PayrollRun[];
  payrollLines: PayrollLine[];
  auditLogs: AuditLog[];
  purchaseOrders: PurchaseOrder[];
  paymentHistories: PaymentHistory[];
  payments?: Payment[];
  paymentApplications?: PaymentApplication[];
  fixedAssets: FixedAsset[];
  vendorTaxSettings?: any[];
  atcCategories?: any[];
  atcItems?: any[];
  atcRates?: any[];
  // Inventory system
  warehouseLocations: WarehouseLocation[];
  stockItems: StockItem[];
  inventoryLevels: InventoryLevel[];
  inventoryTransactions: InventoryTransaction[];
  stockAdjustments: StockAdjustment[];
  reorderPoints: ReorderPoint[];
  courseFees: CourseFee[];
  enrollments: Enrollment[];
  assessmentRegistrations: AssessmentRegistration[];
  alumniReports: AlumniEmploymentReport[];
  invoices: Invoice[];
  invoiceLines: InvoiceLine[];
  taxCategories: TaxCategoryEntry[];
  feedbackTickets: FeedbackTicket[];
}

export type PageFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'is'
  | 'in'
  | 'not.in'
  | 'cs'
  | 'cd'
  | 'ov';

export interface PageFilter {
  column: string;
  operator?: PageFilterOperator;
  value: string | number | boolean | null;
}

export interface PageOrder {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

export interface FetchPageOptions {
  page?: number;
  pageSize?: number;
  columns?: string;
  filters?: PageFilter[];
  orderBy?: PageOrder[];
  search?: {
    columns: string[];
    term: string;
  };
}

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IDataService {
  getInitialData(): Promise<InitialData>;

  // Generic server-side pagination foundation for large list screens.
  fetchPage<T>(table: string, options?: FetchPageOptions): Promise<PaginatedResult<T>>;

  // Organization CRUD
  createOrganization(org: Organization): Promise<Organization>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;

  // User CRUD
  createUser(user: User, options?: { preferUserToken?: boolean }): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Student CRUD
  createStudent(student: Student): Promise<Student>;
  updateStudent(id: string, updates: Partial<Student>): Promise<Student>;
  deleteStudent(id: string): Promise<void>;
  checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }>;
  getTranscriptRecords(orgId: string): Promise<TranscriptRecord[]>;
  getBatchTranscriptRecords(orgId: string): Promise<BatchTranscriptRecord[]>;
  uploadTranscriptPdf(input: {
    orgId: string;
    enrollmentId?: string;
    studentId: string;
    batchId: string;
    uploadedBy?: string;
    file: File;
  }): Promise<TranscriptRecord>;
  downloadTranscriptPdf(objectPath: string): Promise<Blob>;
  uploadBatchTranscriptPdf(input: {
    orgId: string;
    batchId: string;
    file: File;
  }): Promise<BatchTranscriptRecord>;
  downloadBatchTranscriptPdf(objectPath: string, orgId: string): Promise<Blob>;

  // Trainer CRUD
  createTrainer(trainer: Trainer): Promise<Trainer>;
  updateTrainer(id: string, updates: Partial<Trainer>): Promise<Trainer>;
  deleteTrainer(id: string): Promise<void>;
  checkTrainerUsage(trainerId: string): Promise<TrainerUsageCheck>;

  // Qualification CRUD
  createQualification(qualification: Qualification): Promise<Qualification>;
  updateQualification(id: string, updates: Partial<Qualification>): Promise<Qualification>;
  deleteQualification(id: string): Promise<void>;
  checkQualificationUsage(qualificationId: string): Promise<QualificationUsageCheck>;

  // Batch CRUD
  createBatch(batch: Batch): Promise<Batch>;
  updateBatch(id: string, updates: Partial<Batch>): Promise<Batch>;
  deleteBatch(id: string): Promise<void>;

  // Location CRUD
  createLocation(location: Location): Promise<Location>;
  updateLocation(id: string, updates: Partial<Location>): Promise<Location>;
  deleteLocation(id: string): Promise<void>;
  checkLocationUsage(locationId: string): Promise<LocationUsageCheck>;

  // Schedule CRUD
  createSchedule(schedule: TrainerSchedule): Promise<TrainerSchedule>;
  updateSchedule(id: string, updates: Partial<TrainerSchedule>): Promise<TrainerSchedule>;
  deleteSchedule(id: string): Promise<void>;
  checkScheduleUsage(scheduleId: string): Promise<ScheduleUsageCheck>;

  // Sponsor CRUD
  createSponsor(sponsor: Sponsor): Promise<Sponsor>;
  updateSponsor(id: string, updates: Partial<Sponsor>): Promise<Sponsor>;
  deleteSponsor(id: string): Promise<void>;
  checkSponsorUsage(sponsorId: string): Promise<SponsorUsageCheck>;

  // Bank Account CRUD
  createBankAccount(account: BankAccount): Promise<BankAccount>;
  updateBankAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount>;
  deleteBankAccount(id: string): Promise<void>;

  // Bank Reconciliation CRUD
  createBankReconciliation(reconciliation: BankReconciliation): Promise<BankReconciliation>;
  updateBankReconciliation(id: string, updates: Partial<BankReconciliation>): Promise<BankReconciliation>;
  deleteBankReconciliation(id: string): Promise<void>;
  getBankReconciliationsByAccount(bankAccountId: string): Promise<BankReconciliation[]>;
  getLatestBankReconciliation(bankAccountId: string): Promise<BankReconciliation | null>;

  // Recurring Journal Entry CRUD
  createRecurringJournalEntry(entry: RecurringJournalEntry): Promise<RecurringJournalEntry>;
  updateRecurringJournalEntry(id: string, updates: Partial<RecurringJournalEntry>): Promise<RecurringJournalEntry>;
  deleteRecurringJournalEntry(id: string): Promise<void>;
  getRecurringJournalEntriesByOrg(orgId: string): Promise<RecurringJournalEntry[]>;
  getRecurringJournalEntryById(id: string): Promise<RecurringJournalEntry | null>;

  // Recurring Invoice CRUD
  createRecurringInvoice(invoice: RecurringInvoice): Promise<RecurringInvoice>;
  updateRecurringInvoice(id: string, updates: Partial<RecurringInvoice>): Promise<RecurringInvoice>;
  deleteRecurringInvoice(id: string): Promise<void>;
  getRecurringInvoiceById(id: string): Promise<RecurringInvoice | null>;

  // Invoice CRUD
  createInvoice(invoice: Invoice): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  getInvoicesByOrg(orgId: string): Promise<Invoice[]>;
  getInvoiceById(id: string): Promise<Invoice | null>;
  voidInvoice(id: string, voidedBy: string, reason: string): Promise<void>;
  getInvoiceCreatorNames?(orgId: string): Promise<Record<string, string>>;

  // Tax Category CRUD
  fetchTaxCategories(orgId: string): Promise<TaxCategoryEntry[]>;

  // Invoice Line CRUD
  createInvoiceLine(line: InvoiceLine): Promise<InvoiceLine>;
  updateInvoiceLine(id: string, updates: Partial<InvoiceLine>): Promise<InvoiceLine>;
  deleteInvoiceLine(id: string): Promise<void>;
  getInvoiceLinesByInvoice(invoiceId: string): Promise<InvoiceLine[]>;
  createInvoiceLines(lines: InvoiceLine[]): Promise<InvoiceLine[]>;

  // Fixed Asset CRUD
  createFixedAsset(asset: FixedAsset): Promise<FixedAsset>;
  updateFixedAsset(id: string, updates: Partial<FixedAsset>): Promise<FixedAsset>;
  deleteFixedAsset(id: string): Promise<void>;

  // Item Catalog CRUD
  createItem(item: NonStockItem): Promise<NonStockItem>;
  updateItem(id: string, updates: Partial<NonStockItem>): Promise<NonStockItem>;
  deleteItem(id: string): Promise<void>;

  // Course Fee CRUD
  createCourseFee(fee: CourseFee): Promise<CourseFee>;
  updateCourseFee(id: string, updates: Partial<CourseFee>): Promise<CourseFee>;
  deleteCourseFee(id: string): Promise<void>;
  getCourseFeesByOrg(orgId: string): Promise<CourseFee[]>;

  // Vendor CRUD
  createVendor(vendor: Vendor): Promise<Vendor>;
  updateVendor(id: string, updates: Partial<Vendor>): Promise<Vendor>;
  deleteVendor(id: string): Promise<void>;

  // Bills CRUD
  createBill(bill: Bill): Promise<Bill>;
  updateBill(id: string, updates: Partial<Bill>): Promise<Bill>;
  deleteBill(id: string): Promise<void>;

  // Payables CRUD
  createPayable(payable: Payable): Promise<Payable>;
  updatePayable(id: string, updates: Partial<Payable>): Promise<Payable>;
  deletePayable(id: string, deletedBy?: string): Promise<void>;
  postPayableBill(id: string, actorId: string): Promise<{ journalEntryId: string; payableId: string; idempotent: boolean }>;
  postPayablePayment(input: {
    paymentEventId: string;
    payableIds: string[];
    amounts: number[];
    cashAccountId: string;
    paymentDate: string;
    paymentMethod: string;
    actorId: string;
  }): Promise<{ journalEntryId: string; paymentEventId: string; total: number; idempotent: boolean }>;
  cancelPayable(id: string, actorId: string, reason: string): Promise<{ payableId: string; journalEntryId?: string; idempotent: boolean }>;

  // AP Credit / Debit Memos
  getAPMemosByOrg(orgId: string): Promise<APMemo[]>;
  createAPMemo(memo: APMemo): Promise<APMemo>;
  updateAPMemo(id: string, updates: Partial<APMemo>): Promise<APMemo>;
  deleteAPMemo(id: string, actorId: string): Promise<void>;
  getNextAPMemoNumber(orgId: string, memoType: 'CREDIT' | 'DEBIT', memoDate: string, actorId: string): Promise<string>;
  submitAPMemo(id: string, actorId: string): Promise<{ memoId: string; status: string; idempotent: boolean }>;
  postAPMemo(id: string, actorId: string): Promise<{ memoId: string; journalEntryId: string; status: string; idempotent: boolean }>;
  reverseAPMemo(id: string, actorId: string, reason: string): Promise<{ memoId: string; journalEntryId: string; status: string; idempotent: boolean }>;
  cancelAPMemo(id: string, actorId: string, reason: string): Promise<{ memoId: string; status: string; idempotent: boolean }>;

  // AP Reclassifications
  getAPReclassificationsByOrg(orgId: string): Promise<APReclassification[]>;
  createAPReclassification(record: APReclassification): Promise<APReclassification>;
  updateAPReclassification(id: string, updates: Partial<APReclassification>): Promise<APReclassification>;
  deleteAPReclassification(id: string, actorId: string): Promise<void>;
  submitAPReclassification(id: string, actorId: string): Promise<any>;
  postAPReclassification(id: string, actorId: string): Promise<any>;
  reverseAPReclassification(id: string, actorId: string, reason: string): Promise<any>;
  cancelAPReclassification(id: string, actorId: string, reason: string): Promise<any>;

  // Time & Expenses CRUD
  getTimeExpensesByOrg(orgId: string): Promise<TimeExpense[]>;
  createTimeExpense(expense: TimeExpense): Promise<TimeExpense>;
  updateTimeExpense(id: string, updates: Partial<TimeExpense>): Promise<TimeExpense>;
  deleteTimeExpense(id: string): Promise<void>;

  // Check Voucher CRUD
  createCheckVoucher(check: CheckVoucher): Promise<CheckVoucher>;
  updateCheckVoucher(id: string, updates: Partial<CheckVoucher>): Promise<CheckVoucher>;
  deleteCheckVoucher(id: string): Promise<void>;
  getNextCheckNumber(orgId: string, bankAccountId: string): Promise<string>;

  // Exchange Rate CRUD
  createExchangeRate(rate: ExchangeRate): Promise<ExchangeRate>;
  updateExchangeRate(id: string, updates: Partial<ExchangeRate>): Promise<ExchangeRate>;
  deleteExchangeRate(id: string): Promise<void>;
  getExchangeRatesByOrg(orgId: string): Promise<ExchangeRate[]>;
  getExchangeRateById(id: string): Promise<ExchangeRate | null>;

  // Accounting Period CRUD
  createAccountingPeriod(period: AccountingPeriod): Promise<AccountingPeriod>;
  updateAccountingPeriod(id: string, updates: Partial<AccountingPeriod>): Promise<AccountingPeriod>;
  deleteAccountingPeriod(id: string): Promise<void>;
  getAccountingPeriodsByOrg(orgId: string): Promise<AccountingPeriod[]>;
  getAccountingPeriodById(id: string): Promise<AccountingPeriod | null>;
  getAccountingPeriodsByYear(orgId: string, fiscalYear: number): Promise<AccountingPeriod[]>;

  // Warehouse Location CRUD
  createWarehouseLocation(location: WarehouseLocation): Promise<WarehouseLocation>;
  updateWarehouseLocation(id: string, updates: Partial<WarehouseLocation>): Promise<WarehouseLocation>;
  deleteWarehouseLocation(id: string): Promise<void>;
  getWarehouseLocationsByOrg(orgId: string): Promise<WarehouseLocation[]>;
  getWarehouseLocationById(id: string): Promise<WarehouseLocation | null>;

  // Stock Item CRUD
  createStockItem(item: StockItem): Promise<StockItem>;
  updateStockItem(id: string, updates: Partial<StockItem>): Promise<StockItem>;
  deleteStockItem(id: string): Promise<void>;
  getStockItemsByOrg(orgId: string): Promise<StockItem[]>;
  getStockItemById(id: string): Promise<StockItem | null>;
  getStockItemsByLocation(orgId: string, locationId: string): Promise<StockItem[]>;

  // Inventory Level CRUD
  createInventoryLevel(level: InventoryLevel): Promise<InventoryLevel>;
  updateInventoryLevel(id: string, updates: Partial<InventoryLevel>): Promise<InventoryLevel>;
  deleteInventoryLevel(id: string): Promise<void>;
  getInventoryLevelsByOrg(orgId: string): Promise<InventoryLevel[]>;
  getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<InventoryLevel | null>;
  getStockStatusView(orgId: string): Promise<any[]>;  // Returns v_inventory_status view

  // Inventory Transaction CRUD
  createInventoryTransaction(transaction: InventoryTransaction): Promise<InventoryTransaction>;
  updateInventoryTransaction(id: string, updates: Partial<InventoryTransaction>): Promise<InventoryTransaction>;
  deleteInventoryTransaction(id: string): Promise<void>;
  getInventoryTransactionsByOrg(orgId: string): Promise<InventoryTransaction[]>;
  getInventoryTransactionById(id: string): Promise<InventoryTransaction | null>;
  getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<InventoryTransaction[]>;

  // Stock Adjustment CRUD
  createStockAdjustment(adjustment: StockAdjustment): Promise<StockAdjustment>;
  updateStockAdjustment(id: string, updates: Partial<StockAdjustment>): Promise<StockAdjustment>;
  deleteStockAdjustment(id: string): Promise<void>;
  reverseStockAdjustment(id: string, reversalDate: string, reason: string): Promise<any>;
  getStockAdjustmentsByOrg(orgId: string): Promise<StockAdjustment[]>;
  getStockAdjustmentById(id: string): Promise<StockAdjustment | null>;
  getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<StockAdjustment[]>;

  // Reorder Point CRUD
  createReorderPoint(reorder: ReorderPoint): Promise<ReorderPoint>;
  updateReorderPoint(id: string, updates: Partial<ReorderPoint>): Promise<ReorderPoint>;
  deleteReorderPoint(id: string): Promise<void>;
  getReorderPointsByOrg(orgId: string): Promise<ReorderPoint[]>;
  getReorderPointByItem(orgId: string, stockItemId: string): Promise<ReorderPoint | null>;
  getItemsNeedingReorder(orgId: string): Promise<StockItem[]>;

  // Enterprise Inventory Accounting
  getInventoryClasses(orgId: string): Promise<InventoryClass[]>;
  saveInventoryClass(inventoryClass: Partial<InventoryClass> & { orgId: string }): Promise<InventoryClass>;
  getOpeningInventory(orgId: string): Promise<OpeningInventoryDocument[]>;
  postOpeningInventory(document: Partial<OpeningInventoryDocument> & { orgId: string }): Promise<any>;

  // Revenue Schedule CRUD (Deferred Revenue)
  createRevenueSchedule(schedule: RevenueSchedule): Promise<RevenueSchedule>;
  updateRevenueSchedule(id: string, updates: Partial<RevenueSchedule>): Promise<RevenueSchedule>;
  deleteRevenueSchedule(id: string): Promise<void>;
  getRevenueSchedulesByOrg(orgId: string): Promise<RevenueSchedule[]>;
  getRevenueScheduleById(id: string): Promise<RevenueSchedule | null>;
  getRevenueSchedulesByCustomer(orgId: string, customerId: string): Promise<RevenueSchedule[]>;

  // Revenue Recognition Entry CRUD
  createRevenueRecognitionEntry(entry: RevenueRecognitionEntry): Promise<RevenueRecognitionEntry>;
  updateRevenueRecognitionEntry(id: string, updates: Partial<RevenueRecognitionEntry>): Promise<RevenueRecognitionEntry>;
  deleteRevenueRecognitionEntry(id: string): Promise<void>;
  getRevenueRecognitionEntriesByOrg(orgId: string): Promise<RevenueRecognitionEntry[]>;
  getRevenueRecognitionEntriesBySchedule(scheduleId: string): Promise<RevenueRecognitionEntry[]>;

  // Payroll Run CRUD
  createPayrollRun(run: PayrollRun): Promise<PayrollRun>;
  updatePayrollRun(id: string, updates: Partial<PayrollRun>): Promise<PayrollRun>;
  deletePayrollRun(id: string): Promise<void>;
  getPayrollRunsByOrg(orgId: string): Promise<PayrollRun[]>;
  getPayrollRunById(id: string): Promise<PayrollRun | null>;

  // Payroll Line CRUD
  createPayrollLine(line: PayrollLine): Promise<PayrollLine>;
  updatePayrollLine(id: string, updates: Partial<PayrollLine>): Promise<PayrollLine>;
  deletePayrollLine(id: string): Promise<void>;
  getPayrollLinesByRun(runId: string): Promise<PayrollLine[]>;
  getPayrollLinesByEmployee(employeeId: string): Promise<PayrollLine[]>;

  // Employee CRUD
  createEmployee(employee: Employee): Promise<Employee>;
  updateEmployee(id: string, updates: Partial<Employee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;
  getEmployeesByOrg(orgId: string): Promise<Employee[]>;
  getEmployeeById(id: string): Promise<Employee | null>;

  // Chart of Account CRUD
  createAccount(account: ChartOfAccount): Promise<ChartOfAccount>;
  updateAccount(id: string, updates: Partial<ChartOfAccount>): Promise<ChartOfAccount>;
  deleteAccount(id: string): Promise<void>;
  getAccountsByOrg(orgId: string): Promise<ChartOfAccount[]>;
  getAccountById(id: string): Promise<ChartOfAccount | null>;

  // Journal Entry CRUD
  createJournalEntry(entry: JournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry>;
  reverseJournalEntry(entryId: string): Promise<JournalEntry>;
  deleteJournalEntry(id: string): Promise<void>;
  getJournalEntriesByOrg(orgId: string): Promise<JournalEntry[]>;
  getJournalEntryById(id: string): Promise<JournalEntry | null>;

  // Journal Entry Line CRUD
  createJournalLine(line: JournalLine): Promise<JournalLine>;
  updateJournalLine(id: string, updates: Partial<JournalLine>): Promise<JournalLine>;
  deleteJournalLine(id: string): Promise<void>;
  getJournalLinesByEntry(entryId: string): Promise<JournalLine[]>;
  createJournalLines(lines: JournalLine[]): Promise<JournalLine[]>;

  // Manual Journal Voucher CRUD and atomic posting
  getJournalVouchersByOrg(orgId: string): Promise<JournalVoucher[]>;
  getJournalVoucherLines(voucherId: string): Promise<JournalVoucherLine[]>;
  createJournalVoucher(voucher: Omit<JournalVoucher, 'id' | 'jvNumber' | 'createdAt'>): Promise<JournalVoucher>;
  updateJournalVoucher(id: string, updates: Partial<JournalVoucher>): Promise<JournalVoucher>;
  replaceJournalVoucherLines(voucherId: string, lines: Omit<JournalVoucherLine, 'id' | 'journalVoucherId'>[]): Promise<JournalVoucherLine[]>;
  deleteJournalVoucher(id: string): Promise<void>;
  postJournalVoucher(id: string, postedBy: string): Promise<JournalVoucher>;

  // Audit Log CRUD
  createAuditLog(log: AuditLog): Promise<AuditLog>;
  getAuditLogsByOrg(orgId: string): Promise<AuditLog[]>;

  // Feedback Ticket CRUD
  createFeedbackTicket(ticket: FeedbackTicket): Promise<FeedbackTicket>;
  updateFeedbackTicket(id: string, updates: Partial<FeedbackTicket>): Promise<FeedbackTicket>;
  getFeedbackTickets(context?: { orgId?: string; isSystemAdmin?: boolean; userId?: string }): Promise<FeedbackTicket[]>;

  // Purchase Order CRUD
  createPurchaseOrder(order: PurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): Promise<PurchaseOrder>;
  deletePurchaseOrder(id: string): Promise<void>;
  getPurchaseOrdersByOrg(orgId: string): Promise<PurchaseOrder[]>;
  getPurchaseOrderById(id: string): Promise<PurchaseOrder | null>;

  // Goods Receipt CRUD
  createGoodsReceipt(receipt: GoodsReceipt): Promise<GoodsReceipt>;
  updateGoodsReceipt(id: string, updates: Partial<GoodsReceipt>): Promise<GoodsReceipt>;
  deleteGoodsReceipt(id: string): Promise<void>;
  getGoodsReceiptsByOrg(orgId: string): Promise<GoodsReceipt[]>;
  getGoodsReceiptById(id: string): Promise<GoodsReceipt | null>;

  // Recurring Bill CRUD
  createRecurringBill(bill: RecurringBill): Promise<RecurringBill>;
  updateRecurringBill(id: string, updates: Partial<RecurringBill>): Promise<RecurringBill>;
  deleteRecurringBill(id: string): Promise<void>;
  getRecurringBillsByOrg(orgId: string): Promise<RecurringBill[]>;
  getRecurringBillById(id: string): Promise<RecurringBill | null>;

  // Alumni Employment Report CRUD
  createAlumniReport(report: AlumniEmploymentReport): Promise<AlumniEmploymentReport>;
  updateAlumniReport(id: string, updates: Partial<AlumniEmploymentReport>): Promise<AlumniEmploymentReport>;
  deleteAlumniReport(id: string): Promise<void>;
  getAlumniReportsByOrg(orgId: string): Promise<AlumniEmploymentReport[]>;

  // Assessment Registration CRUD
  createAssessmentRegistration(registration: AssessmentRegistration): Promise<AssessmentRegistration>;
  updateAssessmentRegistration(id: string, updates: Partial<AssessmentRegistration>): Promise<AssessmentRegistration>;
  deleteAssessmentRegistration(id: string): Promise<void>;
  getAssessmentRegistrationsByOrg(orgId: string): Promise<AssessmentRegistration[]>;

  // Generic create for other entities
  createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T>;
  updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T>;
  deleteEntity(table: string, id: string): Promise<void>;

  // Archive / Restore / Permanent Delete
  archiveEntity(table: string, id: string, userId: string): Promise<void>;
  restoreEntity(table: string, id: string): Promise<void>;
  permanentDeleteEntity(table: string, id: string): Promise<void>;
  checkUsage(table: string, id: string): Promise<{ isUsed: boolean; usedIn: string[] }>;
}
