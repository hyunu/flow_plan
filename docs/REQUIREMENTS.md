# AI 기반 프로젝트 일정·진척 관리 시스템 상세 요구사항서

- 문서 버전: 2.0
- 작성일: 2026-08-26
- 최종 수정일: 2026-08-26
- 목적: AI 코딩 에이전트가 시스템을 설계·구현할 수 있도록 기능, 데이터, 일정 계산, 권한, UI, AI 분석 및 보고 요구사항을 정의한다.

---

## 문서 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| 1.0 | 2026-08-26 | 초기 상세 요구사항 |
| 2.0 | 2026-08-26 | Backend API 인증/인가, 프로젝트별 접근 제어, AI API 보안, HTTPS, Rate Limit, Audit Log, Soft Delete 및 API 보안 Acceptance Criteria 추가 |


# 1. 프로젝트 개요

## 1.1 목적

본 시스템은 단순한 프로젝트 관리 도구가 아니라 다음의 전체 업무 흐름을 관리하는 AI 기반 프로젝트 일정·진척 관리 시스템이다.

1. 프로젝트 계획 수립
2. 프로젝트/그룹/Task 계층 관리
3. 사용자 배정 및 개인별 작업 가능 시간 관리
4. Task 일정 및 작업량 관리
5. Task 간 Dependency 및 Critical Path 분석
6. 계획 대비 실제 진척률 분석
7. Issue Task를 통한 문제 및 추가 업무 관리
8. 일정 지연의 자동 탐지 및 예측
9. 사용자의 지연 원인/현상/대책 의견 수집
10. AI 기반 개인별 Daily Challenge 생성
11. AI 기반 일일 리포트 생성
12. AI 기반 관리자 주간 보고서 생성
13. 계획 변경 및 일정 지연 이력 보존
14. 최초 계획(Baseline)과 현재 계획/실제 진척의 시각적 비교

핵심 목표는 다음 질문에 시스템이 답할 수 있도록 하는 것이다.

> 현재 일정은 어떤 상태인가?
>
> 계획 대비 얼마나 차이가 나는가?
>
> 왜 지연되고 있는가?
>
> 누가 어떤 문제를 가지고 있는가?
>
> 사용자는 지연에 대해 어떻게 판단하는가?
>
> 어떤 대책이 필요한가?
>
> 대책을 적용하면 얼마나 회복되는가?
>
> 최종 프로젝트 완료일은 언제로 예상되는가?

---

# 2. 핵심 설계 원칙

## 2.1 최초 계획은 절대 덮어쓰지 않는다

프로젝트 최초 계획은 Baseline으로 보존한다.

```text
Baseline Plan
     |
     +-- 최초 Task 시작일
     +-- 최초 Task 종료일
     +-- 최초 작업량
     +-- 최초 Dependency
     +-- 최초 Milestone 계획
```

현재 일정이 변경되더라도 Baseline은 변경하지 않는다.

## 2.2 Current Plan과 Actual을 분리한다

다음 세 가지를 구분한다.

- Baseline Plan: 최초 승인 계획
- Current Plan: 현재 적용 중인 계획
- Actual: 실제 진행 상태

## 2.3 모든 일정 변경은 이력으로 남긴다

일정 변경 시 다음을 기록한다.

- 변경 대상
- 변경 전 값
- 변경 후 값
- 변경자
- 변경 시각
- 변경 사유
- 사용자 의견
- Issue와의 연관성
- 예상 영향

## 2.4 AI는 사실과 의견과 예측을 구분해야 한다

AI가 보고서를 작성할 때 다음을 명확히 구분한다.

- 시스템 계산값
- 사용자가 입력한 의견
- AI가 계산/추론한 예측
- AI가 제안하는 대책

AI가 근거 없는 원인을 임의로 생성해서는 안 된다.

---

# 3. 사용자 및 인증

## 3.1 로그인

필수 기능:

- 로그인
- 로그아웃
- 비밀번호 관리
- 사용자 계정 활성/비활성
- 사용자 프로필
- 사용자별 작업 가능 시간
- 사용자 휴가/부재 일정

인증 구조는 향후 OAuth/OIDC 등으로 확장 가능하도록 설계한다.

## 3.2 사용자 역할

최소 다음 역할을 지원한다.

### System Administrator

- 모든 프로젝트 조회
- 사용자 관리
- 프로젝트 생성/삭제
- 프로젝트 관리자 지정
- 시스템 설정
- 공통 휴일 관리

### Project Manager

- 자신이 관리하는 프로젝트 전체 조회
- 프로젝트 설정
- 프로젝트 멤버 관리
- Group 관리
- Task 관리
- Milestone 관리
- Calendar 관리
- 일정 승인/변경
- 보고서 생성 및 조회

### Project Member

- 자신이 참여한 프로젝트 조회
- 자신에게 접근 권한이 있는 Task 조회
- Task 진행상황 입력
- Issue Task 생성
- 진행 의견 입력
- 지연 원인 입력
- 대책 입력
- Daily Challenge 응답

---

# 4. 프로젝트 접근 권한

일반 사용자는 자신이 참여하지 않은 프로젝트를 볼 수 없어야 한다.

기본 프로젝트 목록은 다음과 같다.

