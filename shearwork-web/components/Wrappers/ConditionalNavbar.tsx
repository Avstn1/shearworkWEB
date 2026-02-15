'use client'

import { usePathname } from 'next/navigation'
import Navbar from '@/components/Navbar'

export default function ConditionalNavbar() {
  const pathname = usePathname()
  const hideNavbar = pathname === '/pricing/return'

  if (hideNavbar) return null
  
  return <Navbar />
}