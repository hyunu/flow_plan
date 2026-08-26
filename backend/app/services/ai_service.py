"""AI 서비스 계층.

- Challenge 생성(우선순위는 결정적 규칙, 문구는 AI 생성)
- Daily Report / Weekly Report 생성
- 위험 분석 및 예측(AI Forecast) 저장

원칙(§2.4, §28): 시스템 계산값 / 사용자 의견 / AI 예측을 구분해
근거 데이터의 ID와 출처를 함께 저장한다.
"""
from __future__ import annotations

import json
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.ai.base import AIProvider
from app.ai.providers import get_ai_provider
from app.core.database import SessionLocal
from app.engine.schedule import ScheduleResult, TaskResult
from app.models.entities import (
    AIAnalysis,
    Challenge,
    DailyReport,
    Forecast,
    Notification,
    Project,
    Task,
    User,
    WeeklyReport,
)
from app.services.schedule_service import compute_project_schedule

CRITICAL, WARNING, ATTENTION, NORMAL = "CRITICAL", "WARNING", "ATTENTION", "NORMAL"


def build_project_facts(project: Project, result: ScheduleResult, db: Session) -> str:
    """엔진이 계산한 사실 데이터를 AI 프롬프트용 텍스트로 변환."""
    lines = [
        f"# 프로젝트: {project.name}",
        f"- 계획 완료일: {result.project_planned_finish}",
        f"- 예상 완료일(AI 예측 아님, 엔진 계산): {result.project_forecast_finish}",
        f"- 예상 지연: {result.expected_delay_days}일",
        f"- 계획 진척률(엔진): {result.plan_progress}%",
        f"- 실제 진척률(엔진+사용자 보정): {result.actual_progress}%",
        f"- Gap: {result.progress_gap}%p",
        "",
        "## Task별 사실",
    ]
    for t in result.tasks:
        critical = " (CRITICAL PATH)" if t.is_critical else ""
        lines.append(
            f"- Task#{t.task_id} [{t.title}]{critical}: "
            f"일정 {t.schedule_progress}% / 실제 {t.effective_progress}% / "
            f"예상종료 {t.forecast_finish} / 지연 {t.delay_days}일 / float {t.total_float}"
        )

    # 사용자 의견 수집
    lines.append("")
    lines.append("## 사용자 의견(입력된 경우만)")
    updates = []
    for t in result.tasks:
        task = db.get(Task, t.task_id)
        if not task:
            continue
        for pu in task.progress_updates:
            if pu.delay_cause:
                updates.append(
                    f"- Task#{t.task_id}: 원인={pu.delay_cause_category}:{pu.delay_cause}, "
                    f"대책={pu.recovery_plan or '(없음)'}, 예상추가={pu.expected_delay_days}일"
                )
    lines.extend(updates or ["- (없음)"])

    # Issue
    issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).all()
    if issues:
        lines.append("")
        lines.append("## Issue Task")
        for i in issues:
            lines.append(
                f"- Issue Task#{i.id} [{i.title}]: 현상={i.issue_symptom}, 원인={i.issue_cause}, "
                f"해결방법={i.issue_solution}, 해결예정일={i.issue_resolve_plan_date}"
            )
    return "\n".join(lines)


def _task_status_for_user(result: ScheduleResult, task_id: int) -> TaskResult | None:
    for t in result.tasks:
        if t.task_id == task_id:
            return t
    return None


