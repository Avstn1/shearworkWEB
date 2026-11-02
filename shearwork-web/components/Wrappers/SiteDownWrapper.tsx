'use client';

import { AlertCircle, ShieldCheck } from 'lucide-react';

interface SiteDownWrapperProps {
  children: React.ReactNode;
}

export default function SiteDownWrapper({ children }: SiteDownWrapperProps) {
  return (
    <div className="relative h-full">
      {/* Overlay with service interruption message */}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
        <div className="modal-surface mx-4 w-full max-w-md px-6 py-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-white/[0.07] bg-raised">
            <AlertCircle className="h-[18px] w-[18px] text-amber-300" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-ivory">
            Temporary Service Interruption
          </h2>
          <p className="mb-3 text-sm leading-relaxed text-gray-400">
            We're experiencing a temporary issue that's preventing us from accessing data right now.
          </p>
          <p className="text-sm leading-relaxed text-gray-400">
            Our team has been notified and is working to get everything back up and running as quickly as possible. We sincerely apologize for any inconvenience this may cause.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 border-t border-white/[0.07] pt-4 text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4 text-sage" strokeWidth={1.75} />
            Your data is safe and this will be resolved shortly.
          </div>
        </div>
      </div>

      {/* Blurred content underneath */}
      <div className="pointer-events-none opacity-70 h-full" style={{ filter: 'blur(3px)' }}>
        {children}
      </div>
    </div>
  );
}
