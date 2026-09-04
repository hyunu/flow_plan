import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { http } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Notification } from '../api/types'
import {
  IconBell,
  IconChallenge,
  IconLogout,
  IconManual,
  IconMoon,
  IconProjects,
  IconReport,
  IconSettings,
  IconSun,
} from './icons'

const nav = [
  { to: '/projects', label: '프로젝트', icon: IconProjects },
  { to: '/challenges', label: '오늘의 챌린지', icon: IconChallenge },
  { to: '/reports', label: '리포트', icon: IconReport },
  { to: '/manual', label: '설명서', icon: IconManual },
]

const roleTone: Record<string, string> = {
  'System Administrator': 'bg-white/10 text-white ring-white/15',
  'Project Manager': 'bg-white/5 text-white/85 ring-white/10',
  'Project Member': 'bg-white/8 text-white/70 ring-white/10',
}

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === '1')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('flowplan_theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggleCollapse = () =>
    setCollapsed((v) => {
      localStorage.setItem('sidebar_collapsed', v ? '0' : '1')
      return !v
    })

  // 사이드바 툴팁: body 최상단(Portal)에 렌더해 다른 컨트롤에 가리지 않음
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null)
  const showTip = (e: React.MouseEvent | React.FocusEvent, label: string) => {
    if (!collapsed) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTip({ label, x: r.right + 10, y: r.top + r.height / 2 })
  }
  const hideTip = () => setTip(null)

  useEffect(() => {
    http
      .get<Notification[]>('/notifications')
      .then(setNotifs)
      .catch(() => {})
  }, [])

  const unread = notifs.filter((n) => !n.is_read).length
  const roleName = user?.role_name || ''

