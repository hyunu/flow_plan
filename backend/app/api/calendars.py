from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.permissions import audit, get_project_or_403, require_perm
from app.core.security import get_current_user
from app.models.entities import (
    Project,
    ProjectCalendar,
    ProjectCalendarEntry,
    ProjectMember,
    User,
    UserCalendar,
    UserCalendarEntry,
)
from app.schemas import (
    ProjectCalendarEntryCreate,
    ProjectCalendarEntryRead,
    UserCalendarEntryCreate,
    UserCalendarEntryRead,
)

router = APIRouter(prefix="/calendars", tags=["calendars"])


def _can_access_user_calendar(db: Session, target_user_id: int, user: User) -> bool:
    """본인, SysAdmin, 또는 해당 사용자가 속한 프로젝트를 관리하는 PM만 접근 가능."""
    if target_user_id == user.id:
        return True
    role_name = user.role.name if user.role else ""
    if role_name == "System Administrator":
        return True
    if role_name != "Project Manager":
        return False
    # 타겟 사용자가 속한 프로젝트 중 내가 관리자/멤버인 프로젝트가 있는지
    from sqlalchemy import select

    managed = select(ProjectMember.project_id).where(
        ProjectMember.user_id == user.id, ProjectMember.role_in_project == "manager"
    ).union(select(Project.id).where(Project.manager_id == user.id))
    target_in = select(ProjectMember.project_id).where(ProjectMember.user_id == target_user_id)
    overlap = managed.intersect(target_in).exists()
    return bool(db.query(Project).filter(overlap).first())


# ---------- Project Calendar ----------
@router.get("/project/{project_id}/entries", response_model=list[ProjectCalendarEntryRead])
def list_project_entries(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = get_project_or_403(db, project_id, user)
    cal = project.calendar
    if not cal:
        return []
    return [
        ProjectCalendarEntryRead(id=e.id, date=e.date, is_workday=e.is_workday, kind=e.kind, hours=e.hours, note=e.note)
        for e in cal.entries
    ]


@router.post("/project/{project_id}/entries", response_model=ProjectCalendarEntryRead)
def upsert_project_entry(
    project_id: int, body: ProjectCalendarEntryCreate,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    project = get_project_or_403(db, project_id, user)
    require_perm(db, user, "calendar.project_manage", project)
    cal = project.calendar
    if not cal:
        cal = ProjectCalendar(project_id=project.id, daily_work_hours=8.0, work_days="0,1,2,3,4")
        db.add(cal)
        db.flush()
    entry = db.query(ProjectCalendarEntry).filter_by(calendar_id=cal.id, date=body.date).first()
    if entry:
        entry.is_workday = body.is_workday
        entry.kind = body.kind
        entry.hours = body.hours
        entry.note = body.note
    else:
        entry = ProjectCalendarEntry(
            calendar_id=cal.id, date=body.date, is_workday=body.is_workday, kind=body.kind, hours=body.hours, note=body.note
        )
        db.add(entry)
    audit(db, user.id, "update", "ProjectCalendar", project.id, reason=f"{body.date}")
    db.commit()
    db.refresh(entry)
    return ProjectCalendarEntryRead(id=entry.id, date=entry.date, is_workday=entry.is_workday, kind=entry.kind, hours=entry.hours, note=entry.note)


# ---------- User Calendar ----------
@router.get("/user/{user_id}/entries", response_model=list[UserCalendarEntryRead])
def list_user_entries(user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not _can_access_user_calendar(db, user_id, user):
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    cal = db.query(UserCalendar).filter_by(user_id=user_id).first()
    if not cal:
        return []
    return [
        UserCalendarEntryRead(id=e.id, date=e.date, is_available=e.is_available, kind=e.kind, available_hours=e.available_hours, note=e.note)
        for e in cal.entries
    ]


@router.post("/user/{user_id}/entries", response_model=UserCalendarEntryRead)
def upsert_user_entry(
    user_id: int, body: UserCalendarEntryCreate,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    # 타인의 휴가/부재 정보는 수정할 수 없다(민감 데이터 보호 §43.7)
    if user_id != user.id:
        raise HTTPException(status_code=403, detail="본인 캘린더만 수정할 수 있습니다.")
    cal = db.query(UserCalendar).filter_by(user_id=user_id).first()
    if not cal:
        cal = UserCalendar(user_id=user_id, daily_work_hours=8.0)
        db.add(cal)
        db.flush()
    entry = db.query(UserCalendarEntry).filter_by(calendar_id=cal.id, date=body.date).first()
    if entry:
        entry.is_available = body.is_available
        entry.kind = body.kind
        entry.available_hours = body.available_hours
        entry.note = body.note
    else:
        entry = UserCalendarEntry(
            calendar_id=cal.id, date=body.date, is_available=body.is_available,
            kind=body.kind, available_hours=body.available_hours, note=body.note,
        )
        db.add(entry)
    audit(db, user.id, "update", "UserCalendar", cal.id, reason=f"{body.date}")
    db.commit()
    db.refresh(entry)
    return UserCalendarEntryRead(id=entry.id, date=entry.date, is_available=entry.is_available, kind=entry.kind, available_hours=entry.available_hours, note=entry.note)