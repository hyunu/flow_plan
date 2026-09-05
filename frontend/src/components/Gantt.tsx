import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Dependency, Task } from '../api/types'
import { TreeConnector, TreeToggle, buildGroupedTaskTree, type TaskRow } from '../lib/taskTree'
import { useDisplay } from '../auth/DisplayContext'
import { chartColors, formatDelay, hexWithAlpha } from '../lib/displayPrefs'
import { CriticalBadge } from './ui'
import { IconLayout } from './icons'
const DAY = 86400000
const ROW_H = 36
const GRP_H = 26
const AXIS_H = 46
const DAY_W0 = 26
const DAY_W_MIN = 8
const DAY_W_MAX = 72

const cv = (name: string) => `rgb(var(--${name}))`
const FONT = 'LGSmart, "LG스마트체", "LG Smart_H", sans-serif'

const GROUP_TINTS = [cv('surface-100'), cv('surface-50'), cv('surface-100'), cv('surface-50'), cv('surface-100')]

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

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return d
  return `${Number(m[2])}/${Number(m[3])}`
}

function netStart(t?: Task | null) {
  if (!t) return undefined
  return t.early_start || t.plan_start
}
function netEnd(t?: Task | null) {
  if (!t) return undefined
  return t.early_finish || t.plan_end
}

interface RenderRow {
  kind: 'group' | 'task'
  gid?: number
  label?: string
  row?: TaskRow
  tint?: string
  guides?: boolean[]
  isLast?: boolean
}

