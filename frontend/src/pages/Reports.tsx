import { useEffect, useState } from 'react'
import { http } from '../api/client'
import type { DailyReport, Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { IconMail, IconReport } from '../components/icons'
import { CopyMarkdownButton, MarkdownView } from '../components/MarkdownView'

interface WeeklyReport {
  id: number
  project_id: number
  week_start: string
  content: string
  created_at: string
}

function ReportCard({
  kicker,
  title,
  when,
  content,
  featured,
}: {
  kicker: string
  title: string
  when?: string
  content: string
  featured?: boolean
}) {
  return (
    <article className={`card overflow-hidden ${featured ? 'ring-1 ring-brand-100' : ''}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-surface-50/80 to-white">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge bg-ink-900 text-white">{kicker}</span>
            <h2 className="text-[15px] font-bold text-ink-900 truncate">{title}</h2>
          </div>
          {when && <div className="text-[11px] text-slate-400 mt-0.5">{when}</div>}
        </div>
        <CopyMarkdownButton text={content} />
      </div>
      <div className="px-5 py-4">
        <MarkdownView markdown={content} />
      </div>
    </article>
  )
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
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const canSend = user?.role_name === 'System Administrator' || user?.role_name === 'Project Manager'

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

  const sendDaily = async () => {
    setBusy(true)
    setSendMsg(null)
    try {
      const r = await http.post<{ sent: number; recipients: string[] }>('/reports/daily/send')
      setSendMsg({ ok: true, text: `${r.sent}명에게 일일 리포트를 보냈습니다.` })
      loadDaily()
    } catch (e) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : '발송 실패' })
    } finally {
      setBusy(false)
    }
  }

  const sendWeekly = async () => {
    if (!selProject) return
    setBusy(true)
    setSendMsg(null)
    try {
      const r = await http.post<{ sent: number; recipients: string[] }>(`/reports/weekly/send/${selProject}`)
      setSendMsg({ ok: true, text: `${r.sent}명에게 주간 리포트를 보냈습니다.` })
      loadWeekly(selProject)
    } catch (e) {
      setSendMsg({ ok: false, text: e instanceof Error ? e.message : '발송 실패' })
    } finally {
      setBusy(false)
    }
  }

  const list = tab === 'daily' ? daily : weekly
  const selName = projects.find((p) => p.id === selProject)?.name

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white grid place-items-center shadow-sm">
            <IconReport size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900">리포트</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">
              {tab === 'daily' ? '오늘 할 일과 지연을 한눈에' : '프로젝트 한 주의 일정 상태'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'daily' && canSend && (
            <button className="btn-secondary" onClick={sendDaily} disabled={busy}>
              <IconMail size={15} />
              {busy ? '발송 중...' : '이메일'}
            </button>
          )}
          {tab === 'weekly' && canSend && (
            <button className="btn-secondary" onClick={sendWeekly} disabled={busy || !selProject}>
              <IconMail size={15} />
              {busy ? '발송 중...' : '이메일'}
            </button>
          )}
          {tab === 'daily' ? (
            <button className="btn-primary" onClick={genDaily} disabled={busy}>
              {busy ? '생성 중...' : '오늘 리포트 만들기'}
            </button>
          ) : (
            <button className="btn-primary" onClick={genWeekly} disabled={busy || !isManager || !selProject}>
              {busy ? '생성 중...' : '이번 주 리포트 만들기'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex p-0.5 rounded-xl bg-surface-100 ring-1 ring-slate-200/80">
          {([
            ['daily', '일일', daily.length],
            ['weekly', '주간', weekly.length],
          ] as const).map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-[10px] transition-colors ${
                tab === key ? 'bg-white text-ink-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
              <span className="ml-1.5 text-[11px] tabular-nums text-slate-400">{n}</span>
            </button>
          ))}
        </div>
        {tab === 'weekly' && (
          <select
            className="input !w-auto min-w-[220px] !py-1.5 text-[13px]"
            value={selProject}
            onChange={(e) => {
              const pid = Number(e.target.value)
              setSelProject(pid)
              loadWeekly(pid)
            }}
          >
            <option value={0}>프로젝트 선택</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {sendMsg && (
        <div
          className={`rounded-xl px-4 py-2.5 text-[13px] ${
            sendMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {sendMsg.text}
        </div>
      )}
      {tab === 'weekly' && !isManager && (
        <div className="text-[12px] text-slate-400">주간 리포트 생성은 관리자만 할 수 있습니다.</div>
      )}

      {list.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div className="text-3xl mb-2">📄</div>
          <div className="text-sm font-semibold text-ink-800">아직 리포트가 없습니다</div>
          <div className="text-[13px] text-slate-400 mt-1">
            {tab === 'daily' ? '오늘 리포트 만들기' : '이번 주 리포트 만들기'}를 누르면 일정 엔진 숫자로 본문이 채워집니다.
          </div>
        </div>
      ) : tab === 'daily' ? (
        <div className="space-y-4">
          {daily.map((r, i) => (
            <ReportCard
              key={r.id}
              kicker="일일"
              title={r.report_date}
              when={r.created_at?.slice(0, 16).replace('T', ' ')}
              content={r.content}
              featured={i === 0}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {weekly.map((r, i) => (
            <ReportCard
              key={r.id}
              kicker="주간"
              title={`${r.week_start} 주${selName ? ` · ${selName}` : ''}`}
              when={r.created_at?.slice(0, 16).replace('T', ' ')}
              content={r.content}
              featured={i === 0}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-right">
        {tab === 'daily'
          ? '숫자는 일정 엔진 계산입니다. 담당 Task가 없는 계정은 전체 프로젝트를, 멤버는 자기 담당만 묶습니다.'
          : '선택한 프로젝트 전체를 일정 엔진 숫자로 정리합니다.'}
      </p>
    </div>
  )
}
