'use client';

import { Construction } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface UnderConstructionWrapperProps {
  children: React.ReactNode;
}

export default function UnderConstructionWrapper({ children }: UnderConstructionWrapperProps) {
  const { user, profile, isLoading } = useAuth();

  const hasSession = !!user;
  const isTestAccount = Boolean(profile?.special_access);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">{children}</div>;
  }

  if (!hasSession || isTestAccount) {
    return <>{children}</>;
  }

  return (
    <div className="relative h-full">
      {/* Overlay with maintenance message */}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
        <div className="modal-surface mx-4 w-full max-w-md px-6 py-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.07] bg-raised">
            <Construction className="h-[18px] w-[18px] text-sage" strokeWidth={1.75} />
          </div>
          {/* <h2>Under Construction</h2>
          <p>
            This feature is currently being built and will be available soon.
            We're working hard to bring you an amazing experience!
          </p> */}
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-ivory">
            Under Maintenance
          </h2>
          <p className="text-sm leading-relaxed text-gray-400">
            The site is currently undergoing maintenance and updates.
            We appreciate your patience and understanding during this time.
          </p>
        </div>
      </div>

      {/* Blurred content underneath */}
      <div className="pointer-events-none opacity-70 h-full" style={{ filter: 'blur(3px)' }}>
        {children}
      </div>
    </div>
  );
}
