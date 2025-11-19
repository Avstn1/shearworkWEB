import './globals.css';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from '@/contexts/AppContext'

export const metadata = {
  title: 'ShearWork',
  description: 'Barber management made easy.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100 font-sans min-h-screen">
        <AppProvider>
          <div className="min-h-screen">{children}</div>

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
