'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/types';
import { tablesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, QrCode, RefreshCw, Trash2, MapPin, Pencil } from 'lucide-react';
import clsx from 'clsx';

const statusColor: Record<string, string> = {
  FREE: 'bg-green-100 text-green-800',
  OCCUPIED: 'bg-red-100 text-red-800',
  RESERVED: 'bg-yellow-100 text-yellow-800',
};

export default function TablesAdminPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tableNumber: '', capacity: '4', location: '' });
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState<Table | null>(null);
  const [editTableId, setEditTableId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ tableNumber: '', capacity: '4', location: '' });

  const fetchTables = async () => {
    const r = await tablesApi.list();
    setTables(r.data);
  };

  useEffect(() => { fetchTables(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await tablesApi.create({
        tableNumber: form.tableNumber,
        capacity: Number(form.capacity),
        location: form.location || undefined,
      });
      toast.success('Table created!');
      setShowAdd(false);
      setForm({ tableNumber: '', capacity: '4', location: '' });
      fetchTables();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenQr = async (id: string) => {
    try {
      await tablesApi.regenerateQr(id);
      toast.success('QR code regenerated');
      fetchTables();
    } catch {
      toast.error('Failed to regenerate QR');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this table?')) return;
    try {
      await tablesApi.remove(id);
      toast.success('Table deleted');
      fetchTables();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const startEdit = (table: Table) => {
    setEditTableId(table.id);
    setEditForm({
      tableNumber: table.tableNumber,
      capacity: String(table.capacity ?? 4),
      location: table.location ?? '',
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      await tablesApi.update(id, {
        tableNumber: editForm.tableNumber,
        capacity: Number(editForm.capacity),
        location: editForm.location || undefined,
      });
      toast.success('Table updated');
      setEditTableId(null);
      fetchTables();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error updating table');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Tables</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Table
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold mb-4">New Table</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Table Number *</label>
              <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required
                value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Capacity</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Location</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Ground Floor"
                value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="col-span-1 sm:col-span-3 flex gap-3">
              <button type="submit" disabled={loading} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                {loading ? 'Creating...' : 'Create Table'}
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="text-2xl font-bold text-gray-900">{t.tableNumber}</div>
              <span className={`badge text-xs ${statusColor[t.status]}`}>{t.status}</span>
            </div>
            {t.location && (
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-3">
                <MapPin className="w-3 h-3" /> {t.location}
              </div>
            )}
            <div className="text-xs text-gray-500 mb-3">Capacity: {t.capacity}</div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(t)}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                title="Edit table"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button
                onClick={() => setQrModal(t)}
                className="flex-1 flex items-center justify-center gap-1 border border-gray-200 rounded-lg py-1.5 text-xs hover:bg-gray-50"
              >
                <QrCode className="w-3.5 h-3.5" /> QR
              </button>
              <button
                onClick={() => handleRegenQr(t.id)}
                className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
                title="Regenerate QR"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="p-1.5 border border-red-100 rounded-lg hover:bg-red-50"
                title="Delete table"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>

            {editTableId === t.id && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Table Number</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={editForm.tableNumber}
                    onChange={(e) => setEditForm({ ...editForm, tableNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Capacity</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={editForm.capacity}
                    onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Location</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(t.id)}
                    className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditTableId(null)}
                    className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs text-center">
            <h3 className="font-bold mb-4">Table {qrModal.tableNumber} — QR Code</h3>
            {qrModal.qrCodeImage && (
              <img src={qrModal.qrCodeImage} alt="QR Code" className="mx-auto mb-4 w-48 h-48" />
            )}
            <p className="text-xs text-gray-500 break-all mb-4">{qrModal.qrCodeUrl}</p>
            <button
              onClick={() => setQrModal(null)}
              className="w-full bg-gray-100 hover:bg-gray-200 py-2 rounded-xl text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
