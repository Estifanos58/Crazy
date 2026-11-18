import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/jetbrains-mono';
import { Toaster } from 'sonner';
import { ConnectionManager } from '@/components/ConnectionManager';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crazy — Real-Time Multiplayer Card Game',
  description:
    'Play Crazy online with friends. Fast-paced shedding card game with punishment chains, special action cards, and live blunder challenges.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConnectionManager />
        {children}
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            style: {
              background: '#1E2723',
              color: '#FAF6EE',
              border: '1px solid #2A3631',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
        />
      </body>
    </html>
  );
}
