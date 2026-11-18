from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.obligation_service import ObligationService

router = APIRouter()

class ObligationScanRequest(BaseModel):
    document_ids: Optional[List[str]] = None

@router.get("")
def get_obligations(
    category: Optional[str] = Query(None),
    risk: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    items = ObligationService.extract_obligations(db)
    if category:
        items = [i for i in items if i["category"].lower() == category.lower()]
    if risk:
        items = [i for i in items if i["risk_level"].lower() == risk.lower()]
    return {
        "total": len(items),
        "items": items
    }

@router.post("/scan")
def scan_obligations(req: ObligationScanRequest, db: Session = Depends(get_db)):
    items = ObligationService.extract_obligations(db, document_ids=req.document_ids)
    return {
        "total": len(items),
        "items": items
    }
