'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Plus, RefreshCw, RotateCcw, Pencil, Trash2,
  TrendingUp, TrendingDown, X, Save, Wallet,
} from 'lucide-react';
import { expensesApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

// ─── Types ─────────────────────────────────────────────────────────
type Category =
  'INGREDIENTS' | 'UTILITIES' | 'STAFF' | 'RENT' |
  'EQUIPMENT'   | 'MARKETING' | 'MAINTENANCE' | 'OTHER';

type PaymentMode = 'CASH' | 'CARD' | 'BANK' | 'UPI' | 'OTHER';

interface Expense {
  id: string; title: string; description?: string; amount: number;
  category: Category; paymentMode: PaymentMode; expenseDate: string;
  reference?: string; addedBy?: string; createdAt: string;
}
interface CategoryStat { category: string; total: number; count: number; pct: number }
interface DailyStat    { date: string; total: number }
interface Summary {
  totalExpenses: number; totalRevenue: number;
  netProfit: number; profitMargin: number | null;
}

// ─── Constants ─────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
  'INGREDIENTS', 'UTILITIES', 'STAFF', 'RENT',
  'EQUIPMENT', 'MARKETING', 'MAINTENANCE', 'OTHER',
];
const PAYMENT_MODES: PaymentMode[] = ['CASH', 'CARD', 'BANK', 'UPI', 'OTHER'];

const CAT_COLOR: Record<string, string> = {
  INGREDIENTS: 'bg-green-500',   UTILITIES:   'bg-yellow-500',
  STAFF:       'bg-blue-500',    RENT:        'bg-purple-500',
  EQUIPMENT:   'bg-orange-500',  MARKETING:   'bg-pink-500',
  MAINTENANCE: 'bg-slate-500',   OTHER:       'bg-gray-400',
};
const CAT_BADGE: Record<string, string> = {
  INGREDIENTS: 'bg-green-100 text-green-700',   UTILITIES:   'bg-yellow-100 text-yellow-700',
  STAFF:       'bg-blue-100 text-blue-700',     RENT:        'bg-purple-100 text-purple-700',
  EQUIPMENT:   'bg-orange-100 text-orange-700', MARKETING:   'bg-pink-100 text-pink-700',
  MAINTENANCE: 'bg-slate-100 text-slate-700',   OTHER:       'bg-gray-100 text-gray-600',
};
const PMT_BADGE: Record<string, string> = {
  CASH: 'bg-emerald-100 text-emerald-700', CARD: 'bg-blue-100 text-blue-700',
  BANK: 'bg-indigo-100 text-indigo-700',   UPI:  'bg-cyan-100 text-cyan-700',
  OTHER:'bg-gray-100 text-gray-600',
};

