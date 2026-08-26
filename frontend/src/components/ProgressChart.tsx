import { useMemo } from 'react'
import { IconRefresh } from './icons'

const DAY = 86400000

interface Props {
  plannedFinish?: string
  forecastFinish?: string
  planProgress: number
  actualProgress: number
  baselineStart?: string
  baselineEnd?: string
  planStart?: string
  planEnd?: string
  onRefresh?: () => void
}

function t(d?: string | null): number | null {
  if (!d) return null
  const ts = new Date(d + 'T00:00:00').getTime()
  return isNaN(ts) ? null : ts
}

export function ProgressChart({ plannedFinish, forecastFinish, planProgress, actualProgress, baselineStart, baselineEnd, planStart, planEnd, onRefresh }: Props) {
  const W = 640
  const H = 240
  const PAD = { l: 40, r: 14, t: 14, b: 28 }

  const { min, max, pts } = useMemo(() => {
    const dates = [
      t(baselineStart), t(baselineEnd), t(planStart), t(planEnd), t(plannedFinish), t(forecastFinish), Date.now(),
    ].filter((x): x is number => x != null)
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    const range = Math.max(max - min, DAY)
    const sx = (d: number) => PAD.l + ((d - min) / range) * (W - PAD.l - PAD.r)
    const sy = (p: number) => H - PAD.b - (p / 100) * (H - PAD.t - PAD.b)
    const line = (s?: number | null, e?: number | null) =>
      s != null && e != null ? [{ x: sx(s), y: sy(0) }, { x: sx(Math.max(s, e)), y: sy(100) }] : null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const planE = t(planEnd) ?? t(plannedFinish)
    const fE = t(forecastFinish)
    const delayRegion = planE != null && fE != null && fE > planE
      ? { x0: sx(planE), x1: sx(fE), y0: sy(0), y1: sy(100) }
      : null

    return {
      min,
      max,
      pts: {
        baseline: line(t(baselineStart), t(baselineEnd)),
        plan: line(t(planStart), t(planEnd)),
        forecast: line(today.getTime(), fE ?? today.getTime()),
        todayX: sx(today.getTime()),
        actualX: sx(today.getTime()),
        actualY: sy(actualProgress),
        planY: sy(planProgress),
        delayRegion,
      },
    }
  }, [baselineStart, baselineEnd, planStart, planEnd, plannedFinish, forecastFinish, planProgress, actualProgress])

  const xLabels = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const d = new Date(min + ((max - min) / 4) * i)
        return { x: PAD.l + (i / 4) * (W - PAD.l - PAD.r), label: `${d.getMonth() + 1}/${d.getDate()}` }
      }),
    [min, max],
  )

  const gridLines = [0, 25, 50, 75, 100].map((p) => ({
    y: H - PAD.b - (p / 100) * (H - PAD.t - PAD.b),
    p,
  }))

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-900">진척 곡선</h3>
        {onRefresh && (
          <button onClick={onRefresh} className="p-1.5 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors">
            <IconRefresh size={15} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-2">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-slate-300 inline-block" /> Baseline</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-brand-500 inline-block" /> 계획</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-emerald-500 inline-block" /> 실제</span>
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-amber-500 inline-block" /> 예측</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {gridLines.map((g) => (
          <g key={g.p}>
            <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="#f1f5f9" />
            <text x={PAD.l - 6} y={g.y + 3} fontSize={9} fill="#94a3b8" textAnchor="end">
              {g.p}%
            </text>
          </g>
        ))}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - PAD.b + 14} fontSize={9.5} fill="#94a3b8" textAnchor="middle">
            {l.label}
          </text>
        ))}

        {pts.delayRegion && (
          <rect
            x={pts.delayRegion.x0}
            y={pts.delayRegion.y0}
            width={pts.delayRegion.x1 - pts.delayRegion.x0}
            height={pts.delayRegion.y1 - pts.delayRegion.y0}
            fill="#fef3c7"
            opacity={0.5}
          />
        )}

        <path d={`M ${pts.baseline?.[0]?.x ?? 0} ${pts.baseline?.[0]?.y ?? 0} L ${pts.baseline?.[1]?.x ?? 0} ${pts.baseline?.[1]?.y ?? 0}`} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5,3" fill="none" />
        <path d={`M ${pts.plan?.[0]?.x ?? 0} ${pts.plan?.[0]?.y ?? 0} L ${pts.plan?.[1]?.x ?? 0} ${pts.plan?.[1]?.y ?? 0}`} stroke="#6366f1" strokeWidth={2} fill="none" />
        <path d={`M ${pts.forecast?.[0]?.x ?? 0} ${pts.forecast?.[0]?.y ?? 0} L ${pts.forecast?.[1]?.x ?? 0} ${pts.forecast?.[1]?.y ?? 0}`} stroke="#f59e0b" strokeWidth={1.8} strokeDasharray="5,3" fill="none" />

        <line x1={pts.todayX} y1={PAD.t} x2={pts.todayX} y2={H - PAD.b} stroke="#ef4444" strokeWidth={1.2} strokeDasharray="4,3" />
        <text x={pts.todayX + 4} y={PAD.t + 8} fontSize={9} fill="#ef4444" fontWeight={600}>
          오늘
        </text>

        {/* 계획 포인트 */}
        <circle cx={pts.actualX} cy={pts.planY} r={4} fill="#6366f1" stroke="#fff" strokeWidth={1.5} />
        {/* 실제 포인트 */}
        <circle cx={pts.actualX} cy={pts.actualY} r={5.5} fill="#10b981" stroke="#fff" strokeWidth={2} />
        <text x={pts.actualX + 10} y={pts.actualY + 4} fontSize={10} fontWeight={700} fill="#059669">
          {Math.round(actualProgress)}%
        </text>
        <text x={pts.actualX + 10} y={pts.planY + 4} fontSize={9} fill="#4f46e5">
          계획 {Math.round(planProgress)}%
        </text>
      </svg>
    </div>
  )
}