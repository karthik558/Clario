from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.brief_service import BriefService

router = APIRouter()

class BriefGenerateRequest(BaseModel):
    template_id: str = "board_executive"
    document_ids: Optional[List[str]] = None
    custom_notes: Optional[str] = None

@router.get("/templates")
def get_templates():
    return BriefService.get_templates()

@router.post("/generate")
def generate_brief(req: BriefGenerateRequest, db: Session = Depends(get_db)):
    return BriefService.generate_brief(
        db,
        template_id=req.template_id,
        document_ids=req.document_ids,
        custom_notes=req.custom_notes
    )
