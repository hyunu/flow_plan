import { useEffect, useState } from 'react'
import { http } from '../api/client'
import type { DailyReport, Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { IconReport } from '../components/icons'

interface WeeklyReport {
  id: number
  project_id: number
  week_start: string
  content: string
  created_at: string
}

export function Reports() {
  const { user } = useAuth()
  const isManager = user?.role_name === 'Project Manager' || user?.role_name === 'System Administrator'

  const [daily, setDaily] = useState<DailyReport[]>([])
  const [weekly, setWeekly] = useState<WeeklyReport[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selProject, setSelProject] = useState<number>(0)
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily')
  const [busy, setBusy] = useState(false)

  const loadDaily = () => {
    http.get<DailyReport[]>('/reports/daily').then(setDaily).catch(() => {})
  }
  const loadWeekly = (pid: number) => {
    if (!pid) return
    http.get<WeeklyReport[]>(`/reports/weekly/${pid}`).then(setWeekly).catch(() => setWeekly([]))
  }

  useEffect(() => {
    loadDaily()
    http
      .get<Project[]>('/projects')
      .then((p) => {
        setProjects(p)
        if (p[0]) {
          setSelProject(p[0].id)
          loadWeekly(p[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const genDaily = async () => {
    setBusy(true)
    try {
      await http.post('/reports/daily/generate')
      loadDaily()
    } catch (e) {
      alert(e instanceof Error ? e.message : '생성 실패')
    } finally {
      setBusy(false)
    }
  }
  const genWeekly = async () => {
    if (!selProject) return
    setBusy(true)
    try {
      await http.post(`/reports/weekly/generate/${selProject}`)
      loadWeekly(selProject)
    } catch (e) {
      alert(e instanceof Error ? e.message : '생성 실패 (관리자 권한 필요)')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 grid place-items-center">
          <IconReport size={19} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">리포트</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">일일 / 주간 보고서</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {([
          ['daily', '내 Daily Report'],
          ['weekly', '관리자 Weekly Report'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={genDaily} disabled={busy}>
              {busy ? '생성 중...' : '+ Daily Report 생성'}
            </button>
          </div>
          {daily.length === 0 ? (
            <div className="card p-14 text-center text-sm text-slate-400">아직 리포트가 없습니다</div>
          ) : (
            <div className="space-y-4">
              {daily.map((r) => (
                <div key={r.id} className="card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-ink-900">{r.report_date} 일일 리포트</span>
                    <span className="text-xs text-slate-400">{r.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <pre className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans">{r.content}</pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'weekly' && (
        <>
          <div className="card p-5 flex items-end gap-3">
            <div className="flex-1">
              <label className="label">프로젝트</label>
              <select
                className="input"
                value={selProject}
                onChange={(e) => {
                  const pid = Number(e.target.value)
                  setSelProject(pid)
                  loadWeekly(pid)
                }}
              >
                <option value={0}>선택</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={genWeekly} disabled={busy || !isManager || !selProject}>
              {busy ? '생성 중...' : '+ Weekly Report 생성'}
            </button>
            {!isManager && <div className="text-xs text-slate-400 mb-1">관리자 전용</div>}
          </div>

          {weekly.length === 0 ? (
            <div className="card p-14 text-center text-sm text-slate-400">주간 리포트가 없습니다</div>
          ) : (
            <div className="space-y-4">
              {weekly.map((r) => (
                <div key={r.id} className="card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-ink-900">주간 리포트 ({r.week_start} 주)</span>
                    <span className="text-xs text-slate-400">{r.created_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <pre className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-wrap font-sans">{r.content}</pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}