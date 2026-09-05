import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http, setTokens } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useDesktopWin } from '../components/DesktopChrome'

const SHOW_SEED = import.meta.env.DEV

export function Login() {
  const { login, refreshMe } = useAuth()
  const { desk, hide, startMove } = useDesktopWin()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    http
      .get<{ needs_setup: boolean }>('/auth/setup-status')
      .then((s) => setSetup(s.needs_setup))
      .catch(() => setSetup(false))
      .finally(() => setReady(true))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (setup) {
        const pair = await http.post<{ access_token: string; refresh_token: string }>('/auth/setup', {
          username,
          password,
          name: name || '관리자',
        })
        setTokens(pair)
        await refreshMe()
      } else {
        await login(username, password)
      }
      navigate('/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : setup ? '계정 생성 실패' : '로그인 실패')
    } finally {
      setBusy(false)
    }
  }

  const quick = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div
        className="desktop-drag hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white"
        onPointerDown={desk ? startMove : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center font-bold text-lg shadow-lg">
            F
          </div>
          <span className="text-lg font-semibold">Flow Plan</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            프로젝트 일정과 진척사항, <br />
            <span className="text-brand-300">Flow Plan이 스스로 관리합니다.</span>
          </h1>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li>· 최초계획 · 현재계획 · 실제 일정을 비교해 진척을 정확하게 파악</li>
            <li>· 크리티컬 패스를 분석해 예상 지연을 미리 발견</li>
            <li>· 오늘의 챌린지를 찾아 지연 원인과 대응책까지 제시</li>
          </ul>
        </div>
        <div className="text-xs text-slate-600">Deterministic Schedule Engine + AI Interpretation</div>
      </div>

      <div className="relative flex items-center justify-center p-8">
        {desk && (
          <>
            <div
              className="absolute top-0 left-0 right-14 h-14"
              onPointerDown={startMove}
            />
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
              }}
              onClick={(e) => {
                e.stopPropagation()
                hide()
              }}
              className="desktop-no-drag absolute z-20 top-4 right-4 w-8 h-8 rounded-lg text-slate-400 hover:bg-red-500 hover:text-white grid place-items-center"
              title="창 숨기기"
            >
              ✕
            </button>
          </>
        )}
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center font-bold">F</div>
            <span className="font-semibold text-ink-900">Flow Plan</span>
          </div>
          <h2 className="text-xl font-bold text-ink-900">{setup ? '관리자 만들기' : '로그인'}</h2>
          <p className="text-sm text-slate-400 mt-1 mb-8">
            {setup ? '처음 실행입니다. 관리자 아이디와 비밀번호를 정하세요.' : '계정 정보를 입력해 주세요.'}
          </p>

          {ready && (
          <form onSubmit={submit} className="space-y-4">
            {setup && (
              <div>
                <label className="label">이름</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
              </div>
            )}
            <div>
              <label className="label">아이디</label>
              <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">비밀번호</label>
              <input
                className="input"
                type="password"
                autoComplete={setup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {setup && <p className="text-[11px] text-slate-400 mt-1">8자 이상</p>}
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 ring-1 ring-red-100">{error}</div>}
            <button className="btn-primary w-full py-2.5" disabled={busy}>
              {busy ? (setup ? '만드는 중...' : '로그인 중...') : setup ? '관리자 만들고 시작' : '로그인'}
            </button>
          </form>
          )}

          {SHOW_SEED && !setup && (
          <div className="mt-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">시드 계정 (개발)</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['admin', '시스템 관리자', 'admin123'],
                ['pm_a', 'PM (MES)', 'pm123'],
                ['dev_back', '멤버 (백엔드)', 'member123'],
              ].map(([u, label, pw]) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => quick(u, pw)}
                  className="rounded-xl ring-1 ring-slate-200 px-3 py-2.5 text-center hover:ring-brand-300 hover:bg-brand-50 transition-all"
                >
                  <div className="text-[13px] font-semibold text-ink-700">{u}</div>
                  <div className="text-[11px] text-slate-400">{label}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">버튼을 누르면 계정이 자동 입력됩니다. 설치본에는 없습니다.</p>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
