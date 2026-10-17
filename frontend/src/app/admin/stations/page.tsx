'use client';

import { useEffect, useState } from 'react';
import { KitchenStation } from '@/types';
import { menuApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Pencil } from 'lucide-react';

export default function AdminStationsPage() {
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', sequence: '0' });
  const [editStationId, setEditStationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', sequence: '0' });

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await menuApi.stations();
      setStations(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const createStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await menuApi.createStation({
        name: form.name,
        sequence: Number(form.sequence),
      });
      toast.success('Station added');
      setForm({ name: '', sequence: '0' });
      fetchStations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to add station');
    }
  };

  const toggleActive = async (station: KitchenStation) => {
    try {
      await menuApi.updateStation(station.id, { isActive: !station.isActive });
      fetchStations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update station');
    }
  };

  const deleteStation = async (id: string) => {
    if (!confirm('Delete this station?')) return;
    try {
      await menuApi.deleteStation(id);
      toast.success('Station removed');
      fetchStations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete station');
    }
  };

  const startEdit = (station: KitchenStation) => {
    setEditStationId(station.id);
    setEditForm({ name: station.name, sequence: String(station.sequence) });
  };

  const saveEdit = async (id: string) => {
    try {
      await menuApi.updateStation(id, {
        name: editForm.name,
        sequence: Number(editForm.sequence),
      });
      toast.success('Station updated');
      setEditStationId(null);
      fetchStations();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update station');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Kitchen Stations</h2>
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-4">Add Station</h3>
        <form onSubmit={createStation} className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Name *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              required
              placeholder="e.g. WOODFIRE"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Sequence</label>
            <input
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.sequence}
              onChange={(e) => setForm({ ...form, sequence: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Station
            </button>
          </div>
        </form>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 text-sm font-semibold text-gray-700">
          Existing Stations
        </div>
        {loading && <div className="px-4 py-6 text-sm text-gray-500">Loading...</div>}
        {!loading && stations.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">No stations found</div>
        )}
        {!loading && stations.map((s) => (
          <div key={s.id} className="px-4 py-3 border-b last:border-0 flex items-center gap-4">
            <div className="flex-1">
              {editStationId === s.id ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value.toUpperCase() })}
                  />
                  <input
                    type="number"
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    value={editForm.sequence}
                    onChange={(e) => setEditForm({ ...editForm, sequence: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <div className="font-medium text-gray-900">{s.name}</div>
                  <div className="text-xs text-gray-400">Sequence: {s.sequence}</div>
                </>
              )}
            </div>
            <button
              onClick={() => toggleActive(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
            >
              {s.isActive ? 'Active' : 'Inactive'}
            </button>
            {editStationId === s.id ? (
              <>
                <button
                  onClick={() => saveEdit(s.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditStationId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => startEdit(s)}
                className="p-2 rounded-lg hover:bg-gray-100"
                title="Edit station"
              >
                <Pencil className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <button
              onClick={() => deleteStation(s.id)}
              className="p-2 rounded-lg hover:bg-red-50"
              title="Delete station"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
