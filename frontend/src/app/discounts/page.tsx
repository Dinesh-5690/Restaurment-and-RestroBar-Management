'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Pencil,
  Trash2,
  Power,
  TicketPercent,
  Save,
  X,
} from 'lucide-react';
import { couponsApi } from '@/lib/api';
import { Coupon, CouponDiscountType } from '@/types';

interface CouponForm {
  code: string;
  name: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | '';
  usageLimit: number | '';
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const blankForm = (): CouponForm => ({
  code: '',
  name: '',
  description: '',
  discountType: 'PERCENT',
  discountValue: 10,
  minOrderAmount: 0,
  maxDiscountAmount: '',
  usageLimit: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
});

const fc = (value: number) => `₹${Number(value || 0).toFixed(2)}`;

export default function DiscountManagerPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');

  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(blankForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await couponsApi.list({ status, search: search.trim() || undefined });
      setCoupons(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const resetFilters = () => {
    setStatus('ALL');
    setSearch('');
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm());
    setOpenModal(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      minOrderAmount: Number(coupon.minOrderAmount || 0),
      maxDiscountAmount: coupon.maxDiscountAmount ?? '',
      usageLimit: coupon.usageLimit ?? '',
      startsAt: coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : '',
      endsAt: coupon.endsAt ? new Date(coupon.endsAt).toISOString().slice(0, 16) : '',
      isActive: coupon.isActive,
    });
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditing(null);
    setForm(blankForm());
  };

  const submit = async () => {
    if (!form.code.trim() && !editing) {
      return toast.error('Coupon code is required');
    }
    if (!form.name.trim()) {
      return toast.error('Coupon name is required');
    }
    if (!form.discountValue || form.discountValue <= 0) {
      return toast.error('Discount value must be greater than 0');
    }
    if (form.discountType === 'PERCENT' && form.discountValue > 100) {
      return toast.error('Percent discount cannot be above 100');
    }

    const payload = {
      ...(editing ? {} : { code: form.code.trim().toUpperCase() }),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount || 0),
      maxDiscountAmount: form.maxDiscountAmount === '' ? undefined : Number(form.maxDiscountAmount),
      usageLimit: form.usageLimit === '' ? undefined : Number(form.usageLimit),
      startsAt: form.startsAt || undefined,
      endsAt: form.endsAt || undefined,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editing) {
        await couponsApi.update(editing.id, payload);
        toast.success('Coupon updated');
      } else {
        await couponsApi.create(payload);
        toast.success('Coupon created');
      }
      closeModal();
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (id: string) => {
    setTogglingId(id);
    try {
      await couponsApi.toggle(id);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle coupon');
    } finally {
      setTogglingId(null);
    }
  };

  const removeCoupon = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    setDeletingId(id);
    try {
      await couponsApi.remove(id);
      toast.success('Coupon deleted');
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete coupon');
    } finally {
      setDeletingId(null);
    }
  };

  const now = new Date();
  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.isActive).length;
    const inactive = coupons.length - active;
    const expired = coupons.filter((c) => c.endsAt && new Date(c.endsAt) < now).length;
    const used = coupons.reduce((sum, c) => sum + Number(c.usageCount || 0), 0);
    return { active, inactive, expired, used };
  }, [coupons, now]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-fuchsia-50 via-white to-pink-50">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-fuchsia-600 tracking-tight flex items-center gap-2">
                <TicketPercent className="w-7 h-7" /> Discount / Coupon Manager
              </h1>
              <p className="text-[11px] uppercase tracking-widest text-gray-400 mt-0.5">
                Create offers · limit abuse · protect margins
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700"
          >
            <Plus className="w-4 h-4" /> New Coupon
          </button>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest opacity-75">Active</div>
            <div className="text-3xl font-black">{stats.active}</div>
          </div>
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Inactive</div>
            <div className="text-3xl font-black text-gray-700">{stats.inactive}</div>
          </div>
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Expired</div>
            <div className="text-3xl font-black text-red-500">{stats.expired}</div>
          </div>
          <div className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
            <div className="text-[10px] uppercase tracking-widest text-gray-400">Total Redemptions</div>
            <div className="text-3xl font-black text-emerald-600">{stats.used}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3 items-end">
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
              >
                <option value="ALL">ALL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Search
              <div className="mt-1 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
                  placeholder="Code or coupon name"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </label>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
              <button
                onClick={load}
                className="inline-flex items-center gap-1 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700"
              >
                <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} /> Apply
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-fuchsia-50 to-pink-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-widest">Coupons</h2>
            <span className="text-[11px] text-gray-400">{coupons.length} record{coupons.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3 text-left">Code</th>
                  <th className="px-5 py-3 text-left">Offer</th>
                  <th className="px-5 py-3 text-left">Rule</th>
                  <th className="px-5 py-3 text-left">Window</th>
                  <th className="px-5 py-3 text-right">Usage</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center text-gray-400">
                      No coupons found.
                    </td>
                  </tr>
                ) : coupons.map((coupon) => {
                  const expired = !!coupon.endsAt && new Date(coupon.endsAt) < now;
                  return (
                    <tr key={coupon.id} className="border-t border-gray-50 hover:bg-fuchsia-50/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-black text-fuchsia-700 tracking-wide">{coupon.code}</div>
                        <div className="text-[11px] text-gray-400">{coupon.name}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-700">
                          {coupon.discountType === 'PERCENT'
                            ? `${coupon.discountValue}% off`
                            : `${fc(coupon.discountValue)} off`}
                        </div>
                        {coupon.maxDiscountAmount != null && (
                          <div className="text-[11px] text-gray-400">max {fc(coupon.maxDiscountAmount)}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-gray-500">
                        <div>Min order: {fc(coupon.minOrderAmount || 0)}</div>
                        <div>Limit: {coupon.usageLimit ?? 'No limit'}</div>
                      </td>
                      <td className="px-5 py-3 text-[12px] text-gray-500">
                        <div>{coupon.startsAt ? new Date(coupon.startsAt).toLocaleString() : 'Immediate'}</div>
                        <div>{coupon.endsAt ? new Date(coupon.endsAt).toLocaleString() : 'No expiry'}</div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="font-semibold text-slate-700">{coupon.usageCount}</div>
                        <div className="text-[11px] text-gray-400">used</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={clsx(
                          'inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold',
                          !coupon.isActive
                            ? 'bg-gray-100 text-gray-600'
                            : expired
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700',
                        )}>
                          {!coupon.isActive ? 'INACTIVE' : expired ? 'EXPIRED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(coupon)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleCoupon(coupon.id)}
                            disabled={togglingId === coupon.id}
                            className="p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeCoupon(coupon.id)}
                            disabled={deletingId === coupon.id}
                            className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-black text-slate-900">
                {editing ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Code *
                  <input
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    disabled={!!editing}
                    placeholder="SAVE20"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm disabled:opacity-50"
                  />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Name *
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Festival Saver"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs text-gray-500 uppercase tracking-wide">
                Description
                <textarea
                  value={form.description}
                  rows={2}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm resize-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Discount Type
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as CouponDiscountType }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <option value="PERCENT">PERCENT</option>
                    <option value="FLAT">FLAT</option>
                  </select>
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Discount Value *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Min Order
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Max Discount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.maxDiscountAmount}
                    onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Usage Limit
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.usageLimit}
                    onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  Start (optional)
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs text-gray-500 uppercase tracking-wide">
                  End (optional)
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                Coupon active
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editing ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
