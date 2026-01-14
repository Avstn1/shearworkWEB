'use client'

import { motion } from 'framer-motion'

interface PlatformSwitcherProps {
  currentPlatform: 'web' | 'mobile' | 'both'
  onPlatformChange: (platform: 'web' | 'mobile' | 'both') => void
}

export default function PlatformSwitcher({ currentPlatform, onPlatformChange }: PlatformSwitcherProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 bg-[#1f2420]/95 backdrop-blur-md p-2 rounded-2xl border border-[#55694b]/50"
    >
      <button
        onClick={() => onPlatformChange('web')}
        className={`flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
          currentPlatform === 'web'
            ? 'bg-[#55694b]/40 text-[#d4e7c5] shadow-lg'
            : 'bg-transparent text-white/60 hover:text-white/80 hover:bg-white/5'
        }`}
      >
        <span className="text-lg">🌐</span>
        Web
      </button>
      
      <button
        onClick={() => onPlatformChange('mobile')}
        className={`flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
          currentPlatform === 'mobile'
            ? 'bg-[#55694b]/40 text-[#d4e7c5] shadow-lg'
            : 'bg-transparent text-white/60 hover:text-white/80 hover:bg-white/5'
        }`}
      >
        <span className="text-lg">📱</span>
        Mobile
      </button>
      
      <button
        onClick={() => onPlatformChange('both')}
        className={`flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
          currentPlatform === 'both'
            ? 'bg-[#55694b]/40 text-[#d4e7c5] shadow-lg'
            : 'bg-transparent text-white/60 hover:text-white/80 hover:bg-white/5'
        }`}
      >
        <span className="text-lg">🌐📱</span>
        Web & Mobile
      </button>
    </motion.div>
  )
}