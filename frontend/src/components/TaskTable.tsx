import { useMemo, useState } from 'react'
import type { Task } from '../api/types'
import { TreeToggle, buildTaskTree } from '../lib/taskTree'
import { IconList, IconSearch } from './icons'
import { ProgressBar, StatusBadge } from './ui'

interface Props {
  tasks: Task[]
  onSelect: (taskId: number) => void
}

const statusOrder: Record<string, number> = {
  delayed: 0,
  in_progress: 1,
  blocked: 2,
  not_started: 3,
  completed: 4,
}

export function TaskTable({ tasks, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const { rows, hasChildren } = useMemo(() => buildTaskTree(tasks, collapsed), [tasks, collapsed])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter(({ task }) => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false
        if (q && !task.title.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => (statusOrder[a.task.status] ?? 9) - (statusOrder[b.task.status] ?? 9))
  }, [rows, query, statusFilter])

  const statuses = ['all', 'not_started', 'in_progress', 'delayed', 'blocked', 'completed']

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500">
          <IconList size={16} />
          <h2 className="font-semibold text-ink-900">Task 목록</h2>
          <span className="badge bg-surface-100 text-slate-500 ring-1 ring-slate-200">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-56"
              placeholder="Task 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? '전체 상태' : s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface-50">
            <tr className="border-b border-slate-200">
              <th className="th w-[380px]">Task</th>
              <th className="th">상태</th>
              <th className="th">담당자</th>
              <th className="th">계획 일정</th>
              <th className="th text-right">작업량</th>
              <th className="th w-44">진척률</th>
              <th className="th text-center">지연</th>
              <th className="th">특이</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(({ task, depth }) => (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className="cursor-pointer hover:bg-surface-50 transition-colors"
              >
                <td className="td">
                  <div className="flex items-center gap-1.5 min-w-[280px]">
                    <span className="text-[10px] text-slate-300 w-5 shrink-0">{task.is_issue ? '⚠' : ''}</span>
                    <TreeToggle
                      taskId={task.id}
                      hasChildren={hasChildren.has(task.id)}
                      collapsed={collapsed.has(task.id)}
                      onToggle={toggle}
                    />
                    <span className="font-medium text-ink-700 truncate" style={{ paddingLeft: depth * 16 }}>
                      {task.title}
                    </span>
                    {task.is_critical && <span className="badge bg-red-50 text-red-500 ring-1 ring-red-200">CP</span>}
                  </div>
                </td>
                <td className="td">
                  <StatusBadge status={task.status} />
                </td>
                <td className="td">
                  {task.assignments.length === 0 ? (
                    <span className="text-slate-300">—</span>
                  ) : (
                    <span className="text-xs text-ink-500">
                      {task.assignments.map((a) => a.user_name || `#${a.user_id}`).join(', ')}
                    </span>
                  )}
                </td>
                <td className="td whitespace-nowrap text-xs text-ink-500">
                  {task.plan_start ? (
                    <>
                      <span className="font-medium text-ink-700">{task.plan_start.slice(5)}</span>
                      <span className="text-slate-300 mx-1">~</span>
                      <span>{task.plan_end?.slice(5) ?? '-'}</span>
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="td text-right font-medium text-ink-700">{Math.round(task.workload)}h</td>
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <ProgressBar value={task.effective_progress} className="flex-1" />
                    <span className="text-xs font-semibold text-ink-700 w-8 text-right">
                      {Math.round(task.effective_progress)}%
                    </span>
                  </div>
                </td>
                <td className="td text-center">
                  {task.delay_days != null && task.delay_days > 0 ? (
                    <span className="badge bg-red-50 text-red-500 ring-1 ring-red-200">+{task.delay_days}일</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    {task.task_type === 'issue' && (
                      <span className="badge bg-amber-50 text-amber-600 ring-1 ring-amber-200">Issue</span>
                    )}
                    {task.forecast_finish && task.plan_end && task.forecast_finish > task.plan_end && (
                      <span className="badge bg-amber-50 text-amber-600 ring-1 ring-amber-200">예측 연장</span>
                    )}
                    {!task.is_issue && !(task.forecast_finish && task.plan_end && task.forecast_finish > task.plan_end) && (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">조건에 맞는 Task가 없습니다</div>
        )}
      </div>
    </div>
  )
}