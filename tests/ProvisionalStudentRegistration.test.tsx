import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InvoicesView from '../views/InvoicesView';
import StudentsView from '../views/StudentsView';
import { Student, isProvisionalStudent } from '../types';

describe('Provisional Student AR Billing and Registrar Completion Workflow', () => {
  const mockOrgId = 'org-test-123';

  const provisionalStudent: Student = {
    id: 'student-prov-1',
    orgId: mockOrgId,
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    middleName: 'Protacio',
    email: 'juan@example.com',
    contactNumber: '09171234567',
    registrationStatus: 'PROVISIONAL',
    documents: [
      {
        id: 'doc-provisional-student-prov-1',
        name: 'Provisional AR Registration',
        type: 'OTHER',
        status: 'PENDING',
        url: '',
        uploadedAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString()
  };

  const registeredStudent: Student = {
    id: 'student-reg-1',
    orgId: mockOrgId,
    firstName: 'Maria',
    lastName: 'Clara',
    uli: 'ULI-999-111',
    email: 'maria@example.com',
    registrationStatus: 'REGISTERED',
    documents: [],
    createdAt: new Date().toISOString()
  };

  it('correctly identifies provisional students via isProvisionalStudent helper', () => {
    expect(isProvisionalStudent(provisionalStudent)).toBe(true);
    expect(isProvisionalStudent(registeredStudent)).toBe(false);

    // Fallback detection via document marker
    const fallbackStudent: Student = {
      id: 'student-fb',
      orgId: mockOrgId,
      firstName: 'Crisostomo',
      lastName: 'Ibarra',
      documents: [
        {
          id: 'doc-1',
          name: 'Provisional AR Registration',
          type: 'OTHER',
          status: 'PENDING',
          url: '',
          uploadedAt: ''
        }
      ],
      createdAt: ''
    };
    expect(isProvisionalStudent(fallbackStudent)).toBe(true);
  });

  it('AR InvoicesView allows quick-adding an unregistered student and selects them for billing', async () => {
    const onAddStudent = vi.fn().mockImplementation(async (st: Student) => ({
      ...st,
      id: 'student-new-provisional'
    }));
    const onAddInvoice = vi.fn();

    render(
      <InvoicesView
        orgId={mockOrgId}
        invoices={[]}
        students={[registeredStudent]}
        sponsors={[]}
        batches={[]}
        qualifications={[]}
        courseFees={[]}
        accounts={[]}
        taxCategories={[]}
        currency="PHP"
        onAddInvoice={onAddInvoice}
        onUpdateInvoice={vi.fn()}
        onDeleteInvoice={vi.fn().mockResolvedValue(true)}
        onAddStudent={onAddStudent}
      />
    );

    // Open new invoice form
    fireEvent.click(screen.getByText(/New Invoice/i));

    // Click "Bill Unregistered" button next to Student label
    const billUnregisteredBtn = screen.getByRole('button', { name: /Bill Unregistered/i });
    expect(billUnregisteredBtn).toBeInTheDocument();
    fireEvent.click(billUnregisteredBtn);

    // Modal opens
    expect(screen.getByText(/Bill Unregistered Learner/i)).toBeInTheDocument();
    const firstNameInput = screen.getByPlaceholderText(/e\.g\. Maria/i);
    const lastNameInput = screen.getByPlaceholderText(/e\.g\. Santos/i);

    fireEvent.change(firstNameInput, { target: { value: 'Basilio' } });
    fireEvent.change(lastNameInput, { target: { value: 'Sisa' } });

    // Submit modal
    const submitBtn = screen.getByRole('button', { name: /Create & Select for Invoice/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAddStudent).toHaveBeenCalledTimes(1);
    });

    const createdStudent = onAddStudent.mock.calls[0][0] as Student;
    expect(createdStudent.firstName).toBe('Basilio');
    expect(createdStudent.lastName).toBe('Sisa');
    expect(createdStudent.registrationStatus).toBe('PROVISIONAL');
    expect(createdStudent.documents?.some(d => d.name === 'Provisional AR Registration')).toBe(true);
  });

  it('Registrar StudentsView filters provisional learners and provides complete registration action', async () => {
    const onUpdateStudent = vi.fn();

    render(
      <StudentsView
        orgId={mockOrgId}
        brandColor="#f97316"
        students={[registeredStudent, provisionalStudent]}
        batches={[]}
        qualifications={[]}
        onAddStudent={vi.fn()}
        onUpdateStudent={onUpdateStudent}
        onDeleteStudent={vi.fn()}
        onBatchAddStudents={vi.fn()}
      />
    );

    // Banner notifies registrar about provisional learners
    expect(screen.getByText(/unregistered learner was billed by AR/i)).toBeInTheDocument();

    // Table lists both students, provisional has badge
    expect(screen.getByText(/Billed by AR \(Provisional\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Pending Full Registration/i)).toBeInTheDocument();

    // Filter to provisional
    const filterSelect = screen.getByRole('combobox');
    fireEvent.change(filterSelect, { target: { value: 'PROVISIONAL' } });

    expect(screen.getByText(/DELA CRUZ, Juan/i)).toBeInTheDocument();
    expect(screen.queryByText(/CLARA, Maria/i)).toBeNull();

    // Click Complete Registration
    const completeBtn = screen.getByRole('button', { name: /Complete Registration/i });
    fireEvent.click(completeBtn);

    // Edit modal opens with provisional warning and finalized title
    expect(screen.getByText(/Complete Learner Registration/i)).toBeInTheDocument();
    expect(screen.getByText(/Provisional Learner \(Billed by AR\)/i)).toBeInTheDocument();

    // Fill in ULI to complete registration
    const uliInput = screen.getByPlaceholderText(/Enter official ULI/i);
    fireEvent.change(uliInput, { target: { value: 'ULI-2026-COMPLETE' } });

    // Save registration
    const saveBtn = screen.getByRole('button', { name: /Complete & Finalize Registration/i });
    fireEvent.click(saveBtn);

    expect(onUpdateStudent).toHaveBeenCalledTimes(1);
    const updatedStudent = onUpdateStudent.mock.calls[0][0] as Student;
    expect(updatedStudent.id).toBe(provisionalStudent.id);
    expect(updatedStudent.registrationStatus).toBe('REGISTERED');
    expect(updatedStudent.uli).toBe('ULI-2026-COMPLETE');
    // Provisional marker document should be cleaned up
    expect(updatedStudent.documents?.some(d => d.name === 'Provisional AR Registration')).toBe(false);
  });
});