```text
내 프로젝트
 ├─ Project A
 ├─ Project B
 └─ Project C
```

System Administrator는 전체 프로젝트를 볼 수 있다.

Project Manager는 자신이 관리하는 프로젝트를 볼 수 있다.

프로젝트마다 사용자를 복수 명 배정할 수 있어야 한다.

한 사용자는 여러 프로젝트에 동시에 참여할 수 있어야 한다.

---

# 5. 프로젝트 구조

프로젝트 구조는 다음과 같다.

```text
Project
 ├─ Milestone
 ├─ Group
 │   └─ Task
 │       ├─ Child Task
 │       │   ├─ Child Task
 │       │   └─ Issue Task
 │       └─ Child Task
 ├─ Project Members
 ├─ Project Calendar
 └─ Reports
```

## 5.1 Group

Group은 업무를 분류하기 위한 논리적 컨테이너이다.

예:

```text
Project A
 ├─ 기획
 ├─ HW
 ├─ SW
 ├─ 검증
 └─ 배포
```

Group은 일정 계산의 기본 단위가 아니며 Task를 포함한다.

## 5.2 Task

Task는 실제 일정과 작업량을 가지는 기본 업무 단위이다.

필수 속성:

- ID
- 프로젝트
- Group
- Parent Task
- 제목
- 설명
- 담당 사용자
- 계획 시작일
- 계획 종료일
- 작업량
- 상태
- 진척률
- Task Type
- 생성자
- 생성일
- 수정일

---

# 6. Task 계층

Task는 다른 Task의 자식이 될 수 있어야 한다.

무제한 depth를 지원할 수 있도록 데이터 구조를 설계한다.

예:

```text
Task A
 ├─ Task A-1
 │   ├─ Task A-1-1
 │   └─ Task A-1-2
 └─ Task A-2
```

Parent Task와 Child Task의 관계를 명확하게 저장한다.

Parent Task의 진척률과 일정은 Child Task를 기반으로 계산할 수 있어야 한다.

단, 사용자가 필요한 경우 Parent Task의 진척률을 보정할 수 있도록 한다.

---

# 7. Task 담당자

Task는 한 명 이상의 사용자를 담당자로 지정할 수 있어야 한다.

예:

```text
Task A
 ├─ 김OO: 24h
 └─ 박OO: 16h

Total Work: 40h
```

Task 전체 작업량과 사용자별 할당 작업량을 별도로 관리한다.

---

# 8. Task 일정

Task는 다음 정보를 가진다.

- Baseline Start
- Baseline End
- Current Plan Start
- Current Plan End
- Actual Start
- Actual End
- Duration
- Workload

최초 생성 시 사람이 시작일과 종료일을 계획한다.

## 8.1 작업량

기간과 별도로 작업량을 관리한다.

예:

```text
기간: 9/1 ~ 9/10
작업일: 8일
작업량: 40h
```

## 8.2 실제 진척률

진척률은 기본적으로 시스템이 자동 계산한다.

자동 계산 시 다음을 고려한다.

- 계획 시작일
- 계획 종료일
- 현재 날짜
- Working Calendar
- 실제 작업 가능 시간
- 작업량
- 실제 완료 작업량

사용자는 자동 계산된 진척률을 보정할 수 있다.

예:

```text
Schedule Progress: 60%
User Adjustment: -10%
Effective Progress: 50%
```

단, 데이터베이스에는 다음을 별도로 보존한다.

- Schedule Progress
- Work Progress
- User Adjustment
- Effective Progress

---

# 9. Working Calendar

일정 계산에는 프로젝트 캘린더와 사용자 캘린더가 모두 필요하다.

## 9.1 Project Calendar

프로젝트 공용 작업 가능 시간을 관리한다.

관리 대상:

- 주말
- 국가 공휴일
- 회사 휴일
- 프로젝트 휴일
- 특별 근무일
- 일일 근무시간
- 프로젝트별 근무시간

예:

```text
Project Calendar
9/1  Work
9/2  Work
9/3  Holiday
9/4  Work
9/5  Weekend
9/6  Weekend
```

## 9.2 User Calendar

사용자별 실제 작업 가능 시간을 관리한다.

관리 대상:

- 연차
- 반차
- 출장
- 개인 휴무
- 교육
- 프로젝트별 부재
- 기타 작업 불가 시간

예:

```text
Project Calendar
     +
User Calendar
     ↓
Actual Working Availability
```

Task 일정 계산 시 실제 담당자의 작업 가능 시간을 사용한다.

---

# 10. Task Dependency

Task 사이에 Dependency를 설정할 수 있어야 한다.

최소 1차 버전에서는 다음 Dependency를 지원한다.

```text
Finish-to-Start
```

예:

```text
Task A 완료
    ↓
Task B 시작 가능
```

Dependency에는 다음을 저장한다.

- Predecessor Task
- Successor Task
- Dependency Type
- Lag
- 생성자
- 생성일

향후 Start-to-Start, Finish-to-Finish 등으로 확장 가능하도록 설계한다.

---

# 11. Critical Path

Dependency Graph를 분석해서 Critical Path를 계산해야 한다.

예:

```text
A → B → D → F
```

Critical Path상의 Task가 지연될 경우 프로젝트 종료일에 미치는 영향을 계산한다.

