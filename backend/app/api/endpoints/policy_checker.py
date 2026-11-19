from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.policy_checker_service import PolicyCheckerService, ENTERPRISE_POLICY_RULES

router = APIRouter()

class PolicyAuditRequest(BaseModel):
    document_ids: Optional[List[str]] = None
    category_filter: Optional[str] = "all"

@router.get("/rules")
def get_policy_rules():
    return {
        "total_rules": len(ENTERPRISE_POLICY_RULES),
        "rules": [
            {
                "id": r["id"],
                "title": r["title"],
                "category": r["category"],
                "severity": r["severity"],
                "benchmark": r["benchmark"]
            }
            for r in ENTERPRISE_POLICY_RULES
        ]
    }

@router.get("/audit")
def audit_policies_get(
    document_ids: Optional[str] = Query(None, description="Comma-separated document IDs"),
    category: Optional[str] = Query("all", description="Category filter"),
    db: Session = Depends(get_db)
):
    doc_id_list = [d.strip() for d in document_ids.split(",")] if document_ids else None
    return PolicyCheckerService.audit_workspace_policies(
        db,
        document_ids=doc_id_list,
        category_filter=category
    )

@router.post("/audit")
def audit_policies_post(req: PolicyAuditRequest, db: Session = Depends(get_db)):
    return PolicyCheckerService.audit_workspace_policies(
        db,
        document_ids=req.document_ids,
        category_filter=req.category_filter
    )
