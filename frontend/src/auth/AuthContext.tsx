import { createContext, useCallback, useContext, useState } from 'react'
import { clearTokens, getTokens, http, setTokens } from '../api/client'
import type { User } from '../api/types'

interface AuthCtx {
  user: User | null
  loaded: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loaded, setLoaded] = useState(false)

  const refreshMe = useCallback(async () => {
    if (!getTokens()) {
      setLoaded(true)
      return
    }
    try {
      const me = await http.get<User>('/auth/me')
      setUser(me)
    } catch {
      clearTokens()
    } finally {
      setLoaded(true)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const form = new URLSearchParams()
    form.set('username', username)
    form.set('password', password)
    const pair = await http.post<{ access_token: string; refresh_token: string }>('/auth/login', form, true)
    setTokens(pair)
    const me = await http.get<User>('/auth/me')
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout')
    } catch {
      /* ignore */
    }
    clearTokens()
    setUser(null)
  }, [])

  return (
    <Ctx.Provider value={{ user, login, logout, refreshMe, loaded }}>{children}</Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useCan(): (perm: string) => boolean {
  const { user } = useAuth()
  return (perm: string) => {
    const perms = user?.permissions
    return Array.isArray(perms) ? perms.includes(perm) : false
  }
}