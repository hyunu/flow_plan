import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/client'
import type { Project } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { IconChevronRight } from '../components/icons'
import { SkeletonCard, SkeletonText } from '../components/Skeleton'

export function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = user?.role_name === 'System Administrator'
  const canCreate = isAdmin || user?.role_name === 'Project Manager'

  const [name, setName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    setLoading(true)
    http
      .get<Project[]>('/projects')
      .then((data) => {
        setProjects(data)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await http.post('/projects', { name })
      setName('')
      setShowForm(false)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">내 프로젝트</h1>
          <p className="text-[13px] text-slate-400 mt-1">
            {isAdmin ? '시스템 관리자 — 전체 프로젝트 조회 가능' : '참여 중인 프로젝트'}
          </p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            + 새 프로젝트
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-5 flex gap-3 items-end animate-fade-in">
          <div className="flex-1">
            <label className="label">프로젝트 이름</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <button className="btn-primary">생성</button>
          <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
            취소
          </button>
        </form>
      )}

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-2">
              <SkeletonText w="w-40" className="h-6" />
              <SkeletonText w="w-56" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} className="h-36" />
            ))}
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-4xl mb-3">📂</div>
          <div className="text-sm text-slate-400">참여한 프로젝트가 없습니다</div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card card-hover p-5 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center text-sm font-bold shrink-0">
                      {p.name?.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-900 truncate">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">#{p.id}</div>
                    </div>
                  </div>
                  <div className="text-[13px] text-slate-500 mt-3 line-clamp-2">
                    {p.description || '설명 없음'}
                  </div>
                </div>
                <span
                  className={`badge ring-1 shrink-0 ${
                    p.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}
                >
                  {p.status === 'active' ? '활성' : '보관'}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">생성 {p.created_at?.slice(0, 10)}</span>
                <span className="flex items-center gap-1 text-[13px] text-brand-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  현황판 <IconChevronRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}