def generate_user_challenges(db: Session, user: User, today: date | None = None) -> list[Challenge]:
    """결정적 규칙으로 사용자별 Challenge 생성(§20/§21). AI는 문구를 다듬는다."""
    today = today or date.today()
    provider: AIProvider = get_ai_provider()
    memberships = user.memberships
    created: list[Challenge] = []

    for membership in memberships:
        project = membership.project
        if project.is_deleted:
            continue
        result = compute_project_schedule(db, project, today)
        my_tasks = [t for t in result.tasks if _task_owned_by(db, t.task_id, user.id)]
        if not my_tasks:
            continue

        for t in my_tasks:
            task = db.get(Task, t.task_id)
            if task is None:
                continue
            priority, category, rule = _evaluate_task(t, task, today)
            if rule is None:
                continue
            facts = build_project_facts(project, result, db)
            prompt = (
                f"아래 프로젝트 사실을 바탕으로 사용자에게 전달할 Daily Challenge 한 문장을 생성하세요.\n"
                f"카테고리: {category}, 우선순위: {priority}\n"
                f"규칙 근거: {rule}\n\n{facts}\n\nChallenge 메시지:"
            )
            message = provider.generate(prompt, system="당신은 프로젝트 일정 관리 챗봇입니다. 사실과 의견과 예측을 구분해 명확하게 전달하세요.", max_tokens=200).strip()
            if not message:
                message = rule
            ch = Challenge(
                user_id=user.id,
                project_id=project.id,
                task_id=task.id,
                priority=priority,
                category=category,
                message=message,
                created_by="ai",
            )
            db.add(ch)
            created.append(ch)
            db.add(Notification(user_id=user.id, channel="web", type="challenge", title=f"[{priority}] Daily Challenge", body=message, link=f"/tasks/{task.id}"))
    db.commit()
    return created


def _task_owned_by(db: Session, task_id: int, user_id: int) -> bool:
    task = db.get(Task, task_id)
    if not task:
        return False
    return any(a.user_id == user_id for a in task.assignments)


def _evaluate_task(t: TaskResult, task: Task, today: date) -> tuple[str, str, str | None]:
    """지연/미입력/진척 미갱신/Issue/휴가/Dependency 규칙. (priority, category, message)."""
    # Issue 해결 예정일 초과
    if task.is_issue and task.issue_resolve_plan_date and task.issue_resolve_plan_date < today and task.status != "completed":
        return CRITICAL, "issue", f"Issue Task #{task.id}의 해결 예정일({task.issue_resolve_plan_date})이 지났습니다. 현재 상태를 입력해주세요."

    # Critical Path + 지연
    if t.is_critical and t.delay_days > 0:
        return CRITICAL, "critical_delay", f"Critical Path Task가 {t.delay_days}일 지연 예상됩니다. 지연 원인을 입력해주세요."
    if t.is_critical and t.delay_days == 0 and t.status == "in_progress":
        return WARNING, "critical_progress", "Critical Path Task입니다. 진행상황을 최신화해주세요."

    # 일반 지연
    if t.delay_days >= 2:
        return WARNING, "delay", f"{t.delay_days}일의 지연이 예상됩니다. 일정 회복을 위한 대책을 입력해주세요."
    if t.delay_days >= 1:
        return ATTENTION, "delay", "지연이 예상됩니다. 지연 원인을 입력해주세요."

    # 진척률 업데이트 부재 (최근 3일)
    if task.status == "in_progress":
        recent = [pu for pu in task.progress_updates if pu.created_at.date() >= today - timedelta(days=3)]
        if not recent:
            return ATTENTION, "progress_update", "최근 3일간 진척률 업데이트가 없습니다. 현재 진행상태를 확인해주세요."

    return NORMAL, "normal", None


def generate_daily_report(db: Session, user: User, today: date | None = None) -> DailyReport:
    today = today or date.today()
    provider = get_ai_provider()
    sections: dict[str, object] = {"date": today.isoformat(), "projects": []}
    for membership in user.memberships:
        project = membership.project
        if project.is_deleted:
            continue
        result = compute_project_schedule(db, project, today)
        my_tasks = [t for t in result.tasks if _task_owned_by(db, t.task_id, user.id)]
        normal = [t for t in my_tasks if t.delay_days == 0 and not t.is_critical]
        delayed = [t for t in my_tasks if t.delay_days > 0]
        critical = [t for t in my_tasks if t.is_critical]
        issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).count()
        sections["projects"].append(
            {
                "project_id": project.id,
                "project_name": project.name,
                "normal_tasks": [{"id": t.task_id, "title": t.title} for t in normal],
                "delayed_tasks": [{"id": t.task_id, "title": t.title, "delay_days": t.delay_days} for t in delayed],
                "critical_tasks": [{"id": t.task_id, "title": t.title} for t in critical],
                "issue_count": issues,
            }
        )
    facts = json.dumps(sections, ensure_ascii=False, default=str)
    prompt = (
        f"사용자별 Daily Report를 생성하세요. 구조화된 JSON으로 다음을 포함:\n"
        f"- 오늘의 일정 상태 요약\n- 주의/지연 Task와 원인\n- 오늘의 주요 업무\n- 다음 작업\n"
        f"- 사용자에게 요청할 입력\n\n데이터:\n{facts}"
    )
    content = provider.generate(prompt, system="당신은 프로젝트 일정 관리 시스템의 일일 보고서 생성 AI입니다.", max_tokens=800)
    report = DailyReport(user_id=user.id, report_date=today, content=content)
    db.add(report)
    db.commit()
    return report


