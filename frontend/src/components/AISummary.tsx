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

interface RiskData {
  overall_risk?: string
  risks?: RiskItem[]
  recommendations?: string[]
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

/** AI 위험 분석 결과(JSON)를 읽기 좋게 렌더링. JSON이 아니면 원문 표시. */
export function AISummary({ content }: { content: string }) {
  let data: RiskData | null = null
  try {
    data = JSON.parse(content)
  } catch {
    data = null
  }

  const structured = data && (data.overall_risk || (data.risks && data.risks.length > 0))
  if (!structured) {
    return (
      <pre className="text-[13px] leading-relaxed text-ink-700 whitespace-pre-wrap font-sans">{content}</pre>
    )
  }

  const risk = data!.overall_risk || 'NORMAL'
  const riskTone = risk === 'HIGH' ? 'red' : risk === 'WARNING' ? 'amber' : 'green'

  return (
    <div className="space-y-4">
      {/* 전반 위험도 */}
      <div className="flex items-center gap-3">
        <span className="text-[13px] text-slate-500">전반 위험도</span>
        <Badge tone={riskTone}>{risk}</Badge>
      </div>

      {/* 위험 요소 */}
      {data!.risks && data!.risks.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-slate-400 mb-2">위험 요소</div>
          <ul className="space-y-2">
            {data!.risks!.map((r, i) => (
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
                        {r.task_id != null ? (
                          <Link
                            to={`/tasks/${r.task_id}`}
                            className="font-medium text-ink-900 hover:text-brand-600 hover:underline underline-offset-2"
                          >
                            {r.task_title}
                          </Link>
                        ) : (
                          <span className="font-medium">{r.task_title}</span>
                        )}
                        {r.task_id != null && <span className="text-slate-400 text-[11px]"> #{r.task_id}</span>}
                        {r.risk || r.description ? ` — ${r.risk || r.description}` : ''}
                      </>
                    ) : (
                      r.risk || r.description || ''
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 권장 대책 */}
      {data!.recommendations && data!.recommendations.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold text-slate-400 mb-2">권장 대책</div>
          <ul className="space-y-1.5">
            {data!.recommendations!.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-ink-700 leading-snug">
                <span className="mt-0.5 text-brand-500 font-bold shrink-0">✓</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}