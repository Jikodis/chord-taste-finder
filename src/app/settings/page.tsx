'use client'

import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { getLifetimeStats, resetAll, type AppSettings } from '@/lib/db/storage'
import { exportBackup, importBackup, validateBackup, downloadJson, type BackupFile, type BackupPreview } from '@/lib/export/backup'
import { exportReminder } from '@/lib/tiersView'

const INSTRUMENTS: Array<{ id: AppSettings['instrument']; label: string; note: string }> = [
  { id: 'piano', label: 'Piano', note: 'Recommended — clearest for hearing voicing differences' },
  { id: 'guitar', label: 'Guitar', note: 'Plucked, strummed feel' },
  { id: 'synth', label: 'Synth', note: 'Warm pad tone' },
]

export default function SettingsPage() {
  const ready = useAppStore((s) => s.ready)
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const [total, setTotal] = useState(0)
  const [pending, setPending] = useState<{ file: BackupFile; preview: BackupPreview } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!ready) return
    void getLifetimeStats().then((s) => setTotal(s.totalComparisons))
  }, [ready])

  const reminder = exportReminder(total, settings.lastExportAt, settings.comparisonsAtLastExport)

  const doExport = async () => {
    const backup = await exportBackup()
    downloadJson(backup, `chord-taste-backup-${new Date().toISOString().slice(0, 10)}.json`)
    await updateSettings({ lastExportAt: Date.now(), comparisonsAtLastExport: total })
    setMessage('Backup downloaded.')
  }

  const onFile = async (f: File) => {
    setMessage(null)
    try {
      const parsed: unknown = JSON.parse(await f.text())
      const validated = validateBackup(parsed)
      if (!validated.ok) {
        setMessage(`Import failed: ${validated.error}`)
        return
      }
      setPending({ file: validated.file, preview: validated.preview })
    } catch {
      setMessage('Import failed: not valid JSON.')
    }
  }

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    await importBackup(pending.file, mode)
    setPending(null)
    setMessage(mode === 'merge' ? 'Backup merged — rankings recomputed.' : 'Backup restored.')
    void getLifetimeStats().then((s) => setTotal(s.totalComparisons))
  }

  const doReset = async () => {
    await resetAll()
    setConfirmReset(false)
    setTotal(0)
    setMessage('All data reset.')
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>

      <section className="rounded-xl bg-surface p-5">
        <h2 className="mb-3 font-semibold">Instrument</h2>
        <div className="space-y-2">
          {INSTRUMENTS.map((inst) => (
            <label key={inst.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-surface-2 p-3">
              <input
                type="radio"
                name="instrument"
                checked={settings.instrument === inst.id}
                onChange={() => void updateSettings({ instrument: inst.id })}
                className="accent-[var(--accent)]"
              />
              <div>
                <div className="text-sm font-medium">{inst.label}</div>
                <div className="text-xs text-muted">{inst.note}</div>
              </div>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-muted">Playback tempo: {settings.tempoBpm} BPM</span>
          <input
            type="range"
            min={50}
            max={140}
            value={settings.tempoBpm}
            onChange={(e) => void updateSettings({ tempoBpm: Number(e.target.value) })}
            className="w-full accent-[var(--accent)]"
          />
        </label>
      </section>

      <section className="rounded-xl bg-surface p-5">
        <h2 className="mb-1 font-semibold">Your data</h2>
        <p className="mb-4 text-sm text-muted">
          Everything lives on this device. Export regularly — there is no cloud backup in V1.
          {reminder.due && <span className="text-amber-400"> {reminder.reason}.</span>}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void doExport()}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-surface-2 px-5 py-2.5 text-sm transition hover:bg-accent-soft"
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onFile(f)
              e.target.value = ''
            }}
          />
        </div>

        {pending && (
          <div className="mt-4 rounded-lg border border-accent/40 bg-accent-soft/40 p-4 text-sm">
            <div className="font-semibold">Ready to import</div>
            <ul className="mt-1 text-muted">
              <li>{pending.preview.comparisons.toLocaleString()} comparisons</li>
              <li>{pending.preview.ratedItems} ranked items</li>
              <li>{pending.preview.savedProgressions} saved progressions</li>
              <li>Exported {pending.preview.exportedAt}</li>
            </ul>
            {pending.preview.versionMismatch && (
              <p className="mt-2 text-amber-400">
                Schema version differs from this app version — import may lose fields.
              </p>
            )}
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => void doImport('merge')}
                className="rounded-lg bg-accent px-4 py-2 font-semibold text-white"
              >
                Merge (safer)
              </button>
              <button onClick={() => void doImport('replace')} className="rounded-lg bg-surface-2 px-4 py-2">
                Replace everything
              </button>
              <button onClick={() => setPending(null)} className="px-2 text-muted">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-borderc pt-4">
          {confirmReset ? (
            <div className="text-sm">
              <span className="text-rose-400">
                Delete all {total.toLocaleString()} comparisons and every ranking? This cannot be undone.
              </span>
              <div className="mt-2 flex gap-3">
                <button
                  onClick={() => void doReset()}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white"
                >
                  Yes, reset everything
                </button>
                <button onClick={() => setConfirmReset(false)} className="rounded-lg bg-surface-2 px-4 py-2">
                  Keep my data
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="text-sm text-rose-400 hover:underline">
              Reset all data…
            </button>
          )}
        </div>
      </section>

      {message && <div className="rounded-xl bg-surface p-4 text-sm text-muted">{message}</div>}
    </div>
  )
}
