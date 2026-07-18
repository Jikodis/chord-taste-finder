import type { Tier } from '@/lib/ranking/tiers'

export const TIER_COLORS: Record<Tier, string> = {
  S: 'bg-rose-500/90 text-white',
  A: 'bg-orange-500/90 text-white',
  B: 'bg-amber-400/90 text-black',
  C: 'bg-emerald-500/80 text-white',
  D: 'bg-sky-500/80 text-white',
  F: 'bg-slate-500/80 text-white',
}

export default function TierBadge({ tier, size = 'md' }: { tier: Tier; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-5 w-5 text-xs', md: 'h-7 w-7 text-sm', lg: 'h-10 w-10 text-lg' }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md font-bold ${TIER_COLORS[tier]} ${sizes[size]}`}
    >
      {tier}
    </span>
  )
}
