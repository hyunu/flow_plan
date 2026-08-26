from fastapi import APIRouter

from app.api import auth, audit, calendars, challenges, dashboard, dependencies, groups, milestones, notifications, projects, reports, schedule, tasks, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(groups.router)
api_router.include_router(tasks.router)
api_router.include_router(dependencies.router)
api_router.include_router(milestones.router)
api_router.include_router(calendars.router)
api_router.include_router(schedule.router)
api_router.include_router(challenges.router)
api_router.include_router(reports.router)
api_router.include_router(notifications.router)
api_router.include_router(audit.router)
api_router.include_router(dashboard.router)