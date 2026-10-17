'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Pencil,
  Trash2,
  Save,
  X,
  Users,
} from 'lucide-react';
import { reservationsApi, tablesApi } from '@/lib/api';
import { Reservation, ReservationStatus, Table } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

interface ReservationForm {
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  tableId: string;
  status: ReservationStatus;
  notes: string;
  specialRequest: string;
}

type SortKey = 'dateTime' | 'customer' | 'party' | 'table' | 'status' | 'notes';
type SortDirection = 'asc' | 'desc';

const statusList: Array<'ALL' | ReservationStatus> = [
  'ALL',
  'PENDING',
  'CONFIRMED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SEATED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-slate-100 text-slate-700',
};

const today = () => new Date().toISOString().slice(0, 10);

const blank = (): ReservationForm => ({
  customerName: '',
  customerPhone: '',
  partySize: 2,
  reservationDate: today(),
  reservationTime: '19:00',
  tableId: '',
  status: 'PENDING',
  notes: '',
  specialRequest: '',
});

export default function ReservationsPage() {
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<'ALL' | ReservationStatus>('ALL');
  const [tableId, setTableId] = useState('');
  const [search, setSearch] = useState('');

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [form, setForm] = useState<ReservationForm>(blank());
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeScrollArea, setActiveScrollArea] = useState<'entries' | 'upcoming' | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reservationsRes, summaryRes, tablesRes] = await Promise.all([
        reservationsApi.list({
          from: from || undefined,
          to: to || undefined,
          status,
          tableId: tableId || undefined,
          search: search.trim() || undefined,
        }),
        reservationsApi.summary({
          from: from || undefined,
          to: to || undefined,
        }),
        tablesApi.list(),
      ]);

      setReservations(reservationsRes.data);
      setSummary(summaryRes.data.summary);
      setTables(tablesRes.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, [from, to, status, tableId, search]);

  useEffect(() => {
    load();
  }, [load]);

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setStatus('ALL');
    setTableId('');
    setSearch('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blank());
    setOpenModal(true);
  };

  const openEdit = (reservation: Reservation) => {
    setEditing(reservation);
    setForm({
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone || '',
      partySize: reservation.partySize,
      reservationDate: reservation.reservationDate,
      reservationTime: reservation.reservationTime,
      tableId: reservation.tableId || '',
      status: reservation.status,
      notes: reservation.notes || '',
      specialRequest: reservation.specialRequest || '',
    });
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(blank());
  };

  const submit = async () => {
    if (!form.customerName.trim()) return toast.error('Customer name is required');
    if (!form.reservationDate) return toast.error('Date is required');
    if (!form.reservationTime) return toast.error('Time is required');
    if (!form.partySize || form.partySize <= 0) return toast.error('Party size must be at least 1');

    setSaving(true);
    try {
      const payload = {
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim() || undefined,
        partySize: Number(form.partySize),
        reservationDate: form.reservationDate,
        reservationTime: form.reservationTime,
        tableId: form.tableId || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
        specialRequest: form.specialRequest.trim() || undefined,
        createdBy: user?.name || undefined,
      };

      if (editing) {
        await reservationsApi.update(editing.id, payload);
        toast.success('Reservation updated');
      } else {
        await reservationsApi.create(payload);
        toast.success('Reservation created');
      }

      closeModal();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save reservation');
    } finally {
      setSaving(false);
    }
  };

  const removeReservation = async (id: string) => {
    if (!confirm('Delete this reservation?')) return;
    setDeletingId(id);
    try {
      await reservationsApi.remove(id);
      toast.success('Reservation deleted');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete reservation');
    } finally {
      setDeletingId(null);
    }
  };

  const changeStatus = async (id: string, nextStatus: ReservationStatus) => {
    try {
      await reservationsApi.updateStatus(id, nextStatus);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const upcoming = useMemo(() => {
    const base = reservations
      .filter((r) => ['PENDING', 'CONFIRMED'].includes(r.status))
      .sort((a, b) => `${a.reservationDate} ${a.reservationTime}`.localeCompare(`${b.reservationDate} ${b.reservationTime}`));
    return base.slice(0, 8);
  }, [reservations]);

  const sortedReservations = useMemo(() => {
    if (!sortKey) return reservations;

    const getSortValue = (reservation: Reservation): string | number | null => {
      switch (sortKey) {
        case 'dateTime':
          return `${reservation.reservationDate} ${reservation.reservationTime}`;
        case 'customer':
          return reservation.customerName?.toLowerCase() || '';
        case 'party':
          return reservation.partySize;
        case 'table':
          return reservation.tableNumber ?? null;
        case 'status':
          return reservation.status;
        case 'notes':
          return (reservation.notes || reservation.specialRequest || '').toLowerCase();
        default:
          return null;
      }
    };

    const sorted = [...reservations].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;

      let comparison = 0;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        comparison = valueA - valueB;
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [reservations, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDirection('asc');
  };

  const revealScrollbar = (area: 'entries' | 'upcoming') => {
    setActiveScrollArea(area);
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      setActiveScrollArea(null);
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-sky-600 tracking-tight flex items-center gap-2">
                <CalendarClock className="w-7 h-7" /> Reservations / Booking
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-0.5">
                Plan guests · assign tables · avoid clashes
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            <Plus className="w-4 h-4" /> New Reservation
          </button>
        </header>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
            <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest opacity-75">Total</div>
              <div className="text-3xl font-black">{summary.total}</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Guests</div><div className="text-2xl font-black text-slate-700">{summary.totalGuests}</div></div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Pending</div><div className="text-2xl font-black text-amber-600">{summary.pending}</div></div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Confirmed</div><div className="text-2xl font-black text-blue-600">{summary.confirmed}</div></div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Seated</div><div className="text-2xl font-black text-purple-600">{summary.seated}</div></div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Completed</div><div className="text-2xl font-black text-emerald-600">{summary.completed}</div></div>
            <div className="rounded-2xl bg-white border border-gray-100 p-4"><div className="text-[10px] text-gray-400 uppercase tracking-widest">Cancelled/No-show</div><div className="text-2xl font-black text-red-600">{(summary.cancelled || 0) + (summary.noShow || 0)}</div></div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 mb-5 items-start">
          {/* LEFT COLUMN: filter + entries */}
          <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_1.5fr_auto] gap-3 items-end">
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                From
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                To
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                Status
                <select value={status} onChange={(e) => setStatus(e.target.value as 'ALL' | ReservationStatus)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  {statusList.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                Table
                <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <option value="">ALL</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>Table {t.tableNumber}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500 uppercase tracking-wide">
                Search
                <div className="mt-1 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(); }} placeholder="Name, phone, notes..." className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm" />
                </div>
              </label>
              <div className="flex gap-2">
                <button onClick={resetFilters} className="inline-flex w-24 items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"><RotateCcw className="w-4 h-4" /> Reset</button>
                <button onClick={load} className="inline-flex w-24 items-center justify-center gap-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"><RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Apply</button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-cyan-50 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Reservation Entries</h2>
              <span className="text-[11px] text-gray-400">{sortedReservations.length} record{sortedReservations.length !== 1 ? 's' : ''}</span>
            </div>
            <div
              onScroll={() => revealScrollbar('entries')}
              className={clsx(
                'max-h-[clamp(280px,56vh,620px)] overflow-y-auto overflow-x-auto scroll-reveal',
                activeScrollArea === 'entries' && 'scroll-reveal-active'
              )}
            >
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest">
                  <tr>
                    <th className="w-[120px] px-3 py-3 text-left">
                      <button type="button" onClick={() => toggleSort('dateTime')} className="inline-flex items-center gap-1 hover:text-slate-700">
                        Date/Time
                        {sortKey === 'dateTime' && sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="w-[170px] px-3 py-3 text-left">
                      <button type="button" onClick={() => toggleSort('customer')} className="inline-flex items-center gap-1 hover:text-slate-700">
                        Customer
                        {sortKey === 'customer' && sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="w-[60px] px-3 py-3 text-left">
                      <button type="button" onClick={() => toggleSort('party')} className="inline-flex items-center gap-1 hover:text-slate-700">
                        Party
                        {sortKey === 'party' && sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="w-[90px] px-3 py-3 text-left">
                      <button type="button" onClick={() => toggleSort('table')} className="inline-flex items-center gap-1 hover:text-slate-700">
                        Table
                        {sortKey === 'table' && sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="w-[120px] px-3 py-3 text-left">
                      <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-slate-700">
                        Status
                        {sortKey === 'status' && sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left">
                      <button type="button" onClick={() => toggleSort('notes')} className="inline-flex items-center gap-1 hover:text-slate-700">
                        Notes
                        {sortKey === 'notes' && sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </th>
                    <th className="w-[190px] px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReservations.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-14 text-center text-gray-400">No reservations found.</td></tr>
                  ) : sortedReservations.map((r) => (
                    <tr key={r.id} className="border-t border-gray-50 hover:bg-sky-50/30 transition-colors">
                      <td className="px-3 py-3 text-gray-700 align-top whitespace-nowrap">{r.reservationDate}<br /><span className="text-xs text-gray-400">{r.reservationTime}</span></td>
                      <td className="px-3 py-3 align-top">
                        <div className="truncate font-semibold text-slate-800" title={r.customerName}>{r.customerName}</div>
                        <div className="truncate text-xs text-gray-400" title={r.customerPhone || 'No phone'}>{r.customerPhone || 'No phone'}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700 align-top">{r.partySize}</td>
                      <td className="px-3 py-3 text-slate-700 align-top whitespace-nowrap">{r.tableNumber ? `Table ${r.tableNumber}` : 'Unassigned'}</td>
                      <td className="px-3 py-3 align-top">
                        <select
                          value={r.status}
                          onChange={(e) => changeStatus(r.id, e.target.value as ReservationStatus)}
                          className={clsx('w-full rounded-xl px-2 py-2 text-xs font-semibold border border-transparent', STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600')}
                        >
                          {statusList.filter((s) => s !== 'ALL').map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 align-top break-words" title={r.notes || r.specialRequest || ''}>{r.notes || r.specialRequest || '—'}</td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(r)} className="inline-flex w-[86px] items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                          <button onClick={() => removeReservation(r.id)} disabled={deletingId === r.id} className="inline-flex w-[86px] items-center justify-center gap-1 rounded-xl border border-red-200 px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>{/* end left column */}

          {/* RIGHT COLUMN: upcoming — grows freely without affecting left */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Upcoming</h2>
            {upcoming.length === 0 ? (
              <div className="text-sm text-gray-400 py-8 text-center">No upcoming reservations</div>
            ) : (
              <div
                onScroll={() => revealScrollbar('upcoming')}
                className={clsx(
                  'max-h-[clamp(220px,48vh,560px)] overflow-y-auto pr-1 space-y-2 scroll-reveal',
                  activeScrollArea === 'upcoming' && 'scroll-reveal-active'
                )}
              >
                {upcoming.map((r) => (
                  <div key={r.id} className="rounded-xl border border-gray-100 bg-slate-50 px-3 py-2">
                    <div className="text-sm font-semibold text-slate-800">{r.customerName}</div>
                    <div className="text-[12px] text-gray-500">{r.reservationDate} · {r.reservationTime}</div>
                    <div className="text-[12px] text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> {r.partySize} guests {r.tableNumber ? `· Table ${r.tableNumber}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-slate-900">{editing ? 'Edit Reservation' : 'Create Reservation'}</h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Customer Name *
                  <input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Phone
                  <input value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide col-span-1">Party Size
                  <input type="number" min="1" value={form.partySize} onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide col-span-2">Date
                  <input type="date" value={form.reservationDate} onChange={(e) => setForm((f) => ({ ...f, reservationDate: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide col-span-1">Time
                  <input type="time" value={form.reservationTime} onChange={(e) => setForm((f) => ({ ...f, reservationTime: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Table
                  <select value={form.tableId} onChange={(e) => setForm((f) => ({ ...f, tableId: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    <option value="">Unassigned</option>
                    {tables.map((t) => <option key={t.id} value={t.id}>Table {t.tableNumber}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">Status
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ReservationStatus }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    {statusList.filter((s) => s !== 'ALL').map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>

              <label className="block text-xs text-gray-500 uppercase tracking-wide">Special Request
                <textarea value={form.specialRequest} rows={2} onChange={(e) => setForm((f) => ({ ...f, specialRequest: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm resize-none" />
              </label>

              <label className="block text-xs text-gray-500 uppercase tracking-wide">Internal Notes
                <textarea value={form.notes} rows={2} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm resize-none" />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeModal} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : editing ? 'Update Reservation' : 'Create Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </main>
  );
}
