'use client';
import { useState, useEffect } from 'react';
import { Table } from '@/types';
import { tablesApi } from '@/lib/api';

interface Props {
  selected?: Table | null;
  onSelect: (table: Table) => void;
}

const statusColors: Record<string, string> = {
  FREE: 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200',
  OCCUPIED: 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200',
  RESERVED: 'bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200',
};

export default function TableSelector({ selected, onSelect }: Props) {
  const [tables, setTables] = useState<Table[]>([]);

  useEffect(() => {
    tablesApi.list().then((r) => setTables(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      <div className="relative">
        <select
          id="table-select"
          value={selected?.id ?? ''}
          onChange={(e) => {
            const tableId = e.target.value;
            const table = tables.find((t) => t.id === tableId);
            if (table) onSelect(table);
          }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
        >
          <option value="" disabled>
            Choose table to continue
          </option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.tableNumber} · {t.capacity} seats · {t.status}
            </option>
          ))}
        </select>
      </div>
      {tables.length === 0 && (
        <p className="mt-2 text-xs text-gray-400">No tables configured. Add from Admin → Tables.</p>
      )}
    </div>
  );
}
