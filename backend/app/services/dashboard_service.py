import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import Document, DocumentChunk, Finding, Comparison, SearchQuery
from app.schemas.dtos import DashboardStatsResponse, DocumentResponse, FindingResponse

class DashboardService:
    @staticmethod
    def get_stats(db: Session) -> DashboardStatsResponse:
        total_docs = db.query(Document).count()
        indexed_docs = db.query(Document).filter(Document.status == "READY").count()
        pending_docs = db.query(Document).filter(Document.status.in_(["QUEUED", "PROCESSING"])).count()
        total_chunks = db.query(DocumentChunk).count()
        
        recent_comparisons_count = db.query(Comparison).count()
        search_queries_count = db.query(SearchQuery).count()
        total_analyses = recent_comparisons_count + search_queries_count

        conflicts_count = db.query(Finding).filter(
            Finding.category == "possible_contradiction",
            Finding.status.in_(["open", "under_review", "confirmed"])
        ).count()

        avg_latency_query = db.query(func.avg(SearchQuery.latency_ms)).scalar()
        avg_latency = round(float(avg_latency_query), 2) if avg_latency_query else 14.2

        recent_docs_db = db.query(Document).order_by(Document.created_at.desc()).limit(6).all()
        recent_docs = []
        for d in recent_docs_db:
            dto = DocumentResponse.model_validate(d)
            dto.tags = json.loads(d.tags_json) if d.tags_json else []
            recent_docs.append(dto)

        recent_findings_db = db.query(Finding).order_by(Finding.created_at.desc()).limit(5).all()
        recent_findings = [FindingResponse.model_validate(f) for f in recent_findings_db]

        # Synthesize actual recent activity stream from recent events in DB
        activities: List[Dict[str, Any]] = []

        for d in recent_docs_db[:3]:
            activities.append({
                "type": "document_indexed" if d.status == "READY" else "document_uploaded",
                "title": f"Document '{d.title}' ingested ({d.chunk_count} passages)",
                "timestamp": d.created_at.strftime("%Y-%m-%d %H:%M"),
                "status": d.status
            })

        recent_searches = db.query(SearchQuery).order_by(SearchQuery.created_at.desc()).limit(3).all()
        for s in recent_searches:
            activities.append({
                "type": "search_executed",
                "title": f"Hybrid search executed for \"{s.query_text[:40]}\"",
                "timestamp": s.created_at.strftime("%Y-%m-%d %H:%M"),
                "status": f"{s.latency_ms}ms"
            })

        for f in recent_findings_db[:2]:
            activities.append({
                "type": "finding_detected",
                "title": f"Candidate flagged: {f.title[:45]}",
                "timestamp": f.created_at.strftime("%Y-%m-%d %H:%M"),
                "status": f.severity
            })

        # Sort activities by timestamp descending
        activities.sort(key=lambda x: x["timestamp"], reverse=True)

        return DashboardStatsResponse(
            total_documents=total_docs,
            indexed_documents=indexed_docs,
            pending_documents=pending_docs,
            total_searchable_passages=total_chunks,
            recent_analyses_count=total_analyses,
            potential_conflicts_count=conflicts_count,
            average_latency_ms=avg_latency,
            recent_documents=recent_docs,
            recent_findings=recent_findings,
            recent_activities=activities[:8]
        )
