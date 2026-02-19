// 'use client'

// import React, { useEffect, useState } from 'react'
// import Link from 'next/link'
// import { usePathname, useRouter } from 'next/navigation'
// import SignOutButton from '@/components/SignOutButton'
// import { motion } from 'framer-motion'
// import { useAuth } from '@/contexts/AuthContext'

// const navLinksBase = [
//   { href: '/dashboard', label: 'Dashboard' },
// ]

// const navItemVariants = {
//   hidden: { x: -20, opacity: 0 },
//   visible: (i: number = 1) => ({
//     x: 0,
//     opacity: 1,
//     transition: { delay: i * 0.05, duration: 0.3 },
//   }),
// }

// export default function Layout({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname()
//   const router = useRouter()
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
//   const [isMobile, setIsMobile] = useState(false)
//   const { user, profile, isLoading, isAdmin } = useAuth()

//   useEffect(() => {
//     const handleResize = () => setIsMobile(window.innerWidth < 768)
//     handleResize()
//     window.addEventListener('resize', handleResize)
//     return () => window.removeEventListener('resize', handleResize)
//   }, [])

//   useEffect(() => {
//     if (isLoading) return
//     if (!user?.id) return

//     const publicPages = ['/login', '/signup', '/pricing', '/pricing/return']
//     if (profile?.onboarded === false && !publicPages.includes(pathname)) {
//       router.push('/pricing/return')
//     }
//   }, [isLoading, pathname, profile?.onboarded, router, user?.id])

//   const navLinks = isAdmin
//     ? navLinksBase.filter(link => link.href !== '/dashboard').concat({
//         href: '/admin/dashboard',
//         label: 'Admin Dashboard',
//       })
//     : navLinksBase

//   if (isLoading) return <p>Loading components/layout...</p>

//   return (
//     <div className="flex flex-col sm:flex-row min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
//       {/* Sidebar for desktop */}
//       {!isMobile && (
//         <aside className="w-72 p-6 flex flex-col bg-[var(--accent-2)]/90 backdrop-blur-lg text-[var(--text-bright)] shadow-2xl">
//           <Link
//             href="/"
//             className="text-3xl font-extrabold mb-10 text-center text-[var(--highlight)]"
//           >
//             ✂️ Corva
//           </Link>
//           <nav className="flex flex-col space-y-3 mb-6">
//             {navLinks.map((link, i) => (
//               <motion.div
//                 key={link.href}
//                 initial="hidden"
//                 animate="visible"
//                 custom={i}
//                 variants={navItemVariants}
//               >
//                 <Link
//                   href={link.href}
//                   className={`block px-4 py-3 rounded-lg text-lg transition-all ${
//                     pathname === link.href
//                       ? 'bg-[var(--accent-2)] text-[var(--foreground)] font-semibold shadow-md'
//                       : 'hover:bg-[var(--accent-1)] hover:text-[var(--text-bright)]'
//                   }`}
//                 >
//                   {link.label}
//                 </Link>
//               </motion.div>
//             ))}
//           </nav>
//           <div className="mt-auto">
//             <SignOutButton className="w-full" />
//           </div>
//         </aside>
//       )}

//       {/* Mobile Top Bar */}
//       {isMobile && (
//         <header className="w-full flex justify-between items-center p-4 bg-[var(--accent-2)] flex-shrink-0">
//           <h1 className="text-lg font-bold text-[var(--highlight)] truncate">
//             ✂️ Corva
//           </h1>
//           <button
//             onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
//             className="text-[var(--text-bright)] text-2xl"
//           >
//             ☰
//           </button>
//         </header>
//       )}

//       {/* Mobile menu overlay */}
//       {isMobile && mobileMenuOpen && (
//         <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
//           <div className="bg-[var(--accent-2)] p-4 flex justify-between items-center">
//             <span className="text-[var(--highlight)] font-bold">✂️ Corva</span>
//             <button
//               onClick={() => setMobileMenuOpen(false)}
//               className="text-[var(--text-bright)] text-xl"
//             >
//               ✕
//             </button>
//           </div>
//           <nav className="flex flex-col p-4 space-y-3 bg-[var(--accent-2)]/95 flex-1 overflow-hidden">
//             {navLinks.map((link) => (
//               <Link
//                 key={link.href}
//                 href={link.href}
//                 className="text-[var(--text-bright)] text-base font-semibold hover:text-[var(--highlight)]"
//                 onClick={() => setMobileMenuOpen(false)}
//               >
//                 {link.label}
//               </Link>
//             ))}
//             <div className="mt-auto">
//               <SignOutButton className="w-full" />
//             </div>
//           </nav>
//         </div>
//       )}

//       {/* Main content */}
//       <main className="flex-1 w-full p-3 sm:p-6 flex flex-col min-h-0 overflow-y-auto">
//         {children}
//       </main>
//     </div>
//   )
// }
