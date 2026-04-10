import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { PlayerProvider } from './lib/player-context'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Pat and Mat',
  description: 'Real-time multiplayer Axis Split drawing game',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PlayerProvider>{children}</PlayerProvider>
      </body>
    </html>
  )
}
