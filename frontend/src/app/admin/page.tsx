import Link from 'next/link';
import { QrCode, LayoutDashboard, ChefHat, Users, Settings, PackagePlus, CalendarClock, Fingerprint, ReceiptText, Wallet, TicketPercent, BarChart3 } from 'lucide-react';

const sections = [
  {
    href: '/admin/tables',
    icon: QrCode,
    label: 'Tables & QR',
    desc: 'Add, edit and remove tables. Regenerate QR codes for each table.',
    color: 'bg-blue-500',
  },
  {
    href: '/admin/menu',
    icon: LayoutDashboard,
    label: 'Menu Manager',
    desc: 'Manage categories, menu items, pricing and availability.',
    color: 'bg-purple-500',
  },
  {
    href: '/admin/stations',
    icon: ChefHat,
    label: 'Kitchen Stations',
    desc: 'Create and manage kitchen stations used by menu categories.',
    color: 'bg-orange-500',
  },
  {
    href: '/admin/users',
    icon: Users,
    label: 'Users',
    desc: 'Create staff accounts and manage user salary details.',
    color: 'bg-green-500',
  },
  {
    href: '/admin/settings',
    icon: Settings,
    label: 'Print Settings',
    desc: 'Configure restaurant name, logo, and address for printed receipts.',
    color: 'bg-yellow-500',
  },
  {
    href: '/admin/addons',
    icon: PackagePlus,
    label: 'Extra Add-ons',
    desc: 'Create optional free/paid add-ons and reuse across menu items.',
    color: 'bg-emerald-500',
  },
  {
    href: '/reservations',
    icon: CalendarClock,
    label: 'Reservations',
    desc: 'Plan bookings and table assignments.',
    color: 'bg-sky-500',
  },
  {
    href: '/attendance',
    icon: Fingerprint,
    label: 'Shift & Attendance',
    desc: 'Check-in, check-out and payroll summary.',
    color: 'bg-lime-600',
  },
  {
    href: '/history',
    icon: ReceiptText,
    label: 'Financial History',
    desc: 'Audit transaction logs and settlements.',
    color: 'bg-indigo-500',
  },
  {
    href: '/expenses',
    icon: Wallet,
    label: 'Expense Tracking',
    desc: 'Log and analyze operational expenses.',
    color: 'bg-rose-500',
  },
  {
    href: '/discounts',
    icon: TicketPercent,
    label: 'Discounts & Coupons',
    desc: 'Create and control offers with limits.',
    color: 'bg-fuchsia-500',
  },
  {
    href: '/item-performance',
    icon: BarChart3,
    label: 'Item Performance',
    desc: 'See top-selling items by quantity sold.',
    color: 'bg-teal-500',
  },
];

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel</h1>
      <p className="text-gray-500 mb-8">Select a section to manage.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="card p-6 hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer group"
          >
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${s.color} mb-4`}>
              <s.icon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-orange-600">
              {s.label}
            </h2>
            <p className="text-sm text-gray-500">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
