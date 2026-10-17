'use client';
import { useState, useEffect } from 'react';
import { ExtraAddon, KitchenStation, MenuCategory, MenuItem } from '@/types';
import { menuApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export default function MenuAdminPage() {
  const [stations, setStations] = useState<KitchenStation[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [addCatForm, setAddCatForm] = useState({ name: '', kitchenStation: '', sequence: '0' });
  const [addItemForm, setAddItemForm] = useState({ categoryId: '', name: '', price: '', description: '', prepTimeEstimate: '15' });
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCatForm, setEditCatForm] = useState({ name: '', kitchenStation: '', sequence: '0' });
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({ name: '', price: '', description: '', prepTimeEstimate: '15' });
  const [addons, setAddons] = useState<ExtraAddon[]>([]);
  const [categoryAddonIds, setCategoryAddonIds] = useState<Record<string, string[]>>({});
  const [itemAddonIds, setItemAddonIds] = useState<Record<string, string[]>>({});
  const [savingCategoryAddons, setSavingCategoryAddons] = useState<string | null>(null);
  const [savingItemAddons, setSavingItemAddons] = useState<string | null>(null);

  const fetchAll = async () => {
    const [stationRes, catRes, itemRes, addonRes] = await Promise.all([
      menuApi.stations(),
      menuApi.categories(),
      menuApi.items(),
      menuApi.addons(),
    ]);
    const nextStations = stationRes.data || [];
    const nextCategories = catRes.data || [];
    const nextItems = itemRes.data || [];

    setStations(nextStations);
    setCategories(nextCategories);
    setItems(nextItems);
    setAddons(addonRes.data || []);

    if (!addCatForm.kitchenStation && nextStations.length > 0) {
      const firstActive = nextStations.find((s: KitchenStation) => s.isActive);
      if (firstActive) {
        setAddCatForm((prev) => ({ ...prev, kitchenStation: firstActive.name }));
      }
    }

    const [categoryMappings, itemMappings] = await Promise.all([
      Promise.all(nextCategories.map(async (cat: MenuCategory) => {
        const res = await menuApi.categoryAddons(cat.id);
        return [cat.id, res.data?.addonIds || []] as const;
      })),
      Promise.all(nextItems.map(async (item: MenuItem) => {
        const res = await menuApi.itemAddons(item.id);
        return [item.id, res.data?.addonIds || []] as const;
      })),
    ]);

    setCategoryAddonIds(Object.fromEntries(categoryMappings));
    setItemAddonIds(Object.fromEntries(itemMappings));
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await menuApi.createCategory({
        name: addCatForm.name,
        kitchenStation: addCatForm.kitchenStation || undefined,
        sequence: Number(addCatForm.sequence),
      });
      toast.success('Category created');
      setAddCatForm((prev) => ({ ...prev, name: '', sequence: '0' }));
      setShowAddCat(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await menuApi.createItem({
        categoryId: addItemForm.categoryId,
        name: addItemForm.name,
        price: parseFloat(addItemForm.price),
        description: addItemForm.description || undefined,
        prepTimeEstimate: Number(addItemForm.prepTimeEstimate),
      });
      toast.success('Item created');
      setShowAddItem(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const handleToggleItem = async (id: string) => {
    try {
      await menuApi.toggleItem(id);
      fetchAll();
    } catch {
      toast.error('Error toggling item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete item?')) return;
    try {
      await menuApi.deleteItem(id);
      toast.success('Item deleted');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete category and all its items?')) return;
    try {
      await menuApi.deleteCategory(id);
      toast.success('Category deleted');
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const startEditCategory = (cat: MenuCategory) => {
    setEditCategoryId(cat.id);
    setEditCatForm({
      name: cat.name,
      kitchenStation: cat.kitchenStation || '',
      sequence: String(cat.sequence ?? 0),
    });
  };

  const handleEditCategory = async (id: string) => {
    setSavingCategoryAddons(id);
    try {
      await menuApi.updateCategory(id, {
        name: editCatForm.name,
        kitchenStation: editCatForm.kitchenStation || undefined,
        sequence: Number(editCatForm.sequence),
      });

      await menuApi.setCategoryAddons(id, categoryAddonIds[id] || []);

      toast.success('Category updated');
      setEditCategoryId(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error updating category');
    } finally {
      setSavingCategoryAddons(null);
    }
  };

  const startEditItem = (item: MenuItem) => {
    setEditItemId(item.id);
    setEditItemForm({
      name: item.name,
      price: String(item.price ?? 0),
      description: item.description || '',
      prepTimeEstimate: String(item.prepTimeEstimate ?? 15),
    });
  };

  const handleEditItem = async (id: string) => {
    setSavingItemAddons(id);
    try {
      await menuApi.updateItem(id, {
        name: editItemForm.name,
        price: Number(editItemForm.price),
        description: editItemForm.description || undefined,
        prepTimeEstimate: Number(editItemForm.prepTimeEstimate),
      });

      await menuApi.setItemAddons(id, itemAddonIds[id] || []);

      toast.success('Item updated');
      setEditItemId(null);
      fetchAll();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error updating item');
    } finally {
      setSavingItemAddons(null);
    }
  };

  const getCategoryItems = (catId: string) => items.filter((i) => i.categoryId === catId);

  const toggleCategoryAddon = (catId: string, addonId: string) => {
    const current = categoryAddonIds[catId] || [];
    setCategoryAddonIds((prev) => ({
      ...prev,
      [catId]: current.includes(addonId) ? current.filter((id) => id !== addonId) : [...current, addonId],
    }));
  };

  const toggleItemAddon = (itemId: string, addonId: string) => {
    const current = itemAddonIds[itemId] || [];
    setItemAddonIds((prev) => ({
      ...prev,
      [itemId]: current.includes(addonId) ? current.filter((id) => id !== addonId) : [...current, addonId],
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Menu Manager</h2>
        <button
          onClick={() => setShowAddCat(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {/* Add Category */}
      {showAddCat && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold mb-4">New Category</h3>
          <form onSubmit={handleAddCategory} className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Name *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" required
                value={addCatForm.name} onChange={(e) => setAddCatForm({ ...addCatForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Kitchen Station</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={addCatForm.kitchenStation} onChange={(e) => setAddCatForm({ ...addCatForm, kitchenStation: e.target.value })}>
                {stations.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Sequence</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={addCatForm.sequence} onChange={(e) => setAddCatForm({ ...addCatForm, sequence: e.target.value })} />
            </div>
            <div className="col-span-3 flex gap-3">
              <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm">Create</button>
              <button type="button" onClick={() => setShowAddCat(false)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const catItems = getCategoryItems(cat.id);
          const isOpen = expandedCat === cat.id;
          return (
            <div key={cat.id} className="card overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedCat(isOpen ? null : cat.id)}
              >
                <div className="flex items-center gap-3">
                  <ChevronDown className={clsx('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                  <div>
                    <div className="font-semibold text-gray-900">{cat.name}</div>
                    <div className="text-xs text-gray-400">{cat.kitchenStation} · {catItems.length} items</div>
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => startEditCategory(cat)} className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Pencil className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => { setAddItemForm({ ...addItemForm, categoryId: cat.id }); setShowAddItem(cat.id); }}
                    className="flex items-center gap-1 border border-orange-200 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 border border-red-100 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {editCategoryId === cat.id && (
                <div className="px-4 pb-4 border-t border-gray-50">
                  <div className="bg-gray-50 rounded-xl p-4 mt-3">
                    <h4 className="text-sm font-semibold mb-3">Edit Category</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          value={editCatForm.name}
                          onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          value={editCatForm.kitchenStation}
                          onChange={(e) => setEditCatForm({ ...editCatForm, kitchenStation: e.target.value })}
                        >
                          {stations.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          value={editCatForm.sequence}
                          onChange={(e) => setEditCatForm({ ...editCatForm, sequence: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleEditCategory(cat.id)}
                        disabled={savingCategoryAddons === cat.id}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                      >
                        {savingCategoryAddons === cat.id ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditCategoryId(null)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm">Cancel</button>
                    </div>

                    {addons.length > 0 && (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-gray-600 mb-2">Add-ons for this Category (inherited by all items)</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {addons.filter((a) => a.isActive).map((addon) => {
                            const checked = (categoryAddonIds[cat.id] || []).includes(addon.id);
                            return (
                              <button
                                key={addon.id}
                                onClick={() => toggleCategoryAddon(cat.id, addon.id)}
                                className={clsx('text-xs px-3 py-1 rounded-full border font-medium transition', checked ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')}
                              >
                                {addon.name} {Number(addon.price) === 0 ? '(free)' : `₹${Number(addon.price).toFixed(2)}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Add Item Form */}
              {showAddItem === cat.id && (
                <div className="px-4 pb-4 border-t border-gray-50">
                  <div className="bg-orange-50 rounded-xl p-4 mt-3">
                    <h4 className="text-sm font-semibold mb-3">Add Item to {cat.name}</h4>
                    <form onSubmit={handleAddItem} className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Item name *" required
                          value={addItemForm.name} onChange={(e) => setAddItemForm({ ...addItemForm, name: e.target.value, categoryId: cat.id })} />
                      </div>
                      <div>
                        <input type="number" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Price *" required
                          value={addItemForm.price} onChange={(e) => setAddItemForm({ ...addItemForm, price: e.target.value })} />
                      </div>
                      <div>
                        <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Prep time (min)"
                          value={addItemForm.prepTimeEstimate} onChange={(e) => setAddItemForm({ ...addItemForm, prepTimeEstimate: e.target.value })} />
                      </div>
                      <div className="col-span-2">
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Description (optional)"
                          value={addItemForm.description} onChange={(e) => setAddItemForm({ ...addItemForm, description: e.target.value })} />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Add Item</button>
                        <button type="button" onClick={() => setShowAddItem(null)} className="border border-gray-200 px-4 py-2 rounded-lg text-sm">Cancel</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Items List */}
              {isOpen && catItems.length > 0 && (
                <div className="border-t border-gray-50">
                  {catItems.map((item) => (
                    <div key={item.id} className={clsx('flex items-center px-6 py-3 border-b last:border-0', !item.isAvailable && 'opacity-50')}>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">{item.name}</div>
                        {item.description && <div className="text-xs text-gray-400">{item.description}</div>}
                      </div>
                      <div className="text-sm font-bold text-orange-600 mr-4">₹{Number(item.price).toFixed(2)}</div>
                      <div className="text-xs text-gray-400 mr-4">{item.prepTimeEstimate}m</div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditItem(item)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit item">
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => handleToggleItem(item.id)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Toggle availability">
                          {item.isAvailable
                            ? <ToggleRight className="w-5 h-5 text-green-500" />
                            : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {catItems.map((item) => (
                    editItemId === item.id && (
                      <div key={`edit-${item.id}`} className="px-6 py-3 bg-gray-50 border-b last:border-0">
                        <div className="grid grid-cols-2 gap-2">
                          <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" value={editItemForm.name}
                            onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })} />
                          <input type="number" step="0.01" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={editItemForm.price}
                            onChange={(e) => setEditItemForm({ ...editItemForm, price: e.target.value })} />
                          <input type="number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={editItemForm.prepTimeEstimate}
                            onChange={(e) => setEditItemForm({ ...editItemForm, prepTimeEstimate: e.target.value })} />
                          <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2" value={editItemForm.description}
                            onChange={(e) => setEditItemForm({ ...editItemForm, description: e.target.value })} />
                        </div>
                        {addons.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs font-semibold text-gray-600 mb-1">Item-specific Add-ons (overrides category)</div>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {addons.filter((a) => a.isActive).map((addon) => {
                                const checked = (itemAddonIds[item.id] || []).includes(addon.id);
                                return (
                                  <button
                                    key={addon.id}
                                    onClick={() => toggleItemAddon(item.id, addon.id)}
                                    className={clsx('text-xs px-2.5 py-1 rounded-full border font-medium transition', checked ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300')}
                                  >
                                    {addon.name} {Number(addon.price) === 0 ? '(free)' : `₹${Number(addon.price).toFixed(2)}`}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleEditItem(item.id)}
                            disabled={savingItemAddons === item.id}
                            className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60"
                          >
                            {savingItemAddons === item.id ? 'Saving...' : 'Save'}
                          </button>
                          <button onClick={() => setEditItemId(null)} className="border border-gray-200 px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                        </div>
                      </div>
                    )
                  ))}
                  {catItems.length === 0 && (
                    <div className="px-6 py-4 text-sm text-gray-400">No items yet</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {categories.length === 0 && (
          <div className="text-center text-gray-400 py-12">No categories yet. Add your first one!</div>
        )}
      </div>
    </div>
  );
}
