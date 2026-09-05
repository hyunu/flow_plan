import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from './ui'
import { RichText } from './RichText'

interface LineItem {
  task_id?: number | string
  task_title?: string
  text?: string
  tone?: string
  impact_days?: number
}

interface RiskData {
  brief?: string
  needs_detail?: boolean
  problems?: LineItem[]
  remedies?: LineItem[]
  audience_label?: string
  for_you?: LineItem[]
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

function Line({ item, catalog }: { item: LineItem; catalog: { id: number; title: string }[] }) {
  const id = toId(item.task_id)
  void catalog
  return (
    <span>
      {typeof item.impact_days === 'number' && item.impact_days > 0 && (
        <Badge tone="red">이 노드 → 전체 +{item.impact_days}일</Badge>
      )}
      {item.task_title && id != null ? (
        <>
          {' '}
          <TaskNameLink id={id}>{item.task_title}</TaskNameLink>
          {item.text ? (
            <>
              {' — '}
              <RichText text={item.text} />
            </>
          ) : (
            ''
          )}
        </>
      ) : (
        <> <RichText text={item.text || ''} /></>
      )}
    </span>
  )
}

/** 한두 줄 전체 요약. 문제가 있을 때만 문제점·개선책과 개인 경고를 펼친다. */
export function AISummary({
  content,
  tasks = [],
}: {
  content: string
  tasks?: { id: number; title: string }[]
}) {
  const [open, setOpen] = useState(false)
  let data: RiskData | null = null
  try {
    data = JSON.parse(content)
  } catch {
    data = null
  }

  if (!data?.brief && !(data?.for_you?.length)) {
    return (
      <div
        className="ai-summary text-[13px] leading-relaxed text-ink-700 whitespace-pre-wrap"
        style={{ fontFamily: 'LGSmart, sans-serif' }}
      >
        {linkifyTasks(content, tasks)}
      </div>
    )
  }

  const problems = data?.problems ?? []
  const remedies = data?.remedies ?? []
  const mine = data?.for_you ?? []
  const canExpand = Boolean(data?.needs_detail && (problems.length || remedies.length || mine.length))

  return (
    <div className="ai-summary space-y-3" style={{ fontFamily: 'LGSmart, sans-serif' }}>
      {data?.brief && (
        <p className="text-[14px] text-ink-800 leading-relaxed">
          <RichText text={data.brief} />
        </p>
      )}

      {canExpand && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] font-semibold text-brand-600 hover:text-brand-700"
        >
          {open ? '간단히' : '문제점·개선책 자세히'}
        </button>
      )}

      {open && (
        <div className="space-y-4 pt-1">
          {problems.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-slate-500 mb-1.5">문제점</div>
              <ul className="space-y-2">
                {problems.map((item, i) => (
                  <li key={i} className="text-[13px] text-ink-700 leading-relaxed">
                    <Line item={item} catalog={tasks} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {remedies.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-slate-500 mb-1.5">개선책</div>
              <ul className="space-y-2">
                {remedies.map((item, i) => (
                  <li key={i} className="text-[13px] text-ink-700 leading-relaxed">
                    <span className="text-brand-500 font-bold mr-1">→</span>
                    <Line item={item} catalog={tasks} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {mine.length > 0 && (
            <div>
              <div className="text-[12px] font-semibold text-slate-500 mb-1.5">
                {data?.audience_label || '이 계정'}
              </div>
              <ul className="space-y-2">
                {mine.map((item, i) => (
                  <li
                    key={i}
                    className={`text-[13px] leading-relaxed ${
                      item.tone === 'critical' ? 'text-red-800' : item.tone === 'warning' ? 'text-amber-900' : 'text-ink-700'
                    }`}
                  >
                    <Line item={item} catalog={tasks} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
