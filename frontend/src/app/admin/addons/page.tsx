'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { menuApi } from '@/lib/api';
import type { ExtraAddon } from '@/types';

export default function AddonsAdminPage() {
  const [addons, setAddons] = useState<ExtraAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', description: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', price: '', description: '', isActive: true });

  const load = async () => {
    setLoading(true);
    try {
      const res = await menuApi.addons();
      setAddons(res.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load add-ons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await menuApi.createAddon({
        name: form.name,
        price: Number(form.price || 0),
        description: form.description || undefined,
      });
      toast.success('Add-on created');
      setForm({ name: '', price: '', description: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create add-on');
    }
  };

  const startEdit = (addon: ExtraAddon) => {
    setEditId(addon.id);
    setEditForm({
      name: addon.name,
      price: String(addon.price ?? 0),
      description: addon.description || '',
      isActive: addon.isActive,
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await menuApi.updateAddon(editId, {
        name: editForm.name,
        price: Number(editForm.price || 0),
        description: editForm.description || undefined,
        isActive: editForm.isActive,
      });
      toast.success('Add-on updated');
      setEditId(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update add-on');
    }
  };

  const toggleAddon = async (addon: ExtraAddon) => {
    try {
      await menuApi.updateAddon(addon.id, { isActive: !addon.isActive });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to toggle add-on');
    }
  };

  const deleteAddon = async (addonId: string) => {
    if (!confirm('Delete this add-on?')) return;
    try {
      await menuApi.deleteAddon(addonId);
      toast.success('Add-on deleted');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete add-on');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Extra Add-ons</h1>
      </div>

      <section className="card p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-3">Create Add-on</h2>
        <form onSubmit={createAddon} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Add-on name"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            placeholder="Price"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description (optional)"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button type="submit" className="inline-flex items-center justify-center gap-1 bg-orange-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-800">Configured Add-ons</div>
        {loading && <div className="p-6 text-sm text-gray-500">Loading...</div>}
        {!loading && addons.length === 0 && <div className="p-6 text-sm text-gray-500">No add-ons configured yet.</div>}

        {!loading && addons.map((addon) => (
          <div key={addon.id} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
            {editId === addon.id ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  /> Active
                </label>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="bg-orange-500 text-white px-3 py-2 rounded-lg text-xs font-semibold">Save</button>
                  <button onClick={() => setEditId(null)} className="border border-gray-200 px-3 py-2 rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-gray-900">{addon.name}</div>
                  <div className="text-xs text-gray-500">{addon.description || 'No description'}</div>
                </div>
                <div className="text-sm font-semibold text-orange-600">₹{Number(addon.price).toFixed(2)}</div>
                <div className={addon.isActive ? 'text-xs text-green-600 font-semibold' : 'text-xs text-gray-500 font-semibold'}>
                  {addon.isActive ? 'ACTIVE' : 'INACTIVE'}
                </div>
                <button onClick={() => toggleAddon(addon)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  {addon.isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                </button>
                <button onClick={() => startEdit(addon)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <Pencil className="w-4 h-4 text-gray-600" />
                </button>
                <button onClick={() => deleteAddon(addon.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
