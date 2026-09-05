import type { CSSProperties } from 'react'

export type BadgeShape = 'pill' | 'rounded' | 'square'
export type BadgeFill = 'soft' | 'solid' | 'outline' | 'text'
export type DelayFormat = 'plus_days' | 'word_days' | 'number_only' | 'hidden'
export type DoneMark = 'badge' | 'check' | 'strike' | 'muted'
export type PaletteId = 'default' | 'vivid' | 'high_contrast' | 'colorblind' | 'soft' | 'mono'
export type Density = 'comfortable' | 'compact'
export type ProgressStyle = 'thin' | 'medium' | 'thick' | 'striped'

export type StatusKey = 'completed' | 'in_progress' | 'not_started' | 'delayed' | 'blocked'

export interface DisplayPrefs {
  palette: PaletteId
  badgeShape: BadgeShape
  badgeFill: BadgeFill
  delayFormat: DelayFormat
  doneMark: DoneMark
  density: Density
  progressStyle: ProgressStyle
  showStatus: boolean
  showDelay: boolean
  showCritical: boolean
  showOnTrack: boolean
  labels: Record<StatusKey, string> & { critical: string; onTrack: string }
  colors: Record<StatusKey, string> & { critical: string; onTrack: string }
}

export const PALETTES: Record<
  PaletteId,
  { name: string; desc: string; colors: DisplayPrefs['colors'] }
> = {
  default: {
    name: '기본',
    desc: '슬레이트 + 포인트 색',
    colors: {
      completed: '#059669',
      in_progress: '#2563eb',
      not_started: '#64748b',
      delayed: '#dc2626',
      blocked: '#b91c1c',
      critical: '#7c3aed',
      onTrack: '#059669',
    },
  },
  vivid: {
    name: '선명',
    desc: '멀리서도 구분되게',
    colors: {
      completed: '#16a34a',
      in_progress: '#0284c7',
      not_started: '#78716c',
      delayed: '#e11d48',
      blocked: '#c2410c',
      critical: '#d946ef',
      onTrack: '#16a34a',
    },
  },
  high_contrast: {
    name: '고대비',
    desc: '검정·원색 위주',
    colors: {
      completed: '#15803d',
      in_progress: '#1d4ed8',
      not_started: '#334155',
      delayed: '#b91c1c',
      blocked: '#7c2d12',
      critical: '#6d28d9',
      onTrack: '#14532d',
    },
  },
  colorblind: {
    name: '색약 배려',
    desc: '청·주황 축으로 구분',
    colors: {
      completed: '#0072b2',
      in_progress: '#56b4e9',
      not_started: '#6b7280',
      delayed: '#e69f00',
      blocked: '#d55e00',
      critical: '#cc79a7',
      onTrack: '#009e73',
    },
  },
  soft: {
    name: '소프트',
    desc: '채도를 낮춘 톤',
    colors: {
      completed: '#6b9080',
      in_progress: '#7c9cbf',
      not_started: '#94a3b8',
      delayed: '#c98b8b',
      blocked: '#b07d6a',
      critical: '#9b87b5',
      onTrack: '#6b9080',
    },
  },
  mono: {
    name: '모노',
    desc: '회색만 사용',
    colors: {
      completed: '#171717',
      in_progress: '#404040',
      not_started: '#a3a3a3',
      delayed: '#525252',
      blocked: '#262626',
      critical: '#0a0a0a',
      onTrack: '#525252',
    },
  },
}

export const DEFAULT_PREFS: DisplayPrefs = {
  palette: 'default',
  badgeShape: 'pill',
  badgeFill: 'soft',
  delayFormat: 'plus_days',
  doneMark: 'badge',
  density: 'comfortable',
  progressStyle: 'thin',
  showStatus: true,
  showDelay: true,
  showCritical: true,
  showOnTrack: true,
  labels: {
    completed: '완료',
    in_progress: '진행 중',
    not_started: '미착수',
    delayed: '지연',
    blocked: '차단',
    critical: '크리티컬 패스',
    onTrack: '정상 진행',
  },
  colors: { ...PALETTES.default.colors },
}

const KEY = 'flowplan_display_prefs'

export function loadDisplayPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULT_PREFS)
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      labels: { ...DEFAULT_PREFS.labels, ...parsed.labels },
      colors: { ...DEFAULT_PREFS.colors, ...parsed.colors },
    }
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
}

export function saveDisplayPrefs(prefs: DisplayPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

export function applyDisplayPrefs(prefs: DisplayPrefs) {
  const root = document.documentElement
  root.dataset.density = prefs.density
  root.dataset.badgeShape = prefs.badgeShape
  root.dataset.badgeFill = prefs.badgeFill
  const map: Record<string, string> = {
    completed: prefs.colors.completed,
    progress: prefs.colors.in_progress,
    idle: prefs.colors.not_started,
    delayed: prefs.colors.delayed,
    blocked: prefs.colors.blocked,
    critical: prefs.colors.critical,
    ok: prefs.colors.onTrack,
  }
  for (const [k, v] of Object.entries(map)) {
    root.style.setProperty(`--disp-${k}`, v)
  }
}

export function formatDelay(days: number, format: DelayFormat, delayedLabel: string): string | null {
  if (format === 'hidden' || days <= 0) return null
  if (format === 'plus_days') return `+${days}일`
  if (format === 'word_days') return `${delayedLabel} ${days}일`
  return `${days}`
}

export function badgeChrome(hex: string, fill: BadgeFill): CSSProperties {
  if (fill === 'solid') return { background: hex, color: '#fff', boxShadow: 'none' }
  if (fill === 'outline') return { background: 'transparent', color: hex, boxShadow: `inset 0 0 0 1px ${hex}` }
  if (fill === 'text') return { background: 'transparent', color: hex, boxShadow: 'none', paddingInline: 0 }
  return { background: `${hex}1f`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}33` }
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '')
  const n = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

export function chartColors(c: DisplayPrefs['colors']) {
  return {
    baseline: c.not_started,
    plan: c.in_progress,
    actual: c.completed,
    forecast: c.delayed,
    critical: c.critical,
    delay: c.delayed,
    issue: c.blocked,
    today: c.in_progress,
  }
}

export function badgeRadius(shape: BadgeShape): string {
  if (shape === 'square') return 'rounded-sm'
  if (shape === 'rounded') return 'rounded-md'
  return 'rounded-full'
}
