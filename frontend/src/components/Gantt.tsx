import { useMemo, useState } from 'react'
import type { Dependency, Task } from '../api/types'
import { TreeConnector, TreeToggle, buildTaskTree, type TaskRow } from '../lib/taskTree'
import { IconLayout } from './icons'

const DAY = 86400000
const ROW_H = 36
const GRP_H = 26
const AXIS_H = 46
const LABEL_W = 340

const GROUP_TINTS = ['var(--surface-100)', 'var(--surface-50)', 'var(--surface-100)', 'var(--surface-50)', 'var(--surface-100)']

interface Props {
  tasks: Task[]
  dependencies: Dependency[]
  onSelect: (taskId: number) => void
}

function parse(d?: string | null): number | null {
  if (!d) return null
  const t = new Date(d + 'T00:00:00').getTime()
  return isNaN(t) ? null : t
}

interface RenderRow {
  kind: 'group' | 'task'
  label?: string
  row?: TaskRow
  tint?: string
}

export function Gantt({ tasks, dependencies, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [hoverId, setHoverId] = useState<number | null>(null)
  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const { rows, hasChildren, childCounts } = useMemo(() => buildTaskTree(tasks, collapsed), [tasks, collapsed])

  // 그룹 밴드 + 표시 행 레이아웃
  const renderRows = useMemo<RenderRow[]>(() => {
    const out: RenderRow[] = []
    const bands: { name: string; start: number; end: number }[] = []
    let cur: { name: string; start: number; end: number } | null = null
    rows.forEach((r, i) => {
      const g = r.task.group_name || ''
      if (cur && cur.name === g) cur.end = i
      else {
        if (cur) bands.push(cur)
        cur = { name: g, start: i, end: i }
      }
    })
    if (cur) bands.push(cur)
    bands.forEach((b, bi) => {
      if (b.name) {
        out.push({ kind: 'group', label: b.name, tint: GROUP_TINTS[bi % GROUP_TINTS.length] })
      }
      for (let i = b.start; i <= b.end; i++) {
        out.push({ kind: 'task', row: rows[i] })
      }
    })
    return out
  }, [rows])

  const taskY = useMemo(() => {
    const m = new Map<number, number>()
    let y = 0
    for (const r of renderRows) {
      if (r.kind === 'task' && r.row) m.set(r.row.task.id, y)
      y += 1
    }
    return m
  }, [renderRows])

  const { start, dayCount } = useMemo(() => {
    const dates: number[] = []
    for (const t of tasks) {
      for (const d of [t.baseline_start, t.baseline_end, t.plan_start, t.plan_end, t.actual_start, t.actual_end]) {
        const ts = parse(d)
        if (ts != null) dates.push(ts)
      }
    }
    if (dates.length === 0) return { start: Date.now(), end: Date.now() + 30 * DAY, dayCount: 30 }
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    const s = new Date(min)
    s.setDate(s.getDate() - 3)
    const e = new Date(max)
    e.setDate(e.getDate() + 3)
    return { start: s.getTime(), end: e.getTime(), dayCount: Math.ceil((e.getTime() - s.getTime()) / DAY) + 1 }
  }, [tasks])

  const DAY_W = 26
  const W = Math.max(dayCount * DAY_W + 24, 720)
  const H = AXIS_H + renderRows.length * ROW_H + renderRows.filter((r) => r.kind === 'group').length * 0

  const x = (d?: string | null) => {
    const ts = parse(d)
    if (ts == null) return null
    return ((ts - start) / DAY) * DAY_W
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayX = ((today.getTime() - start) / DAY) * DAY_W

  const bar = (s?: string | null, e?: string | null) => {
    const xs = x(s)
    const xe = x(e)
    if (xs == null || xe == null) return null
    const w = Math.max(xe - xs + DAY_W, 12)
    return { x: xs, w }
  }

  const { monthBands, weekendCols, weekTicks } = useMemo(() => {
    const monthBands: { x: number; w: number; label: string }[] = []
    const weekendCols: { x: number }[] = []
    const weekTicks: { x: number; label: string }[] = []
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(start + i * DAY)
      const dow = d.getDay()
      if (dow === 6 || dow === 0) weekendCols.push({ x: i * DAY_W })
      if (d.getDate() === 1 || i === 0) {
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
        const bandW = Math.min(Math.max((mEnd - (start + i * DAY)) / DAY, 1), dayCount - i) * DAY_W
        monthBands.push({ x: i * DAY_W, w: bandW, label: `${d.getMonth() + 1}월` })
      }
      if (dow === 1 || i === 0) weekTicks.push({ x: i * DAY_W, label: `${d.getDate()}일` })
    }
    return { monthBands, weekendCols, weekTicks }
  }, [start, dayCount])

  // 의존성 화살표 (양쪽 모두 크리티컬이면 critical 체인 엣지)
  const cpSet = useMemo(() => new Set(tasks.filter((t) => t.is_critical).map((t) => t.id)), [tasks])

  const edges = dependencies
    .map((d) => {
      const p = taskY.get(d.predecessor_id)
      const s = taskY.get(d.successor_id)
      if (p == null || s == null) return null
      const pred = tasks.find((t) => t.id === d.predecessor_id)
      const succ = tasks.find((t) => t.id === d.successor_id)
      const pe = bar(pred?.plan_start, pred?.plan_end)
      const ss = bar(succ?.plan_start, succ?.plan_end)
      if (!pe || !ss) return null
      const y1 = AXIS_H + p * ROW_H + ROW_H / 2
      const y2 = AXIS_H + s * ROW_H + ROW_H / 2
      return {
        x1: pe.x + pe.w,
        y1,
        x2: ss.x,
        y2,
        critical: cpSet.has(d.predecessor_id) && cpSet.has(d.successor_id),
      }
    })
    .filter((e): e is { x1: number; y1: number; x2: number; y2: number; critical: boolean } => e != null)

  const edgeCurve = (e: { x1: number; y1: number; x2: number; y2: number }) =>
    `M ${e.x1} ${e.y1} C ${(e.x1 + e.x2) / 2} ${e.y1}, ${(e.x1 + e.x2) / 2} ${e.y2}, ${e.x2 - 6} ${e.y2}`
  const arrowHead = (e: { x1: number; y1: number; x2: number; y2: number }, s: number) =>
    `${e.x2},${e.y2 - s} ${e.x2 + s + 1},${e.y2} ${e.x2},${e.y2 + s}`

  const yOf = (idx: number) => AXIS_H + idx * ROW_H

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100 grid place-items-center">
            <IconLayout size={15} />
          </span>
          <h2 className="font-semibold text-ink-900">간트 차트</h2>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-slate-200 ring-1 ring-slate-300" /> Baseline
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-gradient-to-r from-brand-500 to-brand-600" /> 계획
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-emerald-500" /> 진척
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-amber-400 ring-1 ring-amber-500" /> 예측
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded bg-red-500" /> Critical
          </span>
        </div>
      </div>

      <div className="flex">
        {/* 라벨 열 */}
        <div className="shrink-0 border-r border-slate-100 bg-card" style={{ width: LABEL_W, height: H }}>
          <div
            className="sticky top-0 z-20 flex items-center px-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-surface-50 border-b border-slate-100"
            style={{ height: AXIS_H }}
          >
            Task
          </div>
          {renderRows.map((r, idx) =>
            r.kind === 'group' ? (
              <div
                key={`g${idx}`}
                className="flex items-center px-5 text-[10px] font-bold uppercase tracking-wider"
                style={{ height: GRP_H, backgroundColor: r.tint, color: 'var(--ink-700)' }}
              >
                {r.label}
              </div>
            ) : (
              <div
                key={`r${r.row!.task.id}`}
                onClick={() => onSelect(r.row!.task.id)}
                onMouseEnter={() => setHoverId(r.row!.task.id)}
                onMouseLeave={() => setHoverId(null)}
                className={`gantt-row group flex items-center gap-2 px-4 cursor-pointer border-b border-slate-50 transition-colors ${
                  hoverId === r.row!.task.id ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                }`}
                style={{ height: ROW_H }}
                title={r.row!.task.title}
              >
                <span className="text-[10px] text-slate-300 w-5 shrink-0">
                  {r.row!.task.is_issue ? '⚠' : ''}
                </span>
                <TreeToggle
                  taskId={r.row!.task.id}
                  hasChildren={hasChildren.has(r.row!.task.id)}
                  collapsed={collapsed.has(r.row!.task.id)}
                  onToggle={toggle}
                />
                <TreeConnector guides={r.row!.guides} isLast={r.row!.isLast} />
                <span
                  className={`truncate ${
                    r.row!.depth === 0 ? 'text-[13px] font-semibold text-ink-900' : 'text-[13px] font-medium text-ink-700'
                  }`}
                >
                  {r.row!.task.title}
                </span>
                {hasChildren.has(r.row!.task.id) && (
                  <span className="shrink-0 text-[10px] text-slate-400">({childCounts.get(r.row!.task.id)})</span>
                )}
                {r.row!.task.is_critical && (
                  <span className="ml-auto shrink-0 badge bg-red-50 text-red-500 ring-1 ring-red-200">CP</span>
                )}
              </div>
            ),
          )}
        </div>

        {/* 타임라인 */}
        <div className="flex-1 overflow-x-auto">
          <svg width={W} height={H}>
            {/* 그룹 밴드 배경 */}
            {renderRows.map((r, idx) =>
              r.kind === 'group' ? (
                <rect key={`gb${idx}`} x={0} y={yOf(idx)} width={W} height={GRP_H} fill={r.tint} />
              ) : null,
            )}
            {/* 주말 음영 */}
            {weekendCols.map((c) => (
              <rect key={c.x} x={c.x} y={0} width={DAY_W * 2} height={H} fill="var(--surface-50)" />
            ))}
            {/* 월 밴드 */}
            {monthBands.map((m) => (
              <g key={m.x}>
                <rect x={m.x} y={0} width={m.w} height={AXIS_H / 2} fill="var(--surface-100)" />
                <text x={m.x + 6} y={AXIS_H / 2 - 7} fontSize={11} fontWeight={600} fill="var(--ink-700)">
                  {m.label}
                </text>
              </g>
            ))}
            <line x1={0} y1={AXIS_H / 2} x2={W} y2={AXIS_H / 2} stroke="var(--slate-200)" />
            {weekTicks.map((t) => (
              <text key={t.x} x={t.x + 3} y={AXIS_H - 8} fontSize={9} fill="var(--slate-400)">
                {t.label}
              </text>
            ))}
            <line x1={0} y1={AXIS_H} x2={W} y2={AXIS_H} stroke="var(--slate-200)" />

            {/* 오늘 */}
            {todayX > 0 && todayX < W && (
              <g>
                <line x1={todayX} y1={0} x2={todayX} y2={H} stroke="var(--ink-900)" strokeWidth={1.4} strokeDasharray="4,3" opacity={0.85} />
                <rect x={todayX - 15} y={AXIS_H + 3} width={30} height={15} rx={7.5} fill="var(--ink-900)" />
                <text x={todayX} y={AXIS_H + 13} fontSize={8.5} fontWeight={700} fill="var(--card)" textAnchor="middle">
                  오늘
                </text>
              </g>
            )}

            {/* 일반 의존성 */}
            {edges
              .filter((e) => !e.critical)
              .map((e, i) => (
                <g key={`e${i}`} opacity={0.3}>
                  <path d={edgeCurve(e)} stroke="var(--slate-400)" strokeWidth={1.1} fill="none" />
                  <polygon points={arrowHead(e, 3.5)} fill="var(--slate-400)" />
                </g>
              ))}

            {/* 크리티컬 경로 연결선 (가장 위에) */}
            {edges
              .filter((e) => e.critical)
              .map((e, i) => (
                <g key={`c${i}`}>
                  <path d={edgeCurve(e)} stroke="var(--ink-900)" strokeWidth={5} fill="none" opacity={0.16} />
                  <path d={edgeCurve(e)} stroke="var(--ink-900)" strokeWidth={2.3} fill="none" />
                  <circle cx={e.x1} cy={e.y1} r={4} fill="var(--ink-900)" stroke="var(--card)" strokeWidth={1.4} />
                  <polygon points={arrowHead(e, 4.5)} fill="var(--ink-900)" />
                </g>
              ))}

            {/* 그룹 라벨 */}
            {renderRows.map((r, idx) =>
              r.kind === 'group' ? (
                <text key={`gl${idx}`} x={10} y={yOf(idx) + GRP_H / 2 + 3.5} fontSize={10} fontWeight={700} fill="var(--ink-700)">
                  {r.label}
                </text>
              ) : null,
            )}

            {renderRows.map((r, idx) => {
              if (r.kind !== 'task' || !r.row) return null
              const { task: t } = r.row
              const y = yOf(idx) + 8
              const h = 20
              const isParent = hasChildren.has(t.id)
              const hovered = hoverId === t.id

              const baseline = bar(t.baseline_start, t.baseline_end)
              const plan = bar(t.plan_start, t.plan_end)
              const actual = bar(t.actual_start, t.actual_end)
              const fx = parse(t.forecast_finish)

              return (
                <g
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  onMouseEnter={() => setHoverId(t.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className="cursor-pointer"
                >
                  {hovered && <rect x={0} y={yOf(idx)} width={W} height={ROW_H} fill="var(--slate-200)" opacity={0.3} />}

                  {/* Baseline */}
                  {baseline && <rect x={baseline.x} y={y + 7} width={baseline.w} height={5} rx={2.5} fill="var(--slate-200)" />}

                  {/* 예측 연장 */}
                  {plan && fx != null && fx > plan.x + plan.w && (
                    <rect
                      x={plan.x + plan.w}
                      y={y - 1}
                      width={Math.min(fx - plan.x - plan.w + DAY_W, DAY_W * 4)}
                      height={h + 2}
                      rx={5}
                      fill="var(--slate-200)"
                      opacity={0.7}
                      stroke="var(--slate-400)"
                      strokeWidth={1}
                      strokeDasharray="3,2"
                    />
                  )}

                  {/* 계획 바 */}
                  {plan && (
                    <g>
                      {isParent ? (
                        <rect x={plan.x} y={y - 2} width={plan.w} height={h + 4} rx={7} fill="var(--slate-300)" stroke="var(--slate-600)" strokeWidth={1.3} />
                      ) : (
                        <rect
                          x={plan.x}
                          y={y}
                          width={plan.w}
                          height={h}
                          rx={6}
                          fill={t.is_issue ? 'var(--slate-400)' : t.is_critical ? 'var(--slate-200)' : 'var(--slate-300)'}
                          stroke={t.is_issue ? 'var(--slate-600)' : t.is_critical ? 'var(--ink-900)' : 'var(--slate-600)'}
                          strokeWidth={t.is_critical ? 1.6 : 1}
                        />
                      )}
                      {/* 진척 채움 */}
                      {!isParent && (
                        <rect
                          x={plan.x + 1.5}
                          y={y + 1.5}
                          width={Math.max((plan.w - 3) * (t.effective_progress / 100), 0)}
                          height={h - 3}
                          rx={5}
                          fill={t.is_issue ? 'var(--slate-500)' : t.is_critical ? 'var(--ink-900)' : 'var(--slate-600)'}
                          opacity={t.is_issue ? 0.85 : 0.9}
                        />
                      )}
                      {plan.w > 44 && !isParent && (
                        <text x={plan.x + plan.w - 7} y={y + h / 2 + 3} fontSize={8.5} fontWeight={700} fill="var(--card)" textAnchor="end">
                          {Math.round(t.effective_progress)}%
                        </text>
                      )}
                      {isParent && (
                        <text x={plan.x + 7} y={y + h / 2 + 3} fontSize={9} fontWeight={700} fill="var(--ink-700)">
                          {Math.round(t.effective_progress)}%
                        </text>
                      )}
                    </g>
                  )}

                  {/* 실제 구간 */}
                  {actual && (
                    <rect x={actual.x} y={y - 2} width={actual.w} height={h + 4} rx={6} fill="none" stroke="var(--ink-700)" strokeWidth={1.4} strokeDasharray="3,2" />
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}