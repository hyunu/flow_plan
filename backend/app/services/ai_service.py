"""AI 서비스 계층.

- Challenge 생성(우선순위는 결정적 규칙, 문구는 AI 생성)
- Daily Report / Weekly Report 생성
- 위험 분석 및 예측(AI Forecast) 저장

원칙(§2.4, §28): 시스템 계산값 / 사용자 의견 / AI 예측을 구분해
근거 데이터의 ID와 출처를 함께 저장한다.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.ai.base import AIProvider
from app.ai.providers import get_ai_provider
from app.core.config import settings
from app.core.database import SessionLocal
from app.engine.schedule import ScheduleResult, TaskResult
from app.models.entities import (
    AIAnalysis,
    Challenge,
    DailyReport,
    Forecast,
    Notification,
    ProgressSnapshot,
    Project,
    Task,
    User,
    WeeklyReport,
)
from app.services.schedule_service import compute_project_schedule

log = logging.getLogger("flow_plan.ai")

CRITICAL, WARNING, ATTENTION, NORMAL = "CRITICAL", "WARNING", "ATTENTION", "NORMAL"

_PRI_KO = {"CRITICAL": "긴급", "WARNING": "주의", "ATTENTION": "관심"}


def challenge_notice_title(priority: str, category: str, task_title: str) -> str:
    name = (task_title or "").strip() or "작업"
    by_cat = {
        "issue": f"「{name}」 이슈 기한이 지났습니다",
        "critical_delay": f"「{name}」 크리티컬 패스가 지연됩니다",
        "critical_progress": f"「{name}」 크리티컬 패스를 확인하세요",
        "delay": f"「{name}」이 계획보다 늦습니다",
        "progress_update": f"「{name}」 진척을 갱신하세요",
    }
    core = by_cat.get(category, f"「{name}」 오늘 확인할 일이 있습니다")
    pri = _PRI_KO.get(priority, "")
    return f"{pri} · {core}" if pri else core


def notice_title_from_body(body: str, fallback: str = "오늘의 챌린지를 확인하세요") -> str:
    m = re.search(r"「([^」]+)」", body or "")
    if m:
        return f"「{m.group(1)}」 오늘 확인할 일이 있습니다"
    return fallback



def _figures(text: str) -> set[str]:
    """날짜와 두 자리 이상 숫자만 뽑는다(표기 차이는 정규화)."""
    norm = re.sub(
        r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})",
        lambda m: f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}",
        text or "",
    )
    out: set[str] = set()
    for m in re.findall(r"\d{4}-\d{2}-\d{2}|\d+(?:\.\d+)?", norm):
        if "-" in m or len(m.replace(".", "")) >= 2:
            out.add(m)
    return out


def _numbers_preserved(source: str, output: str) -> bool:
    """AI 출력의 날짜·주요 숫자가 근거(source)에 있는 값인지 확인한다."""
    if not output:
        return False
    return not (_figures(output) - _figures(source))


def ai_is_enabled() -> bool:
    """실제 LLM 프로바이더가 설정됐는지(mock이면 AI를 부르지 않는다)."""
    try:
        return get_ai_provider().name != "mock"
    except Exception:
        return False


def _strip_json_fence(raw: str) -> str:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    return text


def _deterministic_risk_content(result: ScheduleResult, project: Project) -> str:
    """AI를 쓸 수 없거나 출력이 검증을 통과하지 못할 때 쓰는 결정적 브리핑."""
    critical = sorted(
        [t for t in result.tasks if t.forecast_is_critical],
        key=lambda t: (-t.delay_days, t.task_id),
    )
    delayed = sorted(
        [t for t in result.tasks if t.delay_days > 0 and t.status != "completed"],
        key=lambda t: -t.delay_days,
    )
    head = critical[0] if critical else (delayed[0] if delayed else None)
    if result.expected_delay_days > 0:
        headline = (
            f"{project.name} 예상 완료 {result.project_forecast_finish}, "
            f"계획보다 {result.expected_delay_days}일 지연"
        )
        situation = (
            f"실제 진척 {result.actual_progress:.0f}% / 계획 {result.plan_progress:.0f}% "
            f"(Gap {result.progress_gap:g}%p). 지연 Task {len(delayed)}건, "
            f"예측 임계경로 {len(critical)}건이 종료일을 밀고 있습니다."
        )
    else:
        headline = f"{project.name} 예상 완료 {result.project_forecast_finish} (계획 범위)"
        situation = (
            f"실제 진척 {result.actual_progress:.0f}% / 계획 {result.plan_progress:.0f}% "
            f"(Gap {result.progress_gap:g}%p). 예측상 계획일 안에 들어옵니다."
        )
    payload = {
        "basis": "deterministic",
        "overall_risk": "HIGH" if result.expected_delay_days >= 5 else ("WARNING" if result.expected_delay_days > 0 else "NORMAL"),
        "headline": headline,
        "situation": situation,
        "outlook": (
            f"엔진 예측 종료일은 {result.project_forecast_finish}입니다. "
            + (f"임계경로에서 하루 더 밀리면 전체도 하루 더 밀립니다." if critical else "임계경로 지연은 없습니다.")
        ),
        "watch_next": (
            f"「{head.title}」의 원인/대책 기록과 진척 갱신" if head else "의존관계와 계획일 정합성"
        ),
        "risks": [
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "risk": f"예측 임계경로, {t.delay_days}일 지연, 여유 {t.forecast_total_float}일",
                "severity": "CRITICAL" if t.delay_days > 0 else "WARNING",
                "type": "system_calc",
            }
            for t in critical[:6]
        ],
        "recommendations": [
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "action": "오늘 안에 지연 원인·대책과 예상 추가 일수를 진행 기록에 남기고, 후속 착수 조건을 확정",
            }
            for t in (critical or delayed)[:4]
        ],
    }
    return json.dumps(payload, ensure_ascii=False)


def _parse_ai_brief(content: str | None) -> dict | None:
    if not content:
        return None
    try:
        data = json.loads(_strip_json_fence(content))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    if not (data.get("headline") or data.get("situation")):
        return None
    return data

def build_project_facts(project: Project, result: ScheduleResult, db: Session) -> str:
    """엔진이 계산한 사실 데이터를 AI 프롬프트용 텍스트로 변환.

    예측 기준(forecast) 지표를 쓰고, 태스크는 임계/지연 상위만 넣어
    프롬프트를 짧고 판단에 필요한 내용으로 유지한다.
    """
    delayed_all = [t for t in result.tasks if t.delay_days > 0 and t.status != "completed"]
    critical = sorted(
        [t for t in result.tasks if t.forecast_is_critical],
        key=lambda t: (-t.delay_days, -(t.forecast_total_float or 0)),
    )[:10]
    delayed = sorted(delayed_all, key=lambda t: -t.delay_days)[:15]
    lines = [
        f"# 프로젝트: {project.name}",
        f"- 계획 완료일: {result.project_planned_finish}",
        f"- 예상 완료일(엔진 계산): {result.project_forecast_finish}",
        f"- 예상 지연: {result.expected_delay_days}일",
        f"- 계획 진척률: {result.plan_progress}% / 실제 진척률: {result.actual_progress}% / Gap: {result.progress_gap}%p",
        f"- 완료 속도(실제/계획): {result.schedule_velocity} (1.0=계획대로, >1 느림)",
        f"- 지연 Task {len(delayed_all)}건 · 예측 임계경로 {len(critical)}건",
        "",
        "## 예측 임계경로 (실제 지연 반영)",
    ]
    if critical:
        for t in critical:
            lines.append(
                f"- Task#{t.task_id} [{t.title}]: 지연 {t.delay_days}일 / "
                f"예측 여유 {t.forecast_total_float}일 / 진척 {t.effective_progress}% / "
                f"예상종료 {t.forecast_finish} / 상태 {t.status}"
            )
    else:
        lines.append("- (없음)")
    lines.append("")
    lines.append("## 지연 상위")
    crit_ids = {t.task_id for t in critical}
    shown = [t for t in delayed if t.task_id not in crit_ids][:10]
    if shown:
        for t in shown:
            lines.append(
                f"- Task#{t.task_id} [{t.title}]: 지연 {t.delay_days}일 / "
                f"진척 {t.effective_progress}% / 예상종료 {t.forecast_finish} / 상태 {t.status}"
            )
    else:
        lines.append("- (없음)")
    lines.append("")

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


def generate_user_challenges(
    db: Session, user: User, today: date | None = None, *, polish: bool = False
) -> list[Challenge]:
    """결정적 규칙으로 사용자별 Challenge 생성(§20/§21). AI는 문구를 다듬는다.
    담당 태스크가 없는 계정(예: 시스템 관리자)은 접근 가능한 전체 프로젝트의 리스크 항목을 대상으로 삼는다.
    로그인·알림 경로에서는 호출하지 않는다. polish=True일 때만 외부 AI를 친다."""
    today = today or date.today()
    provider: AIProvider | None = get_ai_provider() if polish else None
    memberships = user.memberships
    created: list[Challenge] = []
    active_keys: set[tuple[int | None, str]] = set()
    role = user.role.name if user.role else ""
    member_only = role == "Project Member"

    if memberships:
        # 멤버는 담당 Task만, PM은 소속 프로젝트 전체
        projects: list[tuple[Project, bool]] = [
            (m.project, member_only) for m in memberships if not m.project.is_deleted
        ]
    else:
        # 멤버십 없는 관리자 등: 전체 프로젝트 전반의 리스크를 챌린지로
        projects = [
            (p, False)
            for p in db.query(Project).filter(Project.is_deleted.is_(False)).all()
        ]

    for project, only_my in projects:
        result = compute_project_schedule(db, project, today)
        if only_my:
            my_tasks = [t for t in result.tasks if _task_owned_by(db, t.task_id, user.id)]
        else:
            my_tasks = result.tasks
        if not my_tasks:
            continue

        for t in my_tasks:
            task = db.get(Task, t.task_id)
            if task is None:
                continue
            composed = _compose_challenge(t, task, today, result, viewer=user, team_view=not only_my)
            if composed is None:
                continue
            priority, category, message = composed
            active_keys.add((task.id, category))
            exists = (
                db.query(Challenge)
                .filter_by(user_id=user.id, task_id=task.id, category=category, status="open")
                .first()
            )
            if exists:
                exists.message = message
                exists.priority = priority
                exists.category = category
                created.append(exists)
                continue
            done = (
                db.query(Challenge)
                .filter_by(user_id=user.id, task_id=task.id, category=category, status="answered")
                .order_by(Challenge.id.desc())
                .first()
            )
            if done:
                when = done.created_at
                if done.responses:
                    when = max((r.created_at or when for r in done.responses), default=when)
                if when and when.date() >= today:
                    continue
            if provider is not None and provider.name != "mock":
                try:
                    polished = provider.generate(
                        f"다음 챌린지를 같은 사실로 2~3문장 한국어로 다듬으세요. 태스크명·일수·요청은 유지하고 프롬프트는 인용하지 마세요.\n\n{message}",
                        system="프로젝트 일정 챗봇. 사실만. 다른 태스크와 구분되게 쓰세요.",
                        max_tokens=220,
                    ).strip()
                except Exception:
                    polished = ""
                if (
                    polished
                    and not polished.startswith("[Mock")
                    and "요청 맥락:" not in polished
                    and _numbers_preserved(message, polished)
                ):
                    message = polished
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
            # 알림은 새로 생긴 챌린지 + 긴급/주의만. 목록 새로고침·관심(ATTENTION)은 쌓지 않음.
            # 멤버십 없는 전체 보기(관리자)는 긴급만.
            if priority == ATTENTION:
                continue
            if not only_my and priority != CRITICAL:
                continue
            already = (
                db.query(Notification)
                .filter_by(user_id=user.id, type="challenge", link=f"/tasks/{task.id}")
                .first()
            )
            if already:
                continue
            db.add(
                Notification(
                    user_id=user.id,
                    channel="web",
                    type="challenge",
                    title=challenge_notice_title(priority, category, task.title),
                    body=message,
                    link=f"/tasks/{task.id}",
                )
            )
    # 더 이상 해당되지 않는(해결·조건 소멸) 열린 챌린지는 만료 처리한다.
    stale = db.query(Challenge).filter_by(user_id=user.id, status="open").all()
    for ch in stale:
        if (ch.task_id, ch.category) not in active_keys:
            ch.status = "expired"

    db.commit()
    return created


def generate_all_daily_reports(db: Session, today: date | None = None) -> int:
    """모든 활성 사용자의 일일 리포트를 생성/갱신한다(스케줄러용)."""
    today = today or date.today()
    users = db.query(User).filter(User.is_active.is_(True)).all()
    count = 0
    for u in users:
        try:
            generate_daily_report(db, u, today)
            count += 1
        except Exception:
            db.rollback()
    return count


def sync_challenge_notifications(db: Session, user: User) -> None:
    """이미 열린 챌린지에 없는 긴급·주의 알림만 채운다. 챌린지 생성은 하지 않는다."""
    team = not bool(user.memberships)
    opens = db.query(Challenge).filter_by(user_id=user.id, status="open").all()
    added = False
    for ch in opens:
        if ch.priority == ATTENTION:
            continue
        if team and ch.priority != CRITICAL:
            continue
        link = f"/tasks/{ch.task_id}" if ch.task_id else "/challenges"
        exists = (
            db.query(Notification)
            .filter_by(user_id=user.id, type="challenge", link=link)
            .first()
        )
        if exists:
            continue
        task = db.get(Task, ch.task_id) if ch.task_id else None
        title = challenge_notice_title(ch.priority, ch.category, task.title if task else "")
        db.add(
            Notification(
                user_id=user.id,
                channel="web",
                type="challenge",
                title=title,
                body=ch.message,
                link=link,
            )
        )
        added = True
    if added:
        db.commit()


def generate_all_user_challenges(db: Session) -> None:
    """시드·기동 시 전 사용자 챌린지를 미리 만든다."""
    for u in db.query(User).filter(User.is_active.is_(True)).all():
        generate_user_challenges(db, u)


def _task_owned_by(db: Session, task_id: int, user_id: int) -> bool:
    task = db.get(Task, task_id)
    if not task:
        return False
    return any(a.user_id == user_id for a in task.assignments)


def _compose_challenge(
    t: TaskResult,
    task: Task,
    today: date,
    result: ScheduleResult,
    *,
    viewer: User,
    team_view: bool,
) -> tuple[str, str, str] | None:
    """태스크마다 다른 본문. 제목·일수·진척·원인 유무·요청이 카드마다 달라지게 한다."""
    if t.status == "completed":
        return None
    title = task.title.strip() or f"Task #{task.id}"
    owners = ", ".join(a.user.name for a in task.assignments if a.user) or "미배정"
    who = f"{owners} 담당. " if team_view else ""
    planned = result.project_planned_finish.isoformat() if result.project_planned_finish else "미정"
    forecast = result.project_forecast_finish.isoformat() if result.project_forecast_finish else "미정"
    proj_delay = result.expected_delay_days
    # 실제 지연이 반영된 예측 기준 여유 (계획 기준 float 는 지연을 모른다)
    slack = int(round(t.forecast_total_float if t.forecast_is_critical else t.total_float or 0))
    updates = sorted(task.progress_updates, key=lambda p: p.created_at or datetime.min, reverse=True)
    last = updates[0] if updates else None
    has_cause = bool(last and (last.delay_cause or last.delay_cause_category))
    has_plan = bool(last and last.recovery_plan)
    last_cause = (last.delay_cause_category or last.delay_cause) if last else None
    gap = round((t.schedule_progress or 0) - (t.effective_progress or 0), 1)
    extra_days_help = (
        "대책 후에도 계획일보다 며칠 더 늦을지(**예상 추가 일수**)는 진행 기록에 숫자로 남기세요."
    )

    if task.is_issue and task.issue_resolve_plan_date and task.issue_resolve_plan_date < today and task.status != "completed":
        overdue = (today - task.issue_resolve_plan_date).days
        symptom = task.issue_symptom or task.issue_cause or "현상이 아직 없습니다"
        return (
            CRITICAL,
            "issue",
            f"**「{title}」** 이슈 해결 예정일 **{task.issue_resolve_plan_date}**이 **{overdue}일** 지났습니다. "
            f"{who}기록된 내용: {symptom}. "
            f"오늘 **해결 여부·새 예정일**을 진행 기록에 남기세요.",
        )

    if t.forecast_is_critical and t.delay_days > 0:
        if has_cause and not has_plan:
            ask = f"원인으로 ‘{last_cause}’가 있습니다. 대응/대책과 함께 {extra_days_help}"
        elif has_cause and has_plan:
            ask = (
                f"원인 ‘{last_cause}’와 대책은 이미 있습니다. "
                f"지금 **실제 진척 {t.effective_progress:.0f}%**인데, 계획 기간 기준으로는 오늘까지 **{t.schedule_progress:.0f}%**가 끝나 있어야 합니다. "
                f"태스크 상세의 **진척률 보정**에 오늘 기준 실제 완료 %만 고치세요. "
                f"오늘 몇 %까지 가겠다는 목표가 아니라, **지금 끝난 비율**입니다."
            )
        else:
            ask = f"아직 원인이 없습니다. 진행 기록에 **왜 늦었는지**와 대응/대책을 오늘 적으세요. {extra_days_help}"
        return (
            CRITICAL,
            "critical_delay",
            f"**「{title}」**은 **예측 임계경로**입니다. {who}"
            f"이 노드만 **{t.delay_days}일** 늦고 **여유 0일**이라, 후속과 프로젝트 종료일(계획 {planned} → 예측 {forecast}, **전체 +{proj_delay}일**)에 그대로 전가됩니다. "
            f"{ask}",
        )

    if t.forecast_is_critical and t.delay_days == 0 and t.status == "in_progress":
        return (
            WARNING,
            "critical_progress",
            f"**「{title}」**은 아직 늦지 않은 **크리티컬 패스**입니다. {who}"
            f"**여유 0일** — **하루만 밀려도 프로젝트 완료일이 하루 밀립니다.** "
            f"진척 {t.effective_progress:.0f}% / 일정 페이스 {t.schedule_progress:.0f}%. "
            f"오늘 진행만 짧게 남겨 두세요.",
        )

    if t.delay_days >= 2:
        overflow = max(0, t.delay_days - max(slack, 0))
        if overflow > 0:
            impact = f"여유 {slack}일을 넘어 약 **{overflow}일**이 전체에 전가될 수 있습니다."
            pri = WARNING
        else:
            impact = f"여유 {slack}일 안이라 아직은 전체 완료일을 밀지 않습니다. 여유를 더 쓰면 이 노드가 **크리티컬 패스**로 올라갑니다."
            pri = ATTENTION
        ask = (
            f"이미 적힌 원인 ‘{last_cause}’를 전제로 대응/대책을 보완하고, {extra_days_help}"
            if has_cause
            else f"진행 기록에 **지연 원인**과 **대응/대책**을 적으세요. {extra_days_help}"
        )
        return (
            pri,
            "delay",
            f"**「{title}」**이 계획보다 **{t.delay_days}일** 늦습니다. {who}{impact} "
            f"진척 {t.effective_progress:.0f}% (일정 대비 {gap:+g}%p). {ask}",
        )

    if t.delay_days >= 1:
        return (
            ATTENTION,
            "delay",
            f"**「{title}」**에서 **1일 지연**이 보이기 시작했습니다. {who}"
            f"여유 {slack}일. 지금 **원인**을 적으면 전체가 밀리기 전에 끊을 수 있습니다.",
        )

    if t.status == "in_progress":
        recent = [pu for pu in updates if pu.created_at and pu.created_at.date() >= today - timedelta(days=3)]
        if not recent:
            days = (today - last.created_at.date()).days if last and last.created_at else None
            stale = f"**{days}일째** 기록이 없습니다." if days is not None else "**진행 기록이 한 번도 없습니다.**"
            hint = f"마지막 메모: {last.current_status or last.work_done}." if last and (last.current_status or last.work_done) else "**현재 상황**만 한 줄 적으세요."
            return (
                ATTENTION,
                "progress_update",
                f"**「{title}」**은 진행 중인데 {stale} {who}"
                f"진척 {t.effective_progress:.0f}%. {hint}",
            )

    return None


def _bullet_tasks(tasks: list[TaskResult], limit: int = 8) -> str:
    if not tasks:
        return "- 해당 없음"
    lines = []
    for t in tasks[:limit]:
        tag = " · 임계경로" if t.forecast_is_critical else ""
        delay = f" · {t.delay_days}일 지연" if t.delay_days else ""
        lines.append(f"- 「{t.title}」{tag}{delay} · 진척 {t.effective_progress:.0f}%")
    if len(tasks) > limit:
        lines.append(f"- 외 {len(tasks) - limit}건")
    return "\n".join(lines)


def generate_daily_report(db: Session, user: User, today: date | None = None) -> DailyReport:
    today = today or date.today()
    if user.memberships:
        project_rows: list[tuple[Project, bool]] = [
            (m.project, True) for m in user.memberships if not m.project.is_deleted
        ]
    else:
        project_rows = [(p, False) for p in db.query(Project).filter(Project.is_deleted.is_(False)).all()]

    blocks: list[str] = [
        f"# {today.isoformat()} 일일 리포트 — {user.name}",
        "",
    ]
    any_project = False
    for project, only_my in project_rows:
        result = compute_project_schedule(db, project, today)
        tasks = [t for t in result.tasks if _task_owned_by(db, t.task_id, user.id)] if only_my else list(result.tasks)
        delayed = [t for t in tasks if t.delay_days > 0 and t.status != "completed"]
        critical = [t for t in tasks if t.forecast_is_critical]
        delayed_cp = [t for t in critical if t.delay_days > 0]
        in_progress = [t for t in tasks if t.status == "in_progress"]
        issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).all()
        if only_my:
            issues = [i for i in issues if any(a.user_id == user.id for a in i.assignments)]
        open_issues = [i for i in issues if i.status != "completed"]
        any_project = True
        if result.expected_delay_days > 0:
            state = f"완료 예측이 계획보다 {result.expected_delay_days}일 늦음 ({result.project_planned_finish} → {result.project_forecast_finish})."
        else:
            state = f"완료 예측은 계획일({result.project_planned_finish}) 안입니다."
        snap = (
            db.query(ProgressSnapshot)
            .filter_by(project_id=project.id, snapshot_date=today - timedelta(days=1))
            .first()
        )
        if snap:
            delta = result.actual_progress - (snap.actual_progress or 0)
            yesterday_line = (
                f"- 실제 진척 {snap.actual_progress:.0f}% → {result.actual_progress:.0f}% ({delta:+.1f}%p) / "
                f"계획 {snap.plan_progress:.0f}% → {result.plan_progress:.0f}%"
            )
        else:
            yesterday_line = "- 어제 진척 스냅샷이 없습니다."

        today_due = [
            t for t in tasks
            if t.plan_end == today and t.status != "completed"
        ]
        due_text = (
            "\n".join(f"- 「{t.title}」 · 진척 {t.effective_progress:.0f}%" for t in today_due[:8])
            or "- 오늘 마감 태스크 없음"
        )

        blocks += [
            f"## {project.name}",
            f"실제 진척 {result.actual_progress:.0f}% / 계획 {result.plan_progress:.0f}% (Gap {result.progress_gap:g}%p). {state}",
            "",
            "### 어제 대비",
            yesterday_line,
            "",
            "### 오늘 마감",
            due_text,
            "",
            "### 지연",
            _bullet_tasks(sorted(delayed, key=lambda x: -x.delay_days)),
            "",
            "### 예측 임계경로",
            _bullet_tasks(sorted(critical, key=lambda x: (-(x.delay_days or 0), -(x.forecast_total_float or 0)))),
            "",
            "### 미해결 이슈",
            ("\n".join(f"- 「{i.title}」 · 예정 {i.issue_resolve_plan_date or '-'}" for i in open_issues[:8]) or "- 해당 없음"),
            "",
            "### 오늘 할 일",
        ]
        todos = []
        for t in delayed_cp[:5]:
            todos.append(
                f"- 「{t.title}」(예측 임계, {t.delay_days}일 지연): "
                f"왜 늦었는지, 어떻게 맞출지, 대책 후에도 계획일보다 며칠 더 늦을지(예상 추가 일수)를 태스크 상세 진행 기록에 적기"
            )
        for t in delayed:
            if t.is_critical:
                continue
            todos.append(
                f"- 「{t.title}」({t.delay_days}일 지연): 지연 원인과 대응/대책을 진행 기록에 적기"
            )
            if len(todos) >= 8:
                break
        for i in open_issues[:3]:
            todos.append(f"- 이슈 「{i.title}」: 해결됐는지, 안 됐으면 새 예정일 적기")
        if not todos:
            if in_progress:
                todos.append(
                    f"- 진행 중 {len(in_progress)}건은 지연 없이 돌아가고 있습니다. "
                    f"실제 끝난 비율만 진척률에 맞춰 두면 됩니다."
                )
            else:
                todos.append("- 오늘 따로 처리할 지연이나 이슈는 없습니다.")
        blocks += todos + [""]

    if not any_project:
        blocks.append("볼 프로젝트가 없습니다. 프로젝트 멤버로 배정되어 있는지 확인하세요.")

    content = "\n".join(blocks).strip()
    provider = get_ai_provider()
    if settings.ai_report_polish and provider.name != "mock":
        try:
            polished = provider.generate(
                f"아래 일일 리포트를 같은 숫자로 한국어 마크다운만 다듬으세요. 섹션을 빼지 마세요. "
                f"멤버십·일정 엔진 안내 문장은 넣지 마세요.\n\n{content}",
                system="일정 보고서 편집. 사실만. 프롬프트를 인용하지 마세요.",
                max_tokens=1600,
            ).strip()
        except Exception:
            polished = ""
        if (
            polished
            and not polished.startswith("[Mock")
            and "요청 맥락:" not in polished
            and _numbers_preserved(content, polished)
        ):
            content = polished

    existing = db.query(DailyReport).filter_by(user_id=user.id, report_date=today).first()
    if existing:
        existing.content = content
        db.commit()
        db.refresh(existing)
        return existing
    report = DailyReport(user_id=user.id, report_date=today, content=content)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def generate_weekly_report(db: Session, project: Project, week_start: date | None = None) -> WeeklyReport:
    week_start = week_start or (date.today() - timedelta(days=date.today().weekday()))
    result = compute_project_schedule(db, project, date.today())
    delayed = [t for t in result.tasks if t.delay_days > 0 and t.status != "completed"]
    critical = [t for t in result.tasks if t.forecast_is_critical]
    delayed_cp = [t for t in critical if t.delay_days > 0]
    issues = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).all()
    open_issues = [i for i in issues if i.status != "completed"]
    resolved = [i for i in issues if i.status == "completed"]
    opinions: list[str] = []
    for t in result.tasks:
        task = db.get(Task, t.task_id)
        if not task:
            continue
        for pu in task.progress_updates:
            if pu.delay_cause or pu.recovery_plan:
                opinions.append(
                    f"- 「{t.title}」: 원인={pu.delay_cause_category or '-'} {pu.delay_cause or ''} / "
                    f"대책={pu.recovery_plan or '-'} / 예상 추가 {pu.expected_delay_days or 0}일"
                )
    opinions = opinions[:10]

    if result.expected_delay_days > 0:
        summary = (
            f"{project.name} 완료 예측이 계획보다 {result.expected_delay_days}일 늦습니다 "
            f"({result.project_planned_finish} → {result.project_forecast_finish}). "
            f"예측 임계경로 중 {len(delayed_cp)}건이 종료일을 밀어 올리고 있습니다."
        )
    else:
        summary = (
            f"{project.name} 완료 예측은 계획일({result.project_planned_finish}) 안입니다. "
            f"크리티컬 패스 {len(critical)}건은 여유 0일입니다."
        )

    content = "\n".join(
        [
            f"# {project.name} 주간 리포트 ({week_start.isoformat()} 주)",
            "",
            "## 요약",
            summary,
            "",
            "## KPI",
            f"- 실제 진척 {result.actual_progress:.0f}% / 계획 {result.plan_progress:.0f}% / Gap {result.progress_gap:g}%p",
            f"- 예상 지연 {result.expected_delay_days}일",
            f"- 지연 Task {len(delayed)}건 · 예측 임계 {len(critical)}건 · 미해결 이슈 {len(open_issues)}건 (해결 {len(resolved)}건)",
            "",
            "## 주요 지연 (임계·영향 순)",
            _bullet_tasks(
                sorted(delayed, key=lambda x: (not x.forecast_is_critical, -x.delay_days)),
                12,
            ),
            "",
            "## 예측 임계경로",
            _bullet_tasks(critical, 12),
            "",
            "## 주요 Issue",
            (
                "\n".join(
                    f"- 「{i.title}」 · {i.status} · 예정 {i.issue_resolve_plan_date or '-'} · 원인 {i.issue_cause or '-'}"
                    for i in open_issues[:10]
                )
                or "- 미해결 이슈 없음"
            ),
            "",
            "## 사용자 의견 (진행 기록)",
            "\n".join(opinions) if opinions else "- 지연 원인·대책이 아직 없습니다.",
            "",
            "## 전망",
            (
                f"엔진 예측 종료일은 {result.project_forecast_finish}입니다. "
                "크리티컬 패스가 하루 더 늦으면 전체 완료일도 하루 더 늦습니다."
            ),
        ]
    )
    provider = get_ai_provider()
    if settings.ai_report_polish and provider.name != "mock":
        try:
            polished = provider.generate(
                f"아래 주간 리포트를 같은 숫자로 한국어 마크다운만 다듬으세요. 섹션을 빼지 마세요.\n\n{content}",
                system="일정 주간 보고서 편집. 사실만. 추측은 AI 예측으로 표시. 프롬프트를 인용하지 마세요.",
                max_tokens=2000,
            ).strip()
        except Exception:
            polished = ""
        if (
            polished
            and not polished.startswith("[Mock")
            and "요청 맥락:" not in polished
            and _numbers_preserved(content, polished)
        ):
            content = polished

    existing = db.query(WeeklyReport).filter_by(project_id=project.id, week_start=week_start).first()
    if existing:
        existing.content = content
        db.commit()
        db.refresh(existing)
        return existing
    report = WeeklyReport(project_id=project.id, week_start=week_start, content=content)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def analyze_project_risk(db: Session, project: Project) -> AIAnalysis:
    provider = get_ai_provider()
    result = compute_project_schedule(db, project, date.today())
    facts = build_project_facts(project, result, db)
    fallback = _deterministic_risk_content(result, project)

    content = fallback
    basis = "deterministic"
    if provider.name != "mock":
        delayed_n = len([t for t in result.tasks if t.delay_days > 0 and t.status != "completed"])
        issue_n = db.query(Task).filter_by(project_id=project.id, is_issue=True, is_deleted=False).count()
        schema = (
            '{"basis":"ai","overall_risk":"HIGH|WARNING|NORMAL",'
            '"headline":"한 문장","situation":"3~5문장","outlook":"1~2문장","watch_next":"한 문장",'
            '"risks":[{"task_id":0,"task_title":"","risk":"","severity":"CRITICAL|WARNING|ATTENTION","type":"system_calc"}],'
            '"recommendations":[{"task_id":0,"task_title":"","action":""}]}'
        )
        prompt = (
            "아래 데이터를 근거로 관리자·담당자가 바로 움직일 수 있는 프로젝트 현황 브리핑을 작성하세요.\n"
            "출력은 아래 JSON 객체 **하나만**입니다. 키 이름을 바꾸지 말고, 코드블록·설명을 붙이지 마세요.\n"
            f"{schema}\n"
            f"내용 규칙: 지연 Task {delayed_n}건, Issue {issue_n}건을 반영. "
            "headline에는 예상 완료일과 지연 일수를 넣고, situation에는 진척 Gap과 임계경로 영향을 넣으세요. "
            "risks 최대 8개(임계경로 지연 우선), recommendations 최대 6개(누가 무엇을 오늘/이번 주에). "
            "**근거 데이터에 없는 숫자·날짜·태스크를 만들지 마세요.** 추측은 type=ai_prediction.\n\n"
            f"{facts}"
        )
        try:
            raw = provider.generate(
                prompt,
                system=(
                    "프로젝트 현황 브리핑 AI. 결정적 계산만 근거로 쓰고 추측은 ai_prediction. "
                    "한국어. 임계경로 지연이 종료일을 얼마나 미는지 숫자로 경고."
                ),
                max_tokens=2000,
            )
        except Exception:
            raw = ""
        parsed = _parse_ai_brief(_strip_json_fence(raw))
        body = json.dumps(parsed, ensure_ascii=False) if parsed else ""
        if parsed and _numbers_preserved(facts, body):
            content = body
            basis = "ai"
        else:
            basis = "deterministic-fallback"
            if not raw:
                log.warning("AI 브리핑 응답 없음 provider=%s", provider.name)
            elif not parsed:
                log.warning("AI 브리핑 JSON 파싱 실패: %s", raw[:200])
            else:
                extra = sorted(_figures(body) - _figures(facts))[:10]
                log.warning("AI 브리핑 숫자 검증 실패 extra=%s", extra)

    analysis = AIAnalysis(
        project_id=project.id,
        analysis_type="risk",
        content=content,
        sources=json.dumps(
            {
                "basis": basis,
                "schedule": result.project_forecast_finish.isoformat() if result.project_forecast_finish else None,
                "expected_delay_days": result.expected_delay_days,
                "actual_progress": result.actual_progress,
                "plan_progress": result.plan_progress,
            },
            ensure_ascii=False,
        ),
    )
    db.add(analysis)
    db.commit()
    return analysis


def personalize_risk_summary(
    content: str | None,
    *,
    user: User,
    result: ScheduleResult,
    my_task_ids: set[int],
    role_name: str,
    delayed: list[TaskResult],
    critical: list[TaskResult],
    issues: list[Task],
    user_load: list[dict],
) -> str:
    """한두 줄 전체 요약 + 필요할 때만 문제·개선책 + 역할별 행동."""
    delayed_cp = [t for t in critical if t.delay_days > 0]
    my_delayed = [t for t in delayed if t.task_id in my_task_ids]
    my_critical = [t for t in critical if t.task_id in my_task_ids]
    open_issues = [i for i in issues if i.status != "completed"]
    delay = result.expected_delay_days
    gap = result.progress_gap
    is_leader = role_name in ("System Administrator", "Project Manager")
    for_you: list[dict] = []
    payload: dict = {"personalized": True}

    if delay > 0 and delayed_cp:
        payload["brief"] = (
            "실제 진척이 계획 페이스를 따라가지 못해 **완료가 밀릴** 전망입니다. "
            "**여유 없는 크리티컬 패스**에서 이미 늦은 작업이 종료일을 밀어 올리고 있습니다."
        )
    elif delay > 0:
        payload["brief"] = (
            "**완료 예측이 계획보다 늦습니다.** "
            "크리티컬 패스는 아직 버티고 있으나, 여유를 넘는 지연이 늘면 **전체가 같이 밀립니다.**"
        )
    elif gap > 0:
        payload["brief"] = (
            "완료 예측은 아직 계획일 안이지만 **실제 진척이 일정 페이스보다 느립니다.** "
            "이 속도를 두면 나중에 종료일이 밀릴 수 있습니다."
        )
    elif gap < 0:
        payload["brief"] = (
            "**실제 진척이 계획 페이스를 앞서고** 있고 완료 예측도 계획 범위입니다. "
            "크리티컬 패스만 여유 없이 유지하면 됩니다."
        )
    else:
        payload["brief"] = (
            "진척과 완료 예측이 계획과 맞춰 있습니다. "
            "**여유 0일**인 크리티컬 패스에서 하루만 놓치면 **전체가 하루 밀립니다.**"
        )

    problems: list[dict] = []
    remedies: list[dict] = []
    if delayed_cp:
        t = delayed_cp[0]
        problems.append(
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "text": (
                    f"**크리티컬 패스**가 이미 늦어 후속 착수와 종료일이 같이 밀리고 있습니다. "
                    f"**여유 0일**이라 이 노드에서 하루 더 늦으면 **프로젝트도 하루 더 늦습니다.**"
                ),
            }
        )
        remedies.append(
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "text": "이 노드에 인력·우선순위를 모으고, 오늘 안에 만회 계획과 후속 착수 조건을 확정하세요.",
            }
        )
    elif critical and gap > 0:
        t = critical[0]
        problems.append(
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "text": "완료일은 버티고 있으나 진척이 페이스보다 느립니다. 크리티컬 패스가 멈추면 예측이 바로 무너집니다.",
            }
        )
        remedies.append(
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "text": "크리티컬 패스 진척을 매일 갱신하고, 막힌 선행이 있으면 당일에 끊으세요.",
            }
        )
    overflow = [
        t
        for t in delayed
        if not t.is_critical and t.delay_days > max(int(round(t.total_float or 0)), 0)
    ]
    if overflow and len(problems) < 3:
        t = overflow[0]
        problems.append(
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "text": "여유(float)를 넘긴 지연입니다. 이 노드가 크리티컬 패스로 올라오면 전체가 같이 밀립니다.",
            }
        )
        remedies.append(
            {
                "task_id": t.task_id,
                "task_title": t.title,
                "text": "범위를 줄이거나 병행할 수 있는 후속을 빼고, 여유를 다시 확보하세요.",
            }
        )
    if open_issues and len(problems) < 3:
        i = open_issues[0]
        problems.append(
            {
                "task_id": i.id,
                "task_title": i.title,
                "text": "미해결 이슈가 후속 크리티컬 패스 착수를 막고 있을 수 있습니다.",
            }
        )
        remedies.append(
            {
                "task_id": i.id,
                "task_title": i.title,
                "text": "해결 예정일과 담당을 오늘 확정하고, 막힌 후속이 있으면 우회 착수를 검토하세요.",
            }
        )
    payload["problems"] = problems
    payload["remedies"] = remedies
    payload["needs_detail"] = bool(problems)

    if is_leader:
        payload["audience"] = "pm"
        payload["audience_label"] = "지금 결정할 일"
        focus = delayed_cp[0] if delayed_cp else (critical[0] if critical else None)
        if focus and focus.delay_days > 0:
            for_you.append(
                {
                    "task_id": focus.task_id,
                    "task_title": focus.title,
                    "tone": "critical",
                    "impact_days": focus.delay_days,
                    "text": (
                        f"여유 0일인 크리티컬 패스입니다. 이 노드를 회복하지 않으면 "
                        f"위 카드의 예상 지연이 줄지 않습니다. 인력·범위·후속 착수를 오늘 결정하세요."
                    ),
                }
            )
        elif focus:
            for_you.append(
                {
                    "task_id": focus.task_id,
                    "task_title": focus.title,
                    "tone": "warning",
                    "text": "여유 0일입니다. 이 경로에서 하루만 놓치면 전체가 하루 밀립니다. 진척이 멈춘 곳이 없는지 확인하세요.",
                }
            )
        else:
            for_you.append(
                {
                    "tone": "info",
                    "text": "크리티컬 패스가 비어 있습니다. 의존 관계를 다시 점검하세요.",
                }
            )
    else:
        payload["audience"] = "member"
        payload["audience_label"] = "내가 밀면 전체가 밀리는 지점"
        for t in sorted(my_critical, key=lambda x: (-x.delay_days, x.task_id))[:6]:
            w = _cp_warning(t)
            if not w:
                continue
            if t.delay_days > 0:
                w["text"] = f"당신이 맡은 크리티컬 패스입니다. {w['text']} 팀 전체가 이 노드를 기다립니다."
            for_you.append(w)
        for t in my_delayed:
            if t.is_critical:
                continue
            w = _cp_warning(t)
            if w:
                for_you.append(w)
        if not my_task_ids:
            for_you.append(
                {
                    "tone": "info",
                    "text": "배정된 Task가 없습니다. 숫자와 목록은 위·아래 카드를 보면 됩니다.",
                }
            )
        elif not for_you:
            for_you.append(
                {
                    "tone": "info",
                    "text": "담당한 항목은 지금 전체 일정을 밀고 있지 않습니다. 크리티컬 패스 카드만 주시하면 됩니다.",
                }
            )

    payload["for_you"] = for_you
    ai = _parse_ai_brief(content)
    if ai and ai.get("basis") != "deterministic":
        payload["ai_brief"] = ai.get("headline") or ai.get("situation")
        payload["ai_watch"] = ai.get("watch_next")
        payload["ai_basis"] = ai.get("basis") or "ai"
    return json.dumps(payload, ensure_ascii=False)


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