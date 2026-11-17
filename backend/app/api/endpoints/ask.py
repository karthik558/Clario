from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import AskRequest, AskResponse
from app.services.ask_service import AskService

router = APIRouter()

@router.post("/ask", response_model=AskResponse)
def ask_clario(request: AskRequest, db: Session = Depends(get_db)):
    return AskService.answer_question(request, db)
