import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패')
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
      {/* 좌측 브랜드 패널 */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center font-bold text-lg shadow-lg">
            F
          </div>
          <span className="text-lg font-semibold">Flow Plan</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            프로젝트 일정, <br />
            <span className="text-brand-300">AI가 짚어드립니다.</span>
          </h1>
          <ul className="space-y-2 text-slate-400 text-sm">
            <li>· Baseline / Current / Actual 3중 일정 관리</li>
            <li>· Critical Path 자동 분석</li>
            <li>· 지연 원인 · 대책 수집 및 일일 Challenge</li>
          </ul>
        </div>
        <div className="text-xs text-slate-600">Deterministic Schedule Engine + AI Interpretation</div>
      </div>

      {/* 우측 로그인 폼 */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center font-bold">F</div>
            <span className="font-semibold text-ink-900">Flow Plan</span>
          </div>
          <h2 className="text-xl font-bold text-ink-900">로그인</h2>
          <p className="text-sm text-slate-400 mt-1 mb-8">계정 정보를 입력해 주세요.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">아이디</label>
              <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">비밀번호</label>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 ring-1 ring-red-100">{error}</div>}
            <button className="btn-primary w-full py-2.5" disabled={busy}>
              {busy ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-8">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">시드 계정</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['admin', '시스템 관리자', 'admin123'],
                ['pm_a', 'PM (MES)', 'pm123'],
                ['dev_back', '멤버 (백엔드)', 'member123'],
              ].map(([u, label, pw]) => (
                <button
                  key={u}
                  onClick={() => quick(u, pw)}
                  className="rounded-xl ring-1 ring-slate-200 px-3 py-2.5 text-center hover:ring-brand-300 hover:bg-brand-50 transition-all"
                >
                  <div className="text-[13px] font-semibold text-ink-700">{u}</div>
                  <div className="text-[11px] text-slate-400">{label}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">버튼을 누르면 계정이 자동 입력됩니다. (멤버: dev_fe/dev_mes/plan/qa 등)</p>
          </div>
        </div>
      </div>
    </div>
  )
}