const fc = (v: number) => `₹${Number(v || 0).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

// ─── Blank form ─────────────────────────────────────────────────────
const blank = (): Partial<Expense> => ({
  title: '', description: '', amount: 0, category: 'OTHER',
  paymentMode: 'CASH', expenseDate: today(), reference: '', addedBy: '',
});

// ─── Page ───────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const { user } = useAuthStore();

  // filters
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [catFilter,setCatFilter]= useState<string>('ALL');
  const [search,   setSearch]   = useState('');

  // data
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [byCat,    setByCat]    = useState<CategoryStat[]>([]);
  const [daily,    setDaily]    = useState<DailyStat[]>([]);
  const [loading,  setLoading]  = useState(false);

  // form / modal
  const [showForm,  setShowForm] = useState(false);
  const [editing,   setEditing]  = useState<Expense | null>(null);
  const [form,      setForm]     = useState<Partial<Expense>>(blank());
  const [saving,    setSaving]   = useState(false);
  const [deleting,  setDeleting] = useState<string | null>(null);

  // ── load ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        expensesApi.list({ from: from || undefined, to: to || undefined, category: catFilter, search: search.trim() || undefined }),
        expensesApi.summary({ from: from || undefined, to: to || undefined }),
      ]);
      setExpenses(listRes.data);
      setSummary(summaryRes.data.summary);
      setByCat(summaryRes.data.byCategory);
      setDaily(summaryRes.data.daily);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [from, to, catFilter, search]);

  useEffect(() => { load(); }, []);

  const reset = () => {
    setFrom(''); setTo(''); setCatFilter('ALL'); setSearch('');
  };

  // ── form helpers ─────────────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank(), addedBy: user?.name ?? '' });
    setShowForm(true);
  };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ ...e });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(blank()); };

  const handleSave = async () => {
    if (!form.title?.trim()) return toast.error('Title is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be > 0');
    if (!form.expenseDate) return toast.error('Date is required');

    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) {
        await expensesApi.update(editing.id, payload);
        toast.success('Expense updated');
      } else {
        await expensesApi.create(payload);
        toast.success('Expense added');
      }
      closeForm();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    setDeleting(id);
    try {
      await expensesApi.remove(id);
      toast.success('Deleted');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const maxCatTotal = useMemo(() => Math.max(...byCat.map(c => c.total), 1), [byCat]);
  const maxDailyTotal = useMemo(() => Math.max(...daily.map(d => d.total), 1), [daily]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-orange-50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6">

        {/* ── Header ── */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white/70 border border-transparent hover:border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-rose-600 tracking-tight flex items-center gap-2">
                <Wallet className="w-7 h-7" /> Expense Tracking
              </h1>
              <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                Log · Analyse · Control operational costs
              </p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </header>

        {/* ── KPI summary cards ── */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <div className="rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white p-5 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest opacity-75 mb-1">Total Expenses</div>
              <div className="text-3xl font-black">{fc(summary.totalExpenses)}</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Revenue (same period)</div>
              <div className="text-3xl font-black text-emerald-600">{fc(summary.totalRevenue)}</div>
            </div>
            <div className={clsx(
              'rounded-2xl p-5 shadow-sm border',
              summary.netProfit >= 0
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-red-50 border-red-100',
            )}>
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Net Profit</div>
              <div className={clsx('text-3xl font-black flex items-center gap-1',
                summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {summary.netProfit >= 0
                  ? <TrendingUp className="w-6 h-6" />
                  : <TrendingDown className="w-6 h-6" />}
                {fc(summary.netProfit)}
              </div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Profit Margin</div>
              <div className={clsx('text-3xl font-black',
                summary.profitMargin === null ? 'text-gray-300'
                  : summary.profitMargin >= 0  ? 'text-emerald-600'
                  : 'text-red-600')}>
                {summary.profitMargin !== null ? `${summary.profitMargin}%` : '—'}
              </div>
              <div className="text-[11px] text-gray-400 mt-1">of revenue</div>
            </div>
          </div>
        )}

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-4 mb-5">

          {/* Daily spend bar chart */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Daily Expense Trend</h2>
            {daily.length === 0 ? (
              <div className="flex items-center justify-center h-28 text-sm text-gray-400">No data for selected period</div>
            ) : (
              <>
                <div className="flex items-end gap-1.5 h-28">
                  {daily.map(d => {
                    const pct = (d.total / maxDailyTotal) * 100;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center group relative min-w-0">
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap z-20 pointer-events-none shadow-lg">
                          {d.date}<br />{fc(d.total)}
                        </div>
                        <div
                          className="w-full rounded-t bg-rose-400 hover:bg-rose-600 transition-colors cursor-default"
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                  <span>{daily[0]?.date}</span>
                  <span>{daily[daily.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>

          {/* Category breakdown */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">By Category</h2>
            {byCat.length === 0 ? (
              <div className="flex items-center justify-center h-28 text-sm text-gray-400">No expenses recorded</div>
            ) : (
              <div className="space-y-3">
                {byCat.map(c => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', CAT_COLOR[c.category] || 'bg-gray-400')} />
                        <span className="font-semibold text-slate-700">{c.category}</span>
                        <span className="text-[11px] text-gray-400">({c.count})</span>
                      </div>
                      <span className="font-bold text-rose-600">{fc(c.total)} <span className="text-gray-400 font-normal">· {c.pct}%</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className={clsx('h-2 rounded-full', CAT_COLOR[c.category] || 'bg-gray-400')}
                        style={{ width: `${(c.total / maxCatTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1.5fr_auto] gap-3 items-end">
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              From
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              To
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Category
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <option value="ALL">ALL</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Search
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') load(); }}
                placeholder="Title, description, ref..."
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-2">
              <button onClick={reset}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <button onClick={load}
                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Apply
              </button>
            </div>
          </div>
        </div>

        {/* ── Expenses table ── */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-pink-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">
              Expense Entries
            </h2>
            <span className="text-[11px] text-gray-400">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left">Category</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left">Payment</th>
                  <th className="px-5 py-3 text-left">Ref #</th>
                  <th className="px-5 py-3 text-left">Added By</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-14 text-center text-gray-400">
                      No expenses found for the selected filters.
                    </td>
                  </tr>
                ) : expenses.map(e => (
                  <tr key={e.id} className="border-t border-gray-50 hover:bg-rose-50/30 transition-colors">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{e.expenseDate}</td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{e.title}</div>
                      {e.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{e.description}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx('inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold', CAT_BADGE[e.category] || 'bg-gray-100 text-gray-600')}>
                        {e.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-rose-600">{fc(e.amount)}</td>
                    <td className="px-5 py-3">
                      <span className={clsx('inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold', PMT_BADGE[e.paymentMode] || 'bg-gray-100 text-gray-600')}>
                        {e.paymentMode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{e.reference || '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{e.addedBy || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(e)}
                          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                          className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-slate-900">
                {editing ? 'Edit Expense' : 'Add Expense'}
              </h2>
              <button onClick={closeForm} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <label className="block text-xs text-gray-500 uppercase tracking-wide">
                Title *
                <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Gas cylinder refill"
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
              </label>

              {/* Amount + Date row */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Amount (₹) *
                  <input type="number" min="0" step="0.01"
                    value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Expense Date *
                  <input type="date" value={form.expenseDate || today()}
                    onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
              </div>

              {/* Category + Payment mode row */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Category
                  <select value={form.category || 'OTHER'} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Payment Mode
                  <select value={form.paymentMode || 'CASH'} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value as PaymentMode }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>

              {/* Description */}
              <label className="block text-xs text-gray-500 uppercase tracking-wide">
                Description
                <textarea value={form.description || ''} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional details..."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm resize-none" />
              </label>

              {/* Ref + Added by row */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Bill / Ref #
                  <input value={form.reference || ''} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="INV-001"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Added By
                  <input value={form.addedBy || ''} onChange={e => setForm(f => ({ ...f, addedBy: e.target.value }))}
                    placeholder="Your name"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : editing ? 'Update' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
