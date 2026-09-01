import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { Task } from '../api/types'
import { IconExpand, IconRefresh, IconShrink } from './icons'
import { InfoTip } from './ui'

const DAY = 86400000

/** CSS 변수는 `R G B` 트리플이라 SVG fill/stroke에는 rgb()로 감싼다. */
const cv = (name: string) => `rgb(var(--${name}))`

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
  forecastCurve?: { date: string; pct: number }[]
  progressSnapshots?: { date: string; actual: number; plan: number }[]
  onRefresh?: () => void
}

function t(d?: string | null): number | null {
  if (!d) return null
  const ts = new Date(d + 'T00:00:00').getTime()
  return isNaN(ts) ? null : ts
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 자정 기준으로 맞추되, bounds를 넘기지 않는다. */
function snapRange(
  minTs: number,
  maxTs: number,
  bounds: { min: number; max: number },
  minSpanDays = 3,
): { min: number; max: number } {
  const lo = startOfDay(bounds.min)
  const hi = startOfDay(bounds.max)
  let min = startOfDay(minTs)
  let max = startOfDay(maxTs)
  if (maxTs > max && max + DAY <= hi) max += DAY
  if (max <= min) max = Math.min(hi, min + DAY * minSpanDays)
  const minSpan = Math.min(DAY * minSpanDays, hi - lo)
  if (max - min < minSpan) {
    const mid = (min + max) / 2
    min = startOfDay(mid - minSpan / 2)
    max = min + minSpan
  }
  if (min < lo) {
    max = Math.min(hi, max + (lo - min))
    min = lo
  }
  if (max > hi) {
    min = Math.max(lo, min - (max - hi))
    max = hi
  }
  if (min < lo) min = lo
  if (max > hi) max = hi
  if (max <= min) return { min: lo, max: hi }
  return { min, max }
}

function coversFull(next: { min: number; max: number }, full: { min: number; max: number }): boolean {
  return startOfDay(next.min) <= startOfDay(full.min) && startOfDay(next.max) >= startOfDay(full.max)
}

function linearPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
}

