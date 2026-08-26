# 데이터 모델 (§34)

ERD를 텍스트로 요약. 상세 컬럼은 `backend/app/models/entities.py` 참조.

## 핵심 엔티티

```
User ───< ProjectMember >─── Project ───< Group
  │                              │
  │< TaskAssignment              ├──< Task ──< Task (self: parent/child, 무제한 depth)
  │< UserCalendar                │       ├──< TaskAssignment
  │< RefreshToken                │       ├──< ProgressUpdate
                                 │       ├──< ScheduleChange
Role ──< User                    │       └──(Issue = is_issue=True 인 Child Task)
                                 ├──< Milestone
                                 ├──< ProjectCalendar ──< ProjectCalendarEntry
                                 ├──< Baseline
                                 ├──< Forecast
                                 ├──< WeeklyReport
                                 └──< AIAnalysis

TaskDependency (predecessor_id → successor_id, FS + lag)
Challenge ──< ChallengeResponse
DailyReport
Notification
AuditLog
```

## 일정 3원칙 필드

Task는 다음을 별도 보존한다(§2.2, §15):

| 구분 | 시작일 | 종료일 | 작업량 |
|------|--------|--------|--------|
| Baseline (최초 계획, 변경 불가) | baseline_start | baseline_end | baseline_workload |
| Current Plan | plan_start | plan_end | workload |
| Actual | actual_start | actual_end | - |

진척률은 4가지를 분리 저장(§8.2):

- `schedule_progress` : 시스템 자동(일정 기준)
- `work_progress`     : 시스템 자동(작업량 기준)
- `user_adjustment`   : 사용자 보정
- `effective_progress`: 최종 진척률

## 일정 변경 이력(ScheduleChange)

Task 일정/작업량 변경 시 §2.3 필수 항목을 기록: before/after 시작·종료일, 작업량, 변경자,
변경일, 사유, 사용자 의견, 관련 Issue, 예상 영향.

## 예측 이력(Forecast)

§29: 생성된 예측을 덮어쓰지 않는다. 예측 시각, 예상 완료일, 예상 지연, 근거, 사용 데이터,
실제 완료일을 기록해 예측 정확도 측정 가능.

## Audit Log

§43.10 항목: Actor, Action, HTTP Method, Endpoint, Entity, Entity ID, Timestamp, IP,
User-Agent, Result, Before, After, Reason.

## Soft Delete

Project / Task는 `is_deleted` 플래그로 삭제(§43.11). 실제 삭제는 금지.

## 보안 관련

- RefreshToken은 해시(`sha256`)로 저장, 회전/폐기 지원
- 비밀번호는 bcrypt 해시
- AI Provider API Key는 서버 환경변수에만 존재 (DB에 저장하지 않음)