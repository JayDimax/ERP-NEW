import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import UsersManagementView from '../views/UsersManagementView';
import { User } from '../types';

describe('UsersManagementView', () => {
  const sampleUsers: User[] = [
    {
      id: 'user-1',
      orgId: 'org-1',
      name: 'Juan Dela Cruz',
      email: 'juan@institution.edu',
      role: 'REGISTRAR',
    },
    {
      id: 'sys-1',
      orgId: 'org-1',
      name: 'Platform Owner',
      email: 'root@platform.io',
      role: 'SYSTEM_ADMIN',
    },
  ];

  it('allows editing an organization user role and details while keeping SYSTEM_ADMIN protected', () => {
    const onAddUser = vi.fn();
    const onUpdateUser = vi.fn();
    const onDeleteUser = vi.fn();

    render(
      <UsersManagementView
        users={sampleUsers}
        onAddUser={onAddUser}
        onUpdateUser={onUpdateUser}
        onDeleteUser={onDeleteUser}
      />
    );

    // Only non-SYSTEM_ADMIN user gets an Edit User button
    const editButtons = screen.getAllByTitle('Edit User');
    expect(editButtons).toHaveLength(1);

    fireEvent.click(editButtons[0]);

    expect(screen.getByText('Edit User')).toBeTruthy();

    const nameInput = screen.getByPlaceholderText('e.g. Maria Clara') as HTMLInputElement;
    expect(nameInput.value).toBe('Juan Dela Cruz');
    fireEvent.change(nameInput, { target: { value: 'Juan Dela Cruz Jr.' } });

    // Switch role to Finance Manager
    fireEvent.click(screen.getByRole('button', { name: /Finance Manager/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onUpdateUser).toHaveBeenCalledTimes(1);
    expect(onUpdateUser).toHaveBeenCalledWith('user-1', {
      name: 'Juan Dela Cruz Jr.',
      email: 'juan@institution.edu',
      role: 'FINANCE_MANAGER',
      studentId: undefined,
      trainerId: undefined,
    });
    expect(onAddUser).not.toHaveBeenCalled();
  });
});
