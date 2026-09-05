import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../api/client'
import type { Challenge } from '../api/types'
import { IconChevronRight, IconChallenge } from '../components/icons'
import { PriorityBadge } from '../components/ui'
import { SkeletonText } from '../components/Skeleton'
import { RichText } from '../components/RichText'

export function Challenges() {
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [responses, setResponses] = useState<Record<number, string>>({})

  const load = () => {
    setLoading(true)
    http
      .get<Challenge[]>('/challenges')
      .then(setChallenges)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const respond = async (id: number) => {
    const text = responses[id]?.trim()
    if (!text) return
    try {
      await http.post(`/challenges/${id}/response`, { response: text })
      setResponses((r) => ({ ...r, [id]: '' }))
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : '응답 실패')
    }
  }

  const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, ATTENTION: 2, NORMAL: 3 }
  const open = [...challenges]
    .filter((c) => c.status !== 'answered')
    .sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))

  const answerHint: Record<string, string> = {
    issue: '해결했는지, 새 예정일(YYYY-MM-DD)을 적으세요.\n막힌 후속이 있으면 그 이름도 적으세요.',
    critical_delay:
      '지연 원인과 대응/대책을 적으세요.\n예상 추가 일수(대책 후에도 계획일보다 며칠 더 늦을지)는 관련 Task → 진행 기록에 숫자로 남기세요.',
    critical_progress:
      '오늘 한 일과 지금 막힌 점을 적으세요.\n진척 %는 태스크 상세의 진척률 보정에, 지금 끝난 비율로 고치세요.',
    delay:
      '지연 원인과 대응/대책을 적으세요.\n예상 추가 일수(대책 후에도 계획일보다 며칠 더 늦을지)는 관련 Task → 진행 기록에 숫자로 남기세요.',
    progress_update:
      '지금 상황과 한 일을 적으세요.\n오래 비어 있던 진척은 상세 진행 기록에도 남겨 주세요.',
  }

  const toneCard: Record<string, string> = {
    CRITICAL: 'ring-2 ring-red-200',
    WARNING: 'ring-1 ring-amber-200',
    ATTENTION: 'ring-1 ring-brand-200',
    NORMAL: '',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 grid place-items-center">
            <IconChallenge size={19} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900">오늘의 챌린지</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">오늘 당신이 해야 할 일 ({open.length}개 남음)</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <SkeletonText w="w-20" />
                <SkeletonText w="w-24" />
              </div>
              <SkeletonText w="w-full" />
              <SkeletonText w="w-5/6" className="mt-1" />
            </div>
          ))}
        </div>
      ) : open.length === 0 ? (
        <div className="card p-14 text-center text-sm text-slate-400">
          <div className="text-3xl mb-3">🎯</div>
          지금 처리할 챌린지가 없습니다. 지연·이슈가 생기면 자동으로 생깁니다.
        </div>
      ) : (
        <div className="space-y-3">
          {open.map((c) => (
            <div key={c.id} className={`card p-5 ${toneCard[c.priority] || ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={c.priority} />
                    <span className="text-xs text-slate-400">
                      {{
                        critical_delay: '크리티컬 지연',
                        critical_progress: '크리티컬 점검',
                        issue: '이슈 기한',
                        delay: '일반 지연',
                        progress_update: '진척 공백',
                      }[c.category] || c.category}
                    </span>
                    {c.status === 'answered' && (
                      <span className="badge bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">답변 완료</span>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm text-ink-700 leading-relaxed">
                    <RichText text={c.message} />
                  </p>
                  {c.task_id && (
                    <button
                      onClick={() => navigate(`/tasks/${c.task_id}`)}
                      className="mt-2 inline-flex items-center gap-0.5 text-[13px] text-brand-600 hover:underline"
                    >
                      관련 Task #{c.task_id}
                      <IconChevronRight size={13} />
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-300 whitespace-nowrap shrink-0">
                  {c.created_at?.slice(5, 16).replace('T', ' ')}
                </span>
              </div>

              {c.status !== 'answered' && (
                <div className="mt-4 flex gap-2 items-start">
                  <textarea
                    rows={2}
                    className="input flex-1 !min-h-0 h-auto resize-none py-2 text-[13px] leading-snug"
                    placeholder={
                      answerHint[c.category] || '이 챌린지에서 요청한 조치를 어떻게 했는지 적으세요.\n일정 숫자는 관련 Task 상세에 남기세요.'
                    }
                    value={responses[c.id] || ''}
                    onChange={(e) => setResponses((r) => ({ ...r, [c.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        respond(c.id)
                      }
                    }}
                  />
                  <button className="btn-primary shrink-0" onClick={() => respond(c.id)}>
                    답변
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}