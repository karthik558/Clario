import uuid
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.entities import Finding, Document
from app.schemas.dtos import FindingCreate, FindingUpdate, FindingResponse

class FindingService:
    @staticmethod
    def list_findings(
        db: Session,
        category: Optional[str] = None,
        status: Optional[str] = None,
        severity: Optional[str] = None
    ) -> List[Finding]:
        q = db.query(Finding)
        if category:
            q = q.filter(Finding.category == category)
        if status:
            q = q.filter(Finding.status == status)
        if severity:
            q = q.filter(Finding.severity == severity)
        return q.order_by(Finding.created_at.desc()).all()

    @staticmethod
    def get_finding(finding_id: str, db: Session) -> Optional[Finding]:
        return db.query(Finding).filter(Finding.id == finding_id).first()

    @staticmethod
    def create_finding(data: FindingCreate, db: Session) -> Finding:
        finding = Finding(
            id=str(uuid.uuid4()),
            category=data.category,
            title=data.title,
            description=data.description,
            severity=data.severity,
            status=data.status,
            doc_a_id=data.doc_a_id,
            doc_a_title=data.doc_a_title,
            doc_a_page=data.doc_a_page,
            doc_a_quote=data.doc_a_quote,
            doc_b_id=data.doc_b_id,
            doc_b_title=data.doc_b_title,
            doc_b_page=data.doc_b_page,
            doc_b_quote=data.doc_b_quote,
            reviewer_notes=data.reviewer_notes
        )
        db.add(finding)
        db.commit()
        db.refresh(finding)
        return finding

    @staticmethod
    def update_finding(finding_id: str, data: FindingUpdate, db: Session) -> Optional[Finding]:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        if not finding:
            return None

        if data.status is not None:
            finding.status = data.status
        if data.severity is not None:
            finding.severity = data.severity
        if data.reviewer_notes is not None:
            finding.reviewer_notes = data.reviewer_notes

        db.commit()
        db.refresh(finding)
        return finding

    @staticmethod
    def delete_finding(finding_id: str, db: Session) -> bool:
        finding = db.query(Finding).filter(Finding.id == finding_id).first()
        if not finding:
            return False
        db.delete(finding)
        db.commit()
        return True
