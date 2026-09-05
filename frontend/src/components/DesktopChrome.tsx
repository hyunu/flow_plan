import { createContext, useContext, useEffect, useState } from 'react'
import { applyApiBase } from '../api/client'
import { DesktopSettingsModal } from './DesktopSettingsModal'

type Geom = { x: number; y: number; width: number; height: number }

type DesktopWin = {
  desk: boolean
  hide: () => void
  startMove: (e: React.PointerEvent) => void
}

const DesktopWinContext = createContext<DesktopWin>({
  desk: false,
  hide: () => {},
  startMove: () => {},
})

export function useDesktopWin() {
  return useContext(DesktopWinContext)
}

function api() {
  return (window as unknown as { pywebview?: { api: {
    hide: () => Promise<void>
    geometry: () => Promise<Geom>
    move_to: (x: number, y: number) => Promise<void>
    resize_to: (w: number, h: number) => Promise<void>
    get_desktop_prefs?: () => Promise<{ api_base?: string }>
    save_text?: (suggested: string, content: string) => Promise<{ ok: boolean; path?: string; cancelled?: boolean; error?: string }>
  } } }).pywebview?.api
}

export async function saveJsonFile(filename: string, text: string): Promise<{ ok: boolean; path?: string; cancelled?: boolean }> {
  const desk = api()?.save_text
  if (desk) {
    const r = await desk(filename, text)
    if (r.cancelled) return { ok: false, cancelled: true }
    if (!r.ok) throw new Error(r.error || '저장 실패')
    return { ok: true, path: r.path }
  }
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: {
      suggestedName: string
      types: { description: string; accept: Record<string, string[]> }[]
    }) => Promise<{
      name: string
      createWritable: () => Promise<{ write: (t: string) => Promise<void>; close: () => Promise<void> }>
    }>
  }).showSaveFilePicker
  if (picker) {
    const handle = await picker({
      suggestedName: filename,
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    })
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
    return { ok: true, path: handle.name }
  }
  const blob = new Blob([text], { type: 'application/octet-stream' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return { ok: true }
}

function isInteractive(el: EventTarget | null) {
  return !!(el as HTMLElement | null)?.closest?.(
    'button, a, input, select, textarea, [role="button"], [data-no-drag]',
  )
}

export function DesktopChrome({ children }: { children: React.ReactNode }) {
  const [desk, setDesk] = useState(false)
  const [ready, setReady] = useState(false)
  const [settings, setSettings] = useState(false)

  useEffect(() => {
    let finished = false
    const finish = async (isDesk: boolean) => {
      if (finished) return
      finished = true
      if (isDesk) {
        setDesk(true)
        document.documentElement.classList.add('desktop-app')
        try {
          const prefs = await api()?.get_desktop_prefs?.()
          applyApiBase(prefs?.api_base || '')
        } catch {
          /* 내장 /api */
        }
      }
      setReady(true)
    }
    if ((window as unknown as { pywebview?: unknown }).pywebview) {
      void finish(true)
    }
    const onReady = () => {
      void finish(true)
    }
    window.addEventListener('pywebviewready', onReady)
    const t = window.setTimeout(() => {
      void finish(!!(window as unknown as { pywebview?: unknown }).pywebview)
    }, 500)
    return () => {
      window.removeEventListener('pywebviewready', onReady)
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const open = () => setSettings(true)
    window.addEventListener('flowplan-open-desk-settings', open)
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      document.documentElement.classList.add('desktop-hover-off')
      window.dispatchEvent(new Event('flowplan-hover-reset'))
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      const thaw = () => document.documentElement.classList.remove('desktop-hover-off')
      window.setTimeout(() => {
        window.addEventListener('pointermove', thaw, { once: true })
      }, 200)
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('flowplan-open-desk-settings', open)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])

  const hide = () => {
    document.documentElement.classList.add('desktop-hover-off')
    window.dispatchEvent(new Event('flowplan-hover-reset'))
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    const thaw = () => document.documentElement.classList.remove('desktop-hover-off')
    window.setTimeout(() => {
      window.addEventListener('pointermove', thaw, { once: true })
    }, 200)
    const fn = api()?.hide
    if (fn) void fn()
  }

  const startMove = async (e: React.PointerEvent) => {
    if (isInteractive(e.target)) return
    const g = await api()?.geometry()
    if (!g) return
    const sx = e.screenX
    const sy = e.screenY
    const onMove = (ev: PointerEvent) => {
      void api()?.move_to(g.x + (ev.screenX - sx), g.y + (ev.screenY - sy))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (edge: string) => async (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const g = await api()?.geometry()
    if (!g) return
    const sx = e.screenX
    const sy = e.screenY
    const onMove = (ev: PointerEvent) => {
      const dx = ev.screenX - sx
      const dy = ev.screenY - sy
      let x = g.x
      let y = g.y
      let w = g.width
      let h = g.height
      if (edge.includes('e')) w = g.width + dx
      if (edge.includes('s')) h = g.height + dy
      if (edge.includes('w')) {
        w = g.width - dx
        x = g.x + dx
      }
      if (edge.includes('n')) {
        h = g.height - dy
        y = g.y + dy
      }
      w = Math.max(1000, w)
      h = Math.max(680, h)
      void api()?.move_to(x, y)
      void api()?.resize_to(w, h)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const win: DesktopWin = { desk, hide, startMove }

  if (!ready) {
    return <div className="min-h-screen bg-slate-50" />
  }

  if (!desk) {
    return (
      <DesktopWinContext.Provider value={win}>
        {children}
        <DesktopSettingsModal open={settings} onClose={() => setSettings(false)} />
      </DesktopWinContext.Provider>
    )
  }

  const edge = (cls: string, dir: string) => (
    <div
      className={`desktop-no-drag fixed z-[120] ${cls}`}
      onPointerDown={startResize(dir)}
    />
  )

  return (
    <DesktopWinContext.Provider value={win}>
      <div className="h-screen overflow-hidden relative">
        {edge('left-0 top-2 bottom-2 w-1.5 cursor-ew-resize', 'w')}
        {edge('right-0 top-2 bottom-2 w-1.5 cursor-ew-resize', 'e')}
        {edge('top-0 left-2 right-2 h-1.5 cursor-ns-resize', 'n')}
        {edge('bottom-0 left-2 right-2 h-1.5 cursor-ns-resize', 's')}
        {edge('left-0 top-0 w-3 h-3 cursor-nwse-resize', 'nw')}
        {edge('right-0 top-0 w-3 h-3 cursor-nesw-resize', 'ne')}
        {edge('left-0 bottom-0 w-3 h-3 cursor-nesw-resize', 'sw')}
        {edge('right-0 bottom-0 w-3 h-3 cursor-nwse-resize', 'se')}

        <div className="h-full overflow-hidden relative z-10">{children}</div>
        <DesktopSettingsModal open={settings} onClose={() => setSettings(false)} />
      </div>
    </DesktopWinContext.Provider>
  )
}
