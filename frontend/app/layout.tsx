import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { ConnectionManager } from '@/components/ConnectionManager'

export const metadata: Metadata = {
  title: 'Crazy - Multiplayer Card Game',
  description: 'Play Crazy card game online with friends',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ConnectionManager />
        {children}
        <Toaster 
          position="top-center" 
          richColors 
          closeButton
          theme="dark"
        />
      </body>
    </html>
  )
}
