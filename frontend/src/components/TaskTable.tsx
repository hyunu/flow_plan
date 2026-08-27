import { useEffect, useMemo, useState } from 'react'
import type { Task } from '../api/types'
import { TreeConnector, TreeToggle, buildGroupedTaskTree } from '../lib/taskTree'
import { IconList, IconSearch, IconUser } from './icons'
import { ProgressBar, StatusBadge } from './ui'

interface Props {
  tasks: Task[]
  userId?: number
  onSelect: (taskId: number) => void
  onUserChange?: (userId: number | null) => void
}

export function TaskTable({ tasks, userId, onSelect, onUserChange }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [userFilter, setUserFilter] = useState<number | null>(userId ?? null)

  // URL(?user=)과 내부 필터 동기화
  useEffect(() => setUserFilter(userId ?? null), [userId])

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // 담당자 목록(Task 배정 기준) — 정렬은 이름순
  const assignees = useMemo(() => {
    const m = new Map<number, string>()
    for (const t of tasks) {
      for (const a of t.assignments) {
        if (!m.has(a.user_id)) m.set(a.user_id, a.user_name || `#${a.user_id}`)
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'ko'))
  }, [tasks])

  const { rows: allRows, hasChildren, childCounts } = useMemo(() => buildGroupedTaskTree(tasks, collapsed), [tasks, collapsed])

  // 그룹별 Task 수 (접기와 무관하게 원본 기준 — 접힌 그룹도 실제 개수 표시)
  const groupCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of allRows) {
      if (r.kind !== 'group') continue
      const name = r.name
      m.set(r.gid, tasks.filter((t) => (t.group_name || '기타') === name).length)
    }
    return m
  }, [allRows, tasks])

  // 필터: 태스크는 조건, 그룹은 표시된 태스크가 있는 경우만 유지 (DFS 순서 유지)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (t: Task) => {
      if (userFilter != null && !t.assignments.some((a) => a.user_id === userFilter)) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (q) {
        const inTitle = t.title.toLowerCase().includes(q)
        const inAssignee = t.assignments.some((a) => (a.user_name || '').toLowerCase().includes(q))
        if (!inTitle && !inAssignee) return false
      }
      return true
    }
    const visibleGroups = new Set<number>()
    let curGroup: number | null = null
    for (const r of allRows) {
      if (r.kind === 'group') curGroup = r.gid
      else if (match(r.task)) visibleGroups.add(curGroup ?? -1)
    }
    // 접힌 그룹은 행을 유지해야 펼치기 가능 → 강제 포함 (사라지지 않게)
    for (const r of allRows) {
      if (r.kind === 'group' && collapsed.has(r.gid)) visibleGroups.add(r.gid)
    }
    return allRows.filter((r) => {
      if (r.kind === 'group') return visibleGroups.has(r.gid)
      return match(r.task)
    })
  }, [allRows, query, statusFilter, userFilter, collapsed])

  const statuses = ['all', 'not_started', 'in_progress', 'delayed', 'blocked', 'completed']

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500">
          <IconList size={16} />
          <h2 className="font-semibold text-ink-900">Task 목록</h2>
          <span className="badge bg-surface-100 text-slate-500 ring-1 ring-slate-200">{tasks.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 w-56"
              placeholder="제목·담당자 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="relative">
            <IconUser size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              className="input pl-9 w-40"
              value={userFilter ?? ''}
              onChange={(e) => {
                const v = e.target.value
                const id = v ? Number(v) : null
                setUserFilter(id)
                onUserChange?.(id)
              }}
            >
              <option value="">전체 담당자</option>
              {assignees.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
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
            {filtered.map((row) =>
              row.kind === 'group' ? (
                <tr key={`g${row.gid}`} className="bg-surface-50/80 hover:bg-surface-100 transition-colors">
                  <td className="td !py-0">
                    <div className="flex items-center gap-1.5 min-w-[280px] min-h-[48px]">
                      <span className="w-5 shrink-0" />
                      <TreeToggle
                        taskId={row.gid}
                        hasChildren={hasChildren.has(row.gid)}
                        collapsed={collapsed.has(row.gid)}
                        onToggle={toggle}
                      />
                      <TreeConnector guides={row.guides} isLast={row.isLast} extend />
                      <span className="truncate text-[13px] font-bold text-ink-900 uppercase tracking-wide">
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td className="td" colSpan={7}>
                    <span className="text-xs text-slate-400">{groupCount.get(row.gid) || 0}개 Task</span>
                  </td>
                </tr>
              ) : (
                <tr
                  key={row.task.id}
                  onClick={() => onSelect(row.task.id)}
                  className="cursor-pointer hover:bg-surface-50 transition-colors"
                >
                  <td className="td !py-0">
                    <div className="flex items-center gap-1.5 min-w-[280px] min-h-[48px]">
                      <span className="text-[10px] text-slate-300 w-5 shrink-0">{row.task.is_issue ? '⚠' : ''}</span>
                      <TreeToggle
                        taskId={row.task.id}
                        hasChildren={hasChildren.has(row.task.id)}
                        collapsed={collapsed.has(row.task.id)}
                        onToggle={toggle}
                      />
                      <TreeConnector guides={row.guides} isLast={row.isLast} extend />
                      <span
                        className={`truncate ${
                          hasChildren.has(row.task.id)
                            ? 'text-[13px] font-semibold text-ink-900'
                            : 'text-[13px] font-medium text-ink-700'
                        }`}
                      >
                        {row.task.title}
                      </span>
                      {hasChildren.has(row.task.id) && (
                        <span className="shrink-0 text-[10px] text-slate-400">({childCounts.get(row.task.id)})</span>
                      )}
                      {row.task.is_critical && <span className="badge bg-red-50 text-red-500 ring-1 ring-red-200">CP</span>}
                    </div>
                  </td>
                <td className="td">
                    <StatusBadge status={row.task.status} />
                  </td>
                  <td className="td">
                    {row.task.assignments.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="text-xs text-ink-500">
                        {row.task.assignments.map((a) => a.user_name || `#${a.user_id}`).join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="td whitespace-nowrap text-xs text-ink-500">
                    {row.task.plan_start ? (
                      <>
                        <span className="font-medium text-ink-700">{row.task.plan_start.slice(5)}</span>
                        <span className="text-slate-300 mx-1">~</span>
                        <span>{row.task.plan_end?.slice(5) ?? '-'}</span>
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="td text-right font-medium text-ink-700">{Math.round(row.task.workload)}h</td>
                  <td className="td">
                    <div className="flex items-center gap-2.5">
                      <ProgressBar value={row.task.effective_progress} className="flex-1" />
                      <span className="text-xs font-semibold text-ink-700 w-8 text-right">
                        {Math.round(row.task.effective_progress)}%
                      </span>
                    </div>
                  </td>
                  <td className="td text-center">
                    {row.task.delay_days != null && row.task.delay_days > 0 ? (
                      <span className="badge bg-red-50 text-red-500 ring-1 ring-red-200">+{row.task.delay_days}일</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex gap-1">
                      {row.task.task_type === 'issue' && (
                        <span className="badge bg-amber-50 text-amber-600 ring-1 ring-amber-200">Issue</span>
                      )}
                      {row.task.forecast_finish && row.task.plan_end && row.task.forecast_finish > row.task.plan_end && (
                        <span className="badge bg-amber-50 text-amber-600 ring-1 ring-amber-200">예측 연장</span>
                      )}
                      {!row.task.is_issue && !(row.task.forecast_finish && row.task.plan_end && row.task.forecast_finish > row.task.plan_end) && (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-slate-400">조건에 맞는 Task가 없습니다</div>
        )}
      </div>
    </div>
  )
}