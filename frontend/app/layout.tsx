import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
