'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function OnboardingRedirect({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          setLoading(false);
          return; // user not logged in
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarded')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError.message);
        } else if (!profile?.onboarded) {
          router.replace('/app/onboarding'); // redirect if not onboarded
          return;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-200">Loading...</div>;
  }

  return <>{children}</>;
}
