'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'

const NAV = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/compare', label: 'Compare', icon: '⚖' },
  { href: '/history', label: 'History', icon: '↺' },
  { href: '/tiers', label: 'Tiers', icon: '▤' },
  { href: '/progress', label: 'Progress', icon: '◔' },
  { href: '/generator', label: 'Generate', icon: '✦' },
  { href: '/cheatsheet', label: 'Cheat Sheet', icon: '▦' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

/** Bottom nav has room for five; History is reached from the dashboard's recent list. */
const MOBILE_NAV = ['/', '/compare', '/tiers', '/progress', '/generator'].map(
  (href) => NAV.find((n) => n.href === href)!
)

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const init = useAppStore((s) => s.init)
  const ready = useAppStore((s) => s.ready)

  useEffect(() => {
    void init()
  }, [init])

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="no-print hidden md:flex md:w-56 md:flex-col md:gap-1 md:border-r md:border-borderc md:bg-surface md:p-4">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold tracking-tight">Chord Taste</div>
          <div className="text-xs text-muted">find your harmonic voice</div>
        </div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname === n.href
                ? 'bg-accent-soft text-foreground'
                : 'text-muted hover:bg-surface-2 hover:text-foreground'
            }`}
          >
            <span className="mr-2">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 pb-20 md:pb-8">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
          {ready ? children : <div className="py-24 text-center text-muted">Loading your taste profile…</div>}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-borderc bg-surface py-2 md:hidden">
        {MOBILE_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center px-2 py-1 text-xs ${
              pathname === n.href ? 'text-accent' : 'text-muted'
            }`}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            {n.label}
          </Link>
        ))}
        <Link
          href="/settings"
          className={`flex flex-col items-center px-2 py-1 text-xs ${
            pathname === '/settings' ? 'text-accent' : 'text-muted'
          }`}
        >
          <span className="text-lg leading-none">⚙</span>
          More
        </Link>
      </nav>
    </div>
  )
}