화면에서 Critical Path를 시각적으로 강조한다.

Critical Path 관련 정보:

- Critical Task
- Total Float
- Free Float
- 예상 지연
- 프로젝트 종료일 영향
- 영향받는 Successor Task

---

# 12. Milestone

Milestone은 프로젝트별로 자유롭게 정의할 수 있어야 한다.

기본 예:

```text
요구사항
설계
구현
검증
배포
유지보수
```

하지만 프로젝트별로 이름/순서/기간을 변경할 수 있어야 한다.

예:

```text
Project A
기획 → 설계 → 구현 → 시험 → 배포

Project B
요구사항 → HW설계 → SW설계 → 통합시험 → 양산
```

Milestone은 다음 속성을 가진다.

- 이름
- 설명
- 순서
- 시작일
- 종료일
- 진척률
- 상태
- 담당자
- 포함 Task

---

# 13. Issue Task

Issue는 별도의 독립 객체라기보다 기존 Task 수행 중 발생한 문제를 해결하기 위해 추가되는 하위 Task로 정의한다.

예:

```text
Task
 └─ Issue Task
      └─ Child Task
```

Issue Task에는 다음 정보를 추가한다.

- Issue 여부
- 현상
- 원인
- 영향
- 개선/해결 방법
- 담당자
- 예상 작업량
- 해결 예정일
- 실제 해결일
- 해결 결과

예:

```text
Task: API 구현

 └─ Issue Task: API 응답 지연 문제

    현상:
    API 응답이 3초 이상 지연됨

    원인:
    Connection Pool 부족

    개선:
    Pool Size 20 → 50

    결과:
    평균 응답시간 2.8s → 0.7s
```

Issue Task도 일반 Task와 동일하게 일정, 작업량, 담당자, Dependency를 가질 수 있어야 한다.

---

# 14. Issue가 일정에 미치는 영향

Issue Task가 생성되면 일정 엔진은 다음을 다시 계산한다.

```text
Issue 생성
 ↓
추가 작업량
 ↓
담당자 가용시간
 ↓
Task 예상 종료일
 ↓
Dependency Graph
 ↓
Critical Path
 ↓
Project 예상 종료일
```

Issue로 인해 예상 종료일이 변경되면 변경 이력을 기록한다.

---

# 15. Baseline / Current Plan / Actual

프로젝트의 일정 차트를 정확히 비교하기 위해 세 종류의 데이터를 관리한다.

## Baseline

최초 승인 계획.

변경 불가.

## Current Plan

현재 적용되는 계획.

일정 변경 시 변경된다.

## Actual

실제 진행 상황.

예:

```text
Baseline:
9/1 ~ 9/10

Current Plan:
9/1 ~ 9/13

Actual:
9/1 시작
현재 65%
```

---

# 16. 일정 변경 이력

모든 일정 변경을 기록한다.

필수 항목:

- 대상 Task
- 변경 전 시작일
- 변경 전 종료일
- 변경 후 시작일
- 변경 후 종료일
- 변경 전 작업량
- 변경 후 작업량
- 변경자
- 변경일
- 변경 사유
- 관련 Issue
- 사용자 의견
- 예상 프로젝트 영향

변경 이력은 차트에서도 확인할 수 있어야 한다.

---

# 17. 일정 지연 계산

시스템은 지속적으로 계획 대비 현재 상태를 분석한다.

핵심 지표:

```text
Plan Progress
Actual Progress
Progress Gap
Planned Finish
Forecast Finish
Schedule Delay
```

예:

```text
계획 진척률: 70%
실제 진척률: 55%
Gap: -15%p

계획 완료일: 9/10
예상 완료일: 9/14

예상 지연: +4일
```

---

# 18. 일정 지연 원인 수집

시스템 계산만으로 지연 원인을 확정하지 않는다.

지연이 감지되면 담당 사용자에게 원인을 요청한다.

예:

> 현재 Task가 계획 대비 지연되고 있습니다. 지연 원인을 입력해주세요.

사용자는 다음을 입력할 수 있다.

- 원인
- 현상
- 영향
- 예상 추가 기간
- 대응 방법
- 대책
- 대책 적용 후 예상 일정
- 자유 의견

원인 카테고리 예:

- 요구사항 변경
- 설계 변경
- 기술 문제
- Issue 발생
- 선행 Task 지연
- 외부 업체 지연
- 인력 부족
- 사용자 휴가/부재
- 작업량 증가
- 환경 문제
- 기타

---

# 19. 사용자 Progress Update

사용자는 담당 Task에 대해 진행 의견을 입력할 수 있어야 한다.

Progress Update:

- 작성자
- 작성일
- 현재 상황
- 수행 내용
- 문제점
- 지연 원인
- 대응 방법
- 다음 계획
- 추가 의견

Progress Update는 수정 이력을 보존한다.

---

# 20. AI Daily Challenge

매일 시스템은 각 사용자별 담당 Task를 분석한다.

AI는 다음을 분석한다.

- 일정 지연 가능성
- 현재 진척률
- 계획 대비 Gap
- Critical Path 여부
- Dependency 영향
- Issue
- 사용자 Calendar
- Task 종료 임박 여부
- 최근 Progress Update
- 미입력 데이터
- 과거 일정 변경

분석 결과에 따라 사용자별 Challenge를 생성한다.

