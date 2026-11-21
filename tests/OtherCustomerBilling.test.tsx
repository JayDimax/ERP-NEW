import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoicesView from '../views/InvoicesView';
import { AccountClass, ChartOfAccount, Invoice, TaxCategoryEntry } from '../types';

const mockFetchPage = vi.fn().mockResolvedValue({ rows: [], total: 0, totalPages: 1 });

vi.mock('../services/DataServiceFactory', () => ({
  DataServiceFactory: {
    getService: () => ({
      fetchPage: mockFetchPage,
      fetchTaxCategories: vi.fn().mockResolvedValue([]),
      getInvoiceCreatorNames: vi.fn().mockResolvedValue({}),
      getInvoiceById: vi.fn().mockResolvedValue(null),
    }),
  },
}));

describe('Other Customer Billing Category', () => {
  const mockOrgId = 'org-test-1';

  const mockAccounts: ChartOfAccount[] = [
    {
      id: 'acc-rev-rental',
      orgId: mockOrgId,
      code: '4200',
      name: 'Rental Income',
      class: AccountClass.REVENUE,
      isHeader: false,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    } as ChartOfAccount,
  ];

  const mockTaxCategories: TaxCategoryEntry[] = [
    {
      id: 'tax-exempt',
      orgId: mockOrgId,
      code: 'EXEMPT',
      description: 'VAT Exempt',
      rate: 0,
      isInclusive: false,
      createdAt: '2026-01-01T00:00:00Z',
    } as TaxCategoryEntry,
  ];

  it('allows entering an Other customer name without linking a sponsor or student and displays it in the list', async () => {
    const onAddInvoice = vi.fn().mockResolvedValue(true);
    const existingOtherInvoice: Invoice = {
      id: 'inv-other-1',
      orgId: mockOrgId,
      invoiceNo: 'INV-2026-00099',
      documentType: 'INVOICE',
      otherCustomerName: 'Sunrise Equipment Rental',
      invoiceDate: '2026-11-21',
      dueDate: '2026-12-21',
      status: 'OPEN',
      vatPricing: 'EXEMPT',
      vatRate: 0,
      subtotal: 5000,
      vatAmount: 0,
      grandTotal: 5000,
      amountPaid: 0,
      balanceDue: 5000,
      notes: 'Hall rental for November event',
      createdAt: '2026-11-21T00:00:00Z',
    };

    mockFetchPage.mockResolvedValueOnce({
      rows: [existingOtherInvoice],
      total: 1,
      totalPages: 1,
    });

    render(
      <InvoicesView
        orgId={mockOrgId}
        invoices={[existingOtherInvoice]}
        students={[]}
        sponsors={[]}
        batches={[]}
        qualifications={[]}
        courseFees={[]}
        accounts={mockAccounts}
        taxCategories={mockTaxCategories}
        currency="PHP"
        onAddInvoice={onAddInvoice}
        onUpdateInvoice={vi.fn()}
        onDeleteInvoice={vi.fn().mockResolvedValue(true)}
      />
    );

    // Existing "Other" invoice displays its custom name in the registry
    expect(await screen.findByText('Sunrise Equipment Rental')).toBeInTheDocument();

    // Open new invoice form
    fireEvent.click(screen.getByText(/New Invoice/i));

    const otherInput = screen.getByLabelText(/Other Customer Name/i) as HTMLInputElement;
    const sponsorSelect = screen.getByLabelText(/Customer \/ Sponsor/i) as HTMLSelectElement;

    expect(otherInput).not.toBeDisabled();
    expect(sponsorSelect).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Bill Unregistered/i })).toBeInTheDocument();

    // Enter a custom name in Other
    fireEvent.change(otherInput, { target: { value: '  ABC Venue Rental  ' } });

    // Sponsor select becomes disabled and "+ Bill Unregistered" hides
    expect(sponsorSelect).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Bill Unregistered/i })).toBeNull();

    // Clearing Other re-enables Sponsor and "+ Bill Unregistered"
    fireEvent.change(otherInput, { target: { value: '' } });
    expect(sponsorSelect).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Bill Unregistered/i })).toBeInTheDocument();
  });

  it('supports Other customer input in Non-Invoice Payment (Cash Invoice) mode', () => {
    render(
      <InvoicesView
        orgId={mockOrgId}
        documentMode="NON_INVOICE_PAYMENT"
        invoices={[]}
        students={[]}
        sponsors={[]}
        batches={[]}
        qualifications={[]}
        courseFees={[]}
        accounts={mockAccounts}
        taxCategories={mockTaxCategories}
        currency="PHP"
        onAddInvoice={vi.fn()}
        onUpdateInvoice={vi.fn()}
        onDeleteInvoice={vi.fn().mockResolvedValue(true)}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /New Cash Invoice|New Non-Invoice/i }));

    const otherInput = screen.getByLabelText(/Other Customer Name/i) as HTMLInputElement;
    expect(otherInput).toBeInTheDocument();
    fireEvent.change(otherInput, { target: { value: 'Walk-in Room Rental' } });
    expect(otherInput.value).toBe('Walk-in Room Rental');
  });
});
