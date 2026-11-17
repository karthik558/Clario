from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import GraphDataResponse
from app.services.graph_service import GraphService

router = APIRouter()

@router.get("/graph", response_model=GraphDataResponse)
def get_knowledge_graph(
    document_ids: Optional[str] = Query(None, description="Comma-separated document IDs to scope the graph"),
    db: Session = Depends(get_db)
):
    """
    Returns visual network graph nodes and edges connecting Documents,
    Policy Topics, Detected Contradictions, and Key Passages.
    """
    doc_id_list = [d.strip() for d in document_ids.split(",") if d.strip()] if document_ids else None
    return GraphService.build_workspace_graph(db, document_ids=doc_id_list)
