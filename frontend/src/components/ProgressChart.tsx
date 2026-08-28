import { useMemo } from 'react'
import type { Task } from '../api/types'
import { IconRefresh } from './icons'

const DAY = 86400000

interface Props {
  tasks: Task[]
  plannedFinish?: string
  forecastFinish?: string
  planProgress: number
  actualProgress: number
  baselineStart?: string
  baselineEnd?: string
  planStart?: string
  planEnd?: string
  expectedDelayDays?: number
  milestones?: { name: string; end_date?: string; progress: number }[]
  planCurve?: { date: string; pct: number }[]
  onRefresh?: () => void
}

function t(d?: string | null): number | null {
  if (!d) return null
  const ts = new Date(d + 'T00:00:00').getTime()
  return isNaN(ts) ? null : ts
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 포인트 배열 → 부드러운 path (중간점 quadratic 스무딩) */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2
    const my = (pts[i - 1].y + pts[i].y) / 2
    if (i === 1) d += ` Q ${pts[i - 1].x} ${pts[i - 1].y}, ${mx} ${my}`
    else d += ` T ${mx} ${my}`
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`
  return d
}

export function ProgressChart({
  tasks,
  plannedFinish,
  forecastFinish,
  actualProgress,
  planEnd,
  expectedDelayDays,
  milestones = [],
  planCurve,
  onRefresh,
}: Props) {
  const W = 720
  const H = 316
  const PAD = { l: 46, r: 20, t: 18, b: 32 }

  const viz = useMemo(() => {
    const todayTs = startOfDay(Date.now())

    // 잎(leaf) 태스크만 사용 — 부모는 자식 작업량을 합산하므로 이중 계상 방지
    const parentIds = new Set(tasks.filter((x) => x.parent_id != null).map((x) => x.parent_id!))
    const leaves = tasks.filter((tt) => !parentIds.has(tt.id))

    // 날짜 축 범위
    const rangeDates: number[] = [todayTs]
    for (const tt of leaves) {
      for (const dd of [tt.plan_start, tt.baseline_start, tt.baseline_end, tt.actual_start]) {
        const v = t(dd)
        if (v != null) rangeDates.push(v)
      }
      if (tt.plan_end && tt.plan_end >= (tt.plan_start ?? '')) rangeDates.push(t(tt.plan_end)!)
    }
    rangeDates.push(t(plannedFinish) ?? todayTs)
    if (forecastFinish) rangeDates.push(t(forecastFinish)!)

    let min = Math.min(...rangeDates)
    let max = Math.max(...rangeDates)
    if (max - min < DAY * 14) {
      min -= DAY * 7
      max += DAY * 7
    }
    const days = Math.max(Math.ceil((max - min) / DAY), 2)
    const range = max - min
    const plotW = W - PAD.l - PAD.r
    const plotH = H - PAD.t - PAD.b
    const sx = (d: number) => PAD.l + ((d - min) / range) * plotW
    const sy = (p: number) => H - PAD.b - (p / 100) * plotH

    // 일 단위 누적 테이블 빌더
    const cumArr = (): number[] => new Array(days).fill(0)
    const toIdx = (d: number) => Math.min(Math.max(Math.round((d - min) / DAY), 0), days - 1)

    // 작업일(월~금) 여부/누적 — 백엔드 엔진(_schedule_progress)의 count_workdays와 동일 의미
    const isWk = Array.from({ length: days }, (_, i) => {
      const g = new Date(min + i * DAY).getDay()
      return g >= 1 && g <= 5
    })
    const wkAcc = new Array<number>(days).fill(0)
    {
      let c = 0
      for (let i = 0; i < days; i++) {
        if (isWk[i]) c++
        wkAcc[i] = c
      }
    }
    const wkCount = (i0: number, i1: number) => (i1 >= i0 ? wkAcc[i1] - (i0 > 0 ? wkAcc[i0 - 1] : 0) : 0)

    // 계획/기준선 곡선: 백엔드 엔진(_schedule_progress)과 동일 정의로 누적.
    //   task별 f(d) = completed 또는 d>=계획종료 → 100, d<계획시작 → 0,
    //   그 외 → (계획시작~d 작업일수 / 계획시작~계획종료 작업일수)×100 (1dp)
    //   전체 = Σ 잎(leaf) 작업량×f / Σ 작업량  → 마지막 계획종료일에 100% 도달
    const fillElapsedCum = (
      target: number[],
      fieldS: 'plan_start' | 'baseline_start',
      fieldE: 'plan_end' | 'baseline_end',
      forceDone: boolean,
    ) => {
      for (const tt of leaves) {
        const s = t(tt[fieldS])
        const e = t(tt[fieldE])
        if (s == null || e == null || e < s) continue
        const w = tt.workload > 0 ? tt.workload : 1
        const done = forceDone && tt.status === 'completed'
        const iS = toIdx(s)
        const iE = Math.max(toIdx(e), iS)
        const total = wkCount(iS, iE)
        if (total <= 0) continue
        for (let i = 0; i < days; i++) {
          const d = min + i * DAY
          let f: number
          if (done || d >= e) f = 100
          else if (d < s) f = 0
          else f = Math.round((wkCount(iS, Math.min(i, iE)) / total) * 1000) / 10
          target[i] += (w * f) / 100
        }
      }
    }

    // ① 계획 S-Curve: 백엔드가 전달한 plan_curve(엔진과 동일 정의·프로젝트 캘린더 반영)를 우선 사용.
    //    백엔드 값이 없으면 동일 정의를 월~금 근사로 로컬 계산한다.
    let totalWork = 0
    for (const tt of leaves) totalWork += tt.workload > 0 ? tt.workload : 1
    const planCum = cumArr()
    const backendCurve = planCurve && planCurve.length > 0
      ? new Map<number, number>((planCurve.map((c) => [t(c.date), c.pct])).filter((x): x is [number, number] => x[0] != null))
      : null
    if (backendCurve) {
      const keys = [...backendCurve.keys()].sort((a, b) => a - b)
      const lo = keys[0]
      for (let i = 0; i < days; i++) {
        const d = startOfDay(min + i * DAY)
        const pct = backendCurve.get(d) ?? (d < lo ? 0 : 100)
        planCum[i] = (pct * totalWork) / 100
      }
    } else {
      fillElapsedCum(planCum, 'plan_start', 'plan_end', true)
    }

    // ② Baseline S-Curve (동일 정의, baseline 일정 기준)
    const baseCum: number[] | null = leaves.some((x) => x.baseline_start && x.baseline_end) ? cumArr() : null
    if (baseCum) fillElapsedCum(baseCum, 'baseline_start', 'baseline_end', false)

    // ③ 실제(누적 실적 S-Curve): 각 task의 완료 작업량(effective)을
    //    시작일~today 구간에 선형 배분 (과거 이력 없을 때의 합리적 근사)
    const todayIdx = toIdx(todayTs)
    const actualCum = cumArr()
    for (const tt of leaves) {
      const s = t(tt.plan_start)
      if (s == null) continue
      const w = tt.workload > 0 ? tt.workload : 1
      const earn = w * (tt.effective_progress / 100)
      const i0 = toIdx(s)
      const rampEnd = Math.min(Math.max(todayTs, s), t(tt.plan_end) ?? todayTs)
      const i1 = Math.max(toIdx(rampEnd), i0 + 1)
      const per = earn / (i1 - i0)
      for (let i = i0; i < i1; i++) actualCum[i] += per
    }
    let ar = 0
    for (let i = 0; i < days; i++) {
      ar += actualCum[i]
      actualCum[i] = ar
    }
    // 오늘 지점이 카드(엔진) overall_progress와 정확히 일치하도록 곡선을 스케일
    let actToday = totalWork > 0 ? Math.min((actualCum[todayIdx] / totalWork) * 100, 100) : 0
    if (actualProgress > 0 && actToday > 0 && actualProgress !== actToday) {
      const actScale = actualProgress / actToday
      for (let i = 0; i < days; i++) actualCum[i] *= actScale
      actToday = actualProgress
    }

    // ④ 예측(forecast): 오늘 실적부터 forecast_finish까지 100%로 직진
    const foreEnd = t(forecastFinish) ?? t(plannedFinish) ?? max
    const foreCum: number[] | null = foreEnd > todayTs ? cumArr() : null
    if (foreCum) {
      const curVal = (actualCum[toIdx(todayTs)] ?? 0)
      const totalW = totalWork > 0 ? totalWork : 1
      const curPct = (curVal / totalW) * 100
      const targetPct = 100
      const i0 = Math.max(toIdx(todayTs), 0)
      const i1 = Math.max(toIdx(foreEnd), i0 + 1)
      const per = (targetPct - curPct) / (i1 - i0)
      for (let i = 0; i < days; i++) {
        if (i <= i0) foreCum[i] = curVal
        else if (i >= i1) foreCum[i] = totalW
        else foreCum[i] = curVal + per * (i - i0) * totalW
      }
    }

    // ⑤ 지연 구간 음영 (계획 종료 ~ 예측 종료)
    const planE = t(planEnd) ?? t(plannedFinish)
    const foreE = t(forecastFinish)
    const delayRegion = planE != null && foreE != null && foreE > planE
      ? { x0: sx(planE), x1: sx(foreE) }
      : null

    // ⑥ 오늘의 계획/실제 % (작업량 집계 기준 — 지표와 일치하도록 클램프)
    const planToday = totalWork > 0 ? Math.min((planCum[todayIdx] / totalWork) * 100, 100) : 0

    const toPts = (arr: number[] | null, xOff = 0) =>
      arr == null
        ? []
        : Array.from({ length: days }, (_, i) => ({
            x: sx(min + i * DAY) + xOff,
            y: totalWork > 0 ? sy((arr[i] / totalWork) * 100) : sy(0),
          }))

    // 마일스톤 마커 (end_date 있는 것만, 범위 내)
    const msPts = milestones
      .map((m) => ({ m, ts: t(m.end_date) }))
      .filter((x): x is { m: (typeof milestones)[number]; ts: number } => x.ts != null && x.ts >= min && x.ts <= max)
      .map(({ m, ts }) => ({
        x: sx(ts),
        y: totalWork > 0 ? sy(Math.min(Math.max((planCum[toIdx(ts)] / totalWork) * 100, 4), 100)) : 4,
        name: m.name,
      }))

    return {
      min, max, todayTs, totalWork, planCum, baseCum, actualCum, foreCum,
      planToday, actToday, delayRegion, msPts,
      pts: {
        baseline: toPts(baseCum, 0.5),
        plan: toPts(planCum),
        actual: toPts(actualCum),
        forecast: toPts(foreCum),
      },
    }
  }, [tasks, plannedFinish, forecastFinish, planEnd, milestones])

  const { min, max, todayTs, planToday, actToday, delayRegion, msPts } = viz
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sy = (p: number) => H - PAD.b - (p / 100) * plotH
  const sx = (d: number) => PAD.l + ((d - min) / (max - min)) * plotW
  const todayX = sx(todayTs)
  // 계획 대 실제 차이 (양수 = 계획이 높음 = 지연, 상단 Progress Gap 카드와 동일 부호)
  const gap = planToday - actToday

  const gridLines = [0, 25, 50, 75, 100].map((p) => ({ y: sy(p), p }))

  const xLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(min + ((max - min) / 6) * i)
      return { x: PAD.l + (i / 6) * plotW, label: `${d.getMonth() + 1}/${d.getDate()}` }
    })
  }, [min, max, plotW])

  const areaPath = (pts: { x: number; y: number }[]) =>
    pts.length
      ? `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${sy(0)} L ${pts[0].x} ${sy(0)} Z`
      : ''

  return (
    <div className="card p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">진척 곡선 (S-Curve)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            가로=날짜, 세로=누적 진척률(%) · 실제가 계획보다 아래에 있으면 지연 · 오늘 기준 {actToday.toFixed(1)}% vs 계획{' '}
            {planToday.toFixed(1)}%
          </p>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors" title="새로고침">
            <IconRefresh size={15} />
          </button>
        )}
      </div>

      {/* 요약 지표 스트립 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <div className="rounded-xl bg-emerald-50/70 ring-1 ring-emerald-100 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">실제 진척</div>
          <div className="text-xl font-bold text-emerald-700 mt-0.5">{actToday.toFixed(1)}%</div>
        </div>
        <div className="rounded-xl bg-indigo-50/70 ring-1 ring-indigo-100 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">계획 대비</div>
          <div className={`text-xl font-bold mt-0.5 ${gap > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
            {gap > 0 ? '+' : ''}{gap.toFixed(1)}%p
          </div>
        </div>
        <div className="rounded-xl bg-amber-50/70 ring-1 ring-amber-100 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">예측 완료일</div>
          <div className="text-lg font-bold text-amber-700 mt-0.5">
            {forecastFinish ? forecastFinish.slice(5) : (plannedFinish?.slice(5) ?? '—')}
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">예상 지연</div>
          <div className={`text-lg font-bold mt-0.5 ${(expectedDelayDays ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
            {(expectedDelayDays ?? 0) > 0 ? `+${expectedDelayDays}일` : '없음'}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="pg-act" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="pg-plan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* 그리드 */}
        {gridLines.map((g) => (
          <g key={g.p}>
            <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={PAD.l - 7} y={g.y + 3} fontSize={9.5} fill="#94a3b8" textAnchor="end">{g.p}%</text>
          </g>
        ))}
        {/* x축 라벨 */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PAD.b + 15} fontSize={9.5} fill="#94a3b8" textAnchor="middle">{l.label}</text>
        ))}

        {/* 지연 구간 음영 */}
        {delayRegion && (
          <g>
            <rect x={delayRegion.x0} y={sy(0)} width={delayRegion.x1 - delayRegion.x0} height={plotH + 4} fill="#fef3c7" opacity={0.4} />
            <line x1={delayRegion.x0} y1={sy(0)} x2={delayRegion.x0} y2={sy(100)} stroke="#f59e0b" strokeWidth={0.8} strokeDasharray="3,3" opacity={0.6} />
          </g>
        )}

        {/* 영역 채움 */}
        {viz.pts.plan.length > 0 && <path d={areaPath(viz.pts.plan)} fill="url(#pg-plan)" />}
        {viz.pts.actual.length > 0 && <path d={areaPath(viz.pts.actual)} fill="url(#pg-act)" />}

        {/* 선 */}
        {viz.pts.baseline.length > 0 && (
          <path d={smoothPath(viz.pts.baseline)} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5,4" fill="none" />
        )}
        {viz.pts.plan.length > 0 && (
          <path d={smoothPath(viz.pts.plan)} stroke="#6366f1" strokeWidth={2.2} fill="none" />
        )}
        {viz.pts.actual.length > 0 && (
          <path d={smoothPath(viz.pts.actual)} stroke="#10b981" strokeWidth={2.4} fill="none" />
        )}
        {viz.pts.forecast.length > 0 && (
          <path d={smoothPath(viz.pts.forecast)} stroke="#f59e0b" strokeWidth={2} strokeDasharray="6,4" fill="none" />
        )}

        {/* 오늘 라인 */}
        <g>
          <line x1={todayX} y1={sy(100)} x2={todayX} y2={sy(0)} stroke="#ef4444" strokeWidth={1.1} strokeDasharray="4,3" opacity={0.55} />
          <rect x={todayX - 17} y={sy(100) - 5} width={34} height={15} rx={7.5} fill="#ef4444" />
          <text x={todayX} y={sy(100) + 5.5} fontSize={8.5} fontWeight={700} fill="#fff" textAnchor="middle">오늘</text>
        </g>

        {/* 실제/계획 오늘 포인트 + 라벨 */}
        <g>
          <circle cx={todayX} cy={sy(planToday)} r={5} fill="#6366f1" stroke="#fff" strokeWidth={2} />
          <circle cx={todayX} cy={sy(actToday)} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />
        </g>

        {/* 오늘 값 라벨 (범위 밖일 경우 안쪽 배치) */}
        <g fontFamily="inherit">
          <text x={todayX - 8} y={Math.max(sy(planToday) - 9, 12)} fontSize={9.5} fontWeight={700} fill="#4f46e5" textAnchor="end">
            {planToday.toFixed(1)}%
          </text>
          <text x={todayX - 8} y={Math.min(sy(planToday) - 21, H - PAD.b)} fontSize={9.5} fontWeight={600} fill="#94a3b8" textAnchor="end">
            계획
          </text>
          <text x={todayX - 8} y={sy(actToday) - 9} fontSize={10} fontWeight={700} fill="#059669" textAnchor="end">
            {actToday.toFixed(1)}%
          </text>
          <text x={todayX - 8} y={sy(actToday) - 21} fontSize={9.5} fontWeight={600} fill="#059669" textAnchor="end">
            실제
          </text>
        </g>

        {/* 예측 종료 표시 */}
        {viz.pts.forecast.length > 0 && (
          <g>
            <circle cx={sx(t(forecastFinish) ?? max)} cy={sy(100)} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
            <text x={sx(t(forecastFinish) ?? max) - 6} y={sy(100) + 4} fontSize={9} fontWeight={700} fill="#f59e0b" textAnchor="end">
              {forecastFinish ? `예측 ${forecastFinish.slice(5)}` : ''}
            </text>
          </g>
        )}

        {/* 마일스톤 마커 */}
        {msPts.map((m, i) => (
          <g key={i}>
            <line x1={m.x} y1={sy(100)} x2={m.x} y2={m.y - 13} stroke="#a855f7" strokeWidth={1} opacity={0.5} />
            <path d={`M ${m.x - 4} ${m.y - 6} h 8 v 5 h -8 z`} fill="#a855f7" />
            <text x={m.x} y={m.y - 15} fontSize={8.5} fontWeight={700} fill="#a855f7" textAnchor="middle">
              {(m.name || '').slice(0, 8)}
            </text>
          </g>
        ))}
      </svg>

      {/* 범례 */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
        {viz.pts.baseline.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-300 inline-block" /> Baseline</span>
        )}
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-indigo-500 inline-block" /> 계획</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> 실제</span>
        {viz.pts.forecast.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-500 inline-block" /> 예측</span>
        )}
        {msPts.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-purple-500 inline-block" /> 마일스톤</span>
        )}
        {delayRegion && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-100 ring-1 ring-amber-300 inline-block" /> 지연 구간</span>
        )}
      </div>
    </div>
  )
}