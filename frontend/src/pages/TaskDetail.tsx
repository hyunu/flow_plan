import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { http } from '../api/client'
import type { Group, ProgressUpdate, ScheduleChange, Task } from '../api/types'
import { useCan } from '../auth/AuthContext'
import { TaskFormModal } from '../components/TaskFormModal'
import { IconArrowLeft, IconClock, IconFlag, IconHistory, IconLink, IconUser } from '../components/icons'
import { Badge, ProgressBar, StatusBadge } from '../components/ui'
import { SkeletonCard, SkeletonRow, SkeletonText } from '../components/Skeleton'

const MetaItem = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    <div className="text-[13px] font-medium text-ink-900 mt-0.5 truncate" title={value}>
      {value}
    </div>
  </div>
)

export function TaskDetail() {
  const { id } = useParams()
  const taskId = Number(id)
  const navigate = useNavigate()
  const can = useCan()
  const canEditSchedule = can('task.edit_schedule')
  const canUpdateProgress = can('task.update_progress')

  const [task, setTask] = useState<Task | null>(null)
  const [updates, setUpdates] = useState<ProgressUpdate[]>([])
  const [history, setHistory] = useState<ScheduleChange[]>([])
  const [children, setChildren] = useState<Task[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'progress' | 'history'>('progress')

  const [progress, setProgress] = useState(0)
  const [adj, setAdj] = useState(0)
  const [pu, setPu] = useState({ work_done: '', current_status: '', problems: '', delay_cause: '', delay_cause_category: '', recovery_plan: '', next_plan: '', expected_delay_days: 0 })
  const [assignUser, setAssignUser] = useState<number>(0)
  const [assignHours, setAssignHours] = useState(0)
  const [users, setUsers] = useState<{ id: number; name: string }[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<{ user_id: number; user_name?: string }[]>([])
  const [showAddChild, setShowAddChild] = useState(false)
  const [edit, setEdit] = useState({ plan_start: '', plan_end: '', workload: 0, status: 'not_started', actual_start: '', actual_end: '', reason: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editMsg, setEditMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const t = await http.get<Task>(`/tasks/${taskId}`)
      setTask(t)
      setProgress(t.effective_progress)
      setAdj(t.user_adjustment)
      setEdit({
        plan_start: t.plan_start?.slice(0, 10) || '',
        plan_end: t.plan_end?.slice(0, 10) || '',
        workload: t.workload || 0,
        status: t.status || 'not_started',
        actual_start: t.actual_start?.slice(0, 10) || '',
        actual_end: t.actual_end?.slice(0, 10) || '',
        reason: '',
      })
      setError(null)
      const [up, hist, kids] = await Promise.all([
        http.get<ProgressUpdate[]>(`/tasks/${taskId}/progress`),
        http.get<ScheduleChange[]>(`/tasks/${taskId}/history`),
        http.get<Task[]>(`/tasks?project_id=${t.project_id}&parent_id=${t.id}`),
      ])
      setUpdates(up)
      setHistory(hist)
      setChildren(kids)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    }
  }, [taskId])

  useEffect(() => {
    load()
    if (!task) return
    http
      .get<{ user_id: number; user_name?: string }[]>(`/projects/${task.project_id}/members`)
      .then((members) => {
        setMembers(members)
        setUsers(members.map((m) => ({ id: m.user_id, name: m.user_name || `#${m.user_id}` })))
      })
      .catch(() => {})
    http
      .get<Group[]>(`/groups/project/${task.project_id}`)
      .then(setGroups)
      .catch(() => {})
  }, [load, taskId, task?.project_id])

  const saveProgress = async () => {
    if (!task) return
    try {
      await http.put(`/tasks/${task.id}`, { effective_progress: progress, user_adjustment: adj, change_reason: '진척률 보정' })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const addProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task) return
    try {
      await http.post(`/tasks/${task.id}/progress`, pu)
      setPu({ work_done: '', current_status: '', problems: '', delay_cause: '', delay_cause_category: '', recovery_plan: '', next_plan: '', expected_delay_days: 0 })
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const addAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task || !assignUser) return
    try {
      await http.post(`/tasks/${task.id}/assignments`, { user_id: assignUser, workload_hours: assignHours })
      setAssignUser(0)
      setAssignHours(0)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!task) return
    setSavingEdit(true)
    setEditMsg(null)
    try {
      await http.put(`/tasks/${task.id}`, {
        plan_start: edit.plan_start || null,
        plan_end: edit.plan_end || null,
        workload: edit.workload,
        status: edit.status,
        actual_start: edit.actual_start || null,
        actual_end: edit.actual_end || null,
        change_reason: edit.reason || null,
      })
      setEdit((v) => ({ ...v, reason: '' }))
      setEditMsg('저장되었습니다.')
      load()
    } catch (e) {
      setEditMsg(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSavingEdit(false)
    }
  }

  if (!task) {
    return (
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="space-y-2">
          <SkeletonText w="w-24" />
          <SkeletonText w="w-80" className="h-7" />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="card p-6 space-y-3">
            <SkeletonText w="w-28" />
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
          <div className="card p-6 space-y-3">
            <SkeletonText w="w-28" />
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </div>
        <SkeletonCard className="h-40" />
      </div>
    )
  }

  const delay = task.delay_days && task.delay_days > 0

  const scheduleRows = [
    { label: 'Baseline', start: task.baseline_start, end: task.baseline_end, w: task.baseline_workload, note: '변경 불가', dot: 'bg-slate-300' },
    { label: 'Current Plan', start: task.plan_start, end: task.plan_end, w: task.workload, note: '', dot: 'bg-brand-500' },
    { label: 'Actual', start: task.actual_start, end: task.actual_end, w: undefined, note: '', dot: 'bg-emerald-500' },
    { label: 'Forecast', start: task.plan_start, end: task.forecast_finish || task.plan_end, w: undefined, note: '예상', dot: 'bg-amber-400' },
  ]

  const progressValues = [
    { label: 'Schedule', v: task.schedule_progress, sub: '일정 기준 자동' },
    { label: 'Work', v: task.work_progress, sub: '작업량 기준' },
    { label: 'User Adj', v: task.user_adjustment, sub: '사용자 보정' },
    { label: 'Effective', v: task.effective_progress, sub: '최종' },
  ]

  const assigneeNames = task.assignments.map((a) => a.user_name).filter(Boolean).join(', ')

  // 담당자는 마지막 한 명까지 삭제 가능하되, 마지막 남은 담당자는 삭제 불가
  const deleteAssignment = async (a: { user_id: number; user_name?: string }) => {
    if (!task || task.assignments.length <= 1) return
    try {
      await http.del(`/tasks/${task.id}/assignments/${a.user_id}`)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '담당자 삭제 실패')
    }
  }

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(`/projects/${task.project_id}`)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {/* 헤더 요약 카드 */}
      <div className="card overflow-hidden">
        <div className="px-6 py-5">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-ink-700 transition-colors"
          >
            <IconArrowLeft size={14} /> 뒤로가기
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
                {task.is_issue && <span className="text-amber-500">⚠️</span>}
                {task.title}
              </h1>
              <StatusBadge status={task.status} />
              {task.is_critical && <Badge tone="red">Critical Path</Badge>}
              {delay ? <Badge tone="red">지연 {task.delay_days}일</Badge> : <Badge tone="green">정상 진행</Badge>}
              <span className="text-xs text-slate-300">#{task.id}</span>
            </div>
            {(canEditSchedule || canUpdateProgress) && (
              <a href="#edit" className="btn-primary !py-2">일정·상태 편집</a>
            )}
          </div>
          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetaItem label="그룹" value={task.group_name || '-'} />
            <MetaItem label="담당자" value={assigneeNames || '없음'} />
            <MetaItem
              label="계획 기간"
              value={task.plan_start && task.plan_end ? `${task.plan_start.slice(5)} ~ ${task.plan_end.slice(5)}` : '-'}
            />
            <MetaItem label="작업량" value={`${task.workload ? Math.round(task.workload) : 0}h`} />
            <MetaItem label="예상 완료" value={task.forecast_finish?.slice(0, 10) || task.plan_end?.slice(0, 10) || '-'} />
          </div>
        </div>
      </div>

      {/* 진척률 스탯 스트립 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {progressValues.map(({ label, v, sub }) => (
          <div key={label} className="card px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
              <span className="text-lg font-bold text-ink-900 tabular-nums leading-none">{Math.round(v)}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${label === 'Effective' ? 'bg-ink-900' : label === 'Schedule' ? 'bg-brand-500' : 'bg-slate-400'}`}
                style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* 메인 그리드 */}
      <div className="grid xl:grid-cols-3 gap-6 items-start">
        {/* 좌측: 일정/편집/진척/기록 */}
        <div className="xl:col-span-2 space-y-6 min-w-0">
          <div className="grid lg:grid-cols-2 gap-6 items-stretch">
            {/* 일정 비교 */}
            <div className="card px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <IconClock size={14} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-ink-900">일정 비교</h3>
              </div>
              <div>
                {scheduleRows.map((r) => (
                  <div key={r.label} className="flex items-center gap-2.5 py-1.5 px-1 rounded-md hover:bg-surface-50 transition-colors">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                    <span className="text-[13px] text-slate-500 w-[7.5rem] shrink-0">{r.label}</span>
                    <span className="text-[13px] font-medium text-ink-900 w-[7.5rem] shrink-0 tabular-nums">
                      {r.start ? `${r.start.slice(5)} ~ ${r.end?.slice(5) ?? '-'}` : '—'}
                    </span>
                    <span className="text-[13px] text-slate-500 w-10 shrink-0 tabular-nums">
                      {r.w != null ? `${Math.round(r.w)}h` : ''}
                    </span>
                    {r.note ? <span className="text-[11px] text-slate-400">{r.note}</span> : null}
                  </div>
                ))}
              </div>
            </div>

            {/* 일정·상태 편집 */}
            {(canEditSchedule || canUpdateProgress) ? (
              <div id="edit" className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <IconClock size={15} className="text-slate-400" />
                  <h3 className="text-sm font-semibold text-ink-900">일정·상태 편집</h3>
                  <span className="text-[11px] text-slate-400">변경 이력에 기록됩니다</span>
                </div>
                <form onSubmit={saveEdit} className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="label">계획 시작일</label>
                    <input type="date" className="input" value={edit.plan_start} disabled={!canEditSchedule} onChange={(e) => setEdit({ ...edit, plan_start: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">계획 종료일</label>
                    <input type="date" className="input" value={edit.plan_end} disabled={!canEditSchedule} onChange={(e) => setEdit({ ...edit, plan_end: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">실제 시작일</label>
                    <input type="date" className="input" value={edit.actual_start} disabled={!canUpdateProgress} onChange={(e) => setEdit({ ...edit, actual_start: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">실제 종료일</label>
                    <input type="date" className="input" value={edit.actual_end} disabled={!canUpdateProgress} onChange={(e) => setEdit({ ...edit, actual_end: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">작업량 (h)</label>
                    <input type="number" min={0} className="input" value={edit.workload || ''} disabled={!canUpdateProgress} onChange={(e) => setEdit({ ...edit, workload: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label">상태</label>
                    <select className="input" value={edit.status} disabled={!canUpdateProgress} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                      {['not_started', 'in_progress', 'delayed', 'blocked', 'completed'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">변경 사유</label>
                    <input className="input" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="예: 요구사항 변경으로 일정 연장" />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <button type="submit" className="btn-primary" disabled={savingEdit}>{savingEdit ? '저장 중...' : '저장'}</button>
                    {editMsg && <span className={`text-xs ${editMsg === '저장되었습니다.' ? 'text-emerald-600' : 'text-red-600'}`}>{editMsg}</span>}
                  </div>
                </form>
              </div>
            ) : null}
          </div>

          {/* 진척률 보정 */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconFlag size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-ink-900">진척률 보정</h3>
              </div>
              <span className="text-lg font-bold text-ink-900 tabular-nums">{Math.round(task.effective_progress)}%</span>
            </div>
            <ProgressBar value={task.effective_progress} />
            <div className="mt-4 flex items-end gap-3 flex-wrap">
              <div className="w-36">
                <label className="label">진척률 보정</label>
                <input type="number" className="input" value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
              </div>
              <div className="w-36">
                <label className="label">User Adjustment</label>
                <input type="number" className="input" value={adj} onChange={(e) => setAdj(Number(e.target.value))} />
              </div>
              {canUpdateProgress && (
                <button className="btn-primary" onClick={saveProgress}>
                  저장
                </button>
              )}
            </div>
          </div>

          {/* 탭: 진행 기록 / 변경 이력 */}
          <div className="flex gap-1 border-b border-slate-200">
            {([
              ['progress', `진행 기록 (${updates.length})`, IconClock],
              ['history', `변경 이력 (${history.length})`, IconHistory],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {tab === 'progress' && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-ink-900 mb-4">진행 기록 입력</h3>
                {canUpdateProgress ? (
                <form onSubmit={addProgress} className="space-y-3">
                  <div>
                    <label className="label">수행 내용</label>
                    <input className="input" value={pu.work_done} onChange={(e) => setPu({ ...pu, work_done: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">현재 상황</label>
                      <input className="input" value={pu.current_status} onChange={(e) => setPu({ ...pu, current_status: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">문제점</label>
                      <input className="input" value={pu.problems} onChange={(e) => setPu({ ...pu, problems: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">지연 원인 카테고리</label>
                    <select className="input" value={pu.delay_cause_category} onChange={(e) => setPu({ ...pu, delay_cause_category: e.target.value })}>
                      <option value="">선택</option>
                      {['요구사항 변경', '설계 변경', '기술 문제', 'Issue 발생', '선행 Task 지연', '외부 업체 지연', '인력 부족', '사용자 휴가/부재', '작업량 증가', '환경 문제', '기타'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">지연 원인</label>
                    <input className="input" value={pu.delay_cause} onChange={(e) => setPu({ ...pu, delay_cause: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">대응/대책</label>
                      <input className="input" value={pu.recovery_plan} onChange={(e) => setPu({ ...pu, recovery_plan: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">예상 추가 일수</label>
                      <input type="number" className="input" value={pu.expected_delay_days || ''} onChange={(e) => setPu({ ...pu, expected_delay_days: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">다음 계획</label>
                    <input className="input" value={pu.next_plan} onChange={(e) => setPu({ ...pu, next_plan: e.target.value })} />
                  </div>
                  <button className="btn-primary w-full justify-center">저장</button>
                </form>
                ) : null}
              </div>

              <div className="space-y-3">
                {updates.length === 0 ? (
                  <div className="card p-10 text-center text-sm text-slate-400">아직 진행 기록이 없습니다</div>
                ) : (
                  updates.map((u) => (
                    <div key={u.id} className="card p-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span className="font-medium text-slate-500">{u.author_name}</span>
                        <span>{u.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      {u.current_status && <div className="text-sm text-ink-700 mt-1">📌 {u.current_status}</div>}
                      {u.work_done && <div className="text-sm text-slate-600 mt-1">✅ {u.work_done}</div>}
                      {u.problems && <div className="text-sm text-slate-600 mt-1">⚠️ {u.problems}</div>}
                      {u.delay_cause && (
                        <div className="mt-2 text-xs">
                          <span className="badge bg-red-50 text-red-500 ring-1 ring-red-200">{u.delay_cause_category || '지연'}</span>
                          <span className="ml-2 text-slate-600">{u.delay_cause}</span>
                        </div>
                      )}
                      {u.recovery_plan && (
                        <div className="text-xs text-slate-600 mt-1">
                          대책: {u.recovery_plan}
                          {u.expected_delay_days != null && ` (${u.expected_delay_days}일)`}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-ink-900">일정 변경 이력</h3>
              </div>
              {history.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-400">변경 이력 없음</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-50">
                      <tr className="border-b border-slate-200">
                        <th className="th">변경일</th>
                        <th className="th">변경자</th>
                        <th className="th">종료일 변경</th>
                        <th className="th">작업량 변경</th>
                        <th className="th">사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((c) => (
                        <tr key={c.id}>
                          <td className="td whitespace-nowrap text-xs text-slate-500">{c.changed_at?.slice(0, 16).replace('T', ' ')}</td>
                          <td className="td">{c.changed_by_name}</td>
                          <td className="td">
                            <span className="text-slate-400">{c.before_end?.slice(5) ?? '-'}</span>
                            <span className="mx-1.5 text-slate-300">→</span>
                            <span className="font-medium">{c.after_end?.slice(5) ?? '-'}</span>
                          </td>
                          <td className="td">
                            {c.before_workload != null ? `${c.before_workload}h` : '-'} → {c.after_workload != null ? `${c.after_workload}h` : '-'}
                          </td>
                          <td className="td text-xs text-slate-500">{c.reason || c.user_opinion || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 우측: 담당자 / 하위 Task */}
        <div className="xl:col-span-1 space-y-6 min-w-0">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <IconUser size={15} className="text-slate-400" />
              <h3 className="text-sm font-semibold text-ink-900">담당자</h3>
            </div>
            {task.assignments.length === 0 ? (
              <div className="text-sm text-slate-400 py-2">담당자 없음</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {task.assignments.map((a) => (
                  <span key={a.id} className="group/assign relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-50 ring-1 ring-slate-200 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 grid place-items-center text-[10px] font-bold">
                      {(a.user_name || '?').slice(0, 1)}
                    </span>
                    {a.user_name || `#${a.user_id}`}
                    <span className="text-xs text-slate-400">{a.workload_hours}h</span>
                    {can('task.assign') && task.assignments.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteAssignment(a)
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white grid place-items-center shadow opacity-0 group-hover/assign:opacity-100 transition-opacity hover:bg-red-600"
                        title="담당자 삭제"
                        aria-label={`${a.user_name || a.user_id} 담당자 삭제`}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            {can('task.assign') ? (
            <form onSubmit={addAssignment} className="mt-4 flex gap-2">
              <select className="input flex-1" value={assignUser} onChange={(e) => setAssignUser(Number(e.target.value))}>
                <option value={0}>사용자 선택</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <input type="number" className="input w-20" placeholder="h" value={assignHours || ''} onChange={(e) => setAssignHours(Number(e.target.value))} />
              <button className="btn-secondary">추가</button>
            </form>
            ) : null}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <IconLink size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-ink-900">하위 Task</h3>
              </div>
              {can('task.create') && (
              <button onClick={() => setShowAddChild(true)} className="btn-secondary !py-1.5 !px-3 text-xs">
                + 하위 Task 추가
              </button>
              )}
            </div>
            {(task.children || children).length === 0 ? (
              <div className="text-sm text-slate-400 py-2">하위 Task 없음</div>
            ) : (
              <div className="space-y-1">
                {(task.children || children).map((c) => (
                  <button key={c.id} onClick={() => navigate(`/tasks/${c.id}`)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-surface-50 transition-colors">
                    <span className="text-[13px] text-ink-700 flex items-center gap-2">
                      {c.is_issue && <span className="text-amber-500">⚠️</span>}
                      {c.title}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{Math.round(c.effective_progress)}%</span>
                  </button>
                ))}
              </div>
            )}
            {task.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="label">설명</div>
                <div className="text-sm text-slate-600 whitespace-pre-wrap">{task.description}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskFormModal
        open={showAddChild}
        projectId={task.project_id}
        groups={groups}
        members={members}
        defaultParentId={task.id}
        onClose={() => setShowAddChild(false)}
        onSaved={load}
      />
    </div>
  )
}