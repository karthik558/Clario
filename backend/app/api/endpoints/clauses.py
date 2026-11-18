from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.clause_service import ClauseService

router = APIRouter()

class ClauseAnalyzeRequest(BaseModel):
    clause_text: str

class ClauseBenchmarkRequest(BaseModel):
    document_ids: Optional[List[str]] = None

@router.get("")
def get_clause_benchmarks(db: Session = Depends(get_db)):
    return ClauseService.extract_and_benchmark(db)

@router.post("/benchmark")
def benchmark_clauses(req: ClauseBenchmarkRequest, db: Session = Depends(get_db)):
    return ClauseService.extract_and_benchmark(db, document_ids=req.document_ids)

@router.post("/analyze")
def analyze_clause(req: ClauseAnalyzeRequest):
    return ClauseService.analyze_clause(req.clause_text)
