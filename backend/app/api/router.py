from fastapi import APIRouter
from app.api.endpoints import (
    health,
    dashboard,
    documents,
    search,
    ask,
    compare,
    findings,
    reports,
    jobs,
    settings
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(dashboard.router, tags=["Dashboard"])
api_router.include_router(documents.router, tags=["Documents"])
api_router.include_router(search.router, tags=["Search & Retrieval"])
api_router.include_router(ask.router, tags=["Ask Clario"])
api_router.include_router(compare.router, tags=["Document Comparison"])
api_router.include_router(findings.router, tags=["Findings"])
api_router.include_router(reports.router, tags=["Reports"])
api_router.include_router(jobs.router, tags=["Ingestion Jobs"])
api_router.include_router(settings.router, tags=["Settings"])