## 예시

### 지연 예상

> 일정 지연이 예상됩니다. 지연 원인을 입력해주세요.

### 지연 원인 미입력

> 현재 Task가 계획보다 늦게 진행되고 있습니다. 지연 원인이 등록되지 않았습니다. 원인을 입력해주세요.

### 대책 요청

> 현재 2일의 지연이 예상됩니다. 일정 회복을 위한 대책을 입력해주세요.

### 진행률 업데이트

> 최근 3일간 진척률 업데이트가 없습니다. 현재 진행상태를 확인해주세요.

### Issue

> Issue #123의 해결 예정일이 지났습니다. 현재 상태와 새로운 완료 예정일을 입력해주세요.

### Dependency

> 선행 Task 지연으로 현재 Task도 영향을 받을 가능성이 있습니다. 예상 영향을 확인해주세요.

### 휴가 영향

> 예정된 휴가로 인해 Task 작업 가능 시간이 감소합니다. 완료 예정일을 확인해주세요.

---

# 21. Daily Challenge 우선순위

Challenge는 다음 수준으로 분류한다.

```text
CRITICAL
WARNING
ATTENTION
NORMAL
```

예:

```text
CRITICAL
Critical Path Task가 3일 지연 예상

WARNING
일반 Task가 2일 지연 예상

ATTENTION
진척률 업데이트 필요

NORMAL
정상 진행
```

사용자에게는 하루에 가장 중요한 Challenge를 우선 표시한다.

---

# 22. AI Challenge 응답

사용자가 Challenge에 답변할 수 있어야 한다.

예:

```text
AI:
지연 원인을 입력해주세요.

사용자:
외부 업체 API 사양 전달이 늦어졌습니다.
```

AI가 추가 질문을 생성할 수 있다.

```text
AI:
현재 예상 지연은 몇 일입니까?

사용자:
2일입니다.

AI:
일정을 회복하기 위한 대책이 있습니까?

사용자:
개발자 한 명을 추가 투입하겠습니다.
```

대화 결과는 공식 Task 진행 기록으로 저장한다.

---

# 23. Daily Report

Daily Report는 사용자별로 생성한다.

포함 내용:

- 담당 프로젝트
- 담당 Task
- 오늘의 일정 상태
- 정상 Task
- 주의 Task
- 지연 Task
- Critical Path 관련 Task
- Issue
- 일정 지연 예상
- 사용자에게 요청할 입력
- AI Challenge
- 사용자의 답변
- 오늘의 주요 업무
- 다음 작업

Daily Report는 Push Notification으로 사용자에게 전달할 수 있어야 한다.

---

# 24. 관리자 주간 보고서

AI가 프로젝트 전체 데이터를 분석하여 관리자용 Weekly Report를 생성한다.

포함 내용:

## Project Summary

- 전체 진척률
- 계획 진척률
- Progress Gap
- 계획 완료일
- 현재 예상 완료일
- 예상 지연일

## KPI

- Milestone별 진척률
- Task 완료율
- 지연 Task 수
- Critical Task 수
- Issue 수
- 해결된 Issue 수
- 미해결 Issue 수
- 계획 변경 횟수
- 일정 회복률

## 주요 지연 원인

사용자가 입력한 의견과 시스템 데이터를 함께 분석한다.

## 주요 Issue

각 Issue의:

- 현상
- 원인
- 영향
- 해결 방법
- 상태

를 요약한다.

## 사용자 의견

담당자가 작성한 지연 원인 및 대책을 포함한다.

## AI Forecast

현재 데이터를 기준으로:

- 예상 완료일
- 예상 지연
- 지연 가능성이 높은 Task
- Critical Path
- 위험 요소
- 권장 대책

을 설명한다.

---

# 25. 진척 차트

차트는 최소 다음 데이터를 동시에 표시해야 한다.

```text
Baseline
Current Plan
Actual
Forecast
```

예:

```text
100% |                         Actual
     |                    ●
 80% |              ●
     |       Baseline ─────────────
 60% |         ●
     |
 40% |    ●
     |
 20% | ●
     +------------------------------
       9/1  9/5  9/10  9/15  9/20
```

---

# 26. 지연 영역 시각화

계획 대비 현재 진행이 늦어진 영역은 차트에서 명확하게 하이라이트한다.

표시 정보:

- 지연 구간
- 지연 기간
- 관련 Task
- 지연 원인
- Issue
- 담당자
- 대책
- 대책 적용 후 예상 회복 기간

사용자가 지연 영역을 클릭하면 상세 정보를 볼 수 있어야 한다.

---

# 27. 계획 대비 Gap 분석

시스템은 A/B/Gap 개념을 사용한다.

```text
A = 계획/예측 기준
B = 현재 실제 진척
Gap = A - B
```

Gap이 발생하면 다음을 추적한다.

```text
Gap
 ↓
관련 Task
 ↓
관련 Issue
 ↓
사용자 의견
 ↓
원인
 ↓
대책
 ↓
대책 적용 후 Forecast
```

---

# 28. AI 분석 원칙

AI는 다음 데이터를 근거로 분석한다.

