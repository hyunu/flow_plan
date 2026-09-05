import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../api/client'
import type { Project } from '../api/types'
import { useCan } from '../auth/AuthContext'
import { saveJsonFile } from '../components/DesktopChrome'

export function ProjectManage() {
  const can = useCan()
  const canCreate = can('project.create')
  const canDelete = can('project.delete')
  const canEdit = can('project.edit')
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [drop, setDrop] = useState<Project | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    http
      .get<Project[]>('/projects')
      .then(setProjects)
      .catch((e) => setError(e.message))
  }

  useEffect(load, [])

  const backup = async (p: Project) => {
    setError(null)
    try {
      const data = await http.get(`/projects/${p.id}/backup`)
      const filename = `flowplan-${p.name.replace(/[^\w가-힣-]+/g, '_')}-${p.id}.json`
      const saved = await saveJsonFile(filename, JSON.stringify(data, null, 2))
      if (saved.cancelled) return
      setMsg(saved.path ? `${p.name} 백업을 저장했습니다. (${saved.path})` : `${p.name} 백업을 저장했습니다.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '백업 실패')
    }
  }

  const restoreFile = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      const text = await file.text()
      const body = JSON.parse(text) as unknown
      const created = await http.post<Project>('/projects/restore', body)
      setMsg(`${created.name} 을(를) 복원했습니다.`)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '복원 실패')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const remove = async () => {
    if (!drop) return
    setBusy(true)
    setError(null)
    try {
      await http.del(`/projects/${drop.id}`)
      setMsg(`${drop.name} 을(를) 삭제했습니다.`)
      setDrop(null)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setBusy(false)
    }
  }

  if (!canCreate && !canDelete && !canEdit) {
    return (
      <div className="max-w-3xl mx-auto card p-10 text-center text-sm text-slate-400">
        프로젝트를 관리할 권한이 없습니다.
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-ink-900">프로젝트 관리</h1>
        <p className="text-[13px] text-slate-400 mt-1">
          삭제·백업·복원. 복원 시 같은 아이디의 사용자만 다시 연결됩니다.
        </p>
      </div>

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="card p-4 text-sm text-ink-700">{msg}</div>}

      {canCreate && (
        <section className="card p-5 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-ink-800">백업에서 복원</h2>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="text-[13px] text-slate-500"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void restoreFile(f)
            }}
          />
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-ink-800">프로젝트 목록</div>
        {projects.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">프로젝트가 없습니다.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {projects.map((p) => (
              <li key={p.id} className="px-5 py-3.5 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/projects/${p.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                    {p.name}
                  </Link>
                  <div className="text-[12px] text-slate-400 mt-0.5">
                    #{p.id} · {p.status === 'active' ? '활성' : '보관'} · {p.created_at?.slice(0, 10)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canEdit && (
                    <button type="button" className="btn-secondary !py-1.5 !text-[12px]" onClick={() => void backup(p)}>
                      백업
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="btn-ghost !py-1.5 !text-[12px] text-red-600"
                      onClick={() => setDrop(p)}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {drop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={(e) => e.target === e.currentTarget && setDrop(null)}
        >
          <div className="w-full max-w-sm bg-card rounded-2xl shadow-lift ring-1 ring-slate-200 p-6">
            <h3 className="font-semibold text-ink-900">프로젝트 삭제</h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              <b>{drop.name}</b> 을(를) 목록에서 뺍니다. 백업을 받아 두지 않으면 복구하기 어렵습니다.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={() => setDrop(null)}>
                취소
              </button>
              <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={() => void remove()}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
