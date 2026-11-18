from typing import Optional, List
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import NegotiateRequest, NegotiateResponse
from app.services.negotiate_service import NegotiateService

router = APIRouter()

class NegotiateDocxRequest(BaseModel):
    finding_id: Optional[str] = None
    topic: str = "Contract Provision"
    stance: str = "customer_protective"
    doc_a_title: Optional[str] = "Document A"
    doc_b_title: Optional[str] = "Document B"
    statement_a: Optional[str] = ""
    statement_b: Optional[str] = ""
    proposed_clause: Optional[str] = None
    rationale: Optional[str] = None
    risk_level: Optional[str] = None
    key_concessions: Optional[List[str]] = None

@router.post("/negotiate", response_model=NegotiateResponse)
@router.post("/findings/{finding_id}/negotiate", response_model=NegotiateResponse)
def negotiate_clause(
    req: NegotiateRequest,
    finding_id: str = None,
    db: Session = Depends(get_db)
):
    """
    Autonomous Redline & Clause Negotiator:
    Generates balanced, customer-protective, or vendor-favorable redline amendments
    to bridge detected contradictions between conflicting documents.
    """
    if finding_id:
        req.finding_id = finding_id
    return NegotiateService.draft_redline(req, db)

@router.post("/negotiate/export-docx")
def export_negotiate_docx(
    req: NegotiateDocxRequest,
    db: Session = Depends(get_db)
):
    """
    Export clause redline as a styled Microsoft Word (.docx) file with tracked changes markup.
    """
    # If proposed clause not provided directly, draft it dynamically
    if not req.proposed_clause:
        draft = NegotiateService.draft_redline(
            NegotiateRequest(
                finding_id=req.finding_id,
                topic=req.topic,
                statement_a=req.statement_a,
                statement_b=req.statement_b,
                doc_a_title=req.doc_a_title,
                doc_b_title=req.doc_b_title,
                stance=req.stance  # type: ignore
            ),
            db
        )
        proposed = draft.proposed_clause
        rationale = draft.rationale
        risk = draft.risk_level
        concessions = draft.key_concessions
    else:
        proposed = req.proposed_clause
        rationale = req.rationale or "Harmonized clause balancing commercial and legal standards."
        risk = req.risk_level or "Low Risk"
        concessions = req.key_concessions or []

    docx_bytes = NegotiateService.export_redline_docx(
        topic=req.topic,
        stance=req.stance,
        doc_a_title=req.doc_a_title or "Document A",
        doc_b_title=req.doc_b_title or "Document B",
        statement_a=req.statement_a or "",
        statement_b=req.statement_b or "",
        proposed_clause=proposed,
        rationale=rationale,
        risk_level=risk,
        key_concessions=concessions
    )

    clean_filename = req.topic.lower().replace(" ", "-")[:30] or "clause-redline"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="clario-redline-{clean_filename}.docx"'
        }
    )
