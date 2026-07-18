'use client'

import { create } from 'zustand'
import { type AppSettings, DEFAULT_SETTINGS, getSettings, saveSettings, ensureSeeded } from './db/storage'

interface AppState {
  ready: boolean
  settings: AppSettings
  sessionId: string
  init: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  sessionId: '',
  init: async () => {
    if (get().ready) return
    await ensureSeeded()
    const settings = await getSettings()
    set({
      ready: true,
      settings,
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })
  },
  updateSettings: async (patch) => {
    const settings = await saveSettings(patch)
    set({ settings })
  },
}))
