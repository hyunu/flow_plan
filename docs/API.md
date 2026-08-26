# REST API 문서

기본 URL: `http://localhost:8000`

## 인증 (§43.1)

모든 보호 API는 `Authorization: Bearer <Access Token>` 헤더를 요구한다.

```text
POST /auth/login      -> { access_token, refresh_token, expires_in }
POST /auth/refresh    -> Refresh Token 회전(재사용 불가)
POST /auth/logout     -> 모든 Refresh Token 폐기
GET  /auth/me         -> 현재 사용자
```

- Access Token 수명: 30분(기본), Refresh Token 수명: 7일
- 만료된 Access Token, Refresh Token을 Access로 사용 → `401`
- 로그인 실패/성공 모두 Audit Log에 기록

## 오류 응답 (§47)

```text
401 Unauthorized   - 인증되지 않음
403 Forbidden      - 인증됨, 권한 없음 (타 프로젝트 접근 등)
404 Not Found      - 리소스 없음
409 Conflict       - 의존성 사이클/중복 등 일정 충돌
422 Validation     - 입력값 오류
429 Too Many Requests - Rate Limit 초과 (Retry-After 헤더)
```

## Rate Limit (§43.9)

| 범위 | 제한 | 대상 API |
|------|------|----------|
| login | 5회 / 5분 | POST /auth/login |
| token | 30회 / 5분 | POST /auth/refresh |
| ai | 5회 / 5분 | POST /projects/{id}/ai-risk-analysis |
| ai | 10회 / 5분 | POST /challenges/generate |
| report | 10회 / 5분 | POST /reports/daily/generate, /reports/weekly/generate/{id} |

## 사용자/역할 (§3, §43.5)

```text
POST /users               SysAdmin 전용
GET  /users               SysAdmin 전용
PUT  /users/{id}          SysAdmin 전용
GET  /users/roles         SysAdmin 전용
```

역할: `System Administrator` / `Project Manager` / `Project Member`
프로젝트 내 역할(manager/member)은 별도 관리. 동일 사용자가 Project A에서 Manager,
Project B에서 Member일 수 있다.

## 프로젝트/멤버 (§4, §35)

```text
GET    /projects                  자신이 참여한 프로젝트만(비회원 제외)
POST   /projects                  SysAdmin/PM
GET    /projects/{id}             멤버십 검증
PUT    /projects/{id}             관리 권한 필요
DELETE /projects/{id}             관리 권한 필요 (Soft Delete)

GET    /projects/{id}/members
POST   /projects/{id}/members     관리 권한 필요
DELETE /projects/{id}/members/{userId}
```

## Group / Task / Dependency

```text
GET    /groups/project/{pid}
POST   /groups                    관리 권한 필요
PUT    /groups/{id}               관리 권한 필요
DELETE /groups/{id}               관리 권한 필요

GET    /tasks?project_id={id}     project_id 없으면 접근 가능한 프로젝트로 한정
POST   /tasks                     관리 권한 필요 (Baseline 스냅샷 보존)
GET    /tasks/{id}                멤버십 검증
PUT    /tasks/{id}                관리 권한 필요 (ScheduleChange 이력 기록)
DELETE /tasks/{id}                관리 권한 필요 (Soft Delete)

POST   /tasks/{id}/children
POST   /tasks/{id}/issues
POST   /tasks/{id}/assignments    관리 권한 필요
DELETE /tasks/{id}/assignments/{userId}

POST   /tasks/{id}/progress       담당자/관리자만
GET    /tasks/{id}/progress
GET    /tasks/{id}/history        일정 변경 이력

POST   /dependencies              관리 권한 필요 (사이클 시 409)
DELETE /dependencies/{id}         관리 권한 필요
GET    /dependencies/project/{pid}
```

## Milestone / Calendar

```text
GET/POST   /milestones/project/{pid} / /milestones
PUT/DELETE /milestones/{id}

GET/POST   /calendars/project/{pid}/entries     (POST는 관리 권한)
GET/POST   /calendars/user/{uid}/entries        (본인/SysAdmin/해당 PM)
```

민감 정보: 타인 캘린더(휴가/부재)는 본인·SysAdmin·담당 PM만 조회 가능, 수정은 본인만.

## 일정 분석

```text
GET  /projects/{id}/schedule-analysis    Plan/Actual/Gap/Critical Path
GET  /projects/{id}/critical-path
GET  /projects/{id}/forecast             예측 이력(덮어쓰지 않음, §29)
POST /projects/{id}/forecast
POST /projects/{id}/ai-risk-analysis     AI 위험 분석 (AI rate limit)
GET  /dashboard/projects/{id}            대시보드 집계
```

## Challenge / Report / Notification

```text
GET  /challenges                 본인 Challenge
POST /challenges/generate         규칙 기반 생성 + AI 문구 (AI rate limit)
POST /challenges/{id}/response
GET  /reports/daily               본인 Daily Report
POST /reports/daily/generate      (report rate limit)
GET  /reports/weekly/{pid}
POST /reports/weekly/generate/{pid}  관리 권한 필요 (report rate limit)
GET  /notifications
POST /notifications/{id}/read
```

## Audit Log (§43.10)

```text
GET /audit?entity=&limit=    SysAdmin 전용
```

기록 항목: Actor, Action, HTTP Method, Endpoint, Entity, Entity ID, Timestamp, IP, User-Agent, Result, Before, After, Reason