import type { ChangeImpact } from '../api/types'

/**
 * 마지막 일정 변경의 영향(impact)을 프로젝트별로 잠시 기억해 둔다.
 *
 * 일정 편집은 태스크 상세에서, 하이라이트는 간트/테이블에서 보여야 하므로
 * 페이지를 건너뛸 수 있다. localStorage + 브라우저 이벤트로 연결한다.
 */

const STORAGE_KEY = 'flowplan:last_change_impact'
/** 표시 유지 시간 — 지나간 변경의 마커가 계속 남지 않도록 한다. */
const TTL_MS = 6 * 60 * 60 * 1000
export const CHANGE_IMPACT_EVENT = 'flowplan:change-impact'

export interface StoredChangeImpact {
  projectId: number
  taskId: number
  /** 저장 시각 (ms) */
  at: number
  impact: ChangeImpact
}

/** 간트/테이블 하이라이트용 축약 표현 */
export interface ImpactHighlight {
  changedId: number | null
  affectedIds: number[]
}

/** 저장된 영향을 하이라이트 형태로 변환한다 (없으면 null). */
export function toHighlight(stored: StoredChangeImpact | null): ImpactHighlight | null {
  if (!stored?.impact) return null
  return {
    changedId: stored.impact.changed_task_id ?? null,
    affectedIds: stored.impact.affected_task_ids ?? [],
  }
}

function readAll(): Record<string, StoredChangeImpact> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, StoredChangeImpact>) : {}
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, StoredChangeImpact>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* 저장 실패(사용량 초과 등)는 무시 — 하이라이트는 사라질 뿐이다 */
  }
}

/** 일정 변경 직후 저장한다. 같은 프로젝트의 이전 기록은 덮어쓴다. */
export function saveChangeImpact(projectId: number, taskId: number, impact: ChangeImpact): void {
  const all = readAll()
  all[String(projectId)] = { projectId, taskId, at: Date.now(), impact }
  writeAll(all)
  window.dispatchEvent(new CustomEvent(CHANGE_IMPACT_EVENT, { detail: { projectId } }))
}

/** 프로젝트의 최근 변경 영향을 읽는다. TTL이 지난 기록은 반환하지 않고 정리한다. */
export function readChangeImpact(projectId: number): StoredChangeImpact | null {
  const all = readAll()
  const entry = all[String(projectId)]
  if (!entry) return null
  if (Date.now() - entry.at > TTL_MS) {
    delete all[String(projectId)]
    writeAll(all)
    return null
  }
  return entry
}

/** 배너 닫기 등으로 즉시 없앤다. */
export function clearChangeImpact(projectId: number): void {
  const all = readAll()
  if (!(String(projectId) in all)) return
  delete all[String(projectId)]
  writeAll(all)
  window.dispatchEvent(new CustomEvent(CHANGE_IMPACT_EVENT, { detail: { projectId } }))
}