1. Task 일정
2. Task 작업량
3. Actual Progress
4. Dependency
5. Critical Path
6. Project Calendar
7. User Calendar
8. Issue Task
9. Progress Update
10. 일정 변경 이력
11. 사용자 지연 의견
12. 과거 예측 및 실제 결과

AI 분석 결과에는 가능하면 근거 데이터의 ID와 출처를 연결한다.

AI가 추측한 내용은 "AI 예측" 또는 "AI 권고"로 표시한다.

---

# 29. 예측 이력

AI가 생성한 Forecast를 덮어쓰지 않는다.

예:

```text
9/1 Forecast Finish = 9/10
9/5 Forecast Finish = 9/12
9/8 Forecast Finish = 9/14
9/14 Actual Finish = 9/14
```

각 예측에는:

- 예측 시각
- 예측 완료일
- 예상 지연
- 예측 근거
- 사용된 데이터
- 실제 완료일

을 기록한다.

이를 통해 예측 정확도를 측정할 수 있어야 한다.

---

# 30. 사용자별 일정 분석

사용자별로 다음을 계산한다.

- 담당 Task 수
- 현재 작업량
- 예정 작업량
- 작업 가능 시간
- 휴가/부재
- 일정 초과 가능성
- Critical Path Task 수
- 지연 Task 수
- Issue Task 수
- 미응답 Challenge
- 최근 진척률

예:

```text
김OO

가용 작업시간: 32h
할당 작업량: 40h
부족: 8h

지연 Task: 2
Critical Task: 1
Issue: 1

AI 판단:
현재 작업량으로 예정일 준수 가능성이 낮음
```

---

# 31. 사용자 Push

사용자에게 다음 상황에서 Push를 보낼 수 있어야 한다.

- 일정 지연 예상
- Critical Path 지연
- Issue 해결 지연
- 지연 원인 입력 필요
- 진척률 업데이트 필요
- 대책 입력 필요
- Task 종료 임박
- Dependency 영향 발생
- 휴가로 일정 영향 예상
- Daily Challenge 생성

Push에는 관련 프로젝트/Task 화면으로 바로 이동할 수 있는 링크를 포함한다.

---

# 32. 프로젝트 Dashboard

프로젝트 Dashboard에는 최소 다음을 제공한다.

- 전체 진척률
- 계획 대비 진척률
- 예상 완료일
- 예상 지연일
- Milestone 상태
- Critical Path
- 지연 Task
- Issue
- 사용자별 작업량
- 일정 위험도
- 최근 변경사항
- AI 요약

---

# 33. Task 상세 화면

Task 상세 화면에는 다음을 제공한다.

```text
기본 정보
일정
작업량
담당자
진척률
Child Task
Dependency
Issue
Progress Update
일정 변경 이력
AI 분석
```

특히 일정 정보는 다음을 동시에 보여준다.

```text
Baseline
Current Plan
Actual
Forecast
```

---

# 34. 권장 데이터 모델

핵심 Entity:

```text
User
Role
Project
ProjectMember
Group
Task
TaskAssignment
TaskDependency
Milestone
ProjectCalendar
ProjectCalendarEntry
UserCalendar
UserCalendarEntry
ProgressUpdate
IssueDetail
ScheduleChange
Baseline
Forecast
Challenge
ChallengeResponse
DailyReport
WeeklyReport
Notification
AIAnalysis
```

필요한 경우 별도의 AuditLog를 둔다.

---

# 35. API 요구사항

REST API 또는 동등한 API 구조를 제공한다.

예:

```text
POST   /auth/login
GET    /projects
POST   /projects
GET    /projects/{id}
PUT    /projects/{id}

GET    /projects/{id}/members
POST   /projects/{id}/members
DELETE /projects/{id}/members/{userId}

GET    /projects/{id}/groups
POST   /groups
PUT    /groups/{id}
DELETE /groups/{id}

GET    /tasks
POST   /tasks
GET    /tasks/{id}
PUT    /tasks/{id}
DELETE /tasks/{id}

POST   /tasks/{id}/children
POST   /tasks/{id}/issues

POST   /tasks/{id}/progress
GET    /tasks/{id}/history

POST   /dependencies
DELETE /dependencies/{id}

GET    /projects/{id}/critical-path
GET    /projects/{id}/forecast

GET    /users/{id}/calendar
POST   /users/{id}/calendar

GET    /projects/{id}/calendar
POST   /projects/{id}/calendar

GET    /challenges
POST   /challenges/{id}/response

GET    /reports/daily
GET    /reports/weekly
POST   /reports/weekly/generate
```

API는 권한 검증을 서버에서 수행해야 한다.

---

# 36. 일정 계산 엔진

일정 계산 엔진은 UI와 분리한다.

입력:

```text
Tasks
Dependencies
Workload
Project Calendar
User Calendars
Assignments
Actual Progress
Issues
```

출력:

```text
Current Schedule
Forecast Schedule
Critical Path
Float
Project Forecast Finish
Schedule Gap
```

일정 계산 결과는 재현 가능해야 한다.

---

# 37. 일정 변경 처리

Task 종료일이 변경되면 다음을 순차적으로 처리한다.

```text
Task 변경
 ↓
Dependency 재계산
 ↓
Successor Task 계산
 ↓
Critical Path 재계산
 ↓
Project Forecast 재계산
 ↓
Schedule Gap 계산
 ↓
AI 위험 분석
 ↓
관련 사용자 Challenge 생성
 ↓
관리자 Dashboard 갱신
```

