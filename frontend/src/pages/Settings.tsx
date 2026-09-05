import { useCallback, useEffect, useState } from 'react'
import { http } from '../api/client'
import type { EmailSettings, PermissionGroup, Role, User, UserSetting } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { IconBell, IconLayout, IconMail, IconSettings, IconShield, IconUser } from '../components/icons'
import { Badge } from '../components/ui'
import { useDesktopWin } from '../components/DesktopChrome'
import { DisplaySettings } from './DisplaySettings'

function roleTone(name: string) {
  return name === 'System Administrator' ? 'violet' : name === 'Project Manager' ? 'blue' : 'slate'
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-slate-200'}`}
      title={on ? '켜짐' : '꺼짐'}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`}
      />
    </button>
  )
}

function TabNav({
  tab,
  setTab,
  admin,
  desktop,
}: {
  tab: string
  setTab: (t: string) => void
  admin: boolean
  desktop: boolean
}) {
  const items = [
    { key: 'display', label: '화면 표시', icon: IconLayout },
    ...(desktop ? [{ key: 'desktop', label: '데스크톱', icon: IconSettings }] : []),
    ...(admin
      ? [
          { key: 'users', label: '사용자 관리', icon: IconUser },
          { key: 'permissions', label: '권한 설정', icon: IconShield },
          { key: 'email', label: '이메일(SMTP)', icon: IconMail },
          { key: 'delivery', label: '리포트 발송', icon: IconBell },
        ]
      : []),
  ]
  return (
    <aside className="md:w-52 shrink-0">
      <nav className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
        {items.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              tab === key
                ? 'bg-brand-50 dark:bg-brand-500/25 text-brand-700 dark:text-brand-200 ring-1 ring-brand-200 dark:ring-brand-400/40'
                : 'text-slate-500 hover:bg-surface-100 hover:text-ink-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', name: '', password: '', role_id: 0 })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    http.get<User[]>('/users').then(setUsers).catch(() => {})
    http.get<Role[]>('/users/roles').then(setRoles).catch(() => {})
  }, [])
  useEffect(load, [load])

  const changeRole = async (u: User, roleId: number) => {
    try {
      await http.put(`/users/${u.id}`, { role_id: roleId })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role_id: roleId } : x)))
      setMsg({ ok: true, text: `${u.name} 님의 역할이 변경되었습니다.` })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '변경 실패' })
    }
  }

  const toggleActive = async (u: User, active: boolean) => {
    try {
      await http.put(`/users/${u.id}`, { is_active: active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: active } : x)))
    } catch (e) {
      alert(e instanceof Error ? e.message : '변경 실패')
    }
  }

  const createUser = async () => {
    if (!form.username || !form.password || !form.role_id) {
      setMsg({ ok: false, text: '아이디, 비밀번호, 역할은 필수입니다.' })
      return
    }
    setBusy(true)
    try {
      await http.post('/users', form)
      setOpen(false)
      setForm({ username: '', email: '', name: '', password: '', role_id: 0 })
      setMsg({ ok: true, text: '사용자가 생성되었습니다.' })
      load()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '생성 실패' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">사용자 관리</h3>
          <p className="text-xs text-slate-400 mt-0.5">사용자 역할(타입) 변경 · 계정 활성화/비활성화 · 신규 사용자 등록</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + 새 사용자
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50">
            <tr className="border-b border-slate-200">
              <th className="th">사용자</th>
              <th className="th">이메일</th>
              <th className="th">역할 (변경 가능)</th>
              <th className="th text-center">활성화</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                <td className="td">
                  <span className="font-medium text-ink-700">{u.name}</span>
                  <span className="text-xs text-slate-400 ml-2">@{u.username}</span>
                </td>
                <td className="td text-xs text-slate-500">{u.email}</td>
                <td className="td">
                  <select
                    className="input !py-1 text-[13px]"
                    value={u.role_id}
                    onChange={(e) => changeRole(u, Number(e.target.value))}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </td>
                <td className="td text-center">
                  <Toggle on={u.is_active} onChange={(v) => toggleActive(u, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-ink-900 mb-4">새 사용자 등록</h4>
            <div className="space-y-3">
              <div>
                <label className="label">아이디 *</label>
                <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">이름</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">비밀번호 *</label>
                  <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">이메일</label>
                <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">역할 *</label>
                <select className="input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
                  <option value={0}>선택</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
              <button className="btn-primary" onClick={createUser} disabled={busy}>
                {busy ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PermissionMatrix() {
  const [roles, setRoles] = useState<Role[]>([])
  const [groups, setGroups] = useState<PermissionGroup[]>([])
  const [dirty, setDirty] = useState<Record<number, Set<string>>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    http
      .get<{ groups: PermissionGroup[] }>('/users/permissions/definitions')
      .then((d) => setGroups(d.groups))
      .catch(() => {})
    http
      .get<Role[]>('/users/roles')
      .then(setRoles)
      .catch(() => {})
    setDirty({})
  }, [])
  useEffect(load, [load])

  const has = (r: Role, key: string) => {
    const d = dirty[r.id]
    if (d) return d.has(key)
    return r.permissions?.includes(key) ?? false
  }

  const toggle = (r: Role, key: string, v: boolean) => {
    setDirty((prev) => {
      const set = new Set(prev[r.id] ?? new Set(r.permissions ?? []))
      if (v) set.add(key)
      else set.delete(key)
      return { ...prev, [r.id]: set }
    })
  }

  const changedRoles = () =>
    roles.filter((r) => {
      const d = dirty[r.id]
      if (!d) return false
      const base = new Set(r.permissions ?? [])
      return base.size !== d.size || [...base].some((k) => !d.has(k))
    })

  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const targets = changedRoles()
      for (const r of targets) {
        await http.put(`/users/roles/${r.id}`, { permissions: [...(dirty[r.id] ?? [])].sort() })
      }
      setMsg({ ok: true, text: targets.length ? `${targets.map((r) => r.name).join(', ')} 권한이 저장되었습니다.` : '변경 사항이 없습니다.' })
      load()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '저장 실패' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <IconShield size={15} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-ink-900">역할별 권한 설정</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">태스크 삭제 · 계획 일정 수정 · 담당자 지정 등 작업 가능 여부를 역할 단위로 제어합니다</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
          <button className="btn-primary" onClick={save} disabled={busy || changedRoles().length === 0}>
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50">
            <tr className="border-b border-slate-200">
              <th className="th min-w-[220px]">권한</th>
              {roles.map((r) => (
                <th key={r.id} className="th text-center whitespace-nowrap">
                  <Badge tone={roleTone(r.name)}>{r.name}</Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((g) => (
              <PermissionGroupRows key={g.key} group={g} roles={roles} has={has} toggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PermissionGroupRows({
  group,
  roles,
  has,
  toggle,
}: {
  group: PermissionGroup
  roles: Role[]
  has: (r: Role, key: string) => boolean
  toggle: (r: Role, key: string, v: boolean) => void
}) {
  return (
    <>
      <tr className="bg-brand-50/50">
        <td colSpan={roles.length + 1} className="px-6 py-2 text-xs font-bold text-brand-700">
          {group.label}
        </td>
      </tr>
      {group.perms.map((p) => (
        <tr key={p.key}>
          <td className="td">
            <div className="text-[13px] font-medium text-ink-700">{p.label}</div>
            <div className="text-[11px] text-slate-400">{p.desc}</div>
          </td>
          {roles.map((r) => (
            <td key={r.id} className="td text-center">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={has(r, p.key)}
                onChange={(e) => toggle(r, p.key, e.target.checked)}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function EmailSettings() {
  const [email, setEmail] = useState<EmailSettings | null>(null)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(() => {
    http
      .get<EmailSettings>('/settings/email')
      .then(setEmail)
      .catch(() => {})
  }, [])
  useEffect(load, [load])

  const save = async () => {
    if (!email) return
    try {
      await http.put('/settings/email', {
        smtp_host: email.smtp_host,
        smtp_port: email.smtp_port,
        smtp_user: email.smtp_user || '',
        smtp_password: pw,
        from_email: email.from_email,
        from_name: email.from_name,
        use_tls: email.use_tls,
        enabled: email.enabled,
      })
      setMsg({ ok: true, text: '이메일(SMTP) 설정이 저장되었습니다.' })
      setPw('')
      load()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '저장 실패' })
    }
  }

  if (!email) return <div className="text-slate-400 py-10">불러오는 중...</div>

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink-900">이메일(SMTP) 설정</h3>
        <Badge tone={email.enabled ? 'green' : 'slate'}>{email.enabled ? '활성화' : '비활성화'}</Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">SMTP 호스트</label>
          <input className="input" value={email.smtp_host} onChange={(e) => setEmail({ ...email, smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
        </div>
        <div>
          <label className="label">포트</label>
          <input type="number" className="input" value={email.smtp_port} onChange={(e) => setEmail({ ...email, smtp_port: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">사용자(계정)</label>
          <input className="input" value={email.smtp_user || ''} onChange={(e) => setEmail({ ...email, smtp_user: e.target.value })} placeholder="your@email.com" />
        </div>
        <div>
          <label className="label">비밀번호{email.has_smtp_password ? ' (저장됨 — 변경 시 입력)' : ''}</label>
          <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="앱 비밀번호" />
        </div>
        <div>
          <label className="label">보낸 이메일(From)</label>
          <input className="input" value={email.from_email} onChange={(e) => setEmail({ ...email, from_email: e.target.value })} />
        </div>
        <div>
          <label className="label">보낸 이름</label>
          <input className="input" value={email.from_name} onChange={(e) => setEmail({ ...email, from_name: e.target.value })} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-6 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={email.use_tls} onChange={(e) => setEmail({ ...email, use_tls: e.target.checked })} />
          TLS 사용 (STARTTLS)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Toggle on={email.enabled} onChange={(v) => setEmail({ ...email, enabled: v })} />
          발송 활성화
        </label>
        <button className="btn-primary ml-auto" onClick={save}>
          저장
        </button>
        {msg && <span className={`text-xs ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}

