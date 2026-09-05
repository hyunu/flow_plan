// API 클라이언트: Access Token 자동 부착 + Refresh Token 자동 갱신

const FALLBACK = import.meta.env.VITE_API_BASE || '/api'
const API_KEY = 'flowplan_api_base'

export function getApiBase(): string {
  const w = window as unknown as { __FLOWPLAN_API_BASE?: string }
  if (w.__FLOWPLAN_API_BASE) return w.__FLOWPLAN_API_BASE.replace(/\/$/, '')
  const saved = localStorage.getItem(API_KEY)?.trim()
  if (saved) return saved.replace(/\/$/, '')
  return FALLBACK
}

export function applyApiBase(url: string) {
  const w = window as unknown as { __FLOWPLAN_API_BASE?: string }
  const clean = (url || '').trim().replace(/\/$/, '')
  if (!clean || clean === '/api') {
    delete w.__FLOWPLAN_API_BASE
    localStorage.removeItem(API_KEY)
    return
  }
  w.__FLOWPLAN_API_BASE = clean
  localStorage.setItem(API_KEY, clean)
}

function BASE() {
  return getApiBase()
}

type TokenPair = { access_token: string; refresh_token: string }

const TOKEN_KEY = 'flowplan_tokens'

export function getTokens(): TokenPair | null {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TokenPair
  } catch {
    return null
  }
}

export function setTokens(t: TokenPair) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t))
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const tokens = getTokens()
  if (!tokens?.refresh_token) throw new Error('no refresh token')
  const res = await fetch(`${BASE()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: tokens.refresh_token }),
  })
  if (!res.ok) {
    clearTokens()
    throw new Error('refresh failed')
  }
  const pair = (await res.json()) as TokenPair
  setTokens(pair)
  return pair.access_token
}

async function rawRequest(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const tokens = getTokens()
  const headers = new Headers(init.headers || {})
  if (tokens) headers.set('Authorization', `Bearer ${tokens.access_token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let res = await fetch(`${BASE()}${path}`, { ...init, headers })

  if (res.status === 401 && tokens && retry) {
    try {
      const access = await (refreshPromise ||= refreshAccessToken().finally(() => {
        refreshPromise = null
      }))
      headers.set('Authorization', `Bearer ${access}`)
      res = await fetch(`${BASE()}${path}`, { ...init, headers })
    } catch {
      return res
    }
  }
  return res
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await rawRequest(path, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).join(', ')
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const http = {
  get: <T = unknown>(path: string) => api<T>(path),
  post: <T = unknown>(path: string, body?: unknown, isForm = false) =>
    api<T>(path, {
      method: 'POST',
      body:
        body === undefined
          ? undefined
          : isForm
            ? (body as URLSearchParams).toString()
            : JSON.stringify(body),
      headers: isForm ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
    }),
  put: <T = unknown>(path: string, body?: unknown) =>
    api<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T = unknown>(path: string) => api<T>(path, { method: 'DELETE' }),
}

export const fmt = {
  date: (d?: string | null) => (d ? d.slice(0, 10) : '-'),
  pct: (n?: number | null) => (n == null ? '-' : `${Math.round(n)}%`),
}