---

# 38. AI 처리 Pipeline

권장 Pipeline:

```text
Raw Project Data
      ↓
Schedule Calculation
      ↓
Progress Analysis
      ↓
Risk Detection
      ↓
Root Cause Data Collection
      ↓
User Opinion
      ↓
Forecast
      ↓
AI Analysis
      ↓
Challenge
      ↓
Daily Report
      ↓
Weekly Report
```

AI가 일정 계산 자체를 직접 수행하는 구조로 만들지 않는다.

**정확한 일정 계산은 Deterministic Schedule Engine이 수행하고 AI는 그 결과를 해석하고 질문하고 보고서를 생성한다.**

---

# 39. AI가 수행하면 안 되는 것

AI는 다음 값을 근거 없이 임의 변경해서는 안 된다.

- Task 시작일
- Task 종료일
- 작업량
- 사용자
- Dependency
- 실제 진척률

AI가 변경을 권고할 수는 있지만 실제 데이터 변경은 사용자의 승인 또는 시스템 규칙을 거쳐야 한다.

---

# 40. AI가 수행해야 하는 것

AI는 다음을 수행한다.

- 지연 가능성 분석
- 이상 진척 탐지
- 지연 원인 질문
- 추가 정보 질문
- 사용자 Challenge 생성
- 사용자 의견 요약
- Issue 요약
- 일정 변화 설명
- 프로젝트 위험 요약
- 일정 회복 대책 제안
- 예상 결과 설명
- Daily Report 생성
- Weekly Report 생성
- 관리자용 자연어 설명 생성

---

# 41. Audit Log

중요한 모든 변경은 Audit Log에 기록한다.

대상:

- Project
- Group
- Task
- Assignment
- Dependency
- Milestone
- Calendar
- Progress
- Issue
- Schedule
- User
- AI Forecast

기록:

```text
Actor
Action
Entity
Entity ID
Before
After
Timestamp
Reason
```

---

# 42. 알림 시스템

Notification Channel은 확장 가능하게 설계한다.

최소:

- Web Notification
- Push Notification
- Email

향후:

- Telegram
- Slack
- Microsoft Teams

등을 추가할 수 있도록 한다.

---


---

# 43. Backend API 보안 및 접근 제어

모든 Backend API는 인증되지 않은 사용자가 임의로 호출할 수 없어야 한다.

## 43.1 API 인증

모든 보호된 API는 인증된 사용자만 호출할 수 있어야 한다.

권장 인증 흐름:

```text
Client
  ↓
POST /auth/login
  ↓
Backend 인증
  ↓
Access Token + Refresh Token
  ↓
Client
  ↓
Authorization: Bearer <Access Token>
  ↓
Backend API
```

비밀번호를 일반 API 요청마다 전송하지 않는다.

Access Token은 짧은 만료 시간을 사용하고 Refresh Token으로 갱신할 수 있도록 한다.

## 43.2 HTTPS

운영 환경에서는 HTTPS만 허용한다.

HTTP를 통한 인증 정보 및 API 데이터 전송은 허용하지 않는다.

## 43.3 서버 측 권한 검증

권한 검증은 반드시 Backend에서 수행한다.

클라이언트에서 메뉴나 버튼을 숨기는 것만으로 권한을 구현해서는 안 된다.

모든 보호 API는 다음 순서로 검증한다.

```text
Access Token 검증
      ↓
사용자 식별
      ↓
Global Role 확인
      ↓
Project Membership 확인
      ↓
Resource 접근 권한 확인
      ↓
API 실행
```

권한이 없으면 적절한 401 또는 403 응답을 반환한다.

## 43.4 프로젝트 단위 접근 제어

일반 사용자는 자신이 참여하지 않은 프로젝트의 데이터를 API로 조회할 수 없어야 한다.

예:

```text
User A
 ├─ Project A → 접근 가능
 └─ Project B → 접근 불가
```

URL의 Project ID나 Task ID를 변경하여 다른 프로젝트의 데이터를 조회하는 IDOR/BOLA 문제가 발생하지 않도록 모든 요청에서 서버 측 프로젝트 멤버십과 리소스 접근 권한을 검증한다.

## 43.5 역할 기반 접근 제어

최소 다음 Role을 지원한다.

```text
SYSTEM_ADMIN
PROJECT_MANAGER
PROJECT_MEMBER
```

Role에 따른 권한뿐 아니라 프로젝트별 Membership을 함께 확인한다.

동일 사용자가 Project A에서는 Manager이고 Project B에서는 Member일 수 있도록 설계한다.

## 43.6 사용자 데이터 접근

사용자는 기본적으로 본인의 개인 캘린더 및 개인 정보를 관리할 수 있다.

Project Manager는 프로젝트 운영에 필요한 범위에서 프로젝트 참여자의 일정 및 업무 정보를 조회할 수 있다.

System Administrator는 전체 시스템 데이터를 관리할 수 있다.

## 43.7 민감 데이터 보호

권한 없는 사용자에게 다음 정보를 노출해서는 안 된다.

- 개인 캘린더
- 휴가/부재 정보
- 개인별 작업량
- 개인별 진척 의견
- 지연 원인
- Challenge 응답
- AI 분석 결과
- 프로젝트 내부 보고서
- Audit Log

