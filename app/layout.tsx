import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PortalProvider } from '@/lib/store';
import Frame from '@/components/Frame';
import { Modal, Toast } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Evoluz Academy · Training Hub',
  description: 'Training management for Evoluz: trainees, trainers, courses, sessions and analytics.',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#253f9b', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('evoluzTheme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PortalProvider>
          <Frame>{children}</Frame>
          <Modal />
          <Toast />
        </PortalProvider>
      </body>
    </html>
  );
}
