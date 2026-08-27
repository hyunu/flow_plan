"""초기 시드 데이터 생성기 — 3개 상세 프로젝트(전체 기능 포함).

Project A: 스마트팩토리 MES 구축 (~65 tasks)
Project B: 커머스 앱 리뉴얼   (~75 tasks)
Project C: 차세대 ERP 구축    (~90 tasks)

사용법: python -m app.seed
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.entities import (
    Challenge,
    EmailConfig,
    Forecast,
    Group,
    Milestone,
    Notification,
    ProgressUpdate,
    Project,
    ProjectCalendar,
    ProjectCalendarEntry,
    ProjectMember,
    Role,
    ScheduleChange,
    Task,
    TaskAssignment,
    TaskDependency,
    User,
    UserCalendar,
    UserCalendarEntry,
    UserReportSetting,
)
from app.services.schedule_service import apply_engine_progress

# ---------------------------------------------------------------- 사용자
ROLES = [
    ("System Administrator", "시스템 전체 관리"),
    ("Project Manager", "프로젝트 관리자"),
    ("Project Member", "프로젝트 멤버"),
]

USERS = [
    # (username, email, name, password, role_key)
    ("admin", "admin@flowplan.dev", "시스템 관리자", "admin123", "admin"),
    ("pm_a", "pma@flowplan.dev", "김종훈", "pm123", "pm"),        # Project A PM
    ("pm_b", "pmb@flowplan.dev", "이수진", "pm123", "pm"),        # Project B PM
    ("pm_c", "pmc@flowplan.dev", "박도현", "pm123", "pm"),        # Project C PM
    ("dev_back", "back@flowplan.dev", "윤태양", "member123", "member"),
    ("dev_fe", "fe@flowplan.dev", "최서연", "member123", "member"),
    ("dev_mes", "mes@flowplan.dev", "강민수", "member123", "member"),
    ("dev_fw", "fw@flowplan.dev", "정하늘", "member123", "member"),
    ("plan", "plan@flowplan.dev", "조은비", "member123", "member"),
    ("design", "design@flowplan.dev", "한지민", "member123", "member"),
    ("qa", "qa@flowplan.dev", "오세훈", "member123", "member"),
    ("infra", "infra@flowplan.dev", "임태호", "member123", "member"),
    ("dba", "dba@flowplan.dev", "송지우", "member123", "member"),
    ("erp", "erp@flowplan.dev", "배준호", "member123", "member"),
]

# ---------------------------------------------------------------- 피드백 풀
DELAY_FEEDBACK = {
    "외부 업체 지연": [
        ("외부 벤더의 API 사양서가 예정보다 늦게 도착했습니다. 수신 후 바로 반영하도록 하겠습니다.", "벤더에 사양 마감일을 명시하고 주간 점검 미팅을 추가했습니다.", 3),
        ("설비 공급사 납기가 지연되어 현장 설치 일정이 밀렸습니다.", "공급사 일정 재협의 및 임시 대체 장비로 검증 병행", 2),
        ("클라우드 인프라 권한 발급이 지연되어 배포가 늦어지고 있습니다.", "권한 신청 프로세스 간소화 협의", 1),
    ],
    "요구사항 변경": [
        ("사용자 요구사항이 추가되어 인터페이스 설계를 변경 중입니다.", "추가 요구사항 우선순위 확정, 스코프 미팅 개최", 2),
        ("현장 요청으로 실적 리포트 항목이 5건 추가되었습니다.", "항목별 담당 지정 및 일정 조정안 PM 승인", 1),
        ("규정 개정으로 전자결재 양식이 바뀌어 재작업이 필요합니다.", "양식 템플릿 일괄 적용 스크립트 작성", 2),
    ],
    "기술 문제": [
        ("레거시 DB 마이그레이션 중 문자셋 충돌이 발생했습니다.", "문자셋 통일 방안 적용 및 사전 검증 프로세스 강화", 3),
        ("타 시스템 연계 API 인증 연동에서 문제가 발생해 원인 분석 중입니다.", "인증 모듈 로그 분석 후 핫픽스 배포 예정", 2),
        ("실시간 수집 데이터의 시계열 정합성 문제가 확인되었습니다.", "버퍼링 정책 변경 및 재현 테스트 진행", 2),
    ],
    "인력 부족": [
        ("담당자가 타 프로젝트와 중복 배정되어 가용 시간이 부족합니다.", "업무 재분배 및 추가 인력 투입 검토 중", 2),
        ("시니어 리소스 이탈로 설계 리뷰가 지연되고 있습니다.", "외부 전문가 리뷰 요청", 2),
    ],
    "작업량 증가": [
        ("초기 산정 대비 테스트 케이스가 30% 증가했습니다.", "테스트 자동화 도입으로 회귀 시간 단축", 1),
        ("연계 시스템 수가 3개 추가되어 통합 작업량이 늘었습니다.", "연계 우선순위 조정 및 스텁 검증 진행", 2),
    ],
    "선행 Task 지연": [
        ("선행 설계가 지연되어 개발 시작이 늦어졌습니다.", "설계 산출물 우선순위 조정으로 개발 일부 병행", 2),
        ("상위 모듈 승인이 늦어 하위 개발 일정에 영향이 있습니다.", "인터페이스 계약을 조기 확정해 병행 개발", 1),
    ],
    "사용자 휴가/부재": [
        ("담당자 휴가로 인해 작업 가능 시간이 감소했습니다.", "후임 멘토링 및 업무 분장 재조정", 1),
        ("팀원 출장이 잦아 집중 개발 시간을 확보하기 어렵습니다.", "집중 개발 주간(스프린트) 운영", 1),
    ],
    "환경 문제": [
        ("개발 서버 리소스 부족으로 빌드가 지연되고 있습니다.", "서버 증설 및 빌드 파이프라인 최적화", 1),
        ("테스트 환경 장애로 검증 일정이 미뤄졌습니다.", "환경 복구 및 회귀 테스트 우선 수행", 1),
    ],
    "Issue 발생": [
        ("운영 중 발견된 이슈 대응으로 계획 작업이 지연되었습니다.", "이슈 전담 인력 배정으로 원복", 2),
    ],
}

NORMAL_FEEDBACK = [
    ("요구사항 분석 완료, 기능 목록을 확정했습니다.", "상세 설계 착수 예정"),
    ("프로토타입 구현을 완료했습니다.", "내부 리뷰 후 확장 개발 진행"),
    ("핵심 로직 개발 완료, 단위 테스트 진행 중입니다.", "테스트 후 코드리뷰 예정"),
    ("화면 개발 50% 완료했습니다.", "디자인 시안 기준으로 구현 중"),
    ("DB 스키마 1차 확정했습니다.", "인덱스·파티셔닝 튜닝 예정"),
    ("API 계약을 문서화하고 스텁을 배포했습니다.", "연동 팀 협업 시작"),
    ("배포 파이프라인 1차 구축 완료했습니다.", "운영 환경 전환 테스트 예정"),
    ("테스트 시나리오 작성 중입니다.", "이슈 로그 정리 병행"),
    ("코드리뷰 반영 완료, 정적 분석 통과했습니다.", "통합 브랜치 병합 예정"),
]

# ---------------------------------------------------------------- 헬퍼
WEEKDAY = {0, 1, 2, 3, 4}


def _fmt(d: date) -> date:
    return d


class P:
    """프로젝트 빌더: 날짜는 프로젝트 시작일 기준 day offset으로 지정한다."""

    def __init__(self, db: Session, users: dict, name: str, desc: str, manager: str, start: date, member_keys: list[str]):
        self.db = db
        self.start = start
        self.manager = users[manager]
        self.project = Project(name=name, description=desc, manager_id=self.manager.id)
        db.add(self.project)
        db.flush()
        db.add(ProjectCalendar(project_id=self.project.id, daily_work_hours=8.0, work_days="0,1,2,3,4"))
        for k in member_keys:
            db.add(ProjectMember(project_id=self.project.id, user_id=users[k].id,
                                 role_in_project="manager" if k == manager else "member"))
        self.groups: dict[str, Group] = {}
        self.deps: list[tuple[int, int, int]] = []
        self.milestones: list[Milestone] = []
        self.last_task: int | None = None

    def group(self, name: str, sort: int) -> Group:
        g = Group(project_id=self.project.id, name=name, sort_order=sort)
        self.db.add(g)
        self.db.flush()
        self.groups[name] = g
        return g

    def d(self, day: int) -> date:
        """프로젝트 시작일 기준 offset(평일만 이동)."""
        d = self.start
        step = 1 if day >= 0 else -1
        rem = abs(day)
        while rem > 0:
            d += timedelta(days=step)
            if d.weekday() in WEEKDAY:
                rem -= 1
        return d

    def task(self, title: str, g: str, start: int, end: int, work: float, assignee: str,
             status: str = "not_started", prog: float = 0.0, parent: int | None = None,
             task_type: str = "normal", is_issue: bool = False, issue: dict | None = None,
             hours: float | None = None) -> int:
        u = self.users(assignee)
        t = Task(
            project_id=self.project.id, group_id=self.groups[g].id, parent_id=parent,
            title=title, plan_start=self.d(start), plan_end=self.d(end), workload=work,
            task_type=task_type, is_issue=is_issue, created_by=self.manager.id,
            status="completed" if status == "done" else "in_progress" if status in ("doing", "delayed") else "not_started",
        )
        if status in ("done", "doing", "delayed"):
            t.effective_progress = prog if status in ("doing", "delayed") else 100.0
            t.schedule_progress = prog
        t.baseline_start = t.plan_start
        t.baseline_end = t.plan_end
        t.baseline_workload = work
        if is_issue and issue:
            t.issue_symptom = issue.get("symptom")
            t.issue_cause = issue.get("cause")
            t.issue_impact = issue.get("impact")
            t.issue_solution = issue.get("solution")
            t.issue_resolve_plan_date = self.d(issue.get("resolve", end))
        self.db.add(t)
        self.db.flush()
        self.db.add(TaskAssignment(task_id=t.id, user_id=u.id, workload_hours=hours if hours is not None else work, assigned_by=self.manager.id))
        if self.last_task and parent is None:
            self.deps.append((self.last_task, t.id, 0))  # 그룹 내 이전 Task FS 연쇄
        self.last_task = t.id
        return t.id

    def users(self, key: str) -> User:
        return self._users[key]

    def bind_users(self, users: dict):
        self._users = users

    def dep(self, pred: int, succ: int, lag: int = 0):
        self.deps.append((pred, succ, lag))

    def batch(self, g: str, parent: int | None, specs: list[tuple]):
        """specs: (title, start, end, work, assignee, status, prog)"""
        ids = []
        for s in specs:
            ids.append(self.task(s[0], g, s[1], s[2], s[3], s[4], s[5], s[6], parent=parent))
        return ids

    def milestone(self, name: str, start: int, end: int, status: str = "pending", progress: float = 0.0):
        self.milestones.append(
            Milestone(project_id=self.project.id, name=name, sort_order=len(self.milestones) + 1,
                      start_date=self.d(start), end_date=self.d(end), status=status, progress=progress,
                      owner_id=self.manager.id)
        )

    def finalize(self, today: date):
        db = self.db
        for pred, succ, lag in self.deps:
            db.add(TaskDependency(predecessor_id=pred, successor_id=succ, dependency_type="FS", lag_days=lag, created_by=self.manager.id))
        for m in self.milestones:
            db.add(m)
        db.flush()
        apply_engine_progress(db, self.project, today)


def _feedback(db: Session, project_id: int, task_id: int, user: User, today: date, delayed: bool, cat: str | None = None, idx: int = 0):
    if delayed:
        pool = DELAY_FEEDBACK.get(cat or "기술 문제", DELAY_FEEDBACK["기술 문제"])
        cause_text, recovery, days = pool[idx % len(pool)]
        pu = ProgressUpdate(
            task_id=task_id, author_id=user.id,
            current_status="계획 대비 지연 상태입니다.",
            work_done="진행 중인 작업은 마무리했습니다.",
            problems=cause_text,
            delay_cause=cause_text, delay_cause_category=cat or "기술 문제",
            recovery_plan=recovery, next_plan="대책 반영 후 일정 재확인",
            expected_delay_days=days,
        )
        db.add(pu)
        # 일정 변경 이력(지연 반영)
        task = db.get(Task, task_id)
        if task and task.plan_end:
            db.add(ScheduleChange(
                task_id=task_id, before_end=task.plan_end, after_end=task.plan_end + timedelta(days=max(days - 1, 1) * 7 // 5),
                changed_by=user.id, reason=f"{cat}로 인한 일정 조정", user_opinion=cause_text,
            ))
    else:
        text, next_plan = NORMAL_FEEDBACK[idx % len(NORMAL_FEEDBACK)]
        db.add(ProgressUpdate(
            task_id=task_id, author_id=user.id, current_status=text, work_done=text,
            next_plan=next_plan,
        ))


CAT_BY_KEYWORD = [
    ("벤더|업체|설비 납기|사양서|외부", "외부 업체 지연"),
    ("요구사항|변경|스코프|규정|리포트 항목", "요구사항 변경"),
    ("API|DB|성능|시계열|마이그레이션|연계|캐시|쿼리", "기술 문제"),
    ("인력|리소스|이탈|멘토", "인력 부족"),
    ("테스트|케이스|회귀|자동화", "작업량 증가"),
    ("선행|설계|승인|인터페이스 계약", "선행 Task 지연"),
    ("휴가|부재|출장", "사용자 휴가/부재"),
    ("서버|환경|빌드|리소스", "환경 문제"),
    ("이슈|장애|대응", "Issue 발생"),
]


def pick_category(title: str) -> str:
    for pat, cat in CAT_BY_KEYWORD:
        import re

        if re.search(pat, title, re.I):
            return cat
    return "기타"


def backfill_feedback(db: Session, project: Project, users: dict, today: date):
    """진행 중/지연 Task에 피드백이 없으면 지연원인 또는 정상 피드백을 자동 주입."""
    from app.services.schedule_service import compute_project_schedule

    result = compute_project_schedule(db, project, today)
    delay_by = {t.task_id: t.delay_days for t in result.tasks}
    tasks = db.query(Task).filter_by(project_id=project.id, is_deleted=False).all()
    idx = 0
    for t in tasks:
        if t.status not in ("in_progress", "delayed"):
            continue
        if db.query(ProgressUpdate).filter_by(task_id=t.id).count() > 0:
            continue
        assignee = t.assignments[0].user if t.assignments else project.manager
        delayed = (delay_by.get(t.id) or 0) > 0
        cat = pick_category(t.title) if delayed else None
        _feedback(db, project.id, t.id, assignee, today, delayed, cat, idx)
        idx += 1
    db.commit()


def seed(db: Session) -> None:
    Base.metadata.create_all(bind=engine)
    if db.query(Role).count() > 0:
        print("이미 데이터가 존재합니다. 초기화하려면 backend/data/flow_plan.db 를 삭제 후 재실행하세요.")
        return

    roles = {}
    for name, desc in ROLES:
        r = Role(name=name, description=desc)
        db.add(r)
        roles[name] = r
    db.flush()

    users: dict[str, User] = {}
    role_map = {"admin": "System Administrator", "pm": "Project Manager", "member": "Project Member"}
    for username, email, name, pw, key in USERS:
        u = User(username=username, email=email, name=name, hashed_password=hash_password(pw),
                 role_id=roles[role_map[key]].id)
        db.add(u)
        db.flush()
        db.add(UserCalendar(user_id=u.id, daily_work_hours=8.0))
        users[username] = u
    db.flush()

    today = date(2026, 8, 26)

    # ================================================================ Project A
    a = P(db, users, "Project A - 스마트팩토리 MES 구축",
          "스마트팩토리 MES(제조실행시스템) 플랫폼 구축: 설비 연동부터 생산계획/실적집계/모니터링까지",
          "pm_a", date(2026, 8, 10), [
              "pm_a", "dev_back", "dev_fe", "dev_mes", "dev_fw", "plan", "design", "qa", "infra", "dba"])
    a.bind_users(users)
    a.group("기획", 1)
    a.group("HW 설계", 2)
    a.group("SW 개발", 3)
    a.group("검증", 4)
    a.group("배포·운영", 5)

    # --- 기획
    req = a.task("사업 요구사항 수집", "기획", 0, 4, 32, "plan", "done", 100)
    a.task("현장 조사 및 데이터 수집", "기획", 2, 6, 40, "dev_mes", "done", 100)
    a.task("요구사항 정의서 작성", "기획", 5, 9, 32, "plan", "done", 100, parent=req)
    a.task("MES 기능 정의 워크숍", "기획", 7, 11, 40, "dev_mes", "done", 100, parent=req)
    a.task("프로세스 벤치마킹", "기획", 8, 12, 32, "plan", "done", 100, parent=req)
    a.task("기획 리뷰 및 승인", "기획", 11, 13, 16, "pm_a", "done", 100)
    a.milestone("착수·요구사항 확정", 0, 13, "completed", 100)

    # --- HW 설계
    hw1 = a.task("HW 아키텍처 설계", "HW 설계", 12, 18, 48, "infra", "done", 100)
    a.task("공정 설비 요구 분석", "HW 설계", 12, 16, 32, "dev_mes", "done", 100, parent=hw1)
    a.task("센서·게이트웨이 사양 정의", "HW 설계", 14, 19, 40, "dev_fw", "done", 90, parent=hw1)
    iface = a.task("설비 인터페이스 명세", "HW 설계", 19, 26, 40, "infra", "doing", 60)
    a.task("OPC UA 연계 설계", "HW 설계", 21, 27, 40, "dev_back", "doing", 55, parent=iface)
    a.task("MQTT 토픽 설계", "HW 설계", 22, 28, 32, "dev_fw", "doing", 50, parent=iface)
    fw = a.task("게이트웨이 펌웨어 개발", "HW 설계", 27, 40, 88, "dev_fw", "delayed", 35)
    _feedback(db, a.project.id, fw, users["dev_fw"], today, True, "외부 업체 지연", 0)
    a.task("설비 데이터 수집 에이전트", "HW 설계", 33, 44, 64, "dev_fw", "doing", 25, parent=fw)
    a.milestone("설계 완료", 12, 30, "in_progress", 55)

    # --- SW 개발
    sw_back = a.task("MES 백엔드 개발", "SW 개발", 30, 62, 240, "dev_back", "doing", 40)
    a.task("시스템 아키텍처 설계", "SW 개발", 30, 36, 40, "dev_back", "done", 100, parent=sw_back)
    a.task("DB 설계 및 스키마 확정", "SW 개발", 34, 40, 40, "dba", "done", 100, parent=sw_back)
    auth_t = a.task("인증·권한 모듈", "SW 개발", 40, 47, 48, "dev_back", "doing", 70, parent=sw_back)
    _feedback(db, a.project.id, auth_t, users["dev_back"], today, False)
    plan_m = a.task("생산 계획 모듈", "SW 개발", 43, 53, 72, "dev_mes", "delayed", 30)
    _feedback(db, a.project.id, plan_m, users["dev_mes"], today, True, "요구사항 변경", 1)
    perf_m = a.task("실적 집계 모듈", "SW 개발", 48, 60, 64, "dev_mes", "doing", 20)
    _feedback(db, a.project.id, perf_m, users["dev_mes"], today, False)
    eq_if = a.task("설비 연동 API", "SW 개발", 50, 64, 80, "dev_back", "doing", 15)
    issue = a.task("Issue: 작업지시 API 응답 지연", "SW 개발", 58, 64, 16, "dev_back", "delayed", 40, parent=eq_if,
                   is_issue=True, issue={"symptom": "작업지시 API 응답이 3초 이상 지연됨", "cause": "Connection Pool 부족 및 N+1 쿼리",
                                          "impact": "설비 자동화 지시 전송 지연", "solution": "Pool Size 20→50, 쿼리 최적화", "resolve": 64})
    _feedback(db, a.project.id, issue, users["dev_back"], today, True, "Issue 발생", 0)
    alert = a.task("알림·이벤트 서비스", "SW 개발", 55, 68, 48, "dev_back", "doing", 10)
    _feedback(db, a.project.id, alert, users["dev_back"], today, False, idx=5)

    fe = a.task("MES 프론트엔드 개발", "SW 개발", 45, 76, 200, "dev_fe", "doing", 35)
    a.task("대시보드 화면", "SW 개발", 45, 56, 56, "dev_fe", "doing", 50, parent=fe)
    _feedback(db, a.project.id, fe, users["dev_fe"], today, False, idx=3)
    a.task("생산 모니터링 화면", "SW 개발", 54, 65, 48, "dev_fe", "doing", 30, parent=fe)
    a.task("관리자 설정 화면", "SW 개발", 62, 72, 48, "design", "doing", 20, parent=fe)
    a.task("실적 리포트 화면", "SW 개발", 68, 78, 40, "dev_fe", "not_started", 0, parent=fe)
    a.milestone("개발 완료", 30, 78, "in_progress", 35)

    # --- 검증
    it = a.task("통합 테스트", "검증", 76, 88, 80, "qa", "not_started")
    a.task("API 계약 테스트", "검증", 76, 82, 40, "qa", "not_started", parent=it)
    a.task("E2E 시나리오 테스트", "검증", 82, 90, 48, "qa", "not_started", parent=it)
    a.task("성능·부하 테스트", "검증", 88, 96, 48, "qa", "not_started")
    a.task("UAT(사용자 인수)", "검증", 94, 102, 40, "pm_a", "not_started")
    a.milestone("검증 완료", 76, 102, "pending")

    # --- 배포
    dep = a.task("배포 자동화 파이프라인", "배포·운영", 100, 108, 32, "infra", "not_started")
    a.task("운영 환경 구성", "배포·운영", 104, 112, 40, "infra", "not_started")
    a.task("운영 전환 및 모니터링", "배포·운영", 110, 118, 40, "infra", "not_started", parent=dep)
    a.milestone("오픈", 100, 118, "pending")
    a.dep(fe, it, 0)

    # --- A 확장: 상세 하위 태스크 (SW 백엔드/프론트/검증/배포)
    a.batch("기획", req, [
        ("데이터 표준·코드 체계 정의", 6, 12, 32, "dba", "done", 100),
        ("화면 표준·컴포넌트 가이드", 10, 16, 40, "design", "done", 100),
        ("보고서 요구정의", 12, 18, 32, "plan", "doing", 60),
    ])
    a.batch("HW 설계", hw1, [
        ("PLC 연계 인터페이스 시험", 20, 30, 40, "dev_fw", "doing", 45),
        ("태깅·주소 매핑 설계", 24, 32, 32, "dev_mes", "doing", 40),
        ("엣지 컴퓨팅 검증", 28, 38, 48, "dev_fw", "doing", 25),
        ("설비 상태 모니터링 정의", 30, 40, 32, "infra", "doing", 20),
    ])
    a.batch("SW 개발", sw_back, [
        ("기준정보·마스터 관리", 44, 52, 48, "dev_mes", "doing", 45),
        ("공정관리 모듈", 50, 60, 64, "dev_mes", "doing", 30),
        ("설비관리 모듈", 54, 64, 56, "dev_mes", "doing", 20),
        ("품질관리 모듈", 58, 68, 56, "dev_back", "doing", 15),
        ("재고·자재 모듈", 62, 72, 56, "dev_back", "doing", 10),
        ("공통코드·설정 서비스", 40, 48, 40, "dev_back", "done", 100),
        ("배치·스케줄 처리", 66, 76, 48, "dev_back", "not_started", 0),
        ("캐시·성능 튜닝", 70, 78, 40, "dba", "not_started", 0),
        ("로깅·추적·감사 로그", 46, 54, 32, "dev_back", "doing", 50),
        ("보안 점검(취약점 진단)", 72, 80, 32, "infra", "not_started", 0),
    ])
    a.batch("SW 개발", fe, [
        ("공정현황 화면", 58, 66, 40, "dev_fe", "doing", 25),
        ("설비관리 화면", 64, 72, 40, "dev_fe", "not_started", 0),
        ("품질 화면", 68, 76, 40, "design", "not_started", 0),
        ("기준정보 관리 화면", 66, 74, 40, "dev_fe", "not_started", 0),
        ("모바일 대응 화면", 74, 82, 40, "dev_fe", "not_started", 0),
    ])
    a.batch("검증", it, [
        ("테스트 자동화 구축", 78, 86, 48, "qa", "not_started", 0),
        ("보안 취약점 점검", 86, 92, 32, "qa", "not_started", 0),
        ("장애 복구 테스트", 90, 96, 32, "infra", "not_started", 0),
    ])
    a.batch("배포·운영", dep, [
        ("Kubernetes 배포 구성", 100, 108, 40, "infra", "not_started", 0),
        ("백업·복구 체계 구축", 104, 112, 40, "dba", "not_started", 0),
        ("DR 구성 및 검증", 108, 116, 40, "infra", "not_started", 0),
    ])
    a.finalize(today)

    # ================================================================ Project B
    b = P(db, users, "Project B - 커머스 앱 리뉴얼",
          "B2C 이커머스 모바일 앱 전면 리뉴얼: 리서치/디자인/백엔드/앱 개발/QA/출시",
          "pm_b", date(2026, 8, 17), [
              "pm_b", "dev_back", "dev_fe", "plan", "design", "qa", "dba", "dev_mes"])
    b.bind_users(users)
    b.group("리서치·기획", 1)
    b.group("디자인", 2)
    b.group("백엔드", 3)
    b.group("앱 개발", 4)
    b.group("QA·출시", 5)

    # --- 리서치
    r1 = b.task("사용자 리서치", "리서치·기획", 0, 5, 40, "plan", "done", 100)
    b.task("UX 리서치 인터뷰", "리서치·기획", 0, 4, 32, "plan", "done", 100, parent=r1)
    b.task("데이터 분석(매출·이탈)", "리서치·기획", 2, 7, 40, "dba", "done", 100, parent=r1)
    b.task("경쟁사 앱 분석", "리서치·기획", 3, 8, 32, "plan", "done", 100, parent=r1)
    r2 = b.task("요구사항 정의", "리서치·기획", 8, 13, 32, "pm_b", "done", 100)
    b.task("정보구조(IA) 설계", "리서치·기획", 9, 14, 32, "plan", "done", 100, parent=r2)
    b.task("스토리보드 작성", "리서치·기획", 11, 16, 40, "plan", "doing", 60, parent=r2)
    b.milestone("리서치 완료", 0, 16, "completed", 100)

    # --- 디자인
    d1 = b.task("UX/UI 디자인", "디자인", 14, 30, 120, "design", "doing", 55)
    b.task("디자인 시스템 구축", "디자인", 14, 20, 40, "design", "done", 100, parent=d1)
    b.task("메인/카테고리 화면", "디자인", 18, 25, 40, "design", "doing", 60, parent=d1)
    b.task("상품상세/구매플로우", "디자인", 22, 30, 48, "design", "doing", 40, parent=d1)
    b.task("마이페이지/쿠폰", "디자인", 26, 33, 40, "design", "doing", 30, parent=d1)
    b.task("프로토타입 및 검증", "디자인", 30, 36, 32, "design", "not_started", 0)
    b.milestone("디자인 완료", 14, 36, "in_progress", 50)

    # --- 백엔드
    be = b.task("백엔드 개발", "백엔드", 20, 52, 240, "dev_back", "doing", 45)
    b.task("MSA 아키텍처 설계", "백엔드", 20, 26, 40, "dev_back", "done", 100, parent=be)
    b.task("주문·결제 API", "백엔드", 26, 36, 80, "dev_back", "doing", 55, parent=be)
    _feedback(db, b.project.id, be, users["dev_back"], today, False)
    b.task("상품·검색 API", "백엔드", 30, 40, 64, "dev_back", "doing", 40, parent=be)
    cart = b.task("장바구니·쿠폰 API", "백엔드", 36, 46, 56, "dev_mes", "delayed", 20)
    _feedback(db, b.project.id, cart, users["dev_mes"], today, True, "작업량 증가", 0)
    b.task("멤버십·리뷰 API", "백엔드", 40, 52, 64, "dev_back", "doing", 15, parent=be)
    b.task("레거시 주문 DB 이관", "백엔드", 44, 55, 64, "dba", "doing", 25)
    _feedback(db, b.project.id, cart, users["dba"], today, True, "기술 문제", 0)
    b.milestone("백엔드 개발", 20, 55, "in_progress", 40)

    # --- 앱 개발
    app = b.task("앱 개발", "앱 개발", 32, 66, 280, "dev_fe", "doing", 30)
    b.task("네이티브 셸·네비게이션", "앱 개발", 32, 40, 56, "dev_fe", "doing", 65, parent=app)
    b.task("상품 목록·검색 화면", "앱 개발", 40, 50, 72, "dev_fe", "doing", 40, parent=app)
    b.task("주문·결제 플로우", "앱 개발", 48, 60, 88, "dev_fe", "doing", 15, parent=app)
    _feedback(db, b.project.id, app, users["dev_fe"], today, True, "선행 Task 지연", 1)
    b.task("푸시·딥링크 연동", "앱 개발", 56, 66, 48, "dev_fe", "not_started", 0, parent=app)
    b.task("앱 배포(스토어) 준비", "앱 개발", 64, 72, 32, "pm_b", "not_started")
    b.milestone("앱 개발 완료", 32, 72, "in_progress", 30)

    # --- QA
    qa = b.task("QA 테스트", "QA·출시", 66, 82, 120, "qa", "not_started")
    b.task("테스트 케이스 설계", "QA·출시", 66, 72, 48, "qa", "not_started", parent=qa)
    b.task("기능·회귀 테스트", "QA·출시", 72, 82, 72, "qa", "not_started", parent=qa)
    b.task("성능·보안 점검", "QA·출시", 78, 86, 48, "qa", "not_started")
    b.task("베타 출시 및 피드백 수집", "QA·출시", 84, 92, 40, "pm_b", "not_started")
    b.task("스토어 리뷰 대응 준비", "QA·출시", 90, 96, 24, "design", "not_started")
    b.milestone("출시", 66, 96, "pending")
    b.dep(app, qa, 0)

    # --- B 확장: 상세 하위 태스크
    b.batch("리서치·기획", r1, [
        ("사용자 페르소나 정의", 4, 9, 32, "plan", "done", 100),
        ("사용자 저널·니즈 분석", 6, 11, 32, "plan", "done", 100),
    ])
    b.batch("리서치·기획", r2, [
        ("A/B 테스트 설계", 12, 18, 32, "pm_b", "doing", 40),
        ("성과지표(KPI) 정의", 10, 15, 24, "pm_b", "done", 100),
        ("스크럼 백로그 작성", 14, 20, 32, "pm_b", "doing", 55),
    ])
    b.batch("디자인", d1, [
        ("앱 아이콘·스플래시 디자인", 16, 22, 32, "design", "done", 100),
        ("온보딩 화면 디자인", 20, 26, 32, "design", "doing", 65),
        ("장바구니·결제 UI", 24, 31, 40, "design", "doing", 45),
        ("검색·필터 UI", 28, 34, 32, "design", "doing", 30),
        ("리뷰·평점 UI", 30, 36, 32, "design", "doing", 20),
        ("마이페이지 하위 화면", 34, 40, 40, "design", "not_started", 0),
    ])
    b.batch("백엔드", be, [
        ("인증·SSO 연동", 26, 34, 48, "dev_back", "doing", 60),
        ("알림·푸시 API", 34, 42, 40, "dev_back", "doing", 35),
        ("배송·운송 API", 40, 48, 40, "dev_mes", "doing", 20),
        ("환불·취소 API", 44, 52, 40, "dev_mes", "doing", 10),
        ("관리자 API", 48, 56, 48, "dev_back", "not_started", 0),
        ("API 게이트웨이·인증 토큰", 24, 32, 40, "dev_back", "done", 100),
        ("캐시 전략·성능 최적화", 52, 60, 40, "dba", "not_started", 0),
        ("장애 대응·모니터링", 56, 62, 32, "infra", "not_started", 0),
        ("데이터 파이프라인(E-L)", 48, 58, 48, "dba", "not_started", 0),
    ])
    b.batch("앱 개발", app, [
        ("로그인·온보딩 화면", 38, 46, 56, "dev_fe", "doing", 40),
        ("장바구니 화면", 46, 54, 56, "dev_fe", "doing", 25),
        ("검색·필터 화면", 50, 58, 56, "dev_fe", "doing", 10),
        ("리뷰 작성 화면", 54, 62, 40, "dev_fe", "not_started", 0),
        ("마이페이지 화면", 58, 66, 48, "dev_fe", "not_started", 0),
        ("설정·알림 화면", 60, 68, 40, "dev_fe", "not_started", 0),
        ("오프라인 캐시 처리", 62, 70, 40, "dev_fe", "not_started", 0),
        ("웹뷰·외부 링크 연동", 66, 72, 32, "dev_fe", "not_started", 0),
    ])
    b.batch("QA·출시", qa, [
        ("자동화 테스트 스크립트", 70, 78, 48, "qa", "not_started", 0),
        ("보안 점검", 78, 84, 32, "qa", "not_started", 0),
        ("앱스토어 심사 대응", 86, 92, 24, "pm_b", "not_started", 0),
        ("출시 후 모니터링 체계", 90, 96, 24, "infra", "not_started", 0),
    ])
    b.finalize(today)

    # ================================================================ Project C
    c = P(db, users, "Project C - 차세대 ERP 구축",
          "전사 차세대 ERP 시스템 구축: 요구사항/인프라/모듈개발/통합시험/전환 오픈 (재무·구매·인사·생산·영업)",
          "pm_c", date(2026, 8, 1), [
              "pm_c", "erp", "dev_back", "dev_mes", "plan", "qa", "infra", "dba", "dev_fw"])
    c.bind_users(users)
    c.group("요구사항", 1)
    c.group("아키텍처·인프라", 2)
    c.group("모듈 개발", 3)
    c.group("통합시험", 4)
    c.group("전환·오픈", 5)

    # --- 요구사항
    rg = c.task("요구사항 분석", "요구사항", 0, 10, 72, "plan", "done", 100)
    c.task("현행 업무 프로세스 분석", "요구사항", 0, 6, 48, "erp", "done", 100, parent=rg)
    c.task("AS-IS/TO-BE 갭 분석", "요구사항", 5, 12, 48, "plan", "done", 100, parent=rg)
    c.task("요구사항 명세서(RFP) 확정", "요구사항", 8, 16, 40, "pm_c", "done", 100)
    c.task("단위 업무 정의서 작성", "요구사항", 14, 24, 88, "erp", "doing", 60)
    _feedback(db, c.project.id, rg, users["erp"], today, False, idx=0)
    c.milestone("요구사항 확정", 0, 24, "completed", 100)

    # --- 아키텍처/인프라
    arch = c.task("아키텍처 설계", "아키텍처·인프라", 14, 28, 80, "infra", "done", 100)
    c.task("기술스택·표준 선정", "아키텍처·인프라", 14, 20, 40, "infra", "done", 100, parent=arch)
    c.task("서비스 설계(모듈 경계)", "아키텍처·인프라", 18, 26, 48, "dev_back", "done", 100, parent=arch)
    inf = c.task("인프라 구축", "아키텍처·인프라", 26, 46, 96, "infra", "doing", 50)
    _feedback(db, c.project.id, inf, users["infra"], today, False, idx=6)
    c.task("클라우드/미들웨어 구성", "아키텍처·인프라", 26, 38, 56, "infra", "doing", 55, parent=inf)
    c.task("DB 클러스터·백업 구성", "아키텍처·인프라", 34, 46, 48, "dba", "doing", 40, parent=inf)
    c.task("CICD 파이프라인 구축", "아키텍처·인프라", 40, 52, 48, "infra", "doing", 25)
    _feedback(db, c.project.id, inf, users["infra"], today, True, "환경 문제", 0)
    c.milestone("아키텍처 확정", 14, 52, "in_progress", 50)

    # --- 모듈 개발 (5개 도메인, 각 8-10 태스크)
    fin = c.task("재무 모듈", "모듈 개발", 30, 70, 240, "erp", "doing", 40)
    for i, (t, st, en, w, stt, prg) in enumerate([
        ("전표·분개 처리", 30, 40, 56, "done", 100),
        ("결산·마감 프로세스", 36, 48, 64, "doing", 50),
        ("예산·자금 관리", 44, 56, 56, "doing", 30),
        ("고정자산 관리", 50, 62, 48, "doing", 15),
        ("세무·전자세금계산서 연계", 56, 70, 56, "doing", 10),
    ]):
        c.task(t, "모듈 개발", st, en, w, "erp", stt, prg, parent=fin)
    pur = c.task("구매 모듈", "모듈 개발", 36, 76, 216, "dev_mes", "doing", 35)
    for i, (t, st, en, w, stt, prg) in enumerate([
        ("구매요청·발주", 36, 46, 56, "done", 100),
        ("입고·검수 처리", 42, 54, 56, "doing", 45),
        ("공급업체(SRM) 관리", 48, 60, 48, "doing", 25),
        ("구매계약·정산", 54, 68, 48, "doing", 15),
        ("구매 리포트·분석", 64, 76, 40, "doing", 5),
    ]):
        c.task(t, "모듈 개발", st, en, w, "dev_mes", stt, prg, parent=pur)
    hr = c.task("인사·급여 모듈", "모듈 개발", 40, 82, 232, "dev_back", "doing", 30)
    for i, (t, st, en, w, stt, prg) in enumerate([
        ("조직·인사기록 관리", 40, 50, 56, "done", 100),
        ("근태 관리", 46, 58, 56, "doing", 40),
        ("급여·4대보험 계산", 52, 66, 72, "doing", 20),
        ("평가·승진 프로세스", 60, 72, 48, "doing", 10),
        ("인사 리포트", 70, 82, 40, "not_started", 0),
    ]):
        c.task(t, "모듈 개발", st, en, w, "dev_back", stt, prg, parent=hr)
    prod = c.task("생산·품질 모듈", "모듈 개발", 44, 88, 240, "dev_mes", "delayed", 15)
    for i, (t, st, en, w, stt, prg) in enumerate([
        ("BOM·라우팅 관리", 44, 56, 64, "doing", 40),
        ("생산계획(MPS/MRP)", 52, 68, 72, "doing", 20),
        ("공정실적 집계", 60, 74, 56, "doing", 10),
        ("품질검사(QC)", 66, 80, 56, "doing", 5),
        ("설비 연동 인터페이스", 74, 88, 56, "not_started", 0),
    ]):
        c.task(t, "모듈 개발", st, en, w, "dev_mes", stt, prg, parent=prod)
    _feedback(db, c.project.id, prod, users["dev_mes"], today, True, "인력 부족", 0)
    sales = c.task("영업·유통 모듈", "모듈 개발", 48, 92, 224, "erp", "doing", 20)
    for i, (t, st, en, w, stt, prg) in enumerate([
        ("견적·수주 관리", 48, 60, 64, "doing", 35),
        ("판매·출하 관리", 58, 70, 56, "doing", 20),
        ("재고 관리", 64, 78, 56, "doing", 10),
        ("수금·채권 관리", 72, 86, 56, "not_started", 0),
        ("영업 분석 대시보드", 82, 92, 40, "not_started", 0),
    ]):
        c.task(t, "모듈 개발", st, en, w, "erp", stt, prg, parent=sales)
    c.milestone("모듈 개발 완료", 30, 92, "in_progress", 30)

    # --- 통합시험
    sit = c.task("통합시험(SIT)", "통합시험", 88, 108, 160, "qa", "not_started")
    c.task("통합 테스트 시나리오", "통합시험", 88, 96, 56, "qa", "not_started", parent=sit)
    c.task("모듈 간 통합 테스트", "통합시험", 96, 108, 96, "qa", "not_started", parent=sit)
    c.task("성능·스트레스 테스트", "통합시험", 104, 114, 56, "qa", "not_started")
    c.task("사용자 인수테스트(UAT)", "통합시험", 112, 122, 64, "pm_c", "not_started")
    c.milestone("통합시험 완료", 88, 122, "pending")

    # --- 전환/오픈
    conv = c.task("데이터 전환", "전환·오픈", 118, 134, 120, "dba", "not_started")
    c.task("레거시 데이터 정제", "전환·오픈", 118, 128, 72, "dba", "not_started", parent=conv)
    c.task("전환 스크립트·검증", "전환·오픈", 126, 136, 64, "dba", "not_started", parent=conv)
    c.task("병행운전(병행 가동)", "전환·오픈", 132, 144, 88, "pm_c", "not_started")
    c.task("오픈 및 안정화 지원", "전환·오픈", 142, 154, 80, "pm_c", "not_started")
    c.task("운영 인수인계·교육", "전환·오픈", 148, 158, 48, "infra", "not_started")
    c.milestone("ERP 오픈", 118, 158, "pending")

    c.dep(fin, sit, 0)
    c.dep(prod, sit, 0)
    c.dep(sit, conv, 0)

    # --- C 확장: 상세 하위 태스크
    c.batch("요구사항", rg, [
        ("회계기준(IFRS) 적합성 검토", 10, 18, 40, "erp", "done", 100),
        ("전표 규칙·승인체계 정의", 16, 26, 48, "erp", "doing", 55),
        ("권한·보안 요구정의", 18, 28, 40, "plan", "doing", 40),
    ])
    c.batch("아키텍처·인프라", arch, [
        ("계정·권한(IAM) 설계", 22, 32, 40, "infra", "doing", 60),
        ("네트워크 구성 설계", 24, 34, 40, "infra", "doing", 45),
    ])
    c.batch("아키텍처·인프라", inf, [
        ("모니터링·알림 구축", 42, 52, 40, "infra", "doing", 30),
        ("백업·DR 설계", 44, 54, 40, "dba", "doing", 25),
        ("보안(암호화·취약점) 구성", 48, 58, 40, "infra", "not_started", 0),
        ("배치 서버 구성", 50, 58, 32, "infra", "not_started", 0),
    ])
    c.batch("모듈 개발", fin, [
        ("외화·채권채무 관리", 58, 70, 56, "erp", "doing", 15),
        ("결산 보고서 생성", 62, 74, 48, "erp", "doing", 5),
        ("전표 승인 워크플로", 40, 50, 48, "erp", "doing", 55),
    ])
    c.batch("모듈 개발", pur, [
        ("견적 비교·낙찰 처리", 56, 66, 48, "dev_mes", "doing", 20),
        ("자재 소요(MRP 연계)", 60, 72, 56, "dev_mes", "doing", 10),
        ("검수·반품 처리", 64, 76, 40, "dev_mes", "not_started", 0),
    ])
    c.batch("모듈 개발", hr, [
        ("채용 관리", 62, 72, 40, "dev_back", "doing", 10),
        ("교육·복리후생 관리", 68, 78, 40, "dev_back", "not_started", 0),
    ])
    c.batch("모듈 개발", prod, [
        ("공정 지시·작업장 관리", 66, 78, 56, "dev_mes", "doing", 10),
        ("설비 가동률 관리", 72, 84, 48, "dev_mes", "not_started", 0),
    ])
    c.batch("모듈 개발", sales, [
        ("CRM·고객 관리", 66, 78, 48, "erp", "not_started", 0),
        ("판매 채널 연계", 72, 84, 40, "erp", "not_started", 0),
        ("수금·채권 대사", 78, 90, 40, "erp", "not_started", 0),
    ])
    c.batch("통합시험", sit, [
        ("데이터 정합성 검증", 92, 102, 56, "dba", "not_started", 0),
        ("인터페이스(연계) 테스트", 96, 108, 64, "qa", "not_started", 0),
        ("오류처리·복구 테스트", 102, 112, 48, "qa", "not_started", 0),
        ("권한·보안 테스트", 106, 114, 40, "qa", "not_started", 0),
    ])
    c.batch("전환·오픈", conv, [
        ("파일럿 운영", 120, 130, 64, "pm_c", "not_started", 0),
        ("계정·잔액 대사", 126, 136, 56, "dba", "not_started", 0),
        ("병행운전 모니터링", 134, 144, 64, "pm_c", "not_started", 0),
        ("이관 시스템 절차(폐기) 검토", 140, 150, 40, "pm_c", "not_started", 0),
    ])
    c.finalize(today)

    # ================================================================ 공통 캘린더/예측/챌린지
    # 프로젝트 캘린더: 공휴일
    hol = [date(2026, 9, 3), date(2026, 9, 4), date(2026, 10, 3), date(2026, 10, 9)]
    for p in (a, b, c):
        for h in hol:
            if p.start <= h <= p.project.updated_at.date() or p.start <= h <= date(2026, 12, 31):
                db.add(ProjectCalendarEntry(calendar_id=p.project.calendar.id, date=h, is_workday=False, kind="holiday", note="공휴일"))
    # 사용자 캘린더: 휴가
    v = [("dev_mes", date(2026, 8, 27)), ("dev_mes", date(2026, 8, 28)), ("design", date(2026, 9, 7)), ("dev_fe", date(2026, 9, 10)), ("qa", date(2026, 9, 16))]
    for u, h in v:
        db.add(UserCalendarEntry(calendar_id=users[u].user_calendar.id, date=h, is_available=False, kind="vacation", note="연차"))

    # 예측 이력(§29) - C 프로젝트
    for days, finish in [(5, date(2026, 11, 20)), (9, date(2026, 11, 24))]:
        db.add(Forecast(project_id=c.project.id, forecast_finish=finish, expected_delay_days=days,
                        basis="Deterministic Schedule Engine", data_used="CPM + Workload + Calendar"))

    # 챌린지/알림(UI 확인용)
    for user_key, msg, prio, task_id in [
        ("dev_mes", "Critical Path의 '생산계획 모듈' 지연이 예상됩니다. 지연 원인과 회복 대책을 입력해주세요.", "CRITICAL", plan_m),
        ("dev_back", "Issue #13의 해결 예정일이 임박했습니다. 현재 상태를 확인해주세요.", "WARNING", issue),
        ("dev_fe", "최근 3일간 진척률 업데이트가 없습니다. 현재 진행상태를 확인해주세요.", "ATTENTION", fe),
    ]:
        ch = Challenge(user_id=users[user_key].id, project_id=a.project.id,
                       task_id=task_id, priority=prio, category="delay", message=msg, created_by="ai")
        db.add(ch)
        db.add(Notification(user_id=users[user_key].id, channel="web", type="challenge", title=f"[{prio}] Daily Challenge", body=msg, link=f"/tasks/{task_id}"))

    # 이메일 설정(기본 비활성 — 관리자 페이지에서 설정)
    db.add(EmailConfig(smtp_host="", smtp_port=587, smtp_user=None, smtp_password=None,
                       from_email="no-reply@flowplan.dev", from_name="Flow Plan", use_tls=True, enabled=False))

    # 사용자별 리포트 발송 권한 (기본: 멤버→데일리, 관리자→위클리)
    for key, u in users.items():
        role = u.role.name if u.role else ""
        if key == "admin":
            db.add(UserReportSetting(user_id=u.id, deliver_daily=False, deliver_weekly=True))
        elif role == "Project Manager":
            db.add(UserReportSetting(user_id=u.id, deliver_daily=False, deliver_weekly=True))
        else:
            db.add(UserReportSetting(user_id=u.id, deliver_daily=True, deliver_weekly=False))

    db.commit()

    for p in (a, b, c):
        apply_engine_progress(db, p.project, today)

    # 진행 중/지연 Task 피드백 백필(다양한 사용자 의견)
    for p in (a, b, c):
        backfill_feedback(db, p.project, users, today)

    print("=== 시드 데이터 생성 완료 ===")
    print(f"  사용자: {len(users)}명")
    for p in (a, b, c):
        n_tasks = db.query(Task).filter_by(project_id=p.project.id, is_deleted=False).count()
        n_grp = db.query(Group).filter_by(project_id=p.project.id).count()
        n_fb = db.query(ProgressUpdate).join(Task).filter(Task.project_id == p.project.id).count()
        print(f"  [{p.project.name}] tasks={n_tasks} groups={n_grp} feedback={n_fb}")
    print("  계정: admin/admin123 · pm_a/pm123 · pm_b/pm123 · pm_c/pm123 · (멤버) member123")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()