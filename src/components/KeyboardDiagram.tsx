const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
const BLACK_PCS = [1, 3, 6, 8, 10]
/** X offset of each black key within its octave, in white-key widths. */
const BLACK_OFFSETS: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.65, 8: 4.65, 10: 5.65 }

/** SVG keyboard highlighting the exact midi notes of a voicing (PRD §3.4.3). */
export default function KeyboardDiagram({ midi, className = '' }: { midi: number[]; className?: string }) {
  if (midi.length === 0) return null
  const pressed = new Set(midi)
  const lowOctave = Math.floor(Math.min(...midi) / 12)
  const highOctave = Math.floor(Math.max(...midi) / 12)
  const octaves: number[] = []
  for (let o = lowOctave; o <= highOctave; o++) octaves.push(o)

  const whiteW = 14
  const whiteH = 46
  const blackW = 9
  const blackH = 28
  const width = octaves.length * 7 * whiteW

  return (
    <svg
      viewBox={`0 0 ${width} ${whiteH}`}
      className={className}
      style={{ width: Math.min(width * 1.6, 320) }}
      role="img"
      aria-label={`Keyboard diagram with ${midi.length} pressed keys`}
    >
      {octaves.map((oct, oi) =>
        WHITE_PCS.map((pc, wi) => {
          const m = oct * 12 + pc
          return (
            <rect
              key={`w${oct}-${pc}`}
              x={oi * 7 * whiteW + wi * whiteW}
              y={0}
              width={whiteW - 1}
              height={whiteH}
              rx={2}
              fill={pressed.has(m) ? '#7c5cff' : '#f4f5f8'}
              stroke="#555"
              strokeWidth={0.5}
            />
          )
        })
      )}
      {octaves.map((oct, oi) =>
        BLACK_PCS.map((pc) => {
          const m = oct * 12 + pc
          return (
            <rect
              key={`b${oct}-${pc}`}
              x={oi * 7 * whiteW + BLACK_OFFSETS[pc] * whiteW}
              y={0}
              width={blackW}
              height={blackH}
              rx={1.5}
              fill={pressed.has(m) ? '#a78bfa' : '#181c26'}
              stroke="#555"
              strokeWidth={0.5}
            />
          )
        })
      )}
    </svg>
  )
}
