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
  IconSettings,
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
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1')

  const toggleCollapse = () =>
    setCollapsed((v) => {
      localStorage.setItem('sidebar_collapsed', v ? '0' : '1')
      return !v
    })

  useEffect(() => {
    http
      .get<Notification[]>('/notifications')
      .then(setNotifs)
      .catch(() => {})
  }, [])

  const unread = notifs.filter((n) => !n.is_read).length
  const roleName = user?.role_name || ''

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center rounded-xl text-sm font-medium transition-all ${
      collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3 py-2.5'
    } ${isActive ? 'bg-white/10 text-white shadow-inner' : 'hover:bg-white/5 hover:text-slate-200'}`

  const sectionTitle = (text: string) =>
    collapsed ? (
      <div className="h-2" />
    ) : (
      <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">{text}</div>
    )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={`bg-ink-900 text-slate-400 flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-200 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {/* 헤더: 로고 + 접기 버튼 */}
        <div className={`h-16 flex items-center border-b border-white/5 ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center text-white font-bold text-sm shadow-lg shadow-brand-900/30 shrink-0">
            F
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-white font-semibold text-[15px] leading-tight">Flow Plan</div>
              <div className="text-[11px] text-slate-500 leading-tight truncate">일정 · 진척 관리</div>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {collapsed ? <path d="m9 18 6-6-6-6" /> : <path d="m15 18-6-6 6-6" />}
            </svg>
          </button>
        </div>

        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          {sectionTitle('메뉴')}
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkCls} title={collapsed ? label : undefined}>
              <Icon size={18} className={`shrink-0 text-slate-500 group-hover:text-slate-300 ${collapsed ? '' : ''}`} />
              {!collapsed && label}
            </NavLink>
          ))}
          {user?.role_name === 'System Administrator' && (
            <>
              {sectionTitle('시스템')}
              <NavLink to="/settings" className={navLinkCls} title={collapsed ? '관리자 설정' : undefined}>
                <IconSettings size={18} className="shrink-0 text-slate-500 group-hover:text-slate-300" />
                {!collapsed && '관리자 설정'}
              </NavLink>
            </>
          )}
        </nav>

        {/* 하단 사용자 */}
        <div className={`py-4 border-t border-white/5 space-y-3 ${collapsed ? 'px-2' : 'px-4'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-1'}`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 ring-1 ring-white/10 grid place-items-center text-white text-sm font-semibold shrink-0">
              {user?.name?.slice(0, 1)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white font-medium truncate">{user?.name}</div>
                <span className={`badge mt-0.5 ring-1 ${roleTone[roleName] || 'bg-slate-700 text-slate-300 ring-slate-600'}`}>
                  {roleName}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
            className={`flex items-center rounded-lg text-[13px] text-slate-500 hover:text-white hover:bg-white/5 w-full transition-colors ${
              collapsed ? 'justify-center w-11 h-10 mx-auto' : 'gap-2.5 px-3 py-2'
            }`}
            title={collapsed ? '로그아웃' : undefined}
          >
            <IconLogout size={15} className="shrink-0" />
            {!collapsed && '로그아웃'}
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