import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CourseFeesView, { getAvailableFeeCode } from '../views/CourseFeesView';
import { ChartOfAccount, CourseFee, Qualification } from '../types';

describe('course fee code generation', () => {
  it('uses the first available code instead of relying on the fee count', () => {
    expect(getAvailableFeeCode('HEOHE-NCII', ['HEO-FEE-001', 'HEO-FEE-003']))
      .toBe('HEO-FEE-002');
  });

  it('does not collide with a custom or previously generated code', () => {
    expect(getAvailableFeeCode('HEOHE-NCII', [
      'heo-fee-001',
      'HEO-FEE-002',
      'HEO-FEE-004',
    ])).toBe('HEO-FEE-003');
  });
});

describe('CourseFeesView notifications', () => {
  const qualifications: Qualification[] = [
    {
      id: 'qual-1',
      orgId: 'org-1',
      code: 'HEO-NCII',
      name: 'Heavy Equipment Operation NC II',
      durationHours: 160,
      isActive: true,
    },
  ];

  const accounts: ChartOfAccount[] = [
    {
      id: 'acc-rev-1',
      orgId: 'org-1',
      code: '4101',
      name: 'Tuition Revenue',
      type: 'REVENUE',
      balance: 0,
      isActive: true,
    },
  ];

  const existingFee: CourseFee = {
    id: 'fee-1',
    orgId: 'org-1',
    feeCode: 'HEO-FEE-001',
    qualificationId: 'qual-1',
    fundingType: 'PRIVATE',
    feeName: 'Tuition Fee',
    amount: 5000,
    glAccountId: 'acc-rev-1',
    category: 'TUITION',
    isSubjectToEwt: false,
    isActive: true,
  };

  it('does not render a duplicate top-right toast when updating a course fee', async () => {
    const onUpdateCourseFee = vi.fn().mockResolvedValue(undefined);
    const onNotify = vi.fn();

    render(
      <CourseFeesView
        courseFees={[existingFee]}
        qualifications={qualifications}
        accounts={accounts}
        onAddCourseFee={vi.fn()}
        onUpdateCourseFee={onUpdateCourseFee}
        onDeleteCourseFee={vi.fn()}
        onNotify={onNotify}
      />
    );

    const rowButtons = screen.getAllByRole('button');
    const editButton = rowButtons.find(btn => btn.className.includes('p-2 hover:bg-brand-light'));
    expect(editButton).toBeDefined();
    fireEvent.click(editButton!);

    fireEvent.click(screen.getByRole('button', { name: 'Update Fee' }));

    await waitFor(() => {
      expect(onUpdateCourseFee).toHaveBeenCalledTimes(1);
    });

    expect(document.querySelector('.top-4.right-4')).toBeNull();
    expect(screen.queryByText(/updated successfully!/i)).toBeNull();
  });

  it('displays the Funding Type column and badge in the Course Fees Catalog table', () => {
    render(
      <CourseFeesView
        courseFees={[
          existingFee,
          { ...existingFee, id: 'fee-2', feeCode: 'HEO-FEE-002', fundingType: 'TESDA_SCHOLARSHIP', feeName: 'Scholarship Assessment' },
        ]}
        qualifications={qualifications}
        accounts={accounts}
        onAddCourseFee={vi.fn()}
        onUpdateCourseFee={vi.fn()}
        onDeleteCourseFee={vi.fn()}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Funding Type' })).toBeDefined();
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('Private');
    expect(table.textContent).toContain('TESDA Scholarship');
  });
});
