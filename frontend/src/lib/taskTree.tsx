import type { Task } from '../api/types'

export interface TaskRow {
  task: Task
  depth: number
}

export interface TaskTree {
  rows: TaskRow[]
  hasChildren: Set<number>
  byParent: Map<number | null, Task[]>
}

/** Task 목록을 DFS 순서로 트리 행으로 변환. collapsed에 포함된 부모의 자식은 숨긴다. */
export function buildTaskTree(tasks: Task[], collapsed: Set<number>): TaskTree {
  const byParent = new Map<number | null, Task[]>()
  for (const t of tasks) {
    const key = t.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(t)
  }
  const hasChildren = new Set(tasks.filter((t) => t.parent_id != null).map((t) => t.parent_id!))
  const rows: TaskRow[] = []

  const walk = (pid: number | null, depth: number) => {
    const kids = (byParent.get(pid) || []).sort((a, b) => a.id - b.id)
    for (const k of kids) {
      rows.push({ task: k, depth })
      if (hasChildren.has(k.id) && !collapsed.has(k.id)) walk(k.id, depth + 1)
    }
  }
  walk(null, 0)

  return { rows, hasChildren, byParent }
}

/** 접기/펼치기 토글 버튼 (부모 Task에 표시) */
export function TreeToggle({
  taskId,
  hasChildren,
  collapsed,
  onToggle,
}: {
  taskId: number
  hasChildren: boolean
  collapsed: boolean
  onToggle: (id: number) => void
}) {
  if (!hasChildren) return <span className="w-4 shrink-0" />
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle(taskId)
      }}
      className="w-4 shrink-0 text-slate-400 hover:text-slate-700 text-[10px] leading-none"
      title={collapsed ? '펼치기' : '접기'}
    >
      {collapsed ? '▸' : '▾'}
    </button>
  )
}