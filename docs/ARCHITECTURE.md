# 시스템 아키텍처

## 개요

AI 기반 프로젝트 일정·진척 관리 시스템. 결정적 일정 엔진(Deterministic Schedule Engine)이
모든 일정 계산을 담당하고, AI 계층은 결과를 해석·질문·보고만 수행한다. (요구사항 §38, §50-1)

## 기술 스택

| 영역 | 기술 | 근거 |
|------|------|------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS | 빠른 응답(SPA), UI 자유도 |
| Chart | 커스텀 SVG (Gantt, 진척곡선) | Baseline/Actual/Forecast 오버레이 자유 구현 |
| Backend | Python FastAPI + SQLAlchemy 2.0 | 일정 엔진/AI 계층과 자연스러운 통합 |
| DB | SQLite(로컬) → PostgreSQL 전환 가능 (SQLAlchemy) | 요구사항 §34 |
| AI | Provider 추상화 (OpenAI / Anthropic / Clova / Mock) | §47-15 모델 교체 가능 |

## 모노레포 구조

```
flow_plan/
├── docs/                  # 요구사항·아키텍처·API 문서
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI 엔트리, CORS, Audit 미들웨어
│   │   ├── models/        # SQLAlchemy 엔티티 (§34)
│   │   ├── schemas/       # Pydantic 스키마
│   │   ├── api/           # REST 라우터 (§35)
│   │   ├── core/          # config, DB, security, permissions, ratelimit, audit
│   │   ├── engine/        # 결정적 일정 엔진 (calendar, cpm, schedule)
│   │   ├── ai/            # AIProvider 추상화 + 구현체
│   │   └── services/      # 스케줄/AI 서비스
│   └── tests/             # pytest (보안 + 엔진)
└── frontend/              # React SPA
```

## 계층 분리 원칙

```
┌──────────────────────────────┐
│         React SPA            │
└──────────────┬───────────────┘
               │ REST API (JWT)
┌──────────────▼───────────────┐
│         FastAPI              │
│  ┌─────────────┐ ┌─────────┐ │
│  │ API 라우터   │ │ 보안    │ │  인증/RBAC/IDOR/RateLimit
│  └──────┬──────┘ └─────────┘ │
│  ┌──────▼───────────┐        │
│  │  Schedule Engine │  결정적: CPM/캘린더/예측 (§36)
│  └──────┬───────────┘        │
│  ┌──────▼───────────┐        │
│  │  AI Service      │  해석/질문/리포트 (§38)
│  └──────────────────┘        │
└──────────────┬───────────────┘
               │
         SQLite / PostgreSQL
```

## 일정 계산 흐름

```
Tasks + Dependencies + Workload + Calendar + Actual + Issues
            ↓
   WorkingCalendar (Project + User 합성)
            ↓
   CPM Network (전방/후방 패스)  →  ES/EF/LS/LF/Float/Critical Path
            ↓
   Forecast (작업량 기반 종료일 + 의존성 전파)
            ↓
   ScheduleResult (Plan/Forecast Finish, Gap, 지연일)
```

- 입력은 동일하면 출력도 동일(결정성·재현성) — `tests/test_engine.py`에서 검증
- 사이클 발생 시 `409 Conflict`

## AI 처리 파이프라인 (§38)

```
Raw Data → Schedule Engine → Progress 분석 → Risk 탐지 → 사용자 의견 수집
→ Forecast → AI 분석(해석) → Challenge → Daily Report → Weekly Report
```

- AI는 일정 계산을 직접 수행하지 않는다.
- AI 결과는 사실/사용자 의견/AI 예측을 구분해 근거 ID와 함께 저장한다. (§2.4, §28)

## 보안 구조 (§43)

- JWT Access Token(30분) + Refresh Token(7일, 회전/폐기 가능)
- 서버측 권한 검증 체인: 토큰 → 사용자 → Global Role → Project Membership → Resource
- Rate Limit (login/AI/report)
- Audit Log (method/endpoint/IP/UA/result + before/after)
- Soft Delete (Project/Task)
- AI Provider Key는 서버에만 저장, 클라이언트는 백엔드를 통해서만 AI 호출