import { useState } from 'react'
import { useDisplay } from '../auth/DisplayContext'
import { IconChevronDown } from '../components/icons'
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
              on
                ? 'bg-brand-50 dark:bg-brand-500/25 ring-brand-300 dark:ring-brand-400/40'
                : 'bg-surface-50 ring-transparent hover:ring-slate-200 dark:hover:ring-white/10'
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
        <div className="text-[11px] font-semibold text-slate-400 mb-2">화면 배색</div>
        <div className="flex h-14 rounded-lg overflow-hidden ring-1 ring-slate-200">
          <div className="w-8 shrink-0" style={{ background: prefs.colors.sidebar }} title="사이드바" />
          <div className="flex-1 p-2 space-y-1.5" style={{ background: 'rgb(var(--bg))' }}>
            <div className="h-3 rounded" style={{ background: 'rgb(var(--card))' }} />
            <div className="h-2 w-2/3 rounded" style={{ background: 'rgb(var(--brand-500))' }} />
          </div>
        </div>
      </div>
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

function FoldCard({
  title,
  desc,
  open,
  onToggle,
  extra,
  children,
}: {
  title: string
  desc?: string
  open: boolean
  onToggle: () => void
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-50"
        >
          <IconChevronDown
            size={16}
            className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink-900">{title}</span>
            {desc && <span className="block text-[12px] text-slate-400 mt-0.5">{desc}</span>}
          </span>
        </button>
        {extra && <div className="pr-4 shrink-0">{extra}</div>}
      </div>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </section>
  )
}

export function DisplaySettings() {
  const { prefs, setPrefs, applyPalette, reset } = useDisplay()
  const [open, setOpen] = useState({
    theme: true,
    style: true,
    items: true,
    fine: false,
    preview: true,
  })
  const toggle = (key: keyof typeof open) => setOpen((s) => ({ ...s, [key]: !s[key] }))
  const keys = [...STATUSES, 'critical', 'onTrack'] as const

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
      <div className="space-y-4 min-w-0">
        <FoldCard
          title="색 테마"
          desc="사이드바 색이 기준입니다. 본문 배경·카드·버튼 톤이 같이 맞춰집니다."
          open={open.theme}
          onToggle={() => toggle('theme')}
          extra={
            <button type="button" className="btn-ghost !text-[12px] !px-2 !py-1" onClick={reset}>
              초기화
            </button>
          }
        >
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
                    on
                      ? 'bg-brand-50 dark:bg-brand-500/25 ring-brand-300 dark:ring-brand-400/40'
                      : 'bg-surface-50 ring-slate-100 dark:ring-white/10 hover:ring-slate-200 dark:hover:ring-white/15'
                  }`}
                >
                  <div className="h-1.5 rounded-full mb-1.5 ring-1 ring-black/5" style={{ background: p.colors.sidebar }} />
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
        </FoldCard>

        <FoldCard title="표시 방식" desc="배지 모양과 지연·완료 표기" open={open.style} onToggle={() => toggle('style')}>
          <div className="space-y-5">
          <Field title="배지 모양" desc="상태 배지의 모서리">
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
          <Field title="지연 표기" desc="3일 늦을 때 어떻게 보여줄지">
            <Choice<DelayFormat>
              value={prefs.delayFormat}
              onChange={(delayFormat) => setPrefs((p) => ({ ...p, delayFormat }))}
              options={[
                { id: 'plus_days', label: '+N일', sample: '+3일' },
                { id: 'word_days', label: '지연 N일', sample: `${prefs.labels.delayed} 3일` },
                { id: 'number_only', label: '숫자만', sample: '3' },
                { id: 'hidden', label: '숨김', sample: '표시 안 함' },
              ]}
            />
          </Field>
          <Field title="완료 표시" desc="끝난 태스크의 강조">
            <Choice<DoneMark>
              value={prefs.doneMark}
              onChange={(doneMark) => setPrefs((p) => ({ ...p, doneMark }))}
              options={[
                { id: 'badge', label: '배지만' },
                { id: 'check', label: '체크 표시' },
                { id: 'strike', label: '취소선' },
                { id: 'muted', label: '흐리게' },
              ]}
            />
          </Field>
          <Field title="진행 막대 · 밀도" desc="막대 두께와 표·카드 여백">
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
          </div>
        </FoldCard>

        <FoldCard
          title="표시 항목"
          desc="끄면 화면에서만 숨깁니다. 일정 숫자는 바뀌지 않습니다."
          open={open.items}
          onToggle={() => toggle('items')}
        >
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
        </FoldCard>

        <FoldCard
          title="이름과 색 직접 고치기"
          desc="테마 위에 덮어씁니다. 필요할 때만 여세요."
          open={open.fine}
          onToggle={() => toggle('fine')}
        >
          <div className="space-y-2">
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
              <div className="rounded-xl bg-surface-50 px-3 py-2.5 space-y-2">
                <div className="text-[12px] font-semibold text-ink-800">
                  사이드바
                  <span className="ml-1.5 font-normal text-slate-400">왼쪽 메뉴 배경</span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    className="input !py-1.5 text-[12px] font-mono w-[6.5rem] shrink-0"
                    value={prefs.colors.sidebar}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, colors: { ...p.colors, sidebar: e.target.value } }))
                    }
                    aria-label="사이드바 색 코드"
                  />
                  <input
                    type="color"
                    className="h-9 w-9 rounded-lg border border-slate-200 cursor-pointer bg-white shrink-0"
                    value={/^#[0-9a-fA-F]{6}$/.test(prefs.colors.sidebar) ? prefs.colors.sidebar : '#0a0a0a'}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, colors: { ...p.colors, sidebar: e.target.value } }))
                    }
                    aria-label="사이드바 색 고르기"
                  />
                </div>
              </div>
          </div>
        </FoldCard>
      </div>

      <aside className="lg:sticky lg:top-20">
        <FoldCard
          title="미리보기"
          desc="이 기기 설정입니다. 저장 버튼은 없습니다."
          open={open.preview}
          onToggle={() => toggle('preview')}
        >
          <PreviewPane />
        </FoldCard>
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
