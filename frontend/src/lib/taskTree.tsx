import type { Task } from '../api/types'

export interface TaskRow {
  task: Task
  depth: number
  /** 각 조상 레벨(위→아래)에서 아래로 이어지는 세로선 존재 여부 */
  guides: boolean[]
  /** 현재 노드가 부모의 마지막 자식인지 */
  isLast: boolean
}

export interface TaskTree {
  rows: TaskRow[]
  hasChildren: Set<number>
  byParent: Map<number | null, Task[]>
  childCounts: Map<number, number>
}

function bySchedule(a: Task, b: Task) {
  const sa = a.early_start || a.plan_start || ''
  const sb = b.early_start || b.plan_start || ''
  if (sa !== sb) return sa < sb ? -1 : 1
  const ea = a.early_finish || a.plan_end || ''
  const eb = b.early_finish || b.plan_end || ''
  if (ea !== eb) return ea < eb ? -1 : 1
  return a.id - b.id
}

function byGroupThenSchedule(a: Task, b: Task) {
  const ga = a.group_id ?? 1e9
  const gb = b.group_id ?? 1e9
  if (ga !== gb) return ga - gb
  return bySchedule(a, b)
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

  const walk = (pid: number | null, depth: number, parentGuides: boolean[]) => {
    const kids = (byParent.get(pid) || []).sort(pid == null ? byGroupThenSchedule : bySchedule)
    kids.forEach((k, i) => {
      const hasNext = i < kids.length - 1
      rows.push({ task: k, depth, guides: parentGuides, isLast: !hasNext })
      if (hasChildren.has(k.id) && !collapsed.has(k.id)) {
        walk(k.id, depth + 1, [...parentGuides, hasNext])
      }
    })
  }
  walk(null, 0, [])

  // 노드별 전체 하위 개수
  const childCounts = new Map<number, number>()
  const count = (id: number): number => {
    const kids = byParent.get(id) || []
    const n = kids.length + kids.reduce((s, k) => s + count(k.id), 0)
    childCounts.set(id, n)
    return n
  }
  for (const id of hasChildren) count(id)

  return { rows, hasChildren, byParent, childCounts }
}

/** 접기/펼치기 토글 버튼 (부모 Task/그룹에 표시) — 크고 명확한 chevron */
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
  if (!hasChildren) return <span className="w-5 shrink-0" />
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle(taskId)
      }}
      className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md text-[11px] leading-none text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      title={collapsed ? '펼치기' : '접기'}
      aria-label={collapsed ? '펼치기' : '접기'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {collapsed ? <path d="m6 9 6 6 6-6" /> : <path d="m6 15 6-6 6 6" />}
      </svg>
    </button>
  )
}

/** 그룹+Task 계층 트리 행 (MS Project 개요: 그룹=1레벨 요약 노드) */
export type TreeRow =
  | { kind: 'group'; gid: number; name: string; depth: number; guides: boolean[]; isLast: boolean }
  | { kind: 'task'; task: Task; depth: number; guides: boolean[]; isLast: boolean }

export interface GroupedTree {
  rows: TreeRow[]
  hasChildren: Set<number>
  childCounts: Map<number, number>
}

/**
 * Task 목록을 [그룹 → Task → 하위 Task] 계층으로 변환.
 * - 그룹은 1레벨 요약 노드(깊이 0), 접기/펼치기 가능
 * - collapsed에 그룹 id(음수) 또는 부모 Task id를 넣으면 해당 자식이 숨겨짐
 */
