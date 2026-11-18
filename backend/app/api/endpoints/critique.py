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

@router.post("/evaluate")
def evaluate_critique(req: CritiqueRequest, db: Session = Depends(get_db)):
    return CritiqueService.evaluate_corpus(
        db,
        document_ids=req.document_ids,
        custom_clause=req.custom_clause
    )
