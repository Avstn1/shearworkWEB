import { Geist } from 'next/font/google'

/** Site-wide UI typeface (applied on <html> in app/layout.tsx). */
export const uiSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

export const siteFontVariables = uiSans.variable
