from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.risk_service import RiskService

router = APIRouter()

@router.get("/scorecard")
def get_risk_scorecard(
    document_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive 0-100 Contract Risk Scorecard across 6 core risk pillars
    (Privacy & AI Retention, Termination Lock-In, IP Defense, SLA, Liability Caps, Regulatory & Safety).
    """
    return RiskService.evaluate_workspace(db, doc_id=document_id)

@router.get("/benchmark")
def get_risk_benchmark(
    doc_a: str = Query(..., description="Document A ID"),
    doc_b: str = Query(..., description="Document B ID"),
    db: Session = Depends(get_db)
):
    """
    Perform side-by-side Risk Benchmark between two documents across all 6 risk dimensions,
    declaring favorable terms, score differentials, and protective advantages.
    """
    res = RiskService.compare_documents(doc_a, doc_b, db)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res
