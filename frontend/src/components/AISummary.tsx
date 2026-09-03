import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from './ui'

interface RiskItem {
  task_id?: number | string
  task_title?: string
  risk?: string
  description?: string
  type?: string
  severity?: string
}

interface RecItem {
  task_id?: number | string
  task_title?: string
  action?: string
  text?: string
}

interface RiskData {
  overall_risk?: string
  risks?: RiskItem[]
  recommendations?: (string | RecItem)[]
}

const typeLabel: Record<string, string> = {
  system_calc: '시스템 계산',
  user_opinion: '사용자 의견',
  ai_prediction: 'AI 예측',
}

const typeTone: Record<string, string> = {
  system_calc: 'blue',
  user_opinion: 'amber',
  ai_prediction: 'violet',
}

function toId(v?: number | string | null): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function TaskNameLink({ id, children }: { id: number; children: ReactNode }) {
  return (
    <Link
      to={`/tasks/${id}`}
      onClick={(e) => e.stopPropagation()}
      className="font-medium text-ink-900 hover:text-brand-600 hover:underline underline-offset-2"
    >
      {children}
    </Link>
  )
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function linkifyTasks(text: string, catalog: { id: number; title: string }[]): ReactNode {
  if (!text) return text
  const titles = [...catalog]
    .filter((t) => t.title.trim().length >= 2)
    .sort((a, b) => b.title.length - a.title.length)
  const titleToId = new Map<string, number>()
  for (const t of titles) {
    if (!titleToId.has(t.title)) titleToId.set(t.title, t.id)
  }
  const titleAlt = titles.map((t) => escapeRe(t.title)).join('|')
  const re = new RegExp(`${titleAlt ? `(${titleAlt})|` : ''}#(\\d+)`, 'g')
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) != null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const titleHit = m[1]
    const hashId = m[2] ? Number(m[2]) : null
    if (titleHit) {
      const id = titleToId.get(titleHit)
      nodes.push(id != null ? <TaskNameLink key={`t${i++}`} id={id}>{titleHit}</TaskNameLink> : titleHit)
    } else if (hashId != null && Number.isFinite(hashId)) {
      nodes.push(
        <TaskNameLink key={`t${i++}`} id={hashId}>
          #{hashId}
        </TaskNameLink>,
      )
    } else {
      nodes.push(m[0])
    }
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes.length ? nodes : text
}

function RecLine({ rec, catalog }: { rec: string | RecItem; catalog: { id: number; title: string }[] }) {
  if (typeof rec === 'string') return <>{linkifyTasks(rec, catalog)}</>
  const id = toId(rec.task_id)
  const action = rec.action || rec.text || ''
  if (id != null) {
    return (
      <>
        <TaskNameLink id={id}>{rec.task_title || `#${id}`}</TaskNameLink>
        {action ? ` — ${action}` : ''}
      </>
    )
  }
  const raw = [rec.task_title, action].filter(Boolean).join(' — ')
  return <>{linkifyTasks(raw, catalog)}</>
}

/** AI 위험 분석 결과(JSON)를 읽기 좋게 렌더링. JSON이 아니면 원문 표시. */
export function AISummary({
  content,
  tasks = [],
}: {
  content: string
  tasks?: { id: number; title: string }[]
}) {
  let data: RiskData | null = null
  try {
    data = JSON.parse(content)
  } catch {
    data = null
  }

  const structured = data && (data.overall_risk || (data.risks && data.risks.length > 0))
  const catalog = [
    ...tasks,
    ...(data?.risks ?? [])
      .map((r) => ({ id: toId(r.task_id), title: r.task_title || '' }))
      .filter((x): x is { id: number; title: string } => x.id != null && !!x.title),
  ]

  if (!structured) {
    return (
      <div
        className="ai-summary text-[13px] leading-relaxed text-ink-700 whitespace-pre-wrap"
        style={{ fontFamily: 'LGSmart, sans-serif' }}
      >
        {linkifyTasks(content, catalog)}
      </div>
    )
  }

  const risk = data!.overall_risk || 'NORMAL'
  const riskTone = risk === 'HIGH' ? 'red' : risk === 'WARNING' ? 'amber' : 'green'

  return (
    <div className="ai-summary space-y-4" style={{ fontFamily: 'LGSmart, sans-serif' }}>
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-slate-500">전반 위험도</span>
        <Badge tone={riskTone}>{risk}</Badge>
      </div>

      {data!.risks && data!.risks.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-slate-400 mb-2">위험 요소</div>
          <ul className="space-y-2">
            {data!.risks!.map((r, i) => {
              const id = toId(r.task_id)
              return (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-ink-700 leading-snug">
                      {r.type && (
                        <Badge tone={typeTone[r.type] || 'slate'}>{typeLabel[r.type] || r.type}</Badge>
                      )}
                      {r.task_title ? (
                        <>
                          {' '}
                          {id != null ? (
                            <TaskNameLink id={id}>{r.task_title}</TaskNameLink>
                          ) : (
                            <span className="font-medium">{r.task_title}</span>
                          )}
                          {id != null && <span className="text-slate-400 text-[11px]"> #{id}</span>}
                          {r.risk || r.description ? ` — ${r.risk || r.description}` : ''}
                        </>
                      ) : (
                        linkifyTasks(r.risk || r.description || '', catalog)
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {data!.recommendations && data!.recommendations.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-slate-400 mb-2">권장 대책</div>
          <ul className="space-y-1.5">
            {data!.recommendations!.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700 leading-snug">
                <span className="mt-0.5 text-brand-500 font-bold shrink-0">✓</span>
                <span className="min-w-0">
                  <RecLine rec={r} catalog={catalog} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