## 43.8 AI API 보안

클라이언트에서 AI Provider API를 직접 호출하지 않는다.

```text
Client
  ↓
Backend API
  ↓
Authentication / Authorization
  ↓
Project Access Control
  ↓
AI Service
  ↓
AI Result 저장
  ↓
Client
```

AI Provider API Key는 서버에만 저장한다.

API Key, Secret, Database Credential 등을 Web/Mobile Client에 포함하지 않는다.

AI에 전달하는 데이터 역시 사용자의 프로젝트 권한 범위 내에서만 구성한다.

## 43.9 Rate Limit

무차별 API 호출과 악의적인 반복 호출을 방지하기 위해 Rate Limit을 적용한다.

특히 다음 API는 별도의 제한을 적용한다.

- Login
- Token 관련 API
- AI 분석 요청
- Report 생성
- 대량 데이터 조회

Rate Limit은 사용자, IP, API 종류 등을 기준으로 확장 가능하게 설계한다.

## 43.10 Audit Log

다음 작업을 Audit Log에 기록한다.

- 로그인 성공/실패
- 사용자 생성/변경/비활성화
- 프로젝트 멤버 변경
- Task 생성/변경/삭제
- 일정 변경
- Dependency 변경
- Issue 변경
- Calendar 변경
- 권한 변경
- AI Report 생성
- 주요 데이터 조회

기록 항목:

```text
Actor User
Action
HTTP Method
API Endpoint
Entity Type
Entity ID
Timestamp
IP / Client 정보
Result
Before
After
```

## 43.11 Soft Delete

프로젝트 관리 데이터는 가능한 경우 Hard Delete보다 Soft Delete를 우선한다.

삭제된 Task, Issue, Project 등의 이력을 일정 분석 및 감사 목적으로 추적할 수 있어야 한다.

---

# 47. API 오류 및 보안 응답

API는 일관된 HTTP 상태 코드와 오류 구조를 사용한다.

```text
401 Unauthorized
→ 인증되지 않은 사용자

403 Forbidden
→ 인증은 되었으나 권한 없음

404 Not Found
→ 존재하지 않거나 권한상 존재 여부를 노출하지 않아야 하는 리소스

409 Conflict
→ 일정/Dependency 등의 데이터 충돌

422 Unprocessable Entity
→ 입력값 검증 실패

429 Too Many Requests
→ Rate Limit 초과

500 Internal Server Error
→ 서버 내부 오류
```

권한이 없는 리소스의 존재 여부 자체가 민감한 경우 403 대신 404로 응답할 수 있다.

---

# 48. API 보안 Acceptance Criteria

- 인증 없이 보호된 API를 호출할 수 없어야 한다.
- 만료된 Access Token으로 보호된 API를 호출할 수 없어야 한다.
- 권한 없는 사용자가 다른 프로젝트의 Project ID를 직접 입력해도 데이터를 조회할 수 없어야 한다.
- 권한 없는 사용자가 다른 사용자의 Task를 임의로 수정할 수 없어야 한다.
- Project Member가 System Admin API를 호출할 수 없어야 한다.
- AI Provider API Key가 Client에 노출되지 않아야 한다.
- AI API는 Backend를 통해서만 호출되어야 한다.
- 운영 API는 HTTPS를 사용해야 한다.
- 주요 변경 작업은 Audit Log에 남아야 한다.
- Rate Limit이 적용되어야 한다.

# 49. 기존 보안 요구사항

- 모든 API 인증
- 프로젝트별 권한 검사
- 사용자별 데이터 접근 제한
- 관리자 권한 검증
- 민감 데이터 최소 노출
- Audit Log
- AI에 전달되는 데이터의 접근 권한 검증
- 삭제보다 Soft Delete 우선
- 모든 주요 변경의 추적 가능성 확보

---

# 47. MVP 구현 우선순위

## Phase 1 - 기본 시스템

- 로그인
- 사용자
- 권한
- 프로젝트
- 프로젝트 멤버
- Group
- Task
- Child Task
- 기본 일정
- 기본 진척률

## Phase 2 - 일정 엔진

- 작업량
- Project Calendar
- User Calendar
- Task Dependency
- Critical Path
- Baseline
- Current Plan
- Forecast
- 일정 변경 이력

## Phase 3 - Issue 및 협업

- Issue Task
- 현상/원인/개선
- Progress Update
- 지연 원인
- 사용자 의견
- 일정 회복 대책

## Phase 4 - Dashboard 및 Chart

- Gantt Chart
- Progress Chart
- Baseline Overlay
- Actual Overlay
- Forecast
- Gap Highlight
- Critical Path 표시

## Phase 5 - AI

- 지연 예측
- Risk Detection
- Daily Challenge
- 사용자별 Daily Report
- AI 질문/응답
- Weekly Manager Report
- AI KPI 분석
- 대책 추천

## Phase 6 - Notification

- Push
- Email
- Telegram/Slack/Teams 확장 구조

---

# 48. 핵심 Acceptance Criteria

## 프로젝트

- 사용자는 자신이 참여한 프로젝트만 조회할 수 있다.
- 한 사용자는 여러 프로젝트에 참여할 수 있다.
- 프로젝트마다 사용자를 복수 명 배정할 수 있다.

