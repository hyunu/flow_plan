import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { http } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Notification } from '../api/types'
import {
  IconBell,
  IconChallenge,
  IconLogout,
  IconProjects,
  IconReport,
} from './icons'

const nav = [
  { to: '/projects', label: '프로젝트', icon: IconProjects },
  { to: '/challenges', label: 'Daily Challenge', icon: IconChallenge },
  { to: '/reports', label: '리포트', icon: IconReport },
]

const roleTone: Record<string, string> = {
  'System Administrator': 'bg-violet-50 text-violet-600 ring-violet-200',
  'Project Manager': 'bg-brand-50 text-brand-600 ring-brand-200',
  'Project Member': 'bg-emerald-50 text-emerald-600 ring-emerald-200',
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)

  useEffect(() => {
    http
      .get<Notification[]>('/notifications')
      .then(setNotifs)
      .catch(() => {})
  }, [])

  const unread = notifs.filter((n) => !n.is_read).length
  const roleName = user?.role_name || ''

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-ink-900 text-slate-400 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center text-white font-bold text-sm shadow-lg shadow-brand-900/30">
            F
          </div>
          <div>
            <div className="text-white font-semibold text-[15px] leading-tight">Flow Plan</div>
            <div className="text-[11px] text-slate-500 leading-tight">일정 · 진척 관리</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            메뉴
          </div>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive: active }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/10 text-white shadow-inner'
                    : 'hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon size={17} className="text-slate-500 group-hover:text-slate-300" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/5 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 ring-1 ring-white/10 grid place-items-center text-white text-sm font-semibold">
              {user?.name?.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white font-medium truncate">{user?.name}</div>
              <span className={`badge mt-0.5 ring-1 ${roleTone[roleName] || 'bg-slate-700 text-slate-300 ring-slate-600'}`}>
                {roleName}
              </span>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-slate-500 hover:text-white hover:bg-white/5 w-full transition-colors"
          >
            <IconLogout size={15} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="text-sm text-slate-400 font-medium">Flow Plan</div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowNotifs((v) => !v)}
                className="relative p-2 rounded-lg text-slate-500 hover:bg-surface-100 hover:text-ink-700 transition-colors"
                title="알림"
              >
                <IconBell size={18} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-lift ring-1 ring-slate-200 z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-sm text-ink-900">알림</span>
                    <span className="text-xs text-slate-400">{unread}개 미확인</span>
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-50">
                    {notifs.length === 0 ? (
                      <div className="px-4 py-10 text-center text-sm text-slate-400">
                        알림이 없습니다
                      </div>
                    ) : (
                      notifs.slice(0, 30).map((n) => (
                        <div key={n.id} className="px-4 py-3 hover:bg-surface-50">
                          <div className="text-[11px] font-semibold text-slate-400 uppercase">
                            {n.title}
                          </div>
                          <div className="text-sm text-ink-700 mt-0.5 line-clamp-2">{n.body}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-8 py-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}