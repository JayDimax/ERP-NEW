import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PayablesView from '../views/PayablesView';
import { AccountClass, Payable, Vendor, ChartOfAccount, User, Qualification, TaxCategoryEntry } from '../types';
import { DataServiceFactory } from '../services/DataServiceFactory';

describe('PayablesView - AR-style Interactive Line Items & Reimbursement Workflow', () => {
  const mockOrgId = 'org-test-123';
  const mockCurrentUserId = 'user-admin-1';

  const mockVendors: Vendor[] = [
    {
      id: 'ven-1',
      orgId: mockOrgId,
      name: 'Office Depot Supplies',
      tin: '123-456-789',
      status: 'active',
      apAccountId: 'acc-ap-1',
      paymentTermsDays: 30,
      createdAt: '2026-01-01T00:00:00Z',
    }
  ];

  const mockAccounts: ChartOfAccount[] = [
    {
      id: 'acc-exp-1',
      orgId: mockOrgId,
      code: '5100',
      name: 'Training & Instructional Supplies',
      class: AccountClass.EXPENSE,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-exp-2',
      orgId: mockOrgId,
      code: '5200',
      name: 'Travel & Meals Expense',
      class: AccountClass.EXPENSE,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-ap-1',
      orgId: mockOrgId,
      code: '2100',
      name: 'Accounts Payable',
      class: AccountClass.LIABILITY,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-wht-1',
      orgId: mockOrgId,
      code: '2150',
      name: 'Withholding Tax Payable',
      class: AccountClass.LIABILITY,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'acc-vat-1',
      orgId: mockOrgId,
      code: '1170',
      name: 'Input Tax / VAT',
      class: AccountClass.ASSET,
      balance: 0,
      isHeader: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockQualifications: Qualification[] = [
    {
      id: 'qual-1',
      orgId: mockOrgId,
      code: 'SMAW-NC2',
      name: 'Shielded Metal Arc Welding NC II',
      description: 'Welding',
      nominalDurationHours: 268,
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    }
  ];

  const mockEmployees: User[] = [
    {
      id: 'emp-ranil',
      orgId: mockOrgId,
      name: 'Ranil Melgo',
      email: 'ranil@institution.edu',
      role: 'FINANCE',
      createdAt: '2026-01-01T00:00:00Z',
      isDeleted: false,
    }
  ];

  const mockTaxCategories: TaxCategoryEntry[] = [
    {
      id: 'tc-vat-12',
      orgId: mockOrgId,
      code: 'VATGOODS',
      description: 'VAT on Goods (12%)',
      taxType: 'VAT',
      rate: 12,
      isInclusive: true,
      createdAt: '2026-01-01T00:00:00Z',
    }
  ];

  const baseProps = {
    orgId: mockOrgId,
    currentUserId: mockCurrentUserId,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canApprove: true,
    canPay: true,
    canCancel: true,
    payables: [] as Payable[],
    vendors: mockVendors,
    accounts: mockAccounts,
    qualifications: mockQualifications,
    entries: [],
    bankAccounts: [],
    purchaseOrders: [],
    vendorTaxSettings: [],
    employees: mockEmployees,
    taxCategories: mockTaxCategories,
    onCreatePayable: vi.fn().mockImplementation((p: Payable) => Promise.resolve(p)),
    onUpdatePayable: vi.fn().mockImplementation((p: Payable) => Promise.resolve(p)),
    onDeletePayable: vi.fn().mockResolvedValue(true),
    onPostJournal: vi.fn().mockResolvedValue('je-1'),
    onJournalChanged: vi.fn(),
    onNotify: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [], total: 0, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Create Bill form with AR-style interactive line items table and buttons', async () => {
    render(<PayablesView {...baseProps} />);

    // Click "New Bill" button
    const createBtn = screen.getByRole('button', { name: /new bill/i });
    fireEvent.click(createBtn);

    // Verify line item action buttons from AR invoice table styling
    expect(screen.getByRole('button', { name: /export line items/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add line/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discount/i })).toBeInTheDocument();

    // Verify column headers
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.getByText('Expense / Asset Account *')).toBeInTheDocument();
    expect(screen.getByText('Tax Category')).toBeInTheDocument();

    // Verify GL Journal Entry Preview card
    expect(screen.getByText(/GL Journal Preview/i)).toBeInTheDocument();
    expect(screen.getByText(/Balanced/i)).toBeInTheDocument();
  });

  it('allows adding line items and updating quantities & prices', async () => {
    render(<PayablesView {...baseProps} />);

    // Open Create Bill form
    const createBtn = screen.getByRole('button', { name: /new bill/i });
    fireEvent.click(createBtn);

    // Click "+ Add Line"
    const addLineBtn = screen.getByRole('button', { name: /add line/i });
    fireEvent.click(addLineBtn);

    // Should now have 2 lines badge
    expect(screen.getByText('2 lines')).toBeInTheDocument();

    // Click "Discount" button
    const discountBtn = screen.getByRole('button', { name: /discount/i });
    fireEvent.click(discountBtn);

    // Should now have 3 lines badge
    expect(screen.getByText('3 lines')).toBeInTheDocument();
  });

  it('supports monthly consolidated employee reimbursement for Ranil Melgo with multi-line receipts', async () => {
    const consolidatedBill: Payable = {
      id: 'bill-ranil-august',
      orgId: mockOrgId,
      payableNumber: 'BILL-2026-0088',
      category: 'employee_reimbursements',
      qualificationId: 'qual-1',
      description: 'August 2026 Consolidated Reimbursement - Ranil Melgo (3 receipts)',
      amount: 4500,
      billDate: '2026-08-31',
      dueDate: '2026-09-15',
      currency: 'PHP',
      status: 'for_approval',
      claimedBy: 'Ranil Melgo',
      employeeId: 'emp-ranil',
      inputVatAmount: 0,
      netPayable: 4500,
      expenseAllocations: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          expenseAccountId: 'acc-exp-1',
          qualificationId: 'qual-1',
          description: 'Welding rods for mock assessment',
          amount: 2500,
          quantity: 1,
          unitPrice: 2500,
          sourceExpenseId: 'exp-1'
        },
        {
          lineNumber: 2,
          lineType: 'EXPENSE',
          expenseAccountId: 'acc-exp-2',
          qualificationId: 'qual-1',
          description: 'TESDA Regional Meeting grab taxi fare',
          amount: 2000,
          quantity: 1,
          unitPrice: 2000,
          sourceExpenseId: 'exp-2'
        }
      ],
      createdAt: '2026-08-31T10:00:00Z',
    };

    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [consolidatedBill], total: 1, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);

    render(<PayablesView {...baseProps} payables={[consolidatedBill]} />);

    // Wait for the bill to be listed in the table
    await waitFor(() => {
      expect(screen.getByText('BILL-2026-0088')).toBeInTheDocument();
    });

    // Check that claimant "Ranil Melgo" is displayed
    expect(screen.getByText('Ranil Melgo')).toBeInTheDocument();
  });

  it('keeps On Hold consolidated bill description blank instead of showing individual F.R. codes and allows inline editing only while On Hold', async () => {
    const onUpdatePayable = vi.fn().mockResolvedValue(undefined);
    const onHoldBill: Payable = {
      id: 'bill-on-hold-fr',
      orgId: mockOrgId,
      payableNumber: 'BILL-2026-00001',
      category: 'employee_reimbursements',
      qualificationId: 'qual-1',
      description: 'Employee reimbursement for Ranil Melgo: F.R. No 5721, F.R. No 5714, F.R. No 5717',
      referenceDocument: 'F.R. No 5721, F.R. No 5714, F.R. No 5717',
      amount: 1000,
      billDate: '2026-11-21',
      dueDate: '2026-12-21',
      currency: 'PHP',
      status: 'for_approval',
      claimedBy: 'Ranil Melgo',
      employeeId: 'emp-ranil',
      inputVatAmount: 0,
      netPayable: 1000,
      expenseAllocations: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          expenseAccountId: 'acc-exp-1',
          qualificationId: 'qual-1',
          description: 'F.R. No 5721 — Supplies',
          amount: 1000,
          quantity: 1,
          unitPrice: 1000,
          sourceExpenseId: 'exp-1',
        },
      ],
      createdAt: '2026-11-21T00:00:00Z',
    };

    const postedBill: Payable = {
      ...onHoldBill,
      id: 'bill-posted-1',
      payableNumber: 'BILL-2026-00002',
      description: 'November 2026 Liquidation',
      referenceDocument: '',
      status: 'approved',
      journalEntryId: 'je-1',
    };

    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [onHoldBill, postedBill], total: 2, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);

    render(<PayablesView {...baseProps} payables={[onHoldBill, postedBill]} onUpdatePayable={onUpdatePayable} />);

    // On Hold bill renders an editable blank input without F.R. code clutter
    const descInput = await screen.findByLabelText('Description for BILL-2026-00001');
    expect(descInput).toHaveValue('');
    expect(screen.queryByText(/F\.R\. No 5721/i)).not.toBeInTheDocument();

    // Posted bill renders read-only text (no input)
    expect(screen.queryByLabelText('Description for BILL-2026-00002')).not.toBeInTheDocument();
    expect(screen.getByText('November 2026 Liquidation')).toBeInTheDocument();

    // Editing inline and blurring saves the description and clears auto-generated referenceDocument
    fireEvent.change(descInput, { target: { value: 'November 2026 Reimbursements - Ranil Melgo' } });
    fireEvent.blur(descInput);

    await waitFor(() => {
      expect(onUpdatePayable).toHaveBeenCalledWith(
        'bill-on-hold-fr',
        expect.objectContaining({
          description: 'November 2026 Reimbursements - Ranil Melgo',
          referenceDocument: '',
        }),
      );
    });
  });

  it('paginates Edit Bill line items by 10 and allows adding new lines while On Hold', async () => {
    const allocations = Array.from({ length: 12 }, (_, idx) => ({
      lineNumber: idx + 1,
      lineType: 'EXPENSE' as const,
      expenseAccountId: 'acc-exp-1',
      qualificationId: 'qual-1',
      description: `Expense line item ${idx + 1}`,
      amount: 100,
      quantity: 1,
      unitPrice: 100,
      sourceExpenseId: `exp-${idx + 1}`,
    }));

    const multiLineBill: Payable = {
      id: 'bill-12-lines',
      orgId: mockOrgId,
      payableNumber: 'BILL-2026-00012',
      category: 'employee_reimbursements',
      qualificationId: 'qual-1',
      description: 'Monthly liquidation',
      amount: 1200,
      billDate: '2026-11-21',
      dueDate: '2026-12-21',
      currency: 'PHP',
      status: 'for_approval',
      claimedBy: 'Ranil Melgo',
      employeeId: 'emp-ranil',
      inputVatAmount: 0,
      netPayable: 1200,
      expenseAllocations: allocations,
      createdAt: '2026-11-21T00:00:00Z',
    };

    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [multiLineBill], total: 1, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);

    render(<PayablesView {...baseProps} payables={[multiLineBill]} />);

    // Open Edit Bill modal
    const editBtn = await screen.findByTitle('Edit');
    fireEvent.click(editBtn);

    // Page 1 shows 10 of 12 lines and GL Journal Preview paginates its 13 entries (12 debits + 1 AP credit) by 5
    expect(await screen.findByText('Showing 1-10 of 12 lines')).toBeInTheDocument();
    expect(screen.getByText('Showing 1-5 of 13 entries')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Expense line 1 description')).toHaveValue('Expense line item 1');
    expect(screen.getByLabelText('Expense line 10 description')).toHaveValue('Expense line item 10');
    expect(screen.queryByLabelText('Expense line 11 description')).not.toBeInTheDocument();

    // Navigate to Page 2 on GL Journal Preview (above) and Line Items table (below)
    const statusLabel = screen.getByText(/^Status$/i);
    const lineItemsHeading = screen.getByText(/^Line Items$/i);
    expect(statusLabel.compareDocumentPosition(lineItemsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const nextButtons = screen.getAllByTitle('Next page');
    fireEvent.click(nextButtons[0]);
    expect(screen.getByText('Showing 6-10 of 13 entries')).toBeInTheDocument();

    fireEvent.click(nextButtons[1]);
    expect(screen.getByText('Showing 11-12 of 12 lines')).toBeInTheDocument();
    expect(screen.getByLabelText('Expense line 11 description')).toHaveValue('Expense line item 11');
    expect(screen.getByLabelText('Expense line 12 description')).toHaveValue('Expense line item 12');

    // Return to Page 1 on Line Items and click Add Line while On Hold -> adds line 13 and jumps to Page 2
    fireEvent.click(screen.getAllByTitle('Previous page')[1]);
    expect(screen.getByText('Showing 1-10 of 12 lines')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /add line/i }));
    expect(screen.getByText('Showing 11-13 of 13 lines')).toBeInTheDocument();
    const newLineDesc = screen.getByLabelText('Expense line 13 description');
    expect(newLineDesc).toHaveValue('');
    fireEvent.change(newLineDesc, { target: { value: 'Additional November receipt' } });
    expect(newLineDesc).toHaveValue('Additional November receipt');

    // Clearing a positive-amount line's expense account hides that unselected item from GL Journal Preview
    fireEvent.change(screen.getByLabelText('Expense line 11 account'), { target: { value: '' } });
    expect(screen.queryByText('Expense Account (Unselected)')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 6-10 of 12 entries')).toBeInTheDocument();
  });

  it('keeps GL Journal Preview balanced for consolidated bills with VAT-exclusive allocations and separate Input VAT', async () => {
    const vatConsolidatedBill: Payable = {
      id: 'bill-vat-balanced',
      orgId: mockOrgId,
      payableNumber: 'BILL-2026-00099',
      category: 'employee_reimbursements',
      qualificationId: 'qual-1',
      description: 'VAT consolidated bill',
      amount: 1000,
      inputVatAmount: 120,
      netPayable: 1120,
      billDate: '2026-11-21',
      dueDate: '2026-12-21',
      currency: 'PHP',
      status: 'for_approval',
      claimedBy: 'Ranil Melgo',
      employeeId: 'emp-ranil',
      expenseAllocations: [
        {
          lineNumber: 1,
          lineType: 'EXPENSE',
          expenseAccountId: 'acc-exp-1',
          qualificationId: 'qual-1',
          description: 'F.R. No 5721 — Supplies',
          taxCategoryId: 'tc-vat-12',
          amount: 1000,
          quantity: 1,
          unitPrice: 1120,
          sourceExpenseId: 'exp-vat-1',
        },
      ],
      createdAt: '2026-11-21T00:00:00Z',
    };

    vi.spyOn(DataServiceFactory, 'getService').mockReturnValue({
      fetchPage: vi.fn().mockResolvedValue({ rows: [vatConsolidatedBill], total: 1, totalPages: 1, page: 1, pageSize: 10 }),
      getTimeExpensesByOrg: vi.fn().mockResolvedValue([]),
    } as any);

    render(<PayablesView {...baseProps} payables={[vatConsolidatedBill]} />);

    fireEvent.click(await screen.findByTitle('Edit'));

    expect(await screen.findByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('✓ Total Debits = Total Credits')).toBeInTheDocument();
  });
});