## Task

- Task는 Child Task를 가질 수 있다.
- Child Task는 다시 Child Task를 가질 수 있다.
- Task에는 시작일/종료일/작업량이 존재한다.
- Task는 복수 담당자를 가질 수 있다.

## 일정

- 최초 계획은 Baseline으로 보존된다.
- Current Plan과 Actual을 구분한다.
- Project Calendar와 User Calendar를 함께 고려한다.
- Dependency에 따라 일정이 연쇄적으로 계산된다.
- Critical Path를 계산할 수 있다.

## Issue

- Issue는 기존 Task의 Child Task로 생성할 수 있다.
- Issue에는 현상/원인/개선/결과를 기록할 수 있다.
- Issue의 추가 작업량이 일정 계산에 반영된다.

## 진척

- 계획 진척률이 자동 계산된다.
- 실제 진척률을 기록할 수 있다.
- 사용자가 진척률을 보정할 수 있다.
- 계획과 실제의 Gap을 계산한다.

## 지연

- 일정 지연을 자동 감지한다.
- 예상 완료일을 계산한다.
- 지연 원인을 사용자에게 요청한다.
- 사용자 의견을 저장한다.
- 대책과 예상 회복 기간을 저장한다.

## AI

- 사용자별 Daily Challenge를 생성한다.
- 일정 지연 예상 시 사용자에게 알린다.
- 지연 원인이 없으면 입력을 요청한다.
- 대책이 없으면 대책을 요청한다.
- Issue 및 사용자 의견을 분석한다.
- 관리자용 Weekly Report를 생성한다.
- AI는 사실/사용자 의견/AI 예측을 구분한다.

## Reporting

- Daily Report를 사용자별로 생성한다.
- Weekly Report를 프로젝트별로 생성한다.
- KPI와 차트를 포함한다.
- Baseline/Current/Actual/Forecast를 비교한다.
- 지연 영역을 시각적으로 강조한다.

---

# 49. 최종 UX 목표

사용자가 매일 시스템에 들어왔을 때 가장 먼저 다음을 알 수 있어야 한다.

```text
오늘 내 일정은 어떤가?
       ↓
정상인가?
       ↓
지연되고 있는가?
       ↓
왜 그런가?
       ↓
내가 해야 할 것은 무엇인가?
       ↓
대책을 세우면 언제까지 회복 가능한가?
```

관리자는 다음을 알 수 있어야 한다.

```text
프로젝트가 계획대로 가고 있는가?
       ↓
얼마나 차이가 나는가?
       ↓
어디가 문제인가?
       ↓
Critical Path는 무엇인가?
       ↓
왜 지연되는가?
       ↓
담당자는 어떻게 판단하는가?
       ↓
대책은 무엇인가?
       ↓
프로젝트 완료일은 언제로 예상되는가?
```

---

# 50. 구현 시 최우선 원칙

1. 일정 계산은 AI가 아니라 Deterministic Engine이 담당한다.
2. 최초 계획은 반드시 Baseline으로 보존한다.
3. 모든 변경은 이력으로 남긴다.
4. Project Calendar와 User Calendar를 모두 고려한다.
5. Task와 Child Task의 계층 구조를 유지한다.
6. Dependency와 Critical Path를 별도로 관리한다.
7. Issue는 문제 해결을 위해 생성된 Child Task로 취급한다.
8. 사용자의 의견을 구조화하여 저장한다.
9. 시스템 계산 결과와 사용자의 판단을 분리한다.
10. AI는 데이터를 해석하고 질문하고 보고하는 역할을 한다.
11. AI의 예측도 이력으로 보존한다.
12. 사용자가 매일 해야 할 행동을 AI Challenge로 명확하게 제시한다.
13. 관리자에게는 숫자뿐 아니라 지연 원인과 사용자 의견까지 제공한다.
14. UI보다 데이터 모델과 일정 엔진의 정확성을 우선한다.
15. 향후 AI 모델 교체가 가능하도록 AI 계층을 독립시킨다.

---

# 51. 구현 완료 시 기대 결과

최종 시스템은 단순히 다음을 보여주는 프로그램이 아니다.

```text
Task 1: 70%
Task 2: 50%
Task 3: 30%
```

다음과 같은 의사결정을 지원해야 한다.

```text
Project A는 현재 계획 대비 8%p 지연되어 있다.

현재 예상 완료일은 9/24로,
Baseline보다 4일 늦을 것으로 예상된다.

주요 원인은:

1. Critical Path의 Task B가 2일 지연
2. Issue Task가 추가되어 16h의 작업량 증가
3. 담당자 휴가로 8h의 작업 가능 시간 감소

담당자는
"외부 업체 사양 전달 지연이 주요 원인"이라고 판단했다.

현재 대책은
개발자 1명 추가 투입이다.

AI 분석 결과,
해당 대책 적용 시 예상 지연은 4일에서 2일로 감소할 가능성이 있다.

따라서 현재 프로젝트의 위험도는 WARNING이며,
Task B 담당자에게 오늘 일정 회복 계획을 확인하도록 Challenge를 발송한다.
```

이 수준까지 연결되는 것을 본 시스템의 **최종 구현 목표**로 한다.
