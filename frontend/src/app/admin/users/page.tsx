'use client';

import { useEffect, useState } from 'react';
import { authApi } from '@/lib/api';
import { AccessRight, SalaryType, User, UserRole } from '@/types';
import toast from 'react-hot-toast';
import { Plus, RefreshCcw, Pencil, CheckCircle2, XCircle } from 'lucide-react';

const salaryOptions: SalaryType[] = ['MONTHLY', 'DAILY', 'WEEKLY', 'BIWEEKLY'];
const roleOptions: UserRole[] = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN'];
const accessOptions = ['DASHBOARD', 'POS', 'KITCHEN', 'APPROVAL', 'TABLES', 'KIOSK', 'ADMIN'] as AccessRight[];

const emptyFormState = {
  name: '',
  username: '',
  password: '',
  role: 'WAITER' as UserRole,
  salaryType: 'MONTHLY' as SalaryType,
  salaryAmount: '',
  basicDetails: '',
  accessRights: [] as AccessRight[],
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyFormState);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'WAITER' as UserRole,
    salaryType: 'MONTHLY' as SalaryType,
    salaryAmount: '',
    basicDetails: '',
    accessRights: [] as AccessRight[],
    isActive: true,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authApi.listUsers();
      setUsers(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Unable to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await authApi.register({
        name: form.name,
        username: form.username,
        password: form.password,
        role: form.role,
        salaryType: form.salaryType,
        salaryAmount: form.salaryAmount ? Number(form.salaryAmount) : undefined,
        basicDetails: form.basicDetails || undefined,
        accessRights: form.accessRights,
      });
      toast.success('User created successfully');
      setForm(emptyFormState);
      fetchUsers();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to create user');
    }
  };

  const toggleAccess = (right: AccessRight, isEdit = false) => {
    const state = isEdit ? editForm : form;
    const setter = isEdit ? setEditForm : setForm;
    const next = state.accessRights.includes(right)
      ? state.accessRights.filter((item) => item !== right)
      : [...state.accessRights, right];
    setter({ ...state, accessRights: next });
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      salaryType: user.salaryType ?? 'MONTHLY',
      salaryAmount: user.salaryAmount != null ? String(user.salaryAmount) : '',
      basicDetails: user.basicDetails ?? '',
      accessRights: user.accessRights ?? [],
      isActive: user.isActive,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm({
      name: '',
      username: '',
      password: '',
      role: 'WAITER',
      salaryType: 'MONTHLY',
      salaryAmount: '',
      basicDetails: '',
      accessRights: [],
      isActive: true,
    });
  };

  const updateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;

    try {
      await authApi.updateUser(editingUser.id, {
        name: editForm.name,
        username: editForm.username,
        password: editForm.password || undefined,
        role: editForm.role,
        salaryType: editForm.salaryType,
        salaryAmount: editForm.salaryAmount ? Number(editForm.salaryAmount) : undefined,
        basicDetails: editForm.basicDetails || undefined,
        accessRights: editForm.accessRights,
        isActive: editForm.isActive,
      });
      toast.success('User updated successfully');
      cancelEdit();
      fetchUsers();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update user');
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await authApi.updateUser(user.id, { isActive: !user.isActive });
      fetchUsers();
      toast.success(`${user.name} is now ${user.isActive ? 'inactive' : 'active'}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update status');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Users</h2>
          <p className="text-gray-500">Create staff accounts and set module access.</p>
        </div>
        <button
          type="button"
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCcw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {!editingUser && (
        <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-4">Add New User</h3>
        <form onSubmit={createUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Name *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Username *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Password *</label>
            <input
              type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Role *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Salary frequency</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.salaryType}
              onChange={(e) => setForm({ ...form, salaryType: e.target.value as SalaryType })}
            >
              {salaryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Salary amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.salaryAmount}
              onChange={(e) => setForm({ ...form, salaryAmount: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 block mb-1">Basic details</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              rows={3}
              value={form.basicDetails}
              onChange={(e) => setForm({ ...form, basicDetails: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-gray-600 mb-2">Module access</div>
            <div className="grid grid-cols-2 gap-2">
              {accessOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleAccess(option)}
                  className={`rounded-lg border px-3 py-2 text-sm text-left ${
                    form.accessRights.includes(option)
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Create User
            </button>
          </div>
        </form>
        </div>
      )}

      {editingUser && (
        <div className="card p-5 mb-6 border-orange-200 border bg-orange-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Edit User: {editingUser.username}</h3>
              <p className="text-xs text-gray-500">Leave password blank to keep the existing password.</p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <XCircle className="w-4 h-4" /> Cancel
            </button>
          </div>
          <form onSubmit={updateUser} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Name</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Username</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">New password</label>
              <input
                type="password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                minLength={6}
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Role</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Salary frequency</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={editForm.salaryType}
                onChange={(e) => setEditForm({ ...editForm, salaryType: e.target.value as SalaryType })}
              >
                {salaryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Salary amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={editForm.salaryAmount}
                onChange={(e) => setEditForm({ ...editForm, salaryAmount: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={editForm.isActive ? 'active' : 'inactive'}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Basic details</label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                rows={3}
                value={editForm.basicDetails}
                onChange={(e) => setEditForm({ ...editForm, basicDetails: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-gray-600 mb-2">Module access</div>
              <div className="grid grid-cols-2 gap-2">
                {accessOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleAccess(option, true)}
                    className={`rounded-lg border px-3 py-2 text-sm text-left ${
                      editForm.accessRights.includes(option)
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">
          Existing Users
        </div>
        {loading && <div className="px-4 py-6 text-sm text-gray-500">Loading users...</div>}
        {!loading && users.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No users found yet.</div>
        )}
        {!loading && users.map((user) => (
          <div key={user.id} className="px-4 py-4 border-b last:border-0 grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            <div>
              <div className="font-medium text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-500">{user.username}</div>
            </div>
            <div className="text-sm text-gray-600">
              <div>{user.role}</div>
              <div>{user.isActive ? 'Active' : 'Inactive'}</div>
            </div>
            <div className="text-sm text-gray-600">
              <div>{user.accessRights?.length ? user.accessRights.join(', ') : 'No access selected'}</div>
              <div className="text-xs text-gray-500 mt-1">
                {user.salaryAmount != null ? `${user.salaryAmount} / ${user.salaryType}` : 'Salary not set'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => startEdit(user)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                type="button"
                onClick={() => toggleActive(user)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  user.isActive ? 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50' : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {user.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
