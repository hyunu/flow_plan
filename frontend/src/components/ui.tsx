import { Link } from 'react-router-dom'

export function InfoTip({ text, className = '', corner = false }: { text: string; className?: string; corner?: boolean }) {
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
        <div className="mt-2 text-[11px] text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
          상세 보기 →
        </div>
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
  const v = Math.max(0, Math.min(100, value))
  const color = v >= 100 ? 'bg-ink-900' : v >= 60 ? 'bg-slate-600' : v >= 30 ? 'bg-slate-500' : 'bg-slate-400'
  return (
    <div className={`h-1.5 rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${v}%` }} />
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    red: 'bg-red-50 text-red-600 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    blue: 'bg-brand-50 text-brand-700 ring-brand-200',
    violet: 'bg-violet-50 text-violet-600 ring-violet-200',
  }
  const base = 'badge ring-1'
  return <span className={`${base} ${tones[tone] || tones.slate}`}>{children}</span>
}

const statusMap: Record<string, { label: string; tone: string }> = {
  completed: { label: '완료', tone: 'green' },
  in_progress: { label: '진행 중', tone: 'blue' },
  not_started: { label: '미착수', tone: 'slate' },
  delayed: { label: '지연', tone: 'red' },
  blocked: { label: '차단', tone: 'red' },
}

export function StatusBadge({ status }: { status: string }) {
  const m = statusMap[status] || { label: status, tone: 'slate' }
  return <Badge tone={m.tone}>{m.label}</Badge>
}

const priorityMap: Record<string, { label: string; tone: string }> = {
  CRITICAL: { label: '긴급', tone: 'red' },
  WARNING: { label: '주의', tone: 'amber' },
  ATTENTION: { label: '관심', tone: 'blue' },
  NORMAL: { label: '정상', tone: 'slate' },
}

export function PriorityBadge({ priority }: { priority: string }) {
  const m = priorityMap[priority] || { label: priority, tone: 'slate' }
  return <Badge tone={m.tone}>{m.label}</Badge>
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