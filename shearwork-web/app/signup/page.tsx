'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error("Passwords don't match!");
    setLoading(true);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) toast.error(error.message);
    else {
      toast.success('Check your email to confirm your account!');
      router.push('/login');
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-md bg-accent-1 rounded-2xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-highlight">Sign Up</h1>
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
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
          <div className="relative">
            <input
              className={`border p-3 rounded-lg w-full bg-accent-3 text-foreground focus:outline-none focus:ring-2 pr-10 ${
                password && confirmPassword
                  ? password === confirmPassword
                    ? 'border-accent-2 focus:ring-highlight'
                    : 'border-red-500 focus:ring-red-400'
                  : 'border-accent-2 focus:ring-highlight'
              }`}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-text-muted hover:text-highlight"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            className="bg-accent-2 hover:bg-accent-3 text-text-bright font-semibold py-2 rounded-lg transition disabled:opacity-50"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        <div className="text-center mt-4">
          <a href="/login" className="text-highlight hover:underline">
            Already have an account? Log in
          </a>
        </div>
      </div>
    </div>
  );
}
