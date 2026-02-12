'use client';

import { AlertCircle } from 'lucide-react';

interface SiteDownWrapperProps {
  children: React.ReactNode;
}

export default function SiteDownWrapper({ children }: SiteDownWrapperProps) {
  return (
    <div className="relative h-full">
      {/* Overlay with service interruption message */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
        <div className="text-center px-6 py-8 bg-gradient-to-br from-[#1a1f1b]/95 to-[#2e3b2b]/95 border border-amber-300/20 rounded-2xl shadow-2xl max-w-md mx-4">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <AlertCircle className="w-16 h-16 text-amber-300 animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <AlertCircle className="w-16 h-16 text-amber-300" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-300 bg-clip-text text-transparent mb-3">
            Temporary Service Interruption
          </h2>
          <p className="text-[#bdbdbd] text-sm leading-relaxed mb-4">
            We're experiencing a temporary issue that's preventing us from accessing data right now.
          </p>
          <p className="text-[#bdbdbd] text-sm leading-relaxed">
            Our team has been notified and is working to get everything back up and running as quickly as possible. We sincerely apologize for any inconvenience this may cause.
          </p>
          <div className="mt-6 pt-4 border-t border-lime-300/10">
            <p className="text-lime-300/80 text-xs">
              Your data is safe and this will be resolved shortly.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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