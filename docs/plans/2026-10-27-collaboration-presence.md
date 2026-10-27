# 동시 편집 대응: 편집 중 표시(presence) + 덮어쓰기 방지(낙관적 잠금)

## 배경

현재 여러 사용자가 같은 프로젝트를 동시에 편집할 수 있으나
- 실시간 동기화(WebSocket/SSE)·폴링이 없어 다른 사람의 변경은 새로고침해야 보이고,
- 버전/잠금이 없어 **나중에 저장한 사람이 조용히 덮어쓴다**(`TaskDetail.saveEdit`가 폼 전체를 PUT).

## 목표

1. **편집 중 표시(A)**: 프로젝트 화면·태스크 상세에서 "누가 지금 편집 중"인지 보여준다(구글독스식 presence).
2. **덮어쓰기 방지(D)**: 다른 사람이 먼저 저장했으면 409로 거부하고 최신 내용을 다시 불러오게 한다.

## 설계

### D. 낙관적 잠금 — `revision` 정수
- `Task.revision`(기본 1) 추가. `updated_at`을 쓰지 않는 이유:
  엔진(`apply_engine_progress`, 부모 일정 자동 집계)이 사용자 편집 없이도 행을 갱신해
  오탐(불필요한 409)이 생기기 때문. **사용자 편집에서만** 증가시킨다.
- `TaskUpdate.expected_revision: int | None` — 값이 있을 때만 검사.
  불일치 시 **409** + 안내 문자열(다른 사용자가 먼저 저장).
- 성공 시 `task.revision += 1` (엔진 갱신 경로는 건드리지 않음).
- `TaskRead.revision`으로 노출. 기존 클라이언트(값 미전송)는 그대로 동작.
- 기존 DB는 `ensure_schema()`에 `ALTER TABLE tasks ADD COLUMN revision INTEGER DEFAULT 1` 추가.

### A. 편집 중 표시 — `edit_presence` 테이블 + 하트비트
- 테이블: `edit_presence(project_id, user_id unique, task_id nullable, updated_at)`.
  `Base.metadata.create_all`이 신규 테이블을 만들므로 마이그레이션 불필요.
- API (`/projects/{project_id}/presence`):
  - `POST` `{task_id?: int}` — 내 하트비트 upsert(만료 60초 초과 행은 정리)
  - `GET` — 활성 편집자 목록 `[{user_id, user_name, task_id, updated_at}]`
  - `DELETE` — 내 행 제거(페이지 이탈)
- 프론트:
  - `usePresence(projectId, {taskId, enabled})`: 15초 하트비트 + 5초 폴링, 탭 숨김 시 중단,
    언마운트 시 DELETE.
  - TaskDetail: "김OO 님이 편집 중" 배지(자신 제외) — 같은 태스크면 강조.
  - Schedule: 상단 "지금 편집 중: 김OO (Task #12) · …" 스트립, 태스크 링크 이동.

## 단계 (TDD)

1. `backend/tests/test_collab.py` 작성 → RED
   - 두 사용자(admin, pm_a) presence 공유/해제
   - 만료된 하트비트는 목록에서 제외
   - `expected_revision` 불일치 시 409, 최신 값으로 재시도 성공, 미전송 시 기존 동작
2. 백엔드 구현 → GREEN: 모델/스키마/마이그레이션, presence 라우터, update_task 잠금
3. 프론트: 타입·`lib/presence.ts`(훅)·TaskDetail(배지+409 처리)·Schedule(스트립)
4. 검증: `pytest tests/`, `npx tsc -b`, `npx vite build`
5. N100 재배포: `deploy/sync.sh` → `hub_deploy_apply(confirmed=true)` → 실제 presence API 확인

## 범위 밖 / 후속
- SSE 실시간 push(B) — presence 폴링으로 시작하고 필요 시 확장
- 텍스트 공동 편집(CRDT/OT, C) — 일정 데이터에는 도입하지 않음
- 커밋/푸시는 사용자 요청 시
