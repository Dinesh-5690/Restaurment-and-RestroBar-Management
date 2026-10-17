'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Fingerprint,
  Clock3,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Pencil,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { attendanceApi, authApi } from '@/lib/api';
import { AttendanceRecord, AttendanceStatus, User } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

const statusOptions: Array<'ALL' | AttendanceStatus> = ['ALL', 'PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'LEAVE'];

const STATUS_BADGE: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE: 'bg-amber-100 text-amber-700',
  HALF_DAY: 'bg-orange-100 text-orange-700',
  ABSENT: 'bg-red-100 text-red-700',
  LEAVE: 'bg-slate-100 text-slate-700',
};

const today = () => new Date().toISOString().slice(0, 10);
const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : '—');
const formatHours = (mins: number) => (mins / 60).toFixed(2);

interface ManualForm {
  userId: string;
  attendanceDate: string;
  checkInAt: string;
  checkOutAt: string;
  status: AttendanceStatus;
  note: string;
}

const blankForm = (): ManualForm => ({
  userId: '',
  attendanceDate: today(),
  checkInAt: '',
  checkOutAt: '',
  status: 'PRESENT',
  note: '',
});

export default function AttendancePage() {
  const { user } = useAuthStore();
  const canManage = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  const [todayMe, setTodayMe] = useState<AttendanceRecord | null>(null);
  const [punching, setPunching] = useState<'in' | 'out' | null>(null);

  const [entries, setEntries] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'ALL' | AttendanceStatus>('ALL');
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [form, setForm] = useState<ManualForm>(blankForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<any>[] = [attendanceApi.todayMe()];

      if (canManage) {
        tasks.push(
          attendanceApi.list({
            from: from || undefined,
            to: to || undefined,
            status,
            userId: userId || undefined,
            search: search.trim() || undefined,
          }),
          attendanceApi.summary({
            from: from || undefined,
            to: to || undefined,
            userId: userId || undefined,
          }),
          authApi.listUsers(),
        );
      }

      const results = await Promise.all(tasks);
      setTodayMe(results[0].data || null);

      if (canManage) {
        setEntries(results[1].data || []);
        setSummary(results[2].data || null);
        setUsers(results[3].data || []);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [canManage, from, to, status, userId, search]);

  useEffect(() => { load(); }, [load]);

  const doCheckIn = async () => {
    setPunching('in');
    try {
      await attendanceApi.checkIn();
      toast.success('Checked in');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-in failed');
    } finally {
      setPunching(null);
    }
  };

  const doCheckOut = async () => {
    setPunching('out');
    try {
      await attendanceApi.checkOut();
      toast.success('Checked out');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Check-out failed');
    } finally {
      setPunching(null);
    }
  };

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setStatus('ALL');
    setUserId('');
    setSearch('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setOpenModal(true);
  };

  const openEdit = (record: AttendanceRecord) => {
    setEditing(record);
    setForm({
      userId: record.userId,
      attendanceDate: record.attendanceDate,
      checkInAt: record.checkInAt ? new Date(record.checkInAt).toISOString().slice(0, 16) : '',
      checkOutAt: record.checkOutAt ? new Date(record.checkOutAt).toISOString().slice(0, 16) : '',
      status: record.status,
      note: record.note || '',
    });
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(blankForm());
  };

  const submit = async () => {
    if (!form.userId) return toast.error('Select staff member');
    if (!form.attendanceDate) return toast.error('Date is required');

    const payload = {
      userId: form.userId,
      attendanceDate: form.attendanceDate,
      checkInAt: form.checkInAt || undefined,
      checkOutAt: form.checkOutAt || undefined,
      status: form.status,
      note: form.note.trim() || undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await attendanceApi.update(editing.id, {
          attendanceDate: payload.attendanceDate,
          checkInAt: payload.checkInAt,
          checkOutAt: payload.checkOutAt,
          status: payload.status,
          note: payload.note,
        });
        toast.success('Attendance updated');
      } else {
        await attendanceApi.manual(payload);
        toast.success('Attendance entry added');
      }
      closeModal();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm('Delete this attendance record?')) return;
    setDeletingId(id);
    try {
      await attendanceApi.remove(id);
      toast.success('Deleted');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const totals = summary?.totals;
  const byUser = summary?.byUser || [];

  const selectedUser = useMemo(() => users.find((u) => u.id === form.userId), [users, form.userId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-lime-50 via-white to-emerald-50">
      <div className="max-w-[1450px] mx-auto px-3 sm:px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-lime-700 tracking-tight flex items-center gap-2">
                <Fingerprint className="w-7 h-7" /> Shift / Attendance Manager
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-0.5">
                Punch tracking · manager corrections · payroll-ready summary
              </p>
            </div>
          </div>
          {canManage && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-lime-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-800">
              <Plus className="w-4 h-4" /> Manual Entry
            </button>
          )}
        </header>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">My Punch</h2>
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 items-center">
            <div className="rounded-2xl border border-lime-100 bg-lime-50 p-4">
              <div className="text-sm text-gray-500">Today ({today()})</div>
              <div className="mt-2 text-sm text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                <span>Check-in: <strong>{todayMe?.checkInAt ? formatDateTime(todayMe.checkInAt) : 'Not yet'}</strong></span>
                <span>Check-out: <strong>{todayMe?.checkOutAt ? formatDateTime(todayMe.checkOutAt) : 'Not yet'}</strong></span>
                <span>Worked: <strong>{formatHours(todayMe?.workedMinutes || 0)} hrs</strong></span>
              </div>
              {todayMe?.status && (
                <div className="mt-3">
                  <span className={clsx('inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold', STATUS_BADGE[todayMe.status] || 'bg-gray-100 text-gray-600')}>
                    {todayMe.status}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-start lg:justify-end">
              <button
                onClick={doCheckIn}
                disabled={punching !== null || !!todayMe?.checkInAt}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Clock3 className="w-4 h-4" /> {punching === 'in' ? 'Checking in...' : 'Check In'}
              </button>
              <button
                onClick={doCheckOut}
                disabled={punching !== null || !todayMe?.checkInAt || !!todayMe?.checkOutAt}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                <Clock3 className="w-4 h-4" /> {punching === 'out' ? 'Checking out...' : 'Check Out'}
              </button>
            </div>
          </div>
        </div>

        {canManage && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
              <div className="rounded-2xl bg-gradient-to-br from-lime-600 to-emerald-600 text-white p-4"><div className="text-[10px] uppercase tracking-widest opacity-80">Records</div><div className="text-3xl font-black">{totals?.records ?? 0}</div></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Present</div><div className="text-2xl font-black text-emerald-600">{totals?.present ?? 0}</div></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Late</div><div className="text-2xl font-black text-amber-600">{totals?.late ?? 0}</div></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Half Day</div><div className="text-2xl font-black text-orange-600">{totals?.halfDay ?? 0}</div></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Absent</div><div className="text-2xl font-black text-red-600">{totals?.absent ?? 0}</div></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Worked Hours</div><div className="text-2xl font-black text-slate-700">{totals?.totalWorkedHours ?? 0}</div></div>
              <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Payable Days</div><div className="text-2xl font-black text-indigo-600">{totals?.payableDays ?? 0}</div></div>
            </div>

            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 mb-5">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1.4fr_auto] gap-3 items-end">
                <label className="text-xs text-gray-500 uppercase tracking-wide">From
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs text-gray-500 uppercase tracking-wide">To
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'ALL' | AttendanceStatus)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Staff
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <option value="">ALL</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-500 uppercase tracking-wide">Search
                  <div className="mt-1 relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder="Name, role, note..." className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm" />
                  </div>
                </label>
                <div className="flex gap-2">
                  <button onClick={resetFilters} className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RotateCcw className="w-4 h-4" /> Reset</button>
                  <button onClick={load} className="inline-flex items-center gap-1 rounded-xl bg-lime-700 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-800"><RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Apply</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[2.7fr_1.3fr] gap-4 mb-5">
              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-lime-50 to-emerald-50 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Attendance Entries</h2>
                  <span className="text-[11px] text-gray-400">{entries.length} record{entries.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Staff</th>
                        <th className="px-4 py-3 text-left">Check-in</th>
                        <th className="px-4 py-3 text-left">Check-out</th>
                        <th className="px-4 py-3 text-right">Hours</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Note</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-14 text-center text-gray-400">No attendance records found.</td></tr>
                      ) : entries.map((e) => (
                        <tr key={e.id} className="border-t border-gray-50 hover:bg-lime-50/30 transition-colors">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.attendanceDate}</td>
                          <td className="px-4 py-3"><div className="font-semibold text-slate-800">{e.userName}</div><div className="text-xs text-gray-400">{e.userRole}</div></td>
                          <td className="px-4 py-3 text-xs text-gray-600">{formatDateTime(e.checkInAt)}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{formatDateTime(e.checkOutAt)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">{formatHours(e.workedMinutes)}</td>
                          <td className="px-4 py-3"><span className={clsx('inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold', STATUS_BADGE[e.status] || 'bg-gray-100 text-gray-600')}>{e.status}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-[240px]">{e.note || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => removeEntry(e.id)} disabled={deletingId === e.id} className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">By Staff (Payroll Ready)</h2>
                {byUser.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-10">No summary records</div>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {byUser.map((u: any) => (
                      <div key={u.userId} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{u.userName}</div>
                            <div className="text-[11px] text-gray-400">{u.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-indigo-600">{u.payableDays}</div>
                            <div className="text-[10px] text-gray-400 uppercase">Payable Days</div>
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-500 flex items-center justify-between">
                          <span>Hours: {u.workedHours}</span>
                          <span>P:{u.presentDays} L:{u.lateDays} H:{u.halfDays} A:{u.absentDays}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {canManage && openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-slate-900">{editing ? 'Edit Attendance Entry' : 'Add Manual Attendance'}</h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Staff *
                  <select
                    value={form.userId}
                    onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                    disabled={!!editing}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm disabled:opacity-50"
                  >
                    <option value="">Select staff</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Date *
                  <input type="date" value={form.attendanceDate} onChange={(e) => setForm((f) => ({ ...f, attendanceDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
              </div>

              {selectedUser && (
                <div className="rounded-xl border border-lime-100 bg-lime-50 px-3 py-2 text-xs text-lime-800">
                  Selected: {selectedUser.name} ({selectedUser.role})
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Check-in
                  <input type="datetime-local" value={form.checkInAt} onChange={(e) => setForm((f) => ({ ...f, checkInAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Check-out
                  <input type="datetime-local" value={form.checkOutAt} onChange={(e) => setForm((f) => ({ ...f, checkOutAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
              </div>

              <label className="block text-xs text-gray-500 uppercase tracking-wide">Status
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AttendanceStatus }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  {statusOptions.filter((s) => s !== 'ALL').map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label className="block text-xs text-gray-500 uppercase tracking-wide">Note
                <textarea value={form.note} rows={3} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm resize-none" />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-lime-700 px-5 py-2 text-sm font-semibold text-white hover:bg-lime-800 disabled:opacity-60">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editing ? 'Update Entry' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
