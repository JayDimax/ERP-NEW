import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import InvoicesView from '../views/InvoicesView';
import { Invoice } from '../types';
import { SupabaseDataService } from '../services/SupabaseDataService';


describe('InvoicesView tax category dropdown', () => {
  const baseProps: any = {
    invoices: [],
    sponsors: [],
    students: [],
    enrollments: [],
    batches: [],
    qualifications: [],
    courseFees: [],
    accounts: [],
    currency: 'PHP',
    onAddInvoice: vi.fn(),
    onUpdateInvoice: vi.fn(),
    onDeleteInvoice: vi.fn().mockResolvedValue(true),
    orgId: 'org1',
    taxCategories: [
      { id: 'tc1', orgId: 'org1', code: 'VAT', description: 'VAT goods', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc2', orgId: 'org1', code: 'EXEMPT', description: 'Tax exempt', taxType: 'EXEMPT', rate: 0, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]
  };

  // spy on SupabaseDataService to prevent real network calls and return known categories
  beforeEach(() => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchPage').mockResolvedValue({
      rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0
    });
    vi.spyOn(SupabaseDataService.prototype, 'getInvoiceCreatorNames').mockResolvedValue({});
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc1', orgId: 'org1', code: 'VAT', description: 'VAT goods', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc2', orgId: 'org1', code: 'EXEMPT', description: 'Tax exempt', taxType: 'EXEMPT', rate: 0, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]);
  });

  const waitForTaxOption = async (select: HTMLElement, value: string) => {
    await waitFor(() => expect(select.querySelector(`option[value="${value}"]`)).not.toBeNull());
  };

  it('shows tax category options in new invoice form', async () => {
    render(<InvoicesView {...baseProps} />);
    // open form
    const newBtn = screen.getByText(/New Invoice/i);
    fireEvent.click(newBtn);
    // click add line
    const addLine = screen.getByRole('button', { name: /Add Line/i });
    fireEvent.click(addLine);
    // the Tax Cat header should exist
    expect(screen.getByText('Tax Category *')).toBeInTheDocument();
    // VAT pricing/rate inputs should no longer be rendered
    expect(screen.queryByText(/VAT Pricing/i)).toBeNull();
    expect(screen.queryByText(/VAT Rate/i)).toBeNull();
    // verify options in the first dropdown
    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc1');
    fireEvent.change(taxCategory, { target: { value: 'tc1' } });
    expect(screen.getByDisplayValue(/VAT/)).toBeInTheDocument();

    // also check that choosing a category affects computed amounts
    const qtyInput = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const priceInput = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    // change quantity and price
    fireEvent.change(qtyInput, { target: { value: '2' } });
    fireEvent.change(priceInput, { target: { value: '100' } });
    // subtotal should now reflect net 200 and vat 24; amount column shows 200
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('200');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('24');
    const amt = screen.getByRole('textbox', { name: /Amount line 1/i });
    expect(amt).toBeInTheDocument();
  });

  it('calculates correctly for exclusive vs inclusive pricing', async () => {
    // override spy data with one inclusive and one exclusive category
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc_ex', orgId: 'org1', code: 'EX', description: 'Exclusive VAT', taxType: 'VAT', rate: 0.12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tc_in', orgId: 'org1', code: 'IN', description: 'Inclusive VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc_ex');
    // pick exclusive first
    fireEvent.change(taxCategory, { target: { value: 'tc_ex' } });
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.change(price, { target: { value: '100' } });
    // amount column should show net 100 (vat kept separate)
    expect(screen.getByRole('textbox', { name: /Amount line 1/i })).toHaveValue('100.00');
    // totals should show subtotal 100, VAT 12, grand total 112
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('100');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('12');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('112');

    // now switch to inclusive category
    fireEvent.change(taxCategory, { target: { value: 'tc_in' } });
    // amount should now equal entered price (100) and vat derived from gross
    expect(screen.getByRole('textbox', { name: /Amount line 1/i })).toHaveValue('100.00');
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('89.29');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('10.71');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

  it('lets user override amount and recalculates tax accordingly', async () => {
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    // set exclusive category
    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc1');
    fireEvent.change(taxCategory, { target: { value: 'tc1' } });

    // manually override amount to 100; since exclusive, VAT=12 -> total shown separately
    const amountInput = screen.getByRole('textbox', { name: /Amount line 1/i });
    fireEvent.change(amountInput, { target: { value: '100' } });
    // amount column shows net only
    expect(amountInput).toHaveValue('100.00');
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('100');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('12');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('112');

    // quantity and unit price edits intentionally restore the calculated amount
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '5' } });
    fireEvent.change(price, { target: { value: '200' } });
    expect(amountInput).toHaveValue('1,000.00');

    // change category to inclusive, tax should be derived from gross 100
    fireEvent.change(taxCategory, { target: { value: 'tc2' } });
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent('1,000');
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('1,000');
  });

  it('computes VAT correctly for inclusive categories (VATGOODS or VATSERV)', async () => {
    // inclusive tax categories should extract VAT from the gross amount using
    // the formula: (gross ÷ (1 + rate)) × rate.  behaviour must be identical
    // whether the code is "VATGOODS" or "VatServ".
    const cats = [
      { id: 'tc_vs', orgId: 'org1', code: 'VatServ', description: 'Service VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' },
      { id: 'tc_g', orgId: 'org1', code: 'VATGOODS', description: 'Goods VAT', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ];
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue(cats);
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc_vs');
    fireEvent.change(taxCategory, { target: { value: 'tc_vs' } });
    const qty2 = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price2 = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty2, { target: { value: '10' } });
    fireEvent.change(price2, { target: { value: '3972' } });

    const gross = 10 * 3972;          // 39,720
    const expectedVat = Math.round((gross / 1.12 * 0.12) * 100) / 100; // 4,251.43
    const expectedNet = Math.round((gross - expectedVat) * 100) / 100; // 35,468.57

    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent(expectedNet.toLocaleString('en-US'));
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent(expectedVat.toLocaleString('en-US'));
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent(gross.toLocaleString('en-US'));

    // switch to the other category and ensure amounts remain unchanged
    fireEvent.change(taxCategory, { target: { value: 'tc_g' } });
    expect(screen.getByText(/Subtotal:/i).nextSibling).toHaveTextContent(expectedNet.toLocaleString('en-US'));
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent(expectedVat.toLocaleString('en-US'));
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent(gross.toLocaleString('en-US'));
  });

  it('does not charge output VAT for non-VAT, exempt, and zero-rated categories', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tc_nv', orgId: 'org1', code: 'NVGOODS', description: 'Non‑VAT Goods', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' },
      { id: 'tc_ex', orgId: 'org1', code: 'EXMPTGOODS', description: 'Exempt Goods', taxType: 'VAT', rate: 0.12, isInclusive: true, outputAccountId: '', createdAt: '' },
      { id: 'tc_z', orgId: 'org1', code: 'ZEROGOODS', description: 'Zero‑rate Goods', taxType: 'VAT', rate: 0, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc_nv');
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '5' } });
    fireEvent.change(price, { target: { value: '112' } });
    const gross = 5 * 112; // 560
    // These classifications all carry zero output VAT.
    fireEvent.change(taxCategory, { target: { value: 'tc_nv' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');

    fireEvent.change(taxCategory, { target: { value: 'tc_ex' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');

    // Zero rate results in 0 VAT
    fireEvent.change(taxCategory, { target: { value: 'tc_z' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('0');
  });

  it('fetches and displays categories when prop is empty', async () => {
    const props = { ...baseProps, taxCategories: [] };
    render(<InvoicesView {...props} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    // wait for fetch call and dropdown update
    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tc1');
    expect(SupabaseDataService.prototype.fetchTaxCategories).toHaveBeenCalledWith('org1');
  });

  it('does not modify amount when tax category is changed', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tcX', orgId: 'org1', code: 'X', description: 'VAT 12%', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const amountInput = screen.getByRole('textbox', { name: /Amount line 1/i });
    fireEvent.change(amountInput, { target: { value: '250' } });

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tcX');
    fireEvent.change(taxCategory, { target: { value: 'tcX' } });

    expect(amountInput).toHaveValue('250.00');
  });

  it('preserves line values when a batch is selected after lines exist', () => {
    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const descInput = screen.getByPlaceholderText('Description');
    const priceInput = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    const amountInput = screen.getByRole('textbox', { name: /Amount line 1/i });

    fireEvent.change(descInput, { target: { value: 'Manual item' } });
    fireEvent.change(priceInput, { target: { value: '150' } });
    fireEvent.change(amountInput, { target: { value: '150' } });

    // simulate selecting a batch
    const batchSelect = screen.getByRole('combobox', { name: /Select Batch/i });
    fireEvent.change(batchSelect, { target: { value: 'someBatch' } });

    expect(descInput).toHaveValue('Manual item');
    expect(priceInput).toHaveValue('150.00');
    expect(amountInput).toHaveValue('150');
  });

  it('normalizes percentage rates and computes vat correctly for both inclusive and exclusive', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchTaxCategories').mockResolvedValue([
      { id: 'tcExPerc', orgId: 'org1', code: 'VAT12', description: '12% exclusive', taxType: 'VAT', rate: 12, isInclusive: false, outputAccountId: '', createdAt: '' },
      { id: 'tcInPerc', orgId: 'org1', code: 'VAT12I', description: '12% inclusive', taxType: 'VAT', rate: 12, isInclusive: true, outputAccountId: '', createdAt: '' }
    ]);

    render(<InvoicesView {...baseProps} taxCategories={[]} />);
    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));
    const qty = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    const price = screen.getByRole('textbox', { name: /Unit Price line 1/i });
    fireEvent.change(qty, { target: { value: '1' } });
    fireEvent.change(price, { target: { value: '100' } });

    const taxCategory = screen.getByRole('combobox', { name: /Tax Category line 1/i });
    await waitForTaxOption(taxCategory, 'tcExPerc');
    // exclusive first
    fireEvent.change(taxCategory, { target: { value: 'tcExPerc' } });
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('12');
    // now inclusive
    fireEvent.change(taxCategory, { target: { value: 'tcInPerc' } });
    // VAT on 100 gross should be 10.71
    expect(screen.getByText(/^VAT:$/i).nextSibling).toHaveTextContent('10.71');
    // grand total should equal the gross base of 100
    expect(screen.getByText(/Grand Total:/i).nextSibling).toHaveTextContent('100');
  });

  it('maps all active course fees and populates all line fields in Non-Invoice Payment form', async () => {
    const onAddInvoice = vi.fn();
    render(
      <InvoicesView
        {...baseProps}
        documentMode="NON_INVOICE_PAYMENT"
        onAddInvoice={onAddInvoice}
        sponsors={[
          { id: 'cust-1', orgId: 'org1', name: 'Walk-in Customer', customerType: 'INDIVIDUAL', createdAt: '' }
        ]}
        qualifications={[
          { id: 'qual-forklift', orgId: 'org1', code: 'FORKLIFT-NC2', name: 'Forklift Operation NC II', durationDays: 10, createdAt: '' },
          { id: 'qual-bpp', orgId: 'org1', code: 'BPP-NC2', name: 'Bread and Pastry Production NC II', durationDays: 18, createdAt: '' }
        ]}
        accounts={[
          { id: 'acc-cash', orgId: 'org1', code: '1010', name: 'Cash on Hand', class: 'ASSET', isHeader: false, createdAt: '' },
          { id: 'acc-tuition', orgId: 'org1', code: '4100', name: 'Tuition Fee Income', class: 'REVENUE', isHeader: false, createdAt: '' },
          { id: 'acc-assess', orgId: 'org1', code: '4114', name: 'Assessment Fee Income', class: 'REVENUE', isHeader: false, createdAt: '' }
        ]}
        courseFees={[
          {
            id: 'fee-priv',
            orgId: 'org1',
            feeCode: 'FORKLIFT-003',
            qualificationId: 'qual-forklift',
            fundingType: 'PRIVATE',
            feeName: 'FORKLIFT NC2 TUITION FEE',
            amount: 45000,
            glAccountId: 'acc-tuition',
            taxCategoryId: 'tc2',
            isSubjectToEwt: false,
            category: 'TUITION',
            isActive: true,
            createdAt: ''
          },
          {
            id: 'fee-spon',
            orgId: 'org1',
            feeCode: 'BPP-002',
            qualificationId: 'qual-bpp',
            fundingType: 'SPONSORED',
            feeName: 'BREAD AND PASTRY NCII ASSESSMENT FEE',
            amount: 1755,
            glAccountId: 'acc-assess',
            taxCategoryId: '',
            isSubjectToEwt: false,
            category: 'ASSESSMENT',
            isActive: true,
            createdAt: ''
          },
          {
            id: 'fee-inactive',
            orgId: 'org1',
            feeCode: 'OLD-001',
            qualificationId: 'qual-bpp',
            fundingType: 'PRIVATE',
            feeName: 'INACTIVE LEGACY FEE',
            amount: 500,
            glAccountId: 'acc-tuition',
            isSubjectToEwt: false,
            isActive: false,
            createdAt: ''
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText(/New Non-Invoice Payment/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const courseFeeCombobox = screen.getByRole('combobox', { name: /Search course fee by name or code/i });
    fireEvent.focus(courseFeeCombobox);

    // Lists all active course fees across qualifications and funding types with feeName first, excluding inactive ones
    expect(screen.getByRole('option', { name: /BREAD AND PASTRY NCII ASSESSMENT FEE - BPP-002/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /FORKLIFT NC2 TUITION FEE - FORKLIFT-003/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /OLD-001/i })).toBeNull();

    // Select first fee and verify full field mapping
    fireEvent.click(screen.getByRole('option', { name: /FORKLIFT NC2 TUITION FEE - FORKLIFT-003/i }));
    expect(courseFeeCombobox).toHaveValue('FORKLIFT NC2 TUITION FEE - FORKLIFT-003');
    expect(screen.getByText('FORKLIFT-NC2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description')).toHaveValue('Tuition');
    expect(screen.getByRole('textbox', { name: /Unit Price line 1/i })).toHaveValue('45,000.00');
    expect(screen.getByRole('textbox', { name: /Amount line 1/i })).toHaveValue('45,000.00');
    expect(screen.getByRole('combobox', { name: /Tax Category line 1/i })).toHaveValue('tc2');
    expect(screen.getByText(/4100 - Tuition Fee Income/i)).toBeInTheDocument();

    // Re-focusing after selection still exposes all active course fees without requiring manual text deletion
    fireEvent.focus(courseFeeCombobox);
    expect(screen.getByRole('option', { name: /BREAD AND PASTRY NCII ASSESSMENT FEE - BPP-002/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /FORKLIFT NC2 TUITION FEE - FORKLIFT-003/i })).toBeInTheDocument();

    // Save Non-Invoice Payment and verify classificationCode & mapped fields persist on the line
    fireEvent.change(screen.getByDisplayValue('Select Sponsor'), { target: { value: 'cust-1' } });
    fireEvent.change(screen.getByPlaceholderText('Invoice notes or memo...'), { target: { value: 'Walk-in tuition cash payment' } });
    fireEvent.click(screen.getByTitle('Save as Draft'));

    expect(onAddInvoice).toHaveBeenCalledTimes(1);
    const savedInvoice = onAddInvoice.mock.calls[0][0] as Invoice;
    expect(savedInvoice.documentType).toBe('NON_INVOICE_PAYMENT');
    expect(savedInvoice.lines[0]).toMatchObject({
      courseFeeId: 'fee-priv',
      lineType: 'COURSE_FEE',
      classificationCode: 'FORKLIFT-NC2',
      description: 'Tuition',
      glAccountId: 'acc-tuition',
      taxCategoryId: 'tc2',
      unitPrice: 45000,
      amount: 45000,
    });
  });

  it('clears mapped course fee and reverts line to MANUAL when cleared in Non-Invoice Payment form', async () => {
    render(
      <InvoicesView
        {...baseProps}
        documentMode="NON_INVOICE_PAYMENT"
        qualifications={[
          { id: 'qual-forklift', orgId: 'org1', code: 'FORKLIFT-NC2', name: 'Forklift Operation NC II', durationDays: 10, createdAt: '' }
        ]}
        courseFees={[
          {
            id: 'fee-priv',
            orgId: 'org1',
            feeCode: 'FORKLIFT-003',
            qualificationId: 'qual-forklift',
            fundingType: 'PRIVATE',
            feeName: 'FORKLIFT NC2 TUITION FEE',
            amount: 45000,
            glAccountId: 'acc-tuition',
            isSubjectToEwt: false,
            category: 'TUITION',
            isActive: true,
            createdAt: ''
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText(/New Non-Invoice Payment/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    const courseFeeCombobox = screen.getByRole('combobox', { name: /Search course fee by name or code/i });
    fireEvent.focus(courseFeeCombobox);
    fireEvent.click(screen.getByRole('option', { name: /FORKLIFT NC2 TUITION FEE - FORKLIFT-003/i }));
    expect(screen.getByDisplayValue('COURSE FEE')).toBeInTheDocument();
    expect(screen.getByText('FORKLIFT-NC2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear selected course fee/i }));
    expect(courseFeeCombobox).toHaveValue('');
    expect(screen.getByDisplayValue('MANUAL')).toBeInTheDocument();
    expect(screen.queryByText('FORKLIFT-NC2')).toBeNull();
  });

  it('supports standalone batch-independent invoices with searchable course fees, all customer types, and editable descriptions', async () => {
    const onAddInvoice = vi.fn();
    render(
      <InvoicesView
        {...baseProps}
        documentMode="INVOICE"
        onAddInvoice={onAddInvoice}
        sponsors={[
          { id: 'cust-corp', orgId: 'org1', name: 'Acme Logistics Corp', customerType: 'CORPORATE', createdAt: '' },
          { id: 'spon-tesda', orgId: 'org1', name: 'TESDA Regional Office', customerType: 'SPONSOR', createdAt: '' }
        ]}
        qualifications={[
          { id: 'qual-forklift', orgId: 'org1', code: 'FORKLIFT-NC2', name: 'Forklift Operation NC II', durationDays: 10, createdAt: '' },
          { id: 'qual-bpp', orgId: 'org1', code: 'BPP-NC2', name: 'Bread and Pastry Production NC II', durationDays: 18, createdAt: '' }
        ]}
        accounts={[
          { id: 'acc-ar', orgId: 'org1', code: '11110', name: 'Accounts Receivable - Sponsor', class: 'ASSET', isHeader: false, createdAt: '' },
          { id: 'acc-tuition', orgId: 'org1', code: '4100', name: 'Tuition Fee Income', class: 'REVENUE', isHeader: false, createdAt: '' },
          { id: 'acc-assess', orgId: 'org1', code: '4114', name: 'Assessment Fee Income', class: 'REVENUE', isHeader: false, createdAt: '' }
        ]}
        courseFees={[
          {
            id: 'fee-priv',
            orgId: 'org1',
            feeCode: 'FORKLIFT-003',
            qualificationId: 'qual-forklift',
            fundingType: 'PRIVATE',
            feeName: 'FORKLIFT NC2 TUITION FEE',
            amount: 45000,
            glAccountId: 'acc-tuition',
            taxCategoryId: 'tc2',
            isSubjectToEwt: false,
            category: 'TUITION',
            isActive: true,
            createdAt: ''
          },
          {
            id: 'fee-spon',
            orgId: 'org1',
            feeCode: 'BPP-002',
            qualificationId: 'qual-bpp',
            fundingType: 'SPONSORED',
            feeName: 'BREAD AND PASTRY NCII ASSESSMENT FEE',
            amount: 1755,
            glAccountId: 'acc-assess',
            taxCategoryId: 'tc2',
            isSubjectToEwt: false,
            category: 'ASSESSMENT',
            isActive: true,
            createdAt: ''
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText(/New Invoice/i));
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));

    // Without a batch selected, non-SPONSOR customers (e.g. CORPORATE) are selectable
    const customerSelect = screen.getByRole('combobox', { name: /Customer \/ Sponsor/i });
    fireEvent.change(customerSelect, { target: { value: 'cust-corp' } });
    expect(customerSelect).toHaveValue('cust-corp');

    // Searchable course fee combobox exposes all active fees regardless of batch or funding type
    const courseFeeCombobox = screen.getByRole('combobox', { name: /Search course fee by name or code/i });
    fireEvent.focus(courseFeeCombobox);
    expect(screen.getByRole('option', { name: /FORKLIFT NC2 TUITION FEE - FORKLIFT-003/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /BREAD AND PASTRY NCII ASSESSMENT FEE - BPP-002/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /FORKLIFT NC2 TUITION FEE - FORKLIFT-003/i }));
    expect(screen.getByText('FORKLIFT-NC2')).toBeInTheDocument();

    // Description auto-populates from course fee AND stays editable when no batch is selected
    const descInput = screen.getByPlaceholderText('Description');
    expect(descInput).not.toBeDisabled();
    expect(descInput).toHaveValue('Tuition');
    fireEvent.change(descInput, { target: { value: 'Tuition - Corporate Advance Reservation' } });

    // Quantity can be adjusted freely on standalone invoices
    const qtyInput = screen.getByRole('spinbutton', { name: /Quantity line 1/i });
    fireEvent.change(qtyInput, { target: { value: '3' } });
    expect(screen.getByRole('textbox', { name: /Amount line 1/i })).toHaveValue('135,000.00');
    expect(screen.getByText(/4100 - Tuition Fee Income/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Invoice notes or memo...'), { target: { value: 'Advance corporate training invoice before batch scheduling' } });
    fireEvent.click(screen.getByTitle('Approve'));

    expect(onAddInvoice).toHaveBeenCalledTimes(1);
    const savedInvoice = onAddInvoice.mock.calls[0][0] as Invoice;
    expect(savedInvoice.documentType).toBe('INVOICE');
    expect(savedInvoice.batchId).toBeUndefined();
    expect(savedInvoice.sponsorId).toBe('cust-corp');
    expect(savedInvoice.status).toBe('OPEN');
    expect(savedInvoice.grandTotal).toBe(135000);
    expect(savedInvoice.lines[0]).toMatchObject({
      courseFeeId: 'fee-priv',
      lineType: 'COURSE_FEE',
      classificationCode: 'FORKLIFT-NC2',
      description: 'Tuition - Corporate Advance Reservation',
      glAccountId: 'acc-tuition',
      taxCategoryId: 'tc2',
      quantity: 3,
      unitPrice: 45000,
      amount: 135000,
    });
  });

  it('detaches batch course fee lines while preserving payer and manual lines when clearing an optional batch', async () => {
    vi.spyOn(SupabaseDataService.prototype, 'fetchBillingCourseFeeInvoice').mockResolvedValue([] as any);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <InvoicesView
        {...baseProps}
        sponsors={[
          { id: 'spon-1', orgId: 'org1', name: 'OWWA XI', customerType: 'SPONSOR', createdAt: '' }
        ]}
        qualifications={[
          { id: 'qual-1', orgId: 'org1', code: 'HEO-NC2', name: 'Heavy Equipment Operation NC II', durationDays: 10, createdAt: '' }
        ]}
        batches={[
          {
            id: 'batch-1',
            orgId: 'org1',
            batchCode: 'HEO-B1',
            name: 'Batch 1',
            year: 2026,
            qualificationId: 'qual-1',
            trainerId: 'tr-1',
            sponsorId: 'spon-1',
            studentIds: ['st-1'],
            status: 'ONGOING',
            startDate: '2026-10-01',
            endDate: '2026-10-20',
            createdAt: ''
          }
        ]}
        enrollments={[
          {
            id: 'enr-1',
            orgId: 'org1',
            studentId: 'st-1',
            batchId: 'batch-1',
            qualificationId: 'qual-1',
            sponsorId: 'spon-1',
            billingType: 'BILLABLE',
            billingStatus: 'UNBILLED',
            enrollmentStatus: 'ACTIVE',
            registrationDate: '2026-10-01',
            createdAt: ''
          }
        ]}
        courseFees={[
          {
            id: 'fee-1',
            orgId: 'org1',
            feeCode: 'HEO-001',
            qualificationId: 'qual-1',
            fundingType: 'SPONSORED',
            feeName: 'HEO Sponsored Tuition',
            amount: 12000,
            taxCategoryId: 'tc2',
            isSubjectToEwt: false,
            category: 'TUITION',
            isActive: true,
            createdAt: ''
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText(/New Invoice/i));
    const batchSelect = screen.getByRole('combobox', { name: /Select Batch/i });
    fireEvent.change(batchSelect, { target: { value: 'batch-1' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tuition')).toBeInTheDocument();
    });

    // Add a manual line alongside the batch course fee line
    fireEvent.click(screen.getByRole('button', { name: /Add Line/i }));
    const descInputs = screen.getAllByPlaceholderText('Description');
    fireEvent.change(descInputs[1], { target: { value: 'Custom mobilization fee' } });

    // Clear optional batch selection
    fireEvent.change(batchSelect, { target: { value: '' } });

    expect(batchSelect).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /Customer \/ Sponsor/i })).toHaveValue('spon-1');
    expect(screen.queryByDisplayValue('Tuition')).toBeNull();
    expect(screen.getByDisplayValue('Custom mobilization fee')).toBeInTheDocument();
  });

  it('nullifies cleared batch_id on draft updateInvoice without affecting accounting-locked partial updates', async () => {
    const service = new SupabaseDataService();
    const guardSpy = vi.spyOn(service as any, 'getInvoiceRawForGuard');
    const updateSpy = vi.spyOn(service as any, 'updateInSupabase').mockResolvedValue({ id: 'inv-1' });
    vi.spyOn(service as any, 'deleteByFilter').mockResolvedValue(undefined);
    vi.spyOn(service, 'createInvoiceLines').mockResolvedValue([]);

    // Draft invoice detaching batchId: undefined -> batch_id: null
    guardSpy.mockResolvedValueOnce({ id: 'inv-1', status: 'DRAFT', journal_entry_id: null, posted_at: null });
    await service.updateInvoice('inv-1', {
      id: 'inv-1',
      orgId: 'org1',
      sponsorId: 'spon-1',
      studentId: undefined,
      batchId: undefined,
      status: 'ON_HOLD',
      lines: []
    });

    expect(updateSpy).toHaveBeenCalledWith(
      'invoices',
      'inv-1',
      expect.objectContaining({
        sponsor_id: 'spon-1',
        student_id: null,
        batch_id: null,
        status: 'DRAFT'
      })
    );

    // Posted/locked partial payment status update must NOT inject disallowed null fields
    updateSpy.mockClear();
    guardSpy.mockResolvedValueOnce({ id: 'inv-1', status: 'OPEN', journal_entry_id: 'je-1', posted_at: '2026-10-29T00:00:00Z' });
    await service.updateInvoice('inv-1', {
      status: 'CLOSED',
      amountPaid: 1000,
      balanceDue: 0
    });

    expect(updateSpy).toHaveBeenCalledWith(
      'invoices',
      'inv-1',
      expect.objectContaining({
        status: 'CLOSED',
        amount_paid: 1000,
        balance_due: 0
      })
    );
    const lockedPayload = updateSpy.mock.calls[0][2] as Record<string, unknown>;
    expect(lockedPayload).not.toHaveProperty('batch_id');
  });

  it('displays creator names instead of raw user IDs in the Created By column across id, authUid, currentUser, and RPC map', async () => {
    const pageRows: Invoice[] = [
      {
        id: 'inv-u1',
        orgId: 'org1',
        invoiceNo: 'INV-2026-0001',
        invoiceDate: '2026-10-20',
        dueDate: '2026-11-19',
        status: 'OPEN',
        vatPricing: 'EXEMPT',
        vatRate: 0,
        subtotal: 1500,
        vatAmount: 0,
        grandTotal: 1500,
        totalEwtAmount: 0,
        netAmountDue: 1500,
        amountPaid: 0,
        balanceDue: 1500,
        lines: [],
        createdBy: '11111111-1111-4111-8111-111111111111',
        createdAt: '2026-10-20T08:00:00Z'
      },
      {
        id: 'inv-auth',
        orgId: 'org1',
        invoiceNo: 'INV-2026-0002',
        invoiceDate: '2026-10-21',
        dueDate: '2026-11-20',
        status: 'OPEN',
        vatPricing: 'EXEMPT',
        vatRate: 0,
        subtotal: 2500,
        vatAmount: 0,
        grandTotal: 2500,
        totalEwtAmount: 0,
        netAmountDue: 2500,
        amountPaid: 0,
        balanceDue: 2500,
        lines: [],
        createdBy: '22222222-2222-4222-8222-222222222222',
        createdAt: '2026-10-21T08:00:00Z'
      },
      {
        id: 'inv-sysadmin',
        orgId: 'org1',
        invoiceNo: 'INV-2026-0003',
        invoiceDate: '2026-10-22',
        dueDate: '2026-11-21',
        status: 'OPEN',
        vatPricing: 'EXEMPT',
        vatRate: 0,
        subtotal: 3500,
        vatAmount: 0,
        grandTotal: 3500,
        totalEwtAmount: 0,
        netAmountDue: 3500,
        amountPaid: 0,
        balanceDue: 3500,
        lines: [],
        createdBy: '33333333-3333-4333-8333-333333333333',
        createdAt: '2026-10-22T08:00:00Z'
      },
      {
        id: 'inv-rpc',
        orgId: 'org1',
        invoiceNo: 'INV-2026-0004',
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-22',
        status: 'OPEN',
        vatPricing: 'EXEMPT',
        vatRate: 0,
        subtotal: 4500,
        vatAmount: 0,
        grandTotal: 4500,
        totalEwtAmount: 0,
        balanceDue: 4500,
        netAmountDue: 4500,
        amountPaid: 0,
        lines: [],
        createdBy: '44444444-4444-4444-8444-444444444444',
        createdAt: '2026-10-23T08:00:00Z'
      }
    ];

    vi.spyOn(SupabaseDataService.prototype, 'fetchPage').mockResolvedValue({
      rows: pageRows,
      total: pageRows.length,
      page: 1,
      pageSize: 25,
      totalPages: 1
    });
    vi.spyOn(SupabaseDataService.prototype, 'getInvoiceCreatorNames').mockResolvedValue({
      '44444444-4444-4444-8444-444444444444': 'Platform Support Admin'
    });

    render(
      <InvoicesView
        {...baseProps}
        invoices={pageRows}
        users={[
          {
            id: '11111111-1111-4111-8111-111111111111',
            orgId: 'org1',
            name: 'Maria',
            lastName: 'Santos',
            email: 'maria@org1.edu',
            role: 'AR_SPECIALIST',
            createdAt: ''
          },
          {
            id: 'user-row-2',
            authUid: '22222222-2222-4222-8222-222222222222',
            orgId: 'org1',
            name: 'Juan Dela Cruz',
            lastName: 'Dela Cruz',
            email: 'juan@org1.edu',
            role: 'ACCOUNTANT',
            createdAt: ''
          } as any
        ]}
        currentUser={{
          id: '33333333-3333-4333-8333-333333333333',
          orgId: 'platform-org',
          name: 'Angela',
          lastName: 'Reyes',
          email: 'angela@platform.com',
          role: 'SYSTEM_ADMIN',
          createdAt: ''
        }}
      />
    );

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(screen.getByText('Angela Reyes')).toBeInTheDocument();
    expect(await screen.findByText('Platform Support Admin')).toBeInTheDocument();

    expect(screen.queryByText('11111111-1111-4111-8111-111111111111')).toBeNull();
    expect(screen.queryByText('22222222-2222-4222-8222-222222222222')).toBeNull();
    expect(screen.queryByText('33333333-3333-4333-8333-333333333333')).toBeNull();
    expect(screen.queryByText('44444444-4444-4444-8444-444444444444')).toBeNull();

    // Sorting by Created By uses resolved names cleanly without throwing
    fireEvent.click(screen.getByText('Created By'));
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows[0]).toHaveTextContent('Angela Reyes');
  });

});
