import { useEffect, useState } from 'react'
import { http } from '../api/client'
import type { Dependency, Task } from '../api/types'

interface Props {
  open: boolean
  tasks: Task[]
  dependencies: Dependency[]
  onClose: () => void
  onSaved?: () => void
}

const titleOf = (tasks: Task[], id: number) => tasks.find((t) => t.id === id)?.title ?? `#${id}`

export function DependencyModal({ open, tasks, dependencies, onClose, onSaved }: Props) {
  const [successorId, setSuccessorId] = useState<number>(0)
  const [predecessorId, setPredecessorId] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localDeps, setLocalDeps] = useState<Dependency[]>(dependencies)

  useEffect(() => {
    if (open) {
      setSuccessorId(0)
      setPredecessorId(0)
      setError(null)
      setLocalDeps(dependencies)
    }
  }, [open, dependencies])

  const validTasks = tasks

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!successorId || !predecessorId) return setError('선행 Task와 후행 Task를 모두 선택하세요.')
    if (successorId === predecessorId) return setError('자기 자신을 선행으로 지정할 수 없습니다.')
    setSaving(true)
    setError(null)
    try {
      const dep = await http.post<Dependency>('/dependencies', {
        predecessor_id: predecessorId,
        successor_id: successorId,
        dependency_type: 'FS',
        lag_days: 0,
      })
      setLocalDeps((prev) =>
        prev.some((d) => d.id === dep.id) ? prev : [...prev, dep],
      )
      setSuccessorId(0)
      setPredecessorId(0)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await http.del(`/dependencies/${id}`)
      setLocalDeps((prev) => prev.filter((d) => d.id !== id))
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-lift ring-1 ring-slate-200 overflow-hidden animate-fade-in max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900">선행 Task (의존성) 관리</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors" title="닫기">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 추가 폼 */}
          <form onSubmit={submit} className="space-y-3">
            <p className="text-[13px] text-slate-500 leading-relaxed">
              <span className="font-semibold text-ink-700">FS(종료→시작)</span> 순서를 지정합니다. 선행 Task 종료 후 후행 Task가 시작되며,
              크리티컬패스(CP)는 이 의존성으로부터 자동 계산됩니다.
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <div>
                <label className="label">후행 Task</label>
                <select className="input" value={successorId} onChange={(e) => setSuccessorId(Number(e.target.value))}>
                  <option value={0}>선택</option>
                  {validTasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <span className="pb-2 text-sm text-slate-400">선행 →</span>
              <div>
                <label className="label">선행 Task</label>
                <select className="input" value={predecessorId} onChange={(e) => setPredecessorId(Number(e.target.value))}>
                  <option value={0}>선택</option>
                  {validTasks.filter((t) => t.id !== successorId).map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중...' : '연결'}</button>
            </div>
          </form>

          {/* 의존성 목록 */}
          <div>
            <label className="label">등록된 의존성 ({localDeps.length})</label>
            {localDeps.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center bg-surface-50 rounded-xl">등록된 의존성이 없습니다</div>
            ) : (
              <div className="space-y-1.5">
                {localDeps.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-50 ring-1 ring-slate-100 text-sm">
                    <span className="min-w-0 flex-1 flex items-center gap-1.5 text-ink-700">
                      <span className="truncate">{titleOf(tasks, d.predecessor_id)}</span>
                      <span className="text-slate-400 shrink-0">→</span>
                      <span className="truncate">{titleOf(tasks, d.successor_id)}</span>
                    </span>
                    <span className="shrink-0 badge bg-card text-slate-500 ring-1 ring-slate-200">FS</span>
                    <button
                      onClick={() => remove(d.id)}
                      className="shrink-0 w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="의존성 제거"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}