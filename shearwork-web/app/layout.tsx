import './globals.css';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from '@/contexts/AppContext'
import Sidebar from '@/components/Sidebar'
import Navbar from '@/components/Navbar'

export const metadata = {
  title: 'Corva',
  description: 'Barber management made easy.',
  icons: {
    icon: '/images/corvalogo.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/images/corvalogo.png" />
      </head>
      <body className="bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 font-sans min-h-screen">
        <AppProvider>
          <Navbar/>
          <Sidebar />
          <div className="min-h-screen transition-all duration-300" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>
            {children}
          </div>

          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#1f2937',
                color: '#f9fafb',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '0.95rem',
              },
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}