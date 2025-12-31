'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'

export default function ManageTipsButton() {
  const router = useRouter()

  return (
    <motion.button
      onClick={() => router.push('/appointment-manager')}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="
        px-3 py-1.5 sm:px-4 sm:py-2
        bg-gradient-to-r from-amber-400/30 to-lime-500/30 
        border border-white/10 text-white font-semibold 
        rounded-xl shadow-md hover:shadow-lg 
        transition-all backdrop-blur-md
        text-xs sm:text-sm
        active:scale-95
      "
    >
      💰 Manage Tips
    </motion.button>
  )
}