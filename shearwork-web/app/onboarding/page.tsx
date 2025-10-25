'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabaseClient';
import EditableAvatar from '@/components/EditableAvatar';

export default function OnboardingPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
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

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName, role, avatar_url: avatarUrl, onboarded: true })
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-8">
      <h1 className="text-3xl font-bold mb-8 text-highlight">Complete Your Profile</h1>
      <form
        className="bg-accent-1 p-8 rounded-2xl shadow-md w-full max-w-md space-y-6 flex flex-col items-center"
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

        <div className="w-full">
          <label className="block mb-1 font-semibold">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full p-2 rounded bg-accent-3 text-foreground focus:outline-none focus:ring-2 focus:ring-highlight"
            required
          />
        </div>

        <div className="w-full">
          <label className="block mb-1 font-semibold">Role</label>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full p-2 rounded bg-accent-3 text-foreground focus:outline-none focus:ring-2 focus:ring-highlight"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-accent-2 hover:bg-accent-3 text-text-bright font-semibold rounded-lg transition"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Complete Onboarding'}
        </button>
      </form>
    </div>
  );
}
