import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  applyDisplayPrefs,
  DEFAULT_PREFS,
  loadDisplayPrefs,
  PALETTES,
  saveDisplayPrefs,
  type DisplayPrefs,
  type PaletteId,
} from '../lib/displayPrefs'

interface DisplayCtx {
  prefs: DisplayPrefs
  setPrefs: (next: DisplayPrefs | ((p: DisplayPrefs) => DisplayPrefs)) => void
  applyPalette: (id: PaletteId) => void
  reset: () => void
}

const Ctx = createContext<DisplayCtx | null>(null)

export function DisplayProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<DisplayPrefs>(() => loadDisplayPrefs())

  useEffect(() => {
    applyDisplayPrefs(prefs)
    saveDisplayPrefs(prefs)
    const obs = new MutationObserver(() => applyDisplayPrefs(prefs))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [prefs])

  const setPrefs = useCallback((next: DisplayPrefs | ((p: DisplayPrefs) => DisplayPrefs)) => {
    setPrefsState((p) => (typeof next === 'function' ? next(p) : next))
  }, [])

  const applyPalette = useCallback((id: PaletteId) => {
    setPrefsState((p) => ({ ...p, palette: id, colors: { ...PALETTES[id].colors } }))
  }, [])

  const reset = useCallback(() => setPrefsState(structuredClone(DEFAULT_PREFS)), [])

  const value = useMemo(() => ({ prefs, setPrefs, applyPalette, reset }), [prefs, setPrefs, applyPalette, reset])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDisplay() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDisplay')
  return ctx
}
