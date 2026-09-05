import { useState, type ReactNode } from 'react'
import { IconCopy } from './icons'
import { RichText } from './RichText'

type Block =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'h3'; text: string }

interface Section {
  title: string
  blocks: Block[]
}

function koReport(s: string) {
  return s.replace(/Critical Path/g, '크리티컬 패스').replace(/오늘 볼\s*일/g, '오늘 할 일')
}

function parseReport(md: string): { title: string; lead: string; sections: Section[] } {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  let lead = ''
  const sections: Section[] = []
  let cur: Section | null = null

  const push = (b: Block) => {
    if (!cur) {
      cur = { title: '', blocks: [] }
      sections.push(cur)
    }
    cur.blocks.push(b)
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      if (!title) title = line.slice(2).trim()
      i += 1
      continue
    }
    if (line.startsWith('## ')) {
      cur = { title: line.slice(3).trim(), blocks: [] }
      sections.push(cur)
      i += 1
      continue
    }
    if (line.startsWith('### ')) {
      push({ type: 'h3', text: line.slice(4).trim() })
      i += 1
      continue
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''))
        i += 1
      }
      push({ type: 'ul', items })
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !/^[-*] /.test(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    const text = para.join(' ')
    if (!cur && !lead) lead = text
    else push({ type: 'p', text })
  }
  return {
    title: koReport(title),
    lead: koReport(lead),
    sections: sections.map((s) => ({
      title: koReport(s.title),
      blocks: s.blocks.map((b) =>
        b.type === 'ul'
          ? { ...b, items: b.items.map(koReport) }
          : { ...b, text: koReport(b.text) },
      ),
    })),
  }
}

function List({ items }: { items: string[] }) {
  const empty = items.length === 1 && /해당 없음|없습니다/.test(items[0])
  if (empty) {
    return <p className="text-[12px] text-slate-400">{items[0].replace(/^-\s*/, '')}</p>
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, j) => (
        <li key={j} className="flex gap-2 text-[13px] text-ink-700 leading-snug">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="min-w-0">
            <RichText text={item} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function renderBlocks(blocks: Block[], start = 0): ReactNode[] {
  const out: ReactNode[] = []
  for (let i = start; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'h3') continue
    if (b.type === 'p') {
      out.push(
        <p key={i} className="text-[13px] text-ink-700 leading-relaxed">
          <RichText text={b.text} />
        </p>,
      )
    } else {
      out.push(<List key={i} items={b.items} />)
    }
  }
  return out
}

function chunkH3(blocks: Block[]) {
  const groups: { title: string; rest: Block[] }[] = []
  let cur: { title: string; rest: Block[] } | null = null
  const preface: Block[] = []
  for (const b of blocks) {
    if (b.type === 'h3') {
      cur = { title: b.text, rest: [] }
      groups.push(cur)
    } else if (cur) {
      cur.rest.push(b)
    } else {
      preface.push(b)
    }
  }
  return { preface, groups }
}

export function CopyMarkdownButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-ink-800 px-2.5 py-1 rounded-lg bg-surface-50 ring-1 ring-slate-200/80 hover:bg-white transition-colors"
      title="마크다운 원문 복사"
    >
      <IconCopy size={13} />
      {copied ? '복사됨' : '복사'}
    </button>
  )
}

export function MarkdownView({ markdown }: { markdown: string }) {
  const { lead, sections } = parseReport(markdown)
  const named = sections.filter((s) => s.title)
  const showLead = lead && !/멤버십 없음|일정 엔진 계산|담당 Task 기준/.test(lead)

  return (
    <div className="space-y-4">
      {showLead && (
        <p className="text-[13px] text-slate-500 leading-relaxed">
          <RichText text={lead} />
        </p>
      )}
      {named.map((sec, i) => {
        const { preface, groups } = chunkH3(sec.blocks)
        return (
          <section key={i} className="rounded-xl bg-surface-50/80 ring-1 ring-slate-100 p-4">
            <h3 className="text-[13px] font-bold text-ink-900 tracking-tight mb-2">{sec.title}</h3>
            {preface.length > 0 && <div className="space-y-2 mb-3">{renderBlocks(preface)}</div>}
            {groups.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {groups.map((g, j) => {
                  const accent = /오늘 할|오늘 볼/.test(g.title)
                  return (
                    <div
                      key={j}
                      className={`rounded-lg px-3 py-2.5 min-h-[7.5rem] ${
                        accent
                          ? 'bg-brand-50/50 ring-1 ring-brand-100/80'
                          : 'bg-white ring-1 ring-slate-100'
                      }`}
                    >
                      <div
                        className={`text-[11px] font-semibold tracking-wide mb-1.5 ${
                          accent ? 'text-brand-600' : 'text-slate-400'
                        }`}
                      >
                        {g.title}
                      </div>
                      {renderBlocks(g.rest)}
                    </div>
                  )
                })}
              </div>
            )}
            {groups.length === 0 && preface.length === 0 && renderBlocks(sec.blocks)}
          </section>
        )
      })}
      {named.length === 0 && renderBlocks(sections[0]?.blocks ?? [])}
    </div>
  )
}
