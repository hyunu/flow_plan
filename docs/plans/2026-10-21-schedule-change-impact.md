# 일정 변경 영향 시각화 (2026-10-21)

## 목표
일정(시작/종료/작업량) 변경이 전체 일정에 미치는 영향을 사용자가 바로 볼 수 있게, 다음 우선순위로 구현한다.

1. **변경 직후 영향 배너** — 저장 직후 "프로젝트 예측 완료 10/17 → 10/22 (+5일), 영향 태스크 3건" 표시
2. **간트/테이블 변경 마커** — 변경된 태스크와 영향받은 하위 태스크를 하이라이트 + 배지
3. **예측 스냅샷 비교** — S-Curve에 "이전 예측 vs 지금 예측" 오버레이
4. **시작일 변경 노출** — 변경 이력/대시보드에 시작일 before→after 표시

## 설계

### 백엔드
- **영향 계산**: `PUT /tasks/{id}`에서 일정 필드가 바뀌면(기존 `schedule_changed` 분기) 변경 **전**
  `compute_project_schedule()` 결과와 변경 **후** `apply_engine_progress()` 결과를 비교한다.
- **표시 완료일 규칙 통일**: `schedule_service.display_finishes(db, project, result)` 헬퍼 신설
  = 마지막 마일스톤 `end_date` + `expected_delay_days`, 마일스톤 없으면 엔진 값.
  `dashboard.py`와 `tasks.py`가 공용 사용 → 토스트와 대시보드 완료일 불일치 제거.
- **저장**: `ScheduleChange.project_impact` (현재 미사용 죽은 컬럼)에 JSON 문자열. 마이그레이션 불필요.
- **반환**: `TaskRead.impact: ChangeImpact | None` (변경 응답에만 채워짐, 기존 클라이언트 무해).
- **예측 스냅샷(우선순위 ③)**: 변경 적용 **전** 결과를 `Forecast` 행으로 저장.
  - `data_used` JSON에 `forecast_curve`(및 planned/forecast finish) 포함, 프로젝트당 최신 10건만 유지.
  - 대시보드가 최신 행을 `prev_forecast_finish` / `prev_forecast_at` / `prev_forecast_curve`로 반환.
- **시작일(우선순위 ④)**: `recent_changes` 응답에 `before_start` / `after_start` 추가.

### 프론트
- `src/lib/changeImpact.ts`: 마지막 변경 영향을 localStorage에 저장(TTL 6시간, 저장/삭제 시 이벤트 방출).
  TaskDetail에서 편집 → 간트 페이지 이동 후에도 마커 유지.
- **우선순위 ①**: `TaskDetail.saveEdit`이 응답의 `impact`를 받아 배너 표시 + 저장소 기록.
- **우선순위 ②**: `Schedule` 페이지 상단 요약 배너 + `Gantt`/`TaskTable`에 `changeImpact` prop
  (변경 태스크 = 솔리드 앰버 링 + "변경" 배지, 영향 태스크 = 점선 링 + "영향" 배지).
- **우선순위 ③**: `ProgressChart`에 `prevForecastCurve`/`prevForecastFinish` 오버레이(연한 점선) + 범례 항목.
- **우선순위 ④**: Dashboard 최근 변경 카드에 시작일 변경 표시, TaskDetail 이력 테이블에 시작일 컬럼.

## impact 구조 (ChangeImpact)
```json
{
  "changed_task_id": 12,
  "task_before": {"plan_start": "2026-11-02", "plan_end": "2026-11-06", "workload": 40},
  "task_after":  {"plan_start": "2026-11-09", "plan_end": "2026-11-06", "workload": 40},
  "planned_before": "2026-11-11", "planned_after": "2026-11-18",
  "forecast_before": "2026-11-11", "forecast_after": "2026-11-18",
  "forecast_delta_days": 7,
  "delay_days_before": 0, "delay_days_after": 0,
  "affected_task_ids": [12, 13],
  "newly_delayed_task_ids": []
}
```
- `affected_task_ids` = before/after 비교에서 `forecast_finish` 또는 `delay_days`가 달라진 태스크
- `newly_delayed_task_ids` = 그중 `delay_days`가 0 → 양수가 된 태스크
- 날짜는 작업일 차이가 아닌 **달력일 차이**로 `forecast_delta_days` 산출(지표 카드 `expected_delay_days`와 동일 기준)

## 단계 (TDD, 각 단계 검증 후 진행)

### 1. 테스트 골격 작성 — RED
파일: `backend/tests/test_impact.py` (픽처는 `test_security.py` 패턴: drop_all → create_all → seed → client/admin)
- `test_start_change_moves_forecast`: 프로젝트/태스크 A·B(FS 의존) 생성 → A `plan_start`를 1주 연기
  → 응답 `impact.forecast_delta_days == 7`, `affected_task_ids`에 B 포함,
  대시보드 `recent_changes[0]`에 `before_start`/`after_start` 존재
- `test_pull_end_creates_delay`: A `plan_end`를 당기면 `delay_days_after > delay_days_before`,
  A가 `newly_delayed_task_ids`에 포함
- `test_impact_stored_in_history`: `GET /tasks/{A}/history` 최신 행 `project_impact`가 유효 JSON이며
  응답 impact와 forecast_after 일치