function DeliverySettings() {
  const [users, setUsers] = useState<UserSetting[]>([])

  const load = useCallback(() => {
    http
      .get<UserSetting[]>('/settings/users')
      .then(setUsers)
      .catch(() => {})
  }, [])
  useEffect(load, [load])

  const toggleUser = async (u: UserSetting, key: 'deliver_daily' | 'deliver_weekly', v: boolean) => {
    const body = key === 'deliver_daily' ? { deliver_daily: v } : { deliver_weekly: v }
    try {
      await http.put(`/settings/users/${u.user_id}`, body)
      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, [key]: v } : x)))
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패')
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-900">사용자 리포트 발송 권한</h3>
        <span className="text-xs text-slate-400">데일리(개발자) / 위클리(관리자) 수신 여부</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-50">
            <tr className="border-b border-slate-200">
              <th className="th">사용자</th>
              <th className="th">이메일</th>
              <th className="th">역할</th>
              <th className="th text-center">데일리 수신</th>
              <th className="th text-center">위클리 수신</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.user_id} className={u.is_active ? '' : 'opacity-50'}>
                <td className="td">
                  <span className="font-medium text-ink-700">{u.name}</span>
                  <span className="text-xs text-slate-400 ml-2">@{u.username}</span>
                </td>
                <td className="td text-xs text-slate-500">{u.email}</td>
                <td className="td">
                  <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                </td>
                <td className="td text-center">
                  <Toggle on={u.deliver_daily} onChange={(v) => toggleUser(u, 'deliver_daily', v)} />
                </td>
                <td className="td text-center">
                  <Toggle on={u.deliver_weekly} onChange={(v) => toggleUser(u, 'deliver_weekly', v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DesktopAppSettings() {
  return (
    <div className="card p-6 space-y-3">
      <h2 className="font-semibold text-ink-900">단축키 · 서버</h2>
      <p className="text-sm text-slate-500">전역 단축키와 백엔드 서버 주소를 바꿉니다.</p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => window.dispatchEvent(new CustomEvent('flowplan-open-desk-settings'))}
      >
        데스크톱 설정 열기
      </button>
    </div>
  )
}

export function Settings() {
  const { user } = useAuth()
  const { desk } = useDesktopWin()
  const admin = user?.role_name === 'System Administrator'
  const [tab, setTab] = useState('display')

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 grid place-items-center">
          <IconSettings size={19} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">설정</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {admin ? '화면 표시 · 사용자 · 권한 · 이메일 · 리포트 발송' : '완료·지연 등 화면 요소를 이 기기에 맞게 바꿉니다'}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <TabNav tab={tab} setTab={setTab} admin={admin} desktop={desk} />
        <div className="flex-1 min-w-0">
          {tab === 'display' && <DisplaySettings />}
          {desk && tab === 'desktop' && <DesktopAppSettings />}
          {admin && tab === 'users' && <UserManagement />}
          {admin && tab === 'permissions' && <PermissionMatrix />}
          {admin && tab === 'email' && <EmailSettings />}
          {admin && tab === 'delivery' && <DeliverySettings />}
        </div>
      </div>
    </div>
  )
}