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
      {/* Overlay with construction message */}
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
        <div className="text-center px-6 py-8 bg-gradient-to-br from-[#1a1f1b]/95 to-[#2e3b2b]/95 border border-lime-300/20 rounded-2xl shadow-2xl max-w-md mx-4">
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <Construction className="w-16 h-16 text-lime-300 animate-pulse" />
              <div className="absolute inset-0 animate-ping opacity-20">
                <Construction className="w-16 h-16 text-lime-300" />
              </div>
            </div>
          </div>
          {/* <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent mb-3">
            Under Construction
          </h2> */}
          {/* <p className="text-[#bdbdbd] text-sm leading-relaxed">
            This feature is currently being built and will be available soon. 
            We're working hard to bring you an amazing experience!
          </p> */}
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent mb-3">
            Under Maintenance
          </h2>
          <p className="text-[#bdbdbd] text-sm leading-relaxed">
            The site is currently undergoing maintenance and updates.
            We appreciate your patience and understanding during this time.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-lime-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-lime-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-lime-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
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
