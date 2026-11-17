from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.dtos import (
    SearchRequest,
    SearchResponse,
    SearchResultItem,
    SearchMethodComparison,
    BenchmarkSummaryResponse
)
from app.services.search_service import search_service

router = APIRouter()

@router.post("/search", response_model=SearchResponse)
def execute_search(request: SearchRequest, db: Session = Depends(get_db)):
    results, latency_ms = search_service.search(
        query=request.query,
        mode=request.mode,
        top_k=request.top_k,
        document_ids=request.document_ids,
        db=db
    )
    items = [SearchResultItem(**r) for r in results]
    return SearchResponse(
        query=request.query,
        mode=request.mode,
        top_k=request.top_k,
        latency_ms=latency_ms,
        results=items
    )

@router.post("/search/compare-methods", response_model=SearchMethodComparison)
def compare_search_methods(request: SearchRequest, db: Session = Depends(get_db)):
    stats = search_service.compare_methods(
        query=request.query,
        top_k=request.top_k,
        db=db
    )
    return SearchMethodComparison(**stats)

@router.post("/search/benchmark", response_model=BenchmarkSummaryResponse)
def run_academic_benchmark(
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db)
):
    custom_queries = payload.get("queries") if payload else None
    return search_service.run_benchmark(custom_queries, db)
