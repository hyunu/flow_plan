import { Link } from 'react-router-dom'
import { useDisplay } from '../auth/DisplayContext'
import { badgeChrome, badgeRadius, formatDelay, type StatusKey } from '../lib/displayPrefs'

export function InfoTip({
  text,
  className = '',
  corner = false,
}: {
  text: string
  className?: string
  corner?: boolean
}) {
  return (
    <span
      className={`group/tip ${corner ? 'absolute right-3 bottom-3' : 'relative'} inline-flex align-middle z-[5] ${className}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <span className="inline-flex w-[15px] h-[15px] rounded-full bg-slate-300 text-white text-[10px] leading-none items-center justify-center font-bold cursor-help select-none">
        i
      </span>
      <span
        className={`pointer-events-none absolute z-50 w-64 rounded-lg bg-neutral-900 text-white text-[11px] leading-relaxed font-normal px-3 py-2 shadow-xl border border-white/10 opacity-0 translate-y-[-2px] group-hover/tip:opacity-100 group-hover/tip:translate-y-0 transition-all duration-150 ${
          corner ? 'right-0 bottom-full mb-1.5' : 'left-1/2 -translate-x-1/2 top-full mt-1.5'
        }`}
      >
        {text}
      </span>
    </span>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
  delta,
  hint,
  to,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ReactNode
  tone?: 'default' | 'danger' | 'warn' | 'ok'
  delta?: { text: string; dir: 'up' | 'down' | 'flat' }
  hint?: string
  to?: string
}) {
  const tones: Record<string, { text: string; chip: string }> = {
    default: { text: 'text-ink-900', chip: 'bg-surface-100 text-ink-500' },
    danger: { text: 'text-red-600', chip: 'bg-red-50 text-red-500' },
    warn: { text: 'text-amber-600', chip: 'bg-amber-50 text-amber-500' },
    ok: { text: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-500' },
  }
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">{label}</span>
        {icon && <span className={`w-8 h-8 rounded-lg grid place-items-center ${tones[tone].chip}`}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-[26px] font-bold leading-none tracking-tight ${tones[tone].text}`}>{value}</span>
        {delta && (
          <span
            className={`text-[11px] font-semibold ${
              delta.dir === 'up' ? 'text-red-500' : delta.dir === 'down' ? 'text-emerald-500' : 'text-slate-400'
            }`}
          >
            {delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'} {delta.text}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-xs text-slate-400">{sub}</div>}
    </>
  )
  const cls = 'card p-5 transition-shadow'
  if (to) {
    return (
      <Link
        to={to}
        className={`${cls} hover:shadow-lift hover:ring-brand-200 group`}
        title={`${label} 상세 보기`}
      >
        {inner}
        {hint && <InfoTip text={hint} corner />}
        <span className="absolute bottom-2.5 right-5 text-[11px] text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
          상세 보기 →
        </span>
      </Link>
    )
  }
  return (
    <div className={`${cls} hover:shadow-lift`}>
      {inner}
      {hint && <InfoTip text={hint} corner />}
    </div>
  )
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const { prefs } = useDisplay()
  const v = Math.max(0, Math.min(100, value))
  const h = prefs.progressStyle === 'thick' ? 'h-2.5' : prefs.progressStyle === 'medium' ? 'h-2' : 'h-1.5'
  const fill =
    v >= 100 ? prefs.colors.completed : v >= 60 ? prefs.colors.in_progress : prefs.colors.not_started
  return (
    <div className={`${h} rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${prefs.progressStyle === 'striped' ? 'bg-[length:10px_10px]' : ''}`}
        style={{
          width: `${v}%`,
          backgroundColor: fill,
          backgroundImage:
            prefs.progressStyle === 'striped'
              ? 'repeating-linear-gradient(-45deg, rgba(255,255,255,.25) 0 4px, transparent 4px 8px)'
              : undefined,
        }}
      />
    </div>
  )
}

export function Chip({
  hex,
  children,
  className = '',
}: {
  hex: string
  children: React.ReactNode
  className?: string
}) {
  const { prefs } = useDisplay()
  return (
    <span
      className={`badge ${badgeRadius(prefs.badgeShape)} ${className}`}
      style={badgeChrome(hex, prefs.badgeFill)}
    >
      {children}
    </span>
  )
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) {
  const { prefs } = useDisplay()
  const fallback: Record<string, string> = {
    slate: prefs.colors.not_started,
    green: prefs.colors.completed,
    red: prefs.colors.delayed,
    amber: '#d97706',
    blue: prefs.colors.in_progress,
    violet: prefs.colors.critical,
  }
  return <Chip hex={fallback[tone] || prefs.colors.not_started}>{children}</Chip>
}

export function StatusBadge({ status }: { status: string }) {
  const { prefs } = useDisplay()
  if (!prefs.showStatus) return null
  const key = (status in prefs.labels ? status : 'not_started') as StatusKey
  const label = prefs.labels[key] || status
  const hex = prefs.colors[key] || prefs.colors.not_started
  if (status === 'completed' && prefs.doneMark === 'check') {
    return <Chip hex={hex}>✓ {label}</Chip>
  }
  if (status === 'completed' && prefs.doneMark === 'muted') {
    return <Chip hex={prefs.colors.not_started}>{label}</Chip>
  }
  if (status === 'completed' && prefs.doneMark === 'strike') {
    return (
      <Chip hex={hex}>
        <span className="line-through decoration-2">{label}</span>
      </Chip>
    )
  }
  return <Chip hex={hex}>{label}</Chip>
}

export function DelayMark({ days }: { days?: number | null }) {
  const { prefs } = useDisplay()
  if (!prefs.showDelay || days == null) return <span className="text-slate-300">—</span>
  if (days <= 0) {
    if (!prefs.showOnTrack) return <span className="text-slate-300">—</span>
    return <Chip hex={prefs.colors.onTrack}>{prefs.labels.onTrack}</Chip>
  }
  const text = formatDelay(days, prefs.delayFormat, prefs.labels.delayed)
  if (!text) return <span className="text-slate-300">—</span>
  return <Chip hex={prefs.colors.delayed}>{text}</Chip>
}

export function CriticalBadge() {
  const { prefs } = useDisplay()
  if (!prefs.showCritical) return null
  return <Chip hex={prefs.colors.critical}>{prefs.labels.critical}</Chip>
}

const priorityMap: Record<string, { label: string; colorKey: 'delayed' | 'critical' | 'in_progress' | 'not_started' }> = {
  CRITICAL: { label: '긴급', colorKey: 'delayed' },
  WARNING: { label: '주의', colorKey: 'critical' },
  ATTENTION: { label: '관심', colorKey: 'in_progress' },
  NORMAL: { label: '정상', colorKey: 'not_started' },
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { prefs } = useDisplay()
  const m = priorityMap[priority] || { label: priority, colorKey: 'not_started' as const }
  return <Chip hex={prefs.colors[m.colorKey]}>{m.label}</Chip>
}

export function PanelHeader({
  title,
  action,
  icon,
  hint,
}: {
  title: string
  action?: React.ReactNode
  icon?: React.ReactNode
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
        {icon && <span className="text-ink-400">{icon}</span>}
        {title}
      </h3>
      {hint && <InfoTip text={hint} corner />}
      {action}
    </div>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-400">{children}</div>
}