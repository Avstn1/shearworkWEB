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
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md bg-accent-1 rounded-2xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-highlight">Log In</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            className="border border-accent-2 bg-accent-3 text-foreground p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-highlight"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <input
              className="border border-accent-2 bg-accent-3 text-foreground p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-highlight pr-10"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-highlight"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            className="bg-accent-2 hover:bg-accent-3 text-text-bright font-semibold py-2 rounded-lg transition disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <div className="text-center mt-4">
          <a href="/signup" className="text-highlight hover:underline">
            Need an account? Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
