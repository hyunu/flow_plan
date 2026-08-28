import { useEffect, useState } from 'react'
import { http } from '../api/client'
import type { Group, Task } from '../api/types'

interface Props {
  open: boolean
  projectId: number
  groups: Group[]
  members: { user_id: number; user_name?: string }[]
  /** 하위 태스크로 추가할 부모 Task id (TaskDetail에서 사용) */
  defaultParentId?: number | null
  /** 임시: 기존부모 선택 시에도 표시하기 위한 전체 태스크 목록 */
  tasks?: Task[]
  onClose: () => void
  onSaved?: () => void
}

export function TaskFormModal({ open, projectId, groups, members, defaultParentId, tasks = [], onClose, onSaved }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [group_id, setGroupId] = useState<number>(0)
  const [parent_id, setParentId] = useState<number | null>(defaultParentId ?? null)
  const [plan_start, setPlanStart] = useState('')
  const [plan_end, setPlanEnd] = useState('')
  const [workload, setWorkload] = useState(0)
  const [assignee, setAssignee] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setGroupId(groups[0]?.id ?? 0)
      setParentId(defaultParentId ?? null)
      setPlanStart('')
      setPlanEnd('')
      setWorkload(0)
      setAssignee(0)
      setError(null)
    }
  }, [open, defaultParentId, groups])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('제목을 입력하세요.')
    setSaving(true)
    setError(null)
    try {
      const t = await http.post<Task>('/tasks', {
        project_id: projectId,
        group_id: group_id || null,
        parent_id: parent_id || null,
        title: title.trim(),
        description: description || null,
        plan_start: plan_start || null,
        plan_end: plan_end || null,
        workload: workload || 0,
      })
      if (assignee) {
        await http.post(`/tasks/${t.id}/assignments`, { user_id: assignee, workload_hours: workload || 0 })
      }
      onClose()
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const parentOptions = tasks.filter((t) => t.id !== parent_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 backdrop-blur-[2px] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lift ring-1 ring-slate-200 overflow-hidden animate-fade-in max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900">태스크 추가 {parent_id ? '(하위 태스크)' : ''}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors" title="닫기">
            ✕
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="label">제목 *</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="예: 결제 모듈 개발" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">그룹</label>
              <select className="input" value={group_id} onChange={(e) => setGroupId(Number(e.target.value))}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">부모 태스크 (선택)</label>
              <select
                className="input"
                value={parent_id ?? ''}
                onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">없음 (최상위)</option>
                {parentOptions.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">시작일</label>
              <input type="date" className="input" value={plan_start} onChange={(e) => setPlanStart(e.target.value)} />
            </div>
            <div>
              <label className="label">종료일</label>
              <input type="date" className="input" value={plan_end} onChange={(e) => setPlanEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">작업량 (h)</label>
              <input type="number" min={0} className="input" value={workload || ''} onChange={(e) => setWorkload(Number(e.target.value))} placeholder="0" />
            </div>
            <div>
              <label className="label">담당자 (선택)</label>
              <select className="input" value={assignee} onChange={(e) => setAssignee(Number(e.target.value))}>
                <option value={0}>담당자 없음</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.user_name || `#${m.user_id}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">설명</label>
            <textarea className="input min-h-[72px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={onClose}>취소</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중...' : '추가'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}