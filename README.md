# Flow Plan - AI 기반 프로젝트 일정·진척 관리 시스템

AI가 **일정 계산**이 아닌 **해석·질문·보고**를 담당하는 프로젝트 일정/진척 관리 시스템.
모든 일정 계산은 결정적(Deterministic) 엔진이 수행한다.

## 기능 (§1)

- 프로젝트/그룹/Task 계층 관리, 무제한 depth, 복수 담당자
- Baseline(최초 계획) / Current Plan / Actual 3중 일정 보존
- Project + User 캘린더 기반 작업 가능 시간 계산
- Task Dependency(FS + Lag) 및 Critical Path 분석
- 작업량 기반 예상 종료일(Forecast) 및 지연 자동 감지
- Issue Task(현상/원인/개선/결과), Progress Update, 지연 원인·대책 수집
- AI Daily Challenge, Daily Report, 관리자 Weekly Report
- 일정 변경 이력, 예측 이력, Audit Log

## 보안 (§43, v2)

- Access(30분) + Refresh Token(7일, 회전) 인증
- 서버측 RBAC + 프로젝트 멤버십 검증 (IDOR/BOLA 차단)
- Rate Limit (login/AI/report), 강화된 Audit Log, Soft Delete
- AI API Key는 서버 전용, 클라이언트는 백엔드를 통해서만 AI 호출

## 시작하기

> **체크아웃 후 가장 빠른 실행**: `make setup` 후 터미널 2개에서 `make backend` + `make frontend`
> 백엔드 첫 기동 시 DB가 비어 있으면 **시드 데이터가 자동 생성**됩니다(멱등). 별도 시드 명령 불필요.

### Backend

```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
uvicorn app.main:app --port 8000    # 첫 실행 시 시드 데이터 자동 생성
```

- **DB 위치**: 로컬 SQLite는 `backend/data/flow_plan.db`에 저장됩니다. 초기화하려면 이 파일을 삭제 후 재기동(`make reset`).
- API 문서: http://localhost:8000/docs (Swagger UI)
- AI 연동 시 `.env`에 `AI_PROVIDER=openai` + `OPENAI_API_KEY=...` 설정 (`backend/.env.example` 참조)
  (미설정 시 `mock` 프로바이더로 동작)

**시드 계정** (사용자 14명)

| 계정 | 비밀번호 | 역할 | 소속 프로젝트 |
|------|---------|------|--------------|
| admin | admin123 | System Administrator | 전체 |
| pm_a | pm123 | PM | A (스마트팩토리 MES) |
| pm_b | pm123 | PM | B (커머스 앱) |
| pm_c | pm123 | PM | C (차세대 ERP) |
| dev_back / dev_fe / dev_mes / dev_fw / plan / design / qa / infra / dba / erp | member123 | Member | 각 프로젝트 멤버 |

**시드 데이터 구성** (총 211 태스크 · 피드백 100건)

| 프로젝트 | 태스크 | 그룹 | 설명 |
|---------|--------|------|------|
| A - 스마트팩토리 MES | 64 | 기획/HW/SW/검증/배포 | 설비 연동, 생산계획/실적, 대시보드, 이슈 포함 |
| B - 커머스 앱 리뉴얼 | 64 | 리서치/디자인/백엔드/앱/QA | UX 리서치, MSA, 앱 화면, 출시 |
| C - 차세대 ERP | 83 | 요구사항/인프라/모듈/통합/전환 | 재무·구매·인사·생산·영업 5개 도메인 |

지연 원인/대책 피드백, 일정 변경 이력, 휴가 캘린더, 공휴일, 예측 이력, Challenge가 모두 포함되어
지연 감지·Critical Path·AI 분석 등 전체 기능을 바로 체험할 수 있습니다.

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## 테스트

```bash
cd backend && source .venv/bin/activate
pytest tests/ -q            # 보안(18) + 일정 엔진(9) = 27개
```

## 문서

- [요구사항 v2](docs/REQUIREMENTS.md)
- [아키텍처](docs/ARCHITECTURE.md)
- [REST API](docs/API.md)
- [데이터 모델](docs/DATA_MODEL.md)

## 구현 현황 (Phase 1~6)

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | 로그인/사용자/권한/프로젝트/Group/Task/Child | ✅ |
| 2 | 작업량/캘린더/Dependency/CPM/Baseline/Forecast/변경이력 | ✅ |
| 3 | Issue/Progress/지연원인/대책 | ✅ |
| 4 | Dashboard/차트 (Gantt, 진척곡선) | ✅ |
| 5 | AI Challenge/Daily/Weekly Report/위험분석 | ✅ |
| 6 | 알림 (Web/Push/Email 추상화) | 🔄 Web 기본 구현 |
| - | API 보안 강화 (§43~§48) | ✅ |

## 화면 구성

- **프로젝트 목록** `/projects` — 참여 프로젝트, 생성
- **현황판(Dashboard)** `/projects/:id` — KPI, AI 요약, 진척곡선, Milestone, 지연/CP/Issue, 사용자 작업량, 최근 변경
- **전체 일정** `/projects/:id/schedule` — **간트**(하위 Task 접기/펼치기, Baseline/계획/진척/예측/Critical Path) ↔ **테이블**(검색/상태 필터) 전환
- **Task 상세** `/tasks/:id` — 일정 4중 비교, 진척 보정, 진행기록, 변경 이력
- **Daily Challenge** `/challenges`, **리포트** `/reports`