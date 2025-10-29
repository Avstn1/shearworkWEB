'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) toast.error(error.message);
    else {
      toast.success('Logged in successfully!');
      router.refresh();
      router.push('/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="w-full max-w-md bg-[var(--accent-1)] rounded-2xl p-8 shadow-lg border border-[var(--accent-2)]">
        <h1 className="text-3xl font-bold mb-6 text-center text-[var(--highlight)]">Log In</h1>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full p-3 rounded-lg border border-[var(--accent-2)] bg-[var(--accent-4)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] placeholder:text-[var(--text-subtle)]"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full p-3 rounded-lg border border-[var(--accent-2)] bg-[var(--accent-4)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] placeholder:text-[var(--text-subtle)] pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-[var(--text-muted)] hover:text-[var(--highlight)] transition"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent-2)] hover:bg-[var(--accent-3)] text-[var(--text-bright)] font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="text-center mt-4 text-[var(--text-subtle)]">
          <a href="/signup" className="text-[var(--highlight)] hover:underline">
            Need an account? Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
