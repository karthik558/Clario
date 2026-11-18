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
    settings,
    graph,
    negotiate,
    compliance,
    obligations,
    critique,
    clauses,
    briefs,
    risk
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
api_router.include_router(graph.router, tags=["Knowledge Graph"])
api_router.include_router(negotiate.router, tags=["Clause Negotiator"])
api_router.include_router(compliance.router, prefix="/compliance", tags=["Compliance Matrix"])
api_router.include_router(obligations.router, prefix="/obligations", tags=["Obligations & Timeline"])
api_router.include_router(critique.router, prefix="/critique", tags=["Document Critique"])
api_router.include_router(clauses.router, prefix="/clauses", tags=["Clause Library"])
api_router.include_router(briefs.router, prefix="/briefs", tags=["Executive Briefs"])
api_router.include_router(risk.router, prefix="/risk", tags=["Risk Scorecard & Benchmarking"])
