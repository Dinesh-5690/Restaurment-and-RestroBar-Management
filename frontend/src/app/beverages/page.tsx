'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, RefreshCw, Wine } from 'lucide-react';
import toast from 'react-hot-toast';
import { beveragesApi } from '@/lib/api';

const emptyForm = { categoryId: '', brand: '', bottleSize: 750, bottlePrice: '', imagePath: '', active: true };

export default function BeverageManagementPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [p, c] = await Promise.all([beveragesApi.products(), beveragesApi.categories()]);
    setProducts(p.data); setCategories(c.data);
  };
  useEffect(() => { load().catch(() => toast.error('Failed to load beverages')); }, []);

  const addCategory = async () => {
    if (!categoryName.trim()) return toast.error('Enter a category name');
    await beveragesApi.createCategory({ name: categoryName.trim(), active: true });
    setCategoryName(''); await load(); toast.success('Category created');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? '' });
    setFormOpen(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
    setForm({ categoryId: b.categoryId, brand: b.brand, bottleSize: b.bottleSize, bottlePrice: String(b.bottlePrice ?? ''), imagePath: b.imagePath ?? '', active: !!b.active });
    setFormOpen(true);
  };

  const saveBeverage = async () => {
    if (!form.categoryId) return toast.error('Create or select a category first');
    if (!form.brand.trim()) return toast.error('Brand name is required');
    const price = Number(form.bottlePrice);
    if (!Number.isFinite(price) || price <= 0) return toast.error('Enter a valid bottle selling price');
    setSaving(true);
    try {
      const payload = { categoryId: form.categoryId, brand: form.brand.trim(), productName: '', bottleSize: Number(form.bottleSize), bottlePrice: price, abv: 0, price30ml: 0, price60ml: 0, price90ml: 0, imagePath: form.imagePath.trim() || null, active: form.active };
      if (editingId) await beveragesApi.updateProduct(editingId, payload);
      else await beveragesApi.createProduct({ ...payload, availableMl: 0 });
      setFormOpen(false); await load(); toast.success(editingId ? 'Beverage updated' : 'Beverage created');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save beverage');
    } finally { setSaving(false); }
  };

  const deleteBeverage = async (b: any) => {
    if (!confirm(`Delete ${b.brand}?`)) return;
    await beveragesApi.removeProduct(b.id); await load(); toast.success('Beverage deleted');
  };

  const sizeLabel = (ml: number) => ml === 180 ? 'Quarter – 180ml' : ml === 375 ? 'Half – 375ml' : ml === 750 ? 'Full – 750ml' : `${ml}ml`;

  return <div className="min-h-screen bg-gray-50">
    <header className="bg-white border-b px-6 py-3 flex items-center gap-3"><Link href="/" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link><Wine className="w-5 h-5 text-indigo-600"/><h1 className="font-bold text-lg">Beverage Management</h1><button onClick={load} className="ml-auto"><RefreshCw className="w-4 h-4" /></button></header>
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <section className="card p-4"><div className="flex gap-2 mb-4"><input value={categoryName} onChange={(e)=>setCategoryName(e.target.value)} placeholder="New category" className="border rounded-lg px-3 py-2 text-sm"/><button onClick={addCategory} className="bg-indigo-600 text-white px-3 rounded-lg text-sm">Add Category</button></div><div className="flex gap-2 flex-wrap">{categories.map(c=><span key={c.id} className="badge badge-blue">{c.name}</span>)}</div></section>
      <section className="card p-4"><div className="flex items-center mb-4"><h2 className="font-semibold">Beverages</h2><button onClick={openCreate} className="ml-auto flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm"><Plus className="w-4 h-4"/>Create Beverage</button></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left bg-gray-50"><th className="p-2">Brand</th><th>Bottle Size</th><th>Bottle Price</th><th>Status</th><th className="text-right pr-2">Actions</th></tr></thead><tbody>{products.map(b=><tr key={b.id} className="border-t"><td className="p-2">{b.brand}</td><td>{sizeLabel(Number(b.bottleSize))}</td><td>₹{Number(b.bottlePrice).toFixed(2)}</td><td><span className={b.active?'text-green-600 font-medium':'text-red-600 font-medium'}>{b.active?'Active':'Inactive'}</span></td><td className="text-right pr-2"><button onClick={()=>openEdit(b)} className="text-indigo-600 mr-3">Edit</button><button onClick={()=>deleteBeverage(b)} className="text-red-600">Delete</button></td></tr>)}</tbody></table></div></section>
    </main>
    {formOpen && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6"><h2 className="text-lg font-bold mb-5">{editingId?'Edit Beverage':'Create Beverage'}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-sm">Category<select value={form.categoryId} onChange={(e)=>setForm({...form,categoryId:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"><option value="">Select category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm">Brand Name<input value={form.brand} onChange={(e)=>setForm({...form,brand:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="e.g. Old Monk"/></label><label className="text-sm">Bottle Size<select value={form.bottleSize} onChange={(e)=>setForm({...form,bottleSize:Number(e.target.value)})} className="mt-1 w-full border rounded-lg px-3 py-2"><option value={180}>Quarter – 180ml</option><option value={375}>Half – 375ml</option><option value={750}>Full – 750ml</option></select></label><label className="text-sm">Bottle Selling Price (₹)<input type="number" min="0" step="0.01" value={form.bottlePrice} onChange={(e)=>setForm({...form,bottlePrice:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2"/></label><label className="text-sm">Product Image (optional)<input value={form.imagePath} onChange={(e)=>setForm({...form,imagePath:e.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Image URL"/></label><label className="text-sm sm:col-span-2">Status<select value={form.active?'active':'inactive'} onChange={(e)=>setForm({...form,active:e.target.value==='active'})} className="mt-1 w-full border rounded-lg px-3 py-2"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div><div className="flex justify-end gap-3 mt-6"><button disabled={saving} onClick={()=>setFormOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button><button disabled={saving} onClick={saveBeverage} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">{saving?'Saving...':'Save'}</button></div></div></div>}
  </div>;
}
