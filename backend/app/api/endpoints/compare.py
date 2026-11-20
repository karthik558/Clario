from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import CompareRequest, ComparisonResponse, MultiCompareRequest, MultiCompareResponse
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

@router.post("/compare/matrix", response_model=MultiCompareResponse)
def compare_matrix(request: MultiCompareRequest, db: Session = Depends(get_db)):
    if len(request.doc_ids) < 2:
        raise HTTPException(status_code=422, detail="Select at least 2 documents to compare.")
    try:
        return CompareService.compare_multiple_documents(request.doc_ids, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Multi-document comparison failed: {str(e)}")