export function ProgressChart({
  tasks,
  plannedFinish,
  forecastFinish,
  planProgress,
  actualProgress,
  planEnd,
  expectedDelayDays,
  milestones = [],
  planCurve,
  forecastCurve,
  progressSnapshots,
  onRefresh,
}: Props) {
  const W = 720
  const H = 316
  const PAD = { l: 46, r: 20, t: 18, b: 32 }

  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [expanded])

  // 전체(축소 전) 날짜 범위 — 확대/축소의 기준 뷰
  const globalRange = useMemo(() => {
    const todayTs = startOfDay(Date.now())
    const parentIds = new Set(tasks.filter((x) => x.parent_id != null).map((x) => x.parent_id!))
    const leaves = tasks.filter((tt) => !parentIds.has(tt.id))
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
    const min = startOfDay(Math.min(...rangeDates))
    const max = startOfDay(Math.max(...rangeDates))
    return { min, max: max <= min ? min + DAY : max }
  }, [tasks, plannedFinish, forecastFinish])

  // 확대/축소된 날짜 구간 (null = 전체)
  const [domain, setDomain] = useState<{ min: number; max: number } | null>(null)
  const [zoomRect, setZoomRect] = useState<{ x0: number; x1: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const dragRef = useRef<{
    startX: number
    mode: 'zoom' | 'pan'
    originMin: number
    originMax: number
  } | null>(null)

  const effMin = domain?.min ?? globalRange.min
  const effMax = domain?.max ?? globalRange.max
  const zoomed = domain != null

  const viz = useMemo(() => {
    const todayTs = startOfDay(Date.now())

    // 잎(leaf) 태스크만 사용 — 부모는 자식 작업량을 합산하므로 이중 계상 방지
    const parentIds = new Set(tasks.filter((x) => x.parent_id != null).map((x) => x.parent_id!))
    const leaves = tasks.filter((tt) => !parentIds.has(tt.id))

    const { min, max } = domain == null ? globalRange : snapRange(effMin, effMax, globalRange)
    // 양 끝 포함: 마지막 점이 오른쪽 축(max)에 오도록 +1
    const nDays = Math.max(Math.round((max - min) / DAY), 1)
    const nPts = nDays + 1
    const range = max - min
    const plotW = W - PAD.l - PAD.r
    const plotH = H - PAD.t - PAD.b
    const sx = (d: number) => PAD.l + ((d - min) / range) * plotW
    const sy = (p: number) => H - PAD.b - (p / 100) * plotH

    // 일 단위 누적 테이블 빌더
    const cumArr = (): number[] => new Array(nPts).fill(0)
    const toIdx = (d: number) => Math.min(Math.max(Math.round((d - min) / DAY), 0), nPts - 1)

    // 작업일(월~금) 여부/누적 — 백엔드 엔진(_schedule_progress)의 count_workdays와 동일 의미
    const isWk = Array.from({ length: nPts }, (_, i) => {
      const g = new Date(min + i * DAY).getDay()
      return g >= 1 && g <= 5
    })
    const wkAcc = new Array<number>(nPts).fill(0)
    {
      let c = 0
      for (let i = 0; i < nPts; i++) {
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
        for (let i = 0; i < nPts; i++) {
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
      ? new Map(planCurve.map((c) => [c.date, c.pct]))
      : null
    if (backendCurve) {
      const keys = [...backendCurve.keys()].sort()
      const lo = keys[0]
      const hi = keys[keys.length - 1]
      let lastPct = 0
      for (let i = 0; i < nPts; i++) {
        const key = dayKey(min + i * DAY)
        if (backendCurve.has(key)) lastPct = backendCurve.get(key)!
        else if (key < lo) lastPct = 0
        else if (key > hi) lastPct = backendCurve.get(hi) ?? 100
        planCum[i] = (lastPct * totalWork) / 100
      }
    } else {
      fillElapsedCum(planCum, 'plan_start', 'plan_end', true)
    }

    // ② Baseline S-Curve (동일 정의, baseline 일정 기준)
    const baseCum: number[] | null = leaves.some((x) => x.baseline_start && x.baseline_end) ? cumArr() : null
    if (baseCum) fillElapsedCum(baseCum, 'baseline_start', 'baseline_end', false)

    // ③ 실제: 일별 스냅샷이 있으면 그 시계열(없는 날은 직전 값 유지). 없으면 근사 배분.
    const todayIdx = toIdx(todayTs)
    const actualCum = cumArr()
    const snaps = (progressSnapshots ?? [])
      .map((s) => ({ ts: t(s.date), actual: s.actual }))
      .filter((s): s is { ts: number; actual: number } => s.ts != null)
      .sort((a, b) => a.ts - b.ts)
    if (snaps.length > 0 && snaps[0].ts < todayTs) {
      let k = 0
      let last = 0
      const firstTs = snaps[0].ts
      for (let i = 0; i < nPts; i++) {
        const ts = min + i * DAY
        while (k < snaps.length && snaps[k].ts <= ts) {
          last = snaps[k].actual
          k++
        }
        const pct = ts < firstTs ? 0 : ts > todayTs ? last : (ts === todayTs ? actualProgress : last)
        actualCum[i] = (pct / 100) * (totalWork > 0 ? totalWork : 1)
      }
    } else {
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
      for (let i = 0; i < nPts; i++) {
        ar += actualCum[i]
        actualCum[i] = ar
      }
    }
    let actToday = totalWork > 0 ? Math.min((actualCum[todayIdx] / totalWork) * 100, 100) : 0
    if (actualProgress > 0 && actToday > 0 && actualProgress !== actToday) {
      actualCum[todayIdx] = (actualProgress / 100) * totalWork
      actToday = actualProgress
    }

    // ④ 예측: 오늘 이후만. 날짜 키로 조회하고, 100%에 닿으면 더 이상 그리지 않는다.
    const foreEnd = t(forecastFinish) ?? t(plannedFinish) ?? max
    const foreCum: number[] | null = foreEnd > todayTs ? cumArr() : null
    if (foreCum) {
      const totalW = totalWork > 0 ? totalWork : 1
      const todayVal =
        todayTs >= min && todayTs <= max
          ? (actualCum[toIdx(todayTs)] ?? 0)
          : (actualProgress / 100) * totalW
      const backendFore =
        forecastCurve && forecastCurve.length > 0
          ? new Map(forecastCurve.map((c) => [c.date, c.pct]))
          : null
      let lastFore = actualProgress
      for (let i = 0; i < nPts; i++) {
        const ts = min + i * DAY
        if (ts <= todayTs) {
          foreCum[i] = todayVal
          continue
        }
        if (ts >= foreEnd) {
          foreCum[i] = totalW
          continue
        }
        if (backendFore) {
          const key = dayKey(ts)
          if (backendFore.has(key)) lastFore = backendFore.get(key)!
          foreCum[i] = (lastFore / 100) * totalW
        } else {
          const span = Math.max(foreEnd - todayTs, DAY)
          foreCum[i] = todayVal + ((ts - todayTs) / span) * (totalW - todayVal)
        }
      }
    }

    // ⑤ 지연 구간 음영: 엔진 계획 완료일(planned_finish) ~ 예측 완료일.
    //    작업 max(plan_end)나 마일스톤(오픈)을 쓰면 카드의 지연일과 구간이 어긋난다.
    const planE = t(plannedFinish) ?? t(planEnd)
    const foreE = t(forecastFinish)
    const delayRegion = planE != null && foreE != null && foreE > planE
      ? { x0: sx(planE), x1: sx(foreE), planTs: planE, foreTs: foreE }
      : null

    // ⑥ 오늘의 계획/실제 % (작업량 집계 기준 — 지표와 일치하도록 클램프)
    const planToday = totalWork > 0 ? Math.min((planCum[todayIdx] / totalWork) * 100, 100) : 0

    const yOf = (arr: number[], ts: number) =>
      totalWork > 0 ? sy((arr[toIdx(ts)] / totalWork) * 100) : sy(0)

    const firstRise = (arr: number[] | null) => {
      if (!arr || totalWork <= 0) return undefined
      for (let i = 0; i < nPts; i++) {
        if (arr[i] / totalWork >= 0.004) return min + i * DAY
      }
      return undefined
    }

    // 값이 같은 평탄 구간은 양 끝만 남겨 축에 붙은 긴 선·렌더 끊김을 줄인다.
    const toPts = (arr: number[] | null, xOff = 0, endTs?: number, startTs?: number) => {
      if (arr == null) return []
      const pts: { x: number; y: number }[] = []
      const push = (ts: number) => {
        pts.push({ x: sx(Math.min(Math.max(ts, min), max)) + xOff, y: yOf(arr, ts) })
      }
      const yAt = (ts: number) => yOf(arr, ts)
      let prevY: number | null = null
      if (startTs != null && startTs >= min && startTs <= max) {
        push(startTs)
        prevY = yAt(startTs)
      }
      for (let i = 0; i < nPts; i++) {
        const ts = min + i * DAY
        if (startTs != null && ts <= startTs) continue
        if (endTs != null && ts > endTs) break
        const y = yAt(ts)
        if (prevY == null || Math.abs(y - prevY) > 0.35 || i === nPts - 1) {
          push(ts)
          prevY = y
        }
      }
      if (endTs != null && endTs >= min && endTs <= max) {
        const last = pts[pts.length - 1]
        if (!last || Math.abs(last.x - (sx(endTs) + xOff)) > 0.5) push(endTs)
      }
      return pts
    }

    const msPts = milestones
      .map((m) => ({ m, ts: t(m.end_date) }))
      .filter((x): x is { m: (typeof milestones)[number]; ts: number } => x.ts != null && x.ts >= min && x.ts <= max)
      .map(({ m, ts }) => ({
        x: sx(ts),
        y: totalWork > 0 ? sy(Math.min(Math.max((planCum[toIdx(ts)] / totalWork) * 100, 4), 100)) : 4,
        name: m.name,
        ts,
      }))

    // 마일스톤은 계획 곡선을 따라 잇는다 (예측 곡선을 쓰면 오늘 이전가 오늘 실적으로 평평해져 선이 끊긴다).
    let msConnector: string | null = null
    if (msPts.length > 1) {
      const i0 = toIdx(msPts[0].ts)
      const i1 = toIdx(msPts[msPts.length - 1].ts)
      const seg: { x: number; y: number }[] = []
      let prevY: number | null = null
      for (let i = i0; i <= i1; i++) {
        const y = totalWork > 0 ? sy((planCum[i] / totalWork) * 100) : sy(0)
        if (prevY == null || Math.abs(y - prevY) > 0.35 || i === i1) {
          seg.push({ x: sx(min + i * DAY), y })
          prevY = y
        }
      }
      msConnector = linearPath(seg)
    }

    // 예측 마일스톤: 예상 지연만큼 날짜만 밀고, 진척률(동일 Y)은 계획 마일스톤과 동일하게 유지
    const delayMs = expectedDelayDays != null && expectedDelayDays > 0 ? expectedDelayDays * DAY : 0
    const fmsPts = delayMs > 0 && foreCum
      ? milestones
          .map((m) => ({ m, ts: t(m.end_date) }))
          .filter((x): x is { m: (typeof milestones)[number]; ts: number } => x.ts != null && x.ts + delayMs >= min && x.ts + delayMs <= max)
          .map(({ m, ts }) => ({
            x: sx(ts + delayMs),
            y: totalWork > 0 ? sy(Math.min(Math.max((planCum[toIdx(ts)] / totalWork) * 100, 4), 100)) : 4,
            name: m.name,
            ts: ts + delayMs,
          }))
      : []

    const lastFull = (arr: number[] | null) => {
      if (!arr || totalWork <= 0) return undefined
      let hit: number | undefined
      for (let i = 0; i < nPts; i++) {
        if (arr[i] / totalWork >= 0.999) {
          if (hit == null) hit = min + i * DAY
        } else {
          hit = undefined
        }
      }
      return hit
    }
    const planDrawEnd = lastFull(planCum)
    const baseDrawEnd = lastFull(baseCum)
    let foreDrawEnd = lastFull(foreCum)
    if (foreDrawEnd != null && todayTs > foreDrawEnd) foreDrawEnd = undefined
    if (foreDrawEnd == null) foreDrawEnd = foreEnd

    const snapPts = snaps
      .filter((s) => s.ts >= min && s.ts <= Math.min(max, todayTs))
      .map((s) => ({
        x: sx(s.ts),
        y: sy(s.ts === todayTs ? actToday : s.actual),
      }))

    return {
      min, max, todayTs, totalWork, planCum, baseCum, actualCum, foreCum,
      planToday, actToday, delayRegion, msPts, msConnector, snapPts, fmsPts,
      pts: {
        baseline: toPts(baseCum, 0.5, baseDrawEnd, firstRise(baseCum)),
        plan: toPts(planCum, 0, planDrawEnd, firstRise(planCum)),
        actual: toPts(actualCum, 0, todayTs, snaps.length > 0 && snaps[0].ts < todayTs ? snaps[0].ts : firstRise(actualCum)),
        forecast: toPts(foreCum, 0, foreDrawEnd, todayTs),
      },
    }
  }, [tasks, plannedFinish, forecastFinish, planEnd, milestones, planCurve, forecastCurve, progressSnapshots, actualProgress, expectedDelayDays, domain, effMin, effMax, globalRange])

  const { min, max, todayTs, actToday, delayRegion, msPts, msConnector, snapPts, fmsPts } = viz
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sy = (p: number) => H - PAD.b - (p / 100) * plotH
  const sx = (d: number) => PAD.l + ((d - min) / (max - min)) * plotW
  const todayX = sx(todayTs)
  const todayInView = todayTs >= min && todayTs <= max
  const todayNearRight = todayInView && todayX > PAD.l + plotW * 0.78
  const todayNearLeft = todayInView && todayX < PAD.l + plotW * 0.22
  const actLbl = {
    x: todayNearLeft ? todayX + 10 : todayX - 10,
    anchor: (todayNearLeft ? 'start' : 'end') as 'start' | 'end',
  }
  const planLbl = {
    x: todayNearRight ? todayX - 10 : todayX + 10,
    anchor: (todayNearRight ? 'end' : 'start') as 'start' | 'end',
  }

  // 드래그: 전체 뷰는 구간 확대, 확대 뷰는 좌우 이동
  const plotPX = (clientX: number, el: SVGRectElement) => {
    const cr = el.getBoundingClientRect()
    const x = PAD.l + ((clientX - cr.left) / cr.width) * plotW
    return Math.max(PAD.l, Math.min(W - PAD.r, x))
  }
  const panTo = (originMin: number, originMax: number, startX: number, nowX: number) => {
    const span = originMax - originMin
    const deltaTs = -((nowX - startX) / plotW) * span
    let min = originMin + deltaTs
    let max = originMax + deltaTs
    if (min < globalRange.min) {
      min = globalRange.min
      max = globalRange.min + span
    }
    if (max > globalRange.max) {
      max = globalRange.max
      min = globalRange.max - span
    }
    setDomain({ min, max })
  }
  const onPlotDown = (e: PointerEvent<SVGRectElement>) => {
    const x = plotPX(e.clientX, e.currentTarget)
    const boxZoom = !zoomed || e.shiftKey
    if (!boxZoom && domain) {
      dragRef.current = { startX: x, mode: 'pan', originMin: domain.min, originMax: domain.max }
      setPanning(true)
    } else {
      dragRef.current = { startX: x, mode: 'zoom', originMin: effMin, originMax: effMax }
      setZoomRect({ x0: x, x1: x })
    }
    ;(e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId)
  }
  const onPlotMove = (e: PointerEvent<SVGRectElement>) => {
    if (!dragRef.current) return
    const x = plotPX(e.clientX, e.currentTarget)
    if (dragRef.current.mode === 'pan') {
      panTo(dragRef.current.originMin, dragRef.current.originMax, dragRef.current.startX, x)
      return
    }
    setZoomRect({ x0: Math.min(dragRef.current.startX, x), x1: Math.max(dragRef.current.startX, x) })
  }
  const onPlotUp = () => {
    if (dragRef.current?.mode === 'pan' && domain) {
      const snapped = snapRange(domain.min, domain.max, globalRange)
      setDomain(coversFull(snapped, globalRange) ? null : snapped)
    } else if (dragRef.current && zoomRect) {
      const w0 = zoomRect.x0
      const w1 = zoomRect.x1
      if (w1 - w0 > 5) {
        const minD = effMin + ((w0 - PAD.l) / plotW) * (effMax - effMin)
        const maxD = effMin + ((w1 - PAD.l) / plotW) * (effMax - effMin)
        const snapped = snapRange(minD, maxD, globalRange)
        if (coversFull(snapped, globalRange)) setDomain(null)
        else if (snapped.max - snapped.min >= DAY * 3) setDomain(snapped)
      }
    }
    dragRef.current = null
    setZoomRect(null)
    setPanning(false)
  }
  const zoomAt = (factor: number) => {
    if (factor < 1 && domain == null) return
    const c = (effMin + effMax) / 2
    const half = (effMax - effMin) / 2 / factor
    if (factor > 1 && half < DAY * 3) return
    const snapped = snapRange(c - half, c + half, globalRange)
    if (factor < 1 && coversFull(snapped, globalRange)) setDomain(null)
    else setDomain(snapped)
  }
  // 계획 대비 = 실제 − 계획. +면 오늘 진척이 계획보다 높음.
  const delta = actualProgress - planProgress
  const calendarDelayDays = (() => {
    const a = t(plannedFinish)
    const b = t(forecastFinish)
    if (a == null || b == null) return expectedDelayDays ?? 0
    return Math.max(0, Math.round((b - a) / DAY))
  })()

  const gridLines = [0, 25, 50, 75, 100].map((p) => ({ y: sy(p), p }))

  const xLabels = useMemo(() => {
    const spanDays = Math.max(Math.round((max - min) / DAY), 1)
    const fmt = (ts: number) => {
      const d = new Date(ts)
      return `${d.getMonth() + 1}/${d.getDate()}`
    }
    if (spanDays <= 14) {
      return Array.from({ length: spanDays }, (_, i) => {
        const ts = min + i * DAY
        return {
          x: PAD.l + ((ts + DAY / 2 - min) / (max - min)) * plotW,
          label: fmt(ts),
          anchor: 'middle' as const,
        }
      })
    }
    const ticks = Array.from({ length: 7 }, (_, i) => min + ((max - min) / 6) * i)
    const extras = [t(plannedFinish), t(forecastFinish)].filter(
      (ts): ts is number => ts != null && ts >= min && ts <= max,
    )
    const merged: number[] = [...ticks]
    for (const e of extras) {
      if (merged.every((x) => Math.abs(x - e) > DAY * 4)) merged.push(e)
    }
    merged.sort((a, b) => a - b)
    return merged.map((ts, i, arr) => ({
      x: PAD.l + ((ts - min) / (max - min)) * plotW,
      label: fmt(ts),
      anchor: (i === 0 ? 'start' : i === arr.length - 1 ? 'end' : 'middle') as 'start' | 'end' | 'middle',
    }))
  }, [min, max, plotW, plannedFinish, forecastFinish])

  const areaPath = (pts: { x: number; y: number }[]) =>
    pts.length
      ? `${linearPath(pts)} L ${pts[pts.length - 1].x} ${sy(0)} L ${pts[0].x} ${sy(0)} Z`
      : ''

  const chartBody = (
    <>

      {/* 요약 지표 스트립 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {(
          [
            { label: '실제 진척', value: `${actualProgress.toFixed(1)}%` },
            {
              label: '계획 대비',
              value: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%p`,
            },
            {
              label: '예측 완료일',
              value: forecastFinish ? forecastFinish.slice(5) : (plannedFinish?.slice(5) ?? '—'),
            },
            {
              label: '예상 지연',
              value: calendarDelayDays > 0 ? `+${calendarDelayDays}일` : '0일',
              hint: plannedFinish && forecastFinish
                ? `계획 ${plannedFinish.slice(5)} → 예측 ${forecastFinish.slice(5)}`
                : undefined,
            },
          ] as { label: string; value: string; hint?: string }[]
        ).map((item) => (
          <div key={item.label} className="rounded-xl bg-surface-50 ring-1 ring-slate-200/80 px-3 py-2.5">
            <div className="text-xs font-semibold text-slate-400">{item.label}</div>
            <div className="mt-1.5 text-[22px] font-bold leading-none tracking-tight text-ink-900">{item.value}</div>
            {item.hint && <div className="mt-1.5 text-[10px] font-medium text-slate-400">{item.hint}</div>}
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="pg-act" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cv('ink-900')} stopOpacity="0.22" />
            <stop offset="100%" stopColor={cv('ink-900')} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="pg-plan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cv('slate-500')} stopOpacity="0.16" />
            <stop offset="100%" stopColor={cv('slate-500')} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="pg-zoom">
            <rect x={PAD.l} y={PAD.t - 8} width={plotW} height={plotH + 20} />
          </clipPath>
        </defs>

        {/* 가로 그리드 (축보다 연하게) */}
        {gridLines.map((g) => (
          <g key={g.p}>
            {g.p !== 0 && (
              <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke={cv('slate-400')} strokeWidth={1} opacity={0.28} />
            )}
            <text x={PAD.l - 8} y={g.y + 3.5} fontSize={11.5} fontWeight={600} fill={cv('ink-700')} textAnchor="end">{g.p}%</text>
          </g>
        ))}
        {/* X축 라벨 */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PAD.b + 16} fontSize={11.5} fontWeight={600} fill={cv('ink-700')} textAnchor={l.anchor}>{l.label}</text>
        ))}

        <g clipPath="url(#pg-zoom)">

        {/* 지연 구간 음영 */}
        {delayRegion && (
          <g>
            <rect x={delayRegion.x0} y={PAD.t} width={delayRegion.x1 - delayRegion.x0} height={plotH} fill={cv('slate-400')} opacity={0.18} />
            <line x1={delayRegion.x0} y1={sy(0)} x2={delayRegion.x0} y2={sy(100)} stroke={cv('slate-400')} strokeWidth={0.9} strokeDasharray="3,3" opacity={0.4} />
          </g>
        )}

        {/* 영역 채움 */}
        {viz.pts.plan.length > 0 && <path d={areaPath(viz.pts.plan)} fill="url(#pg-plan)" />}
        {viz.pts.actual.length > 0 && <path d={areaPath(viz.pts.actual)} fill="url(#pg-act)" />}

        {/* 선 — 명암(실제>계획>예측>Baseline) + 선 스타일로 구분 */}
        {viz.pts.baseline.length > 0 && (
          <path d={linearPath(viz.pts.baseline)} stroke={cv('slate-400')} strokeWidth={1.4} strokeDasharray="6,4" opacity={0.9} fill="none" />
        )}
        {viz.pts.plan.length > 0 && (
          <path d={linearPath(viz.pts.plan)} stroke={cv('slate-600')} strokeWidth={2.2} fill="none" />
        )}
        {viz.pts.actual.length > 0 && (
          <path d={linearPath(viz.pts.actual)} stroke={cv('ink-900')} strokeWidth={2.8} fill="none" />
        )}
        {snapPts.map((p, i) => (
          <circle key={`snap${i}`} cx={p.x} cy={p.y} r={3.2} fill={cv('ink-900')} stroke={cv('card')} strokeWidth={1.2} />
        ))}
        {viz.pts.forecast.length > 0 && (
          <path d={linearPath(viz.pts.forecast)} stroke={cv('slate-500')} strokeWidth={2} strokeLinecap="round" strokeDasharray="0.1,4.4" fill="none" />
        )}

        {/* 오늘 라인 */}
        {todayInView && (
          <line x1={todayX} y1={sy(100)} x2={todayX} y2={sy(0)} stroke={cv('slate-400')} strokeWidth={1.1} strokeDasharray="3,3" opacity={0.4} />
        )}

        {/* 지연 구간 양끝 날짜 — 100% 선이 아니라 음영 하단에 두어 오픈과 겹치지 않게 */}
        {delayRegion && (
          <g>
            {plannedFinish && (
              <text x={delayRegion.x0 + 4} y={sy(0) - 6} fontSize={10.5} fontWeight={700} fill={cv('slate-600')} textAnchor="start">
                {`계획 ${plannedFinish.slice(5)}`}
              </text>
            )}
            {forecastFinish && (
              <text x={delayRegion.x1 - 4} y={sy(0) - 6} fontSize={10.5} fontWeight={700} fill={cv('slate-600')} textAnchor="end">
                {`예측 ${forecastFinish.slice(5)}`}
              </text>
            )}
          </g>
        )}
        {viz.pts.forecast.length > 0 && (
          <circle
            cx={viz.pts.forecast[viz.pts.forecast.length - 1].x}
            cy={viz.pts.forecast[viz.pts.forecast.length - 1].y}
            r={4}
            fill={cv('slate-500')}
            stroke={cv('card')}
            strokeWidth={1.5}
          />
        )}

        {/* 마일스톤: 흰 테두리(다크에서 흰색, 라이트에서 진한 잉크) + 카드 배경 내부 */}
        {msConnector && (
          <path d={msConnector} stroke={cv('ink-900')} strokeWidth={1.1} strokeDasharray="3,3" opacity={0.55} fill="none" />
        )}
        {msPts.map((m, i) => {
          const executed = m.ts <= todayTs
          const nearToday = Math.abs(m.x - todayX) < 52
          const below = m.y <= 28 || nearToday
          const anchor = nearToday ? (m.x <= todayX ? 'end' : 'start') : 'middle'
          const tx = nearToday ? (m.x <= todayX ? m.x - 8 : m.x + 8) : m.x
          const ty = below ? m.y + 16 : m.y - 11
          return (
            <g key={i}>
              <circle
                cx={m.x}
                cy={m.y}
                r={5.5}
                fill={executed ? cv('ink-900') : cv('card')}
                stroke={executed ? cv('ink-900') : cv('slate-500')}
                strokeWidth={1.9}
              />
              <text x={tx} y={ty} fontSize={10.5} fontWeight={700} fill={executed ? cv('ink-900') : cv('slate-600')} textAnchor={anchor}>
                {(m.name || '').slice(0, 8)}
              </text>
            </g>
          )
        })}
        {/* 예측 마일스톤: 연한 핑크 테두리 (계획과 동일 스타일·크기, 컬러만 다름) */}
        {fmsPts.length > 1 && (
          <path
            d={fmsPts.map((m, i) => `${i === 0 ? 'M' : 'L'} ${m.x} ${m.y}`).join(' ')}
            stroke="#f472b6"
            strokeWidth={1.1}
            strokeDasharray="3,3"
            opacity={0.6}
            fill="none"
          />
        )}
        {fmsPts.map((m, i) => {
          const nearToday = Math.abs(m.x - todayX) < 52
          const below = m.y <= 28 || nearToday
          const anchor = nearToday ? (m.x <= todayX ? 'end' : 'start') : 'middle'
          const tx = nearToday ? (m.x <= todayX ? m.x - 8 : m.x + 8) : m.x
          const ty = below ? m.y + 16 : m.y - 11
          return (
            <g key={`f${i}`}>
              <circle cx={m.x} cy={m.y} r={5.5} fill={cv('card')} stroke="#f472b6" strokeWidth={1.9} />
              <text x={tx} y={ty} fontSize={10.5} fontWeight={700} fill="#f472b6" textAnchor={anchor}>
                {(m.name || '').slice(0, 8)}
              </text>
            </g>
          )
        })}
        </g>

        {/* 오늘 마커·라벨은 clip 밖에 두어 확대 시 잘리지 않게 */}
        {todayInView && (
          <g>
            <text
              x={todayX}
              y={PAD.t + 11}
              fontSize={11}
              fontWeight={700}
              fill={cv('ink-700')}
              textAnchor={todayNearRight ? 'end' : todayNearLeft ? 'start' : 'middle'}
            >
              오늘
            </text>
            <circle cx={todayX} cy={sy(planProgress)} r={5} fill={cv('slate-600')} stroke={cv('card')} strokeWidth={2} />
            <circle cx={todayX} cy={sy(actToday)} r={6} fill={cv('ink-900')} stroke={cv('card')} strokeWidth={2.2} />
            <text x={actLbl.x} y={sy(actToday) - 9} fontSize={11.5} fontWeight={700} fill={cv('ink-900')} textAnchor={actLbl.anchor}>
              {actualProgress.toFixed(1)}%
            </text>
            <text x={actLbl.x} y={sy(actToday) - 21} fontSize={10.5} fontWeight={600} fill={cv('ink-700')} textAnchor={actLbl.anchor}>
              실제
            </text>
            <text x={planLbl.x} y={sy(planProgress) - 9} fontSize={11} fontWeight={700} fill={cv('ink-700')} textAnchor={planLbl.anchor}>
              {planProgress.toFixed(1)}%
            </text>
            <text x={planLbl.x} y={sy(planProgress) - 21} fontSize={10.5} fontWeight={600} fill={cv('ink-700')} textAnchor={planLbl.anchor}>
              계획
            </text>
          </g>
        )}

        {(() => {
          const fp = viz.pts.forecast.find((p) => p.x > todayX + 28)
          if (!fp) return null
          return (
            <text x={fp.x} y={fp.y - 8} fontSize={10.5} fontWeight={600} fill={cv('slate-500')} textAnchor="start">
              예측
            </text>
          )
        })()}

        {/* 축 라인: X축(날짜 라벨 위), Y축(퍼센트 라벨 우측) — 데이터보다 뒤로 물러나게 */}
        <line x1={PAD.l} y1={sy(0)} x2={W - PAD.r} y2={sy(0)} stroke={cv('slate-400')} strokeWidth={1.15} opacity={0.55} />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={sy(0)} stroke={cv('slate-400')} strokeWidth={1.15} opacity={0.55} />
        {xLabels.map((l, i) => (
          <line key={`xtick-${i}`} x1={l.x} y1={sy(0)} x2={l.x} y2={sy(0) + 5} stroke={cv('slate-400')} strokeWidth={1} opacity={0.55} />
        ))}
        {gridLines.map((g) => (
          <line key={`ytick-${g.p}`} x1={PAD.l - 5} y1={g.y} x2={PAD.l} y2={g.y} stroke={cv('slate-400')} strokeWidth={1} opacity={0.55} />
        ))}

        {/* 확대 선택 영역 */}
        {zoomRect && (
          <rect
            x={zoomRect.x0}
            y={PAD.t - 4}
            width={Math.max(zoomRect.x1 - zoomRect.x0, 0)}
            height={plotH + 10}
            fill={cv('slate-500')}
            opacity={0.15}
            stroke={cv('slate-600')}
            strokeWidth={1}
            strokeDasharray="4,3"
          />
        )}

        {/* 드래그 확대 오버레이 */}
        <rect
          x={PAD.l}
          y={PAD.t - 8}
          width={plotW}
          height={plotH + 20}
          fill="transparent"
          style={{ cursor: zoomed ? (panning ? 'grabbing' : 'grab') : 'crosshair' }}
          onPointerDown={onPlotDown}
          onPointerMove={onPlotMove}
          onPointerUp={onPlotUp}
          onPointerCancel={onPlotUp}
          onDoubleClick={() => setDomain(null)}
        />
      </svg>

      {/* 범례 */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-ink-700 mt-3 pt-3 border-t border-slate-200">
        {viz.pts.baseline.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-4 h-0 border-t-2 border-dashed border-slate-400 inline-block" /> Baseline</span>
        )}
        <span className="flex items-center gap-1.5"><span className="w-4 h-0 border-t-2 border-solid border-slate-600 inline-block" /> 계획</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-ink-900 inline-block" /> 실제{progressSnapshots && progressSnapshots.length > 0 ? ' (일별 스냅샷)' : ''}</span>
        {viz.pts.forecast.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dotted border-slate-500 inline-block" /> 예측 (남은 작업·CPM)</span>
        )}
        {msPts.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block bg-card" style={{ border: '1.8px solid rgb(var(--chart-mark))' }} /> 마일스톤</span>
        )}
        {fmsPts.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block bg-card" style={{ border: '1.8px solid #f472b6' }} /> 예측 마일스톤</span>
        )}
        {delayRegion && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-400/30 ring-1 ring-slate-400 inline-block" /> 지연 구간</span>
        )}
      </div>
    </>
  )

  const chartHeader = (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">진척 곡선 (S-Curve)</h3>
        <p className="text-xs text-slate-400 mt-0.5">드래그로 확대 · 확대 후 드래그로 이동 · Shift+드래그로 재확대</p>
      </div>
      <div className="flex items-center gap-1">
        <InfoTip text="차트에서 원하는 날짜 구간을 드래그하면 확대됩니다. 확대된 뒤에는 드래그로 좌우 이동, Shift를 누른 채 드래그하면 다시 구간 확대입니다. − 버튼·더블클릭·전체보기로 원래 크기로 돌아갑니다." />
        {zoomed && (
          <button
            onClick={() => setDomain(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors text-xs"
            title="전체보기로 복귀"
          >
            전체보기
          </button>
        )}
        <button
          onClick={() => zoomAt(1.6)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors text-sm leading-none"
          title="확대"
          aria-label="차트 확대"
        >
          +
        </button>
        <button
          onClick={() => zoomAt(1 / 1.6)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors text-sm leading-none"
          title="축소"
          aria-label="차트 축소"
        >
          −
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors"
          title={expanded ? '축소하기' : '전체 화면으로 확대'}
          aria-label={expanded ? '차트 축소' : '차트 전체 화면'}
        >
          {expanded ? <IconShrink size={15} /> : <IconExpand size={15} />}
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors"
            title="새로고침"
          >
            <IconRefresh size={15} />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="card p-6">
        {chartHeader}
        {chartBody}
      </div>

      {/* 전체 화면 확대 오버레이 */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-page overflow-auto animate-fade-in">
          <div className="min-h-full w-full p-4 sm:p-6">
            <div className="card p-6">
              {chartHeader}
              {chartBody}
            </div>
          </div>
        </div>
      )}
    </>
  )
}