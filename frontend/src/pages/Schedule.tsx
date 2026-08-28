import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { http } from '../api/client'
import type { Dependency, Group, Project, Task } from '../api/types'
import { Gantt } from '../components/Gantt'
import { TaskTable } from '../components/TaskTable'
import { TaskFormModal } from '../components/TaskFormModal'
import { DependencyModal } from '../components/DependencyModal'
import { IconArrowLeft, IconLayout, IconList, IconLink, IconPlus, IconUser } from '../components/icons'
import { Skeleton, SkeletonText } from '../components/Skeleton'

export function Schedule() {
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const switchView = (v: 'gantt' | 'table') => {
    setView(v)
    const next = new URLSearchParams(searchParams)
    next.set('view', v)
    setSearchParams(next, { replace: true })
  }

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
      <div className="flex items-center justify-between flex-wrap gap-4">
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

        {/* 보기 전환 */}
        <div className="flex items-center gap-3">
          {filteredUser && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-200 text-[13px]">
              <IconUser size={14} />
              {filteredUser.user_name || `#${filteredUser.user_id}`} 담당 Task
              <button onClick={clearUser} className="text-brand-500 hover:text-brand-800 font-bold" title="필터 해제">
                ×
              </button>
            </span>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <IconPlus size={15} />
            태스크 추가
          </button>
          {view === 'gantt' && (
            <button onClick={() => setShowDeps(true)} className="btn-secondary">
              <IconLink size={15} />
              의존성 관리
            </button>
          )}
          <div className="flex p-1 rounded-xl bg-surface-100 ring-1 ring-slate-200">
            <button
              onClick={() => switchView('gantt')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'gantt'
                  ? 'bg-white text-ink-900 shadow-card'
                  : 'text-slate-500 hover:text-ink-700'
              }`}
            >
              <IconLayout size={15} />
              간트
            </button>
            <button
              onClick={() => switchView('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'table'
                  ? 'bg-white text-ink-900 shadow-card'
                  : 'text-slate-500 hover:text-ink-700'
              }`}
            >
              <IconList size={15} />
              테이블
            </button>
          </div>
        </div>
      </div>

      {view === 'gantt' ? (
        <Gantt tasks={tasks} dependencies={deps} onSelect={(tid) => navigate(`/tasks/${tid}`)} />
      ) : (
        <TaskTable tasks={tasks} userId={userFilter ?? undefined} onSelect={(tid) => navigate(`/tasks/${tid}`)} />
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
    </div>
  )
}