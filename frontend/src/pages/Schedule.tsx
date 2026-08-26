import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../api/client'
import type { Dependency, Project, Task } from '../api/types'
import { Gantt } from '../components/Gantt'
import { TaskTable } from '../components/TaskTable'
import { IconArrowLeft, IconLayout, IconList } from '../components/icons'

export function Schedule() {
  const { id } = useParams()
  const projectId = Number(id)
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [deps, setDeps] = useState<Dependency[]>([])
  const [view, setView] = useState<'gantt' | 'table'>('gantt')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      http.get<Project>(`/projects/${projectId}`),
      http.get<Task[]>(`/tasks?project_id=${projectId}&include_children=true`),
      http.get<Dependency[]>(`/dependencies/project/${projectId}`),
    ])
      .then(([p, t, dep]) => {
        setProject(p)
        setTasks(t)
        setDeps(dep)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  if (loading) return <div className="text-slate-400 py-10">불러오는 중...</div>
  if (error) return <div className="card p-6 text-red-600">{error}</div>
  if (!project) return null

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
        <div className="flex p-1 rounded-xl bg-surface-100 ring-1 ring-slate-200">
          <button
            onClick={() => setView('gantt')}
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
            onClick={() => setView('table')}
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

      {view === 'gantt' ? (
        <Gantt tasks={tasks} dependencies={deps} onSelect={(tid) => navigate(`/tasks/${tid}`)} />
      ) : (
        <TaskTable tasks={tasks} onSelect={(tid) => navigate(`/tasks/${tid}`)} />
      )}
    </div>
  )
}