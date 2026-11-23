'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(username, password);
      setAuth(res.data.user, res.data.access_token);
      toast.success(`Welcome, ${res.data.user.name}!`);
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center px-4" style={{ backgroundImage: "linear-gradient(rgba(4, 18, 13, 0.72), rgba(4, 18, 13, 0.82)), url('/dineflow-premium-background.webp')" }}>
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#07150f]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-md text-white">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-white/70 mb-5">Sign in</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Username</label>
            <input
              className="w-full border border-white/15 bg-white rounded-lg px-3 py-2 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Password</label>
            <input
              type="password"
              className="w-full border border-white/15 bg-white rounded-lg px-3 py-2 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-[#07150f] font-bold py-2.5 rounded-lg transition-colors shadow-lg shadow-amber-950/20"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-6">
          Sign in with your staff account.
        </p>
      </div>
    </div>
  );
}
