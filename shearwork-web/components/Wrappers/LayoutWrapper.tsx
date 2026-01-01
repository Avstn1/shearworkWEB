'use client'

import { ReactNode, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { createBrowserClient } from '@supabase/ssr'

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const [hasSession, setHasSession] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(!!session)

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()

        setIsAdmin(profile?.role === 'Admin')
      }
    }

    checkUserRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setHasSession(!!session)

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', session.user.id)
          .single()

        setIsAdmin(profile?.role === 'Admin')
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const showSidebar = hasSession && !isAdmin

  return (
    <>
      {showSidebar && <Sidebar />}
      <div 
        className={`min-h-screen transition-all duration-300 ${
          showSidebar ? 'md:ml-[var(--sidebar-width,0px)] md:w-[calc(100%-var(--sidebar-width,0px))]' : ''
        }`}
      >
        {children}
      </div>
    </>
  )
}