const navLinkCls = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center rounded-xl text-sm font-medium transition-all ${
    collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3 py-2.5'
  } ${
    isActive
      ? 'bg-white/20 text-white shadow-inner ring-1 ring-white/15'
      : 'hover:bg-white/5 hover:text-white/80'
  } ${
    isActive && !collapsed
      ? "after:content-[''] after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:w-[3px] after:h-5 after:rounded-full after:bg-white after:shadow-[0_0_8px_rgba(255,255,255,0.6)]"
      : ''
  }`

  const sectionTitle = (text: string) =>
    collapsed ? (
      <div className="h-2" />
    ) : (
      <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">{text}</div>
    )

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — 데스크톱: 고정 / 모바일: 햄버거로 여는 오버레이 드로어 */}
      <aside
        className={`${
          mobileNav ? 'fixed inset-y-0 left-0 z-50' : 'hidden lg:flex'
        } bg-black text-white/45 flex flex-col shrink-0 h-screen transition-all duration-200 ${
          mobileNav ? 'w-44 shadow-2xl' : collapsed ? 'w-[68px]' : 'w-44'
        }`}
      >
        {/* 헤더: 로고 */}
        <div className={`h-16 flex items-center border-b border-white/5 ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 grid place-items-center text-white font-bold text-sm shadow-lg shadow-brand-900/30 shrink-0">
            F
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-white font-semibold text-[15px] leading-tight">Flow Plan</div>
              <div className="text-[11px] text-slate-500 leading-tight truncate">프로젝트 리스크 관리</div>
            </div>
          )}
        </div>

        {/* 경계선 수직 중앙의 원형 접기/펼치기 버튼 */}
        <button
          onClick={toggleCollapse}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-6 rounded-full bg-card border border-slate-300 dark:border-slate-600 shadow-md grid place-items-center text-slate-500 hover:text-ink-900 hover:border-brand-400 transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={collapsed ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6'} />
          </svg>
        </button>

        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? 'px-1.5' : 'px-3'}`} onClick={() => setMobileNav(false)}>
          {sectionTitle('메뉴')}
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={navLinkCls}
              onMouseEnter={(e) => showTip(e, label)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(e, label)}
              onBlur={hideTip}
            >
              <Icon size={18} className="shrink-0 text-white/40 group-hover:text-white/80" />
              {!collapsed && label}
            </NavLink>
          ))}
          {user?.role_name === 'System Administrator' && (
            <>
              {sectionTitle('시스템')}
              <NavLink
                to="/settings"
                className={navLinkCls}
                onMouseEnter={(e) => showTip(e, '관리자 설정')}
                onMouseLeave={hideTip}
                onFocus={(e) => showTip(e, '관리자 설정')}
                onBlur={hideTip}
              >
                <IconSettings size={18} className="shrink-0 text-white/40 group-hover:text-white/80" />
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
                <span className={`badge mt-0.5 ring-1 ${roleTone[roleName] || 'bg-white/10 text-white/75 ring-white/10'}`}>
                  {roleName}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setConfirmLogout(true)}
            onMouseEnter={(e) => showTip(e, '로그아웃')}
            onMouseLeave={hideTip}
            onFocus={(e) => showTip(e, '로그아웃')}
            onBlur={hideTip}
            className={`group relative flex items-center rounded-lg text-[13px] text-white/45 hover:text-white hover:bg-white/5 w-full transition-colors ${
              collapsed ? 'justify-center w-11 h-10 mx-auto' : 'gap-2.5 px-3 py-2'
            }`}
          >
            <IconLogout size={15} className="shrink-0" />
            {!collapsed && '로그아웃'}
          </button>
        </div>
      </aside>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4" onClick={(e) => e.target === e.currentTarget && setConfirmLogout(false)}>
          <div className="w-full max-w-sm bg-card rounded-2xl shadow-lift ring-1 ring-slate-200 overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-ink-900">로그아웃</h3>
              <button onClick={() => setConfirmLogout(false)} className="w-7 h-7 rounded-lg text-slate-400 hover:text-ink-700 hover:bg-surface-100 transition-colors" title="닫기">
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 leading-relaxed">정말 로그아웃 하시겠습니까?</p>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setConfirmLogout(false)} className="btn-secondary">취소</button>
                <button
                  onClick={async () => {
                    await logout()
                    navigate('/login')
                  }}
                  className="btn bg-red-600 text-white hover:bg-red-700 shadow-sm"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card/80 backdrop-blur border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileNav(true)}
              className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-surface-100 hover:text-ink-700 transition-colors"
              aria-label="메뉴 열기"
              title="메뉴"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-sm text-slate-400 font-medium">Flow Plan</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((v) => !v)}
              className="p-2 rounded-lg text-slate-500 hover:bg-surface-100 hover:text-ink-700 transition-colors"
              title={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowNotifs((v) => !v)}
                className="relative p-2 rounded-lg text-slate-500 hover:bg-surface-100 hover:text-ink-700 transition-colors"
                title="알림"
              >
                <IconBell size={18} />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-slate-500 rounded-full ring-2 ring-card" />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-96 bg-card rounded-2xl shadow-lift ring-1 ring-slate-200 z-50 overflow-hidden animate-fade-in">
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
        <main className="flex-1 px-4 sm:px-8 py-7">
          <Outlet />
        </main>
      </div>

      {/* 모바일 드로어 백드롭 */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileNav(false)} />
      )}

      {/* 사이드바 툴팁 — body 최상단 Portal */}
      {tip &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none -translate-y-1/2 flex items-center"
            style={{ left: tip.x, top: tip.y }}
            role="tooltip"
          >
            <span className="w-0 h-0 border-y-[5px] border-y-transparent border-r-[6px] border-r-neutral-900 dark:border-r-neutral-800" />
            <span className="whitespace-nowrap rounded-md bg-neutral-900 dark:bg-neutral-800 text-white text-xs font-medium px-2.5 py-1.5 shadow-lg ring-1 ring-black/10">
              {tip.label}
            </span>
          </div>,
          document.body,
        )}
    </div>
  )
}