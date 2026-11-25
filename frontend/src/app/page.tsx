'use client';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart,
  ChefHat,
  CheckCircle,
  Shield,
  Settings,
  LayoutGrid,
  Tablet,
  LogOut,
  LayoutDashboard,
  Wine,
  QrCode,
  Boxes,
} from 'lucide-react';
import { approvalApi, kitchenApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';

const modules = [
  { href: '/dashboard', access: 'DASHBOARD', icon: LayoutDashboard, label: 'Dashboard', desc: 'Live daily performance overview', color: 'bg-orange-600' },
  { href: '/pos', access: 'POS', icon: ShoppingCart, label: 'POS / Order', desc: 'Place and manage dine-in orders', color: 'bg-orange-500' },
  { href: '/kitchen', access: 'KITCHEN', icon: ChefHat, label: 'Kitchen Display', desc: 'Real-time kitchen queue by station', color: 'bg-red-500' },
  { href: '/kitchen-inventory', access: 'KITCHEN_INVENTORY', icon: Boxes, label: 'Kitchen Inventory', desc: 'Raw materials, stock in/out and expiry alerts', color: 'bg-amber-600' },
  { href: '/beverages', access: 'BEVERAGES', icon: Wine, label: 'Beverage Management', desc: 'Products, categories, pricing and inventory', color: 'bg-indigo-600' },
  { href: '/bottle-management', access: 'BOTTLE_MANAGEMENT', icon: QrCode, label: 'Bottle Management', desc: 'QR registration, bottle IN/OUT and movement history', color: 'bg-cyan-600' },
  { href: '/approval', access: 'APPROVAL', icon: CheckCircle, label: 'Approval Hub', desc: 'Approve online & QR orders', color: 'bg-green-500' },
  { href: '/tables', access: 'TABLES', icon: LayoutGrid, label: 'Tables', desc: 'Live table orders and status', color: 'bg-blue-500' },
  { href: '/kiosk', access: 'KIOSK', icon: Tablet, label: 'Kiosk', desc: 'Self-service ordering and payment flow', color: 'bg-teal-500' },
  { href: '/admin', access: 'ADMIN', icon: Shield, label: 'Admin', desc: 'Manage tables, menu, and settings', color: 'bg-purple-500' },
  { href: '/login', access: 'ALWAYS', icon: Settings, label: 'Login', desc: 'Authenticate with your account', color: 'bg-gray-500' },
];

export default function HomePage() {
  const [counts, setCounts] = useState({ kitchen: 0, approval: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const fetchCounts = useCallback(async () => {
    try {
      const [kitchenRes, approvalRes] = await Promise.all([
        kitchenApi.queue(),
        approvalApi.pending(),
      ]);

      const kitchenCount = kitchenRes.data.length;

      setCounts({
        kitchen: kitchenCount,
        approval: approvalRes.data.length,
      });
    } catch (error) {
      setCounts({ kitchen: 0, approval: 0 });
    }
  }, []);

  useEffect(() => {
    fetchCounts();
    setIsMounted(true);
  }, [fetchCounts]);

  useSocket(
    {
      ORDER_FIRED: fetchCounts,
      ITEM_COOKING: fetchCounts,
      ITEM_READY: fetchCounts,
      ITEM_SERVED: fetchCounts,
      ORDER_APPROVED: fetchCounts,
      ORDER_REJECTED: fetchCounts,
      ORDER_CREATED: fetchCounts,
    },
    ['pos:all', 'approval:hub'],
  );

  // Filter the modules based on the user's access rights
  const visibleModules = !isMounted 
    ? modules.filter(m => m.access === 'ALWAYS') // Only show login during Server-Side Render to avoid hydration errors
    : modules.filter((mod) => {
        if (mod.access === 'ALWAYS') return !user; // Hide login if the user is already logged in
        if (!user) return false;
        if (user.role === 'ADMIN') return true; // Master Admin role sees everything
        if (mod.href === '/bottle-management') return user.role === 'MANAGER' || user.role === 'CASHIER';
        if (user.role === 'WAITER' && mod.access === 'APPROVAL') return true;
        if (user.role === 'BEVERAGE_MANAGER' && mod.access === 'BEVERAGES') return true;
        return user.accessRights?.includes(mod.access as any);
      });

  return (
    <main className="min-h-screen bg-cover bg-center bg-fixed" style={{ backgroundImage: "linear-gradient(rgba(4, 18, 13, 0.82), rgba(4, 18, 13, 0.92)), url('/dineflow-premium-background.webp')" }}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-8 min-h-10 relative">
          {isMounted && user && (
            <div className="flex justify-end items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-white">{user.name}</div>
                <div className="text-xs text-amber-300 uppercase tracking-wide">{user.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleModules.map((mod) => {
            const count =
              mod.href === '/kitchen'
                ? counts.kitchen
                : mod.href === '/approval'
                  ? counts.approval
                  : 0;

            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="relative rounded-xl border border-white/10 bg-[#07150f]/85 p-6 shadow-xl backdrop-blur-md transition-all hover:-translate-y-1 hover:border-amber-400/40 cursor-pointer group"
              >
                {count > 0 && (
                  <div className="absolute top-4 right-4 inline-flex items-center justify-center h-8 min-w-[2rem] rounded-full bg-black/80 px-2 text-xs font-semibold text-white">
                    {count}
                  </div>
                )}
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${mod.color} mb-4`}>
                  <mod.icon className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1 group-hover:text-amber-300">
                  {mod.label}
                </h2>
                <p className="text-sm text-white/60">{mod.desc}</p>
              </Link>
            );
          })}
        </div>

        {/* Tech stack */}
        <div className="mt-12 text-center">
          <p className="text-xs text-white/35">
            NestJS · PostgreSQL · Redis · Socket.IO · Next.js · Tailwind CSS
          </p>
        </div>
      </div>
    </main>
  );
}
