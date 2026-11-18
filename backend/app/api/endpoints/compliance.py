from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.compliance_service import ComplianceService

router = APIRouter()

class ComplianceAuditRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    framework_ids: Optional[List[str]] = None

@router.get("/frameworks")
def get_frameworks():
    return ComplianceService.list_frameworks()

@router.post("/audit")
def run_compliance_audit(req: ComplianceAuditRequest, db: Session = Depends(get_db)):
    return ComplianceService.run_audit(
        db,
        document_ids=req.document_ids,
        framework_ids=req.framework_ids
    )