export function buildGroupedTaskTree(tasks: Task[], collapsed: Set<number>): GroupedTree {
  const byParent = new Map<number | null, Task[]>()
  for (const t of tasks) {
    const key = t.parent_id ?? null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(t)
  }
  const taskHasChildren = new Set(tasks.filter((t) => t.parent_id != null).map((t) => t.parent_id!))

  // 그룹 목록: 첫 등장 순서 유지, 그룹 id는 음수(태스크 id와 충돌 방지)
  const groupNames = [...new Set(tasks.map((t) => t.group_name || '기타'))]
  const gidOf = new Map<string, number>()
  groupNames.forEach((name, i) => gidOf.set(name, -(i + 1)))

  const topByGroup = new Map<number, Task[]>()
  const noGroupTops: Task[] = []
  for (const t of tasks) {
    if (t.parent_id != null) continue
    const name = t.group_name || '기타'
    const gid = gidOf.get(name)!
    if (name === '기타' && !t.group_name) {
      noGroupTops.push(t)
      continue
    }
    if (!topByGroup.has(gid)) topByGroup.set(gid, [])
    topByGroup.get(gid)!.push(t)
  }

  const hasChildren = new Set<number>([...taskHasChildren])
  const rows: TreeRow[] = []

  const walkTasks = (children: Task[], parentGuides: boolean[], depth: number) => {
    const sorted = [...children].sort(bySchedule)
    sorted.forEach((t, i) => {
      const hasNext = i < sorted.length - 1
      rows.push({ kind: 'task', task: t, depth, guides: parentGuides, isLast: !hasNext })
      if (taskHasChildren.has(t.id) && !collapsed.has(t.id)) {
        walkTasks(byParent.get(t.id) || [], [...parentGuides, hasNext], depth + 1)
      }
    })
  }

  groupNames.forEach((name, gi) => {
    const gid = gidOf.get(name)!
    const hasNextGroup = gi < groupNames.length - 1 || noGroupTops.length > 0
    hasChildren.add(gid)
    rows.push({ kind: 'group', gid, name, depth: 0, guides: [], isLast: !hasNextGroup })
    if (!collapsed.has(gid)) {
      walkTasks(topByGroup.get(gid) || [], [hasNextGroup], 1)
    }
  })

  // 그룹 없는 최상위 Task → 깊이 0(루트 직속)
  if (noGroupTops.length > 0) {
    walkTasks(noGroupTops, [], 0)
  }

  // 노드별 전체 하위 개수 (그룹 + 태스크)
  const childCounts = new Map<number, number>()
  const countOf = (id: number): number => {
    const kids = byParent.get(id) || []
    const n = kids.length + kids.reduce((s, k) => s + countOf(k.id), 0)
    childCounts.set(id, n)
    return n
  }
  for (const id of taskHasChildren) countOf(id)
  for (const name of groupNames) {
    const gid = gidOf.get(name)!
    childCounts.set(gid, (topByGroup.get(gid) || []).length)
  }

  return { rows, hasChildren, childCounts }
}

/** 트리 계층 연결선 — CSS 선분으로 렌더링. GitHub/MS Project 스타일:
 * 모든 노드(최상위 포함)가 루트에서부터 ├/└ 모서리로 연결된다.
 * extend=true(테이블용): 세로선을 상하로 연장해 셀 간격을 넘어 이어진다. */
export function TreeConnector({ guides, isLast, extend = false }: { guides: boolean[]; isLast: boolean; extend?: boolean }) {
  const n = guides.length
  const width = n * 16 + 20
  const cx = n * 16 + 8
  const over = extend ? -14 : 0
  return (
    <span className="relative shrink-0 self-stretch overflow-visible" style={{ width }} aria-hidden="true">
      {/* 조상 레벨 세로선 (루트→부모 줄기) */}
      {guides.map((g, i) => (
        <span
          key={i}
          className={`absolute w-px ${g ? 'bg-slate-300' : ''}`}
          style={{ left: i * 16 + 8, top: over, bottom: over }}
        />
      ))}
      {/* 현재 레벨 — 위(루트/부모 방향) */}
      <span className="absolute w-px bg-slate-300" style={{ left: cx, top: over, bottom: '50%' }} />
      {/* 현재 레벨 — 아래(다음 형제로 연결) */}
      {!isLast && <span className="absolute w-px bg-slate-300" style={{ left: cx, top: '50%', bottom: over }} />}
      {/* 수평선 */}
      <span className="absolute h-px bg-slate-300" style={{ left: cx, right: 2, top: '50%' }} />
    </span>
  )
}