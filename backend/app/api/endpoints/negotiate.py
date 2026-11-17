from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import NegotiateRequest, NegotiateResponse
from app.services.negotiate_service import NegotiateService

router = APIRouter()

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
