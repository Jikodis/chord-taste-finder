import type { GuitarShape } from '@/lib/music/guitar'

/** Fretboard grid with dot markers (PRD §3.4.3). Strings left-to-right = low E to high E. */
export default function FretDiagram({ shape, className = '' }: { shape: GuitarShape; className?: string }) {
  const frets = shape.frets
  const minFret = Math.min(...frets.filter((f): f is number => f !== null && f > 0), Infinity)
  const base = shape.baseFret > 0 ? shape.baseFret : minFret === Infinity ? 1 : Math.max(1, Math.min(minFret, 12))
  const windowStart = frets.every((f) => f === null || f <= 4) ? 1 : base
  const rows = 4

  const colX = (s: number) => 10 + s * 12
  const rowY = (r: number) => 14 + r * 13

  return (
    <svg viewBox="0 0 80 72" className={className} style={{ width: 72 }} role="img" aria-label={`Guitar shape ${shape.notation}`}>
      {windowStart > 1 && (
        <text x={2} y={rowY(0) + 9} fontSize={7} fill="#8b96ab">
          {windowStart}
        </text>
      )}
      {/* nut or top line */}
      <line x1={colX(0)} y1={rowY(0)} x2={colX(5)} y2={rowY(0)} stroke="#e8ecf4" strokeWidth={windowStart === 1 ? 3 : 1} />
      {Array.from({ length: rows }, (_, r) => (
        <line key={r} x1={colX(0)} y1={rowY(r + 1)} x2={colX(5)} y2={rowY(r + 1)} stroke="#4a5568" strokeWidth={1} />
      ))}
      {Array.from({ length: 6 }, (_, s) => (
        <line key={s} x1={colX(s)} y1={rowY(0)} x2={colX(s)} y2={rowY(rows)} stroke="#4a5568" strokeWidth={1} />
      ))}
      {frets.map((f, s) => {
        if (f === null)
          return (
            <text key={s} x={colX(s) - 3} y={rowY(0) - 4} fontSize={7} fill="#8b96ab">
              ✕
            </text>
          )
        if (f === 0)
          return (
            <circle key={s} cx={colX(s)} cy={rowY(0) - 6} r={2.5} fill="none" stroke="#e8ecf4" strokeWidth={1} />
          )
        const rel = f - windowStart + 1
        if (rel < 1 || rel > rows) return null
        return <circle key={s} cx={colX(s)} cy={rowY(rel) - 6.5} r={4} fill="#7c5cff" />
      })}
    </svg>
  )
}
