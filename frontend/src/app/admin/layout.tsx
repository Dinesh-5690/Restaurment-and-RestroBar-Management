"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, QrCode, ChefHat, Users, ArrowLeft, Settings, PackagePlus, CalendarClock, Fingerprint, ReceiptText, Wallet, TicketPercent, BarChart3, Menu, X } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    closeMobileMenu();
  }, [pathname]);

  const navLinks = [
    { href: '/admin/tables', icon: QrCode, label: 'Tables & QR' },
    { href: '/admin/menu', icon: LayoutDashboard, label: 'Menu Manager' },
    { href: '/admin/stations', icon: ChefHat, label: 'Kitchen Stations' },
    { href: '/admin/users', icon: Users, label: 'Users' },
    { href: '/admin/settings', icon: Settings, label: 'Print Settings' },
    { href: '/admin/addons', icon: PackagePlus, label: 'Extra Add-ons' },
    { href: '/reservations', icon: CalendarClock, label: 'Reservations' },
    { href: '/attendance', icon: Fingerprint, label: 'Shift & Attendance' },
    { href: '/history', icon: ReceiptText, label: 'Financial History' },
    { href: '/expenses', icon: Wallet, label: 'Expense Tracking' },
    { href: '/discounts', icon: TicketPercent, label: 'Discounts & Coupons' },
    { href: '/item-performance', icon: BarChart3, label: 'Item Performance' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700"
            aria-label="Open admin menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-gray-900">Admin Panel</h2>
        </div>
        <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900">Back</Link>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close admin menu"
          onClick={closeMobileMenu}
          className="md:hidden fixed inset-0 z-30 bg-black/40"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'w-64 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:w-56',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none md:pointer-events-auto',
        ].join(' ')}
      >
        <div className="p-5 border-b">
          <div className="md:hidden mb-3 flex justify-end">
            <button
              type="button"
              onClick={closeMobileMenu}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700"
              aria-label="Close admin menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <h2 className="font-bold text-gray-900 mt-3">Admin Panel</h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-700"
            >
              <item.icon className="w-4 h-4" /> {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
