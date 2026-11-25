'use client';
import { useState, useEffect } from 'react';
import { MenuSection, MenuItem } from '@/types';
import { menuApi, beveragesApi } from '@/lib/api';
import { usePOSStore } from '@/store/usePOSStore';
import { Plus, Search, Tag } from 'lucide-react';
import clsx from 'clsx';
import AddonPickerModal from './AddonPickerModal';

interface Props {
  onAddItem: (item: MenuItem, addons?: any[]) => void;
}

export default function MenuPanel({ onAddItem }: Props) {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  const [primary, setPrimary] = useState<'food' | 'beverages'>('beverages');
  const [beverages, setBeverages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [beverageCategory, setBeverageCategory] = useState('all');
  const addBeverageToCart = usePOSStore((state) => state.addBeverageToCart);

  useEffect(() => {
    menuApi.fullMenu().then((r) => setSections(r.data)).catch(() => {});
    beveragesApi.products().then((r) => setBeverages(r.data)).catch(() => {});
    beveragesApi.categories().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const allItems = sections.flatMap((s) => s.items);
  const filteredItems = allItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory && item.isAvailable;
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-2 mb-3">
        <button onClick={() => setPrimary('beverages')} className={clsx('px-4 py-2 rounded-lg text-sm font-semibold', primary === 'beverages' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600')}>Beverages</button>
        <button onClick={() => setPrimary('food')} className={clsx('px-4 py-2 rounded-lg text-sm font-semibold', primary === 'food' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}>Food</button>
      </div>
      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Search menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {primary === 'food' ? (
          <>
            <button onClick={() => setSelectedCategory('all')} className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-medium', selectedCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}>All</button>
            {sections.map((s) => <button key={s.category.id} onClick={() => setSelectedCategory(s.category.id)} className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-medium', selectedCategory === s.category.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600')}>{s.category.name}</button>)}
          </>
        ) : (
          <>
            <button onClick={() => setBeverageCategory('all')} className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-medium', beverageCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600')}>All</button>
            {categories.filter((c) => c.active).map((c) => <button key={c.id} onClick={() => setBeverageCategory(c.id)} className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-medium', beverageCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600')}>{c.name}</button>)}
          </>
        )}
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
        {primary === 'food' && filteredItems.map((item) => (
          <button key={item.id} onClick={() => item.availableAddOns?.length ? setPendingItem(item) : onAddItem(item, [])} className="card p-3 text-left hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
            <div className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">{item.name}</div>
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Tag className="w-3 h-3" /> {item.category?.name}</div>
            <div className="font-bold text-orange-600">₹{Number(item.price).toFixed(2)}</div>
          </button>
        ))}
        {primary === 'beverages' && beverages.filter((b) => b.active && (beverageCategory === 'all' || b.categoryId === beverageCategory)).filter((b) => `${b.brand} ${b.productName}`.toLowerCase().includes(search.toLowerCase())).map((b) => {
          const productName = `${b.brand}${b.productName ? ` ${b.productName}` : ''}`;
          const servingOptions = [
            { label: '30ml', servingSize: '30ML', price: Number(b.price30ml), bottleOrderFlag: false },
            { label: '60ml', servingSize: '60ML', price: Number(b.price60ml), bottleOrderFlag: false },
            { label: '90ml', servingSize: '90ML', price: Number(b.price90ml), bottleOrderFlag: false },
            {
              label: `${Number(b.bottleSize) === 180 ? 'Quarter' : Number(b.bottleSize) === 375 ? 'Half' : Number(b.bottleSize) === 750 ? 'Full' : 'Bottle'} · ${b.bottleSize}ml`,
              servingSize: 'BOTTLE',
              price: Number(b.bottlePrice),
              bottleOrderFlag: true,
            },
          ].filter((option) => option.price > 0);

          return (
            <div key={b.id} className="card p-3 text-left">
              {b.imagePath && <img src={b.imagePath} alt="" className="w-full h-20 object-cover rounded mb-2" />}
              <div className="font-semibold text-sm text-gray-900 mb-2">{productName}</div>
              <div className="space-y-2">
                {servingOptions.map((option) => (
                  <div key={option.servingSize} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-gray-600">{option.label}</div>
                      <div className="font-bold text-orange-600">₹{option.price.toFixed(2)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addBeverageToCart({
                        id: b.id,
                        brand: b.brand,
                        productName: b.productName || '',
                        unitPrice: option.price,
                        servingSize: option.servingSize,
                        bottleOrderFlag: option.bottleOrderFlag,
                      })}
                      aria-label={`Add ${productName} ${option.label} to order`}
                      className="shrink-0 flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {primary === 'food' && filteredItems.length === 0 && <div className="col-span-3 text-center text-gray-400 text-sm py-12">No items found</div>}
      </div>

      {pendingItem && (
        <AddonPickerModal
          item={pendingItem}
          quantity={1}
          onConfirm={(selectedAddOns) => {
            onAddItem(pendingItem, selectedAddOns);
            setPendingItem(null);
          }}
          onCancel={() => {
            onAddItem(pendingItem, []);
            setPendingItem(null);
          }}
        />
      )}
    </div>
  );
}
