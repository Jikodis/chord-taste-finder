'use client'

import { useState } from 'react'
import { guitarVoicings } from '@/lib/music/guitarVoicings'
import { realizeChord } from '@/lib/music/realize'
import { getQuality } from '@/lib/music/chords'
import { pcToName, midiToName } from '@/lib/music/notes'
import FretDiagram from './FretDiagram'
import KeyboardDiagram from './KeyboardDiagram'

/** One chord, playable: name, guitar shape (with alternatives), keyboard keys. */
export default function ChordCard({
  rootPc,
  qualityId,
  roman,
  compact = false,
}: {
  rootPc: number
  qualityId: string
  roman?: string
  compact?: boolean
}) {
  const [showAlts, setShowAlts] = useState(false)
  const quality = getQuality(qualityId)
  const voicings = guitarVoicings(rootPc, qualityId)
  const top = voicings[0]
  if (!quality || !top) return null
  const name = `${pcToName(rootPc)}${quality.symbol || ' major'}`
  const midi = realizeChord(rootPc, qualityId)

  return (
    <div className={`rounded-lg bg-surface-2 p-3 print:bg-white ${compact ? '' : 'sm:p-4'}`}>
      <div className="flex items-baseline gap-2">
        {roman && <span className="font-bold text-accent">{roman}</span>}
        <span className="text-sm font-semibold">{name}</span>
        {!compact && <span className="text-xs text-muted">{quality.name}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        <div>
          <FretDiagram shape={top} />
          <div className="font-mono text-xs text-muted">{top.notation}</div>
          {top.omitted.length > 0 && (
            <div className="text-xs text-muted">{top.omitted.join(' & ')} omitted</div>
          )}
        </div>
        <div>
          <KeyboardDiagram midi={midi} />
          <div className="text-xs text-muted">{midi.map((m) => midiToName(m)).join(' ')}</div>
        </div>
      </div>
      {!compact && voicings.length > 1 && (
        <div className="no-print mt-2">
          <button
            onClick={() => setShowAlts((s) => !s)}
            className="text-xs text-accent hover:underline"
          >
            {showAlts ? '▴ fewer shapes' : `▾ more shapes (${Math.min(voicings.length - 1, 3)})`}
          </button>
          {showAlts && (
            <div className="mt-2 flex flex-wrap gap-3">
              {voicings.slice(1, 4).map((v) => (
                <div key={v.notation}>
                  <FretDiagram shape={v} />
                  <div className="font-mono text-xs text-muted">{v.notation}</div>
                  {v.omitted.length > 0 && (
                    <div className="text-xs text-muted">{v.omitted.join(' & ')} omitted</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
