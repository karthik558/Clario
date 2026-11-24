from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
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
    document_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    doc_id_list = [d.strip() for d in document_ids.split(",") if d.strip()] if document_ids else None
    items = ObligationService.extract_obligations(db, document_ids=doc_id_list)
    if category:
        items = [i for i in items if i["category"].lower() == category.lower()]
    if risk:
        items = [i for i in items if i["risk_level"].lower() == risk.lower()]
    return {
        "total": len(items),
        "items": items
    }

@router.get("/export-calendar")
def export_calendar(
    category: Optional[str] = Query(None),
    risk: Optional[str] = Query(None),
    document_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Export extracted contractual deadlines and obligations as an RFC 5545 iCalendar (.ics) file.
    Directly importable into Google Calendar, Outlook, and Apple Calendar.
    """
    doc_id_list = [d.strip() for d in document_ids.split(",") if d.strip()] if document_ids else None
    items = ObligationService.extract_obligations(db, document_ids=doc_id_list)
    if category:
        items = [i for i in items if i["category"].lower() == category.lower()]
    if risk:
        items = [i for i in items if i["risk_level"].lower() == risk.lower()]

    ics_content = ObligationService.generate_icalendar(items)
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={
            "Content-Disposition": 'attachment; filename="clario-contract-obligations.ics"'
        }
    )

@router.post("/scan")
def scan_obligations(req: ObligationScanRequest, db: Session = Depends(get_db)):
    items = ObligationService.extract_obligations(db, document_ids=req.document_ids)
    return {
        "total": len(items),
        "items": items
    }
