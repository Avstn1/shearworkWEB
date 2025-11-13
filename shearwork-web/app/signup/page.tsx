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
    if (password !== confirmPassword) {
      toast.error("Passwords don't match!");
      return;
    }

    setLoading(true);
    const { data: userProfile, error } = await supabase.auth.signInWithPassword({ email, password });

    const { error: insertError } = await supabase
    .from('system_logs')
    .insert({
        source: userProfile.user?.id,
        action: 'user_signup',
        status: 'success',
        details: `User ${userProfile.user?.email} logged in.`,
    })

    if (insertError) throw insertError

    if (error) toast.error(error.message);
    else {
      toast.success('Check your email to confirm your account!');
      router.push('/login');
    }

    setLoading(false);
  };

  const passwordMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="w-full max-w-md bg-[var(--accent-1)] rounded-2xl p-8 shadow-lg border border-[var(--accent-2)]">
        <h1 className="text-3xl font-bold mb-6 text-center text-[var(--highlight)]">Sign Up</h1>

        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
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

          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              className={`w-full p-3 rounded-lg pr-10 bg-[var(--accent-4)] text-[var(--foreground)] focus:outline-none focus:ring-2 ${
                confirmPassword
                  ? passwordMatch
                    ? 'border border-[var(--accent-2)] focus:ring-[var(--highlight)]'
                    : 'border border-red-500 focus:ring-red-400'
                  : 'border border-[var(--accent-2)] focus:ring-[var(--highlight)]'
              } placeholder:text-[var(--text-subtle)]`}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-3 flex items-center text-[var(--text-muted)] hover:text-[var(--highlight)] transition"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent-2)] hover:bg-[var(--accent-3)] text-[var(--text-bright)] font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center mt-4 text-[var(--text-subtle)]">
          <a href="/login" className="text-[var(--highlight)] hover:underline">
            Already have an account? Log in
          </a>
        </div>
      </div>
    </div>
  );
}
