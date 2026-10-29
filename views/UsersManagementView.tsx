
import React, { useState, useMemo, useEffect } from 'react';
import { User, Student, Trainer, Organization } from '../types';
import EmptyState from '../components/EmptyState';
import { generateUUID } from '../utils/uuid';
import ModalPortal from '../components/ModalPortal';
import { 
  UserCog, Search, Plus, Trash2, X, Shield, Users, 
  Key, Mail, Eye, EyeOff, ShieldCheck, UserCircle,
  Pencil, Lock, GraduationCap, Award, AlertCircle, Filter
} from 'lucide-react';

interface UsersManagementViewProps {
  users: User[];
  students?: Student[];
  trainers?: Trainer[];
  organization?: Organization;
  onAddUser: (user: User) => void;
  onUpdateUser?: (id: string, updates: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
}

const ROLES = [
  { id: 'ADMIN', label: 'Administrator', desc: 'Full access to all organization modules', icon: ShieldCheck },
  { id: 'PRESIDENT', label: 'President / Executive', desc: 'Executive dashboards, reports & approvals', icon: Shield },
  { id: 'FINANCE_MANAGER', label: 'Finance Manager', desc: 'Full financial access with approval rights', icon: Shield },
  { id: 'ACCOUNTANT', label: 'Accountant', desc: 'Financial reporting & General Ledger', icon: Users },
  { id: 'AR_SPECIALIST', label: 'AR Specialist', desc: 'Accounts Receivable & Collections', icon: Users },
  { id: 'AP_SUPERVISOR', label: 'AP Supervisor', desc: 'Accounts Payable with approval rights', icon: Shield },
  { id: 'AP_SPECIALIST', label: 'AP Specialist', desc: 'Accounts Payable & Vendor management', icon: Users },
  { id: 'AP_CLERK', label: 'AP Clerk', desc: 'Accounts Payable data entry', icon: Users },
  { id: 'TREASURY', label: 'Treasury', desc: 'Banking & Cash Management', icon: Users },
  { id: 'AUDITOR', label: 'Auditor', desc: 'Read-only financial & audit access', icon: Eye },
  { id: 'REGISTRAR', label: 'Registrar', desc: 'Student, Trainer & Batch Management', icon: Users },
  { id: 'STUDENT', label: 'Student Portal', desc: 'Student self-service portal access', icon: GraduationCap },
  { id: 'TRAINER', label: 'Trainer Portal', desc: 'Trainer schedule & class management', icon: Award },
];

const UsersManagementView: React.FC<UsersManagementViewProps> = ({ 
  users, 
  students = [], 
  trainers = [],
  organization,
  onAddUser, 
  onUpdateUser,
  onDeleteUser 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'REGISTRAR' as string,
    studentId: '' as string,
    trainerId: '' as string,
  });
  const [formError, setFormError] = useState('');
  const brandColor = organization?.primaryColor || '#059669';
  const hasActiveFilters = searchTerm.trim().length > 0 || roleFilter !== 'ALL';

  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand', brandColor);
    }
  }, [brandColor]);

  // Get students/trainers that don't already have user accounts (keep current link when editing)
  const availableStudents = useMemo(() => {
    const linkedStudentIds = new Set(
      users.filter(u => u.studentId && u.id !== editingUser?.id).map(u => u.studentId)
    );
    return students.filter(s => !s.isDeleted && !linkedStudentIds.has(s.id));
  }, [students, users, editingUser]);

  const availableTrainers = useMemo(() => {
    const linkedTrainerIds = new Set(
      users.filter(u => u.trainerId && u.id !== editingUser?.id).map(u => u.trainerId)
    );
    return trainers.filter(t => !t.isDeleted && !linkedTrainerIds.has(t.id));
  }, [trainers, users, editingUser]);

  const selectedStudent = useMemo(
    () => students.find(s => s.id === formData.studentId),
    [students, formData.studentId]
  );

  const selectedTrainer = useMemo(
    () => trainers.find(t => t.id === formData.trainerId),
    [trainers, formData.trainerId]
  );

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'REGISTRAR',
      studentId: '',
      trainerId: '',
    });
    setFormError('');
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'REGISTRAR',
      studentId: user.studentId || '',
      trainerId: user.trainerId || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleRoleChange = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      role: roleId,
      studentId: roleId === 'STUDENT' ? prev.studentId : '',
      trainerId: roleId === 'TRAINER' ? prev.trainerId : '',
    }));
    setFormError('');
  };

  const handleStudentSelect = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setFormData(prev => ({
        ...prev,
        studentId,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email || prev.email,
      }));
    }
  };

  const handleTrainerSelect = (trainerId: string) => {
    const trainer = trainers.find(t => t.id === trainerId);
    if (trainer) {
      setFormData(prev => ({
        ...prev,
        trainerId,
        name: `${trainer.firstName} ${trainer.lastName}`,
        email: trainer.email || prev.email,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!formData.name || !formData.email) {
      setFormError('Name and Email are required');
      return;
    }

    if (!editingUser && (!formData.password || formData.password.length < 8)) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    if (editingUser && formData.password && formData.password.length < 8) {
      setFormError('New password must be at least 8 characters');
      return;
    }

    // Role-specific validation
    if (formData.role === 'STUDENT' && !formData.studentId) {
      setFormError('Please select a student record to link this account to');
      return;
    }

    if (formData.role === 'TRAINER' && !formData.trainerId) {
      setFormError('Please select a trainer record to link this account to');
      return;
    }

    // Check for duplicate email
    if (users.some(u => u.id !== editingUser?.id && u.email.toLowerCase() === formData.email.toLowerCase())) {
      setFormError('A user with this email already exists');
      return;
    }

    if (editingUser) {
      onUpdateUser?.(editingUser.id, {
        name: formData.name,
        email: formData.email,
        role: formData.role as any,
        studentId: formData.role === 'STUDENT' ? formData.studentId : undefined,
        trainerId: formData.role === 'TRAINER' ? formData.trainerId : undefined,
        ...(formData.password ? { password: formData.password } : {}),
      });
      setShowModal(false);
      resetForm();
      return;
    }

    const newUser: User = {
      id: generateUUID(),
      orgId: '', // Will be set by App.tsx
      name: formData.name,
      email: formData.email,
      password: formData.password, // Will be hashed by the service
      role: formData.role as any,
      studentId: formData.role === 'STUDENT' ? formData.studentId : undefined,
      trainerId: formData.role === 'TRAINER' ? formData.trainerId : undefined,
    };

    onAddUser(newUser);
    setShowModal(false);
    resetForm();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'SYSTEM_ADMIN': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'ACCOUNTANT': return 'bg-brand/10 text-brand border-brand-light';
      case 'REGISTRAR': return 'bg-brand/10 text-brand border-brand-light';
      case 'FINANCE_MANAGER': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'AP_SPECIALIST': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
      case 'AR_SPECIALIST': return 'bg-brand/10 text-brand border-brand-light';
      case 'STUDENT': return 'bg-brand/10 text-brand border-brand-light';
      case 'TRAINER': return 'bg-brand/10 text-brand border-brand-light';
      default: return 'bg-gray-50 text-gray-500 border-gray-100';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'SYSTEM_ADMIN':
        return <ShieldCheck size={12} />;
      case 'STUDENT':
        return <GraduationCap size={12} />;
      case 'TRAINER':
        return <Award size={12} />;
      default:
        return <Users size={12} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">
            Users & Security
          </h2>
          <p className="text-sm text-gray-500 font-normal italic">Institutional identity management and role-based access control (RBAC).</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-md shadow-brand/20 font-bold text-sm active:scale-95"
        >
          <Plus size={18} /> Onboard New User
        </button>
      </div>

      <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr_1fr] items-end">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm focus:border-brand outline-none transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value as 'ALL' | string)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm font-semibold text-gray-700 focus:border-brand outline-none transition-all"
            >
              <option value="ALL">All Roles</option>
              {ROLES.map(role => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('ALL');
              }}
              className={`text-sm font-semibold transition-colors ${hasActiveFilters ? 'text-brand hover:text-brand' : 'text-gray-400 hover:text-brand'}`}
            >
              Clear filters
            </button>
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-900">{filteredUsers.length}</span> of <span className="font-semibold text-gray-900">{users.length}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-brand border-b">
            <tr>
              <th className="px-8 py-5 text-left text-xs font-semibold text-white uppercase tracking-wide">System User</th>
              <th className="px-8 py-5 text-left text-xs font-semibold text-white uppercase tracking-wide">Assigned Role</th>
              <th className="px-8 py-5 text-left text-xs font-semibold text-white uppercase tracking-wide">Authentication</th>
              <th className="px-8 py-5 text-right text-xs font-semibold text-white uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length > 0 ? filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded flex items-center justify-center text-white shadow-sm border-2 border-white ${user.role === 'ADMIN' ? 'bg-rose-500' : 'bg-brand'}`}>
                      <UserCircle size={24} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{user.name}</div>
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-0.5">{user.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide ${getRoleBadge(user.role)}`}>
                    {getRoleIcon(user.role)}
                    {user.role}
                  </div>
                  {user.studentId && (
                    <div className="text-xs text-gray-400 mt-1">Linked student ID: {user.studentId}</div>
                  )}
                  {user.trainerId && (
                    <div className="text-xs text-gray-400 mt-1">Linked trainer ID: {user.trainerId}</div>
                  )}
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1">
                    <div className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                      <Mail size={12} className="text-gray-300" /> {user.email}
                    </div>
                    <div className="text-xs font-mono text-gray-300">Last login: Today 10:42 AM</div>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onUpdateUser && user.role !== 'SYSTEM_ADMIN' && (
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="p-2 hover:bg-gray-100 text-gray-400 hover:text-brand rounded transition-all"
                        title="Edit User"
                      >
                        <Pencil size={18} />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => onDeleteUser(user.id)}
                      className="p-2 hover:bg-rose-50 text-gray-300 hover:text-rose-600 rounded transition-all"
                      title="Revoke Access"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-8 py-12">
                  <EmptyState 
                    title="No system users"
                    description="Onboard your first user to give them access to the ERP system."
                    actionLabel="Onboard User"
                    onAction={() => setShowModal(true)}
                    icon={<Users size={48} className="text-gray-300" />}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Onboarding Modal */}
      {showModal && (
        <ModalPortal>
<div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-md shadow-md w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 border border-gray-200 my-8">
            <div className="p-8 border-b flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand text-white rounded shadow-sm shadow-brand/20">
                  {editingUser ? <UserCog size={24} /> : <Plus size={24} />}
                </div>
                <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-tight">{editingUser ? 'Edit User' : 'Onboard User'}</h3>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                <X size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-8 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded text-rose-700 text-sm font-bold">
                  <AlertCircle size={20} />
                  {formError}
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Institutional Role (RBAC)</label>
                  <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto pr-2">
                    {ROLES.map(r => {
                      const RoleIcon = r.icon;
                      const isDisabled = (r.id === 'STUDENT' && availableStudents.length === 0) ||
                                        (r.id === 'TRAINER' && availableTrainers.length === 0);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleRoleChange(r.id)}
                          className={`flex items-center justify-between p-4 rounded border transition-all text-left ${
                            isDisabled 
                              ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                              : formData.role === r.id 
                                ? 'bg-brand border-brand text-white shadow-lg shadow-brand/20' 
                                : 'bg-white border-gray-100 hover:border-brand-light'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <RoleIcon size={18} className={formData.role === r.id ? 'text-white' : isDisabled ? 'text-gray-300' : 'text-gray-500'} />
                            <div>
                              <div className={`text-xs font-semibold uppercase tracking-tight ${formData.role === r.id ? 'text-white' : isDisabled ? 'text-gray-300' : 'text-gray-800'}`}>
                                {r.label}
                              </div>
                              <div className={`text-xs mt-0.5 ${formData.role === r.id ? 'text-white/80' : 'text-gray-400'}`}>
                                {isDisabled ? 'No unlinked records available' : r.desc}
                              </div>
                            </div>
                          </div>
                          {formData.role === r.id ? <ShieldCheck size={20} /> : <div className={`w-5 h-5 rounded-full border-2 ${isDisabled ? 'border-gray-200' : 'border-gray-100'}`} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Student Selection (only shown when role is STUDENT) */}
                {formData.role === 'STUDENT' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Link to Student Record *</label>
                    <select
                      required
                      value={formData.studentId}
                      onChange={e => handleStudentSelect(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none font-bold text-gray-800"
                    >
                      <option value="">-- Select a student --</option>
                      {availableStudents.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} ({s.email || 'No email'}) - {s.id}
                        </option>
                      ))}
                    </select>
                    {selectedStudent && (
                      <div className="rounded border border-brand/20 bg-brand/5 px-4 py-3 text-xs text-gray-600">
                        Linked student record: <span className="font-semibold text-gray-800">{selectedStudent.firstName} {selectedStudent.lastName}</span>
                        {' '}| ID: <span className="font-mono text-[11px] text-gray-700">{selectedStudent.id}</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 px-1">
                      This will allow the student to log in and access their portal.
                    </p>
                  </div>
                )}

                {/* Trainer Selection (only shown when role is TRAINER) */}
                {formData.role === 'TRAINER' && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Link to Trainer Record *</label>
                    <select
                      required
                      value={formData.trainerId}
                      onChange={e => handleTrainerSelect(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none font-bold text-gray-800"
                    >
                      <option value="">-- Select a trainer --</option>
                      {availableTrainers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName} ({t.email || 'No email'}) - {t.id}
                        </option>
                      ))}
                    </select>
                    {selectedTrainer && (
                      <div className="rounded border border-brand/20 bg-brand/5 px-4 py-3 text-xs text-gray-600">
                        Linked trainer record: <span className="font-semibold text-gray-800">{selectedTrainer.firstName} {selectedTrainer.lastName}</span>
                        {' '}| ID: <span className="font-mono text-[11px] text-gray-700">{selectedTrainer.id}</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 px-1">
                      This will allow the trainer to log in and access their portal.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Full Name *</label>
                  <input 
                    required 
                    placeholder="e.g. Maria Clara" 
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none font-bold text-gray-800"
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Institutional Email *</label>
                  <div className="relative">
                    <input 
                      required 
                      type="email" 
                      placeholder="name@institution.edu" 
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none font-bold text-gray-800"
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                    />
                    <Mail className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                    {editingUser ? 'New Password (optional, min 8 characters)' : 'Initial Password * (min 8 characters)'}
                  </label>
                  <div className="relative">
                    <input 
                      required={!editingUser} 
                      type="password" 
                      placeholder={editingUser ? 'Leave blank to keep current password' : '••••••••'} 
                      minLength={8}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded focus:border-brand outline-none font-bold text-gray-800"
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                    />
                    <Key className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" size={20} />
                  </div>
                  <p className="text-xs text-gray-400 px-1">
                    {editingUser ? 'Only fill this if resetting the local credential hash.' : 'The user should change this password after first login.'}
                  </p>
                </div>
              </div>

              <div className="bg-brand/10 p-6 rounded border border-brand-light flex gap-4">
                <Lock size={24} className="text-brand shrink-0" />
                <p className="text-xs text-brand leading-relaxed font-bold">
                  {formData.role === 'STUDENT' 
                    ? 'Student users can only access their own portal with enrollment info, grades, and attendance.'
                    : formData.role === 'TRAINER'
                    ? 'Trainer users can only access their schedule, assigned batches, and student roster.'
                    : 'User permissions are role-based. A Registrar is isolated from financial G/L modules per security policy.'}
                </p>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 py-4 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded transition-all">Discard</button>
                <button type="submit" className="flex-1 py-4 bg-brand text-white rounded text-sm font-semibold shadow-md shadow-brand/20 hover:bg-brand-hover active:scale-95 transition-all">{editingUser ? 'Save Changes' : 'Onboard to System'}</button>
              </div>
            </form>
          </div>
        </div>
</ModalPortal>
      )}
    </div>
  );
};

export default UsersManagementView;

