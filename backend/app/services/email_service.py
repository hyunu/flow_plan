"""이메일 발송 서비스 — 리포트(데일리/위클리)를 이메일로 전송한다.

- 개발자(Project Member)에게는 Daily, 관리자(PM/SysAdmin)에게는 Weekly 발송
- 수신 권한은 관리자 페이지에서 사용자별로 설정(기본: 역할 기준)
- SMTP 설정은 EmailConfig 테이블로 관리자 페이지에서 설정
"""
from __future__ import annotations

import re
import smtplib
from datetime import date, timedelta
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from html import escape

from sqlalchemy.orm import Session

from app.models.entities import (
    DailyReport,
    EmailConfig,
    Notification,
    Project,
    User,
    UserReportSetting,
    WeeklyReport,
)
from app.services.ai_service import generate_daily_report, generate_weekly_report


def get_email_config(db: Session) -> EmailConfig:
    cfg = db.query(EmailConfig).order_by(EmailConfig.id).first()
    if not cfg:
        cfg = EmailConfig()
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def should_deliver(db: Session, user: User, kind: str) -> bool:
    """사용자별 발송 권한. 설정이 없으면 역할 기본값(멤버→데일리, 관리자→위클리)."""
    setting = db.query(UserReportSetting).filter_by(user_id=user.id).first()
    if setting:
        return setting.deliver_daily if kind == "daily" else setting.deliver_weekly
    role = user.role.name if user.role else ""
    if kind == "daily":
        return role == "Project Member"
    return role in ("Project Manager", "System Administrator")


def md_to_html(md: str) -> str:
    """간단한 마크다운 → HTML 변환(리포트 렌더링용)."""
    lines = md.splitlines()
    html: list[str] = []
    in_list = False
    in_pre = False
    pre_buf: list[str] = []

    def flush_pre():
        nonlocal pre_buf, in_pre
        if pre_buf:
            html.append("<pre style='font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;white-space:pre-wrap;'>" + escape("\n".join(pre_buf)) + "</pre>")
            pre_buf = []
            in_pre = False

    def flush_list():
        nonlocal in_list
        if in_list:
            html.append("</ul>")
            in_list = False

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            flush_list()
            flush_pre()
            continue
        if "|" in line and line.strip().startswith("|"):
            # 테이블 라인 — pre로 처리
            if not in_pre:
                flush_list()
                html.append("<pre style='font-family:ui-monospace,Menlo,monospace;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;white-space:pre-wrap;'>")
                in_pre = True
            pre_buf.append(line)
            continue
        flush_pre()
        if line.startswith("### "):
            flush_list()
            html.append(f"<h3 style='margin:14px 0 6px;font-size:14px;color:#0f172a;'>{escape(line[4:])}</h3>")
        elif line.startswith("## "):
            flush_list()
            html.append(f"<h2 style='margin:16px 0 8px;font-size:15px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;'>{escape(line[3:])}</h2>")
        elif line.startswith("# "):
            flush_list()
            html.append(f"<h1 style='margin:18px 0 8px;font-size:17px;color:#0f172a;'>{escape(line[2:])}</h1>")
        elif re.match(r"^[-*]\s+", line):
            if not in_list:
                html.append("<ul style='margin:6px 0;padding-left:18px;'>")
                in_list = True
            html.append(f"<li style='margin:2px 0;font-size:13px;color:#334155;'>{escape(re.sub(r'^[-*]\s+', '', line))}</li>")
        else:
            flush_list()
            text = escape(line)
            text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
            text = re.sub(r"`([^`]+)`", r"<code style='background:#f1f5f9;padding:0 3px;border-radius:4px;'>\1</code>", text)
            html.append(f"<p style='margin:4px 0;font-size:13px;color:#334155;'>{text}</p>")
    flush_list()
    flush_pre()
    return "".join(html)


def _send_one(db: Session, cfg: EmailConfig, to_email: str, subject: str, body_html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((cfg.from_name or "Flow Plan", cfg.from_email))
    msg["To"] = to_email
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=15) as server:
        if cfg.use_tls:
            server.starttls()
        if cfg.smtp_user:
            server.login(cfg.smtp_user, cfg.smtp_password or "")
        server.sendmail(cfg.from_email, [to_email], msg.as_string())


def _assert_ready(cfg: EmailConfig) -> None:
    if not cfg.enabled:
        raise RuntimeError("이메일 발송이 비활성화되어 있습니다. 관리자 페이지에서 SMTP 설정을 활성화해 주세요.")
    if not cfg.smtp_host:
        raise RuntimeError("SMTP 호스트가 설정되지 않았습니다.")


def send_daily_reports(db: Session, today: date | None = None) -> list[str]:
    """데일리 리포트를 수신 권한(기본: Project Member) 사용자에게 이메일 발송."""
    import time

    today = today or date.today()
    cfg = get_email_config(db)
    _assert_ready(cfg)
    sent: list[str] = []
    users = db.query(User).filter(User.is_active.is_(True)).order_by(User.id).all()
    for u in users:
        if not should_deliver(db, u, "daily"):
            continue
        if not u.email:
            continue
        report = db.query(DailyReport).filter_by(user_id=u.id, report_date=today).first()
        if not report:
            report = generate_daily_report(db, u, today)
            time.sleep(1.5)  # AI 쿼터 분산(데일리 대량 생성 시)
        _send_one(db, cfg, u.email, f"[Flow Plan] {today.isoformat()} 일일 업무 보고서", md_to_html(report.content))
        db.add(Notification(user_id=u.id, channel="email", type="daily_report",
                            title="일일 보고서 이메일 발송", body=f"{today.isoformat()} 일일 업무 보고서", link="/reports"))
        sent.append(u.email)
    db.commit()
    return sent


def send_weekly_report(db: Session, project: Project, week_start: date | None = None) -> list[str]:
    """위클리 리포트를 해당 프로젝트의 수신 권한(기본: PM/SysAdmin) 사용자에게 발송."""
    week_start = week_start or (date.today() - timedelta(days=date.today().weekday()))
    cfg = get_email_config(db)
    _assert_ready(cfg)

    report = db.query(WeeklyReport).filter_by(project_id=project.id, week_start=week_start).first()
    if not report:
        report = generate_weekly_report(db, project, week_start)

    recipients: list[User] = []
    seen: set[int] = set()
    for member in project.members:
        u = member.user
        if u and u.is_active and u.id not in seen and u.email and should_deliver(db, u, "weekly"):
            recipients.append(u)
            seen.add(u.id)
    if project.manager_id and project.manager_id not in seen:
        mgr = db.get(User, project.manager_id)
        if mgr and mgr.email and should_deliver(db, mgr, "weekly"):
            recipients.append(mgr)
            seen.add(mgr.id)

    sent: list[str] = []
    for u in recipients:
        _send_one(db, cfg, u.email, f"[Flow Plan] {project.name} 주간 보고서 ({week_start.isoformat()} 주)", md_to_html(report.content))
        db.add(Notification(user_id=u.id, channel="email", type="weekly_report",
                            title="주간 보고서 이메일 발송", body=f"{project.name} {week_start.isoformat()} 주", link=f"/reports?project={project.id}"))
        sent.append(u.email)
    db.commit()
    return sent