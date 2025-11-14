'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import EditableAvatar from '@/components/EditableAvatar';

const ROLE_OPTIONS = [
  { label: 'Barber (Commission)', role: 'Barber', barber_type: 'commission' },
  { label: 'Barber (Chair Rental)', role: 'Barber', barber_type: 'rental' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState(ROLE_OPTIONS[0]);
  const [commissionRate, setCommissionRate] = useState<number | ''>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleAvatarChange = (file: File) => {
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      let avatarUrl = '';
      if (avatarFile) {
        const fileName = `${fullName.replace(/\s+/g, '_')}_${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
      }

      const profileUpdate: any = {
        full_name: fullName,
        role: selectedRole.role,
        barber_type: selectedRole.barber_type,
        avatar_url: avatarUrl,
        onboarded: true,
      };

      if (selectedRole.barber_type === 'commission') {
        if (commissionRate === '' || commissionRate < 1 || commissionRate > 100) {
          throw new Error('Please enter a valid commission rate between 1 and 100');
        }
        profileUpdate.commission_rate = commissionRate / 100;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
      router.replace('/dashboard');
    } catch (err: any) {
      console.error('Onboarding error:', err.message);
      alert('Failed to complete onboarding: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- FUTURISTIC CLASSES ---
  const inputClass = `
    w-full p-3 rounded-xl bg-black/90 border border-[var(--accent-2)] 
    text-white focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] 
    transition-all
  `;

  const selectClass = `
    w-full p-3 rounded-xl bg-black/90 border border-[var(--accent-2)] 
    text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] 
    transition-all
  `;

  const primaryBtn = `
    w-full py-3 bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold 
    rounded-xl hover:shadow-[0_0_20px_#3af1f7] transition-all
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--background)] text-white p-8">
      <h1 className="text-4xl font-bold mb-8 text-[var(--highlight)]">Complete Your Profile</h1>
      <form
        className="bg-black/80 p-8 rounded-3xl shadow-xl w-full max-w-md space-y-6 flex flex-col items-center"
        onSubmit={handleSubmit}
      >
        <EditableAvatar
          avatarUrl={avatarPreview}
          fullName={fullName}
          onClick={handleAvatarClick}
          size={120}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
        />

        {/* Full Name */}
        <div className="w-full">
          <label className="block mb-2 font-semibold text-white">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        {/* Role Selection */}
        <div className="w-full">
          <label className="block mb-2 font-semibold text-white">Role</label>
          <select
            value={selectedRole.label}
            onChange={e => {
              const roleObj = ROLE_OPTIONS.find(r => r.label === e.target.value);
              if (roleObj) setSelectedRole(roleObj);
            }}
            className={selectClass}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Commission Rate Input */}
        {selectedRole.barber_type === 'commission' && (
          <div className="w-full">
            <label className="block mb-2 font-semibold text-white">
              Commission Rate (%) <span className="text-sm text-gray-400">(1 to 100)</span>
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max="100"
              value={commissionRate}
              onChange={e => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClass}
              required
            />
          </div>
        )}

        {/* Submit Button */}
        <button type="submit" className={primaryBtn} disabled={loading}>
          {loading ? 'Saving...' : 'Complete Onboarding'}
        </button>
      </form>
    </div>
  );
}
