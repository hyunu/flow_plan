import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
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

function yAlong(pts: { x: number; y: number }[], x: number): number | null {
  if (pts.length === 0) return null
  if (x <= pts[0].x) return pts[0].y
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1)
      return a.y + (b.y - a.y) * t
    }
  }
  return pts[pts.length - 1].y
}

function placeMsLabel(
  m: { x: number; y: number; name?: string },
  box: { l: number; r: number; t: number; b: number },
  todayX: number,
  actY: number,
) {
  const name = (m.name || '').slice(0, 8)
  const w = Math.max(name.length * 11, 12)
  const nearToday = Math.abs(m.x - todayX) < 56
  const hideLbl = nearToday && Math.abs(m.y - actY) < 28
  const below = m.y < box.t + 16 || nearToday
  let anchor: 'start' | 'middle' | 'end' = 'middle'
  let tx = m.x
  const ty = Math.min(Math.max(below ? m.y + 16 : m.y - 11, box.t + 11), box.b - 4)
  if (m.x + w / 2 > box.r - 10 || m.x > box.r - 22) {
    anchor = 'end'
    tx = Math.min(m.x - 8, box.r - 2)
  } else if (m.x - w / 2 < box.l + 10 || m.x < box.l + 22) {
    anchor = 'start'
    tx = Math.max(m.x + 7, box.l)
  } else if (nearToday) {
    anchor = m.x <= todayX ? 'end' : 'start'
    tx = m.x <= todayX ? m.x - 8 : m.x + 8
  }
  return { hideLbl, name, tx, ty, anchor }
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
  forecastCurve,
  progressSnapshots,
  onRefresh,
}: Props) {
  const W = 720
  const H = 316
  const PAD = { l: 46, r: 36, t: 26, b: 32 }

  const [expanded, setExpanded] = useState(false)
  const [showSeries, setShowSeries] = useState({ baseline: false, plan: true, forecast: true })
  const toggleSeries = (key: keyof typeof showSeries) => {
    setShowSeries((s) => ({ ...s, [key]: !s[key] }))
  }

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
  const [hover, setHover] = useState<{ x: number; ts: number } | null>(null)
  const dragRef = useRef<{
    startX: number
    mode: 'zoom' | 'pan'
    originMin: number
    originMax: number
  } | null>(null)
  const plotRef = useRef<SVGRectElement | null>(null)
  const viewRef = useRef({ min: 0, max: 1, plotW: 1, domain: null as { min: number; max: number } | null, globalRange })

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
        if (backendCurve.has(key)) lastPct = Math.max(lastPct, backendCurve.get(key)!)
        else if (key < lo) lastPct = 0
        else if (key > hi) lastPct = Math.max(lastPct, backendCurve.get(hi) ?? lastPct)
        planCum[i] = (lastPct * totalWork) / 100
      }
    } else {
      fillElapsedCum(planCum, 'plan_start', 'plan_end', true)
    }

    // ② Baseline S-Curve (동일 정의, baseline 일정 기준)
    const baseCum: number[] | null = leaves.some((x) => x.baseline_start && x.baseline_end) ? cumArr() : null
    if (baseCum) fillElapsedCum(baseCum, 'baseline_start', 'baseline_end', false)

    // ③ 실제: 태스크별 진척을 착수~오늘(완료면 종료일) 작업일에 배분.
    //    일별 스냅샷만 이으면 대시보드를 연 날에만 값이 있어 0→급등이 된다.
    const todayIdx = toIdx(todayTs)
    const actualCum = cumArr()
    for (const tt of leaves) {
      const w = tt.workload > 0 ? tt.workload : 1
      const p = Math.min(100, Math.max(0, tt.effective_progress ?? 0))
      const start = t(tt.actual_start) ?? t(tt.plan_start)
      if (start == null || p <= 0 && tt.status !== 'completed') continue
      const done = tt.status === 'completed' || p >= 99.5
      let end = done ? (t(tt.actual_end) ?? t(tt.plan_end) ?? todayTs) : todayTs
      if (end > todayTs) end = todayTs
      if (end < start) end = start
      const iS = toIdx(start)
      const iE = Math.max(toIdx(end), iS)
      const total = wkCount(iS, iE)
      const target = done ? 100 : p
      if (total <= 0) {
        actualCum[Math.min(iE, todayIdx)] += (w * target) / 100
        continue
      }
      for (let i = 0; i < nPts; i++) {
        const d = min + i * DAY
        if (d > todayTs) break
        let f = 0
        if (d >= end) f = target
        else if (d >= start) f = (wkCount(iS, i) / total) * target
        actualCum[i] += (w * f) / 100
      }
    }
    const rawToday = actualCum[todayIdx]
    const pin = totalWork > 0 ? (actualProgress / 100) * totalWork : 0
    if (pin > 0 && rawToday > 0.0001) {
      const scale = pin / rawToday
      for (let i = 0; i <= todayIdx; i++) actualCum[i] *= scale
    } else if (pin > 0) {
      actualCum[todayIdx] = pin
    }
    const snaps = (progressSnapshots ?? [])
      .map((s) => ({ ts: t(s.date), actual: s.actual }))
      .filter((s): s is { ts: number; actual: number } => s.ts != null)
      .sort((a, b) => a.ts - b.ts)
    let actToday = totalWork > 0 ? Math.min((actualCum[todayIdx] / totalWork) * 100, 100) : 0
    if (actualProgress > 0) actToday = actualProgress

    // ④ 예측: 오늘 실제에서 시작. 지연된 계획 곡선을 따르되 실제 % 밑으로 내려가지 않음.
    const foreEnd = t(forecastFinish) ?? t(plannedFinish) ?? max
    const foreCum: number[] | null = foreEnd > todayTs ? cumArr() : null
    if (foreCum) {
      const totalW = totalWork > 0 ? totalWork : 1
      const todayVal =
        todayTs >= min && todayTs <= max
          ? (actualCum[toIdx(todayTs)] ?? 0)
          : (actualProgress / 100) * totalW
      const actPct = actualProgress
      const backendFore =
        forecastCurve && forecastCurve.length > 0
          ? new Map(forecastCurve.map((c) => [c.date, c.pct]))
          : null
      const fKeys = backendFore ? [...backendFore.keys()].sort() : []
      const sampleFore = (day: string): number | null => {
        if (!backendFore || fKeys.length === 0) return null
        if (backendFore.has(day)) return backendFore.get(day)!
        let prev: string | null = null
        let next: string | null = null
        for (const k of fKeys) {
          if (k <= day) prev = k
          if (k >= day) {
            next = k
            break
          }
        }
        const tp = prev ? t(prev) : null
        const tn = next ? t(next) : null
        const td = t(day)
        if (prev && next && tp != null && tn != null && td != null && tn !== tp) {
          const v0 = backendFore.get(prev)!
          const v1 = backendFore.get(next)!
          return v0 + ((v1 - v0) * (td - tp)) / (tn - tp)
        }
        if (prev) return backendFore.get(prev)!
        if (next) return backendFore.get(next)!
        return null
      }
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
          const raw = sampleFore(dayKey(ts))
          const pct = raw == null ? actPct : Math.max(actPct, raw)
          foreCum[i] = (Math.min(100, pct) / 100) * totalW
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
    const toPts = (arr: number[] | null, xOff = 0, endTs?: number, startTs?: number, minDy = 0.35) => {
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
        if (prevY == null || Math.abs(y - prevY) > minDy || i === nPts - 1) {
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
        y: totalWork > 0 ? sy(Math.min(Math.max((planCum[toIdx(ts)] / totalWork) * 100, 0), 100)) : sy(0),
        name: m.name,
        ts,
      }))

    // 실제 마일스톤: 완료된 항목만. 실적이 해당 계획 진척에 처음 도달한 날의 실제선 위.
    const amsPts = milestones.flatMap((m) => {
      const planTs = t(m.end_date)
      if (planTs == null || m.progress < 99.5 || totalWork <= 0) return []
      const targetPct = (planCum[toIdx(planTs)] / totalWork) * 100
      let hit: number | null = null
      for (let i = 0; i < nPts; i++) {
        const ts = min + i * DAY
        if (ts > todayTs) break
        if ((actualCum[i] / totalWork) * 100 >= Math.max(targetPct, 0.5)) {
          hit = ts
          break
        }
      }
      if (hit == null) hit = Math.min(Math.max(planTs, min), todayTs)
      if (hit < min || hit >= todayTs || hit > max) return []
      const apct = (actualCum[toIdx(hit)] / totalWork) * 100
      return [{
        x: sx(hit),
        y: sy(Math.min(Math.max(apct, 0), 100)),
        name: m.name,
        ts: hit,
      }]
    })

    // 예측 마일스톤: 아직 남은 마일스톤만, 예상 지연만큼 날짜를 민다.
    // 이미 지난/완료된 마일스톤까지 밀면 오늘 실적점과 겹친다.
    const delayMs = expectedDelayDays != null && expectedDelayDays > 0 ? expectedDelayDays * DAY : 0
    const fmsPts = delayMs > 0 && foreCum
      ? milestones
          .map((m) => ({ m, ts: t(m.end_date) }))
          .filter((x): x is { m: (typeof milestones)[number]; ts: number } => {
            if (x.ts == null || x.m.progress >= 99.5) return false
            const fts = x.ts + delayMs
            return fts > todayTs && fts >= min && fts <= max
          })
          .map(({ m, ts }) => {
            const fts = ts + delayMs
            const fpct = totalWork > 0 ? (foreCum[toIdx(fts)] / totalWork) * 100 : 0
            return {
              x: sx(fts),
              y: sy(Math.min(Math.max(fpct, 0), 100)),
              name: m.name,
              ts: fts,
            }
          })
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
      .filter((s) => s.ts >= min && s.ts < Math.min(max, todayTs))
      .map((s) => ({
        x: sx(s.ts),
        y: sy(s.actual),
      }))

    const todayPt = todayTs >= min && todayTs <= max
      ? { x: sx(todayTs), y: sy(actToday) }
      : null

    const forecastPts = toPts(foreCum, 0, foreEnd, todayTs, 0)
    if (todayPt && forecastPts.length > 0) {
      forecastPts[0] = { x: todayPt.x, y: todayPt.y }
    }

    return {
      min, max, todayTs, totalWork, planCum, baseCum, actualCum, foreCum,
      planToday, actToday, delayRegion, msPts, amsPts, snapPts, fmsPts, todayPt,
      pts: {
        baseline: toPts(baseCum, 0.5, baseDrawEnd, firstRise(baseCum)),
        plan: toPts(planCum, 0, planDrawEnd, firstRise(planCum)),
        actual: toPts(actualCum, 0, todayTs, min),
        forecast: forecastPts,
      },
    }
  }, [tasks, plannedFinish, forecastFinish, planEnd, milestones, planCurve, forecastCurve, progressSnapshots, actualProgress, expectedDelayDays, domain, effMin, effMax, globalRange])

  const { min, max, todayTs, totalWork, planCum, baseCum, actualCum, foreCum, actToday, delayRegion, msPts, amsPts, snapPts, fmsPts, todayPt } = viz
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b
  const sy = (p: number) => H - PAD.b - (p / 100) * plotH
  const sx = (d: number) => PAD.l + ((d - min) / (max - min)) * plotW
  const todayX = todayPt?.x ?? sx(todayTs)
  const todayInView = todayTs >= min && todayTs <= max
  const todayNearRight = todayInView && todayX > PAD.l + plotW * 0.78
  const todayNearLeft = todayInView && todayX < PAD.l + plotW * 0.22

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
    setHover(null)
  }
  const onPlotMove = (e: PointerEvent<SVGRectElement>) => {
    const x = plotPX(e.clientX, e.currentTarget)
    if (!dragRef.current) {
      const ts = startOfDay(min + ((x - PAD.l) / plotW) * (max - min))
      setHover({ x, ts: Math.min(Math.max(ts, min), max) })
      return
    }
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

  const hoverInfo = useMemo(() => {
    if (!hover || totalWork <= 0) return null
    const idx = (arr: number[] | null) => {
      if (!arr || arr.length === 0) return null
      const i = Math.min(Math.max(Math.round((hover.ts - min) / DAY), 0), arr.length - 1)
      return Math.min(100, Math.max(0, (arr[i] / totalWork) * 100))
    }
    const d = new Date(hover.ts)
    const dateLabel = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
    const rows: { label: string; value: string; color: string }[] = []
    if (showSeries.baseline && baseCum) {
      const v = idx(baseCum)
      if (v != null) rows.push({ label: '최초계획', value: `${v.toFixed(1)}%`, color: '#3b82f6' })
    }
    if (showSeries.plan) {
      const v = idx(planCum)
      if (v != null) rows.push({ label: '계획', value: `${v.toFixed(1)}%`, color: 'rgb(var(--slate-500))' })
    }
    {
      const actTs = hover.ts <= todayTs ? hover.ts : todayTs
      const i = Math.min(Math.max(Math.round((actTs - min) / DAY), 0), actualCum.length - 1)
      const v = Math.min(100, Math.max(0, (actualCum[i] / totalWork) * 100))
      rows.push({ label: '실적', value: `${v.toFixed(1)}%`, color: 'rgb(var(--ink-900))' })
    }
    if (showSeries.forecast && hover.ts >= todayTs && foreCum) {
      const v = idx(foreCum)
      if (v != null) rows.push({ label: '예측', value: `${v.toFixed(1)}%`, color: '#dc2626' })
    }
    const marks = [
      ...amsPts,
      ...(showSeries.plan ? msPts : []),
      ...(showSeries.forecast ? fmsPts : []),
    ]
      .filter((m) => Math.abs(m.ts - hover.ts) < DAY * 1.5)
      .map((m) => m.name)
    return { dateLabel, rows, marks: [...new Set(marks)] }
  }, [hover, totalWork, min, planCum, baseCum, actualCum, foreCum, showSeries, todayTs, amsPts, msPts, fmsPts])
  const zoomAround = (factor: number, anchorTs?: number) => {
    if (factor < 1 && domain == null) return
    const span = effMax - effMin
    const nextSpan = span / factor
    if (factor > 1 && nextSpan < DAY * 3) return
    const anchor = anchorTs ?? hover?.ts ?? (effMin + effMax) / 2
    const t = span > 0 ? (anchor - effMin) / span : 0.5
    const ratio = Math.min(Math.max(t, 0), 1)
    const snapped = snapRange(anchor - ratio * nextSpan, anchor + (1 - ratio) * nextSpan, globalRange)
    if (factor < 1 && coversFull(snapped, globalRange)) setDomain(null)
    else setDomain(snapped)
  }

  viewRef.current = { min, max, plotW, domain, globalRange }

  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { min, max, plotW, domain, globalRange } = viewRef.current
      const cr = el.getBoundingClientRect()
      const x = PAD.l + ((e.clientX - cr.left) / cr.width) * plotW
      const px = Math.max(PAD.l, Math.min(W - PAD.r, x))
      const ts = min + ((px - PAD.l) / plotW) * (max - min)
      const factor = e.deltaY > 0 ? 1 / 1.18 : 1.18
      if (factor < 1 && domain == null) return
      const span = max - min
      const nextSpan = span / factor
      if (factor > 1 && nextSpan < DAY * 3) return
      const t = span > 0 ? (ts - min) / span : 0.5
      const ratio = Math.min(Math.max(t, 0), 1)
      const snapped = snapRange(ts - ratio * nextSpan, ts + (1 - ratio) * nextSpan, globalRange)
      if (factor < 1 && coversFull(snapped, globalRange)) setDomain(null)
      else setDomain(snapped)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [expanded])
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

  const actualLinePts = useMemo(() => {
    const withOrigin = (() => {
      if (snapPts.length === 0) return viz.pts.actual
      const first = viz.pts.actual[0]
      if (!first) return snapPts
      const sameStart = Math.abs(first.x - snapPts[0].x) < 0.5 && Math.abs(first.y - snapPts[0].y) < 0.5
      return sameStart ? snapPts : [first, ...snapPts]
    })()
    if (!todayPt) return withOrigin
    const body = withOrigin.filter((p) => Math.abs(p.x - todayPt.x) > 0.5)
    return [...body, todayPt]
  }, [snapPts, viz.pts.actual, todayPt])

  const amsOnLine = useMemo(
    () =>
      amsPts.map((m) => {
        const y = yAlong(actualLinePts, m.x)
        return y == null ? m : { ...m, y }
      }),
    [amsPts, actualLinePts],
  )

  const chartBody = (
    <>

      <div className="flex items-center gap-2.5 mb-2 text-[12px] font-normal tracking-tight">
        {(
          [
            { key: 'baseline' as const, label: '최초계획' },
            { key: 'plan' as const, label: '계획' },
            { key: 'forecast' as const, label: '예측' },
          ] as const
        ).map((tag, i) => {
          const on = showSeries[tag.key]
          return (
            <span key={tag.key} className="inline-flex items-center gap-2.5">
              {i > 0 && <span className="text-slate-300 select-none" aria-hidden>·</span>}
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggleSeries(tag.key)}
                className={`transition-colors ${on ? 'text-ink-700' : 'text-slate-400 hover:text-slate-500'}`}
              >
                {tag.label}
              </button>
            </span>
          )
        })}
      </div>

      <div className="relative">
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
            <text x={PAD.l - 8} y={g.y + 3.5} fontSize={12.5} fontWeight={400} fill={cv('ink-700')} textAnchor="end">{g.p}%</text>
          </g>
        ))}
        {/* X축 라벨 */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PAD.b + 16} fontSize={12.5} fontWeight={400} fill={cv('ink-700')} textAnchor={l.anchor}>{l.label}</text>
        ))}

        <g clipPath="url(#pg-zoom)">

        {/* 지연 구간 음영 */}
        {delayRegion && showSeries.forecast && (
          <g>
            <rect x={delayRegion.x0} y={PAD.t} width={delayRegion.x1 - delayRegion.x0} height={plotH} fill={cv('slate-400')} opacity={0.18} />
            <line x1={delayRegion.x0} y1={sy(0)} x2={delayRegion.x0} y2={sy(100)} stroke={cv('slate-400')} strokeWidth={0.9} strokeDasharray="3,3" opacity={0.4} />
          </g>
        )}

        {/* 영역 채움 — 실제만. 계획 채움은 미래 실적으로 오인됨 */}
        {actualLinePts.length > 0 && <path d={areaPath(actualLinePts)} fill="url(#pg-act)" />}

        {/* 오늘 라인 — 곡선·도트보다 아래 */}
        {todayInView && (
          <line x1={todayX} y1={sy(100)} x2={todayX} y2={sy(0)} stroke="#3b82f6" strokeWidth={1.2} />
        )}

        {showSeries.baseline && viz.pts.baseline.length > 0 && (
          <path d={linearPath(viz.pts.baseline)} stroke="#3b82f6" strokeWidth={0.9} strokeDasharray="2,3" fill="none" />
        )}
        {showSeries.plan && viz.pts.plan.length > 0 && (
          <path d={linearPath(viz.pts.plan)} stroke={cv('slate-400')} strokeWidth={1} strokeDasharray="1.6,2.8" fill="none" />
        )}
        {showSeries.forecast && viz.pts.forecast.length > 0 && (
          <path d={linearPath(viz.pts.forecast)} stroke="#dc2626" strokeWidth={1} strokeDasharray="1.6,2.8" fill="none" />
        )}
        {actualLinePts.length > 0 && (
          <path d={linearPath(actualLinePts)} stroke={cv('ink-900')} strokeWidth={2} fill="none" />
        )}
        {snapPts.map((p, i) => (
          <circle key={`snap${i}`} cx={p.x} cy={p.y} r={3.4} fill={cv('card')} stroke={cv('ink-900')} strokeWidth={1.2} />
        ))}
        </g>

        {/* 마커·글자는 clip 밖에 두어 플롯 가장자리에서 잘리지 않게 */}
        {showSeries.forecast && viz.pts.forecast.length > 0 && (
          <circle
            cx={viz.pts.forecast[viz.pts.forecast.length - 1].x}
            cy={viz.pts.forecast[viz.pts.forecast.length - 1].y}
            r={4}
            fill="#dc2626"
            stroke={cv('card')}
            strokeWidth={1.5}
          />
        )}
        {showSeries.plan && msPts.map((m, i) => (
          <circle key={`ms-${i}`} cx={m.x} cy={m.y} r={5} fill={cv('card')} stroke={cv('slate-400')} strokeWidth={1.7} />
        ))}
        {amsOnLine.map((m, i) => (
          <circle key={`ams-${i}`} cx={m.x} cy={m.y} r={5} fill={cv('card')} stroke={cv('ink-900')} strokeWidth={1.7} />
        ))}
        {showSeries.forecast && fmsPts.map((m, i) => (
          <circle key={`fms-${i}`} cx={m.x} cy={m.y} r={5} fill={cv('card')} stroke="#dc2626" strokeWidth={1.7} />
        ))}

        {/* 글자는 clip 밖에 두어 플롯 가장자리에서 잘리지 않게 */}
        {delayRegion && showSeries.forecast && (
          <g>
            {plannedFinish && showSeries.plan && (
              <text x={Math.min(delayRegion.x0 + 4, W - PAD.r)} y={sy(0) - 6} fontSize={11.5} fontWeight={400} fill={cv('slate-600')} textAnchor="start">
                {`계획 ${plannedFinish.slice(5)}`}
              </text>
            )}
            {forecastFinish && (
              <text x={Math.max(delayRegion.x1 - 4, PAD.l)} y={sy(0) - 6} fontSize={11.5} fontWeight={400} fill={cv('slate-600')} textAnchor="end">
                {`예측 ${forecastFinish.slice(5)}`}
              </text>
            )}
          </g>
        )}
        {(() => {
          const box = { l: PAD.l, r: W - PAD.r, t: PAD.t, b: H - PAD.b }
          const actY = sy(actToday)
          return (
            <>
              {showSeries.plan && msPts.map((m, i) => {
                const L = placeMsLabel(m, box, todayX, actY)
                if (L.hideLbl) return null
                return (
                  <text key={`msl-${i}`} x={L.tx} y={L.ty} fontSize={11} fontWeight={400} fill={cv('slate-500')} textAnchor={L.anchor}>
                    {L.name}
                  </text>
                )
              })}
              {amsOnLine.map((m, i) => {
                const L = placeMsLabel(m, box, todayX, actY)
                if (L.hideLbl) return null
                const nearPlan = showSeries.plan && msPts.some((p) => p.name === m.name && Math.abs(p.x - m.x) < 22)
                if (nearPlan) return null
                return (
                  <text key={`amsl-${i}`} x={L.tx} y={L.ty} fontSize={11} fontWeight={400} fill={cv('ink-700')} textAnchor={L.anchor}>
                    {L.name}
                  </text>
                )
              })}
              {showSeries.forecast && fmsPts.map((m, i) => {
                const L = placeMsLabel(m, box, todayX, actY)
                if (L.hideLbl) return null
                return (
                  <text key={`fmsl-${i}`} x={L.tx} y={L.ty} fontSize={11} fontWeight={400} fill="#dc2626" textAnchor={L.anchor}>
                    {L.name}
                  </text>
                )
              })}
            </>
          )
        })()}

        {/* 오늘 마커·라벨은 clip 밖에 두어 확대 시 잘리지 않게 */}
        {todayInView && (
          <g>
            <text
              x={todayX}
              y={PAD.t + 11}
              fontSize={12}
              fontWeight={400}
              fill="#3b82f6"
              textAnchor={todayNearRight ? 'end' : todayNearLeft ? 'start' : 'middle'}
            >
              오늘
            </text>
          </g>
        )}

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

        {hover && hoverInfo && !panning && !zoomRect && (
          <line
            x1={hover.x}
            y1={PAD.t}
            x2={hover.x}
            y2={sy(0)}
            stroke={cv('slate-400')}
            strokeWidth={1}
            opacity={0.45}
          />
        )}

        {/* 드래그 확대 오버레이 */}
        <rect
          ref={plotRef}
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
          onPointerLeave={() => setHover(null)}
          onDoubleClick={() => setDomain(null)}
        />
      </svg>
      {hover && hoverInfo && !panning && !zoomRect && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-card/95 px-2.5 py-2 text-[11px] shadow-lift ring-1 ring-slate-200/80"
          style={{
            left: hover.x > W * 0.62 ? undefined : `${(hover.x / W) * 100}%`,
            right: hover.x > W * 0.62 ? `${100 - (hover.x / W) * 100}%` : undefined,
            top: 8,
            marginLeft: hover.x > W * 0.62 ? undefined : 8,
            marginRight: hover.x > W * 0.62 ? 8 : undefined,
          }}
        >
          <div className="text-ink-800">{hoverInfo.dateLabel}</div>
          <div className="mt-1.5 space-y-0.5">
            {hoverInfo.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                  {r.label}
                </span>
                <span className="tabular-nums text-ink-800">{r.value}</span>
              </div>
            ))}
          </div>
          {hoverInfo.marks.length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-slate-500">
              {hoverInfo.marks.join(' · ')}
            </div>
          )}
        </div>
      )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-ink-700 mt-3 pt-3 border-t border-slate-200">
        {showSeries.baseline && viz.pts.baseline.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-4 h-0 border-t border-dashed inline-block" style={{ borderColor: '#3b82f6' }} /> Baseline (최초 계획)</span>
        )}
        {showSeries.plan && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dotted border-slate-400 inline-block" /> 계획
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0 border-t-[2px] border-solid border-ink-900 inline-block" /> 실제
        </span>
        {showSeries.forecast && viz.pts.forecast.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dotted inline-block" style={{ borderColor: '#dc2626' }} /> 예측 (지연 반영)
          </span>
        )}
        {showSeries.plan && msPts.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block bg-card" style={{ border: '1.7px solid rgb(var(--slate-400))' }} /> 계획 마일스톤</span>
        )}
        {amsOnLine.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block bg-card" style={{ border: '1.7px solid rgb(var(--ink-900))' }} /> 실제 마일스톤</span>
        )}
        {showSeries.forecast && fmsPts.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block bg-card" style={{ border: '1.7px solid #dc2626' }} /> 예측 마일스톤</span>
        )}
        {delayRegion && showSeries.forecast && (
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-slate-400/30 ring-1 ring-slate-400 inline-block" /> 지연 구간</span>
        )}
      </div>
    </>
  )

  const chartHeader = (
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">진척 곡선 (S-Curve)</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          휠로 커서 기준 확대 · 드래그로 확대 · 확대 후 드래그로 이동 ·{' '}
          <Link to="/manual#curve" className="text-brand-600 hover:underline">
            선 읽는 법 (설명서)
          </Link>
        </p>
      </div>
      <div className="flex items-center gap-1">
        <InfoTip text="네 선은 의미가 다릅니다. Baseline=최초 일정, 계획=지금 적어 둔 날짜 페이스, 실제=완료된 일의 %, 예측=앞으로 끝나는 시점입니다. 설명서 「진척 곡선」에 표와 예시가 있습니다. 드래그로 확대, 확대 후 이동, Shift+드래그로 재확대, 전체보기·더블클릭으로 복귀합니다." />
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
          onClick={() => zoomAround(1.6)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors text-sm leading-none"
          title="확대"
          aria-label="차트 확대"
        >
          +
        </button>
        <button
          onClick={() => zoomAround(1 / 1.6)}
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