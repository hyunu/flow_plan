import { useEffect, useState } from 'react'
import { applyApiBase } from '../api/client'

type Prefs = { combo: string; label: string; api_base?: string }

function api() {
  return (window as unknown as { pywebview?: { api: {
    get_hotkey: () => Promise<Prefs>
    set_hotkey: (combo: string) => Promise<Prefs>
    reset_hotkey: () => Promise<Prefs>
    get_desktop_prefs: () => Promise<Prefs>
    set_api_base: (url: string) => Promise<Prefs>
  } } }).pywebview?.api
}

function comboFrom(e: KeyboardEvent) {
  const mods: string[] = []
  if (e.metaKey) mods.push('cmd')
  if (e.ctrlKey) mods.push('ctrl')
  if (e.altKey) mods.push('alt')
  if (e.shiftKey) mods.push('shift')
  let k = ''
  if (e.code.startsWith('Key')) k = e.code.slice(3).toLowerCase()
  else if (e.code.startsWith('Digit')) k = e.code.slice(5)
  else if (e.code === 'Space') k = 'space'
  if (!mods.length || !k) return ''
  return [...mods, k].join('+')
}

export function DesktopSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [label, setLabel] = useState('—')
  const [apiUrl, setApiUrl] = useState('')
  const [rec, setRec] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!open) return
    setRec(false)
    setMsg('')
    void api()
      ?.get_desktop_prefs()
      .then((s) => {
        setLabel(s.label || s.combo)
        setApiUrl(s.api_base || '')
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !rec) {
        onClose()
        return
      }
      if (!rec) return
      if (['Meta', 'Control', 'Alt', 'Shift', 'OS'].includes(e.key)) return
      e.preventDefault()
      const combo = comboFrom(e)
      setRec(false)
      if (!combo) {
        setErr(true)
        setMsg('명령/컨트롤/옵션 + 글쇠를 함께 누르세요.')
        return
      }
      void api()
        ?.set_hotkey(combo)
        .then((s) => {
          setLabel(s.label || s.combo)
          setErr(false)
          setMsg('단축키를 저장했습니다.')
        })
        .catch(() => {
          setErr(true)
          setMsg('이 조합은 사용할 수 없습니다.')
        })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, rec, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-card rounded-2xl shadow-lift ring-1 ring-slate-200 p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-[16px] font-semibold text-ink-900">데스크톱 설정</h2>
          <button
            type="button"
            className="w-7 h-7 rounded-lg text-slate-400 hover:bg-surface-100 hover:text-ink-700"
            onClick={onClose}
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="text-[12px] font-semibold text-slate-400 mb-2">단축키</div>
        <p className="text-[12px] text-slate-400 mb-2">창이 숨겨져 있어도 이 키로 다시 엽니다.</p>
        <div
          className={`h-11 rounded-xl bg-surface-100 text-ink-900 font-semibold text-lg tracking-wide grid place-items-center ${
            rec ? 'ring-2 ring-brand-500' : ''
          }`}
        >
          {rec ? '키를 누르세요' : label}
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" className="btn-primary flex-1" onClick={() => { setRec(true); setMsg('') }}>
            단축키 입력
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => {
              setRec(false)
              void api()
                ?.reset_hotkey()
                .then((s) => {
                  setLabel(s.label || s.combo)
                  setErr(false)
                  setMsg('기본 단축키로 되돌렸습니다.')
                })
            }}
          >
            기본값
          </button>
        </div>

        <div className="text-[12px] font-semibold text-slate-400 mt-5 mb-2">백엔드 서버</div>
        <p className="text-[12px] text-slate-400 mb-2 leading-relaxed">
          비우면 이 앱에 내장된 서버를 씁니다. 다른 PC의 FastAPI는
          <span className="text-ink-700"> http://주소:8000</span>, 다른 Flow Plan 앱은
          <span className="text-ink-700"> http://주소:8765/api</span> 입니다.
        </p>
        <input
          className="input"
          placeholder="/api (이 앱)"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => {
              void api()
                ?.set_api_base(apiUrl)
                .then((s) => {
                  applyApiBase(s.api_base || '')
                  setApiUrl(s.api_base || '')
                  setErr(false)
                  setMsg('서버 주소를 저장했습니다. 화면을 다시 불러옵니다.')
                  window.setTimeout(() => window.location.reload(), 400)
                })
                .catch(() => {
                  setErr(true)
                  setMsg('서버 주소를 저장하지 못했습니다.')
                })
            }}
          >
            서버 주소 저장
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setApiUrl('')
              void api()
                ?.set_api_base('')
                .then(() => {
                  applyApiBase('')
                  setErr(false)
                  setMsg('내장 서버로 되돌립니다.')
                  window.setTimeout(() => window.location.reload(), 400)
                })
            }}
          >
            내장
          </button>
        </div>
        <p className={`text-[12px] mt-3 min-h-[18px] ${err ? 'text-red-600' : 'text-emerald-600'}`}>{msg}</p>
      </div>
    </div>
  )
}
