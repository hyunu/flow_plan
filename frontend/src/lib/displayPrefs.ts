import type { CSSProperties } from 'react'

export type BadgeShape = 'pill' | 'rounded' | 'square'
export type BadgeFill = 'soft' | 'solid' | 'outline' | 'text'
export type DelayFormat = 'plus_days' | 'word_days' | 'number_only' | 'hidden'
export type DoneMark = 'badge' | 'check' | 'strike' | 'muted'
export type PaletteId =
  | 'nord'
  | 'solarized'
  | 'dracula'
  | 'catppuccin'
  | 'tokyo_night'
  | 'github'
  | 'one_dark'
  | 'okabe_ito'
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
  colors: Record<StatusKey, string> & { critical: string; onTrack: string; sidebar: string }
}

export const PALETTES: Record<
  PaletteId,
  { name: string; desc: string; colors: DisplayPrefs['colors'] }
> = {
  nord: {
    name: 'Nord',
    desc: '북극 블루그레이',
    colors: {
      completed: '#A3BE8C',
      in_progress: '#88C0D0',
      not_started: '#4C566A',
      delayed: '#BF616A',
      blocked: '#D08770',
      critical: '#B48EAD',
      onTrack: '#A3BE8C',
      sidebar: '#2E3440',
    },
  },
  solarized: {
    name: 'Solarized',
    desc: 'Ethan Schoonover',
    colors: {
      completed: '#859900',
      in_progress: '#268bd2',
      not_started: '#657b83',
      delayed: '#dc322f',
      blocked: '#cb4b16',
      critical: '#6c71c4',
      onTrack: '#859900',
      sidebar: '#002b36',
    },
  },
  dracula: {
    name: 'Dracula',
    desc: '보라 네온',
    colors: {
      completed: '#50fa7b',
      in_progress: '#8be9fd',
      not_started: '#6272a4',
      delayed: '#ff5555',
      blocked: '#ffb86c',
      critical: '#bd93f9',
      onTrack: '#50fa7b',
      sidebar: '#282a36',
    },
  },
  catppuccin: {
    name: 'Catppuccin',
    desc: 'Mocha 파스텔',
    colors: {
      completed: '#a6e3a1',
      in_progress: '#89b4fa',
      not_started: '#6c7086',
      delayed: '#f38ba8',
      blocked: '#fab387',
      critical: '#cba6f7',
      onTrack: '#a6e3a1',
      sidebar: '#1e1e2e',
    },
  },
  tokyo_night: {
    name: 'Tokyo Night',
    desc: '밤의 도쿄',
    colors: {
      completed: '#9ece6a',
      in_progress: '#7aa2f7',
      not_started: '#565f89',
      delayed: '#f7768e',
      blocked: '#ff9e64',
      critical: '#bb9af7',
      onTrack: '#9ece6a',
      sidebar: '#1a1b26',
    },
  },
  github: {
    name: 'GitHub',
    desc: 'Primer',
    colors: {
      completed: '#1a7f37',
      in_progress: '#0969da',
      not_started: '#656d76',
      delayed: '#cf222e',
      blocked: '#bc4c00',
      critical: '#8250df',
      onTrack: '#1a7f37',
      sidebar: '#0d1117',
    },
  },
  one_dark: {
    name: 'One Dark',
    desc: 'Atom',
    colors: {
      completed: '#98c379',
      in_progress: '#61afef',
      not_started: '#5c6370',
      delayed: '#e06c75',
      blocked: '#d19a66',
      critical: '#c678dd',
      onTrack: '#98c379',
      sidebar: '#282c34',
    },
  },
  okabe_ito: {
    name: 'Okabe–Ito',
    desc: '색약 표준 배색',
    colors: {
      completed: '#009E73',
      in_progress: '#0072B2',
      not_started: '#999999',
      delayed: '#D55E00',
      blocked: '#E69F00',
      critical: '#CC79A7',
      onTrack: '#009E73',
      sidebar: '#3C5488',
    },
  },
}

export const DEFAULT_PREFS: DisplayPrefs = {
  palette: 'nord',
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
  colors: { ...PALETTES.nord.colors },
}

const KEY = 'flowplan_display_prefs'

export function loadDisplayPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULT_PREFS)
    const parsed = JSON.parse(raw) as Partial<DisplayPrefs>
    const palette =
      parsed.palette && parsed.palette in PALETTES ? parsed.palette : DEFAULT_PREFS.palette
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      palette,
      labels: { ...DEFAULT_PREFS.labels, ...parsed.labels },
      colors:
        parsed.palette && parsed.palette in PALETTES
          ? { ...PALETTES[palette].colors, ...parsed.colors }
          : { ...PALETTES[palette].colors },
    }
  } catch {
    return structuredClone(DEFAULT_PREFS)
  }
}

export function saveDisplayPrefs(prefs: DisplayPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.replace('#', '').trim()
  const n = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  if (!/^[0-9a-fA-F]{6}$/.test(n)) return null
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s = clamp(s, 0, 1)
  l = clamp(l, 0, 1)
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ]
}

function trip(h: number, s: number, l: number) {
  const [r, g, b] = hslToRgb(h, s, l)
  return `${r} ${g} ${b}`
}

