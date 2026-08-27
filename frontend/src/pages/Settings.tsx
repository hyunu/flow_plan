import { useEffect, useState } from 'react'
import { http } from '../api/client'
import type { EmailSettings, UserSetting } from '../api/types'
import { IconMail } from '../components/icons'
import { Badge } from '../components/ui'

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

export function Settings() {
  const [email, setEmail] = useState<EmailSettings | null>(null)
  const [users, setUsers] = useState<UserSetting[]>([])
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = () => {
    http
      .get<EmailSettings>('/settings/email')
      .then(setEmail)
      .catch(() => {})
    http
      .get<UserSetting[]>('/settings/users')
      .then(setUsers)
      .catch(() => {})
  }
  useEffect(load, [])

  const saveEmail = async () => {
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

  const toggleUser = async (u: UserSetting, key: 'deliver_daily' | 'deliver_weekly', v: boolean) => {
    const body = key === 'deliver_daily' ? { deliver_daily: v } : { deliver_weekly: v }
    try {
      await http.put(`/settings/users/${u.user_id}`, body)
      setUsers((prev) => prev.map((x) => (x.user_id === u.user_id ? { ...x, [key]: v } : x)))
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패')
    }
  }

  if (!email) return <div className="text-slate-400 py-10">불러오는 중...</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 grid place-items-center">
          <IconMail size={19} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">관리자 설정</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">이메일 발송 · 사용자 리포트 권한 (관리자 전용)</p>
        </div>
      </div>

      {msg && (
        <div className={`card p-3 text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</div>
      )}

      {/* SMTP 설정 */}
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
          <button className="btn-primary ml-auto" onClick={saveEmail}>
            저장
          </button>
        </div>
      </div>

      {/* 사용자 발송 권한 */}
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
                    <Badge tone={u.role === 'System Administrator' ? 'violet' : u.role === 'Project Manager' ? 'blue' : 'slate'}>
                      {u.role}
                    </Badge>
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
    </div>
  )
}