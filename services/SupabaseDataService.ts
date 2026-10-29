
import { FetchPageOptions, IDataService, InitialData, PaginatedResult } from './IDataService';
import { config } from '../config/app';
import { TokenManager } from './TokenManager';
import { BatchTranscriptRecord, FeedbackTicket, InventoryClass, Invoice, JournalVoucher, JournalVoucherLine, OpeningInventoryDocument, TaxCategoryEntry, TranscriptRecord } from '../types';
import { normalizeStudentDocuments } from './StudentDocumentService';

/**
 * SupabaseDataService
 * 
 * Connects to Supabase for cloud-based data persistence.
 * Fetches data from Supabase tables matching entity names.
 * Throws an error if credentials are not configured.
 */
export class SupabaseDataService implements IDataService {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = config.supabase.url;
    this.supabaseKey = config.supabase.anonKey;
  }

  // Getter for baseUrl (alias for supabaseUrl REST endpoint)
  private get baseUrl(): string {
    return `${this.supabaseUrl}/rest/v1`;
  }

  private getSelectColumns(table: string): string {
    const selectColumns: Record<string, string> = {
      organizations: 'id,name,currency,institution_type,tax_id,is_vat_registered,subscription_status,plan_type,pending_plan_type,payment_reference,license_expiry,created_at,updated_at,primary_color,logo_url',
      users: 'id,org_id,name,email,last_name,profile_photo,contact_number,address,password_hash,salt,role,last_login_at,is_active,failed_login_attempts,locked_until,created_at,updated_at,auth_uid,trainer_id,student_id',
      students: 'id,org_id,uli,last_name,first_name,middle_name,extension,sex,date_of_birth,email,contact_number,street,barangay,city,province,guardian,location_id,sponsor_id,documents,created_at,updated_at,profile_photo,mailing_region,tesda_employment_status,tesda_employment_type,tesda_learner_classifications,tesda_other_classification,tesda_disability_types,tesda_disability_causes,tesda_course_qualification,tesda_scholarship_package,tesda_privacy_consent',
      batches: 'id,org_id,qualification_id,trainer_id,sponsor_id,location_id,batch_code,name,year,start_date,end_date,status,max_students,current_students,student_ids,created_at,updated_at,billable_student_limit',
      invoices: 'id,org_id,invoice_no,document_type,payment_method,si_no,sponsor_id,student_id,enrollment_id,batch_id,invoice_date,due_date,status,subtotal,vat_amount,grand_total,total_ewt_amount,net_amount_due,amount_paid,balance_due,ewt_rate,is_subject_to_ewt,reference,terms,notes,journal_entry_id,posted_by,posted_at,voided_by,voided_at,void_reason,is_deleted,deleted_at,deleted_by,created_at,created_by,updated_at,updated_by,vat_pricing,vat_rate,gl_entry_number,assessment_registration_id',
      invoice_lines: 'id,invoice_id,line_number,description,course_fee_id,enrollment_id,quantity,unit_price,amount,tax_category_id,vat_amount,gl_account_id,is_deleted,deleted_at,deleted_by,created_at,updated_at,net_amount,gross_amount,org_id,classification_code,assessment_registration_id,line_type',
      payments: 'id,org_id,payment_no,sponsor_id,student_id,payment_date,status,payment_method,ref_no,bank_account_id,check_number,check_date,amount_received,ewt_amount_certified,total_applied,customer_deposit_balance,journal_entry_id,voided_at,voided_by,void_reason,posted_at,posted_by,notes,created_at,created_by,updated_at,updated_by,is_deleted,deleted_at,deleted_by',
      payment_applications: 'id,payment_id,invoice_id,amount_applied,is_reversed,reversal_reason,reversed_at,reversed_by,created_at,created_by,updated_at',
      journal_entries: 'id,org_id,period_id,date,description,reference,status,created_by,source_type,created_at,updated_at,approved_by,approved_at,gl_entry_number,review_comments,updated_by,source_ref,deposit_id,reversed_by,reversed_at,reversal_reason,original_entry_id',
      journal_lines: 'id,journal_entry_id,account_id,debit,credit,memo,contact_id,contact_type,batch_id,item_id,asset_id,is_cleared,created_at,description,classification_code,tax_category_id',
      audit_logs: 'id,org_id,user_id,action,entity_type,entity_id,details,ip_address,user_agent,created_at',
      enrollments: 'id,org_id,enrollment_code,student_id,batch_id,sponsor_id,billing_status,enrollment_status,enrollment_date,total_fees,billed_amount,notes,is_deleted,deleted_at,deleted_by,created_at,created_by,updated_at,updated_by,billing_type',
      tax_categories: 'id,org_id,code,description,type,rate,is_inclusive,output_account_id,created_at,updated_at,tax_type',
    };

    return selectColumns[table] || '*';
  }

  private isUuid(value?: string | null): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
  }

  // Helper method to get standard headers for Supabase requests.
  // Authenticated Supabase sessions are the default so PostgREST can enforce RLS.
  private async getHeaders(preferUserToken: boolean = true): Promise<Record<string, string>> {
    const accessToken = preferUserToken ? await TokenManager.getAccessToken() : null;
    const headers: Record<string, string> = {
      'apikey': this.supabaseKey,
      'Content-Type': 'application/json',
    };

    // Only callers that already have a Supabase-compatible user token may opt
    // into Authorization. Never treat the publishable API key as a bearer JWT.
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }

  /**
   * Generic fetch method for Supabase tables
   * Uses the REST API for simplicity without client library dependency
   */
  private async fetchFromSupabase<T>(table: string): Promise<T[]> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', returning empty array`);
      return [] as T[];
    }

    try {
      const url = new URL(`${this.baseUrl}/${table}`);
      url.searchParams.set('select', this.getSelectColumns(table));
      console.debug(`[Supabase] 📡 Fetching ${table}...`);

      const response = await fetch(url, {
        headers: await this.getHeaders(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (
          table === 'organizations' &&
          /institution_type/i.test(errorBody) &&
          /schema cache|could not find|column/i.test(errorBody)
        ) {
          console.warn("[Supabase] organizations.institution_type not available yet; retrying organizations fetch without it.");
          const fallbackUrl = new URL(`${this.baseUrl}/${table}`);
          fallbackUrl.searchParams.set(
            'select',
            this.getSelectColumns(table)
              .split(',')
              .filter(column => column !== 'institution_type')
              .join(',')
          );
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: await this.getHeaders(),
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json() as T[];
            console.debug(`[Supabase] âœ… ${table}: ${fallbackData.length} rows (legacy schema fallback)`);
            return fallbackData;
          }

          console.error(`[Supabase] Legacy organizations fetch fallback failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
          console.error(`[Supabase] Fallback response body:`, await fallbackResponse.text());
          return [] as T[];
        }
        // Handle 404 (table not found) gracefully
        if (response.status === 404) {
          console.warn(`[Supabase] ⚠️ Table not found: '${table}' (404) - using empty array`);
          return [] as T[];
        }
        // Handle RLS permission errors with clear guidance
        if (response.status === 403 || response.status === 401) {
          console.error(`[Supabase] 🔒 RLS Permission Error on '${table}': ${response.status}`);
          console.error(`[Supabase] This usually means Row Level Security (RLS) is enabled but no policies are defined.`);
          console.error(`[Supabase] Run FIX_JOURNAL_RLS.sql in Supabase SQL Editor to fix this.`);
          console.error(`[Supabase] Response:`, errorBody);
          return [] as T[];
        }
        console.error(`[Supabase] ❌ Error fetching ${table}: ${response.status} ${response.statusText}`);
        console.error(`[Supabase] Response body:`, errorBody);
        return [] as T[];
      }

      const data = await response.json() as T[];
      console.debug(`[Supabase] ✅ ${table}: ${data.length} rows`);
      return data;
    } catch (error) {
      console.error(`[Supabase] ❌ Network error fetching ${table}:`, error);
      return [] as T[];
    }
  }

  /**
   * Helper to execute promises in batches to avoid browser connection limits
   * and potential CORS/preflight timeouts on many parallel requests.
   */
  private async fetchInBatches<T>(fetchers: (() => Promise<T>)[], batchSize = 10): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < fetchers.length; i += batchSize) {
      const batch = fetchers.slice(i, i + batchSize);
      console.debug(`[Supabase] 📦 Fetching batch ${Math.floor(i / batchSize) + 1} (${batch.length} tables)...`);
      const batchResults = await Promise.all(batch.map(f => f()));
      results.push(...batchResults);
    }
    return results;
  }

  private async fetchAllPages<T>(url: string, pageSize = 1000): Promise<T[]> {
    const rows: T[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const response = await fetch(url, {
        headers: {
          ...(await this.getHeaders()),
          Range: `${offset}-${offset + pageSize - 1}`,
          'Range-Unit': 'items'
        }
      });
      if (!response.ok) {
        throw new Error(`Supabase fetch failed (${response.status}): ${await response.text()}`);
      }

      const page = await response.json() as T[];
      rows.push(...page);
      if (page.length < pageSize) break;
    }

    return rows;
  }

  private async fetchAllPagesWithSoftDeleteFallback<T>(url: string, table: string): Promise<T[]> {
    try {
      return await this.fetchAllPages<T>(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/column\s+\S*is_deleted\s+does not exist/i.test(message)) {
        throw error;
      }

      const legacyUrl = new URL(url);
      legacyUrl.searchParams.delete('is_deleted');
      console.warn(`[Supabase] ${table}.is_deleted is unavailable; loading from the legacy schema.`);
      return this.fetchAllPages<T>(legacyUrl.toString());
    }
  }

  private extractMissingColumnFromSchemaError(errorText: string): string | null {
    // PostgREST schema-cache error format:
    // "Could not find the 'description' column of 'journal_lines' in the schema cache"
    const match = errorText.match(/Could not find the '([^']+)' column of 'journal_lines'/i);
    return match?.[1] || null;
  }

  private normalizeStudentDocumentsForDb(documents: any): any {
    if (!documents) return [];
    const parsedDocuments = Array.isArray(documents)
      ? documents.map((doc: any) => {
          if (!doc) return doc;
          if (typeof doc !== 'string') return doc;

          try {
            return JSON.parse(doc);
          } catch {
            return { name: doc, status: 'UPLOADED' };
          }
        })
      : typeof documents === 'object'
        ? [documents]
        : [];

    return normalizeStudentDocuments(parsedDocuments).map((doc: any) => JSON.stringify(doc));
  }

  private buildStudentDocumentId(doc: any, index: number): string {
    const explicitId = typeof doc?.id === 'string' ? doc.id.trim() : '';
    if (explicitId) return explicitId;

    const rawName = typeof doc?.name === 'string' ? doc.name : `document-${index + 1}`;
    const slug = rawName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `doc-${index}-${slug || 'item'}`;
  }

  private normalizeStudentDocument(doc: any, index: number): any {
    if (!doc || typeof doc !== 'object') {
      return {
        id: `doc-${index}-item`,
        name: `Document ${index + 1}`,
        status: 'PENDING'
      };
    }

    const normalized = this.snakeToCamel(doc);
    return {
      ...normalized,
      id: this.buildStudentDocumentId(normalized, index),
      name: typeof normalized.name === 'string' && normalized.name.trim()
        ? normalized.name
        : `Document ${index + 1}`,
      status: normalized.status || 'PENDING'
    };
  }

  private parseStudentDocumentsFromDb(documents: any): any[] {
    if (!documents) return [];
    if (Array.isArray(documents)) {
      return normalizeStudentDocuments(documents.map((doc: any, index: number) => {
        if (!doc) return doc;
        if (typeof doc === 'string') {
          try {
            return this.normalizeStudentDocument(JSON.parse(doc), index);
          } catch {
            return {
              id: this.buildStudentDocumentId({ name: doc }, index),
              name: doc,
              status: 'UPLOADED'
            };
          }
        }
        return this.normalizeStudentDocument(doc, index);
      }));
    }
    if (typeof documents === 'object') {
      return normalizeStudentDocuments([this.normalizeStudentDocument(documents, 0)]);
    }
    return [];
  }

  async getInitialData(): Promise<InitialData> {
    console.info("[Supabase] ☁️ Fetching data from Supabase...");

    if (!this.supabaseUrl || !this.supabaseKey) {
      console.error("[Supabase] ❌ Credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      throw new Error('Supabase credentials not configured');
    }

    try {
      console.info(`[Supabase] URL: ${this.supabaseUrl.substring(0, 50)}...`);

      const tablesToFetch = [
        'organizations', 'users', 'students', 'qualifications', 'trainers',
        'batches', 'sponsors', 'items', 'vendors', 'locations',
        'trainer_schedules', 'employees', 'bank_accounts', 'bank_reconciliations',
        'recurring_journal_entries', 'chart_of_accounts', 'journal_entries', 'journal_lines',
        'payroll_runs', 'payroll_lines', 'audit_logs', 'purchase_orders',
        'payment_histories', 'fixed_assets', 'vendor_tax_settings', 'atc_categories',
        'atc_items', 'atc_rates', 'payables', 'bills',
        'payments', 'payment_applications',
        'warehouse_locations', 'stock_items', 'inventory_levels', 'inventory_transactions',
        'stock_adjustments', 'reorder_points', 'course_fees', 'alumni_employment_reports',
        'enrollments', 'assessment_registrations', 'invoices', 'invoice_lines', 'tax_categories'
      ];

      const fetchers = tablesToFetch.map(table => (!this.isLocalSupabase() && ['warehouse_locations', 'stock_items', 'inventory_levels', 'inventory_transactions', 'stock_adjustments'].includes(table))
        ? () => (table === 'warehouse_locations'
          ? this.listWarehouseLocationsViaEdgeFunction()
          : table === 'stock_items'
            ? this.listStockItemsViaEdgeFunction()
            : table === 'inventory_levels'
              ? this.listInventoryLevelsViaEdgeFunction()
              : table === 'inventory_transactions'
                ? this.inventoryAccountingRequest<any[]>('list_transactions')
            : this.listStockAdjustmentsViaEdgeFunction()).catch(error => {
          console.warn(`[Supabase] Failed to load ${table} through Edge Function, falling back to REST:`, error);
          return this.fetchFromSupabase(table);
        })
        : table === 'course_fees'
          ? () => this.fetchAllPagesWithSoftDeleteFallback<any>(
              `${this.baseUrl}/course_fees?is_deleted=eq.false&order=created_at.desc`,
              'course_fees'
            ).catch(error => {
              console.warn('[Supabase] Failed paginated course_fees load, falling back to REST:', error);
              return this.fetchFromSupabase('course_fees');
            })
          : () => this.fetchFromSupabase(table));

      const results = await this.fetchInBatches(fetchers, 8);

      const [
        organizations, users, students, qualifications, trainers,
        batches, sponsors, items, vendors, locations,
        schedules, employees, bankAccounts, bankReconciliations,
        recurringJournalEntries, accounts, journalEntries, journalLines,
        payrollRuns, payrollLines, auditLogs, purchaseOrders,
        paymentHistories, fixedAssets, vendorTaxSettings, atcCategories,
        atcItems, atcRates, payables, bills,
        payments, paymentApplications,
        warehouseLocations, stockItems, inventoryLevels, inventoryTransactions,
        stockAdjustments, reorderPoints, courseFees, alumniReports,
        enrollments, assessmentRegistrations, invoices, invoice_lines, taxCategories
      ] = results as any[];

      // Log data status
      const hasData = organizations && organizations.length > 0;

      if (!hasData) {
        console.warn("[Supabase] ⚠️ No organizations found in Supabase. Database may be empty.");
      }

      console.info("[Supabase] ✅ Data loaded from Supabase");

      // Convert all snake_case data from Supabase to camelCase for the app
      const camInvoices = this.snakeToCamel(invoices as any) || [];
      const camInvoiceLines = this.snakeToCamel(invoice_lines as any) || [];

      // Link lines to invoices for components that expect attached lines
      const invoicesWithLines = camInvoices.map((inv: any) => ({
        ...inv,
        lines: camInvoiceLines.filter((line: any) => line.invoiceId === inv.id)
      }));

      // Link lines to journal entries
      const journalEntriesWithLines = this.snakeToCamel(journalEntries as any).map((entry: any) => ({
        ...entry,
        lines: this.snakeToCamel(journalLines as any).filter((line: any) => line.journalEntryId === entry.id)
      }));

      const parsedStudents = (this.snakeToCamel(students as any) || []).map((s: any) => ({
        ...s,
        documents: this.parseStudentDocumentsFromDb(s.documents)
      }));

      return {
        organizations: this.snakeToCamel(organizations as any) || [],
        users: this.snakeToCamel(users as any) || [],
        students: parsedStudents,
        qualifications: this.snakeToCamel(qualifications as any) || [],
        trainers: this.snakeToCamel(trainers as any) || [],
        batches: this.snakeToCamel(batches as any) || [],
        sponsors: this.snakeToCamel(sponsors as any) || [],
        items: this.snakeToCamel(items as any) || [],
        vendors: this.snakeToCamel(vendors as any) || [],
        locations: this.snakeToCamel(locations as any) || [],
        schedules: this.snakeToCamel(schedules as any) || [],
        employees: this.snakeToCamel(employees as any) || [],
        bankAccounts: this.snakeToCamel(bankAccounts as any) || [],
        bankReconciliations: this.snakeToCamel(bankReconciliations as any) || [],
        recurringJournalEntries: this.snakeToCamel(recurringJournalEntries as any) || [],
        accounts: this.snakeToCamel(accounts as any) || [],
        journalEntries: journalEntriesWithLines,
        journalLines: this.snakeToCamel(journalLines as any) || [],
        payrollRuns: this.snakeToCamel(payrollRuns as any) || [],
        payrollLines: this.snakeToCamel(payrollLines as any) || [],
        auditLogs: this.snakeToCamel(auditLogs as any) || [],
        purchaseOrders: (this.snakeToCamel(purchaseOrders as any) || []).map((po: any) => ({
          ...po,
          date: po.date || po.orderDate || '',
          reference: po.reference || po.poNumber || '',
          memo: po.memo || po.notes || '',
          lines: Array.isArray(po.lines) ? po.lines : [],
        })),
        paymentHistories: this.snakeToCamel(paymentHistories as any) || [],
        payments: this.snakeToCamel(payments as any) || [],
        paymentApplications: this.snakeToCamel(paymentApplications as any) || [],
        fixedAssets: this.snakeToCamel(fixedAssets as any) || [],
        vendorTaxSettings: this.snakeToCamel(vendorTaxSettings as any) || [],
        atcCategories: this.snakeToCamel(atcCategories as any) || [],
        atcItems: this.snakeToCamel(atcItems as any) || [],
        atcRates: this.snakeToCamel(atcRates as any) || [],
        payables: this.snakeToCamel(payables as any) || [],
        bills: this.snakeToCamel(bills as any) || [],
        warehouseLocations: this.snakeToCamel(warehouseLocations as any) || [],
        stockItems: this.snakeToCamel(stockItems as any) || [],
        inventoryLevels: this.snakeToCamel(inventoryLevels as any) || [],
        inventoryTransactions: this.snakeToCamel(inventoryTransactions as any) || [],
        stockAdjustments: this.snakeToCamel(stockAdjustments as any) || [],
        reorderPoints: this.snakeToCamel(reorderPoints as any) || [],
        courseFees: this.snakeToCamel(courseFees as any) || [],
        enrollments: this.snakeToCamel(enrollments as any) || [],
        assessmentRegistrations: this.snakeToCamel(assessmentRegistrations as any) || [],
        alumniReports: this.snakeToCamel(alumniReports as any) || [],
        invoices: invoicesWithLines,
        invoiceLines: this.snakeToCamel(invoice_lines as any) || [],
        taxCategories: this.snakeToCamel(taxCategories as any) || [],
        feedbackTickets: [],
      };
    } catch (error) {
      console.error("[Supabase] ❌ Fatal error loading data:", error);
      console.error("[Supabase] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Convert snake_case object keys to camelCase
   * Used because Supabase tables use snake_case but app uses camelCase
   * Deeply recursive to handle JSONB columns
   * Also converts numeric string values from PostgreSQL NUMERIC types to JavaScript numbers
   */
  private snakeToCamel(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.snakeToCamel(item));
    if (obj instanceof Date) return obj;

    // Fields that should be converted from string to number (PostgreSQL NUMERIC comes as strings)
    const numericFields = new Set([
      'debit', 'credit', 'amount', 'balance', 'quantity', 'qty', 'price', 'unit_price', 'unitPrice',
      'rate', 'total', 'subtotal', 'tax', 'vat', 'discount', 'net', 'gross', 'fee', 'charge',
      'cost', 'value', 'salary', 'hours', 'overtime', 'deductions', 'contributions', 'netPay', 'net_pay',
      'withholding_amount', 'withholdingAmount', 'applied_rate_percent', 'appliedRatePercent',
      'net_payable', 'netPayable', 'paid_amount', 'paidAmount', 'capacity', 'limit', 'ewt_rate', 'ewtRate',
      'net_amount', 'netAmount', 'vat_amount', 'vatAmount', 'gross_amount', 'grossAmount'
    ]);

    const camelCaseObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Convert snake_case to camelCase: is_vat_registered → isVatRegistered
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        let value = obj[key];

        // Convert numeric string values to numbers for known numeric fields
        if (numericFields.has(key) || numericFields.has(camelKey)) {
          if (typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
            value = Number(value);
          }
        }

        // Recursively convert values for nested JSONB objects
        camelCaseObj[camelKey] = this.snakeToCamel(value);
      }
    }
    return camelCaseObj;
  }

  /**
   * Convert camelCase object keys to snake_case
   * Used because Supabase tables use snake_case column names
   * Deeply recursive to handle JSONB columns
   */
  private camelToSnake(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.camelToSnake(item));
    if (obj instanceof Date) return obj;

    const snakeCaseObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Convert camelCase to snake_case: isVatRegistered → is_vat_registered
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        // Recursively convert values for nested JSONB objects
        snakeCaseObj[snakeKey] = this.camelToSnake(obj[key]);
      }
    }
    return snakeCaseObj;
  }

  /**
   * Generic INSERT to Supabase table
   */
  private async insertToSupabase<T>(table: string, data: T): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}`;
      // Convert camelCase to snake_case for Supabase
      const snakeCaseData = this.camelToSnake(data);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(await this.getHeaders()),
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(snakeCaseData),
      });

      if (!response.ok) {
        console.error(`[Supabase] Error inserting into ${table}: ${response.status} ${response.statusText}`);
        const error = await response.text();
        console.error(`[Supabase] Response: ${error}`);
        throw new Error(`Failed to insert into ${table}`);
      }

      const result = await response.json();
      console.info(`[Supabase] ✅ Inserted into ${table}:`, result);
      // Convert response back to camelCase
      const camelCaseResult = this.snakeToCamel(result[0] || result);
      return camelCaseResult;
    } catch (error) {
      console.error(`[Supabase] Network error inserting into ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic UPDATE to Supabase table
   */
  private async updateInSupabase<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
      // Convert camelCase to snake_case for Supabase
      const snakeCaseUpdates = this.camelToSnake(updates);

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...(await this.getHeaders()),
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(snakeCaseUpdates),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Supabase] Error updating ${table}: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to update ${table}: ${errorText}`);
      }

      const result = await response.json();
      console.info(`[Supabase] ✅ Updated ${table}:`, result);
      // Convert response back to camelCase
      const camelCaseResult = this.snakeToCamel(result[0] || result);
      return camelCaseResult;
    } catch (error) {
      console.error(`[Supabase] Network error updating ${table}:`, error);
      throw error;
    }
  }

  /**
   * Generic DELETE from Supabase table
   */
  private async deleteFromSupabase(table: string, id: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: await this.getHeaders(),
      });

      if (!response.ok && response.status !== 204) {
        console.error(`[Supabase] Error deleting from ${table}: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to delete from ${table}`);
      }

      console.info(`[Supabase] ✅ Deleted from ${table} (id: ${id})`);
    } catch (error) {
      console.error(`[Supabase] Network error deleting from ${table}:`, error);
      throw error;
    }
  }

  /**
   * DELETE from Supabase table using a custom filter string
   */
  private async deleteByFilter(table: string, filter: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/${table}?${filter}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: await this.getHeaders(),
      });

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.error(`[Supabase] Error deleting from ${table} with filter ${filter}: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to delete from ${table}: ${errorText || response.statusText}`);
      }

      console.info(`[Supabase] ✅ Deleted from ${table} with filter: ${filter}`);
    } catch (error) {
      console.error(`[Supabase] Network error deleting from ${table}:`, error);
      throw error;
    }
  }

  /**
   * Raw INSERT to Supabase - with schema filtering and conversion
   * Converts camelCase to snake_case, filters to valid columns, and returns camelCase result
   */
  private async insertToSupabaseRaw<T>(table: string, data: any, preferUserToken: boolean = true): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', falling back`);
      throw new Error(`Supabase not configured for ${table}`);
    }

    try {
      const url = `${this.baseUrl}/${table}`;
      let payload = { ...data };
      let retries = 0;
      let paymentStatusFallbackApplied = false;

      while (true) {
        console.debug(`[Supabase] 📝 Inserting into ${table}:`, payload);

        if (table === 'payments') {
          payload = this.normalizePaymentStatusForStorage(payload);
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { ...(await this.getHeaders(preferUserToken)), 'Prefer': 'return=representation' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          const camelResult = this.snakeToCamel(Array.isArray(result) ? result[0] : result);
          console.info(`[Supabase] ✅ Inserted into ${table}:`, camelResult);
          return camelResult as T;
        }

        const error = await response.text();
        const missingColumn = this.extractMissingColumnFromSchemaError(error)
          || (error.match(/Could not find the '([^']+)' column of '[^']+'/i)?.[1] ?? null);

        if (table === 'course_fees' && missingColumn === 'funding_type') {
          throw new Error(
            'Course fee funding type is unavailable in the database. Apply migration 20260627100200_add_sponsor_to_course_fees.sql before creating course fees.'
          );
        }

        if (missingColumn && retries < 8 && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          console.warn(`[Supabase] insertToSupabaseRaw retrying without unknown column '${missingColumn}'`);
          delete payload[missingColumn];
          retries += 1;
          continue;
        }

        if (this.shouldRetryPaymentStatusWrite(table, payload, error, paymentStatusFallbackApplied)) {
          console.warn('[Supabase] payments_status_check rejected payment status; retrying with POSTED for compatibility');
          payload = this.normalizePaymentStatusForStorage(payload);
          paymentStatusFallbackApplied = true;
          continue;
        }

        console.error(`[Supabase] ❌ Insert failed: ${response.status} ${response.statusText}`, error);
        throw new Error(`Failed to insert into ${table}: ${error}`);
      }
    } catch (error) {
      console.error(`[Supabase] Network error inserting into ${table}:`, error);
      throw error;
    }
  }

  /**
   * Raw UPDATE to Supabase - with schema filtering and conversion
   * Converts camelCase to snake_case, filters to valid columns, and returns camelCase result
   */
  private async updateInSupabaseRaw<T>(
    table: string,
    id: string,
    data: any,
    preferUserToken: boolean = true,
    requireReturnedRow: boolean = false
  ): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn(`[Supabase] Missing credentials for table '${table}', falling back`);
      throw new Error(`Supabase not configured for ${table}`);
    }

    try {
      const url = `${this.baseUrl}/${table}?id=eq.${id}`;
      let payload = { ...data };
      let retries = 0;
      let paymentStatusFallbackApplied = false;

      while (true) {
        console.debug(`[Supabase] Updating ${table} (${id}):`, payload);

        if (table === 'payments') {
          payload = this.normalizePaymentStatusForStorage(payload);
        }

        const response = await fetch(url, {
          method: 'PATCH',
          headers: { ...(await this.getHeaders(preferUserToken)), 'Prefer': 'return=representation' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          const returnedRow = Array.isArray(result) ? result[0] : result;
          if (requireReturnedRow && !returnedRow) {
            throw new Error(
              `Supabase accepted the ${table} update request but did not update a row. ` +
              'Verify that the signed-in user has update permission for this organization.'
            );
          }
          const camelResult = returnedRow
            ? this.snakeToCamel(returnedRow)
            : { id, ...this.snakeToCamel(payload) };
          if (!returnedRow) {
            console.debug(`[Supabase] Update ${table} (${id}) completed without row representation; using submitted payload locally.`);
          }
          console.info(`[Supabase] Updated ${table}:`, camelResult);
          return camelResult as T;
        }

        const error = await response.text();
        const missingColumn = this.extractMissingColumnFromSchemaError(error)
          || (error.match(/Could not find the '([^']+)' column of '[^']+'/i)?.[1] ?? null);
        if (table === 'course_fees' && missingColumn === 'funding_type') {
          throw new Error(
            'Course fee funding type is unavailable in the database. Apply migration 20260627100200_add_sponsor_to_course_fees.sql before updating course fees.'
          );
        }
        if (missingColumn && retries < 8 && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          console.warn(`[Supabase] updateInSupabaseRaw retrying without unknown column '${missingColumn}'`);
          delete payload[missingColumn];
          retries += 1;
          continue;
        }

        if (this.shouldRetryPaymentStatusWrite(table, payload, error, paymentStatusFallbackApplied)) {
          console.warn('[Supabase] payments_status_check rejected payment status; retrying with POSTED for compatibility');
          payload = this.normalizePaymentStatusForStorage(payload);
          paymentStatusFallbackApplied = true;
          continue;
        }

        console.error(`[Supabase] Update failed: ${response.status} ${response.statusText}`, error);
        throw new Error(`Failed to update ${table}: ${error}`);
      }
    } catch (error) {
      console.error(`[Supabase] Network error updating ${table}:`, error);
      throw error;
    }
  }

  // Backward compatibility: some deployed databases still reject OPEN on payments.
  // If that check constraint fails, we retry with POSTED so the write can succeed.
  private normalizePaymentStatusForStorage(payload: any): any {
    if (!payload || typeof payload !== 'object') return payload;

    const normalized = { ...payload };
    const status = String(normalized.status || '').toUpperCase();
    if (status === 'OPEN' || status === 'CLOSED') {
      normalized.status = 'POSTED';
    }

    return normalized;
  }

  private shouldRetryPaymentStatusWrite(
    table: string,
    payload: any,
    errorText: string,
    fallbackApplied: boolean
  ): boolean {
    if (fallbackApplied || table !== 'payments') return false;
    if (!/payments_status_check/i.test(errorText)) return false;
    return ['OPEN', 'CLOSED'].includes(String(payload?.status || '').toUpperCase());
  }

  /**
   * Filter object to only include valid columns for a given table
   * Removes fields that don't exist in Supabase schema
   * For inserts, excludes auto-generated columns (created_at, updated_at, net_book_value for fixed_assets)
   */
  private filterToTableSchema(table: string, data: any, isInsert: boolean = false): any {
    const validColumns: Record<string, string[]> = {
      students: [
        'id', 'org_id', 'uli', 'last_name', 'first_name', 'middle_name', 'extension',
        'sex', 'date_of_birth', 'birth_region', 'birth_province', 'birth_city',
        'civil_status', 'educational_attainment', 'nationality', 'email', 'contact_number',
        'street', 'barangay', 'city', 'district', 'province', 'guardian',
        'mailing_region', 'tesda_employment_status', 'tesda_employment_type',
        'tesda_learner_classifications', 'tesda_other_classification',
        'tesda_disability_types', 'tesda_disability_causes',
        'tesda_course_qualification', 'tesda_scholarship_package', 'tesda_privacy_consent',
        'location_id', 'sponsor_id', 'profile_photo', 'documents', 'created_at', 'updated_at'
      ],
      organizations: ['id', 'name', 'currency', 'institution_type', 'tax_id', 'is_vat_registered', 'subscription_status', 'plan_type', 'pending_plan_type', 'payment_reference', 'license_expiry', 'created_at', 'updated_at', 'primary_color', 'logo_url'],
      users: ['id', 'name', 'email', 'last_name', 'profile_photo', 'contact_number', 'address', 'password_hash', 'salt', 'role', 'org_id', 'student_id', 'trainer_id', 'is_active', 'auth_uid', 'created_at', 'updated_at'],
      trainers: ['id', 'org_id', 'first_name', 'last_name', 'middle_name', 'email', 'contact_number', 'specialization', 'qualification_ids', 'created_at', 'updated_at'],
      qualifications: ['id', 'org_id', 'code', 'name', 'duration_days', 'sector', 'created_at', 'updated_at'],
      employees: ['id', 'org_id', 'first_name', 'last_name', 'designation', 'tin', 'sss', 'philhealth', 'pagibig', 'basic_salary', 'bank_name', 'bank_account', 'is_active', 'created_at', 'updated_at'],
      locations: ['id', 'org_id', 'code', 'name', 'address', 'capacity', 'created_at', 'updated_at'],
      trainer_schedules: ['id', 'org_id', 'trainer_id', 'location_id', 'slots', 'is_deleted', 'deleted_at', 'deleted_by', 'created_at', 'updated_at'],
      sponsors: [
        'id', 'org_id', 'sponsor_code', 'name', 'contact_person', 'email', 'phone', 'address',
        'tin', 'tax_type', 'ewt_rate', 'ar_account_id', 'course_fee_type', 'customer_type', 'created_at', 'updated_at',
        'is_deleted', 'deleted_at', 'deleted_by'
      ],
      batches: ['id', 'org_id', 'batch_code', 'name', 'year', 'qualification_id', 'trainer_id', 'sponsor_id', 'location_id', 'student_ids', 'status', 'start_date', 'end_date', 'training_schedule_slots', 'max_students', 'current_students', 'created_at', 'updated_at'],
      vendors: ['id', 'org_id', 'name', 'category', 'email', 'contact_number', 'address', 'ap_account_id', 'payment_terms_days', 'created_at', 'updated_at'],
      atc_categories: ['id', 'code', 'name', 'created_at', 'updated_at'],
      atc_items: ['id', 'category_id', 'atc_code', 'description', 'taxpayer_type', 'created_at', 'updated_at'],
      atc_rates: ['id', 'atc_item_id', 'rate', 'rate_label', 'created_at', 'updated_at'],
      bank_accounts: ['id', 'org_id', 'bank_name', 'account_number', 'type', 'gl_account_id', 'currency', 'balance', 'created_at', 'updated_at'],
      chart_of_accounts: ['id', 'org_id', 'code', 'name', 'class', 'description', 'is_header', 'parent_id', 'created_at', 'updated_at'],
      fixed_assets: ['id', 'org_id', 'code', 'name', 'description', 'category', 'purchase_date', 'purchase_cost', 'accumulated_depreciation', 'depreciation_method', 'useful_life_years', 'gl_account_id', 'created_at', 'updated_at'],
      items: ['id', 'org_id', 'code', 'name', 'description', 'unit_price', 'income_account_id', 'expense_account_id', 'tax_category_id', 'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'],
      payables: [
        'id', 'org_id', 'vendor_id', 'payable_number', 'category', 'qualification_id', 'description', 'amount',
        'bill_date', 'due_date', 'payment_date', 'currency', 'status', 'reference_document',
        'journal_entry_id', 'gl_account_id', 'expense_account_id', 'expense_allocations', 'claimed_by', 'employee_id', 'notes', 'withholding_type', 'atc_item_id',
        'atc_rate_id', 'applied_rate_percent', 'withholding_amount', 'net_payable', 'paid_amount',
        'created_by', 'approved_by', 'paid_by', 'created_at', 'updated_at', 'approved_at',
        'paid_at', 'invoice_type', 'input_vat_amount', 'input_vat_account_id',
        'payment_method', 'payment_bank_account_id', 'check_number', 'check_date',
        'reversal_journal_id', 'memo_adjustment_total', 'is_deleted', 'deleted_at', 'deleted_by'
      ],
      ap_memos: [
        'id', 'org_id', 'memo_number', 'memo_type', 'status', 'payable_id', 'vendor_id',
        'memo_date', 'amount', 'reason', 'reference', 'adjustment_account_id',
        'journal_entry_id', 'reversal_journal_id', 'legacy_payable_id',
        'created_by', 'created_at', 'updated_by', 'updated_at', 'submitted_by', 'submitted_at',
        'posted_by', 'posted_at', 'cancelled_by', 'cancelled_at', 'cancellation_reason',
        'reversed_by', 'reversed_at', 'reversal_reason', 'is_deleted', 'deleted_by', 'deleted_at'
      ],
      time_expenses: [
        'id', 'org_id', 'rfq_code', 'transaction_date', 'description', 'quantity', 'unit_cost', 'amount', 'expense_account_id', 'qualification_id', 'tax_category_id',
        'supplier_id', 'supplier_name', 'claimed_by', 'employee_id', 'status', 'payable_id', 'created_by',
        'created_at', 'updated_at'
      ],
      check_vouchers: [
        'id', 'org_id', 'check_number', 'bank_account_id', 'payee_id', 'payee_type', 'payee_name',
        'check_date', 'amount', 'amount_in_words', 'status', 'payable_ids', 'journal_entry_id',
        'prepared_by', 'prepared_at', 'approved_by', 'approved_at', 'printed_by', 'printed_at',
        'released_by', 'released_at', 'voided_by', 'voided_at', 'void_reason',
        'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'
      ],
      course_fees: [
        'id', 'org_id', 'fee_code', 'qualification_id', 'funding_type', 'fee_name', 'amount',
        'gl_account_id', 'tax_category_id', 'is_subject_to_ewt', 'ewt_rate',
        'category', 'description', 'is_active', 'created_at', 'updated_at',
        'is_deleted', 'deleted_at', 'deleted_by'
      ],
      alumni_employment_reports: [
        'id', 'org_id', 'student_id', 'employment_status', 'employer_name', 'employer_address',
        'position', 'employment_type', 'date_hired', 'salary_range', 'is_related_to_course',
        'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'
      ],
      enrollments: [
        'id', 'org_id', 'enrollment_code', 'student_id', 'batch_id', 'sponsor_id',
        'billing_type', 'billing_status', 'enrollment_status', 'enrollment_date', 'completion_date',
        'total_fees', 'billed_amount', 'notes', 'created_at', 'updated_at',
        'is_deleted', 'deleted_at', 'deleted_by'
      ],
      assessment_registrations: [
        'id', 'org_id', 'registration_code', 'student_id', 'qualification_id', 'sponsor_id',
        'billing_party', 'assessment_type', 'assessment_date', 'status', 'billing_status',
        'total_fees', 'billed_amount', 'invoice_id', 'notes',
        'created_at', 'updated_at', 'is_deleted', 'deleted_at', 'deleted_by'
      ],
      invoices: [
        'id', 'org_id', 'invoice_no', 'document_type', 'payment_method', 'si_no', 'sponsor_id', 'student_id', 'enrollment_id', 'assessment_registration_id', 'batch_id',
        'invoice_date', 'due_date', 'status', 'subtotal', 'vat_amount', 'grand_total',
        'total_ewt_amount', 'net_amount_due', 'amount_paid', 'balance_due',
        'ewt_rate', 'is_subject_to_ewt', 'reference', 'terms', 'notes', 'journal_entry_id',
        'gl_entry_number', 'vat_pricing', 'vat_rate', 'posted_by', 'posted_at', 'voided_by', 'voided_at', 'void_reason',
        'is_deleted', 'deleted_at', 'deleted_by', 'created_at', 'created_by', 'updated_at', 'updated_by'
      ],
      invoice_lines: [
        'id', 'org_id', 'invoice_id', 'line_number', 'description', 'course_fee_id', 'enrollment_id', 'assessment_registration_id',
        'line_type', 'quantity', 'unit_price', 'net_amount', 'vat_amount', 'gross_amount', 'amount',
        'tax_category_id', 'gl_account_id', 'classification_code',
        'is_deleted', 'deleted_at', 'deleted_by', 'created_at', 'updated_at'
      ],
      journal_entries: [
        'id', 'org_id', 'period_id', 'date', 'description', 'reference', 'gl_entry_number',
        'status', 'created_by', 'created_at', 'source_type', 'source_ref',
        'approved_by', 'approved_at', 'reversed_by', 'reversed_at', 'reversal_reason', 'original_entry_id',
        'review_comments', 'updated_by', 'updated_at'
      ],
      journal_lines: [
        'id', 'org_id', 'journal_entry_id', 'account_id', 'debit', 'credit', 'memo', 'description',
        'classification_code', 'tax_category_id',
        'contact_id', 'contact_type', 'batch_id', 'item_id', 'asset_id', 'is_cleared'
      ],
      tax_categories: [
        'id', 'org_id', 'code', 'description', 'tax_type', 'rate', 'is_inclusive', 'output_account_id', 'created_at', 'updated_at'
      ],
      payments: [
        'id', 'org_id', 'payment_no', 'cr_no', 'sponsor_id', 'student_id',
        'payment_date', 'status', 'payment_method', 'ref_no', 'bank_account_id',
        'check_number', 'check_date', 'source_invoice_id', 'amount_received', 'ewt_amount_certified',
        'total_applied', 'customer_deposit_balance', 'journal_entry_id',
        'voided_at', 'voided_by', 'void_reason', 'posted_at', 'posted_by',
        'notes', 'created_at', 'created_by', 'updated_at', 'updated_by',
        'is_deleted', 'deleted_at', 'deleted_by'
      ],
      payment_applications: [
        'id', 'org_id', 'payment_id', 'invoice_id', 'application_no', 'amount_applied',
        'is_reversed', 'reversal_reason', 'reversed_at', 'reversed_by',
        'gl_reference', 'journal_entry_id',
        'created_at', 'created_by', 'updated_at', 'updated_by'
      ],
      feedback_tickets: [
        'id', 'org_id', 'title', 'description', 'screenshot_data_url', 'screenshot_name',
        'status', 'priority', 'created_by', 'created_by_name', 'created_by_role',
        'assigned_to', 'admin_notes', 'resolved_at', 'created_at', 'updated_at',
        'is_deleted', 'deleted_at', 'deleted_by'
      ],
    };

    // Columns that are auto-generated and should be excluded on INSERT
    const generatedColumns: Record<string, string[]> = {
      vendors: ['id', 'created_at', 'updated_at'],
      bank_accounts: ['id', 'created_at', 'updated_at'],
      fixed_assets: ['net_book_value', 'created_at', 'updated_at'],
      items: ['created_at', 'updated_at'],
      payables: ['id', 'created_at', 'updated_at', 'approved_at', 'paid_at'],
      time_expenses: ['id', 'created_at', 'updated_at'],
      check_vouchers: ['id', 'created_at', 'updated_at'],
      course_fees: ['id', 'created_at', 'updated_at'],
      assessment_registrations: ['id', 'created_at', 'updated_at'],
      alumni_employment_reports: ['id', 'created_at', 'updated_at'],
      sponsors: ['id', 'created_at', 'updated_at'],
      invoice_lines: ['id', 'created_at', 'updated_at'],
      journal_entries: ['id', 'created_at', 'updated_at'],
      journal_lines: ['id', 'created_at', 'updated_at'],
      feedback_tickets: ['created_at', 'updated_at']
    };

    const allowedColumns = validColumns[table] || [];
    const excludeColumns = (isInsert && generatedColumns[table]) || [];
    const filtered: any = {};

    for (const col of allowedColumns) {
      if (!excludeColumns.includes(col) && data.hasOwnProperty(col)) {
        filtered[col] = data[col];
      }
    }

    return filtered;
  }

  /**
   * Validate if a string is a valid UUID format
   * Valid UUIDs: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // ============================================================================
  // ORGANIZATION CRUD
  // ============================================================================

  async createOrganization(org: any): Promise<any> {
    const snakeCaseOrg = this.camelToSnake({
      ...org,
      institutionType: org?.institutionType || 'TRAINING'
    });
    const filteredOrg = this.filterToTableSchema('organizations', snakeCaseOrg);
    if ((filteredOrg as any).id && !this.isValidUUID((filteredOrg as any).id)) {
      delete (filteredOrg as any).id;
    }
    try {
      return await this.writeOrganizationViaEdgeFunction('create_organization', {
        organization: filteredOrg
      });
    } catch (error) {
      if (!this.isRecoverableOrganizationWriteError(error)) throw error;
      console.warn('[Supabase] organizations-write unavailable from browser; falling back to direct organizations insert');
      return this.insertToSupabaseRaw('organizations', filteredOrg);
    }
  }

  async updateOrganization(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('organizations', snakeCaseUpdates);
    try {
      return await this.writeOrganizationViaEdgeFunction('update_organization', {
        id,
        updates: filteredUpdates
      });
    } catch (error) {
      if (!this.isRecoverableOrganizationWriteError(error)) throw error;
      console.warn('[Supabase] organizations-write unavailable from browser; falling back to direct organizations update');
      return this.updateInSupabaseRaw('organizations', id, filteredUpdates);
    }
  }

  async deleteOrganization(id: string): Promise<void> {
    try {
      await this.writeOrganizationViaEdgeFunction('delete_organization', { id });
    } catch (error) {
      if (!this.isRecoverableOrganizationWriteError(error)) throw error;
      console.warn('[Supabase] organizations-write unavailable from browser; falling back to direct organizations delete');
      await this.deleteFromSupabase('organizations', id);
    }
  }

  // ============================================================================
  // USER CRUD - With bcrypt password hashing
  // ============================================================================

  async createUser(user: any, options?: { preferUserToken?: boolean }): Promise<any> {
    console.debug('[Supabase] createUser() INPUT:', user);

    const snakeCaseUser = this.camelToSnake(user);
    console.debug('[Supabase] After camelToSnake():', snakeCaseUser);

    // Hash password BEFORE filtering (since password_hash is the valid column, not password)
    const plainPasswordForAuth = snakeCaseUser.password;
    if (snakeCaseUser.password) {
      const plainPassword = snakeCaseUser.password;
      try {
        const { PasswordService } = await import('./PasswordService');
        const hashedPassword = await PasswordService.hashPassword(plainPassword);
        snakeCaseUser.password_hash = hashedPassword;
        console.info('[Supabase] ✅ Password hashed with bcrypt for new user');
      } catch (error) {
        console.error('[Supabase] ❌ Failed to hash password:', error);
        snakeCaseUser.password_hash = plainPassword;
      }
      delete snakeCaseUser.password;
    }

    // Set defaults
    if (!snakeCaseUser.is_active) {
      snakeCaseUser.is_active = true;
    }
    if (!snakeCaseUser.salt) {
      snakeCaseUser.salt = 'bcrypt'; // Indicator that bcrypt is used
    }

    // Now filter to schema (password_hash is in schema, password is not)
    const filteredUser = this.filterToTableSchema('users', snakeCaseUser);
    console.debug('[Supabase] After filterToTableSchema():', filteredUser);

    // Generate UUID if invalid or missing
    if ((filteredUser as any).id && !this.isValidUUID((filteredUser as any).id)) {
      console.debug('[Supabase] Removing invalid UUID, will auto-generate');
      delete (filteredUser as any).id;
    }

    if (options?.preferUserToken) {
      try {
        return await this.writeUserViaEdgeFunction('create_user', { user: filteredUser, password: plainPasswordForAuth });
      } catch (error) {
        if (this.isRecoverableUserWriteError(error)) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Admin user creation requires the deployed Supabase edge function 'users-write'. ${message}. ` +
            `Deploy supabase/functions/users-write with Supabase Auth validation enabled.`
          );
        }
        throw error;
      }
    }

    return this.insertToSupabaseRaw('users', filteredUser);
  }

  async updateUser(id: string, updates: Partial<any>): Promise<any> {
    console.debug('[Supabase] updateUser() INPUT:', { id, updates });

    const snakeCaseUpdates = this.camelToSnake(updates);

    // Hash password BEFORE filtering if being updated
    if (snakeCaseUpdates.password) {
      const plainPassword = snakeCaseUpdates.password;
      try {
        const { PasswordService } = await import('./PasswordService');
        const hashedPassword = await PasswordService.hashPassword(plainPassword);
        snakeCaseUpdates.password_hash = hashedPassword;
        snakeCaseUpdates.salt = 'bcrypt';
        console.info('[Supabase] ✅ Password updated with bcrypt hash');
      } catch (error) {
        console.error('[Supabase] ❌ Failed to hash password on update:', error);
        snakeCaseUpdates.password_hash = plainPassword;
      }
      delete snakeCaseUpdates.password;
    }

    const filteredUpdates = this.filterToTableSchema('users', snakeCaseUpdates);
    console.debug('[Supabase] After filterToTableSchema():', filteredUpdates);

    return this.updateInSupabaseRaw('users', id, filteredUpdates);
  }

  async deleteUser(id: string): Promise<void> {
    return this.deleteFromSupabase('users', id);
  }

  // ============================================================================
  // STUDENT CRUD
  // ============================================================================

  async createStudent(student: any): Promise<any> {
    console.debug('[Supabase] createStudent() INPUT:', student);

    // Convert camelCase input to snake_case FIRST so filtering works correctly
    const snakeCaseStudent = this.camelToSnake(student);

    // Convert empty strings to null for UUID columns
    if (snakeCaseStudent.location_id === '') snakeCaseStudent.location_id = null;
    if (snakeCaseStudent.sponsor_id === '') snakeCaseStudent.sponsor_id = null;
    if (snakeCaseStudent.uli === '') snakeCaseStudent.uli = null;
    console.debug('[Supabase] After camelToSnake():', snakeCaseStudent);

    // Ensure org_id is present
    if (!snakeCaseStudent.org_id) {
      console.warn('[Supabase] Warning: student missing org_id, using empty string');
    }
    if (snakeCaseStudent.date_of_birth === '') {
      delete snakeCaseStudent.date_of_birth;
    }

    // Normalize documents array for storage in Supabase (supports TEXT[] and JSONB variations)
    if (snakeCaseStudent.documents) {
      snakeCaseStudent.documents = this.normalizeStudentDocumentsForDb(snakeCaseStudent.documents);
      console.debug('[Supabase] Normalized student documents for DB storage:', snakeCaseStudent.documents.length, 'items');
    }

    // Filter to only valid columns AFTER converting to snake_case
    let filteredStudent = this.filterToTableSchema('students', snakeCaseStudent);
    console.debug('[Supabase] After filterToTableSchema():', {
      beforeKeys: Object.keys(snakeCaseStudent),
      afterKeys: Object.keys(filteredStudent),
      removed: Object.keys(snakeCaseStudent).filter(k => !Object.keys(filteredStudent).includes(k))
    });

    // Remove id if it's not a valid UUID (let Supabase generate it)
    if (filteredStudent.id && !this.isValidUUID(filteredStudent.id)) {
      console.debug('[Supabase] Removing invalid UUID:', filteredStudent.id);
      delete filteredStudent.id;
    }

    // Add timestamps for audit trail (AFTER filtering to ensure they're included)
    const now = new Date().toISOString();
    filteredStudent.created_at = now;
    filteredStudent.updated_at = now;

    console.debug('[Supabase] FINAL data ready for POST:', {
      keys: Object.keys(filteredStudent),
      hasAge: 'age' in filteredStudent,
      hasAgeOfBirth: 'age_of_birth' in filteredStudent,
      fullData: JSON.stringify(filteredStudent)
    });

    // Note: insertToSupabase will NOT apply camelToSnake again since data is already in snake_case
    // We need to call the API directly to avoid double-conversion
    const result = await this.insertToSupabaseRaw('students', filteredStudent);
    const savedStudent = result as Record<string, any>;
    return {
      ...savedStudent,
      documents: this.parseStudentDocumentsFromDb(savedStudent.documents)
    };
  }

  async updateStudent(id: string, updates: Partial<any>): Promise<any> {
    // Convert updates to snake_case first so filtering works correctly
    let snakeCaseUpdates = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snakeCaseUpdates.location_id === '') snakeCaseUpdates.location_id = null;
    if (snakeCaseUpdates.sponsor_id === '') snakeCaseUpdates.sponsor_id = null;
    if (snakeCaseUpdates.date_of_birth === '') snakeCaseUpdates.date_of_birth = null;
    if (snakeCaseUpdates.uli === '') snakeCaseUpdates.uli = null;

    // Always update the updated_at timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();

    // Normalize documents array for storage
    if (snakeCaseUpdates.documents) {
      snakeCaseUpdates.documents = this.normalizeStudentDocumentsForDb(snakeCaseUpdates.documents);
      console.debug('[Supabase] Normalized student documents for update storage');
    }

    // Filter to only valid columns for students table
    const filteredUpdates = this.filterToTableSchema('students', snakeCaseUpdates);

    console.debug('[Supabase] Filtered student updates ready for PATCH:', {
      keys: Object.keys(filteredUpdates),
      hasAge: 'age' in filteredUpdates,
      data: filteredUpdates
    });

    const result = await this.updateInSupabaseRaw('students', id, filteredUpdates);
    const savedStudent = result as Record<string, any>;
    return {
      ...savedStudent,
      documents: this.parseStudentDocumentsFromDb(savedStudent.documents)
    };
  }

  async deleteStudent(id: string): Promise<void> {
    // Hard delete (no is_deleted column in Supabase)
    await this.deleteFromSupabase('students', id);
  }

  async checkStudentUsage(studentId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Check if student is referenced in other tables (batches, etc.)
    const usedIn: string[] = [];

    try {
      const headers = await this.getHeaders();
      // Check if student is enrolled in any batches
      const batchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/batch_students?student_id=eq.${studentId}&select=id`,
        { headers }
      );
      const batchStudents = await batchResponse.json();
      if (Array.isArray(batchStudents) && batchStudents.length > 0) {
        usedIn.push('Batch Enrollments');
      }

      // Check if student has any documents
      const docsResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/student_documents?student_id=eq.${studentId}&select=id`,
        { headers }
      );
      const docs = await docsResponse.json();
      if (Array.isArray(docs) && docs.length > 0) {
        usedIn.push('Student Documents');
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check student usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // TRAINER CRUD
  // ============================================================================

  async createTrainer(trainer: any): Promise<any> {
    console.debug('[Supabase] createTrainer() INPUT:', trainer);

    // Convert camelCase input to snake_case FIRST so filtering works correctly
    const snakeCaseTrainer = this.camelToSnake(trainer);

    // Convert empty qualification_ids string to empty array or null if needed
    // In Supabase, qualification_ids is often text[] or jsonb
    if (snakeCaseTrainer.qualification_ids === '') snakeCaseTrainer.qualification_ids = [];
    console.debug('[Supabase] After camelToSnake():', snakeCaseTrainer);

    // Ensure org_id is present
    if (!snakeCaseTrainer.org_id) {
      console.warn('[Supabase] Warning: trainer missing org_id');
    }

    // Filter to only valid columns AFTER converting to snake_case
    let filteredTrainer = this.filterToTableSchema('trainers', snakeCaseTrainer);
    console.debug('[Supabase] After filterToTableSchema():', {
      beforeKeys: Object.keys(snakeCaseTrainer),
      afterKeys: Object.keys(filteredTrainer),
      removed: Object.keys(snakeCaseTrainer).filter(k => !Object.keys(filteredTrainer).includes(k))
    });

    // Remove id if it's not a valid UUID (let Supabase generate it)
    if (filteredTrainer.id && !this.isValidUUID(filteredTrainer.id)) {
      console.debug('[Supabase] Removing invalid UUID:', filteredTrainer.id);
      delete filteredTrainer.id;
    }

    // Add timestamps for audit trail
    const now = new Date().toISOString();
    filteredTrainer.created_at = now;
    filteredTrainer.updated_at = now;

    console.debug('[Supabase] FINAL trainer data ready for POST:', {
      keys: Object.keys(filteredTrainer),
      fullData: JSON.stringify(filteredTrainer)
    });

    return this.insertToSupabaseRaw('trainers', filteredTrainer);
  }

  async updateTrainer(id: string, updates: Partial<any>): Promise<any> {
    // Convert updates to snake_case first so filtering works correctly
    let snakeCaseUpdates = this.camelToSnake(updates);

    // Convert empty qualification_ids string to empty array
    if (snakeCaseUpdates.qualification_ids === '') snakeCaseUpdates.qualification_ids = [];

    // Always update the updated_at timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();

    // Filter to only valid columns for trainers table
    const filteredUpdates = this.filterToTableSchema('trainers', snakeCaseUpdates);

    console.debug('[Supabase] Filtered trainer updates ready for PATCH:', {
      keys: Object.keys(filteredUpdates),
      data: filteredUpdates
    });

    return this.updateInSupabaseRaw('trainers', id, filteredUpdates);
  }

  async deleteTrainer(id: string): Promise<void> {
    // Hard delete
    await this.deleteFromSupabase('trainers', id);
  }

  async checkTrainerUsage(trainerId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Check if trainer is referenced in other tables (batches, schedules, users, etc.)
    const usedIn: string[] = [];

    try {
      const headers = await this.getHeaders();
      // Check if trainer is assigned to any batches
      const batchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/batches?trainer_id=eq.${trainerId}&select=id`,
        { headers }
      );
      const batches = await batchResponse.json();
      if (Array.isArray(batches) && batches.length > 0) {
        usedIn.push('Batches');
      }

      // Check if trainer has any schedules
      const scheduleResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/schedules?trainer_id=eq.${trainerId}&select=id`,
        { headers }
      );
      const schedules = await scheduleResponse.json();
      if (Array.isArray(schedules) && schedules.length > 0) {
        usedIn.push('Trainer Schedules');
      }

      // Check if trainer has a linked user account
      const userResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/users?trainer_id=eq.${trainerId}&select=id`,
        { headers }
      );
      const users = await userResponse.json();
      if (Array.isArray(users) && users.length > 0) {
        usedIn.push('User Accounts');
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check trainer usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // QUALIFICATION CRUD
  // ============================================================================

  async createQualification(qualification: any): Promise<any> {
    console.debug('[Supabase] createQualification() INPUT:', qualification);

    // Convert camelCase input to snake_case FIRST so filtering works correctly
    const snakeCaseQual = this.camelToSnake(qualification);
    console.debug('[Supabase] After camelToSnake():', snakeCaseQual);

    // Ensure org_id is present
    if (!snakeCaseQual.org_id) {
      console.warn('[Supabase] Warning: qualification missing org_id');
    }

    // Filter to only valid columns AFTER converting to snake_case
    let filteredQual = this.filterToTableSchema('qualifications', snakeCaseQual);
    console.debug('[Supabase] After filterToTableSchema():', {
      beforeKeys: Object.keys(snakeCaseQual),
      afterKeys: Object.keys(filteredQual),
      removed: Object.keys(snakeCaseQual).filter(k => !Object.keys(filteredQual).includes(k))
    });

    // Remove id if it's not a valid UUID (let Supabase generate it)
    if (filteredQual.id && !this.isValidUUID(filteredQual.id)) {
      console.debug('[Supabase] Removing invalid UUID:', filteredQual.id);
      delete filteredQual.id;
    }

    // Add timestamps for audit trail
    const now = new Date().toISOString();
    filteredQual.created_at = now;
    filteredQual.updated_at = now;

    console.debug('[Supabase] FINAL qualification data ready for POST:', {
      keys: Object.keys(filteredQual),
      fullData: JSON.stringify(filteredQual)
    });

    return this.insertToSupabaseRaw('qualifications', filteredQual);
  }

  async updateQualification(id: string, updates: Partial<any>): Promise<any> {
    // Convert updates to snake_case first so filtering works correctly
    let snakeCaseUpdates = this.camelToSnake(updates);

    // Always update the updated_at timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();

    // Filter to only valid columns for qualifications table
    const filteredUpdates = this.filterToTableSchema('qualifications', snakeCaseUpdates);

    console.debug('[Supabase] Filtered qualification updates ready for PATCH:', {
      keys: Object.keys(filteredUpdates),
      data: filteredUpdates
    });

    return this.updateInSupabaseRaw('qualifications', id, filteredUpdates);
  }

  async deleteQualification(id: string): Promise<void> {
    // Hard delete
    await this.deleteFromSupabase('qualifications', id);
  }

  async checkQualificationUsage(qualificationId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Check if qualification is referenced in other tables (batches, trainers, etc.)
    const usedIn: string[] = [];

    try {
      const headers = await this.getHeaders();
      // Check if qualification is used in any batches
      const batchResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/batches?qualification_id=eq.${qualificationId}&select=id`,
        { headers }
      );
      const batches = await batchResponse.json();
      if (Array.isArray(batches) && batches.length > 0) {
        usedIn.push('Training Batches');
      }

      // Check if qualification is assigned to any trainers (in qualification_ids array)
      // Note: This requires checking if qualificationId is in any trainer's qualification_ids array
      const trainerResponse = await fetch(
        `${this.supabaseUrl}/rest/v1/trainers?qualification_ids=cs.{${qualificationId}}&select=id`,
        { headers }
      );
      const trainers = await trainerResponse.json();
      if (Array.isArray(trainers) && trainers.length > 0) {
        usedIn.push('Trainer Certifications');
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check qualification usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // BATCH CRUD
  // ============================================================================

  async createBatch(batch: any): Promise<any> {
    // Preserve student_ids array
    const studentIdsBackup = batch.studentIds;
    const trainingScheduleSlotsBackup = batch.trainingScheduleSlots;

    const snakeCaseBatch = this.camelToSnake(batch);
    let filteredBatch = this.filterToTableSchema('batches', snakeCaseBatch);

    // Restore student_ids as PostgreSQL array format
    if (studentIdsBackup && Array.isArray(studentIdsBackup)) {
      filteredBatch.student_ids = studentIdsBackup;
    }
    if (trainingScheduleSlotsBackup && Array.isArray(trainingScheduleSlotsBackup)) {
      filteredBatch.training_schedule_slots = trainingScheduleSlotsBackup;
    }

    // Handle empty optional foreign keys - convert empty string to null
    if (filteredBatch.sponsor_id === '' || filteredBatch.sponsor_id === undefined) {
      filteredBatch.sponsor_id = null;
    }
    if (filteredBatch.location_id === '' || filteredBatch.location_id === undefined) {
      filteredBatch.location_id = null;
    }
    if (filteredBatch.trainer_id === '' || filteredBatch.trainer_id === undefined) {
      filteredBatch.trainer_id = null;
    }
    if (filteredBatch.qualification_id === '' || filteredBatch.qualification_id === undefined) {
      filteredBatch.qualification_id = null;
    }

    // Remove invalid UUID
    if (filteredBatch.id && !this.isValidUUID(filteredBatch.id)) {
      delete filteredBatch.id;
    }

    console.debug('[Supabase] createBatch - Final payload:', filteredBatch);

    return this.insertToSupabaseRaw('batches', filteredBatch);
  }

  async updateBatch(id: string, updates: Partial<any>): Promise<any> {
    // Preserve student_ids array
    const studentIdsBackup = updates.studentIds;
    const trainingScheduleSlotsBackup = updates.trainingScheduleSlots;

    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('batches', snakeCaseUpdates);

    // Restore student_ids as PostgreSQL array format
    if (studentIdsBackup && Array.isArray(studentIdsBackup)) {
      filteredUpdates.student_ids = studentIdsBackup;
    }
    if (trainingScheduleSlotsBackup && Array.isArray(trainingScheduleSlotsBackup)) {
      filteredUpdates.training_schedule_slots = trainingScheduleSlotsBackup;
    }

    // Handle empty optional foreign keys - convert empty string to null
    if (filteredUpdates.sponsor_id === '' || filteredUpdates.sponsor_id === undefined) {
      filteredUpdates.sponsor_id = null;
    }
    if (filteredUpdates.location_id === '' || filteredUpdates.location_id === undefined) {
      filteredUpdates.location_id = null;
    }
    if (filteredUpdates.trainer_id === '' || filteredUpdates.trainer_id === undefined) {
      filteredUpdates.trainer_id = null;
    }
    if (filteredUpdates.qualification_id === '' || filteredUpdates.qualification_id === undefined) {
      filteredUpdates.qualification_id = null;
    }
    if (filteredUpdates.schedule_id === '' || filteredUpdates.schedule_id === undefined) {
      filteredUpdates.schedule_id = null;
    }

    return this.updateInSupabaseRaw('batches', id, filteredUpdates);
  }

  async deleteBatch(id: string): Promise<void> {
    return this.deleteFromSupabase('batches', id);
  }

  // ============================================================================
  // LOCATION CRUD
  // ============================================================================

  async createLocation(location: any): Promise<any> {
    const snakeCaseLocation = this.camelToSnake(location);
    let filteredLocation = this.filterToTableSchema('locations', snakeCaseLocation);
    console.debug('[Supabase] After filterToTableSchema():', {
      original: location,
      snakeCase: snakeCaseLocation,
      filtered: filteredLocation
    });

    // Remove ID if not a valid UUID (will be auto-generated by Supabase)
    if (filteredLocation.id && !this.isValidUUID(filteredLocation.id)) {
      console.debug(`[Supabase] Removing invalid UUID: ${filteredLocation.id}`);
      delete filteredLocation.id;
    }

    return this.insertToSupabaseRaw('locations', filteredLocation);
  }

  async updateLocation(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('locations', snakeCaseUpdates);
    return this.updateInSupabaseRaw('locations', id, filteredUpdates);
  }

  async deleteLocation(id: string): Promise<void> {
    return this.deleteFromSupabase('locations', id);
  }

  async checkLocationUsage(locationId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    try {
      const usedIn: string[] = [];

      // Check if location is used in batches
      const batchesResponse = await fetch(
        `${this.baseUrl}/batches?location_id=eq.${locationId}&select=id,name`,
        { headers: (await this.getHeaders()) }
      );
      if (batchesResponse.ok) {
        const batches = await batchesResponse.json();
        if (batches.length > 0) {
          usedIn.push(`${batches.length} batch(es)`);
        }
      }

      // Check if location is used in schedules
      const schedulesResponse = await fetch(
        `${this.baseUrl}/schedules?location_id=eq.${locationId}&select=id`,
        { headers: (await this.getHeaders()) }
      );
      if (schedulesResponse.ok) {
        const schedules = await schedulesResponse.json();
        if (schedules.length > 0) {
          usedIn.push(`${schedules.length} schedule(s)`);
        }
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check location usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // SCHEDULE CRUD
  // ============================================================================

  async createSchedule(schedule: any): Promise<any> {
    // Preserve the slots array as-is (JSONB should keep camelCase keys)
    const slotsBackup = schedule.slots;

    const snakeCaseSchedule = this.camelToSnake(schedule);
    let filteredSchedule = this.filterToTableSchema('trainer_schedules', snakeCaseSchedule);

    // Restore the original slots array (JSONB content should not be snake_cased)
    if (slotsBackup) {
      filteredSchedule.slots = slotsBackup;
    }

    // Handle empty location_id - convert empty string to null for FK constraint
    if (filteredSchedule.location_id === '' || filteredSchedule.location_id === undefined) {
      filteredSchedule.location_id = null;
    }

    console.debug('[Supabase] createSchedule - Final payload:', {
      original: schedule,
      filtered: filteredSchedule
    });

    // Remove ID if not a valid UUID (will be auto-generated by Supabase)
    if (filteredSchedule.id && !this.isValidUUID(filteredSchedule.id)) {
      console.debug(`[Supabase] Removing invalid UUID: ${filteredSchedule.id}`);
      delete filteredSchedule.id;
    }

    return this.insertToSupabaseRaw('trainer_schedules', filteredSchedule);
  }

  async updateSchedule(id: string, updates: Partial<any>): Promise<any> {
    // Preserve the slots array as-is (JSONB should keep camelCase keys)
    const slotsBackup = updates.slots;

    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('trainer_schedules', snakeCaseUpdates);

    // Restore the original slots array (JSONB content should not be snake_cased)
    if (slotsBackup) {
      filteredUpdates.slots = slotsBackup;
    }

    // Handle empty location_id - convert empty string to null for FK constraint
    if (filteredUpdates.location_id === '' || filteredUpdates.location_id === undefined) {
      filteredUpdates.location_id = null;
    }

    return this.updateInSupabaseRaw('trainer_schedules', id, filteredUpdates);
  }

  async deleteSchedule(id: string): Promise<void> {
    return this.deleteFromSupabase('trainer_schedules', id);
  }

  async checkScheduleUsage(scheduleId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    try {
      const usedIn: string[] = [];

      // Check if schedule is referenced in batches (if there's a schedule_id field)
      const batchesResponse = await fetch(
        `${this.baseUrl}/batches?schedule_id=eq.${scheduleId}&select=id,name`,
        { headers: (await this.getHeaders()) }
      );
      if (batchesResponse.ok) {
        const batches = await batchesResponse.json();
        if (batches.length > 0) {
          usedIn.push(`${batches.length} batch(es)`);
        }
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check schedule usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // SPONSOR CRUD
  // ============================================================================

  async createSponsor(sponsor: any): Promise<any> {
    console.debug('[Supabase] createSponsor called with:', sponsor);

    // Convert to snake_case
    const snakeCaseSponsor = this.camelToSnake(sponsor);

    // Convert empty strings to null for UUID columns
    if (snakeCaseSponsor.ar_account_id === '') snakeCaseSponsor.ar_account_id = null;

    // Filter to valid columns
    let filteredSponsor = this.filterToTableSchema('sponsors', snakeCaseSponsor, true);

    // Set timestamps
    const now = new Date().toISOString();
    filteredSponsor.created_at = now;
    filteredSponsor.updated_at = now;

    // Validate or remove invalid ID
    if (filteredSponsor.id && !this.isValidUUID(filteredSponsor.id)) {
      console.debug(`[Supabase] Removing invalid UUID: ${filteredSponsor.id}`);
      delete filteredSponsor.id;
    }

    // Insert to Supabase
    return this.insertToSupabaseRaw('sponsors', filteredSponsor);
  }

  async updateSponsor(id: string, updates: Partial<any>): Promise<any> {
    console.debug('[Supabase] updateSponsor called with:', { id, updates });

    // Convert to snake_case
    const snakeCaseUpdates = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snakeCaseUpdates.ar_account_id === '') snakeCaseUpdates.ar_account_id = null;

    // Set updated timestamp
    snakeCaseUpdates.updated_at = new Date().toISOString();

    // Filter to valid columns
    const filteredUpdates = this.filterToTableSchema('sponsors', snakeCaseUpdates);

    // Remove id and created_at from updates if they exist (PostgREST doesn't like updating them)
    delete filteredUpdates.id;
    delete filteredUpdates.created_at;

    // Update in Supabase
    return this.updateInSupabaseRaw('sponsors', id, filteredUpdates);
  }

  async deleteSponsor(id: string): Promise<void> {
    console.debug('[Supabase] deleteSponsor called with:', id);
    return this.deleteFromSupabase('sponsors', id);
  }

  async checkSponsorUsage(sponsorId: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    console.debug('[Supabase] checkSponsorUsage called with:', sponsorId);

    try {
      const usedIn: string[] = [];

      // Check if sponsor is referenced in students
      const studentsResponse = await fetch(
        `${this.baseUrl}/students?sponsor_id=eq.${sponsorId}&select=id,first_name,last_name`,
        { headers: (await this.getHeaders()) }
      );
      if (studentsResponse.ok) {
        const students = await studentsResponse.json();
        if (students.length > 0) {
          usedIn.push(`${students.length} student(s)`);
        }
      }

      // Check if sponsor is referenced in batches (if there's a sponsor_id field)
      const batchesResponse = await fetch(
        `${this.baseUrl}/batches?sponsor_id=eq.${sponsorId}&select=id,name`,
        { headers: (await this.getHeaders()) }
      );
      if (batchesResponse.ok) {
        const batches = await batchesResponse.json();
        if (batches.length > 0) {
          usedIn.push(`${batches.length} batch(es)`);
        }
      }

      return {
        isUsed: usedIn.length > 0,
        usedIn
      };
    } catch (error) {
      console.warn('[Supabase] Could not check sponsor usage:', error);
      return { isUsed: false, usedIn: [] };
    }
  }

  // ============================================================================
  // ============================================================================
  // ============================================================================

  async createEntity<T extends { id?: string; orgId?: string }>(table: string, entity: T): Promise<T> {
    // For payments: generate unique payment number using atomic database function
    // This prevents duplicate key errors from concurrent requests
    if (table === 'payments') {
      const payment = entity as any;
      const orgId = payment.org_id || payment.orgId;
      
      console.log('[SupabaseDataService] Creating payment:', {
        hasPaymentNo: !!payment.paymentNo,
        paymentNo: payment.paymentNo,
        orgId
      });
      
      // Always regenerate payment number from database function to ensure uniqueness
      // The paymentNo at this point is a temporary UI number, not the final one
      if (orgId) {
        try {
          // Call RPC function via REST API
          const headers = await this.getHeaders();
          const rpcUrl = `${this.supabaseUrl}/rest/v1/rpc/get_next_payment_no`;
          
          console.log('[SupabaseDataService] Calling RPC:', { rpcUrl, orgId });
          
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_org_id: orgId })
          });

          console.log('[SupabaseDataService] RPC Response status:', response.status);

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[SupabaseDataService] RPC error (${response.status}):`, errorBody);
            throw new Error(`RPC call failed: ${response.status} - ${errorBody}`);
          }

          let generatedPaymentNo: any;
          try {
            const responseText = await response.text();
            console.log('[SupabaseDataService] RPC raw response:', responseText);
            
            // RPC returns plain text or JSON depending on Supabase config
            generatedPaymentNo = responseText.startsWith('"') 
              ? JSON.parse(responseText)  // Remove quotes if present
              : responseText;
          } catch (parseErr) {
            console.error('[SupabaseDataService] Error parsing RPC response:', parseErr);
            throw parseErr;
          }
          
          if (generatedPaymentNo) {
            payment.paymentNo = generatedPaymentNo;
            payment.payment_no = generatedPaymentNo;
            console.log('[SupabaseDataService] ✅ Generated payment_no:', generatedPaymentNo);
          } else {
            console.error('[SupabaseDataService] RPC returned empty/null:', generatedPaymentNo);
            throw new Error('Failed to generate payment number - RPC returned: ' + generatedPaymentNo);
          }
        } catch (err) {
          console.error('[SupabaseDataService] Failed to generate payment number via RPC:', err);
          throw err;  // Don't silently fail - payment cannot be created without unique number
        }
      } else {
        throw new Error('Missing orgId - cannot generate payment number');
      }
    }

    // For payment applications: generate unique application number using atomic database function
    if (table === 'payment_applications') {
      const paymentApplication = entity as any;
      const orgId = paymentApplication.org_id || paymentApplication.orgId;
      const existingApplicationNo = paymentApplication.applicationNo || paymentApplication.application_no;

      console.log('[SupabaseDataService] Creating payment application:', {
        hasApplicationNo: !!existingApplicationNo,
        applicationNo: existingApplicationNo,
        orgId
      });

      if (existingApplicationNo) {
        paymentApplication.applicationNo = existingApplicationNo;
        paymentApplication.application_no = existingApplicationNo;
        console.log('[SupabaseDataService] Using provided payment application_no:', existingApplicationNo);
      } else if (orgId) {
        try {
          const headers = await this.getHeaders();
          const rpcUrl = `${this.supabaseUrl}/rest/v1/rpc/get_next_payment_application_no`;
          const fallbackApplicationNo = paymentApplication.applicationNo || paymentApplication.application_no;

          console.log('[SupabaseDataService] Calling payment application RPC:', { rpcUrl, orgId });

          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ p_org_id: orgId })
          });

          console.log('[SupabaseDataService] Payment application RPC Response status:', response.status);

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[SupabaseDataService] Payment application RPC error (${response.status}):`, errorBody);
            throw new Error(`Payment application RPC call failed: ${response.status} - ${errorBody}`);
          }

          let generatedApplicationNo: any;
          try {
            const responseText = await response.text();
            console.log('[SupabaseDataService] Payment application RPC raw response:', responseText);

            generatedApplicationNo = responseText.startsWith('"')
              ? JSON.parse(responseText)
              : responseText;
          } catch (parseErr) {
            console.error('[SupabaseDataService] Error parsing payment application RPC response:', parseErr);
            throw parseErr;
          }

          if (generatedApplicationNo) {
            paymentApplication.applicationNo = generatedApplicationNo;
            paymentApplication.application_no = generatedApplicationNo;
            console.log('[SupabaseDataService] Generated payment application_no:', generatedApplicationNo);
          } else {
            console.error('[SupabaseDataService] Payment application RPC returned empty/null:', generatedApplicationNo);
            throw new Error('Failed to generate payment application number - RPC returned: ' + generatedApplicationNo);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const rpcMissing =
            errorMessage.includes('PGRST202') ||
            errorMessage.includes('get_next_payment_application_no') ||
            errorMessage.includes('404');

          if (rpcMissing && fallbackApplicationNo) {
            paymentApplication.applicationNo = fallbackApplicationNo;
            paymentApplication.application_no = fallbackApplicationNo;
            console.warn('[SupabaseDataService] Payment application RPC unavailable. Using client-generated application_no:', fallbackApplicationNo);
          } else {
            console.error('[SupabaseDataService] Failed to generate payment application number via RPC:', err);
            throw err;
          }
        }
      } else {
        throw new Error('Missing orgId or applicationNo - cannot create payment application');
      }
    }

    // Convert to snake_case and filter
    const snakeCaseEntity = this.camelToSnake(entity);
    const filteredEntity = this.filterToTableSchema(table, snakeCaseEntity);

    // Remove invalid IDs
    if ((filteredEntity as any).id && !this.isValidUUID((filteredEntity as any).id)) {
      delete (filteredEntity as any).id;
    }

    return this.insertToSupabaseRaw(table, filteredEntity);
  }

  async fetchBillingBillableQty(batchId: string): Promise<number> {
    const response = await fetch(`${this.baseUrl}/rpc/billing_billable_qty`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ p_batch_id: batchId })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`billing_billable_qty failed: ${response.status} ${errorText}`);
    }

    return Number(await response.json() || 0);
  }

  async fetchBillingCourseFeeInvoice(batchId: string, sponsorId?: string): Promise<any[]> {
    const payload: Record<string, any> = { p_batch_id: batchId };
    if (sponsorId !== undefined) {
      payload.p_sponsor_id = sponsorId || null;
    }
    const response = await fetch(`${this.baseUrl}/rpc/billing_course_fee_invoice`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const rows = await response.json();
      return Array.isArray(rows) ? this.snakeToCamel(rows) : [];
    }

    const errorText = await response.text();
    console.warn(`[Supabase] billing_course_fee_invoice unavailable, using REST fallback: ${response.status} ${errorText}`);
    return this.fetchBillingCourseFeeInvoiceViaRest(batchId, sponsorId);
  }

  private async fetchBillingCourseFeeInvoiceViaRest(batchId: string, sponsorId?: string): Promise<any[]> {
    const headers = await this.getHeaders();
    const [batchResponse, enrollmentsResponse] = await Promise.all([
      fetch(`${this.baseUrl}/batches?id=eq.${batchId}&select=id,org_id,qualification_id,sponsor_id,student_ids`, { headers }),
      fetch(`${this.baseUrl}/enrollments?batch_id=eq.${batchId}&select=id,batch_id,sponsor_id,student_id,billing_type,enrollment_status,enrollment_date,created_at,is_deleted,deleted_at`, { headers })
    ]);

    if (!batchResponse.ok) {
      throw new Error(`Failed to load batch billing fallback data: ${batchResponse.status} ${await batchResponse.text()}`);
    }
    if (!enrollmentsResponse.ok) {
      throw new Error(`Failed to load enrollment billing fallback data: ${enrollmentsResponse.status} ${await enrollmentsResponse.text()}`);
    }

    const batchRows = await batchResponse.json();
    const batch = Array.isArray(batchRows) ? batchRows[0] : null;
    if (!batch) {
      console.warn('[Supabase] Billing fallback found no batch row for batch id:', batchId);
      return [];
    }

    const targetSponsorId = sponsorId !== undefined ? (sponsorId || null) : (batch.sponsor_id || null);
    const enrollmentRows = await enrollmentsResponse.json();
    const validEnrollments = (Array.isArray(enrollmentRows) ? enrollmentRows : [])
      .filter(row => !row.is_deleted && !row.deleted_at)
      .filter(row => !['DROPPED', 'CANCELLED', 'CANCELED', 'INACTIVE', 'ARCHIVED'].includes(String(row.enrollment_status || '').toUpperCase()))
      .filter(row => {
        if (sponsorId !== undefined) {
          const rowSponsorId = row.sponsor_id || (sponsorId ? null : batch.sponsor_id) || null;
          return targetSponsorId ? rowSponsorId === targetSponsorId : !rowSponsorId;
        }
        return true;
      })
      .sort((a, b) => {
        const left = String(a.enrollment_date || a.created_at || '');
        const right = String(b.enrollment_date || b.created_at || '');
        const dateCompare = left.localeCompare(right);
        if (dateCompare !== 0) return dateCompare;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
    const batchStudentIds = Array.isArray(batch.student_ids) ? batch.student_ids.filter(Boolean) : [];
    const enrolledQty = validEnrollments.length > 0
      ? validEnrollments.length
      : (sponsorId === undefined ? new Set(batchStudentIds).size : 0);
    console.info('[Supabase] Billing fallback computed batch quantity:', {
      batchId,
      targetSponsorId,
      enrollmentRows: Array.isArray(enrollmentRows) ? enrollmentRows.length : 0,
      validEnrollments: validEnrollments.length,
      batchStudentIds: batchStudentIds.length,
      enrolledQty
    });

    let fundingType = 'PRIVATE';
    if (targetSponsorId) {
      const sponsorResponse = await fetch(
        `${this.baseUrl}/sponsors?id=eq.${targetSponsorId}&select=course_fee_type`,
        { headers }
      );
      if (!sponsorResponse.ok) {
        throw new Error(`Failed to load batch sponsor pricing classification: ${sponsorResponse.status} ${await sponsorResponse.text()}`);
      }
      const sponsorRows = await sponsorResponse.json();
      fundingType = sponsorRows?.[0]?.course_fee_type === 'TESDA_SCHOLARSHIP'
        ? 'TESDA_SCHOLARSHIP'
        : 'SPONSORED';
    }
    const feesResponse = await fetch(
      `${this.baseUrl}/course_fees?qualification_id=eq.${batch.qualification_id}&funding_type=eq.${fundingType}&is_active=eq.true&order=category.asc,fee_name.asc&select=id,fee_name,amount,gl_account_id,tax_category_id,is_deleted`,
      { headers }
    );
    if (!feesResponse.ok) {
      throw new Error(`Failed to load course fee billing fallback data: ${feesResponse.status} ${await feesResponse.text()}`);
    }

    const fees = await feesResponse.json();
    return (Array.isArray(fees) ? fees : [])
      .filter(fee => !fee.is_deleted)
      .map(fee => this.snakeToCamel({
        course_fee_id: fee.id,
        description: fee.fee_name,
        quantity: enrolledQty,
        unit_price: Number(fee.amount || 0),
        amount: Math.round(enrolledQty * Number(fee.amount || 0) * 100) / 100,
        line_type: 'COURSE_FEE',
        gl_account_id: fee.gl_account_id,
        tax_category_id: fee.tax_category_id
      }));
  }

  async fetchPage<T>(table: string, options: FetchPageOptions = {}): Promise<PaginatedResult<T>> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error(`Supabase credentials not configured for table '${table}'`);
    }

    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(Math.max(1, options.pageSize || 25), 200);

    if (table === 'warehouse_locations') {
      const orgId = String(options.filters?.find(filter => filter.column === 'org_id')?.value || '');
      let rows = await this.listWarehouseLocationsViaEdgeFunction(orgId);
      for (const filter of options.filters || []) {
        if (filter.column === 'org_id') continue;
        const camelColumn = filter.column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
        if ((filter.operator || 'eq') === 'eq') {
          rows = rows.filter((row: any) => String(row[camelColumn]) === String(filter.value));
        }
      }
      const searchTerm = options.search?.term?.trim().toLowerCase();
      if (searchTerm && options.search?.columns.length) {
        rows = rows.filter((row: any) => options.search!.columns.some(column => {
          const camelColumn = column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
          return String(row[camelColumn] || '').toLowerCase().includes(searchTerm);
        }));
      }
      rows.sort((left: any, right: any) => String(left.code || '').localeCompare(String(right.code || '')));
      const total = rows.length;
      const from = (page - 1) * pageSize;
      return {
        rows: rows.slice(from, from + pageSize) as T[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    if (table === 'stock_items') {
      const orgId = String(options.filters?.find(filter => filter.column === 'org_id')?.value || '');
      let rows = await this.listStockItemsViaEdgeFunction(orgId);
      for (const filter of options.filters || []) {
        if (filter.column === 'org_id') continue;
        const camelColumn = filter.column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
        if ((filter.operator || 'eq') === 'eq') {
          rows = rows.filter((row: any) => String(row[camelColumn]) === String(filter.value));
        }
      }
      const searchTerm = options.search?.term?.trim().toLowerCase();
      if (searchTerm && options.search?.columns.length) {
        rows = rows.filter((row: any) => options.search!.columns.some(column => {
          const camelColumn = column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
          return String(row[camelColumn] || '').toLowerCase().includes(searchTerm);
        }));
      }
      rows.sort((left: any, right: any) => String(left.code || '').localeCompare(String(right.code || '')));
      const total = rows.length;
      const from = (page - 1) * pageSize;
      return {
        rows: rows.slice(from, from + pageSize) as T[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    if (table === 'inventory_transactions') {
      const orgId = String(options.filters?.find(filter => filter.column === 'org_id')?.value || '');
      let rows: any[] = [];
      if (this.isLocalSupabase()) {
        rows = await this.listInventoryTransactionsViaRest(orgId);
      } else {
        try {
          rows = await this.inventoryAccountingRequest<any[]>('list_transactions', { orgId });
        } catch (err) {
          console.warn('[Supabase] inventory-accounting edge function unavailable; using REST fallback in fetchPage.', err);
          rows = await this.listInventoryTransactionsViaRest(orgId);
        }
      }
      for (const filter of options.filters || []) {
        if (filter.column === 'org_id') continue;
        const camelColumn = filter.column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
        const rowValue = (row: any) => row[camelColumn];
        switch (filter.operator || 'eq') {
          case 'neq':
            rows = rows.filter(row => String(rowValue(row)) !== String(filter.value));
            break;
          case 'in': {
            const accepted = Array.isArray(filter.value) ? filter.value.map(String) : String(filter.value).split(',');
            rows = rows.filter(row => accepted.includes(String(rowValue(row))));
            break;
          }
          default:
            rows = rows.filter(row => String(rowValue(row)) === String(filter.value));
        }
      }
      const searchTerm = options.search?.term?.trim().toLowerCase();
      if (searchTerm && options.search?.columns.length) {
        rows = rows.filter(row => options.search!.columns.some(column => {
          const camelColumn = column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
          return String(row[camelColumn] || '').toLowerCase().includes(searchTerm);
        }));
      }
      for (const order of [...(options.orderBy || [])].reverse()) {
        const camelColumn = order.column.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
        rows.sort((left, right) => {
          const comparison = String(left[camelColumn] ?? '').localeCompare(String(right[camelColumn] ?? ''));
          return order.ascending === false ? -comparison : comparison;
        });
      }
      const total = rows.length;
      const from = (page - 1) * pageSize;
      return {
        rows: rows.slice(from, from + pageSize) as T[],
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    let pageOptions = { ...options };
    if (table === 'purchase_orders') {
      pageOptions = {
        ...pageOptions,
        columns: pageOptions.columns
          ? pageOptions.columns
              .split(',')
              .map(c => c.trim())
              .filter(c => !['lines', 'is_deleted', 'deleted_at', 'deleted_by'].includes(c))
              .map(c => c === 'date' ? 'order_date' : c === 'reference' ? 'po_number' : c === 'memo' ? 'notes' : c)
              .join(',')
          : 'id,org_id,vendor_id,po_number,order_date,expected_delivery_date,status,total_amount,notes,gl_entry_number,created_at,approved_by,approved_at',
        filters: (pageOptions.filters || [])
          .filter(f => !['is_deleted', 'deleted_at', 'deleted_by'].includes(f.column))
          .map(f => ({
            ...f,
            column: f.column === 'date' ? 'order_date' : f.column === 'reference' ? 'po_number' : f.column === 'memo' ? 'notes' : f.column
          })),
        orderBy: (pageOptions.orderBy || []).map(o => ({
          ...o,
          column: o.column === 'date' ? 'order_date' : o.column === 'reference' ? 'po_number' : o.column === 'memo' ? 'notes' : o.column
        })),
        search: pageOptions.search ? {
          ...pageOptions.search,
          columns: pageOptions.search.columns.map(c => c === 'reference' ? 'po_number' : c === 'memo' ? 'notes' : c === 'date' ? 'order_date' : c)
        } : undefined,
      };
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const url = new URL(`${this.baseUrl}/${table}`);

    url.searchParams.set('select', pageOptions.columns || '*');
    url.searchParams.set('offset', String(from));
    url.searchParams.set('limit', String(pageSize));

    for (const filter of pageOptions.filters || []) {
      const operator = filter.operator || 'eq';
      let value: string;
      if (operator === 'in') {
        const rawText = String(filter.value).trim();
        const rawValues = Array.isArray(filter.value)
          ? filter.value
          : (rawText.startsWith('(') && rawText.endsWith(')') ? rawText.slice(1, -1) : rawText).split(',');
        value = `(${rawValues.map(item => String(item).trim()).filter(Boolean).join(',')})`;
      } else {
        value = filter.value === null ? 'null' : String(filter.value);
      }
      url.searchParams.set(filter.column, `${operator}.${value}`);
    }

    const searchTerm = pageOptions.search?.term?.trim();
    if (searchTerm && pageOptions.search?.columns.length) {
      const escapedTerm = searchTerm.replace(/[%*_]/g, '\\$&');
      const clauses = pageOptions.search.columns.map(column => `${column}.ilike.*${escapedTerm}*`);
      url.searchParams.set('or', `(${clauses.join(',')})`);
    }

    if (pageOptions.orderBy?.length) {
      url.searchParams.set(
        'order',
        pageOptions.orderBy
          .map(order => {
            const direction = order.ascending === false ? 'desc' : 'asc';
            const nulls = order.nullsFirst === undefined ? '' : `.${order.nullsFirst ? 'nullsfirst' : 'nullslast'}`;
            return `${order.column}.${direction}${nulls}`;
          })
          .join(',')
      );
    }

    const response = await fetch(url.toString(), {
      headers: {
        ...(await this.getHeaders()),
        Prefer: 'count=exact',
        Range: `${from}-${to}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch ${table} page: ${response.status} ${errorText}`);
    }

    const rows = await response.json();
    const contentRange = response.headers.get('content-range') || '';
    const total = Number(contentRange.split('/')[1] || rows.length || 0);

    let mappedRows = this.snakeToCamel(rows) as any[];
    if (table === 'purchase_orders') {
      mappedRows = mappedRows.map((r: any) => ({
        ...r,
        date: r.date || r.orderDate || '',
        reference: r.reference || r.poNumber || '',
        memo: r.memo || r.notes || '',
        lines: r.lines || [],
      }));
    }

    return {
      rows: mappedRows as T[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /**
   * Create a payment using the edge function for atomic payment number generation
   * This prevents duplicate key errors from concurrent requests
   */
  private async createPaymentViaEdgeFunction(payment: any): Promise<any> {
    try {
      const token = await this.getAuthToken();
      const paymentsWriteUrl = `${this.supabaseUrl}/functions/v1/payments-write`;

      const response = await fetch(paymentsWriteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create_payment',
          orgId: payment.orgId || payment.org_id,  // Send org_id at root level for edge function
          org_id: payment.orgId || payment.org_id,  // Also in snake_case
          payment: this.camelToSnake(payment)
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = `Edge function error: ${response.status}`;
        try {
          const jsonError = JSON.parse(errorBody);
          errorMsg = jsonError.error || jsonError.message || errorMsg;
        } catch {
          errorMsg = errorBody || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error);
      }

      // Convert snake_case response back to camelCase
      return this.snakeToCamel(result.payment);
    } catch (error) {
      console.error('[SupabaseDataService] Error creating payment via edge function:', error);
      throw error;
    }
  }

  private async getNextInvoiceNo(orgId: string): Promise<string> {
    const headers = await this.getHeaders();
    const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/get_next_invoice_no`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_org_id: orgId })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to generate invoice number: ${response.status} - ${errorBody}`);
    }

    const responseText = await response.text();
    const invoiceNo = responseText.startsWith('"') ? JSON.parse(responseText) : responseText;
    if (!invoiceNo) {
      throw new Error('Failed to generate invoice number: empty response');
    }

    return invoiceNo;
  }

  private isInvoiceAccountingLocked(invoice?: any): boolean {
    if (!invoice) return false;
    const status = String(invoice.status || '').toUpperCase();
    return (
      status === 'OPEN' ||
      status === 'CLOSED' ||
      status === 'VOIDED' ||
      !!invoice.journal_entry_id ||
      !!invoice.journalEntryId ||
      !!invoice.posted_at ||
      !!invoice.postedAt ||
      !!String(invoice.gl_entry_number || invoice.glEntryNumber || '').trim()
    );
  }

  private async getInvoiceRawForGuard(id: string): Promise<any | null> {
    const response = await fetch(`${this.baseUrl}/invoices?id=eq.${encodeURIComponent(id)}&select=${this.getSelectColumns('invoices')}&limit=1`, {
      headers: await this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to load invoice guard row: ${response.status} ${await response.text()}`);
    }

    const invoices = await response.json();
    return Array.isArray(invoices) ? invoices[0] || null : null;
  }

  private async assertInvoiceLinesMutable(invoiceId: string): Promise<void> {
    if (!invoiceId) return;
    const invoice = await this.getInvoiceRawForGuard(invoiceId);
    if (this.isInvoiceAccountingLocked(invoice)) {
      throw new Error('Posted invoices are locked. Reverse or void the invoice instead of changing invoice lines.');
    }
  }

  /**
   * Create/update/delete organizations through an edge function so writes can
   * run with server-side credentials while browser clients keep RLS enabled.
   */
  private async writeOrganizationViaEdgeFunction(
    action: 'create_organization' | 'update_organization' | 'delete_organization',
    payload: Record<string, any>
  ): Promise<any> {
    try {
      const token = await this.getAuthToken();
      const organizationsWriteUrl = `${this.supabaseUrl}/functions/v1/organizations-write`;

      const response = await fetch(organizationsWriteUrl, {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ...payload,
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = '';
        try {
          const jsonError = JSON.parse(errorBody);
          errorMsg = jsonError.error || jsonError.message || '';
        } catch {
          errorMsg = errorBody || '';
        }
        throw new Error(`Organizations edge function error: ${response.status}${errorMsg ? ` - ${errorMsg}` : ''}`);
      }

      const result = await response.json();
      if (!result.organization) {
        return result;
      }

      return this.snakeToCamel(result.organization);
    } catch (error) {
      if (this.isRecoverableOrganizationWriteError(error)) {
        console.warn('[SupabaseDataService] Organization edge function unavailable or unauthorized; using REST fallback when allowed:', error);
      } else {
        console.error('[SupabaseDataService] Error writing organization via edge function:', error);
      }
      throw error;
    }
  }

  private isRecoverableOrganizationWriteError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /organizations edge function error:\s*(401|403)|authentication required|requested function was not found|not_found|failed to fetch|networkerror|load failed/i.test(message);
  }

  /**
   * Create users through an edge function so browser clients can authenticate
   * with the AT-ERP JWT while the server writes with the service role.
   */
  private async writeUserViaEdgeFunction(
    action: 'create_user',
    payload: Record<string, any>
  ): Promise<any> {
    try {
      const token = await this.getAuthToken();
      const usersWriteUrl = `${this.supabaseUrl}/functions/v1/users-write`;

      const response = await fetch(usersWriteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          ...payload,
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = `Users edge function error: ${response.status}`;
        try {
          const jsonError = JSON.parse(errorBody);
          errorMsg = jsonError.error || jsonError.message || errorMsg;
        } catch {
          errorMsg = errorBody || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      if (!result.user) {
        return result;
      }

      return this.snakeToCamel(result.user);
    } catch (error) {
      console.error('[SupabaseDataService] Error writing user via edge function:', error);
      throw error;
    }
  }

  private isRecoverableUserWriteError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /requested function was not found|not_found|failed to fetch|networkerror|load failed/i.test(message);
  }

  /**
   * Get authentication token for edge function calls
   */
  private async getAuthToken(): Promise<string> {
    try {
      const jwtToken = await TokenManager.getAccessToken();
      if (jwtToken) {
        return jwtToken;
      }
    } catch (err) {
      console.warn('[SupabaseDataService] Could not load AT-ERP JWT from TokenManager:', err);
    }

    try {
      // Try to get token from localStorage where Supabase stores it
      const authData = localStorage.getItem('sb-auth-token');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed?.access_token) {
          return parsed.access_token;
        }
      }
    } catch (err) {
      console.warn('[SupabaseDataService] Could not parse auth token from localStorage:', err);
    }

    // Fallback to anon key if no user token available
    // (RLS policies may restrict access, so use the key provided at initialization)
    return this.supabaseKey;
  }

  async updateEntity<T>(table: string, id: string, updates: Partial<T>): Promise<T> {
    // Convert to snake_case and filter
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema(table, snakeCaseUpdates);

    return this.updateInSupabaseRaw(table, id, filteredUpdates);
  }

  async deleteEntity(table: string, id: string): Promise<void> {
    return this.deleteFromSupabase(table, id);
  }

  async archiveEntity(table: string, id: string, userId: string): Promise<void> {
    return this.updateInSupabaseRaw(table, id, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    });
  }

  async restoreEntity(table: string, id: string): Promise<void> {
    return this.updateInSupabaseRaw(table, id, {
      is_deleted: false,
      deleted_at: null,
      deleted_by: null
    });
  }

  async permanentDeleteEntity(table: string, id: string): Promise<void> {
    return this.deleteFromSupabase(table, id);
  }

  async checkUsage(table: string, id: string): Promise<{ isUsed: boolean; usedIn: string[] }> {
    // Map of internal table names to their check functions
    const checkMap: Record<string, (id: string) => Promise<{ isUsed: boolean; usedIn: string[] }>> = {
      'students': this.checkStudentUsage.bind(this),
      'trainers': this.checkTrainerUsage.bind(this),
      'qualifications': this.checkQualificationUsage.bind(this),
      'locations': this.checkLocationUsage.bind(this),
      'schedules': this.checkScheduleUsage.bind(this),
      'sponsors': this.checkSponsorUsage.bind(this),
      // Add more as needed
    };

    if (checkMap[table]) {
      return checkMap[table](id);
    }

    // Default: no usage check implemented
    return { isUsed: false, usedIn: [] };
  }

  /**
   * Fixed Asset CRUD Operations
   */
  async createFixedAsset(asset: any): Promise<any> {
    const snakeCaseAsset = this.camelToSnake(asset);

    // Convert empty strings to null for UUID columns
    if (snakeCaseAsset.gl_account_id === '') snakeCaseAsset.gl_account_id = null;

    // Use isInsert: true to exclude generated columns (net_book_value, created_at, updated_at)
    const filteredAsset = this.filterToTableSchema('fixed_assets', snakeCaseAsset, true);
    if ((filteredAsset as any).id && !this.isValidUUID((filteredAsset as any).id)) {
      delete (filteredAsset as any).id;
    }
    return this.insertToSupabaseRaw('fixed_assets', filteredAsset);
  }

  async updateFixedAsset(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snakeCaseUpdates.gl_account_id === '') snakeCaseUpdates.gl_account_id = null;

    const filteredUpdates = this.filterToTableSchema('fixed_assets', snakeCaseUpdates);
    return this.updateInSupabaseRaw('fixed_assets', id, filteredUpdates);
  }

  async deleteFixedAsset(id: string): Promise<void> {
    return this.deleteFromSupabase('fixed_assets', id);
  }

  /**
   * Item Catalog CRUD Operations
   */
  async createItem(item: any): Promise<any> {
    const snakeCaseItem = this.camelToSnake(item);

    // Convert empty strings to null for UUID columns
    if (snakeCaseItem.income_account_id === '') snakeCaseItem.income_account_id = null;
    if (snakeCaseItem.expense_account_id === '') snakeCaseItem.expense_account_id = null;
    if (snakeCaseItem.tax_category_id === '') snakeCaseItem.tax_category_id = null;

    // Use isInsert: true to exclude generated columns (created_at, updated_at)
    const filteredItem = this.filterToTableSchema('items', snakeCaseItem, true);
    if ((filteredItem as any).id && !this.isValidUUID((filteredItem as any).id)) {
      delete (filteredItem as any).id;
    }
    return this.insertToSupabaseRaw('items', filteredItem);
  }

  async updateItem(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snakeCaseUpdates.income_account_id === '') snakeCaseUpdates.income_account_id = null;
    if (snakeCaseUpdates.expense_account_id === '') snakeCaseUpdates.expense_account_id = null;
    if (snakeCaseUpdates.tax_category_id === '') snakeCaseUpdates.tax_category_id = null;

    const filteredUpdates = this.filterToTableSchema('items', snakeCaseUpdates);
    return this.updateInSupabaseRaw('items', id, filteredUpdates);
  }

  async deleteItem(id: string): Promise<void> {
    return this.deleteFromSupabase('items', id);
  }

  // ============================================================================
  // COURSE FEE CRUD
  // ============================================================================

  async createCourseFee(fee: any): Promise<any> {
    console.debug('[Supabase] createCourseFee called with:', fee);
    const snake = this.camelToSnake(fee);

    // Convert empty strings to null for UUID columns
    if (snake.gl_account_id === '') snake.gl_account_id = null;
    if (snake.tax_category_id === '') snake.tax_category_id = null;
    if (snake.qualification_id === '') snake.qualification_id = null;

    const filtered = this.filterToTableSchema('course_fees', snake, true);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('course_fees', filtered);
  }

  async updateCourseFee(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateCourseFee called with:', id, updates);
    const snake = this.camelToSnake(updates);

    // Never include record identity, tenant ownership, creation metadata, or
    // soft-delete metadata in a normal course-fee edit.
    delete snake.id;
    delete snake.org_id;
    delete snake.created_at;
    delete snake.is_deleted;
    delete snake.deleted_at;
    delete snake.deleted_by;

    // Convert empty strings to null for UUID columns
    if (snake.gl_account_id === '') snake.gl_account_id = null;
    if (snake.tax_category_id === '') snake.tax_category_id = null;
    if (snake.qualification_id === '') snake.qualification_id = null;
    if (snake.is_subject_to_ewt === false && snake.ewt_rate === undefined) snake.ewt_rate = null;

    const filtered = this.filterToTableSchema('course_fees', snake);
    return this.updateInSupabaseRaw('course_fees', id, filtered, true, true);
  }

  async deleteCourseFee(id: string): Promise<void> {
    console.debug('[Supabase] deleteCourseFee called with:', id);
    return this.deleteFromSupabase('course_fees', id);
  }

  async getCourseFeesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getCourseFeesByOrg called with:', orgId);
    try {
      const url = `${this.baseUrl}/course_fees?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const data = await this.fetchAllPagesWithSoftDeleteFallback<any>(url, 'course_fees');
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching course fees:', error);
      return [];
    }
  }

  /**
   * Payables CRUD Operations
   */
  async createPayable(payable: any): Promise<any> {
    const snake = this.camelToSnake(payable);

    // Convert empty strings to null for UUID columns
    if (snake.vendor_id === '') snake.vendor_id = null;
    if (snake.gl_account_id === '') snake.gl_account_id = null;
    if (snake.expense_account_id === '') snake.expense_account_id = null;
    if (snake.qualification_id === '') snake.qualification_id = null;
    if (snake.journal_entry_id === '') snake.journal_entry_id = null;
    if (snake.atc_item_id === '') snake.atc_item_id = null;
    if (snake.atc_rate_id === '') snake.atc_rate_id = null;

    // Exclude generated columns on insert
    const filtered = this.filterToTableSchema('payables', snake, true);
    if ((filtered as any).id && !this.isValidUUID((filtered as any).id)) {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('payables', filtered);
  }

  async updatePayable(id: string, updates: Partial<any>): Promise<any> {
    const snake = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snake.vendor_id === '') snake.vendor_id = null;
    if (snake.gl_account_id === '') snake.gl_account_id = null;
    if (snake.expense_account_id === '') snake.expense_account_id = null;
    if (snake.qualification_id === '') snake.qualification_id = null;
    if (snake.journal_entry_id === '') snake.journal_entry_id = null;
    if (snake.atc_item_id === '') snake.atc_item_id = null;
    if (snake.atc_rate_id === '') snake.atc_rate_id = null;

    const filtered = this.filterToTableSchema('payables', snake);
    return this.updateInSupabaseRaw('payables', id, filtered);
  }

  async deletePayable(id: string, deletedBy?: string): Promise<void> {
    await this.updateInSupabaseRaw('payables', id, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy || null,
    });
  }

  private async getTranscriptRecordsViaRest(orgId: string): Promise<TranscriptRecord[]> {
    if (!orgId) return [];
    try {
      const url = `${this.baseUrl}/transcript_records?org_id=eq.${encodeURIComponent(orgId)}&order=uploaded_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) {
        console.warn(`[Supabase] transcript_records REST fetch failed: ${response.status} - ${await response.text()}`);
        return [];
      }
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []) as TranscriptRecord[];
    } catch (error) {
      console.error('[Supabase] Error fetching transcript records via REST:', error);
      return [];
    }
  }

  private async getBatchTranscriptRecordsViaRest(orgId: string): Promise<BatchTranscriptRecord[]> {
    if (!orgId) return [];
    try {
      const url = `${this.baseUrl}/batch_transcript_records?org_id=eq.${encodeURIComponent(orgId)}&order=uploaded_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) {
        console.warn(`[Supabase] batch_transcript_records REST fetch failed: ${response.status} - ${await response.text()}`);
        return [];
      }
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []) as BatchTranscriptRecord[];
    } catch (error) {
      console.error('[Supabase] Error fetching batch transcript records via REST:', error);
      return [];
    }
  }

  async getTranscriptRecords(orgId: string): Promise<TranscriptRecord[]> {
    if (!orgId) return [];
    if (this.isLocalSupabase()) {
      return this.getTranscriptRecordsViaRest(orgId);
    }
    try {
      const token = await this.getAuthToken();
      const url = new URL(`${this.supabaseUrl}/functions/v1/transcripts`);
      url.searchParams.set('action', 'list');
      url.searchParams.set('orgId', orgId);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      if (!response.ok) {
        throw new Error(`Unable to load transcript records (${response.status}): ${await response.text()}`);
      }
      const result = await response.json();
      return this.snakeToCamel(result.records || []) as TranscriptRecord[];
    } catch (err) {
      console.warn('[Supabase] transcripts edge function unavailable for list; using REST fallback.', err);
      return this.getTranscriptRecordsViaRest(orgId);
    }
  }

  async getBatchTranscriptRecords(orgId: string): Promise<BatchTranscriptRecord[]> {
    if (!orgId) return [];
    if (this.isLocalSupabase()) {
      return this.getBatchTranscriptRecordsViaRest(orgId);
    }
    try {
      const token = await this.getAuthToken();
      const url = new URL(`${this.supabaseUrl}/functions/v1/transcripts`);
      url.searchParams.set('action', 'list');
      url.searchParams.set('orgId', orgId);
      const response = await fetch(url, {
        method: 'POST',
        headers: { apikey: this.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load batch transcript records.');
      return this.snakeToCamel(result.batchRecords || []) as BatchTranscriptRecord[];
    } catch (err) {
      console.warn('[Supabase] transcripts edge function unavailable for batch list; using REST fallback.', err);
      return this.getBatchTranscriptRecordsViaRest(orgId);
    }
  }

  async uploadTranscriptPdf(input: {
    orgId: string;
    enrollmentId?: string;
    studentId: string;
    batchId: string;
    uploadedBy?: string;
    file: File;
  }): Promise<TranscriptRecord> {
    if (input.file.type !== 'application/pdf' && !input.file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF transcript files can be uploaded.');
    }
    if (input.file.size > 15 * 1024 * 1024) {
      throw new Error('The transcript PDF must not exceed 15 MB.');
    }

    const token = await this.getAuthToken();
    const uploadUrl = new URL(`${this.supabaseUrl}/functions/v1/transcripts`);
    uploadUrl.searchParams.set('action', 'upload');
    uploadUrl.searchParams.set('orgId', input.orgId);
    if (input.enrollmentId) uploadUrl.searchParams.set('enrollmentId', input.enrollmentId);
    uploadUrl.searchParams.set('studentId', input.studentId);
    uploadUrl.searchParams.set('batchId', input.batchId);
    uploadUrl.searchParams.set('fileName', input.file.name);
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: this.supabaseKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/pdf'
      },
      body: input.file
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `Unable to upload transcript (${response.status})`);
    }
    return this.snakeToCamel(result.record) as TranscriptRecord;
  }

  async downloadTranscriptPdf(objectPath: string): Promise<Blob> {
    const orgId = objectPath.split('/')[0] || '';
    if (!this.isLocalSupabase()) {
      try {
        const token = await this.getAuthToken();
        const url = new URL(`${this.supabaseUrl}/functions/v1/transcripts`);
        url.searchParams.set('action', 'download');
        url.searchParams.set('orgId', orgId);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            apikey: this.supabaseKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ objectPath })
        });
        if (response.ok) {
          return await response.blob();
        }
      } catch (err) {
        console.warn('[Supabase] downloadTranscriptPdf via edge function failed; trying storage REST download.', err);
      }
    }
    const headers = await this.getHeaders();
    const storageUrl = `${this.supabaseUrl}/storage/v1/object/authenticated/transcripts/${encodeURI(objectPath)}`;
    const storageRes = await fetch(storageUrl, { headers });
    if (!storageRes.ok) {
      throw new Error(`Unable to download transcript: ${storageRes.status} - ${await storageRes.text()}`);
    }
    return storageRes.blob();
  }

  async uploadBatchTranscriptPdf(input: { orgId: string; batchId: string; file: File }): Promise<BatchTranscriptRecord> {
    if (input.file.type !== 'application/pdf' && !input.file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Only PDF transcript files can be uploaded.');
    }
    if (input.file.size > 15 * 1024 * 1024) throw new Error('The batch transcript PDF must not exceed 15 MB.');
    const token = await this.getAuthToken();
    const url = new URL(`${this.supabaseUrl}/functions/v1/transcripts`);
    url.searchParams.set('action', 'upload-batch');
    url.searchParams.set('orgId', input.orgId);
    url.searchParams.set('batchId', input.batchId);
    url.searchParams.set('fileName', input.file.name);
    const response = await fetch(url, {
      method: 'POST',
      headers: { apikey: this.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
      body: input.file
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Unable to upload the consolidated batch TOR.');
    return this.snakeToCamel(result.record) as BatchTranscriptRecord;
  }

  async downloadBatchTranscriptPdf(objectPath: string, orgId: string): Promise<Blob> {
    if (!this.isLocalSupabase()) {
      try {
        const token = await this.getAuthToken();
        const url = new URL(`${this.supabaseUrl}/functions/v1/transcripts`);
        url.searchParams.set('action', 'download');
        url.searchParams.set('orgId', orgId);
        const response = await fetch(url, {
          method: 'POST',
          headers: { apikey: this.supabaseKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectPath, recordType: 'batch' })
        });
        if (response.ok) {
          return await response.blob();
        }
      } catch (err) {
        console.warn('[Supabase] downloadBatchTranscriptPdf via edge function failed; trying storage REST download.', err);
      }
    }
    const headers = await this.getHeaders();
    const storageUrl = `${this.supabaseUrl}/storage/v1/object/authenticated/transcripts/${encodeURI(objectPath)}`;
    const storageRes = await fetch(storageUrl, { headers });
    if (!storageRes.ok) {
      throw new Error(`Unable to download batch transcript: ${storageRes.status} - ${await storageRes.text()}`);
    }
    return storageRes.blob();
  }

  private async payableRpc<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/rpc/${functionName}`, {
      method: 'POST',
      headers: { ...(await this.getHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`AP transaction failed: ${response.status} - ${await response.text()}`);
    }
    return this.snakeToCamel(await response.json()) as T;
  }

  async postPayableBill(id: string, actorId: string): Promise<{ journalEntryId: string; payableId: string; idempotent: boolean }> {
    return this.payableRpc('post_payable_bill', { p_payable_id: id, p_actor_id: actorId });
  }

  async postPayablePayment(input: {
    paymentEventId: string;
    payableIds: string[];
    amounts: number[];
    cashAccountId: string;
    paymentDate: string;
    paymentMethod: string;
    actorId: string;
  }): Promise<{ journalEntryId: string; paymentEventId: string; total: number; idempotent: boolean }> {
    return this.payableRpc('post_payable_payment', {
      p_payment_event_id: input.paymentEventId,
      p_payable_ids: input.payableIds,
      p_amounts: input.amounts,
      p_cash_account_id: input.cashAccountId,
      p_payment_date: input.paymentDate,
      p_payment_method: input.paymentMethod,
      p_actor_id: input.actorId,
    });
  }

  async cancelPayable(id: string, actorId: string, reason: string): Promise<{ payableId: string; journalEntryId?: string; idempotent: boolean }> {
    return this.payableRpc('cancel_payable', { p_payable_id: id, p_actor_id: actorId, p_reason: reason });
  }

  private async apMemoRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.supabaseUrl}/functions/v1/ap-memos-write`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'AP memo request failed');
    return result;
  }

  async getAPMemosByOrg(orgId: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.getAPMemosViaRest(orgId);
    }
    try {
      const result = await this.apMemoRequest('list', { orgId });
      return this.snakeToCamel(result.memos || []);
    } catch (err) {
      console.warn('[Supabase] ap-memos-write edge function unavailable; using REST fallback.', err);
      return this.getAPMemosViaRest(orgId);
    }
  }

  private async getAPMemosViaRest(orgId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/ap_memos?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
        { headers: await this.getHeaders() }
      );
      if (!response.ok) {
        console.warn(`[Supabase] REST query for ap_memos returned ${response.status}`);
        return [];
      }
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('[Supabase] Failed to fetch ap_memos via REST:', error);
      return [];
    }
  }

  async createAPMemo(memo: any): Promise<any> {
    const result = await this.apMemoRequest('create', { orgId: memo.orgId, memo });
    return this.snakeToCamel(result.memo);
  }

  async updateAPMemo(id: string, updates: Partial<any>): Promise<any> {
    const result = await this.apMemoRequest('update', { id, updates });
    return this.snakeToCamel(result.memo);
  }

  async deleteAPMemo(id: string, actorId: string): Promise<void> {
    await this.apMemoRequest('delete', { id, actorId });
  }

  async getNextAPMemoNumber(orgId: string, memoType: 'CREDIT' | 'DEBIT', memoDate: string, actorId: string): Promise<string> {
    const result = await this.apMemoRequest('next_number', { orgId, memoType, memoDate, actorId });
    return String(result.memoNumber);
  }

  async submitAPMemo(id: string, actorId: string): Promise<{ memoId: string; status: string; idempotent: boolean }> {
    const result = await this.apMemoRequest('submit', { id, actorId });
    return this.snakeToCamel(result.result);
  }

  async postAPMemo(id: string, actorId: string): Promise<{ memoId: string; journalEntryId: string; status: string; idempotent: boolean }> {
    const result = await this.apMemoRequest('post', { id, actorId });
    return this.snakeToCamel(result.result);
  }

  async reverseAPMemo(id: string, actorId: string, reason: string): Promise<{ memoId: string; journalEntryId: string; status: string; idempotent: boolean }> {
    const result = await this.apMemoRequest('reverse', { id, actorId, reason });
    return this.snakeToCamel(result.result);
  }

  async cancelAPMemo(id: string, actorId: string, reason: string): Promise<{ memoId: string; status: string; idempotent: boolean }> {
    const result = await this.apMemoRequest('cancel', { id, actorId, reason });
    return this.snakeToCamel(result.result);
  }

  private async apReclassificationRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    let response: Response;
    try {
      response = await fetch(`${this.supabaseUrl}/functions/v1/ap-reclassifications-write`, {
        method: 'POST',
        headers: { 'apikey': this.supabaseKey, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch {
      throw new Error('AP Reclassification backend is unavailable. Deploy the database migration and ap-reclassifications-write Edge Function.');
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'AP reclassification request failed');
    return result;
  }

  async getAPReclassificationsByOrg(orgId: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.getAPReclassificationsViaRest(orgId);
    }
    try {
      const result = await this.apReclassificationRequest('list', { orgId });
      return this.snakeToCamel(result.reclassifications || []);
    } catch (err) {
      console.warn('[Supabase] ap-reclassifications-write edge function unavailable; using REST fallback.', err);
      return this.getAPReclassificationsViaRest(orgId);
    }
  }

  private async getAPReclassificationsViaRest(orgId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/ap_reclassifications?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
        { headers: await this.getHeaders() }
      );
      if (!response.ok) {
        console.warn(`[Supabase] REST query for ap_reclassifications returned ${response.status}`);
        return [];
      }
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('[Supabase] Failed to fetch ap_reclassifications via REST:', error);
      return [];
    }
  }
  async createAPReclassification(reclassification: any): Promise<any> {
    const result = await this.apReclassificationRequest('create', { orgId: reclassification.orgId, reclassification });
    return this.snakeToCamel(result.reclassification);
  }
  async updateAPReclassification(id: string, updates: any): Promise<any> {
    const result = await this.apReclassificationRequest('update', { id, updates });
    return this.snakeToCamel(result.reclassification);
  }
  async deleteAPReclassification(id: string, actorId: string): Promise<void> {
    await this.apReclassificationRequest('delete', { id, actorId });
  }
  async submitAPReclassification(id: string, actorId: string): Promise<any> {
    return this.snakeToCamel((await this.apReclassificationRequest('submit', { id, actorId })).result);
  }
  async postAPReclassification(id: string, actorId: string): Promise<any> {
    return this.snakeToCamel((await this.apReclassificationRequest('post', { id, actorId })).result);
  }
  async reverseAPReclassification(id: string, actorId: string, reason: string): Promise<any> {
    return this.snakeToCamel((await this.apReclassificationRequest('reverse', { id, actorId, reason })).result);
  }
  async cancelAPReclassification(id: string, actorId: string, reason: string): Promise<any> {
    return this.snakeToCamel((await this.apReclassificationRequest('cancel', { id, actorId, reason })).result);
  }

  async getTimeExpensesByOrg(orgId: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.getTimeExpensesViaRest(orgId);
    }
    try {
      const result = await this.timeExpenseRequest('list', { orgId });
      return this.snakeToCamel(result.expenses || []);
    } catch (err) {
      console.warn('[Supabase] time-expenses-write edge function unavailable; using REST fallback.', err);
      return this.getTimeExpensesViaRest(orgId);
    }
  }

  private async getTimeExpensesViaRest(orgId: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/time_expenses?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`,
        { headers: await this.getHeaders() }
      );
      if (!response.ok) {
        console.warn(`[Supabase] REST query for time_expenses returned ${response.status}`);
        return [];
      }
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('[Supabase] Failed to fetch time_expenses via REST:', error);
      return [];
    }
  }

  private sanitizeTimeExpensePayload(payload: Record<string, any>, isInsert: boolean): Record<string, any> {
    const sanitized = { ...payload };
    if (isInsert || !this.isUuid(sanitized.id)) {
      delete sanitized.id;
    }
    const nullableUuidCols = [
      'expense_account_id',
      'qualification_id',
      'tax_category_id',
      'supplier_id',
      'employee_id',
      'payable_id',
      'created_by',
    ];
    for (const col of nullableUuidCols) {
      if (Object.prototype.hasOwnProperty.call(sanitized, col)) {
        const val = sanitized[col];
        if (val === '' || val === undefined) {
          sanitized[col] = null;
        }
      }
    }
    if (sanitized.created_by && !this.isUuid(String(sanitized.created_by))) {
      sanitized.created_by = null;
    }
    return sanitized;
  }

  private formatTimeExpenseRestError(action: 'create' | 'update' | 'delete', status: number, errText: string): Error {
    let parsed: { code?: string; message?: string; details?: string } | null = null;
    try {
      parsed = JSON.parse(errText);
    } catch {
      parsed = null;
    }
    if (parsed?.code === '23505' || /time_expenses_org_rfq_code_idx|duplicate key/i.test(errText)) {
      return new Error('An expense record with this RFQ / F.R. code already exists in this organization.');
    }
    if (status === 401 || status === 403 || parsed?.code === '42501' || /row-level security/i.test(errText)) {
      return new Error('You do not have permission to save time and expense records for this organization, or your session has expired.');
    }
    if (parsed?.message) {
      return new Error(`Failed to ${action} time expense: ${parsed.message}`);
    }
    return new Error(`Failed to ${action} time expense: ${status} ${errText}`);
  }

  private isRecoverableTimeExpenseFunctionError(error: unknown): boolean {
    const status = (error as { status?: number })?.status;
    if (status === 404 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /failed to fetch|networkerror|load failed|edge function|functions\/v1|not_found|function not found|name resolution|cors|err_connection|econnrefused|timed out/i.test(message);
  }

  async createTimeExpense(expense: any): Promise<any> {
    const filtered = this.filterToTableSchema('time_expenses', this.camelToSnake(expense), true);
    if (!filtered.org_id) {
      throw new Error('An organization is required to create an expense.');
    }
    if (this.isLocalSupabase()) {
      return this.createTimeExpenseViaRest(expense, filtered.org_id);
    }
    try {
      const result = await this.timeExpenseRequest('create', { orgId: filtered.org_id, expense });
      return this.snakeToCamel(result.expense);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : String(err ?? '');
      if (code === '23505' || /already exists|duplicate key|time_expenses_org_rfq_code_idx/i.test(message)) {
        throw new Error('An expense record with this RFQ / F.R. code already exists in this organization.');
      }
      console.warn('[Supabase] time-expenses-write edge function failed or unavailable; attempting REST insert fallback.', err);
      try {
        return await this.createTimeExpenseViaRest(expense, filtered.org_id);
      } catch (restErr) {
        if (this.isRecoverableTimeExpenseFunctionError(err)) {
          throw restErr;
        }
        throw err;
      }
    }
  }

  private async createTimeExpenseViaRest(expense: any, orgId: string): Promise<any> {
    const snake = this.camelToSnake(expense);
    const quantity = Number(snake.quantity || 0);
    const unitCost = Number(snake.unit_cost || 0);
    const amount = Math.round(quantity * unitCost * 100) / 100;
    const payload = this.sanitizeTimeExpensePayload(
      this.filterToTableSchema('time_expenses', {
        ...snake,
        org_id: orgId,
        quantity,
        unit_cost: unitCost,
        amount,
        status: snake.status || 'open',
      }, true),
      true
    );

    const response = await fetch(`${this.baseUrl}/time_expenses`, {
      method: 'POST',
      headers: {
        ...(await this.getHeaders()),
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.formatTimeExpenseRestError('create', response.status, errText);
    }

    const rows = await response.json();
    const inserted = Array.isArray(rows) ? rows[0] : rows;
    return this.snakeToCamel(inserted);
  }

  async updateTimeExpense(id: string, updates: any): Promise<any> {
    if (this.isLocalSupabase()) {
      return this.updateTimeExpenseViaRest(id, updates);
    }
    try {
      const result = await this.timeExpenseRequest('update', { id, updates });
      return this.snakeToCamel(result.expense);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : String(err ?? '');
      if (code === '23505' || /already exists|duplicate key|time_expenses_org_rfq_code_idx/i.test(message)) {
        throw new Error('An expense record with this RFQ / F.R. code already exists in this organization.');
      }
      console.warn('[Supabase] time-expenses-write edge function failed or unavailable; attempting REST update fallback.', err);
      try {
        return await this.updateTimeExpenseViaRest(id, updates);
      } catch (restErr) {
        if (this.isRecoverableTimeExpenseFunctionError(err)) {
          throw restErr;
        }
        throw err;
      }
    }
  }

  private async updateTimeExpenseViaRest(id: string, updates: any): Promise<any> {
    const snake = this.camelToSnake(updates);
    if (snake.quantity !== undefined || snake.unit_cost !== undefined) {
      const quantity = Number(snake.quantity);
      const unitCost = Number(snake.unit_cost);
      if (Number.isFinite(quantity) && Number.isFinite(unitCost)) {
        snake.amount = Math.round(quantity * unitCost * 100) / 100;
      }
    }
    const payload = this.sanitizeTimeExpensePayload(
      this.filterToTableSchema('time_expenses', snake),
      false
    );

    const response = await fetch(`${this.baseUrl}/time_expenses?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        ...(await this.getHeaders()),
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.formatTimeExpenseRestError('update', response.status, errText);
    }

    const rows = await response.json();
    const updated = Array.isArray(rows) ? rows[0] : rows;
    if (!updated) {
      throw new Error('Expense record could not be updated. Verify that the expense is still open and you have permission for this organization.');
    }
    return this.snakeToCamel(updated);
  }

  async deleteTimeExpense(id: string): Promise<void> {
    if (this.isLocalSupabase()) {
      return this.deleteTimeExpenseViaRest(id);
    }
    try {
      await this.timeExpenseRequest('delete', { id });
    } catch (err) {
      console.warn('[Supabase] time-expenses-write edge function failed or unavailable; attempting REST delete fallback.', err);
      try {
        return await this.deleteTimeExpenseViaRest(id);
      } catch (restErr) {
        if (this.isRecoverableTimeExpenseFunctionError(err)) {
          throw restErr;
        }
        throw err;
      }
    }
  }

  private async deleteTimeExpenseViaRest(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/time_expenses?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw this.formatTimeExpenseRestError('delete', response.status, errText);
    }
  }

  private async timeExpenseRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.supabaseUrl}/functions/v1/time-expenses-write`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `Time expense request failed (${response.status})`) as Error & { status?: number; code?: string };
      error.status = response.status;
      if (result.code) error.code = result.code;
      throw error;
    }
    return result;
  }

  // ============================================================================
  // BILL CRUD
  // ============================================================================
  async createBill(bill: any): Promise<any> {
    console.debug('[Supabase] createBill called with:', bill);
    const snake = this.camelToSnake(bill);

    // Convert empty strings to null for UUID columns
    if (snake.vendor_id === '') snake.vendor_id = null;
    if (snake.gl_account_id === '') snake.gl_account_id = null;
    if (snake.atc_item_id === '') snake.atc_item_id = null;
    if (snake.atc_rate_id === '') snake.atc_rate_id = null;

    const filtered = this.filterToTableSchema('bills', snake);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('bills', filtered);
  }

  async updateBill(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateBill called with:', id, updates);
    const snake = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snake.vendor_id === '') snake.vendor_id = null;
    if (snake.gl_account_id === '') snake.gl_account_id = null;
    if (snake.atc_item_id === '') snake.atc_item_id = null;
    if (snake.atc_rate_id === '') snake.atc_rate_id = null;

    const filtered = this.filterToTableSchema('bills', snake);
    return this.updateInSupabaseRaw('bills', id, filtered);
  }

  async deleteBill(id: string): Promise<void> {
    console.debug('[Supabase] deleteBill called with:', id);
    return this.deleteFromSupabase('bills', id);
  }

  // ============================================================================
  // BANK ACCOUNT CRUD
  // ============================================================================
  async createBankAccount(account: any): Promise<any> {
    console.debug('[Supabase] createBankAccount called with:', account);
    const snake = this.camelToSnake(account);

    // Convert empty strings to null for UUID columns
    if (snake.gl_account_id === '') snake.gl_account_id = null;

    const filtered = this.filterToTableSchema('bank_accounts', snake);
    // Remove id if it's undefined or empty string - let Supabase auto-generate UUID
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('bank_accounts', filtered);
  }

  async updateBankAccount(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateBankAccount called with:', id, updates);
    const snake = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snake.gl_account_id === '') snake.gl_account_id = null;

    const filtered = this.filterToTableSchema('bank_accounts', snake);
    return this.updateInSupabaseRaw('bank_accounts', id, filtered);
  }

  async deleteBankAccount(id: string): Promise<void> {
    console.debug('[Supabase] deleteBankAccount called with:', id);
    return this.deleteFromSupabase('bank_accounts', id);
  }

  // ============================================================================
  // BANK RECONCILIATION CRUD
  // ============================================================================
  async createBankReconciliation(reconciliation: any): Promise<any> {
    console.debug('[Supabase] createBankReconciliation called with:', reconciliation);
    const snake = this.camelToSnake(reconciliation);
    const filtered = this.filterToTableSchema('bank_reconciliations', snake);
    // Remove id if it's undefined or empty string - let Supabase auto-generate UUID
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('bank_reconciliations', filtered);
  }

  async updateBankReconciliation(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateBankReconciliation called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('bank_reconciliations', snake);
    return this.updateInSupabaseRaw('bank_reconciliations', id, filtered);
  }

  async deleteBankReconciliation(id: string): Promise<void> {
    console.debug('[Supabase] deleteBankReconciliation called with:', id);
    return this.deleteFromSupabase('bank_reconciliations', id);
  }

  async getBankReconciliationsByAccount(bankAccountId: string): Promise<any[]> {
    console.debug('[Supabase] getBankReconciliationsByAccount called with:', bankAccountId);
    try {
      const url = `${this.baseUrl}/bank_reconciliations?bank_account_id=eq.${bankAccountId}&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch reconciliations');
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching reconciliations:', error);
      return [];
    }
  }

  async getLatestBankReconciliation(bankAccountId: string): Promise<any | null> {
    console.debug('[Supabase] getLatestBankReconciliation called with:', bankAccountId);
    try {
      const url = `${this.baseUrl}/bank_reconciliations?bank_account_id=eq.${bankAccountId}&order=created_at.desc&limit=1`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch latest reconciliation');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching latest reconciliation:', error);
      return null;
    }
  }

  // ============================================================================
  // RECURRING JOURNAL ENTRY CRUD
  // ============================================================================
  async createRecurringJournalEntry(entry: any): Promise<any> {
    console.debug('[Supabase] createRecurringJournalEntry called with:', entry);
    const snake = this.camelToSnake(entry);
    const filtered = this.filterToTableSchema('recurring_journal_entries', snake);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('recurring_journal_entries', filtered);
  }

  async updateRecurringJournalEntry(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRecurringJournalEntry called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('recurring_journal_entries', snake);
    return this.updateInSupabaseRaw('recurring_journal_entries', id, filtered);
  }

  async deleteRecurringJournalEntry(id: string): Promise<void> {
    console.debug('[Supabase] deleteRecurringJournalEntry called with:', id);
    return this.deleteFromSupabase('recurring_journal_entries', id);
  }

  async getRecurringJournalEntriesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRecurringJournalEntriesByOrg called with:', orgId);
    try {
      const url = `${this.baseUrl}/recurring_journal_entries?org_id=eq.${orgId}&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch recurring entries');
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching recurring entries:', error);
      return [];
    }
  }

  async getRecurringJournalEntryById(id: string): Promise<any | null> {
    console.debug('[Supabase] getRecurringJournalEntryById called with:', id);
    try {
      const url = `${this.baseUrl}/recurring_journal_entries?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch recurring entry');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching recurring entry:', error);
      return null;
    }
  }

  // ============================================================================
  // RECURRING INVOICE CRUD
  // ============================================================================
  async createRecurringInvoice(invoice: any): Promise<any> {
    console.debug('[Supabase] createRecurringInvoice called with:', invoice);
    const snake = this.camelToSnake(invoice);
    const filtered = this.filterToTableSchema('recurring_invoices', snake);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('recurring_invoices', filtered);
  }

  async updateRecurringInvoice(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRecurringInvoice called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('recurring_invoices', snake);
    return this.updateInSupabaseRaw('recurring_invoices', id, filtered);
  }

  async deleteRecurringInvoice(id: string): Promise<void> {
    console.debug('[Supabase] deleteRecurringInvoice called with:', id);
    return this.deleteFromSupabase('recurring_invoices', id);
  }

  async getRecurringInvoicesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRecurringInvoicesByOrg called with:', orgId);
    try {
      const url = `${this.baseUrl}/recurring_invoices?org_id=eq.${orgId}&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return [];
        }
        throw new Error('Failed to fetch recurring invoices');
      }
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching recurring invoices:', error);
      return [];
    }
  }

  async getRecurringInvoiceById(id: string): Promise<any | null> {
    console.debug('[Supabase] getRecurringInvoiceById called with:', id);
    try {
      const url = `${this.baseUrl}/recurring_invoices?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch recurring invoice');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching recurring invoice:', error);
      return null;
    }
  }

  /**
   * Vendor CRUD Operations
   */
  async createVendor(vendor: any): Promise<any> {
    console.debug('[Supabase] createVendor called with:', vendor);
    const snakeCaseVendor = this.camelToSnake(vendor);

    // Convert empty strings to null for UUID columns
    if (snakeCaseVendor.ap_account_id === '') snakeCaseVendor.ap_account_id = null;

    const filtered = this.filterToTableSchema('vendors', snakeCaseVendor, true);
    // Remove id if it's undefined, null, or empty string
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('vendors', filtered);
  }

  async updateVendor(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateVendor called with:', id, updates);
    const snake = this.camelToSnake(updates);

    // Convert empty strings to null for UUID columns
    if (snake.ap_account_id === '') snake.ap_account_id = null;

    const filtered = this.filterToTableSchema('vendors', snake);
    return this.updateInSupabaseRaw('vendors', id, filtered);
  }

  async deleteVendor(id: string): Promise<void> {
    console.debug('[Supabase] deleteVendor called with:', id);
    return this.deleteFromSupabase('vendors', id);
  }

  // ============================================================================
  // CHECK VOUCHER CRUD
  // ============================================================================
  async createCheckVoucher(check: any): Promise<any> {
    console.debug('[Supabase] createCheckVoucher called with:', check);
    const snake = this.camelToSnake(check);
    const filtered = this.filterToTableSchema('check_vouchers', snake, true);
    // Remove id if empty - let Supabase auto-generate UUID
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('check_vouchers', filtered);
  }

  async updateCheckVoucher(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateCheckVoucher called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('check_vouchers', snake);
    return this.updateInSupabaseRaw('check_vouchers', id, filtered);
  }

  async deleteCheckVoucher(id: string): Promise<void> {
    console.debug('[Supabase] deleteCheckVoucher called with:', id);
    return this.deleteFromSupabase('check_vouchers', id);
  }

  async getNextCheckNumber(orgId: string, bankAccountId: string): Promise<string> {
    console.debug('[Supabase] getNextCheckNumber called for bank:', bankAccountId);
    try {
      // Get the max check number for this bank account
      const url = `${this.baseUrl}/check_vouchers?org_id=eq.${orgId}&bank_account_id=eq.${bankAccountId}&select=check_number&order=check_number.desc&limit=1`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch check numbers');

      const data = await response.json();
      if (data.length === 0) {
        return '000001'; // Start from 1 if no checks exist
      }

      const lastNumber = data[0].check_number;
      const numericPart = parseInt(lastNumber.replace(/\D/g, '')) || 0;
      return String(numericPart + 1).padStart(6, '0');
    } catch (error) {
      console.error('[Supabase] Error getting next check number:', error);
      return '000001';
    }
  }

  /**
   * ATC Tax Category Lookups
   */
  async getATCCategories(): Promise<any[]> {
    console.debug('[Supabase] getATCCategories called');
    const url = `${this.baseUrl}/atc_categories?order=code.asc`;
    try {
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch ATC categories');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching ATC categories:', error);
      return [];
    }
  }

  async getATCItems(categoryId?: string): Promise<any[]> {
    console.debug('[Supabase] getATCItems called with categoryId:', categoryId);
    const query = categoryId
      ? `?category_id=eq.${categoryId}&order=atc_code.asc`
      : '?order=atc_code.asc';
    const url = `${this.baseUrl}/atc_items${query}`;
    try {
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch ATC items');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching ATC items:', error);
      return [];
    }
  }

  async getATCRates(atcItemId: string): Promise<any[]> {
    console.debug('[Supabase] getATCRates called with atcItemId:', atcItemId);
    const url = `${this.baseUrl}/atc_rates?atc_item_id=eq.${atcItemId}`;
    try {
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch ATC rates');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching ATC rates:', error);
      return [];
    }
  }

  /**
   * Exchange Rate CRUD Operations
   */
  async createExchangeRate(rate: any): Promise<any> {
    console.debug('[Supabase] createExchangeRate called with:', rate);
    const snakeCaseRate = this.camelToSnake(rate);
    const filtered = this.filterToTableSchema('exchange_rates', snakeCaseRate, true);
    if (!filtered.id || filtered.id === '') {
      delete (filtered as any).id;
    }
    return this.insertToSupabaseRaw('exchange_rates', filtered);
  }

  async updateExchangeRate(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateExchangeRate called with:', id, updates);
    const snake = this.camelToSnake(updates);
    const filtered = this.filterToTableSchema('exchange_rates', snake);
    return this.updateInSupabaseRaw('exchange_rates', id, filtered);
  }

  async deleteExchangeRate(id: string): Promise<void> {
    console.debug('[Supabase] deleteExchangeRate called with:', id);
    await this.deleteFromSupabase('exchange_rates', id);
  }

  async getExchangeRatesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getExchangeRatesByOrg called with orgId:', orgId);
    const url = `${this.baseUrl}/exchange_rates?org_id=eq.${orgId}&is_deleted=eq.false&order=effective_date.desc`;
    try {
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching exchange rates:', error);
      return [];
    }
  }

  async getExchangeRateById(id: string): Promise<any | null> {
    console.debug('[Supabase] getExchangeRateById called with:', id);
    try {
      const url = `${this.baseUrl}/exchange_rates?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch exchange rate');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching exchange rate:', error);
      return null;
    }
  }

  // Accounting Period CRUD
  async createAccountingPeriod(period: any): Promise<any> {
    console.debug('[Supabase] createAccountingPeriod called with:', period);
    try {
      const payload = this.camelToSnake(period);
      // Remove id field - let Supabase generate it as UUID
      delete payload.id;
      console.debug('[Supabase] Converted payload (id removed):', payload);
      const url = `${this.baseUrl}/accounting_periods`;
      const headers = {
        ...(await this.getHeaders()),
        'Prefer': 'return=representation'
      };
      console.debug('[Supabase] Posting to:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase] Create failed with status:', response.status, 'Error:', errorText);
        throw new Error(`Failed to create accounting period: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.debug('[Supabase] Create response:', data);
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating accounting period:', error);
      throw error;
    }
  }

  async updateAccountingPeriod(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateAccountingPeriod called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      console.debug('[Supabase] Converted payload:', payload);
      const url = `${this.baseUrl}/accounting_periods?id=eq.${id}`;
      const headers = {
        ...(await this.getHeaders()),
        'Prefer': 'return=representation'
      };
      const response = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase] Update failed with status:', response.status, 'Error:', errorText);
        throw new Error(`Failed to update accounting period: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.debug('[Supabase] Update response:', data);
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating accounting period:', error);
      throw error;
    }
  }

  async deleteAccountingPeriod(id: string): Promise<void> {
    console.debug('[Supabase] deleteAccountingPeriod called with id:', id);
    try {
      const url = `${this.baseUrl}/accounting_periods?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete accounting period');
    } catch (error) {
      console.error('[Supabase] Error deleting accounting period:', error);
      throw error;
    }
  }

  async getAccountingPeriodsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getAccountingPeriodsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/accounting_periods?org_id=eq.${orgId}&is_deleted=eq.false&order=start_date.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch accounting periods');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching accounting periods:', error);
      return [];
    }
  }

  async getAccountingPeriodById(id: string): Promise<any | null> {
    console.debug('[Supabase] getAccountingPeriodById called with:', id);
    try {
      const url = `${this.baseUrl}/accounting_periods?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch accounting period');
      }
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching accounting period:', error);
      return null;
    }
  }

  async getAccountingPeriodsByYear(orgId: string, fiscalYear: number): Promise<any[]> {
    console.debug('[Supabase] getAccountingPeriodsByYear called with orgId:', orgId, 'year:', fiscalYear);
    try {
      const url = `${this.baseUrl}/accounting_periods?org_id=eq.${orgId}&fiscal_year=eq.${fiscalYear}&is_deleted=eq.false&order=period_number.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) throw new Error('Failed to fetch accounting periods by year');
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching accounting periods by year:', error);
      return [];
    }
  }

  // ============================================================================
  // INVENTORY MANAGEMENT CRUD
  // ============================================================================

  // Warehouse Location CRUD
  private async warehouseLocationRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    // The function has verify_jwt disabled at the Supabase gateway and validates
    // the application's HS256 token itself using AT_ERP_JWT_SECRET.
    const tokenToSend = await this.getAuthToken();

    const response = await fetch(`${this.supabaseUrl}/functions/v1/warehouse-locations-write`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenToSend}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        result?.error ||
        result?.message ||
        (typeof result === 'string' ? result : '') ||
        `Warehouse location request failed (${response.status})`;

      if (response.status === 401 && /Invalid or expired application token/i.test(message)) {
        throw new Error('Your application session has expired. Please sign in again.');
      }

      throw new Error(message);
    }

    return result;
  }

  private async listWarehouseLocationsViaEdgeFunction(orgId?: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.listWarehouseLocationsViaRest(orgId);
    }
    try {
      const result = await this.warehouseLocationRequest('list', orgId ? { orgId } : {});
      return this.snakeToCamel(result.locations || []);
    } catch (err) {
      console.warn('[Supabase] warehouse-locations-write edge function unavailable; using REST fallback.', err);
      return this.listWarehouseLocationsViaRest(orgId);
    }
  }

  private async listWarehouseLocationsViaRest(orgId?: string): Promise<any[]> {
    try {
      const url = orgId
        ? `${this.baseUrl}/warehouse_locations?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`
        : `${this.baseUrl}/warehouse_locations?order=created_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) return [];
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch {
      return [];
    }
  }

  async createWarehouseLocation(location: any): Promise<any> {
    console.debug('[Supabase] createWarehouseLocation called with:', location);
    const result = await this.warehouseLocationRequest('create', {
      orgId: location.orgId,
      org_id: location.orgId,
      location,
    });
    return this.snakeToCamel(result.location);
  }

  async updateWarehouseLocation(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateWarehouseLocation called with id:', id);
    const result = await this.warehouseLocationRequest('update', { id, updates });
    return this.snakeToCamel(result.location);
  }

  async deleteWarehouseLocation(id: string): Promise<void> {
    console.debug('[Supabase] deleteWarehouseLocation called with id:', id);
    await this.warehouseLocationRequest('delete', { id });
  }

  async getWarehouseLocationsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getWarehouseLocationsByOrg called with orgId:', orgId);
    return this.listWarehouseLocationsViaEdgeFunction(orgId);
  }

  async getWarehouseLocationById(id: string): Promise<any | null> {
    const locations = await this.listWarehouseLocationsViaEdgeFunction();
    return locations.find(location => location.id === id) || null;
  }

  // Stock Item CRUD
  private async stockItemRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.supabaseUrl}/functions/v1/stock-items-write`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        result?.error ||
        result?.message ||
        `Stock item request failed (${response.status})`
      );
    }
    return result;
  }

  private async listStockItemsViaEdgeFunction(orgId?: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.listStockItemsViaRest(orgId);
    }
    try {
      const result = await this.stockItemRequest('list', orgId ? { orgId } : {});
      return this.snakeToCamel(result.items || []);
    } catch (err) {
      console.warn('[Supabase] stock-items-write edge function unavailable; using REST fallback.', err);
      return this.listStockItemsViaRest(orgId);
    }
  }

  private async listStockItemsViaRest(orgId?: string): Promise<any[]> {
    try {
      const url = orgId
        ? `${this.baseUrl}/stock_items?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`
        : `${this.baseUrl}/stock_items?order=created_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) return [];
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch {
      return [];
    }
  }

  async createStockItem(item: any): Promise<any> {
    console.debug('[Supabase] createStockItem called with:', item);
    const result = await this.stockItemRequest('create', {
      orgId: item.orgId,
      item,
    });
    return this.snakeToCamel(result.item);
  }

  async updateStockItem(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateStockItem called with id:', id);
    const result = await this.stockItemRequest('update', { id, updates });
    return this.snakeToCamel(result.item);
  }

  async deleteStockItem(id: string): Promise<void> {
    console.debug('[Supabase] deleteStockItem called with id:', id);
    await this.stockItemRequest('delete', { id });
  }

  async getStockItemsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getStockItemsByOrg called with orgId:', orgId);
    return this.listStockItemsViaEdgeFunction(orgId);
  }

  async getStockItemById(id: string): Promise<any | null> {
    console.debug('[Supabase] getStockItemById called with id:', id);
    try {
      const url = `${this.baseUrl}/stock_items?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching stock item:', error);
      return null;
    }
  }

  async getStockItemsByLocation(orgId: string, locationId: string): Promise<any[]> {
    console.debug('[Supabase] getStockItemsByLocation called with orgId:', orgId, 'locationId:', locationId);
    try {
      const url = `${this.baseUrl}/stock_items?org_id=eq.${orgId}&warehouse_location_id=eq.${locationId}&is_deleted=eq.false&order=code.asc`;
      const data = await this.fetchAllPages<any>(url);
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock items by location:', error);
      return [];
    }
  }

  // Inventory Level CRUD
  async createInventoryLevel(level: any): Promise<any> {
    console.debug('[Supabase] createInventoryLevel called with:', level);
    try {
      const payload = this.camelToSnake(level);

      // Convert empty strings to null for UUID columns
      if (payload.stock_item_id === '') payload.stock_item_id = null;
      if (payload.warehouse_location_id === '') payload.warehouse_location_id = null;

      delete payload.id;
      const url = `${this.baseUrl}/inventory_levels`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create inventory level: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating inventory level:', error);
      throw error;
    }
  }

  async updateInventoryLevel(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateInventoryLevel called with id:', id);
    try {
      const payload = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (payload.stock_item_id === '') payload.stock_item_id = null;
      if (payload.warehouse_location_id === '') payload.warehouse_location_id = null;

      const url = `${this.baseUrl}/inventory_levels?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update inventory level');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating inventory level:', error);
      throw error;
    }
  }

  async deleteInventoryLevel(id: string): Promise<void> {
    console.debug('[Supabase] deleteInventoryLevel called with id:', id);
    try {
      const url = `${this.baseUrl}/inventory_levels?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting inventory level:', error);
      throw error;
    }
  }

  async getInventoryLevelsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getInventoryLevelsByOrg called with orgId:', orgId);
    return this.listInventoryLevelsViaEdgeFunction(orgId);
  }

  async getInventoryLevelByItemAndLocation(orgId: string, stockItemId: string, locationId: string): Promise<any | null> {
    console.debug('[Supabase] getInventoryLevelByItemAndLocation called');
    try {
      const url = `${this.baseUrl}/inventory_levels?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}&warehouse_location_id=eq.${locationId}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching inventory level:', error);
      return null;
    }
  }

  async getStockStatusView(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getStockStatusView called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/v_inventory_status?org_id=eq.${orgId}&order=stock_status.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching stock status view:', error);
      return [];
    }
  }

  // Inventory Transaction CRUD
  async createInventoryTransaction(transaction: any): Promise<any> {
    console.debug('[Supabase] createInventoryTransaction called with:', transaction);
    try {
      const payload = this.camelToSnake(transaction);

      // Convert empty strings to null for UUID columns
      if (payload.stock_item_id === '') payload.stock_item_id = null;
      if (payload.warehouse_location_id === '') payload.warehouse_location_id = null;

      delete payload.id;
      const url = `${this.baseUrl}/inventory_transactions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create inventory transaction: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating inventory transaction:', error);
      throw error;
    }
  }

  async updateInventoryTransaction(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateInventoryTransaction called with id:', id);
    try {
      const payload = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (payload.stock_item_id === '') payload.stock_item_id = null;
      if (payload.warehouse_location_id === '') payload.warehouse_location_id = null;

      const url = `${this.baseUrl}/inventory_transactions?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update inventory transaction');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating inventory transaction:', error);
      throw error;
    }
  }

  async deleteInventoryTransaction(id: string): Promise<void> {
    console.debug('[Supabase] deleteInventoryTransaction called with id:', id);
    try {
      const url = `${this.baseUrl}/inventory_transactions?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting inventory transaction:', error);
      throw error;
    }
  }

  private async listInventoryTransactionsViaRest(orgId?: string): Promise<any[]> {
    try {
      const url = orgId
        ? `${this.baseUrl}/inventory_transactions?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`
        : `${this.baseUrl}/inventory_transactions?order=created_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) return [];
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch {
      return [];
    }
  }

  async getInventoryTransactionsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getInventoryTransactionsByOrg called with orgId:', orgId);
    if (this.isLocalSupabase()) {
      return this.listInventoryTransactionsViaRest(orgId);
    }
    try {
      return await this.inventoryAccountingRequest<any[]>('list_transactions', { orgId });
    } catch (err) {
      console.warn('[Supabase] inventory-accounting edge function unavailable; using REST fallback for transactions.', err);
      return this.listInventoryTransactionsViaRest(orgId);
    }
  }

  async getInventoryTransactionById(id: string): Promise<any | null> {
    console.debug('[Supabase] getInventoryTransactionById called with id:', id);
    try {
      const url = `${this.baseUrl}/inventory_transactions?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching inventory transaction:', error);
      return null;
    }
  }

  async getInventoryTransactionsByItem(orgId: string, stockItemId: string): Promise<any[]> {
    console.debug('[Supabase] getInventoryTransactionsByItem called with stockItemId:', stockItemId);
    try {
      const url = `${this.baseUrl}/inventory_transactions?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching inventory transactions by item:', error);
      return [];
    }
  }

  // Stock Adjustment CRUD
  private normalizeStockAdjustment(row: any): any {
    const adjustment = this.snakeToCamel(row);
    return {
      ...adjustment,
      quantity: Math.abs(Number(adjustment.quantityChange || 0)),
      isApproved: Boolean(adjustment.approvalDate),
      isReversed: Boolean(adjustment.reversedAt || adjustment.reversalTransactionId),
      adjustmentType: adjustment.adjustmentType || 'ADJUSTMENT',
    };
  }

  private async stockAdjustmentRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.supabaseUrl}/functions/v1/stock-adjustments-write`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || result?.message || `Stock adjustment request failed (${response.status})`);
    }
    return result;
  }

  private async listStockAdjustmentsViaRest(orgId?: string): Promise<any[]> {
    try {
      const url = orgId
        ? `${this.baseUrl}/stock_adjustments?org_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc`
        : `${this.baseUrl}/stock_adjustments?order=created_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) return [];
      const rows = await response.json();
      return (Array.isArray(rows) ? rows : []).map((row: any) => this.normalizeStockAdjustment(row));
    } catch {
      return [];
    }
  }

  private async listStockAdjustmentsViaEdgeFunction(orgId?: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.listStockAdjustmentsViaRest(orgId);
    }
    try {
      const result = await this.stockAdjustmentRequest('list', orgId ? { orgId } : {});
      return (result.adjustments || []).map((row: any) => this.normalizeStockAdjustment(row));
    } catch (err) {
      console.warn('[Supabase] stock-adjustments-write edge function unavailable; using REST fallback.', err);
      return this.listStockAdjustmentsViaRest(orgId);
    }
  }

  private async listInventoryLevelsViaRest(orgId?: string): Promise<any[]> {
    try {
      const url = orgId
        ? `${this.baseUrl}/inventory_levels?org_id=eq.${encodeURIComponent(orgId)}&is_deleted=eq.false&order=updated_at.desc`
        : `${this.baseUrl}/inventory_levels?is_deleted=eq.false&order=updated_at.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) {
        const fallbackUrl = orgId
          ? `${this.baseUrl}/inventory_levels?org_id=eq.${encodeURIComponent(orgId)}&is_deleted=eq.false`
          : `${this.baseUrl}/inventory_levels?is_deleted=eq.false`;
        const fbResp = await fetch(fallbackUrl, { headers: await this.getHeaders() });
        if (!fbResp.ok) return [];
        const rows = await fbResp.json();
        return this.snakeToCamel(Array.isArray(rows) ? rows : []);
      }
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []);
    } catch {
      return [];
    }
  }

  private async listInventoryLevelsViaEdgeFunction(orgId?: string): Promise<any[]> {
    if (this.isLocalSupabase()) {
      return this.listInventoryLevelsViaRest(orgId);
    }
    try {
      const result = await this.stockAdjustmentRequest('list_levels', orgId ? { orgId } : {});
      return this.snakeToCamel(result.levels || []);
    } catch (err) {
      console.warn('[Supabase] stock-adjustments-write edge function unavailable; using REST fallback.', err);
      return this.listInventoryLevelsViaRest(orgId);
    }
  }

  private async inventoryAccountingRequest<T>(
    action: string,
    payload: Record<string, any> = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.supabaseUrl}/functions/v1/inventory-accounting`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body?.error || `Inventory accounting request failed (${response.status})`);
    }
    return this.snakeToCamel(body.result) as T;
  }

  private async getInventoryClassesViaRest(orgId: string): Promise<InventoryClass[]> {
    try {
      const url = `${this.baseUrl}/inventory_classes?org_id=eq.${encodeURIComponent(orgId)}&order=code.asc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) return [];
      const rows = await response.json();
      return this.snakeToCamel(Array.isArray(rows) ? rows : []) as InventoryClass[];
    } catch (error) {
      console.error('[Supabase] Error fetching inventory classes via REST:', error);
      return [];
    }
  }

  async getInventoryClasses(orgId: string): Promise<InventoryClass[]> {
    if (this.isLocalSupabase()) {
      return this.getInventoryClassesViaRest(orgId);
    }
    try {
      return await this.inventoryAccountingRequest<InventoryClass[]>('list_classes', { orgId });
    } catch (err) {
      console.warn('[Supabase] inventory-accounting edge function unavailable; using REST fallback for inventory classes.', err);
      return this.getInventoryClassesViaRest(orgId);
    }
  }

  private async saveInventoryClassViaRest(
    inventoryClass: Partial<InventoryClass> & { orgId: string }
  ): Promise<InventoryClass> {
    const payload = this.camelToSnake(inventoryClass);
    payload.updated_at = new Date().toISOString();
    const headers = { ...(await this.getHeaders()), 'Prefer': 'return=representation' };

    if (inventoryClass.id) {
      const url = `${this.baseUrl}/inventory_classes?id=eq.${encodeURIComponent(inventoryClass.id)}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update inventory class via REST: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data) as InventoryClass;
    } else {
      delete payload.id;
      const url = `${this.baseUrl}/inventory_classes`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create inventory class via REST: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data) as InventoryClass;
    }
  }

  async saveInventoryClass(
    inventoryClass: Partial<InventoryClass> & { orgId: string }
  ): Promise<InventoryClass> {
    try {
      return await this.inventoryAccountingRequest<InventoryClass>('save_class', {
        orgId: inventoryClass.orgId,
        inventoryClass,
      });
    } catch (err) {
      console.warn('[Supabase] inventory-accounting edge function unavailable; using REST fallback for save_class.', err);
      return this.saveInventoryClassViaRest(inventoryClass);
    }
  }

  private async getOpeningInventoryViaRest(orgId: string): Promise<OpeningInventoryDocument[]> {
    try {
      const url = `${this.baseUrl}/opening_inventory_headers?org_id=eq.${encodeURIComponent(orgId)}&order=posting_date.desc`;
      const response = await fetch(url, { headers: await this.getHeaders() });
      if (!response.ok) return [];
      const headers = await response.json();
      const docs = Array.isArray(headers) ? headers : [];

      if (docs.length > 0) {
        const headerIds = docs.map(d => d.id);
        const linesUrl = `${this.baseUrl}/opening_inventory_lines?header_id=in.(${headerIds.join(',')})`;
        const linesResp = await fetch(linesUrl, { headers: await this.getHeaders() });
        const lines = linesResp.ok ? await linesResp.json() : [];
        const linesByHeader = new Map<string, any[]>();
        for (const line of (Array.isArray(lines) ? lines : [])) {
          const list = linesByHeader.get(line.header_id) || [];
          list.push(line);
          linesByHeader.set(line.header_id, list);
        }
        return docs.map(d => ({
          ...this.snakeToCamel(d),
          lines: this.snakeToCamel(linesByHeader.get(d.id) || [])
        })) as OpeningInventoryDocument[];
      }

      return this.snakeToCamel(docs) as OpeningInventoryDocument[];
    } catch (error) {
      console.error('[Supabase] Error fetching opening inventory via REST:', error);
      return [];
    }
  }

  async getOpeningInventory(orgId: string): Promise<OpeningInventoryDocument[]> {
    if (this.isLocalSupabase()) {
      return this.getOpeningInventoryViaRest(orgId);
    }
    try {
      return await this.inventoryAccountingRequest<OpeningInventoryDocument[]>('list_opening', { orgId });
    } catch (err) {
      console.warn('[Supabase] inventory-accounting edge function unavailable; using REST fallback for opening inventory.', err);
      return this.getOpeningInventoryViaRest(orgId);
    }
  }

  async postOpeningInventory(
    document: Partial<OpeningInventoryDocument> & { orgId: string }
  ): Promise<any> {
    return this.inventoryAccountingRequest('post_opening', {
      orgId: document.orgId,
      document,
    });
  }

  async createStockAdjustment(adjustment: any): Promise<any> {
    console.debug('[Supabase] createStockAdjustment called with:', adjustment);
    const result = await this.stockAdjustmentRequest('create', {
      orgId: adjustment.orgId,
      adjustment,
    });
    return this.normalizeStockAdjustment(result.adjustment);
  }

  async updateStockAdjustment(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateStockAdjustment called with id:', id);
    const result = await this.stockAdjustmentRequest('update', { id, updates });
    return this.normalizeStockAdjustment(result.adjustment);
  }

  async deleteStockAdjustment(id: string): Promise<void> {
    console.debug('[Supabase] deleteStockAdjustment called with id:', id);
    await this.stockAdjustmentRequest('delete', { id });
  }

  async reverseStockAdjustment(id: string, reversalDate: string, reason: string): Promise<any> {
    return this.stockAdjustmentRequest('reverse', { id, reversalDate, reason });
  }

  async getStockAdjustmentsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getStockAdjustmentsByOrg called with orgId:', orgId);
    return this.listStockAdjustmentsViaEdgeFunction(orgId);
  }

  async getStockAdjustmentById(id: string): Promise<any | null> {
    console.debug('[Supabase] getStockAdjustmentById called with id:', id);
    const adjustments = await this.listStockAdjustmentsViaEdgeFunction();
    return adjustments.find(adjustment => adjustment.id === id) || null;
  }

  async getStockAdjustmentsByItem(orgId: string, stockItemId: string): Promise<any[]> {
    console.debug('[Supabase] getStockAdjustmentsByItem called with stockItemId:', stockItemId);
    const adjustments = await this.listStockAdjustmentsViaEdgeFunction(orgId);
    return adjustments.filter(adjustment => adjustment.stockItemId === stockItemId);
  }

  // Reorder Point CRUD
  async createReorderPoint(reorder: any): Promise<any> {
    console.debug('[Supabase] createReorderPoint called with:', reorder);
    try {
      const payload = this.camelToSnake(reorder);

      // Convert empty strings to null for UUID columns
      if (payload.stock_item_id === '') payload.stock_item_id = null;

      delete payload.id;
      const url = `${this.baseUrl}/reorder_points`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create reorder point: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating reorder point:', error);
      throw error;
    }
  }

  async updateReorderPoint(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateReorderPoint called with id:', id);
    try {
      const payload = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (payload.stock_item_id === '') payload.stock_item_id = null;

      const url = `${this.baseUrl}/reorder_points?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to update reorder point');
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating reorder point:', error);
      throw error;
    }
  }

  async deleteReorderPoint(id: string): Promise<void> {
    console.debug('[Supabase] deleteReorderPoint called with id:', id);
    try {
      const url = `${this.baseUrl}/reorder_points?id=eq.${id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
    } catch (error) {
      console.error('[Supabase] Error deleting reorder point:', error);
      throw error;
    }
  }

  async getReorderPointsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getReorderPointsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/reorder_points?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching reorder points:', error);
      return [];
    }
  }

  async getReorderPointByItem(orgId: string, stockItemId: string): Promise<any | null> {
    console.debug('[Supabase] getReorderPointByItem called with stockItemId:', stockItemId);
    try {
      const url = `${this.baseUrl}/reorder_points?org_id=eq.${orgId}&stock_item_id=eq.${stockItemId}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching reorder point:', error);
      return null;
    }
  }

  async getItemsNeedingReorder(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getItemsNeedingReorder called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/stock_items?org_id=eq.${orgId}&is_deleted=eq.false&order=code.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      // Note: Actual filtering logic should be in the service layer
      // This returns stock items; filter by comparing inventory vs reorder points in code
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching items needing reorder:', error);
      return [];
    }
  }

  // ============================================
  // Revenue Schedule CRUD (Deferred Revenue)
  // ============================================

  async createRevenueSchedule(schedule: any): Promise<any> {
    console.debug('[Supabase] createRevenueSchedule called');
    try {
      const snakeSchedule = this.camelToSnake(schedule);

      // Convert empty strings to null for UUID columns
      if (snakeSchedule.customer_id === '') snakeSchedule.customer_id = null;
      if (snakeSchedule.invoice_id === '') snakeSchedule.invoice_id = null;
      if (snakeSchedule.gl_account_id === '') snakeSchedule.gl_account_id = null;

      const url = `${this.baseUrl}/revenue_schedules`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeSchedule)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create revenue schedule: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error creating revenue schedule:', error);
      throw error;
    }
  }

  async updateRevenueSchedule(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRevenueSchedule called with id:', id);
    try {
      const snakeUpdates = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (snakeUpdates.customer_id === '') snakeUpdates.customer_id = null;
      if (snakeUpdates.invoice_id === '') snakeUpdates.invoice_id = null;
      if (snakeUpdates.gl_account_id === '') snakeUpdates.gl_account_id = null;

      const url = `${this.baseUrl}/revenue_schedules?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeUpdates)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update revenue schedule: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error updating revenue schedule:', error);
      throw error;
    }
  }

  async deleteRevenueSchedule(id: string): Promise<void> {
    console.debug('[Supabase] deleteRevenueSchedule called with id:', id);
    try {
      const url = `${this.baseUrl}/revenue_schedules?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete revenue schedule: ${errorText}`);
      }
    } catch (error) {
      console.error('[Supabase] Error deleting revenue schedule:', error);
      throw error;
    }
  }

  async getRevenueSchedulesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueSchedulesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/revenue_schedules?org_id=eq.${orgId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue schedules:', error);
      return [];
    }
  }

  async getRevenueScheduleById(id: string): Promise<any | null> {
    console.debug('[Supabase] getRevenueScheduleById called with id:', id);
    try {
      const url = `${this.baseUrl}/revenue_schedules?id=eq.${id}&is_deleted=eq.false`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching revenue schedule by id:', error);
      return null;
    }
  }

  async getRevenueSchedulesByCustomer(orgId: string, customerId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueSchedulesByCustomer called');
    try {
      const url = `${this.baseUrl}/revenue_schedules?org_id=eq.${orgId}&customer_id=eq.${customerId}&is_deleted=eq.false&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue schedules by customer:', error);
      return [];
    }
  }

  // ============================================
  // Revenue Recognition Entry CRUD
  // ============================================

  async createRevenueRecognitionEntry(entry: any): Promise<any> {
    console.debug('[Supabase] createRevenueRecognitionEntry called');
    try {
      const snakeEntry = this.camelToSnake(entry);

      // Convert empty strings to null for UUID columns
      if (snakeEntry.schedule_id === '') snakeEntry.schedule_id = null;
      if (snakeEntry.journal_entry_id === '') snakeEntry.journal_entry_id = null;

      const url = `${this.baseUrl}/revenue_recognition_entries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeEntry)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create revenue recognition entry: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error creating revenue recognition entry:', error);
      throw error;
    }
  }

  async updateRevenueRecognitionEntry(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRevenueRecognitionEntry called with id:', id);
    try {
      const snakeUpdates = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (snakeUpdates.schedule_id === '') snakeUpdates.schedule_id = null;
      if (snakeUpdates.journal_entry_id === '') snakeUpdates.journal_entry_id = null;

      const url = `${this.baseUrl}/revenue_recognition_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(snakeUpdates)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update revenue recognition entry: ${errorText}`);
      }
      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error updating revenue recognition entry:', error);
      throw error;
    }
  }

  async deleteRevenueRecognitionEntry(id: string): Promise<void> {
    console.debug('[Supabase] deleteRevenueRecognitionEntry called with id:', id);
    try {
      const url = `${this.baseUrl}/revenue_recognition_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: (await this.getHeaders())
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete revenue recognition entry: ${errorText}`);
      }
    } catch (error) {
      console.error('[Supabase] Error deleting revenue recognition entry:', error);
      throw error;
    }
  }

  async getRevenueRecognitionEntriesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueRecognitionEntriesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/revenue_recognition_entries?org_id=eq.${orgId}&order=recognition_date.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue recognition entries:', error);
      return [];
    }
  }

  async getRevenueRecognitionEntriesBySchedule(scheduleId: string): Promise<any[]> {
    console.debug('[Supabase] getRevenueRecognitionEntriesBySchedule called with scheduleId:', scheduleId);
    try {
      const url = `${this.baseUrl}/revenue_recognition_entries?schedule_id=eq.${scheduleId}&order=recognition_date.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching revenue recognition entries by schedule:', error);
      return [];
    }
  }

  // ============================================================================
  // PAYROLL RUN CRUD
  // ============================================================================

  async createPayrollRun(run: any): Promise<any> {
    console.debug('[Supabase] createPayrollRun called with:', run);
    try {
      const payload = this.camelToSnake(run);

      // Convert empty strings to null for UUID columns
      if (payload.period_id === '') payload.period_id = null;

      delete payload.id;
      const url = `${this.baseUrl}/payroll_runs`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create payroll run: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating payroll run:', error);
      throw error;
    }
  }

  async updatePayrollRun(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updatePayrollRun called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (payload.period_id === '') payload.period_id = null;

      const url = `${this.baseUrl}/payroll_runs?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update payroll run: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating payroll run:', error);
      throw error;
    }
  }

  async deletePayrollRun(id: string): Promise<void> {
    console.debug('[Supabase] deletePayrollRun called with id:', id);
    try {
      const url = `${this.baseUrl}/payroll_runs?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete payroll run');
    } catch (error) {
      console.error('[Supabase] Error deleting payroll run:', error);
      throw error;
    }
  }

  async getPayrollRunsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getPayrollRunsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/payroll_runs?org_id=eq.${orgId}&is_deleted=eq.false&order=run_date.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching payroll runs:', error);
      return [];
    }
  }

  async getPayrollRunById(id: string): Promise<any | null> {
    console.debug('[Supabase] getPayrollRunById called with id:', id);
    try {
      const url = `${this.baseUrl}/payroll_runs?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching payroll run:', error);
      return null;
    }
  }

  // ============================================================================
  // PAYROLL LINE CRUD
  // ============================================================================

  async createPayrollLine(line: any): Promise<any> {
    console.debug('[Supabase] createPayrollLine called with:', line);
    try {
      const payload = this.camelToSnake(line);
      delete payload.id;
      const url = `${this.baseUrl}/payroll_lines`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create payroll line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating payroll line:', error);
      throw error;
    }
  }

  async updatePayrollLine(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updatePayrollLine called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/payroll_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update payroll line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating payroll line:', error);
      throw error;
    }
  }

  async deletePayrollLine(id: string): Promise<void> {
    console.debug('[Supabase] deletePayrollLine called with id:', id);
    try {
      const url = `${this.baseUrl}/payroll_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: (await this.getHeaders())
      });
      if (!response.ok) throw new Error('Failed to delete payroll line');
    } catch (error) {
      console.error('[Supabase] Error deleting payroll line:', error);
      throw error;
    }
  }

  async getPayrollLinesByRun(runId: string): Promise<any[]> {
    console.debug('[Supabase] getPayrollLinesByRun called with runId:', runId);
    try {
      const url = `${this.baseUrl}/payroll_lines?run_id=eq.${runId}&order=employee_id.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching payroll lines:', error);
      return [];
    }
  }

  async getPayrollLinesByEmployee(employeeId: string): Promise<any[]> {
    console.debug('[Supabase] getPayrollLinesByEmployee called with employeeId:', employeeId);
    try {
      const url = `${this.baseUrl}/payroll_lines?employee_id=eq.${employeeId}&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching payroll lines by employee:', error);
      return [];
    }
  }

  // ============================================================================
  // EMPLOYEE CRUD
  // ============================================================================

  async createEmployee(employee: any): Promise<any> {
    console.debug('[Supabase] createEmployee called with:', employee);
    try {
      const payload = this.camelToSnake(employee);
      delete payload.id;
      const url = `${this.baseUrl}/employees`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create employee: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating employee:', error);
      throw error;
    }
  }

  async updateEmployee(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateEmployee called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/employees?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update employee: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating employee:', error);
      throw error;
    }
  }

  async deleteEmployee(id: string): Promise<void> {
    console.debug('[Supabase] deleteEmployee called with id:', id);
    try {
      const url = `${this.baseUrl}/employees?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete employee');
    } catch (error) {
      console.error('[Supabase] Error deleting employee:', error);
      throw error;
    }
  }

  async getEmployeesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getEmployeesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/employees?org_id=eq.${orgId}&is_deleted=eq.false&order=last_name.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching employees:', error);
      return [];
    }
  }

  async getEmployeeById(id: string): Promise<any | null> {
    console.debug('[Supabase] getEmployeeById called with id:', id);
    try {
      const url = `${this.baseUrl}/employees?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching employee:', error);
      return null;
    }
  }

  // ============================================================================
  // CHART OF ACCOUNT CRUD
  // ============================================================================

  async createAccount(account: any): Promise<any> {
    console.debug('[Supabase] createAccount called with:', account);
    try {
      const payload = this.camelToSnake(account);

      // Convert empty strings to null for UUID columns
      if (payload.class_id === '') payload.class_id = null;
      if (payload.parent_id === '') payload.parent_id = null;

      delete payload.id;
      const url = `${this.baseUrl}/chart_of_accounts`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create account: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating account:', error);
      throw error;
    }
  }

  async updateAccount(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateAccount called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (payload.class_id === '') payload.class_id = null;
      if (payload.parent_id === '') payload.parent_id = null;

      const url = `${this.baseUrl}/chart_of_accounts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update account: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating account:', error);
      throw error;
    }
  }

  async deleteAccount(id: string): Promise<void> {
    console.debug('[Supabase] deleteAccount called with id:', id);
    try {
      const url = `${this.baseUrl}/chart_of_accounts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete account');
    } catch (error) {
      console.error('[Supabase] Error deleting account:', error);
      throw error;
    }
  }

  async getAccountsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getAccountsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/chart_of_accounts?org_id=eq.${orgId}&is_deleted=eq.false&order=code.asc`;
      const data = await this.fetchAllPagesWithSoftDeleteFallback<any>(url, 'chart_of_accounts');
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching accounts:', error);
      throw error;
    }
  }

  async getAccountById(id: string): Promise<any | null> {
    console.debug('[Supabase] getAccountById called with id:', id);
    try {
      const url = `${this.baseUrl}/chart_of_accounts?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching account:', error);
      return null;
    }
  }

  // ============================================================================
  // JOURNAL ENTRY CRUD
  // ============================================================================

  async createJournalEntry(entry: any): Promise<any> {
    console.debug('[Supabase] createJournalEntry called with:', entry);
    try {
      const snakeEntry = this.camelToSnake(entry);
      if (!snakeEntry.approved_by && snakeEntry.posted_by) snakeEntry.approved_by = snakeEntry.posted_by;
      if (!snakeEntry.approved_at && snakeEntry.posted_at) snakeEntry.approved_at = snakeEntry.posted_at;
      const payload = this.filterToTableSchema(
        'journal_entries',
        snakeEntry
      );

      // Convert empty strings or non-UUID values to null for UUID columns
      if (payload.period_id === '' || (payload.period_id && !this.isUuid(payload.period_id))) payload.period_id = null;
      if (payload.source_ref === '' || (payload.source_ref && !this.isUuid(payload.source_ref))) payload.source_ref = null;
      if (payload.created_by === '' || (payload.created_by && !this.isUuid(payload.created_by))) payload.created_by = null;
      if (payload.approved_by === '' || (payload.approved_by && !this.isUuid(payload.approved_by))) payload.approved_by = null;
      if (payload.deposit_id === '' || (payload.deposit_id && !this.isUuid(payload.deposit_id))) payload.deposit_id = null;
      if (payload.original_entry_id === '' || (payload.original_entry_id && !this.isUuid(payload.original_entry_id))) payload.original_entry_id = null;
      // Normalize app-specific statuses/types to DB constraints
      if (payload.source_type === 'JOURNAL') payload.source_type = 'MANUAL';
      if (payload.source_type === 'NON_INVOICE_PAYMENT') payload.source_type = 'INVOICE';

      delete payload.id;
      const url = `${this.baseUrl}/journal_entries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create journal entry: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating journal entry:', error);
      throw error;
    }
  }

  async updateJournalEntry(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateJournalEntry called with id:', id, 'updates:', updates);
    try {
      const snakeUpdates = this.camelToSnake(updates);
      if (!snakeUpdates.approved_by && snakeUpdates.posted_by) snakeUpdates.approved_by = snakeUpdates.posted_by;
      if (!snakeUpdates.approved_at && snakeUpdates.posted_at) snakeUpdates.approved_at = snakeUpdates.posted_at;
      const payload = this.filterToTableSchema(
        'journal_entries',
        snakeUpdates
      );

      // Convert empty strings or non-UUID values to null for UUID columns
      if (payload.period_id === '' || (payload.period_id && !this.isUuid(payload.period_id))) payload.period_id = null;
      if (payload.source_ref === '' || (payload.source_ref && !this.isUuid(payload.source_ref))) payload.source_ref = null;
      if (payload.created_by === '' || (payload.created_by && !this.isUuid(payload.created_by))) payload.created_by = null;
      if (payload.approved_by === '' || (payload.approved_by && !this.isUuid(payload.approved_by))) payload.approved_by = null;
      if (payload.deposit_id === '' || (payload.deposit_id && !this.isUuid(payload.deposit_id))) payload.deposit_id = null;
      if (payload.original_entry_id === '' || (payload.original_entry_id && !this.isUuid(payload.original_entry_id))) payload.original_entry_id = null;
      // Normalize app-specific statuses/types to DB constraints
      if (payload.source_type === 'JOURNAL') payload.source_type = 'MANUAL';
      if (payload.source_type === 'NON_INVOICE_PAYMENT') payload.source_type = 'INVOICE';

      const url = `${this.baseUrl}/journal_entries?id=eq.${id}`;
      let response: Response;
      for (let attempt = 0; attempt < 8; attempt++) {
        response = await fetch(url, {
          method: 'PATCH',
          headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
          body: JSON.stringify(payload)
        });
        if (response.ok) break;

        const errorText = await response.text();
        const missingColumn = this.extractMissingColumnFromSchemaError(errorText);
        if (response.status === 400 && missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          console.warn(`[Supabase] updateJournalEntry retrying without unknown column '${missingColumn}'`);
          delete payload[missingColumn];
          continue;
        }
        throw new Error(`Failed to update journal entry: ${response.status} - ${errorText}`);
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update journal entry: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating journal entry:', error);
      throw error;
    }
  }

  async reverseJournalEntry(entryId: string): Promise<any> {
    console.debug('[Supabase] reverseJournalEntry called with id:', entryId);
    try {
      const url = `${this.baseUrl}/rpc/reverse_journal_entry`;
      const response = await fetch(url, {
        method: 'POST',
        // This RPC is granted to anon/authenticated and runs as SECURITY DEFINER.
        // Using the app's custom AT-ERP JWT here causes Supabase to reject the token
        // before the RPC executes, so call it with the standard Supabase credentials.
        headers: await this.getHeaders(),
        body: JSON.stringify({ p_entry_id: entryId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const rpcMissing =
          errorText.includes('PGRST202') ||
          errorText.includes('Could not find the function public.reverse_journal_entry') ||
          errorText.includes('reverse_journal_entry');

        if (rpcMissing) {
          throw new Error('Journal reversal RPC is missing. Run supabase/migrations/20260417_reverse_journal_entry.sql first.');
        }

        let message = `Failed to reverse journal entry: ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          message = parsed.message || parsed.error || parsed.details || message;
        } catch {
          if (errorText.trim()) {
            message = errorText;
          }
        }

        throw new Error(message);
      }

      const data = await response.json();
      return this.snakeToCamel(Array.isArray(data) ? data[0] : data);
    } catch (error) {
      console.error('[Supabase] Error reversing journal entry:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('column "source_ref" is of type uuid') || message.includes('Journal reversal RPC is missing')) {
        console.warn('[Supabase] Falling back to REST journal reversal.');
        return this.reverseJournalEntryViaRest(entryId);
      }
      throw error;
    }
  }

  private async reverseJournalEntryViaRest(entryId: string): Promise<any> {
    const original = await this.getJournalEntryById(entryId);
    if (!original) throw new Error('Journal entry not found.');
    if (String(original.status || '').toUpperCase() !== 'POSTED') {
      throw new Error('Only posted journal entries can be reversed.');
    }
    if (original.originalEntryId || String(original.sourceType || '').toUpperCase() === 'REVERSAL') {
      throw new Error('This journal entry is already a reversal and cannot be reversed again.');
    }

    const originalLines = await this.getJournalLinesByEntry(entryId);
    if (originalLines.length === 0) {
      throw new Error(`Journal entry ${entryId} has no lines to reverse.`);
    }

    const allEntries = await this.getJournalEntriesByOrg(original.orgId);
    const nextSequence = allEntries.reduce((max, entry) => {
      const ref = String(entry.glEntryNumber || entry.reference || '').trim().toUpperCase();
      const match = ref.match(/^GL(?:\s*NO\.?)?[\s-]*(\d+)$/);
      return match ? Math.max(max, Number(match[1] || 0)) : max;
    }, 0) + 1;
    const newGl = `GL${String(nextSequence).padStart(8, '0')}`;
    const now = new Date().toISOString();

    const reversalEntry = await this.createJournalEntry({
      orgId: original.orgId,
      periodId: original.periodId || null,
      date: new Date().toISOString().split('T')[0],
      description: `Reversal: ${original.description || original.glEntryNumber || original.reference || original.id}`,
      reference: newGl,
      glEntryNumber: newGl,
      status: 'POSTED',
      createdBy: original.createdBy,
      createdAt: now,
      sourceType: 'REVERSAL',
      sourceRef: entryId,
      reversedAt: now,
      reversalReason: `Auto-generated reversal for ${original.glEntryNumber || original.reference || original.id}`,
      originalEntryId: entryId
    });

    await this.createJournalLines(originalLines.map((line: any) => ({
      orgId: line.orgId || original.orgId,
      journalEntryId: reversalEntry.id,
      accountId: line.accountId,
      debit: Number(line.credit || 0),
      credit: Number(line.debit || 0),
      memo: line.memo,
      description: line.description,
      contactId: line.contactId,
      contactType: line.contactType,
      batchId: line.batchId,
      itemId: line.itemId,
      assetId: line.assetId,
      isCleared: line.isCleared
    })));

    await this.updateJournalEntry(entryId, {
      status: 'REVERSED',
      reversedAt: now,
      reversalReason: `Auto-generated reversal for ${original.glEntryNumber || original.reference || original.id}`
    });

    return reversalEntry;
  }

  async deleteJournalEntry(id: string): Promise<void> {
    console.debug('[Supabase] deleteJournalEntry called with id:', id);
    try {
      // Strict audit guard: Prevent deletion of POSTED journal entries
      const checkUrl = `${this.baseUrl}/journal_entries?id=eq.${id}&select=id,status,reference`;
      const checkRes = await fetch(checkUrl, {
        headers: (await this.getHeaders())
      });
      if (checkRes.ok) {
        const entries = await checkRes.json();
        const entry = entries?.[0];
        if (entry && entry.status === 'POSTED') {
          throw new Error(`Cannot delete posted journal entry (${entry.reference || id}). Under GAAP, IFRS, and BIR audit compliance rules, posted transactions cannot be deleted. Please post a reversal entry instead.`);
        }
      }

      const url = `${this.baseUrl}/journal_entries?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete journal entry');
    } catch (error) {
      console.error('[Supabase] Error deleting journal entry:', error);
      throw error;
    }
  }

  async getJournalEntriesByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getJournalEntriesByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/journal_entries?org_id=eq.${orgId}&is_deleted=eq.false&order=date.desc`;
      const data = await this.fetchAllPagesWithSoftDeleteFallback<any>(url, 'journal_entries');
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching journal entries:', error);
      throw error;
    }
  }

  async getJournalEntryById(id: string): Promise<any | null> {
    console.debug('[Supabase] getJournalEntryById called with id:', id);
    try {
      const url = `${this.baseUrl}/journal_entries?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching journal entry:', error);
      return null;
    }
  }

  // ============================================================================
  // JOURNAL VOUCHERS (the only manual journal source)
  // ============================================================================

  private async journalVoucherRequest(action: string, payload: Record<string, any> = {}): Promise<any> {
    const token = await this.getAuthToken();
    const response = await fetch(`${this.supabaseUrl}/functions/v1/journal-vouchers`, {
      method: 'POST',
      headers: {
        'apikey': this.supabaseKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your application session has expired. Please sign in again.');
      throw new Error(result?.error || result?.message || `Journal voucher request failed (${response.status})`);
    }
    return result;
  }

  async getJournalVouchersByOrg(orgId: string): Promise<JournalVoucher[]> {
    const result = await this.journalVoucherRequest('list', { orgId });
    return this.snakeToCamel(result.vouchers || []) as JournalVoucher[];
  }

  async getJournalVoucherLines(voucherId: string): Promise<JournalVoucherLine[]> {
    const result = await this.journalVoucherRequest('lines', { id: voucherId });
    return this.snakeToCamel(result.lines || []) as JournalVoucherLine[];
  }

  async createJournalVoucher(voucher: Omit<JournalVoucher, 'id' | 'jvNumber' | 'createdAt'>): Promise<JournalVoucher> {
    const payload = this.camelToSnake(voucher);
    delete payload.id;
    delete payload.jv_number;
    delete payload.gl_reference;
    delete payload.posted_by;
    delete payload.posted_at;
    delete payload.created_at;
    delete payload.updated_at;
    const result = await this.journalVoucherRequest('create', { voucher: payload });
    return this.snakeToCamel(result.voucher) as JournalVoucher;
  }

  async updateJournalVoucher(id: string, updates: Partial<JournalVoucher>): Promise<JournalVoucher> {
    const payload = this.camelToSnake(updates);
    for (const locked of ['id', 'org_id', 'jv_number', 'status', 'gl_reference', 'posted_by', 'posted_at', 'created_at']) {
      delete payload[locked];
    }
    const result = await this.journalVoucherRequest('update', { id, updates: payload });
    return this.snakeToCamel(result.voucher) as JournalVoucher;
  }

  async replaceJournalVoucherLines(
    voucherId: string,
    lines: Omit<JournalVoucherLine, 'id' | 'journalVoucherId'>[]
  ): Promise<JournalVoucherLine[]> {
    const result = await this.journalVoucherRequest('replace_lines', {
      id: voucherId,
      lines: lines.map(line => this.camelToSnake(line))
    });
    return this.snakeToCamel(result.lines || []) as JournalVoucherLine[];
  }

  async deleteJournalVoucher(id: string): Promise<void> {
    await this.journalVoucherRequest('delete', { id });
  }

  async postJournalVoucher(id: string, postedBy: string): Promise<JournalVoucher> {
    const result = await this.journalVoucherRequest('post', { id, postedBy });
    return this.snakeToCamel(result.voucher) as JournalVoucher;
  }

  // ============================================================================
  // JOURNAL ENTRY LINE CRUD
  // ============================================================================

  async createJournalLine(line: any): Promise<any> {
    console.debug('[Supabase] createJournalLine called with:', line);
    try {
      const payload = this.camelToSnake(line);

      // Convert empty strings to null for UUID columns
      if (payload.journal_entry_id === '') payload.journal_entry_id = null;
      if (payload.account_id === '') payload.account_id = null;
      if (payload.contact_id === '') payload.contact_id = null;
      if (payload.batch_id === '') payload.batch_id = null;
      if (payload.item_id === '') payload.item_id = null;
      if (payload.asset_id === '') payload.asset_id = null;

      delete payload.id;
      const url = `${this.baseUrl}/journal_lines`;
      let response: Response;
      for (let attempt = 0; attempt < 6; attempt++) {
        response = await fetch(url, {
          method: 'POST',
          headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
          body: JSON.stringify(payload)
        });
        if (response.ok) break;

        const errorText = await response.text();
        const missingColumn = this.extractMissingColumnFromSchemaError(errorText);
        if (response.status === 400 && missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          console.warn(`[Supabase] createJournalLine retrying without unknown column '${missingColumn}'`);
          delete payload[missingColumn];
          continue;
        }
        throw new Error(`Failed to create journal line: ${response.status} - ${errorText}`);
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create journal line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating journal line:', error);
      throw error;
    }
  }

  async createJournalLines(lines: any[]): Promise<any[]> {
    console.debug('[Supabase] createJournalLines called with:', lines.length, 'lines');
    console.debug('[Supabase] Sample input line:', JSON.stringify(lines[0]));
    try {
      // Define only the columns that exist in the actual database table
      // Supabase bulk insert requires all objects to have the same keys (PGRST102 error)
      const allKeys = [
        'journal_entry_id', 'account_id', 'debit', 'credit', 'memo', 'description',
        'contact_id', 'contact_type', 'batch_id', 'item_id', 'asset_id', 'is_cleared',
        'classification_code', 'tax_category_id'
      ];
      const uuidKeys = ['journal_entry_id', 'account_id', 'contact_id', 'batch_id', 'item_id', 'asset_id', 'tax_category_id'];

      const payloads = lines.map(line => {
        const payload = this.camelToSnake(line);

        // Only include columns that exist in the database
        const normalizedPayload: any = {};
        for (const key of allKeys) {
          normalizedPayload[key] = (payload[key] !== undefined && payload[key] !== '') ? payload[key] : null;
          if (uuidKeys.includes(key) && normalizedPayload[key] && !this.isUuid(normalizedPayload[key])) {
            normalizedPayload[key] = null;
          }
        }
        return normalizedPayload;
      });
      console.debug('[Supabase] Sample payload to send:', JSON.stringify(payloads[0]));

      const url = `${this.baseUrl}/journal_lines`;
      let response: Response;
      let sendPayloads = payloads;
      for (let attempt = 0; attempt < 8; attempt++) {
        response = await fetch(url, {
          method: 'POST',
          headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
          body: JSON.stringify(sendPayloads)
        });
        if (response.ok) break;

        const errorText = await response.text();
        const missingColumn = this.extractMissingColumnFromSchemaError(errorText);
        if (response.status === 400 && missingColumn) {
          console.warn(`[Supabase] createJournalLines retrying without unknown column '${missingColumn}'`);
          sendPayloads = sendPayloads.map((p: any) => {
            const next = { ...p };
            delete next[missingColumn];
            return next;
          });
          continue;
        }

        console.error('[Supabase] createJournalLines failed:', response.status, errorText);
        throw new Error(`Failed to create journal lines: ${response.status} - ${errorText}`);
      }
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase] createJournalLines failed:', response.status, errorText);
        throw new Error(`Failed to create journal lines: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.debug('[Supabase] createJournalLines response:', JSON.stringify(data[0] || data));
      const result = Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [this.snakeToCamel(data)];
      console.debug('[Supabase] createJournalLines converted result sample:', JSON.stringify(result[0]));
      return result;
    } catch (error) {
      console.error('[Supabase] Error creating journal lines:', error);
      throw error;
    }
  }

  async updateJournalLine(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateJournalLine called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);

      // Convert empty strings to null for UUID columns
      if (payload.journal_entry_id === '') payload.journal_entry_id = null;
      if (payload.account_id === '') payload.account_id = null;
      if (payload.contact_id === '') payload.contact_id = null;
      if (payload.batch_id === '') payload.batch_id = null;
      if (payload.item_id === '') payload.item_id = null;
      if (payload.asset_id === '') payload.asset_id = null;

      const url = `${this.baseUrl}/journal_lines?id=eq.${id}`;
      let response: Response;
      for (let attempt = 0; attempt < 8; attempt++) {
        response = await fetch(url, {
          method: 'PATCH',
          headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
          body: JSON.stringify(payload)
        });
        if (response.ok) break;

        const errorText = await response.text();
        const missingColumn = this.extractMissingColumnFromSchemaError(errorText);
        if (response.status === 400 && missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
          console.warn(`[Supabase] updateJournalLine retrying without unknown column '${missingColumn}'`);
          delete payload[missingColumn];
          continue;
        }
        throw new Error(`Failed to update journal line: ${response.status} - ${errorText}`);
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update journal line: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating journal line:', error);
      throw error;
    }
  }

  async deleteJournalLine(id: string): Promise<void> {
    console.debug('[Supabase] deleteJournalLine called with id:', id);
    try {
      const url = `${this.baseUrl}/journal_lines?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: (await this.getHeaders())
      });
      if (!response.ok) throw new Error('Failed to delete journal line');
    } catch (error) {
      console.error('[Supabase] Error deleting journal line:', error);
      throw error;
    }
  }

  async getJournalLinesByEntry(entryId: string): Promise<any[]> {
    console.debug('[Supabase] getJournalLinesByEntry called with entryId:', entryId);
    try {
      const url = `${this.baseUrl}/journal_lines?journal_entry_id=eq.${entryId}&order=id.asc`;
      const data = await this.fetchAllPages<any>(url);
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching journal lines:', error);
      throw error;
    }
  }

  // ============================================================================
  // AUDIT LOG CRUD
  // ============================================================================

  async createAuditLog(log: any): Promise<any> {
    console.debug('[Supabase] createAuditLog called with:', log);
    try {
      const payload = this.camelToSnake(log);
      delete payload.id;
      const url = `${this.baseUrl}/audit_logs`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create audit log: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating audit log:', error);
      throw error;
    }
  }

  async getAuditLogsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getAuditLogsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/audit_logs?org_id=eq.${orgId}&order=timestamp.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching audit logs:', error);
      return [];
    }
  }

  // ============================================================================
  // FEEDBACK TICKET CRUD
  // ============================================================================

  async createFeedbackTicket(ticket: FeedbackTicket): Promise<FeedbackTicket> {
    return this.callFeedbackTicketsFunction<FeedbackTicket>('create', { ticket });
  }

  async updateFeedbackTicket(id: string, updates: Partial<FeedbackTicket>): Promise<FeedbackTicket> {
    return this.callFeedbackTicketsFunction<FeedbackTicket>('update', { id, updates });
  }

  async getFeedbackTickets(context?: { orgId?: string; isSystemAdmin?: boolean; userId?: string }): Promise<FeedbackTicket[]> {
    if (this.isLocalSupabase()) {
      return this.getFeedbackTicketsViaLocalRest(context);
    }

    try {
      return await this.callFeedbackTicketsFunction<FeedbackTicket[]>('list', context || {});
    } catch (error) {
      if (this.isLocalSupabase() && this.isRecoverableFeedbackTicketsAuthConfigError(error)) {
        console.warn(
          '[SupabaseDataService] feedback-tickets edge function auth is not fully configured locally; using local REST fallback for ticket listing.',
          error
        );
        return this.getFeedbackTicketsViaLocalRest(context);
      }
      if (this.isRecoverableFeedbackTicketsFunctionError(error)) {
        console.warn(
          '[SupabaseDataService] feedback-tickets edge function is unavailable; showing no feedback tickets until it is deployed/reachable.',
          error
        );
        return [];
      }
      throw error;
    }
  }

  private isLocalSupabase(): boolean {
    return this.supabaseUrl.startsWith('http://127.0.0.1:') || this.supabaseUrl.startsWith('http://localhost:');
  }

  private async getFeedbackTicketsViaLocalRest(context?: { orgId?: string; isSystemAdmin?: boolean; userId?: string }): Promise<FeedbackTicket[]> {
    const url = new URL(`${this.baseUrl}/feedback_tickets`);
    url.searchParams.set(
      'select',
      'id,org_id,title,description,screenshot_data_url,screenshot_name,status,priority,created_by,created_by_name,created_by_role,assigned_to,admin_notes,resolved_at,created_at,updated_at,is_deleted,deleted_at,deleted_by'
    );
    url.searchParams.set('is_deleted', 'eq.false');
    url.searchParams.set('order', 'created_at.desc');

    if (!context?.isSystemAdmin) {
      if (context?.orgId) {
        url.searchParams.set('org_id', `eq.${context.orgId}`);
      }
      if (context?.userId) {
        url.searchParams.set('created_by', `eq.${context.userId}`);
      }
    }

    const response = await fetch(url.toString(), { headers: await this.getHeaders() });
    if (!response.ok) {
      throw new Error(`Local feedback tickets REST fallback failed: ${response.status} ${await response.text()}`);
    }

    return this.snakeToCamel(await response.json()) as FeedbackTicket[];
  }

  private async callFeedbackTicketsFunction<T>(action: string, payload: any): Promise<T> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    try {
      const token = await this.getAuthToken();
      const url = `${this.supabaseUrl}/functions/v1/feedback-tickets`;
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...payload })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Feedback tickets function failed: ${response.status} - ${this.parseEdgeFunctionError(errorBody)}`);
      }

      const data = await response.json();
      if (data?.error) {
        throw new Error(`Feedback tickets function failed: ${data.error}`);
      }
      return data.result as T;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(
          `Feedback tickets function is unreachable. Deploy supabase/functions/feedback-tickets and confirm VITE_SUPABASE_URL points to the active Supabase project. Original error: ${error.message}`
        );
      }
      throw error;
    }
  }

  private parseEdgeFunctionError(errorBody: string): string {
    try {
      const jsonError = JSON.parse(errorBody);
      return jsonError.error || jsonError.message || jsonError.msg || errorBody;
    } catch {
      return errorBody || 'Unknown edge function error';
    }
  }

  private isRecoverableFeedbackTicketsFunctionError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /feedback tickets function is unreachable|requested function was not found|not_found|failed to fetch|networkerror|load failed/i.test(message);
  }

  private isRecoverableFeedbackTicketsAuthConfigError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /AT_ERP_JWT_SECRET is not configured|Invalid JWT|Invalid or expired application token/i.test(message);
  }

  // ============================================================================
  // PURCHASE ORDER CRUD
  // ============================================================================

  private normalizePurchaseOrderFromDb(po: any): any {
    if (!po) return po;
    const camel = this.snakeToCamel(po);
    return {
      ...camel,
      date: camel.orderDate || camel.date || '',
      reference: camel.poNumber || camel.reference || '',
      memo: camel.notes || camel.memo || '',
      lines: Array.isArray(camel.lines) ? camel.lines : [],
    };
  }

  async createPurchaseOrder(order: any): Promise<any> {
    console.debug('[Supabase] createPurchaseOrder called with:', order);
    try {
      const payload: any = {
        org_id: order.orgId,
        vendor_id: order.vendorId,
        po_number: order.reference || order.poNumber || `PO-${Date.now()}`,
        order_date: order.date || order.orderDate || new Date().toISOString().slice(0, 10),
        status: order.status || 'DRAFT',
        total_amount: Number(order.totalAmount || 0),
        notes: order.memo || order.notes || null,
      };
      if (order.expectedDeliveryDate) payload.expected_delivery_date = order.expectedDeliveryDate;
      if (order.glEntryNumber) payload.gl_entry_number = order.glEntryNumber;
      if (order.approvedBy) payload.approved_by = order.approvedBy;
      if (order.approvedAt) payload.approved_at = order.approvedAt;
      if (order.createdBy) payload.created_by = order.createdBy;

      const url = `${this.baseUrl}/purchase_orders`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create purchase order: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const createdPO = Array.isArray(data) ? data[0] : data;
      const normalizedPO = this.normalizePurchaseOrderFromDb(createdPO);

      if (Array.isArray(order.lines) && order.lines.length > 0 && normalizedPO?.id) {
        try {
          const itemPayloads = order.lines
            .filter((l: any) => l.itemId)
            .map((l: any) => ({
              po_id: normalizedPO.id,
              item_id: l.itemId,
              quantity: Number(l.qty ?? l.quantity ?? 1),
              unit_price: Number(l.unitPrice ?? 0),
              received_quantity: Number(l.receivedQuantity ?? 0)
            }));
          if (itemPayloads.length > 0) {
            await fetch(`${this.baseUrl}/purchase_order_items`, {
              method: 'POST',
              headers: { ...(await this.getHeaders()), 'Prefer': 'return=minimal' },
              body: JSON.stringify(itemPayloads)
            });
          }
        } catch (itemErr) {
          console.warn('[Supabase] Failed to save purchase order items:', itemErr);
        }
      }

      return {
        ...normalizedPO,
        lines: order.lines || []
      };
    } catch (error) {
      console.error('[Supabase] Error creating purchase order:', error);
      throw error;
    }
  }

  async updatePurchaseOrder(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updatePurchaseOrder called with id:', id, 'updates:', updates);
    try {
      const payload: any = {};
      if (updates.vendorId !== undefined) payload.vendor_id = updates.vendorId;
      if (updates.reference !== undefined || updates.poNumber !== undefined) payload.po_number = updates.reference ?? updates.poNumber;
      if (updates.date !== undefined || updates.orderDate !== undefined) payload.order_date = updates.date ?? updates.orderDate;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.totalAmount !== undefined) payload.total_amount = Number(updates.totalAmount);
      if (updates.memo !== undefined || updates.notes !== undefined) payload.notes = updates.memo ?? updates.notes;
      if (updates.expectedDeliveryDate !== undefined) payload.expected_delivery_date = updates.expectedDeliveryDate;
      if (updates.glEntryNumber !== undefined) payload.gl_entry_number = updates.glEntryNumber;
      if (updates.approvedBy !== undefined) payload.approved_by = updates.approvedBy;
      if (updates.approvedAt !== undefined) payload.approved_at = updates.approvedAt;
      payload.updated_at = new Date().toISOString();

      const url = `${this.baseUrl}/purchase_orders?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update purchase order: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const updatedPO = Array.isArray(data) ? data[0] : data;
      return this.normalizePurchaseOrderFromDb(updatedPO);
    } catch (error) {
      console.error('[Supabase] Error updating purchase order:', error);
      throw error;
    }
  }

  async deletePurchaseOrder(id: string): Promise<void> {
    console.debug('[Supabase] deletePurchaseOrder called with id:', id);
    try {
      const url = `${this.baseUrl}/purchase_orders?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: await this.getHeaders()
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete purchase order: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('[Supabase] Error deleting purchase order:', error);
      throw error;
    }
  }

  async getPurchaseOrdersByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getPurchaseOrdersByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/purchase_orders?org_id=eq.${orgId}&order=created_at.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.normalizePurchaseOrderFromDb(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching purchase orders:', error);
      return [];
    }
  }

  async getPurchaseOrderById(id: string): Promise<any | null> {
    console.debug('[Supabase] getPurchaseOrderById called with id:', id);
    try {
      const url = `${this.baseUrl}/purchase_orders?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.normalizePurchaseOrderFromDb(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching purchase order:', error);
      return null;
    }
  }

  // ============================================================================
  // GOODS RECEIPT CRUD
  // ============================================================================

  async createGoodsReceipt(receipt: any): Promise<any> {
    console.debug('[Supabase] createGoodsReceipt called with:', receipt);
    try {
      const payload = this.camelToSnake(receipt);
      delete payload.id;
      const url = `${this.baseUrl}/goods_receipts`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create goods receipt: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating goods receipt:', error);
      throw error;
    }
  }

  async updateGoodsReceipt(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateGoodsReceipt called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/goods_receipts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update goods receipt: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating goods receipt:', error);
      throw error;
    }
  }

  async deleteGoodsReceipt(id: string): Promise<void> {
    console.debug('[Supabase] deleteGoodsReceipt called with id:', id);
    try {
      const url = `${this.baseUrl}/goods_receipts?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: (await this.getHeaders()),
        body: JSON.stringify({ is_deleted: true, deleted_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error('Failed to delete goods receipt');
    } catch (error) {
      console.error('[Supabase] Error deleting goods receipt:', error);
      throw error;
    }
  }

  async getGoodsReceiptsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getGoodsReceiptsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/goods_receipts?org_id=eq.${orgId}&is_deleted=eq.false&order=receipt_date.desc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching goods receipts:', error);
      return [];
    }
  }

  async getGoodsReceiptById(id: string): Promise<any | null> {
    console.debug('[Supabase] getGoodsReceiptById called with id:', id);
    try {
      const url = `${this.baseUrl}/goods_receipts?id=eq.${id}`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) && data.length > 0 ? this.snakeToCamel(data[0]) : null;
    } catch (error) {
      console.error('[Supabase] Error fetching goods receipt:', error);
      return null;
    }
  }

  // ============================================================================
  // RECURRING BILL CRUD
  // ============================================================================

  async createRecurringBill(bill: any): Promise<any> {
    console.debug('[Supabase] createRecurringBill called with:', bill);
    try {
      const payload = this.camelToSnake(bill);
      delete payload.id;
      const url = `${this.baseUrl}/recurring_bills`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create recurring bill: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error creating recurring bill:', error);
      throw error;
    }
  }

  async updateRecurringBill(id: string, updates: any): Promise<any> {
    console.debug('[Supabase] updateRecurringBill called with id:', id, 'updates:', updates);
    try {
      const payload = this.camelToSnake(updates);
      const url = `${this.baseUrl}/recurring_bills?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...(await this.getHeaders()), 'Prefer': 'return=representation' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update recurring bill: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? this.snakeToCamel(data[0]) : this.snakeToCamel(data);
    } catch (error) {
      console.error('[Supabase] Error updating recurring bill:', error);
      throw error;
    }
  }

  async deleteRecurringBill(id: string): Promise<void> {
    console.debug('[Supabase] deleteRecurringBill called with id:', id);
    try {
      const url = `${this.baseUrl}/recurring_bills?id=eq.${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: (await this.getHeaders())
      });
      if (!response.ok) throw new Error('Failed to delete recurring bill');
    } catch (error) {
      console.error('[Supabase] Error deleting recurring bill:', error);
      throw error;
    }
  }

  async getRecurringBillsByOrg(orgId: string): Promise<any[]> {
    console.debug('[Supabase] getRecurringBillsByOrg called with orgId:', orgId);
    try {
      const url = `${this.baseUrl}/recurring_bills?org_id=eq.${orgId}&order=next_due_date.asc`;
      const response = await fetch(url, { headers: (await this.getHeaders()) });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data.map(d => this.snakeToCamel(d)) : [];
    } catch (error) {
      console.error('[Supabase] Error fetching recurring bills:', error);
      return [];
    }
  }

  async getRecurringBillById(id: string): Promise<any | null> {
    return null;
  }

  // ============================================================================
  // INVOICE CRUD
  // ============================================================================

  async createInvoice(invoice: any): Promise<any> {
    console.debug('[Supabase] createInvoice called with:', invoice);
    const invoiceLines = invoice.lines || [];
    const invoiceData = { ...invoice };
    delete invoiceData.lines;
    const orgId = invoiceData.orgId || invoiceData.org_id;
    const currentInvoiceNo = String(invoiceData.invoiceNo || invoiceData.invoice_no || '').trim();
    const usesStandardInvoiceSequence = !currentInvoiceNo || /^INV-\d{4}-\d+$/i.test(currentInvoiceNo);
    const isNonInvoicePayment = String(invoiceData.documentType || invoiceData.document_type || '').toUpperCase() === 'NON_INVOICE_PAYMENT';

    if (orgId && usesStandardInvoiceSequence && !isNonInvoicePayment) {
      const generatedInvoiceNo = await this.getNextInvoiceNo(orgId);
      invoiceData.invoiceNo = generatedInvoiceNo;
      invoiceData.invoice_no = generatedInvoiceNo;
    } else if (!orgId && usesStandardInvoiceSequence) {
      throw new Error('Missing orgId - cannot generate invoice number');
    }

    const snakeCaseInvoice = this.camelToSnake(invoiceData);
    if ((snakeCaseInvoice as any).status === 'on_hold' || (snakeCaseInvoice as any).status === 'ON_HOLD') {
      (snakeCaseInvoice as any).status = 'DRAFT';
    }
    const filteredInvoice = this.filterToTableSchema('invoices', snakeCaseInvoice, true);

    // Insert invoice
    const savedInvoice = await this.insertToSupabaseRaw<any>('invoices', filteredInvoice);

    // Insert lines if any
    if (invoiceLines.length > 0) {
      try {
        const savedLines = await this.createInvoiceLines(invoiceLines.map((line: any) => ({
          ...line,
          invoiceId: savedInvoice.id,
          orgId: savedInvoice.orgId || invoice.orgId
        })));
        savedInvoice.lines = savedLines;
      } catch (error) {
        // Rollback: delete the invoice if lines failed to save
        console.error('[Supabase] Failed to save invoice lines, rolling back invoice creation:', error);
        await this.deleteFromSupabase('invoices', savedInvoice.id).catch(e =>
          console.error('[Supabase] Failed to rollback invoice after line insertion error:', e)
        );
        throw error; // Re-throw to be caught by the App.tsx handler
      }
    }

    return savedInvoice;
  }

  async updateInvoice(id: string, updates: Partial<any>): Promise<any> {
    const lines = updates.lines;

    // 1. Convert to snake_case for schema filtering
    const snakeCaseUpdates = this.camelToSnake(updates);
    if ((snakeCaseUpdates as any).status === 'on_hold' || (snakeCaseUpdates as any).status === 'ON_HOLD') {
      (snakeCaseUpdates as any).status = 'DRAFT';
    }

    // 2. Filter to only valid table columns
    const filteredUpdates = this.filterToTableSchema('invoices', snakeCaseUpdates);

    // 3. CRITICAL: Remove read-only/identity columns from the PATCH body
    // Including 'id' in the body of a PATCH request with ?id=eq.xxx will cause a 400 or 409 error
    delete filteredUpdates.id;
    delete filteredUpdates.org_id;
    delete filteredUpdates.created_at;
    delete filteredUpdates.created_by;
    delete filteredUpdates.lines; // Lines are handled separately

    // 4. Sanitize UUID fields: convert empty strings to null
    // PostgREST/Supabase will throw a 400 error if it receives "" for a UUID column
    const uuidFields = ['sponsor_id', 'student_id', 'enrollment_id', 'assessment_registration_id', 'batch_id', 'journal_entry_id'];
    uuidFields.forEach(field => {
      if (filteredUpdates[field] === '') {
        filteredUpdates[field] = null;
      }
    });

    const existingInvoice = await this.getInvoiceRawForGuard(id);
    if (this.isInvoiceAccountingLocked(existingInvoice)) {
      if (lines && Array.isArray(lines)) {
        throw new Error('Posted invoices are locked. Reverse or void the invoice instead of replacing invoice lines.');
      }

      const allowedPostedInvoiceFields = new Set([
        'amount_paid',
        'balance_due',
        'status',
        'journal_entry_id',
        'gl_entry_number',
        'posted_by',
        'posted_at',
        'voided_by',
        'voided_at',
        'void_reason',
        'updated_at',
        'updated_by'
      ]);
      const disallowedFields = Object.keys(filteredUpdates).filter(field => !allowedPostedInvoiceFields.has(field));
      if (disallowedFields.length > 0) {
        throw new Error(`Posted invoices are locked. Disallowed invoice update fields: ${disallowedFields.join(', ')}`);
      }

      if (filteredUpdates.status) {
        const nextStatus = String(filteredUpdates.status || '').toUpperCase();
        if (!['OPEN', 'CLOSED', 'VOIDED'].includes(nextStatus)) {
          throw new Error('Posted invoices cannot be moved back to draft/on-hold status.');
        }
      }
    } else {
      const clearableDraftUuidFields = ['sponsor_id', 'student_id', 'enrollment_id', 'assessment_registration_id', 'batch_id'];
      clearableDraftUuidFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(snakeCaseUpdates, field) && (snakeCaseUpdates[field] === undefined || snakeCaseUpdates[field] === '')) {
          filteredUpdates[field] = null;
        }
      });
    }

    let savedLines: any[] | undefined;
    if (lines && Array.isArray(lines)) {
      console.debug('[Supabase] Syncing lines for invoice:', id, 'Count:', lines.length);
      // Replace lines before updating the header. Approving/posting changes the
      // invoice to an accounting-locked state, and DB triggers then reject line
      // deletes/inserts for that invoice.
      await this.deleteByFilter('invoice_lines', `invoice_id=eq.${id}`);

      if (lines.length > 0) {
        savedLines = await this.createInvoiceLines(lines.map(l => ({
          ...l,
          invoiceId: id,
          orgId: updates.orgId || existingInvoice?.org_id || existingInvoice?.orgId
        })));
      } else {
        savedLines = [];
      }
    }

    console.debug('[Supabase] Filtered update payload for invoices:', filteredUpdates);

    // Call generic update with the filtered snake_case payload after child lines
    // are synced so the posted-invoice lock trigger does not block them.
    const updatedInvoice = await this.updateInSupabase<any>('invoices', id, filteredUpdates);

    if (savedLines) {
      (updatedInvoice as any).lines = savedLines;
    }

    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    console.debug('[Supabase] deleteInvoice called with id:', id);
    const existingInvoice = await this.getInvoiceRawForGuard(id);
    if (this.isInvoiceAccountingLocked(existingInvoice)) {
      throw new Error('Posted invoices cannot be deleted. Void the invoice instead.');
    }
    return this.deleteFromSupabase('invoices', id);
  }

  async fetchTaxCategories(orgId: string): Promise<TaxCategoryEntry[]> {
    const response = await fetch(
      `${this.baseUrl}/tax_categories?org_id=eq.${encodeURIComponent(orgId)}&select=${this.getSelectColumns('tax_categories')}&order=code.asc`,
      { headers: await this.getHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch tax categories: ${response.status} ${await response.text()}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      console.debug('[Supabase] fetchTaxCategories returned empty set for org', orgId);
    }
    return this.snakeToCamel(rows);
  }

  async getInvoicesByOrg(orgId: string): Promise<Invoice[]> {
    console.debug('[Supabase] getInvoicesByOrg called with orgId:', orgId);
    const response = await fetch(
      `${this.baseUrl}/invoices?org_id=eq.${encodeURIComponent(orgId)}&is_deleted=eq.false&select=${this.getSelectColumns('invoices')}&order=invoice_date.desc`,
      { headers: await this.getHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch invoices by org: ${response.status} ${await response.text()}`);
    }
    return this.snakeToCamel(await response.json());
  }

  async getInvoiceCreatorNames(orgId: string): Promise<Record<string, string>> {
    if (!orgId) return {};
    try {
      const response = await fetch(`${this.baseUrl}/rpc/get_org_invoice_creator_names`, {
        method: 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify({ p_org_id: orgId })
      });
      if (!response.ok) {
        return {};
      }
      const rows = await response.json();
      if (!Array.isArray(rows)) return {};
      const creatorMap: Record<string, string> = {};
      rows.forEach((row: any) => {
        const displayName = String(row?.display_name ?? row?.displayName ?? '').trim();
        if (!displayName) return;
        const userId = String(row?.user_id ?? row?.userId ?? '').trim();
        const authUid = String(row?.auth_uid ?? row?.authUid ?? '').trim();
        if (userId) creatorMap[userId] = displayName;
        if (authUid) creatorMap[authUid] = displayName;
      });
      return creatorMap;
    } catch {
      return {};
    }
  }

  async getInvoiceById(id: string): Promise<any | null> {
    console.debug('[Supabase] getInvoiceById called with id:', id);
    const response = await fetch(
      `${this.baseUrl}/invoices?id=eq.${encodeURIComponent(id)}&select=${this.getSelectColumns('invoices')}&limit=1`,
      { headers: await this.getHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch invoice by id: ${response.status} ${await response.text()}`);
    }
    const invoices = await response.json();
    const invoice = Array.isArray(invoices) ? invoices[0] : null;
    if (!invoice) return null;

    const camelInvoice = this.snakeToCamel(invoice);
    camelInvoice.lines = await this.getInvoiceLinesByInvoice(id);
    return camelInvoice;
  }

  async voidInvoice(id: string, voidedBy: string, reason: string): Promise<void> {
    console.debug('[Supabase] voidInvoice called with id:', id, 'voidedBy:', voidedBy, 'reason:', reason);
    await this.updateInvoice(id, {
      status: 'VOIDED',
      voidedBy,
      voidedAt: new Date().toISOString(),
      voidReason: reason
    });
  }

  // ============================================================================
  // INVOICE LINE CRUD
  // ============================================================================

  async createInvoiceLine(line: any): Promise<any> {
    await this.assertInvoiceLinesMutable(line.invoiceId || line.invoice_id);
    const snakeCaseLine = this.camelToSnake(line);
    const filteredLine = this.filterToTableSchema('invoice_lines', snakeCaseLine, true);
    return this.insertToSupabaseRaw('invoice_lines', filteredLine);
  }

  async updateInvoiceLine(id: string, updates: Partial<any>): Promise<any> {
    const existingResponse = await fetch(
      `${this.baseUrl}/invoice_lines?id=eq.${encodeURIComponent(id)}&select=id,invoice_id&limit=1`,
      { headers: await this.getHeaders() }
    );
    if (!existingResponse.ok) {
      throw new Error(`Failed to fetch invoice line for update guard: ${existingResponse.status} ${await existingResponse.text()}`);
    }
    const existingLines = await existingResponse.json();
    const existingLine = Array.isArray(existingLines) ? existingLines[0] || null : null;
    await this.assertInvoiceLinesMutable(existingLine?.invoice_id || existingLine?.invoiceId || (updates as any).invoiceId || (updates as any).invoice_id);
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('invoice_lines', snakeCaseUpdates);
    return this.updateInSupabaseRaw('invoice_lines', id, filteredUpdates);
  }

  async deleteInvoiceLine(id: string): Promise<void> {
    const existingResponse = await fetch(
      `${this.baseUrl}/invoice_lines?id=eq.${encodeURIComponent(id)}&select=id,invoice_id&limit=1`,
      { headers: await this.getHeaders() }
    );
    if (!existingResponse.ok) {
      throw new Error(`Failed to fetch invoice line for delete guard: ${existingResponse.status} ${await existingResponse.text()}`);
    }
    const existingLines = await existingResponse.json();
    const existingLine = Array.isArray(existingLines) ? existingLines[0] || null : null;
    await this.assertInvoiceLinesMutable(existingLine?.invoice_id || existingLine?.invoiceId);
    return this.deleteFromSupabase('invoice_lines', id);
  }

  async getInvoiceLinesByInvoice(invoiceId: string): Promise<any[]> {
    const response = await fetch(
      `${this.baseUrl}/invoice_lines?invoice_id=eq.${encodeURIComponent(invoiceId)}&is_deleted=eq.false&select=${this.getSelectColumns('invoice_lines')}&order=line_number.asc`,
      { headers: await this.getHeaders() }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch invoice lines: ${response.status} ${await response.text()}`);
    }
    return this.snakeToCamel(await response.json());
  }

  async createInvoiceLines(lines: any[]): Promise<any[]> {
    const savedLines = [];
    for (const line of lines) {
      savedLines.push(await this.createInvoiceLine(line));
    }
    return savedLines;
  }

  // ============================================================================
  // ALUMNI EMPLOYMENT REPORT CRUD
  // ============================================================================

  async createAlumniReport(report: any): Promise<any> {
    const snakeCaseReport = this.camelToSnake(report);
    const filteredReport = this.filterToTableSchema('alumni_employment_reports', snakeCaseReport);
    if (filteredReport.id && !this.isValidUUID(filteredReport.id)) {
      delete filteredReport.id;
    }
    return this.insertToSupabaseRaw('alumni_employment_reports', filteredReport);
  }

  async updateAlumniReport(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('alumni_employment_reports', snakeCaseUpdates);
    return this.updateInSupabaseRaw('alumni_employment_reports', id, filteredUpdates);
  }

  async deleteAlumniReport(id: string): Promise<void> {
    return this.deleteFromSupabase('alumni_employment_reports', id);
  }

  async getAlumniReportsByOrg(orgId: string): Promise<any[]> {
    const reports = await this.fetchFromSupabase<any>('alumni_employment_reports');
    return this.snakeToCamel(reports.filter((r: any) => r.org_id === orgId));
  }

  async createAssessmentRegistration(registration: any): Promise<any> {
    const snakeCaseRegistration = this.camelToSnake(registration);
    const filteredRegistration = this.filterToTableSchema('assessment_registrations', snakeCaseRegistration, true);
    if (filteredRegistration.sponsor_id === '' || filteredRegistration.sponsor_id === undefined) {
      filteredRegistration.sponsor_id = null;
    }
    if (filteredRegistration.assessment_date === '' || filteredRegistration.assessment_date === undefined) {
      filteredRegistration.assessment_date = null;
    }
    if (filteredRegistration.invoice_id === '' || filteredRegistration.invoice_id === undefined) {
      filteredRegistration.invoice_id = null;
    }
    return this.insertToSupabaseRaw('assessment_registrations', filteredRegistration);
  }

  async updateAssessmentRegistration(id: string, updates: Partial<any>): Promise<any> {
    const snakeCaseUpdates = this.camelToSnake(updates);
    const filteredUpdates = this.filterToTableSchema('assessment_registrations', snakeCaseUpdates);
    if (filteredUpdates.sponsor_id === '') filteredUpdates.sponsor_id = null;
    if (filteredUpdates.assessment_date === '' || filteredUpdates.assessment_date === undefined) filteredUpdates.assessment_date = null;
    if (filteredUpdates.invoice_id === '') filteredUpdates.invoice_id = null;
    return this.updateInSupabaseRaw('assessment_registrations', id, filteredUpdates);
  }

  async deleteAssessmentRegistration(id: string): Promise<void> {
    return this.deleteFromSupabase('assessment_registrations', id);
  }

  async getAssessmentRegistrationsByOrg(orgId: string): Promise<any[]> {
    const registrations = await this.fetchFromSupabase<any>('assessment_registrations');
    return this.snakeToCamel(registrations.filter((r: any) => r.org_id === orgId));
  }
}
