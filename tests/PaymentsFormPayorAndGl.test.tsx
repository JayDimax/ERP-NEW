import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PaymentsView from '../views/PaymentsView';
import { AccountClass, ChartOfAccount, Invoice, JournalEntry, Payment, Sponsor, Student } from '../types';

const mockFetchPage = vi.fn().mockResolvedValue({ rows: [], total: 0, totalPages: 1 });

vi.mock('../services/DataServiceFactory', () => ({
  DataServiceFactory: {
    getService: () => ({
      fetchPage: mockFetchPage,
    }),
  },
}));

describe('PaymentsView New Payment dynamic alphabetical search and Student GL account', () => {
  const orgId = 'org-pay-test';

  const accounts: ChartOfAccount[] = [
    {
      id: 'acc-cash',
      orgId,
      code: '1101',
      name: 'Cash on Hand',
      class: AccountClass.ASSET,
      isHeader: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    } as ChartOfAccount,
    {
      id: 'acc-ar-student',
      orgId,
      code: '11100',
      name: 'Accounts Receivable - Student',
      class: AccountClass.ASSET,
      isHeader: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    } as ChartOfAccount,
    {
      id: 'acc-unearned',
      orgId,
      code: '2140',
      name: 'Unearned Training Revenue',
      class: AccountClass.LIABILITY,
      isHeader: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    } as ChartOfAccount,
  ];

  const sponsors: Sponsor[] = [
    { id: 'sp-z', orgId, name: 'Zeta Partners', createdAt: '' } as Sponsor,
    { id: 'sp-a', orgId, name: 'Alpha Corp', createdAt: '' } as Sponsor,
    { id: 'sp-m', orgId, name: 'Metro Foundation', createdAt: '' } as Sponsor,
  ];

  const students: Student[] = [
    { id: 'st-z', orgId, firstName: 'ANIANO', lastName: 'ZAPICO', createdAt: '' } as Student,
    { id: 'st-s', orgId, firstName: 'WILFREDO', lastName: 'SALDON', createdAt: '' } as Student,
    { id: 'st-a', orgId, firstName: 'ROLLY BOY', lastName: 'ABABON', createdAt: '' } as Student,
    { id: 'st-c', orgId, firstName: 'JUAN PAOLO', lastName: 'CARCALLAS', createdAt: '' } as Student,
  ];

  it('sorts sponsor and student payors alphabetically, filters dynamically, and keeps Student GL preview on Unearned Training Revenue', () => {
    render(
      <PaymentsView
        currentOrgId={orgId}
        payments={[]}
        sponsors={sponsors}
        students={students}
        invoices={[]}
        bankAccounts={[]}
        accounts={accounts}
        journalEntries={[]}
        currency="PHP"
        onAddPayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        onDeletePayment={vi.fn()}
        onApplyPayment={vi.fn()}
        onReverseApplication={vi.fn()}
        onVoidPayment={vi.fn()}
      />
    );

    // Open New Payment form
    fireEvent.click(screen.getByRole('button', { name: /New Payment/i }));

    // Sponsor is default: GL preview shows Unearned Training Revenue
    expect(screen.getByText(/2140 - Unearned Training Revenue/i)).toBeInTheDocument();

    // Sponsor combobox lists options alphabetically
    const sponsorCombo = screen.getByRole('combobox', { name: /Select Sponsor/i });
    fireEvent.focus(sponsorCombo);
    const sponsorOptions = within(screen.getByRole('listbox')).getAllByRole('option').map(el => el.textContent?.trim());
    expect(sponsorOptions).toEqual(['Alpha Corp', 'Metro Foundation', 'Zeta Partners']);

    // Switch Payor Type to Student
    fireEvent.click(screen.getByLabelText(/^Student$/i));

    // GL preview remains on Unearned Training Revenue for Student
    expect(screen.getByText(/2140 - Unearned Training Revenue/i)).toBeInTheDocument();
    expect(screen.queryByText(/11100 - Accounts Receivable - Student/i)).toBeNull();

    // Student combobox lists options alphabetically
    const studentCombo = screen.getByRole('combobox', { name: /Select Student/i });
    fireEvent.focus(studentCombo);
    const studentOptions = within(screen.getByRole('listbox')).getAllByRole('option').map(el => el.textContent?.trim());
    expect(studentOptions).toEqual([
      'ABABON, ROLLY BOY',
      'CARCALLAS, JUAN PAOLO',
      'SALDON, WILFREDO',
      'ZAPICO, ANIANO',
    ]);

    // Dynamic search filters students live
    fireEvent.change(studentCombo, { target: { value: 'carc' } });
    const filteredOptions = within(screen.getByRole('listbox')).getAllByRole('option').map(el => el.textContent?.trim());
    expect(filteredOptions).toEqual(['CARCALLAS, JUAN PAOLO']);

    // Selecting option updates input value
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: /CARCALLAS, JUAN PAOLO/i }));
    expect((studentCombo as HTMLInputElement).value).toBe('CARCALLAS, JUAN PAOLO');
  });

  it('resolves posted GL reference instead of Pending for applied payments missing glReference on payment_applications', async () => {
    const invoice: Invoice = {
      id: 'inv-3',
      orgId,
      invoiceNo: 'INV-2026-00003',
      studentId: 'st-c',
      invoiceDate: '2026-11-21',
      dueDate: '2026-12-21',
      status: 'CLOSED',
      vatPricing: 'EXEMPT',
      vatRate: 0,
      subtotal: 6000,
      vatAmount: 0,
      grandTotal: 6000,
      amountPaid: 6000,
      balanceDue: 0,
      createdAt: '2026-11-21T00:00:00Z',
    };

    const payment: Payment = {
      id: 'pay-1',
      orgId,
      paymentNo: 'PAY-2026-00001',
      studentId: 'st-c',
      paymentDate: '2026-11-21',
      status: 'OPEN',
      paymentMethod: 'CASH',
      amountReceived: 6000,
      ewtAmountCertified: 0,
      totalApplied: 6000,
      customerDepositBalance: 0,
      journalEntryId: 'je-pay-1',
      applications: [
        {
          id: 'app-1',
          orgId,
          paymentId: 'pay-1',
          invoiceId: 'inv-3',
          applicationNo: 'PAYAPP-2026-00001',
          amountApplied: 6000,
          isReversed: false,
          createdAt: '2026-11-21T00:00:00Z',
        },
      ],
      createdAt: '2026-11-21T00:00:00Z',
    };

    const journalEntries: JournalEntry[] = [
      {
        id: 'je-pay-1',
        orgId,
        periodId: '11-2026',
        date: '2026-11-21',
        description: 'Payment PAY-2026-00001',
        reference: 'GL00000011',
        glEntryNumber: 'GL00000011',
        status: 'POSTED',
        sourceType: 'PAYMENT',
        sourceRef: 'pay-1',
        createdAt: '2026-11-21T00:00:00Z',
      } as JournalEntry,
      {
        id: 'je-app-1',
        orgId,
        periodId: '11-2026',
        date: '2026-11-21',
        description: 'Payment application for invoice INV-2026-00003',
        reference: 'PAYAPP-2026-00001',
        glEntryNumber: 'GL00000012',
        status: 'POSTED',
        sourceType: 'APPLICATION',
        sourceRef: 'app-1',
        createdAt: '2026-11-21T00:00:00Z',
      } as JournalEntry,
    ];

    render(
      <PaymentsView
        currentOrgId={orgId}
        payments={[payment]}
        sponsors={sponsors}
        students={students}
        invoices={[invoice]}
        bankAccounts={[]}
        accounts={accounts}
        journalEntries={journalEntries}
        currency="PHP"
        onAddPayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        onDeletePayment={vi.fn()}
        onApplyPayment={vi.fn()}
        onReverseApplication={vi.fn()}
        onVoidPayment={vi.fn()}
      />
    );

    // Switch to Payment Applications -> Already Applied tab and verify the application resolves its OWN GL entry (GL00000012), not the parent payment's GL00000011
    fireEvent.click(screen.getByRole('button', { name: /Payment Applications/i }));
    fireEvent.click(screen.getByRole('button', { name: /Already Applied/i }));
    expect(await screen.findByText('GL00000012')).toBeInTheDocument();
    expect(screen.queryByText(/^Pending$/)).toBeNull();
  });

  it('uses the payment date and post period (e.g. July 2026) on New Pay Application instead of today', () => {
    const julyInvoice: Invoice = {
      id: 'inv-july',
      orgId,
      invoiceNo: 'INV-2026-00003',
      studentId: 'st-c',
      invoiceDate: '2026-07-02',
      dueDate: '2026-08-01',
      status: 'OPEN',
      vatPricing: 'EXEMPT',
      vatRate: 0,
      subtotal: 13360,
      vatAmount: 0,
      grandTotal: 13360,
      amountPaid: 0,
      balanceDue: 13360,
      createdAt: '2026-07-02T00:00:00Z',
    };

    const julyUnappliedPayment: Payment = {
      id: 'pay-july',
      orgId,
      paymentNo: 'PAY-2026-00001',
      studentId: 'st-c',
      paymentDate: '2026-07-02',
      status: 'OPEN',
      paymentMethod: 'CASH',
      amountReceived: 6000,
      ewtAmountCertified: 0,
      totalApplied: 0,
      customerDepositBalance: 6000,
      applications: [],
      createdAt: '2026-11-21T00:00:00Z',
    };

    render(
      <PaymentsView
        currentOrgId={orgId}
        payments={[julyUnappliedPayment]}
        sponsors={sponsors}
        students={students}
        invoices={[julyInvoice]}
        bankAccounts={[]}
        accounts={accounts}
        journalEntries={[]}
        currency="PHP"
        onAddPayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        onDeletePayment={vi.fn()}
        onApplyPayment={vi.fn()}
        onReverseApplication={vi.fn()}
        onVoidPayment={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Payment Applications/i }));
    fireEvent.click(screen.getByRole('button', { name: /New Payment Application/i }));

    expect(screen.getByText('07/02/2026')).toBeInTheDocument();
    expect(screen.getAllByText('07-2026').length).toBeGreaterThan(0);
    expect(screen.getByText(/Journal Entry Date: 07\/02\/2026/)).toBeInTheDocument();
  });

  it('redirects to the exact GL entry (GL00000006) instead of an earlier APPLICATION entry (GL00000004) for the same invoice', async () => {
    const onViewJournal = vi.fn();
    const invoice: Invoice = {
      id: 'inv-3',
      orgId,
      invoiceNo: 'INV-2026-00003',
      studentId: 'st-c',
      invoiceDate: '2026-07-02',
      dueDate: '2026-08-01',
      status: 'OPEN',
      vatPricing: 'EXEMPT',
      vatRate: 0,
      subtotal: 13360,
      vatAmount: 0,
      grandTotal: 13360,
      amountPaid: 6000,
      balanceDue: 7360,
      createdAt: '2026-07-02T00:00:00Z',
    };

    const payment: Payment = {
      id: 'pay-1',
      orgId,
      paymentNo: 'PAY-2026-00001',
      studentId: 'st-c',
      paymentDate: '2026-07-02',
      status: 'OPEN',
      paymentMethod: 'CASH',
      amountReceived: 6000,
      ewtAmountCertified: 0,
      totalApplied: 6000,
      customerDepositBalance: 0,
      applications: [
        {
          id: 'app-new-6',
          orgId,
          paymentId: 'pay-1',
          invoiceId: 'inv-3',
          applicationNo: 'PAYAPP-2026-00001',
          glReference: 'GL00000006',
          journalEntryId: 'je-app-6',
          amountApplied: 6000,
          isReversed: false,
          createdAt: '2026-07-02T00:00:00Z',
        },
      ],
      createdAt: '2026-07-02T00:00:00Z',
    };

    const journalEntries: JournalEntry[] = [
      {
        id: 'je-app-4',
        orgId,
        periodId: '07-2026',
        date: '2026-07-02',
        description: 'Payment application for invoice INV-2026-00003',
        reference: 'PAYAPP-2026-00001',
        glEntryNumber: 'GL00000004',
        status: 'POSTED',
        sourceType: 'APPLICATION',
        sourceRef: 'app-old-4',
        createdAt: '2026-07-02T00:00:00Z',
      } as JournalEntry,
      {
        id: 'je-app-6',
        orgId,
        periodId: '07-2026',
        date: '2026-07-02',
        description: 'Payment application for invoice INV-2026-00003',
        reference: 'PAYAPP-2026-00001',
        glEntryNumber: 'GL00000006',
        status: 'POSTED',
        sourceType: 'APPLICATION',
        sourceRef: 'app-new-6',
        createdAt: '2026-07-02T00:05:00Z',
      } as JournalEntry,
    ];

    render(
      <PaymentsView
        currentOrgId={orgId}
        payments={[payment]}
        sponsors={sponsors}
        students={students}
        invoices={[invoice]}
        bankAccounts={[]}
        accounts={accounts}
        journalEntries={journalEntries}
        currency="PHP"
        onAddPayment={vi.fn()}
        onUpdatePayment={vi.fn()}
        onDeletePayment={vi.fn()}
        onApplyPayment={vi.fn()}
        onReverseApplication={vi.fn()}
        onVoidPayment={vi.fn()}
        onViewJournal={onViewJournal}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Payment Applications/i }));
    fireEvent.click(screen.getByRole('button', { name: /Already Applied/i }));

    const glButton = await screen.findByRole('button', { name: 'GL00000006' });
    fireEvent.click(glButton);

    expect(onViewJournal).toHaveBeenCalledWith('je-app-6');
  });

  it('awaits async onAddPayment before refreshing serverPayments so the newly created payment shows immediately', async () => {
    const dbRows: Payment[] = [];
    mockFetchPage.mockImplementation(async () => ({
      rows: [...dbRows],
      total: dbRows.length,
      totalPages: 1,
    }));

    const onAddPayment = vi.fn().mockImplementation(async (payment: Payment) => {
      await new Promise(resolve => setTimeout(resolve, 25));
      dbRows.unshift(payment);
    });

    render(
      <PaymentsView
        currentOrgId={orgId}
        payments={[]}
        sponsors={sponsors}
        students={students}
        invoices={[]}
        bankAccounts={[]}
        accounts={accounts}
        journalEntries={[]}
        currency="PHP"
        onAddPayment={onAddPayment}
        onUpdatePayment={vi.fn()}
        onDeletePayment={vi.fn()}
        onApplyPayment={vi.fn()}
        onReverseApplication={vi.fn()}
        onVoidPayment={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /New Payment/i }));

    // Fill required fields: C.R. No., Sponsor, Amount Received, Transaction Description
    fireEvent.change(screen.getByPlaceholderText(/Collection Receipt No\./i), { target: { value: 'CR-1001' } });
    const sponsorCombo = screen.getByRole('combobox', { name: /Select Sponsor/i });
    fireEvent.focus(sponsorCombo);
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option', { name: 'Alpha Corp' }));

    const amountInputs = screen.getAllByDisplayValue('0.00');
    fireEvent.focus(amountInputs[0]);
    fireEvent.change(amountInputs[0], { target: { value: '2500' } });
    fireEvent.blur(amountInputs[0]);

    fireEvent.change(screen.getByPlaceholderText(/Payment notes or memo/i), {
      target: { value: 'Tuition payment' }
    });

    // Approve payment — must await onAddPayment before fetching list
    fireEvent.click(screen.getByTitle('Approve'));

    expect(await screen.findByText('PAY-2026-00001')).toBeInTheDocument();
    expect(onAddPayment).toHaveBeenCalledTimes(1);
  });
});
