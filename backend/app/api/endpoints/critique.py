from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.critique_service import CritiqueService

router = APIRouter()

class CritiqueRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    custom_clause: Optional[str] = None
    use_ai: Optional[bool] = False

class DraftCounterRequest(BaseModel):
    point: str
    detail: str
    persona_id: Optional[str] = "general_counsel"
    document_title: Optional[str] = None

class PersonaCritiqueRequest(BaseModel):
    persona_id: str
    document_ids: Optional[List[str]] = None
    custom_clause: Optional[str] = None

@router.post("/evaluate")
def evaluate_critique(req: CritiqueRequest, db: Session = Depends(get_db)):
    return CritiqueService.evaluate_corpus(
        db,
        document_ids=req.document_ids,
        custom_clause=req.custom_clause,
        use_ai=bool(req.use_ai)
    )

@router.post("/evaluate-persona")
def evaluate_single_persona(req: PersonaCritiqueRequest, db: Session = Depends(get_db)):
    return CritiqueService.evaluate_single_persona(
        db,
        persona_id=req.persona_id,
        document_ids=req.document_ids,
        custom_clause=req.custom_clause,
    )

@router.post("/draft-counter")
def draft_counter(req: DraftCounterRequest):
    return CritiqueService.draft_counter_clause(
        point=req.point,
        detail=req.detail,
        persona_id=req.persona_id or "general_counsel",
        document_title=req.document_title
    )