- `test_forecast_snapshot_taken`: `GET /projects/{id}/forecast` 행 수 +1, 최신 `data_used`에 `forecast_curve`
검증: `pytest tests/test_impact.py` → 전부 실패(현재 구현에 impact 없음)

### 2. display_finishes 헬퍼 + dashboard 레퍼팩터
파일: `backend/app/services/schedule_service.py`, `backend/app/api/dashboard.py`
- `display_finishes(db, project, result) -> tuple[date | None, date | None]` 신설(마일스톤 기준 로직 이동)
- `dashboard.py` 63-70행 동일 로직을 헬퍼 호출로 교체(동작 불변)
검증: `pytest tests/` (기존 33건 유지)

### 3. build_change_impact + update_task 연동 + 스키마 — GREEN(①의 백엔드)
파일: `schedule_service.py`, `backend/app/api/tasks.py`, `backend/app/schemas/__init__.py`
- `build_change_impact(before, after, before_display, after_display, changed_task_id, task_before, task_after) -> dict`
- `ChangeImpact(BaseModel)` 스키마 + `TaskRead.impact: ChangeImpact | None = None`
- `update_task`: 변경 전 스냅샷/상태 캡처 → 적용 → `apply_engine_progress` 결과와 비교 →
  `sc.project_impact = json.dumps(...)` 저장 후 커밋 → 응답에 `impact` 세팅
검증: `pytest tests/test_impact.py` → 스냅샷 테스트만 남고 나머지 통과

### 4. snapshot_forecast + 대시보드 prev_forecast — GREEN(③의 백엔드)
파일: `schedule_service.py`, `backend/app/api/dashboard.py`
- `snapshot_forecast(db, project, result, basis)` — `Forecast` 저장 + `data_used`에 `forecast_curve` + 최신 10건 유지
- `update_task`에서 변경 적용 **전** 호출
- 대시보드 응답에 `prev_forecast_finish` / `prev_forecast_at` / `prev_forecast_curve` (곡선 없는 기존 행은 null)
검증: `pytest tests/` 전체 통과

### 5. 최근 변경 시작일 — GREEN(④의 백엔드)
파일: `backend/app/api/dashboard.py` (`recent_changes`에 `before_start`/`after_start` 추가)
검증: `pytest tests/`

### 6. 타입 + 영향 저장소 + TaskDetail 배너 — ①
파일: `frontend/src/api/types.ts`, `frontend/src/lib/changeImpact.ts`(신규), `frontend/src/pages/TaskDetail.tsx`
- `ChangeImpact` 인터페이스, `Task.impact?`, `DashboardData` 확장(`recent_changes` 시작일, `prev_forecast_*`),
  `ScheduleChange.project_impact?`
- 저장소: `saveChangeImpact` / `readChangeImpact(projectId)` / `clearChangeImpact` (TTL 6h)
- `saveEdit`: 응답 capture → 배너(예측 완료 before→after + Δ일, 영향/신규 지연 건수, "간트에서 보기" 링크)
검증: `npx tsc -b`

### 7. Schedule 배너 + 간트/테이블 마커 — ②
파일: `frontend/src/pages/Schedule.tsx`, `frontend/src/components/Gantt.tsx`, `frontend/src/components/TaskTable.tsx`
- Schedule: 저장소에서 영향 읽어 상단 요약 배너(지우기 버튼 포함)
- Gantt: `changeImpact` prop → 라벨 열 배지 + 타임라인 행 배경 틴트/바 링
  (카드·차트 팔레트 `chartColors`는 건드리지 않고 앰버 라이터럴 사용)
- TaskTable: 제목 옆 `변경`/`영향` 배지 (기존 badge 스타일 재사용)
검증: `npx tsc -b`

### 8. S-Curve 이전 예측 오버레이 — ③
파일: `frontend/src/components/ProgressChart.tsx`, `frontend/src/pages/Dashboard.tsx`
- Props: `prevForecastCurve` / `prevForecastFinish`
- 데모인 `viz` 메모 안에서 `prevCum` → `prevForePts` 생성(오늘 이전은 실제선과 동일, 오늘 이후는 이전 곡선 샘플)
- 도메인 계산에 `prevForecastFinish` 포함, forecast와 같은 팔레트로 연한 점선 렌더 + 범례 "이전 예측"
- Dashboard가 `data.prev_forecast_*` 전달
검증: `npx tsc -b`

### 9. 시작일 변경 노출 — ④
파일: `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/TaskDetail.tsx`
- Dashboard 최근 변경 카드: 종료일 위에/대신 `시작 MM/DD → MM/DD` (값이 다를 때만)
- TaskDetail 이력 테이블: `시작일 변경` 컬럼 추가
검증: `npx tsc -b`

### 10. 전체 검증
- `cd backend && .venv/bin/pytest tests/ -q` (기존 33건 + 신규 통과)
- `cd frontend && npx tsc -b && npx vite build`
- 브라우저 수동 확인: 태스크 일정 수정 → 배너 → 간트 이동 시 마커 → 대시보드 S-Curve 오버레이

## 범위 밖
- 그룹 드래그(`group_id`)·진척률 보정(`progress`)은 일정 변경이 아니므로 impact 미생성 (기존 분기 유지)
- 카드/차트 색상 팔레트(`chartColors`) 변경 없음
- 커밋/푸시는 사용자 명시 요청 시에만