export function Gantt({ tasks, dependencies, onSelect }: Props) {
  const { prefs } = useDisplay()
  const cc = chartColors(prefs.colors)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [hoverId, setHoverId] = useState<number | null>(null)
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 })
  const [dayW, setDayW] = useState(DAY_W0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const labelColRef = useRef<HTMLDivElement>(null)
  const dayWRef = useRef(dayW)
  dayWRef.current = dayW
  const pendingScrollRef = useRef<number | null>(null)
  const panRef = useRef<{
    x: number
    sl: number
    moved: boolean
    pointerId: number
    target: HTMLElement
  } | null>(null)
  const skipClickRef = useRef(false)
  const [panning, setPanning] = useState(false)
  const hoverTask = hoverId != null ? tasks.find((t) => t.id === hoverId) : undefined

  useEffect(() => {
    const clear = () => setHoverId(null)
    window.addEventListener('flowplan-hover-reset', clear)
    return () => window.removeEventListener('flowplan-hover-reset', clear)
  }, [])

  const moveTip = (e: { clientX: number; clientY: number }) => setTipPos({ x: e.clientX, y: e.clientY })
  const enterTask = (id: number, e: { clientX: number; clientY: number }) => {
    setHoverId(id)
    moveTip(e)
  }
  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // 수평 팬(드래그 이동) — 타임라인 뿐 아니라 Task 라벨 열에서도 동작(모바일 지원)
  const beginPan = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, [data-no-pan]')) return
    const node = scrollRef.current
    if (!node) return
    panRef.current = {
      x: e.clientX,
      sl: node.scrollLeft,
      moved: false,
      pointerId: e.pointerId,
      target: e.currentTarget as HTMLElement,
    }
  }
  const movePan = (e: React.PointerEvent<HTMLElement>) => {
    const p = panRef.current
    const node = scrollRef.current
    if (!p || !node) return
    const dx = e.clientX - p.x
    if (!p.moved && Math.abs(dx) < 4) return
    if (!p.moved) {
      p.moved = true
      skipClickRef.current = true
      p.target.setPointerCapture(p.pointerId)
      if (!panning) setPanning(true)
    }
    node.scrollLeft = p.sl - dx
  }
  const endPan = (e?: React.PointerEvent<HTMLElement>) => {
    const p = panRef.current
    if (p?.moved) skipClickRef.current = true
    if (p?.moved && e) {
      try {
        p.target.releasePointerCapture(p.pointerId)
      } catch {
        /* already released */
      }
    }
    panRef.current = null
    setPanning(false)
  }
  const cancelPan = () => {
    skipClickRef.current = false
    panRef.current = null
    setPanning(false)
  }
  const guardClick = (e: React.MouseEvent) => {
    if (skipClickRef.current) {
      e.stopPropagation()
      skipClickRef.current = false
    }
  }

  const { rows: treeRows, hasChildren, childCounts } = useMemo(
    () => buildGroupedTaskTree(tasks, collapsed),
    [tasks, collapsed],
  )

  const renderRows = useMemo<RenderRow[]>(() => {
    let gi = 0
    return treeRows.map((r) => {
      if (r.kind === 'group') {
        const tint = GROUP_TINTS[gi++ % GROUP_TINTS.length]
        return {
          kind: 'group' as const,
          gid: r.gid,
          label: r.name,
          tint,
          guides: r.guides,
          isLast: r.isLast,
        }
      }
      return {
        kind: 'task' as const,
        row: { task: r.task, depth: r.depth, guides: r.guides, isLast: r.isLast },
      }
    })
  }, [treeRows])

  const rowH = (r: RenderRow) => (r.kind === 'group' ? GRP_H : ROW_H)

  const { rowTops, taskTop, H } = useMemo(() => {
    const tops: number[] = []
    const taskTop = new Map<number, number>()
    let y = AXIS_H
    for (const r of renderRows) {
      tops.push(y)
      if (r.kind === 'task' && r.row) taskTop.set(r.row.task.id, y)
      y += r.kind === 'group' ? GRP_H : ROW_H
    }
    return { rowTops: tops, taskTop, H: y }
  }, [renderRows])

  const { start, dayCount } = useMemo(() => {
    const dates: number[] = []
    for (const t of tasks) {
      for (const d of [
        t.baseline_start,
        t.baseline_end,
        t.plan_start,
        t.plan_end,
        t.early_start,
        t.early_finish,
        t.actual_start,
        t.actual_end,
      ]) {
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

  const DAY_W = dayW
  const W = Math.max(dayCount * DAY_W + 24, 720)

  const zoomTo = (next: number, anchorClientX?: number) => {
    const el = scrollRef.current
    const current = dayWRef.current
    const clamped = Math.min(DAY_W_MAX, Math.max(DAY_W_MIN, next))
    if (Math.abs(clamped - current) < 0.2) return
    const rect = el?.getBoundingClientRect()
    const labelW = labelColRef.current?.offsetWidth ?? 0
    const viewW = rect ? rect.width : 0
    const cx = anchorClientX ?? (rect ? rect.left + labelW + Math.max(viewW - labelW, 0) / 2 : 0)
    const xInView = rect ? cx - rect.left : 0
    const timelineX = (el?.scrollLeft ?? 0) + xInView - labelW
    const day = current > 0 ? timelineX / current : 0
    pendingScrollRef.current = day * clamped - xInView + labelW
    setDayW(clamped)
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    const sl = pendingScrollRef.current
    if (el && sl != null) {
      el.scrollLeft = sl
      pendingScrollRef.current = null
    }
  }, [dayW])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const inLabels = !!labelColRef.current?.contains(e.target as Node)
      const horiz = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)
      const pinchZoom = e.ctrlKey || e.metaKey
      if (inLabels && !pinchZoom) {
        if (horiz) {
          e.preventDefault()
          el.scrollLeft += e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        }
        return
      }
      if (horiz && !pinchZoom) {
        e.preventDefault()
        el.scrollLeft += e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
        return
      }
      e.preventDefault()
      const factor = e.deltaY > 0 ? 1 / 1.18 : 1.18
      zoomTo(dayWRef.current * factor, e.clientX)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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
  }, [start, dayCount, DAY_W])

  // 의존성 화살표 (양쪽 모두 크리티컬이면 critical 체인 엣지)
  const cpSet = useMemo(() => new Set(tasks.filter((t) => t.is_critical).map((t) => t.id)), [tasks])

  const edges = dependencies
    .map((d) => {
      const p = taskTop.get(d.predecessor_id)
      const s = taskTop.get(d.successor_id)
      if (p == null || s == null) return null
      const pred = tasks.find((t) => t.id === d.predecessor_id)
      const succ = tasks.find((t) => t.id === d.successor_id)
      const pe = bar(netStart(pred), netEnd(pred))
      const ss = bar(netStart(succ), netEnd(succ))
      if (!pe || !ss) return null
      const y1 = p + ROW_H / 2
      const y2 = s + ROW_H / 2
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

  const yOf = (idx: number) => rowTops[idx]

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100 grid place-items-center">
            <IconLayout size={15} />
          </span>
          <div>
            <h2 className="font-semibold text-ink-900">간트 차트</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">세로 휠·핀치로 확대 · 가로 스크롤·드래그로 이동</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 h-7 shrink-0 whitespace-nowrap">
            <span className="w-3 h-1.5 rounded" style={{ background: cc.baseline }} /> Baseline
          </span>
          <span className="flex items-center gap-1.5 h-7 shrink-0 whitespace-nowrap">
            <span className="w-3 h-1.5 rounded" style={{ background: cc.plan }} /> 계획
          </span>
          <span className="flex items-center gap-1.5 h-7 shrink-0 whitespace-nowrap">
            <span className="w-3 h-1.5 rounded" style={{ background: cc.actual }} /> 진척
          </span>
          <span className="flex items-center gap-1.5 h-7 shrink-0 whitespace-nowrap">
            <span className="w-3 h-1.5 rounded ring-1 ring-dashed" style={{ background: hexWithAlpha(cc.forecast, 0.45), borderColor: cc.forecast }} /> 예측
          </span>
          <span className="flex items-center gap-1.5 h-7 shrink-0 whitespace-nowrap">
            <span className="w-3 h-1.5 rounded ring-2" style={{ background: hexWithAlpha(cc.critical, 0.45), boxShadow: `0 0 0 2px ${cc.critical}` }} /> 크리티컬
          </span>
          </div>
          <div className="flex items-center gap-0.5">
            {Math.abs(dayW - DAY_W0) > 0.4 && (
              <button
                type="button"
                onClick={() => setDayW(DAY_W0)}
                className="px-2 py-1 h-7 rounded-lg text-[11px] text-slate-500 hover:text-ink-700 hover:bg-surface-100"
              >
                전체보기
              </button>
            )}
            <button
              type="button"
              onClick={() => zoomTo(dayW * 1.25)}
              className="w-7 h-7 rounded-lg text-slate-500 hover:text-ink-700 hover:bg-surface-100 text-sm"
              title="확대"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => zoomTo(dayW / 1.25)}
              className="w-7 h-7 rounded-lg text-slate-500 hover:text-ink-700 hover:bg-surface-100 text-sm"
              title="축소"
            >
              −
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{ cursor: panning ? 'grabbing' : 'grab' }}
        onMouseLeave={() => setHoverId(null)}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={cancelPan}
        onClickCapture={guardClick}
      >
        <div className="flex leading-none" style={{ width: 'max-content' }}>
        {/* 라벨 열 */}
        <div
          ref={labelColRef}
          className="shrink-0 border-r border-slate-100 bg-card leading-none md:sticky md:left-0 z-10"
          style={{ width: 'min(340px, 42vw)', height: H }}
        >
          <div
            className="box-border sticky top-0 z-20 flex items-center px-5 text-[12px] font-semibold text-ink-700 bg-surface-50 border-b border-slate-100"
            style={{ height: AXIS_H }}
          >
            Task
          </div>
          {renderRows.map((r, idx) =>
            r.kind === 'group' ? (
              <div
                key={`g${r.gid}`}
                onClick={() => r.gid != null && toggle(r.gid)}
                className="box-border shrink-0 overflow-hidden flex items-center gap-1.5 px-4 text-[12px] font-bold text-ink-900 cursor-pointer hover:brightness-[0.97]"
                data-no-pan
                style={{ height: GRP_H, backgroundColor: r.tint }}
              >
                <TreeToggle
                  taskId={r.gid!}
                  hasChildren={r.gid != null && hasChildren.has(r.gid)}
                  collapsed={r.gid != null && collapsed.has(r.gid)}
                  onToggle={toggle}
                />
                <span className="truncate">{r.label}</span>
                {r.gid != null && collapsed.has(r.gid) && (
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">
                    ({childCounts.get(r.gid) || 0})
                  </span>
                )}
              </div>
            ) : (
              <div
                key={`r${r.row!.task.id}`}
                onClick={() => onSelect(r.row!.task.id)}
                onMouseEnter={(e) => enterTask(r.row!.task.id, e)}
                onMouseMove={moveTip}
                className={`gantt-row group box-border shrink-0 overflow-hidden flex items-center gap-2 px-4 cursor-pointer border-b border-slate-50 transition-colors ${
                  hoverId === r.row!.task.id ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                }`}
                style={{ height: ROW_H }}
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
                  <span className="ml-auto shrink-0">
                    <CriticalBadge />
                  </span>
                )}
              </div>
            ),
          )}
        </div>

        {/* 타임라인 */}
        <div
          className="shrink-0 leading-none"
          style={{ width: W, height: H }}
          onDoubleClick={() => setDayW(DAY_W0)}
        >
          <svg width={W} height={H} className="block overflow-visible">
            {/* 그룹 밴드 배경 */}
            {renderRows.map((r, idx) =>
              r.kind === 'group' ? (
                <rect
                  key={`gb${idx}`}
                  x={0}
                  y={yOf(idx)}
                  width={W}
                  height={GRP_H}
                  fill={r.tint}
                  className="cursor-pointer"
                  onClick={() => r.gid != null && toggle(r.gid)}
                />
              ) : null,
            )}
            {/* 주말 음영 */}
            {weekendCols.map((c) => (
              <rect key={c.x} x={c.x} y={0} width={DAY_W * 2} height={H} fill={cv('slate-400')} opacity={0.12} />
            ))}
            {/* 월 밴드 */}
            {monthBands.map((m) => (
              <g key={m.x}>
                <rect x={m.x} y={0} width={m.w} height={AXIS_H / 2} fill={cv('surface-100')} />
                <text x={m.x + 6} y={AXIS_H / 2 - 6} fontSize={12} fontWeight={700} fill={cv('ink-900')} fontFamily={FONT}>
                  {m.label}
                </text>
              </g>
            ))}
            <line x1={0} y1={AXIS_H / 2} x2={W} y2={AXIS_H / 2} stroke={cv('slate-400')} opacity={0.45} />
            {weekTicks.map((t) => (
              <text key={t.x} x={t.x + 3} y={AXIS_H - 7} fontSize={10} fontWeight={600} fill={cv('ink-900')} fontFamily={FONT}>
                {t.label}
              </text>
            ))}
            <line x1={0} y1={AXIS_H} x2={W} y2={AXIS_H} stroke={cv('slate-400')} opacity={0.45} />

            {/* 오늘 */}
            {todayX > 0 && todayX < W && (
              <g>
                <line x1={todayX} y1={0} x2={todayX} y2={H} stroke={cc.today} strokeWidth={1.4} strokeDasharray="4,3" opacity={0.85} />
                <rect x={todayX - 15} y={AXIS_H + 3} width={30} height={15} rx={7.5} fill={cc.today} />
                <text x={todayX} y={AXIS_H + 14} fontSize={9} fontWeight={700} fill={cv('card')} textAnchor="middle" fontFamily={FONT}>
                  오늘
                </text>
              </g>
            )}

            {/* 그룹 라벨 */}
            {renderRows.map((r, idx) =>
              r.kind === 'group' ? (
                <text key={`gl${idx}`} x={10} y={yOf(idx) + GRP_H / 2 + 4} fontSize={11} fontWeight={700} fill={cv('ink-900')} fontFamily={FONT}>
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
              const plan = bar(netStart(t), netEnd(t))
              const actual = bar(t.actual_start, t.actual_end)
              const fx = parse(t.forecast_finish)
              const late = (t.delay_days ?? 0) > 0
              const planFill = t.is_critical
                ? hexWithAlpha(cc.critical, 0.42)
                : late
                  ? hexWithAlpha(cc.delay, 0.38)
                  : hexWithAlpha(cc.plan, 0.5)
              const planStroke = t.is_critical ? cc.critical : late ? cc.delay : cc.plan
              const doneFill = t.status === 'completed' ? cc.actual : t.is_issue ? cc.issue : cc.actual

              return (
                <g
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  onMouseEnter={(e) => enterTask(t.id, e)}
                  onMouseMove={moveTip}
                  className="cursor-pointer"
                >
                  <rect x={0} y={yOf(idx)} width={W} height={rowH(r)} fill="transparent" />
                  {hovered && <rect x={0} y={yOf(idx)} width={W} height={rowH(r)} fill={cv('slate-400')} opacity={0.16} pointerEvents="none" />}

                  {/* Baseline */}
                  {baseline && <rect x={baseline.x} y={y + 7} width={baseline.w} height={5} rx={2.5} fill={cc.baseline} opacity={0.7} />}

                  {/* 예측 연장 */}
                  {plan && fx != null && fx > plan.x + plan.w && (
                    <rect
                      x={plan.x + plan.w}
                      y={y - 1}
                      width={Math.min(fx - plan.x - plan.w + DAY_W, DAY_W * 4)}
                      height={h + 2}
                      rx={5}
                      fill={hexWithAlpha(cc.forecast, 0.28)}
                      stroke={cc.forecast}
                      strokeWidth={1}
                      strokeDasharray="3,2"
                    />
                  )}

                  {/* 계획 바 */}
                  {plan && (
                    <g>
                      {isParent ? (
                        <rect x={plan.x} y={y - 2} width={plan.w} height={h + 4} rx={7} fill={planFill} stroke={planStroke} strokeWidth={1.3} />
                      ) : (
                        <rect
                          x={plan.x}
                          y={y}
                          width={plan.w}
                          height={h}
                          rx={6}
                          fill={planFill}
                          stroke={planStroke}
                          strokeWidth={t.is_critical ? 1.8 : 1.1}
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
                          fill={doneFill}
                          opacity={0.92}
                        />
                      )}
                      <text
                        x={plan.x + plan.w + 6}
                        y={y + h / 2 + 4}
                        fontSize={11}
                        fontWeight={700}
                        fill={cv('ink-900')}
                        stroke={cv('card')}
                        strokeWidth={4}
                        paintOrder="stroke"
                        fontFamily={FONT}
                      >
                        {Math.round(t.effective_progress)}%
                      </text>
                    </g>
                  )}

                  {/* 실제 구간 */}
                  {actual && (
                    <rect x={actual.x} y={y - 2} width={actual.w} height={h + 4} rx={6} fill="none" stroke={cc.actual} strokeWidth={1.4} strokeDasharray="3,2" />
                  )}
                </g>
              )
            })}

            {/* 의존성 연결 — 바 위에 그려 시작점/끝점이 바에 가리지 않게 */}
            {edges.map((e, i) => {
              const crit = e.critical
              const stroke = crit ? cc.critical : cc.plan
              const r = crit ? 6.5 : 5
              return (
                <g key={`edge${i}`} pointerEvents="none" opacity={crit ? 1 : 0.92}>
                  <path d={edgeCurve(e)} stroke={stroke} strokeWidth={crit ? 2.8 : 1.6} fill="none" />
                  <circle cx={e.x1} cy={e.y1} r={r} fill={cv('card')} stroke={stroke} strokeWidth={2.2} />
                  <circle cx={e.x1} cy={e.y1} r={2} fill={stroke} />
                  <circle cx={e.x2} cy={e.y2} r={r} fill={stroke} stroke={cv('card')} strokeWidth={2} />
                  <polygon
                    points={`${e.x2 + r + 6},${e.y2} ${e.x2 + 1},${e.y2 - r - 1} ${e.x2 + 1},${e.y2 + r + 1}`}
                    fill={stroke}
                    stroke={cv('card')}
                    strokeWidth={1}
                    strokeLinejoin="round"
                  />
                </g>
              )
            })}
          </svg>
        </div>
        </div>
      </div>

      {hoverTask && (
        <div
          className="fixed z-[80] pointer-events-none w-max max-w-[18rem] rounded-lg bg-neutral-900 text-white text-[14px] leading-snug px-3 py-2.5 shadow-xl border border-white/10"
          style={{ left: tipPos.x + 14, top: tipPos.y + 14 }}
        >
          <div className="font-semibold text-[15px] truncate">{hoverTask.title}</div>
          <div className="mt-1.5 space-y-0.5 text-[13px] text-slate-200">
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">담당자</span>
              <span className="font-medium text-white">
                {!(hoverTask.assignments?.length)
                  ? '미지정'
                  : hoverTask.assignments
                      .map((a) => {
                        const name = a.user_name || `#${a.user_id}`
                        return a.workload_hours ? `${name} (${a.workload_hours}h)` : name
                      })
                      .join(', ')}
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">계획</span>
              <span className="font-medium text-white">
                {fmtDate(hoverTask.plan_start)} ~ {fmtDate(hoverTask.plan_end)}
                <span className="ml-1 text-slate-300">{Math.round(hoverTask.workload)}h</span>
              </span>
            </div>
            {(hoverTask.early_start || hoverTask.early_finish) && (
              <div className="flex gap-1.5">
                <span className="text-slate-400 shrink-0">가능 시작</span>
                <span className="font-medium text-white">
                  {fmtDate(hoverTask.early_start)} ~ {fmtDate(hoverTask.early_finish)}
                  {hoverTask.is_critical ? (
                    <span className="ml-1 text-slate-400">{prefs.labels.critical}</span>
                  ) : null}
                </span>
              </div>
            )}
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">최초 계획</span>
              <span>
                {fmtDate(hoverTask.baseline_start)} ~ {fmtDate(hoverTask.baseline_end)}
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">실적</span>
              <span className="font-medium text-white">
                {hoverTask.actual_start || hoverTask.actual_end
                  ? `${fmtDate(hoverTask.actual_start)} ~ ${fmtDate(hoverTask.actual_end)}`
                  : '미입력'}
              </span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-slate-400 shrink-0">진척</span>
              <span className="font-medium text-white">{Math.round(hoverTask.effective_progress)}%</span>
              {prefs.showDelay &&
                hoverTask.delay_days != null &&
                hoverTask.delay_days > 0 &&
                formatDelay(hoverTask.delay_days, prefs.delayFormat, prefs.labels.delayed) && (
                  <span style={{ color: prefs.colors.delayed }}>
                    {formatDelay(hoverTask.delay_days, prefs.delayFormat, prefs.labels.delayed)}
                  </span>
                )}
            </div>
            {hoverTask.forecast_finish && (
              <div className="flex gap-1.5">
                <span className="text-slate-400 shrink-0">예측 완료</span>
                <span>{fmtDate(hoverTask.forecast_finish)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}