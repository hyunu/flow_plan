import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../api/client'
import type { DashboardData, Task } from '../api/types'
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconFlag,
  IconLink,
  IconList,
  IconProjects,
  IconUser,
} from '../components/icons'
import { ProgressChart } from '../components/ProgressChart'
import { AISummary } from '../components/AISummary'
import { Skeleton, SkeletonCard, SkeletonCircle, SkeletonRow, SkeletonText } from '../components/Skeleton'
import { Badge, EmptyState, PanelHeader, ProgressBar, StatCard, StatusBadge } from '../components/ui'

export function Dashboard() {
  const { id } = useParams()
  const projectId = Number(id)
  const navigate = useNavigate()

  const [data, setData] = useState<DashboardData | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      http.get<DashboardData>(`/dashboard/projects/${projectId}`),
      http.get<Task[]>(`/tasks?project_id=${projectId}&include_children=true`),
    ])
      .then(([d, t]) => {
        setData(d)
        setTasks(t)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-5">
        {/* 헤더 */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <SkeletonText w="w-24" />
            <SkeletonText w="w-72" className="h-7" />
          </div>
          <SkeletonText w="w-40" className="h-10" />
        </div>
        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        {/* AI 요약 */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3">
            <SkeletonCircle size="w-7 h-7" />
            <SkeletonText w="w-32" />
          </div>
          <div className="space-y-2">
            <SkeletonText w="w-full" />
            <SkeletonText w="w-5/6" />
            <SkeletonText w="w-2/3" />
          </div>
        </div>
        {/* 차트 + Milestone */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card p-6">
            <SkeletonText w="w-24" className="mb-4" />
            <Skeleton className="h-52 w-full" />
          </div>
          <div className="card p-6 space-y-4">
            <SkeletonText w="w-28" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <SkeletonText w="w-24" />
                  <SkeletonText w="w-8" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </div>
        {/* 3패널 */}
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 space-y-3">
              <SkeletonText w="w-28" />
              {Array.from({ length: 4 }).map((_, j) => (
                <SkeletonRow key={j} />
              ))}
            </div>
          ))}
        </div>
        {/* 하단 2열 */}
        <div className="grid lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-6 space-y-3">
              <SkeletonText w="w-32" />
              {Array.from({ length: 3 }).map((_, j) => (
                <SkeletonRow key={j} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (error) return <div className="card p-6 text-red-600">{error}</div>
  if (!data) return null

  // 진척곡선용 Task 기간 집계
  const agg = (key: 'baseline' | 'plan') => {
    const dates = tasks
      .map((t) => (key === 'baseline' ? [t.baseline_start, t.baseline_end] : [t.plan_start, t.plan_end]))
      .flat()
      .filter((d): d is string => !!d)
      .sort()
    return dates.length ? { start: dates[0], end: dates[dates.length - 1] } : { start: undefined, end: undefined }
  }
  const b = agg('baseline')
  const p = agg('plan')

  const riskChip =
    data.risk_level === 'CRITICAL'
      ? 'bg-red-50 text-red-600 ring-red-200'
      : data.risk_level === 'WARNING'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-200'

  return (
    <div className="max-w-[1400px] mx-auto space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-ink-700 transition-colors"
          >
            <IconArrowLeft size={14} />
            프로젝트
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold text-ink-900">{data.project_name}</h1>
            <span className={`badge ring-1 ${riskChip}`}>위험도 {data.risk_level}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-[13px]">
            <div className="text-slate-400">예상 완료</div>
            <div className={`font-bold ${data.expected_delay_days > 0 ? 'text-red-600' : 'text-ink-900'}`}>
              {data.forecast_finish || '-'}
              {data.expected_delay_days > 0 && (
                <span className="ml-1.5 text-xs font-medium text-red-500">+{data.expected_delay_days}일</span>
              )}
            </div>
          </div>
          <Link
            to={`/projects/${projectId}/schedule`}
            className="btn-primary"
          >
            <IconCalendar size={15} />
            전체 일정 보기
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="전체 진척률"
          value={`${data.overall_progress}%`}
          sub="작업량 가중 평균"
          icon={<IconProjects size={15} />}
          tone={data.progress_gap > 0 ? 'warn' : 'ok'}
          delta={{ text: `${Math.abs(data.progress_gap)}%p`, dir: data.progress_gap > 0 ? 'down' : 'up' }}
        />
        <StatCard
          label="계획 진척률"
          value={`${data.plan_progress}%`}
          sub="일정 기준 자동 계산"
          icon={<IconClock size={15} />}
        />
        <StatCard
          label="Progress Gap"
          value={`${data.progress_gap}%p`}
          sub={data.progress_gap > 0 ? '계획 대비 지연 중' : '계획 이상 진행'}
          icon={<IconAlert size={15} />}
          tone={data.progress_gap > 0 ? 'danger' : 'ok'}
        />
        <StatCard
          label="지연 Task"
          value={data.delayed_tasks.length}
          sub="자동 감지"
          icon={<IconFlag size={15} />}
          tone={data.delayed_tasks.length > 0 ? 'danger' : 'ok'}
          to={`/projects/${projectId}/schedule?view=table&filter=delayed`}
        />
        <StatCard
          label="미해결 Issue"
          value={data.issues.length}
          sub="해결 예정일 추적"
          icon={<IconAlert size={15} />}
          tone={data.issues.length > 0 ? 'warn' : 'ok'}
          to={`/projects/${projectId}/schedule?view=table&filter=unresolved`}
        />
      </div>

      {/* AI 요약 */}
      {data.ai_summary ? (
        <Link to={`/projects/${projectId}/schedule`} className="card p-6 bg-gradient-to-br from-brand-50/60 to-white block hover:shadow-lift transition-shadow group">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-brand-600 text-white grid place-items-center text-sm">✨</span>
            <h3 className="text-sm font-semibold text-ink-900">AI 현황 요약</h3>
            <span className="ml-auto text-[11px] text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
              전체 일정 보기 →
            </span>
          </div>
          <AISummary content={data.ai_summary} />
        </Link>
      ) : (
        <div className="card p-6 bg-gradient-to-br from-brand-50/40 to-white">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-brand-600/20 text-brand-600 grid place-items-center text-sm animate-pulse">✨</span>
            <h3 className="text-sm font-semibold text-ink-900">AI 현황 요약</h3>
            <span className="ml-auto text-xs text-slate-400">AI 분석을 준비 중입니다... (새로고침 시 표시)</span>
          </div>
        </div>
      )}

      {/* 진척곡선 + Milestone */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ProgressChart
            tasks={tasks}
            plannedFinish={data.planned_finish}
            forecastFinish={data.forecast_finish}
            planProgress={data.plan_progress}
            actualProgress={data.overall_progress}
            baselineStart={b.start}
            baselineEnd={b.end}
            planStart={p.start}
            planEnd={p.end}
            expectedDelayDays={data.expected_delay_days}
            milestones={data.milestones}
            planCurve={data.plan_curve}
            onRefresh={load}
          />
        </div>
        <div className="card p-6">
          <PanelHeader
            title="Milestone"
            action={
              <Link to={`/projects/${projectId}/schedule`} className="text-xs text-brand-600 hover:underline">
                일정 보기
              </Link>
            }
          />
          <div className="space-y-4">
            {data.milestones.map((m) => (
              <Link key={m.id} to={`/projects/${projectId}/schedule`} className="block group">
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-ink-700 font-medium group-hover:text-brand-600 transition-colors">
                    <span className="text-slate-300 mr-1.5">{m.sort_order}.</span>
                    {m.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{Math.round(m.progress)}%</span>
                </div>
                <ProgressBar value={m.progress} />
              </Link>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">계획 완료일</span>
            <span className="text-sm font-bold text-ink-900">{data.planned_finish || '-'}</span>
          </div>
        </div>
      </div>

      {/* 지연 / CP / Issue */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-6">
          <PanelHeader
            title="지연 Task"
            icon={<IconFlag size={15} />}
            action={
              data.delayed_tasks.length > 0 ? (
                <Link to={`/projects/${projectId}/schedule?view=table&filter=delayed`} className="text-xs text-brand-600 hover:underline">
                  전체 보기
                </Link>
              ) : undefined
            }
          />
          {data.delayed_tasks.length === 0 ? (
            <EmptyState>지연 Task가 없습니다</EmptyState>
          ) : (
            <div className="space-y-1.5">
              {data.delayed_tasks.map((t) => (
                <button
                  key={t.task_id}
                  onClick={() => navigate(`/tasks/${t.task_id}`)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-red-50/60 hover:bg-red-50 transition-colors"
                >
                  <span className="text-[13px] text-ink-700 truncate">{t.title}</span>
                  <span className="badge bg-red-100 text-red-600 shrink-0">+{t.delay_days}일</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <PanelHeader title="Critical Path" icon={<IconLink size={15} />} />
          {data.critical_path.length === 0 ? (
            <EmptyState>Critical Path Task가 없습니다</EmptyState>
          ) : (
            <div className="space-y-1">
              {data.critical_path.map((t) => (
                <button
                  key={t.task_id}
                  onClick={() => navigate(`/tasks/${t.task_id}`)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors"
                >
                  <span className="text-[13px] text-ink-700 truncate">{t.title}</span>
                  <span className="text-[11px] text-slate-400 shrink-0">float {t.total_float}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <PanelHeader
            title="Issue"
            icon={<IconAlert size={15} />}
            action={
data.issues.length > 0 ? (
                <Link to={`/projects/${projectId}/schedule?view=table&filter=unresolved`} className="text-xs text-brand-600 hover:underline">
                  전체 보기
                </Link>
              ) : undefined
            }
          />
          {data.issues.length === 0 ? (
            <EmptyState>Issue가 없습니다</EmptyState>
          ) : (
            <div className="space-y-2">
              {data.issues.map((i) => (
                <button
                  key={i.id}
                  onClick={() => navigate(`/tasks/${i.id}`)}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-amber-50/60 hover:bg-amber-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink-700 truncate">{i.title}</span>
                    <StatusBadge status={i.status} />
                  </div>
                  {i.cause && <div className="text-xs text-slate-500 mt-1 truncate">원인: {i.cause}</div>}
                  {i.resolve_plan_date && (
                    <div className="text-[11px] text-slate-400 mt-0.5">해결 예정: {i.resolve_plan_date}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 사용자 작업량 + 최근 변경 */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <PanelHeader title="사용자별 작업량" icon={<IconUser size={15} />} />
          <div className="space-y-3">
            {data.user_workload.map((u) => (
              <Link
                key={u.user_id}
                to={`/projects/${projectId}/schedule?user=${u.user_id}`}
                className="flex items-center gap-4 px-3 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-100 hover:ring-1 hover:ring-brand-200 transition-all group"
                title={`${u.name} 담당 Task 보기`}
              >
                <div className="w-8 h-8 rounded-full bg-white ring-1 ring-slate-200 grid place-items-center text-xs font-bold text-ink-700 shrink-0">
                  {u.name?.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink-700 group-hover:text-brand-600 transition-colors">{u.name}</div>
                  <ProgressBar
                    value={Math.min(100, (u.workload_hours / Math.max(...data.user_workload.map((x) => x.workload_hours), 1)) * 100)}
                    className="mt-1"
                  />
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-ink-900">{Math.round(u.workload_hours)}h</div>
                  <div className="flex gap-1 mt-0.5 justify-end">
                    {u.delayed_tasks > 0 && <Badge tone="red">{u.delayed_tasks} 지연</Badge>}
                    {u.critical_tasks > 0 && <Badge tone="blue">CP {u.critical_tasks}</Badge>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <PanelHeader
            title="최근 일정 변경"
            icon={<IconList size={15} />}
            action={
              data.recent_changes.length > 0 ? (
                <Link to={`/projects/${projectId}/schedule`} className="text-xs text-brand-600 hover:underline">
                  전체 보기
                </Link>
              ) : undefined
            }
          />
          {data.recent_changes.length === 0 ? (
            <EmptyState>변경 이력이 없습니다</EmptyState>
          ) : (
            <div className="space-y-2">
              {data.recent_changes.map((c, i) => (
                <button
                  key={i}
                  onClick={() => navigate(`/tasks/${c.task_id}`)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-50 transition-colors"
                  title="Task 상세 보기"
                >
                  <div className="min-w-0 text-left">
                    <div className="text-[13px] text-ink-700 hover:text-brand-600">Task #{c.task_id}</div>
                    {c.reason && <div className="text-xs text-slate-400 truncate">{c.reason}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-ink-700">
                      {c.before_end?.slice(5) ?? '-'} → {c.after_end?.slice(5) ?? '-'}
                    </div>
                    <div className="text-[11px] text-slate-400">{c.changed_at?.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}