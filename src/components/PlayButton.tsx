'use client'

import { useState } from 'react'
import type { CatalogItem } from '@/lib/items/catalog'
import { playItem } from '@/lib/audio/playItem'
import { useAppStore } from '@/lib/store'

export default function PlayButton({
  item,
  label,
  className = '',
}: {
  item: CatalogItem
  label?: string
  className?: string
}) {
  const settings = useAppStore((s) => s.settings)
  const [playing, setPlaying] = useState(false)

  const onPlay = async () => {
    setPlaying(true)
    try {
      await playItem(item, settings.instrument, settings.tempoBpm)
    } finally {
      setTimeout(() => setPlaying(false), 400)
    }
  }

  return (
    <button
      onClick={onPlay}
      className={`inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-xs text-foreground transition hover:bg-accent-soft ${
        playing ? 'text-accent' : ''
      } ${className}`}
      title={`Play ${item.label}`}
    >
      <span>{playing ? '♪' : '▶'}</span>
      {label}
    </button>
  )
}