def generate_weekly_report(db: Session, project: Project, week_start: date | None = None) -> WeeklyReport:
    week_start = week_start or (date.today() - timedelta(days=date.today().weekday()))
    provider = get_ai_provider()
    result = compute_project_schedule(db, project, date.today())
    facts = build_project_facts(project, result, db)

    delayed_count = len([t for t in result.tasks if t.delay_days > 0])
    critical_count = len([t for t in result.tasks if t.is_critical])
    issue_count = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).count()
    resolved_issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).filter(Task.status == "completed").count()
    change_count = db.query(Forecast).filter_by(project_id=project.id).count()

    kpi = {
        "전체 진척률": result.actual_progress,
        "계획 진척률": result.plan_progress,
        "Progress Gap": result.progress_gap,
        "계획 완료일": str(result.project_planned_finish),
        "현재 예상 완료일": str(result.project_forecast_finish),
        "예상 지연일": result.expected_delay_days,
        "지연 Task 수": delayed_count,
        "Critical Task 수": critical_count,
        "Issue 수": issue_count,
        "해결된 Issue 수": resolved_issues,
        "미해결 Issue 수": issue_count - resolved_issues,
        "예측 이력 수": change_count,
    }

    prompt = (
        f"관리자용 Weekly Report를 생성하세요. 다음을 포함하는 구조화된 텍스트(마크다운):\n"
        f"## Project Summary / ## KPI / ## 주요 지연 원인(사용자 의견 기반) / ## 주요 Issue / "
        f"## 사용자 의견 / ## AI Forecast(예상 완료일, 지연 가능성 높은 Task, 위험 요소, 권장 대책)\n\n"
        f"KPI 데이터:\n{json.dumps(kpi, ensure_ascii=False)}\n\n프로젝트 사실:\n{facts}"
    )
    content = provider.generate(prompt, system="당신은 프로젝트 관리 담당 관리자를 위한 주간 보고서 AI입니다. 사실/의견/예측을 구분하고, AI 예측/권고로 표시하세요.", max_tokens=1600)
    report = WeeklyReport(project_id=project.id, week_start=week_start, content=content)
    db.add(report)
    db.commit()
    return report


def analyze_project_risk(db: Session, project: Project) -> AIAnalysis:
    provider = get_ai_provider()
    result = compute_project_schedule(db, project, date.today())
    facts = build_project_facts(project, result, db)
    prompt = (
        f"프로젝트 위험 분석을 수행하세요. 다음을 JSON으로 반환:\n"
        f"- overall_risk: HIGH/WARNING/NORMAL\n"
        f"- risks: [{{ 'task_id', 'task_title', 'risk', 'type': 'system_calc|user_opinion|ai_prediction' }}]\n"
        f"- recommendations: [대책 목록]\n\n{facts}"
    )
    content = provider.generate(prompt, system="프로젝트 위험 분석 AI. 결정적 계산 결과를 근거로 하고, 추측은 ai_prediction으로 표시.", max_tokens=1000)
    analysis = AIAnalysis(
        project_id=project.id,
        analysis_type="risk",
        content=content,
        sources=json.dumps({"schedule": result.project_forecast_finish.isoformat() if result.project_forecast_finish else None}),
    )
    db.add(analysis)
    db.commit()
    return analysis


def create_forecast(db: Session, project: Project, today: date | None = None) -> Forecast:
    result = compute_project_schedule(db, project, today)
    forecast = Forecast(
        project_id=project.id,
        forecast_finish=result.project_forecast_finish,
        expected_delay_days=result.expected_delay_days,
        basis="Deterministic Schedule Engine (CPM + Workload + Calendar)",
        data_used=json.dumps({"planned_finish": str(result.project_planned_finish)}, default=str),
    )
    db.add(forecast)
    db.commit()
    return forecast