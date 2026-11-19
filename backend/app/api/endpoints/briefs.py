from typing import Optional, List
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.brief_service import BriefService

router = APIRouter()

class BriefGenerateRequest(BaseModel):
    template_id: str = "board_executive"
    document_ids: Optional[List[str]] = None
    custom_notes: Optional[str] = None

class AudioSummaryRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    tone: Optional[str] = "executive"

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

@router.get("/audio-summary")
def get_audio_summary(document_ids: Optional[str] = None, db: Session = Depends(get_db)):
    doc_id_list = [d.strip() for d in document_ids.split(",")] if document_ids else None
    return BriefService.generate_audio_summary(db, document_ids=doc_id_list)

@router.post("/audio-summary")
def create_audio_summary(req: AudioSummaryRequest, db: Session = Depends(get_db)):
    return BriefService.generate_audio_summary(db, document_ids=req.document_ids, tone=req.tone or "executive")

@router.get("/audio-export")
def export_audio_get(
    document_ids: Optional[str] = None,
    format: str = "mp3",
    db: Session = Depends(get_db)
):
    doc_id_list = [d.strip() for d in document_ids.split(",")] if document_ids else None
    data, media_type, filename = BriefService.export_audio_file(
        db,
        document_ids=doc_id_list,
        output_format=format
    )
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.post("/audio-export")
def export_audio_post(
    req: AudioSummaryRequest,
    format: str = "mp3",
    db: Session = Depends(get_db)
):
    data, media_type, filename = BriefService.export_audio_file(
        db,
        document_ids=req.document_ids,
        output_format=format
    )
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
