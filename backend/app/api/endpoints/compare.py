from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import CompareRequest, ComparisonResponse
from app.services.compare_service import CompareService

router = APIRouter()

@router.post("/compare", response_model=ComparisonResponse)
def compare_documents(request: CompareRequest, db: Session = Depends(get_db)):
    if request.doc_a_id == request.doc_b_id:
        raise HTTPException(status_code=422, detail="Choose two different documents.")
    try:
        return CompareService.compare_documents(request.doc_a_id, request.doc_b_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")
