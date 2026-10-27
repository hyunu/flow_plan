import { useEffect, useState } from 'react'
import { http } from '../api/client'
import type { PresenceEntry } from '../api/types'

/**
 * 편집 중(presence) 공유 훅.
 *
 * - 15초마다 하트비트(POST)로 "내가 이 태스크/프로젝트를 보고 있다"를 알린다.
 * - 5초마다 목록(GET)을 폴링해 다른 사람의 상태를 갱신한다.
 * - 탭이 숨겨지면 요청을 멈추고, 다시 보이면 즉시 한 번 보낸다.
 * - 언마운트 시 DELETE로 내 표시를 지운다(실패해도 서버 TTL 60초가 정리).
 */
const HEARTBEAT_MS = 15_000
const POLL_MS = 5_000

export function usePresence(
  projectId: number,
  { taskId = null, enabled = true }: { taskId?: number | null; enabled?: boolean } = {},
): PresenceEntry[] {
  const [entries, setEntries] = useState<PresenceEntry[]>([])

  useEffect(() => {
    if (!enabled || !Number.isFinite(projectId) || projectId <= 0) {
      setEntries([])
      return
    }
    let stopped = false

    const apply = (rows: PresenceEntry[]) => {
      if (!stopped) setEntries(rows)
    }
    const beat = () => {
      if (document.visibilityState === 'hidden') return
      http
        .post<PresenceEntry[]>(`/projects/${projectId}/presence`, { task_id: taskId ?? null })
        .then(apply)
        .catch(() => {})
    }
    const poll = () => {
      if (document.visibilityState === 'hidden') return
      http.get<PresenceEntry[]>(`/projects/${projectId}/presence`).then(apply).catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        beat()
        poll()
      }
    }

    beat()
    const hb = window.setInterval(beat, HEARTBEAT_MS)
    const pl = window.setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      window.clearInterval(hb)
      window.clearInterval(pl)
      document.removeEventListener('visibilitychange', onVisibility)
      http.del(`/projects/${projectId}/presence`).catch(() => {})
    }
  }, [projectId, taskId, enabled])

  return entries
}

/** 다른 사람만 추린다. */
export function othersOf(entries: PresenceEntry[]): PresenceEntry[] {
  return entries.filter((e) => !e.is_self)
}
