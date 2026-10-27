import { Link } from 'react-router-dom'
import type { PresenceEntry } from '../api/types'

/**
 * "지금 편집 중" 배너.
 *
 * - focusTaskId를 넘기면 그 태스크를 편집 중인 사람이 있을 때 앰버로 강하게 강조한다.
 * - 그 외에는 에메랄드 배너로 접속 중인 사람과 보고 있는 태스크를 보여준다.
 */
export function PresenceBar({
  entries,
  projectId,
  focusTaskId,
  className = '',
}: {
  entries: PresenceEntry[]
  projectId: number
  focusTaskId?: number
  className?: string
}) {
  if (entries.length === 0) return null
  const focused = focusTaskId != null ? entries.filter((e) => e.task_id === focusTaskId) : []
  const highlight = focused.length > 0
  const names = (focused.length ? focused : entries)
    .map((e) => e.user_name || `#${e.user_id}`)
    .join(', ')

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border-l-4 px-4 py-3 ring-1 shadow-sm animate-fade-in ${
        highlight ? 'border-amber-400 bg-amber-50 ring-amber-300' : 'border-emerald-400 bg-emerald-50 ring-emerald-300'
      } ${className}`}
    >
      <span className={`mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${highlight ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`} />
      <div className="min-w-0">
        <div className={`text-[13px] font-bold ${highlight ? 'text-amber-900' : 'text-emerald-900'}`}>
          {highlight ? `${names} 님이 이 태스크를 편집 중입니다` : `지금 ${entries.length}명이 함께 보고 있습니다`}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {entries.map((e) => (
            <Link
              key={e.user_id}
              to={e.task_id ? `/tasks/${e.task_id}` : `/projects/${projectId}/schedule`}
              className={`inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs text-ink-700 ring-1 transition-colors hover:text-brand-600 ${
                highlight && e.task_id === focusTaskId ? 'ring-amber-300' : 'ring-slate-200 hover:ring-brand-300'
              }`}
              title={e.task_id ? `Task #${e.task_id} 편집 중` : '프로젝트 보는 중'}
            >
              <span className="w-4 h-4 rounded-full bg-brand-100 text-brand-600 grid place-items-center text-[9px] font-bold">
                {(e.user_name || '?').slice(0, 1)}
              </span>
              {e.user_name || `#${e.user_id}`}
              {e.task_id ? ` · Task #${e.task_id}` : ' · 프로젝트'}
            </Link>
          ))}
        </div>
        <div className={`mt-1 text-[11px] ${highlight ? 'text-amber-700' : 'text-emerald-700/80'}`}>
          {highlight
            ? '동시에 저장하면 충돌을 감지해 덮어쓰지 않고 최신 내용을 다시 불러옵니다.'
            : '편집 중인 Task를 클릭하면 해당 태스크로 이동합니다.'}
        </div>
      </div>
    </div>
  )
}
