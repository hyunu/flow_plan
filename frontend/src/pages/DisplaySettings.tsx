import { useState } from 'react'
import { useDisplay } from '../auth/DisplayContext'
import { CriticalBadge, DelayMark, ProgressBar, StatusBadge } from '../components/ui'
import {
  chartColors,
  hexWithAlpha,
  PALETTES,
  type BadgeFill,
  type BadgeShape,
  type DelayFormat,
  type Density,
  type DoneMark,
  type PaletteId,
  type ProgressStyle,
  type StatusKey,
} from '../lib/displayPrefs'

const STATUSES: StatusKey[] = ['completed', 'in_progress', 'not_started', 'delayed', 'blocked']

const ROLE: Record<string, { title: string; hint: string }> = {
  completed: { title: '완료', hint: '끝난 작업' },
  in_progress: { title: '진행 중', hint: '하고 있는 작업' },
  not_started: { title: '미착수', hint: '아직 안 연 작업' },
  delayed: { title: '지연', hint: '계획보다 늦은 작업' },
  blocked: { title: '차단', hint: '막힌 작업' },
  critical: { title: '크리티컬 패스', hint: '하루 늦으면 전체가 밀림' },
  onTrack: { title: '정상 진행', hint: '지연 없는 작업' },
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string; sample?: string }[]
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
      {options.map((o) => {
        const on = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-xl px-2.5 py-2 text-left ring-1 transition-colors ${
              on ? 'bg-white ring-brand-300 shadow-sm' : 'bg-surface-50 ring-transparent hover:ring-slate-200'
            }`}
          >
            <div className={`text-[12px] font-semibold ${on ? 'text-ink-900' : 'text-slate-500'}`}>{o.label}</div>
            {o.sample && <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{o.sample}</div>}
          </button>
        )
      })}
    </div>
  )
}

function PreviewPane() {
  const { prefs } = useDisplay()
  const cc = chartColors(prefs.colors)
  const bars = [
    { name: '계획 막대', fill: hexWithAlpha(cc.plan, 0.5), stroke: cc.plan, w: '72%' },
    { name: '지연 막대', fill: hexWithAlpha(cc.delay, 0.4), stroke: cc.delay, w: '58%' },
    { name: '크리티컬', fill: hexWithAlpha(cc.critical, 0.42), stroke: cc.critical, w: '80%' },
  ]
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-2">배지</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          <CriticalBadge />
          <DelayMark days={3} />
          <DelayMark days={0} />
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-2">간트 막대</div>
        <div className="space-y-2">
          {bars.map((b) => (
            <div key={b.name} className="flex items-center gap-2">
              <span className="w-14 text-[10px] text-slate-400 shrink-0">{b.name}</span>
              <div className="flex-1 h-5 rounded bg-slate-100/80 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: b.w, background: b.fill, boxShadow: `inset 0 0 0 1.2px ${b.stroke}` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-2">진척 곡선 색</div>
        <div className="flex h-1.5 rounded-full overflow-hidden">
          <span className="flex-1" style={{ background: cc.baseline }} title="최초 계획" />
          <span className="flex-1" style={{ background: cc.plan }} title="계획" />
          <span className="flex-1" style={{ background: cc.actual }} title="실제" />
          <span className="flex-1" style={{ background: cc.forecast }} title="예측" />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>최초</span>
          <span>계획</span>
          <span>실제</span>
          <span>예측</span>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-2">진행 막대</div>
        <ProgressBar value={64} />
      </div>
    </div>
  )
}

export function DisplaySettings() {
  const { prefs, setPrefs, applyPalette, reset } = useDisplay()
  const [fineTune, setFineTune] = useState(false)
  const keys = [...STATUSES, 'critical', 'onTrack'] as const

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
      <div className="space-y-4 min-w-0">
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">색 테마</h3>
              <p className="text-[12px] text-slate-400 mt-0.5">한 번 고르면 배지·간트·곡선이 같이 바뀝니다.</p>
            </div>
            <button type="button" className="btn-ghost !text-[12px] !px-2 !py-1" onClick={reset}>
              초기화
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(PALETTES) as PaletteId[]).map((id) => {
              const p = PALETTES[id]
              const on = prefs.palette === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyPalette(id)}
                  className={`text-left rounded-xl px-3 py-2.5 ring-1 transition-colors ${
                    on ? 'bg-white ring-brand-300 shadow-sm' : 'bg-surface-50 ring-slate-100 hover:ring-slate-200'
                  }`}
                >
                  <div className="flex gap-1 mb-1.5">
                    {['completed', 'in_progress', 'delayed', 'critical', 'not_started'].map((k) => (
                      <span
                        key={k}
                        className="w-3.5 h-3.5 rounded-full ring-1 ring-black/5"
                        style={{ background: p.colors[k as StatusKey] }}
                      />
                    ))}
                  </div>
                  <div className="text-[13px] font-semibold text-ink-800">{p.name}</div>
                  <div className="text-[11px] text-slate-400 leading-snug">{p.desc}</div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card p-5 space-y-5">
          <h3 className="text-sm font-semibold text-ink-900">어떻게 적을지</h3>
          <Field title="배지 모양" desc="상태 알림의 모서리">
            <Choice<BadgeShape>
              value={prefs.badgeShape}
              onChange={(badgeShape) => setPrefs((p) => ({ ...p, badgeShape }))}
              options={[
                { id: 'pill', label: '알약' },
                { id: 'rounded', label: '둥근 사각' },
                { id: 'square', label: '각진 사각' },
              ]}
            />
          </Field>
          <Field title="배지 채움" desc="색을 얼마나 진하게">
            <Choice<BadgeFill>
              value={prefs.badgeFill}
              onChange={(badgeFill) => setPrefs((p) => ({ ...p, badgeFill }))}
              options={[
                { id: 'soft', label: '연한 면' },
                { id: 'solid', label: '진한 면' },
                { id: 'outline', label: '테두리만' },
                { id: 'text', label: '글자만' },
              ]}
            />
          </Field>
          <Field title="지연 숫자" desc="3일 늦었을 때">
            <Choice<DelayFormat>
              value={prefs.delayFormat}
              onChange={(delayFormat) => setPrefs((p) => ({ ...p, delayFormat }))}
              options={[
                { id: 'plus_days', label: '덧셈', sample: '+3일' },
                { id: 'word_days', label: '단어', sample: `${prefs.labels.delayed} 3일` },
                { id: 'number_only', label: '숫자만', sample: '3' },
                { id: 'hidden', label: '숨김', sample: '표시 안 함' },
              ]}
            />
          </Field>
          <Field title="완료된 작업" desc="끝난 태스크를 어떻게">
            <Choice<DoneMark>
              value={prefs.doneMark}
              onChange={(doneMark) => setPrefs((p) => ({ ...p, doneMark }))}
              options={[
                { id: 'badge', label: '배지만' },
                { id: 'check', label: '앞에 체크' },
                { id: 'strike', label: '이름에 줄' },
                { id: 'muted', label: '흐리게' },
              ]}
            />
          </Field>
          <Field title="진행 막대 · 밀도" desc="표와 카드의 여백">
            <div className="space-y-2">
              <Choice<ProgressStyle>
                value={prefs.progressStyle}
                onChange={(progressStyle) => setPrefs((p) => ({ ...p, progressStyle }))}
                options={[
                  { id: 'thin', label: '얇게' },
                  { id: 'medium', label: '보통' },
                  { id: 'thick', label: '두껍게' },
                  { id: 'striped', label: '빗금' },
                ]}
              />
              <Choice<Density>
                value={prefs.density}
                onChange={(density) => setPrefs((p) => ({ ...p, density }))}
                options={[
                  { id: 'comfortable', label: '여유 있게' },
                  { id: 'compact', label: '촘촘히' },
                ]}
              />
            </div>
          </Field>
        </section>

        <section className="card p-5">
          <h3 className="text-sm font-semibold text-ink-900 mb-1">화면에 보일 것</h3>
          <p className="text-[12px] text-slate-400 mb-3">꺼도 숫자는 그대로입니다. 표시만 숨깁니다.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {(
              [
                ['showStatus', '상태 배지', '완료·진행 중 등'],
                ['showDelay', '지연 표시', '+N일 배지'],
                ['showCritical', '크리티컬 패스', '임계 경로 표시'],
                ['showOnTrack', '정상 진행', '늦지 않은 작업'],
              ] as const
            ).map(([key, label, hint]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-50 px-3 py-2.5 cursor-pointer"
              >
                <span>
                  <span className="block text-[13px] font-medium text-ink-800">{label}</span>
                  <span className="block text-[11px] text-slate-400">{hint}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={prefs[key]}
                  onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
                  className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
                    prefs[key] ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      prefs[key] ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden">
          <button
            type="button"
            onClick={() => setFineTune((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-50"
          >
            <span>
              <span className="block text-sm font-semibold text-ink-900">이름과 색 직접 고치기</span>
              <span className="block text-[12px] text-slate-400 mt-0.5">테마 위에 덮어씁니다. 필요할 때만 여세요.</span>
            </span>
            <span className="text-slate-400 text-sm">{fineTune ? '접기' : '열기'}</span>
          </button>
          {fineTune && (
            <div className="px-5 pb-5 space-y-2 border-t border-slate-100 pt-4">
              {keys.map((key) => {
                const meta = ROLE[key]
                return (
                  <div key={key} className="rounded-xl bg-surface-50 px-3 py-2.5 space-y-2">
                    <div className="text-[12px] font-semibold text-ink-800">
                      {meta.title}
                      <span className="ml-1.5 font-normal text-slate-400">{meta.hint}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        className="input !py-1.5 text-[13px] flex-1"
                        value={prefs.labels[key]}
                        onChange={(e) =>
                          setPrefs((p) => ({ ...p, labels: { ...p.labels, [key]: e.target.value } }))
                        }
                        aria-label={`${meta.title} 표시 이름`}
                      />
                      <input
                        className="input !py-1.5 text-[12px] font-mono w-[6.5rem] shrink-0"
                        value={prefs.colors[key]}
                        onChange={(e) =>
                          setPrefs((p) => ({ ...p, colors: { ...p.colors, [key]: e.target.value } }))
                        }
                        aria-label={`${meta.title} 색 코드`}
                      />
                      <input
                        type="color"
                        className="h-9 w-9 rounded-lg border border-slate-200 cursor-pointer bg-white shrink-0"
                        value={/^#[0-9a-fA-F]{6}$/.test(prefs.colors[key]) ? prefs.colors[key] : '#64748b'}
                        onChange={(e) =>
                          setPrefs((p) => ({ ...p, colors: { ...p.colors, [key]: e.target.value } }))
                        }
                        aria-label={`${meta.title} 색 고르기`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 card p-5">
        <div className="text-sm font-semibold text-ink-900">미리보기</div>
        <p className="text-[11px] text-slate-400 mt-0.5 mb-4">이 기기 설정입니다. 저장 버튼은 없습니다.</p>
        <PreviewPane />
      </aside>
    </div>
  )
}

function Field({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <div className="text-[13px] font-semibold text-ink-800">{title}</div>
        <div className="text-[11px] text-slate-400">{desc}</div>
      </div>
      {children}
    </div>
  )
}
