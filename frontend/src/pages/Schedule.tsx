import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { http } from '../api/client'
import type { Dependency, Group, Project, Task } from '../api/types'
import { useAuth, useCan } from '../auth/AuthContext'
import { Gantt } from '../components/Gantt'
import { PresenceBar } from '../components/PresenceBar'
import { TaskTable } from '../components/TaskTable'
import { TaskFormModal } from '../components/TaskFormModal'
import { DependencyModal } from '../components/DependencyModal'
import { IconArrowLeft, IconFlag, IconLayout, IconList, IconLink, IconPlus, IconUser } from '../components/icons'
import { filterTasksByStatus, buildGroupOrder, type TaskFilterMode } from '../lib/taskTree'
import { CHANGE_IMPACT_EVENT, clearChangeImpact, readChangeImpact, toHighlight, type StoredChangeImpact } from '../lib/changeImpact'
import { othersOf, usePresence } from '../lib/presence'
import { Skeleton, SkeletonText } from '../components/Skeleton'

export function Schedule() {
  useAuth()
  const can = useCan()
  const { id } = useParams()
  const projectId = Number(id)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [deps, setDeps] = useState<Dependency[]>([])
  const [users, setUsers] = useState<{ user_id: number; user_name?: string }[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showDeps, setShowDeps] = useState(false)
  const [view, setView] = useState<'gantt' | 'table'>(
    searchParams.get('view') === 'table' ? 'table' : 'gantt',
  )
  const userFilter = searchParams.get('user') ? Number(searchParams.get('user')) : null
  const f = searchParams.get('filter')
  const listFilter: 'delayed' | 'unresolved' | undefined = f === 'delayed' || f === 'unresolved' ? f : undefined
  const s = searchParams.get('s')
  const statusOnly: TaskFilterMode = s === 'in_progress' || s === 'remaining' ? s : 'all'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const switchView = (v: 'gantt' | 'table') => {
    setView(v)
    const next = new URLSearchParams(searchParams)
    next.set('view', v)
    setSearchParams(next, { replace: true })
  }

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('filter')
    next.set('view', 'gantt')
    setSearchParams(next, { replace: true })
  }

  const setStatusOnly = (v: TaskFilterMode) => {
    const next = new URLSearchParams(searchParams)
    if (v === 'all') next.delete('s')
    else next.set('s', v)
    setSearchParams(next, { replace: true })
  }

  const filterInfo: { key: string; label: string } | null =
    listFilter === 'delayed'
      ? { key: 'filter', label: '지연 Task' }
      : listFilter === 'unresolved'
        ? { key: 'filter', label: '미해결 Issue' }
        : null

  const load = () => {
    setLoading(true)
    Promise.all([
      http.get<Project>(`/projects/${projectId}`),
      http.get<Task[]>(`/tasks?project_id=${projectId}&include_children=true`),
      http.get<Dependency[]>(`/dependencies/project/${projectId}`),
      http.get<{ user_id: number; user_name?: string }[]>(`/projects/${projectId}/members`),
      http.get<Group[]>(`/groups/project/${projectId}`),
    ])
      .then(([p, t, dep, members, grps]) => {
        setProject(p)
        setTasks(t)
        setDeps(dep)
        setUsers(members)
        setGroups(grps)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  // 마지막 일정 변경의 영향 — 간트/테이블에서 변경·영향 마커로 이어서 보여준다.
  const [changeImpact, setChangeImpact] = useState<StoredChangeImpact | null>(null)
  useEffect(() => {
    const refresh = () => setChangeImpact(readChangeImpact(projectId))
    refresh()
    window.addEventListener(CHANGE_IMPACT_EVENT, refresh)
    return () => window.removeEventListener(CHANGE_IMPACT_EVENT, refresh)
  }, [projectId])

  const highlight = toHighlight(changeImpact)

  // 편집 중 표시 — 이 프로젝트를 보고 있는 다른 사용자(5초 폴링, 15초 하트비트).
  const presence = usePresence(projectId, { enabled: !loading })
  const others = othersOf(presence)

  // 태스크별 편집자 — 간트/테이블 행에 "편집 중" 표시를 붙인다.
  const editingByTask = useMemo(() => {
    const map: Record<number, string[]> = {}
    for (const p of others) {
      if (p.task_id == null) continue
      ;(map[p.task_id] ||= []).push(p.user_name || `#${p.user_id}`)
    }
    return map
  }, [others])

  // 새로 들어온 편집자를 놓치지 않도록 잠깐 토스트로 알린다(첫 로딩은 조용히).
  const knownIds = useRef<Set<number> | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const [newcomer, setNewcomer] = useState<string | null>(null)
  useEffect(() => {
    const active = presence.filter((p) => !p.is_self)
    const ids = new Set(active.map((p) => p.user_id))
    if (knownIds.current === null) {
      knownIds.current = ids
      return
    }
    const added = active.filter((p) => !knownIds.current!.has(p.user_id))
    knownIds.current = ids
    if (added.length === 0) return
    setNewcomer(`${added.map((p) => p.user_name || `#${p.user_id}`).join(', ')} 님이 편집을 시작했습니다`)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setNewcomer(null), 4500)
  }, [presence])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const groupOrder = tasks.length ? buildGroupOrder(groups, tasks) : []

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <SkeletonText w="w-24" />
            <SkeletonText w="w-64" className="h-7" />
          </div>
          <SkeletonText w="w-40" className="h-10" />
        </div>
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between">
            <SkeletonText w="w-32" />
            <SkeletonText w="w-48" />
          </div>
          <div className="flex">
            <div className="w-[340px] border-r border-slate-100">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-9 m-1.5" />
              ))}
            </div>
            <div className="flex-1 p-4">
              <Skeleton className="h-full min-h-[300px]" />
            </div>
          </div>
        </div>
      </div>
    )
  }
  if (error) return <div className="card p-6 text-red-600">{error}</div>
  if (!project) return null

  const filteredUser = users.find((u) => u.user_id === userFilter)
  const clearUser = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('user')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <Link
            to={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-ink-700 transition-colors"
          >
            <IconArrowLeft size={14} />
            현황판으로
          </Link>
          <h1 className="text-xl font-bold text-ink-900 mt-1 flex items-center gap-3">
            {project.name}
            <span className="badge bg-brand-50 text-brand-600 ring-1 ring-brand-200">전체 일정</span>
          </h1>
        </div>

        {/* 컨트롤 툴바 */}
        <div className="flex flex-wrap items-center gap-2">
          {filterInfo && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 ring-1 ring-amber-200 text-[13px]">
              <IconFlag size={14} />
              {filterInfo.label}만 표시
              <button onClick={clearFilter} className="text-amber-600 hover:text-amber-900 font-bold" title="필터 해제">
                ×
              </button>
            </span>
          )}
          {filteredUser && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-200 text-[13px]">
              <IconUser size={14} />
              {filteredUser.user_name || `#${filteredUser.user_id}`} 담당 Task
              <button onClick={clearUser} className="text-brand-500 hover:text-brand-800 font-bold" title="필터 해제">
                ×
              </button>
            </span>
          )}
          {can('task.create') && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <IconPlus size={15} />
              태스크 추가
            </button>
          )}
          {view === 'gantt' && can('dependency.manage') && (
            <button onClick={() => setShowDeps(true)} className="btn-secondary">
              <IconLink size={15} />
              의존성 관리
            </button>
          )}
          <div className="flex p-1 h-9 rounded-xl bg-surface-100 ring-1 ring-slate-200" title="상태 필터">
            {(
              [
                ['all', '전체'],
                ['in_progress', '진행중'],
                ['remaining', '남은 항목'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setStatusOnly(k)}
                className={`flex items-center gap-2 px-3.5 h-full rounded-lg text-sm font-medium transition-all ${
                  statusOnly === k
                    ? 'bg-card text-ink-900 shadow-card'
                    : 'text-slate-500 hover:text-ink-700'
                }`}
              >
                {label}
                {k !== 'all' && (
                  <span className="badge bg-surface-100 text-slate-500 ring-1 ring-slate-200">
                    {tasks.filter((t) => (k === 'in_progress' ? t.status === 'in_progress' : t.status !== 'completed')).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex p-1 h-9 rounded-xl bg-surface-100 ring-1 ring-slate-200">
            <button
              onClick={() => switchView('gantt')}
              className={`flex items-center gap-2 px-4 h-full rounded-lg text-sm font-medium transition-all ${
                view === 'gantt'
                  ? 'bg-card text-ink-900 shadow-card'
                  : 'text-slate-500 hover:text-ink-700'
              }`}
            >
              <IconLayout size={15} />
              간트
            </button>
            <button
              onClick={() => switchView('table')}
              className={`flex items-center gap-2 px-4 h-full rounded-lg text-sm font-medium transition-all ${
                view === 'table'
                  ? 'bg-card text-ink-900 shadow-card'
                  : 'text-slate-500 hover:text-ink-700'
              }`}
            >
              <IconList size={15} />
              테이블
            </button>
          </div>
        </div>
      </div>

      {/* 최근 변경 영향 배너 (우선순위 ① → ② 마커와 이어짐) */}
      {changeImpact && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-amber-50 ring-1 ring-amber-200 px-4 py-3 text-[13px] text-amber-900">
          <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-semibold">최근 일정 변경 영향</span>
            <span className="text-xs text-amber-700">
              Task #{changeImpact.taskId} · {new Date(changeImpact.at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="tabular-nums">
              예측 완료 {changeImpact.impact.forecast_before?.slice(5) ?? '-'} → {changeImpact.impact.forecast_after?.slice(5) ?? '-'}
              {changeImpact.impact.forecast_delta_days !== 0 &&
                ` (${changeImpact.impact.forecast_delta_days > 0 ? '+' : ''}${changeImpact.impact.forecast_delta_days}일)`}
            </span>
            <span className="text-amber-700">
              영향 태스크 {changeImpact.impact.affected_task_ids.length}건
              {changeImpact.impact.newly_delayed_task_ids.length > 0 && ` · 신규 지연 ${changeImpact.impact.newly_delayed_task_ids.length}건`}
            </span>
            <span className="text-xs text-amber-700/80">아래 줄의 변경·영향 마커가 이 영향입니다</span>
          </div>
          <button
            onClick={() => {
              clearChangeImpact(projectId)
              setChangeImpact(null)
            }}
            className="shrink-0 text-xs font-semibold text-amber-600 hover:text-amber-900"
          >
            지우기
          </button>
        </div>
      )}

      {/* 편집 중 표시 (presence) — 눈에 띄게 상단 배너로 */}
      <PresenceBar entries={others} projectId={projectId} />

      {view === 'gantt' ? (
        <Gantt
          tasks={filterTasksByStatus(tasks, statusOnly)}
          dependencies={deps}
          groups={groups}
          groupOrder={groupOrder}
          onGroupChanged={load}
          onSelect={(tid) => navigate(`/tasks/${tid}`)}
          changeImpact={highlight}
          editingByTask={editingByTask}
        />
      ) : (
        <TaskTable
          tasks={filterTasksByStatus(tasks, statusOnly)}
          groups={groups}
          groupOrder={groupOrder}
          onGroupChanged={load}
          userId={userFilter ?? undefined}
          filter={listFilter}
          onSelect={(tid) => navigate(`/tasks/${tid}`)}
          changeImpact={highlight}
          editingByTask={editingByTask}
        />
      )}

      <TaskFormModal
        open={showAdd}
        projectId={projectId}
        groups={groups}
        members={users}
        tasks={tasks}
        onClose={() => setShowAdd(false)}
        onSaved={load}
      />
      <DependencyModal
        open={showDeps}
        tasks={tasks}
        dependencies={deps}
        onClose={() => setShowDeps(false)}
        onSaved={load}
      />

      {/* 새 편집자 알림 — 하단 우측 토스트 */}
      {newcomer && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-fade-in"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-white/90 animate-pulse" />
          {newcomer}
          <button onClick={() => setNewcomer(null)} className="ml-1 text-white/70 hover:text-white" title="닫기">
            ×
          </button>
        </div>
      )}
    </div>
  )
}