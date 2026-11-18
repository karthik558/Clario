import json
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from app.models.entities import AnswerRecord
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import AskRequest, AskResponse
from app.services.ask_service import AskService

router = APIRouter()

@router.post("/ask", response_model=AskResponse)
def ask_clario(request: AskRequest, db: Session = Depends(get_db)):
    response = AskService.answer_question(request, db)
    AskService.save_answer(request, response, db)
    return response

@router.post("/ask/stream")
def ask_clario_stream(request: AskRequest, db: Session = Depends(get_db)):
    """
    Realtime Server-Sent Events (SSE) streaming endpoint:
    Streams thinking tokens, cited answer tokens, and citations in real time.
    """
    return StreamingResponse(
        AskService.stream_answer_question(request, db),
        media_type="text/event-stream"
    )


@router.get("/ask/history")
def answer_history(limit: int = Query(default=50, ge=1, le=100), db: Session = Depends(get_db)):
    records = db.query(AnswerRecord).order_by(AnswerRecord.created_at.desc(), AnswerRecord.id.desc()).limit(limit).all()
    return [{"id": row.id, "query": row.query, "response": json.loads(row.response_json), "document_ids": json.loads(row.document_ids_json), "created_at": row.created_at} for row in reversed(records)]


@router.delete("/ask/history")
def clear_answer_history(db: Session = Depends(get_db)):
    deleted_count = db.query(AnswerRecord).delete()
    db.commit()
    return {"status": "success", "message": "Answer history cleared successfully", "deleted_count": deleted_count}