/** 사이드바(프라이머리) 색으로 본문 배경·카드·브랜드 톤을 맞춘다. */
export function applyChromeFromSidebar(hex: string, dark: boolean) {
  const rgb = hexToRgb(hex)
  const root = document.documentElement
  if (!rgb) return
  const [h, s0] = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const s = clamp(s0 < 0.06 ? 0.07 : s0 * 0.52, 0.05, 0.4)
  const set = (key: string, value: string) => root.style.setProperty(key, value)

  if (!dark) {
    set('--bg', trip(h, s * 0.32, 0.968))
    set('--card', trip(h, s * 0.1, 1))
    set('--surface-50', trip(h, s * 0.24, 0.962))
    set('--surface-100', trip(h, s * 0.28, 0.936))
    set('--ink-500', trip(h, s * 0.12, 0.42))
    set('--ink-700', trip(h, s * 0.16, 0.28))
    set('--ink-900', trip(h, s * 0.2, 0.12))
    set('--slate-50', trip(h, s * 0.22, 0.965))
    set('--slate-100', trip(h, s * 0.24, 0.94))
    set('--slate-200', trip(h, s * 0.2, 0.88))
    set('--slate-300', trip(h, s * 0.16, 0.8))
    set('--slate-400', trip(h, s * 0.12, 0.62))
    set('--slate-500', trip(h, s * 0.12, 0.45))
    set('--slate-600', trip(h, s * 0.14, 0.36))
    set('--slate-700', trip(h, s * 0.16, 0.28))
    set('--slate-800', trip(h, s * 0.2, 0.18))
    set('--slate-900', trip(h, s * 0.22, 0.12))
    set('--slate-950', trip(h, s * 0.2, 0.06))
    set('--chart-mark', trip(h, s * 0.18, 0.14))
    set('--brand-50', trip(h, s * 0.38, 0.97))
    set('--brand-100', trip(h, s * 0.4, 0.935))
    set('--brand-200', trip(h, s * 0.4, 0.88))
    set('--brand-300', trip(h, s * 0.42, 0.76))
    set('--brand-400', trip(h, clamp(s0, 0.16, 0.45), 0.58))
    set('--brand-500', trip(h, clamp(s0, 0.18, 0.5), 0.42))
    set('--brand-600', trip(h, clamp(s0, 0.2, 0.55), 0.3))
    set('--brand-700', trip(h, clamp(s0, 0.18, 0.5), 0.2))
    set('--brand-800', trip(h, clamp(s0, 0.15, 0.45), 0.12))
    set('--brand-900', trip(h, clamp(s0, 0.12, 0.4), 0.06))
  } else {
    set('--bg', trip(h, s * 0.42, 0.09))
    set('--card', trip(h, s * 0.38, 0.135))
    set('--surface-50', trip(h, s * 0.36, 0.16))
    set('--surface-100', trip(h, s * 0.34, 0.19))
    set('--ink-500', trip(h, s * 0.12, 0.68))
    set('--ink-700', trip(h, s * 0.1, 0.82))
    set('--ink-900', trip(h, s * 0.08, 0.94))
    set('--slate-50', trip(h, s * 0.34, 0.155))
    set('--slate-100', trip(h, s * 0.32, 0.185))
    set('--slate-200', trip(h, s * 0.3, 0.23))
    set('--slate-300', trip(h, s * 0.22, 0.36))
    set('--slate-400', trip(h, s * 0.16, 0.55))
    set('--slate-500', trip(h, s * 0.14, 0.64))
    set('--slate-600', trip(h, s * 0.12, 0.72))
    set('--slate-700', trip(h, s * 0.1, 0.82))
    set('--slate-800', trip(h, s * 0.2, 0.28))
    set('--slate-900', trip(h, s * 0.22, 0.12))
    set('--slate-950', trip(h, s * 0.2, 0.06))
    set('--chart-mark', trip(h, s * 0.06, 0.96))
    set('--brand-50', trip(h, s * 0.32, 0.16))
    set('--brand-100', trip(h, s * 0.3, 0.2))
    set('--brand-200', trip(h, s * 0.28, 0.26))
    set('--brand-300', trip(h, s * 0.24, 0.4))
    set('--brand-400', trip(h, clamp(s0, 0.18, 0.45), 0.5))
    set('--brand-500', trip(h, clamp(s0, 0.22, 0.5), 0.46))
    set('--brand-600', trip(h, clamp(s0, 0.24, 0.52), 0.55))
    set('--brand-700', trip(h, clamp(s0, 0.2, 0.45), 0.68))
    set('--brand-800', trip(h, s * 0.14, 0.82))
    set('--brand-900', trip(h, s * 0.1, 0.92))
  }
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
    sidebar: prefs.colors.sidebar,
  }
  for (const [k, v] of Object.entries(map)) {
    root.style.setProperty(`--disp-${k}`, v)
  }
  applyChromeFromSidebar(prefs.colors.sidebar, root.classList.contains('dark'))
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

export function isDarkHex(hex: string): boolean {
  const raw = hex.replace('#', '')
  const n = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  const r = parseInt(n.slice(0, 2), 16) || 0
  const g = parseInt(n.slice(2, 4), 16) || 0
  const b = parseInt(n.slice(4, 6), 16) || 0
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
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
