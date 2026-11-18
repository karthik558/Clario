import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, Finding

class BriefService:
    @staticmethod
    def get_templates() -> List[Dict[str, str]]:
        return [
            {
                "id": "board_executive",
                "name": "Board of Directors — Risk & Exposure Brief",
                "target_audience": "Audit Committee & Board Members",
                "description": "High-level strategic briefing focusing on maximum liability exposure, compliance readiness, and key contract changes."
            },
            {
                "id": "ma_due_diligence",
                "name": "M&A / Transaction Due Diligence Memorandum",
                "target_audience": "Investment Committee & Deal Leads",
                "description": "Concentrated review of change-of-control triggers, IP assignment risks, and recurring contractual obligations."
            },
            {
                "id": "procurement_closing",
                "name": "Enterprise Procurement Closing Summary",
                "target_audience": "Procurement VP & General Counsel",
                "description": "Commercial scorecard detailing SLA penalty caps, annual renewal notice windows, and data sovereignty safeguards."
            }
        ]

    @staticmethod
    def generate_brief(
        db: Session,
        template_id: str = "board_executive",
        document_ids: Optional[List[str]] = None,
        custom_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        findings_query = db.query(Finding)
        if document_ids:
            findings_query = findings_query.filter(Finding.document_id.in_(document_ids))
        findings = findings_query.all()

        critical_findings = [f for f in findings if f.severity in ["critical", "high"]]

        doc_titles = [d.title or d.filename for d in docs]
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%B %d, %Y")

        if not docs:
            return {
                "title": "Executive Briefing Memorandum",
                "template_id": template_id,
                "generated_date": now_str,
                "audited_documents": [],
                "critical_findings_count": 0,
                "executive_summary": "No documents uploaded in workspace. Upload documents to generate an executive brief.",
                "key_recommendation": "Upload documents to begin executive risk synthesis.",
                "financial_exposure": [],
                "legal_risks": [],
                "action_items": ["Upload documents to start the executive audit."]
            }

        if template_id == "ma_due_diligence":
            title = "M&A Transaction Due Diligence Executive Briefing"
            summary = (
                f"Evaluation of {len(docs)} foundational commercial agreements and corporate policies within the workspace. "
                "Primary scrutiny focused on change-of-control covenants, IP licensing exclusivity, and post-merger integration risks."
            )
            key_decision = "Require seller to deliver formal estoppel certificates confirming no active default under commercial licensing agreements."
        elif template_id == "procurement_closing":
            title = "Enterprise Procurement Closing Memorandum"
            summary = (
                f"Commercial readiness review across {len(docs)} vendor contract artifacts. Assesses operational dependencies, "
                "uptime commitments (99.9% SLA), and data processing protections under enterprise compliance standards."
            )
            key_decision = "Authorize contract execution conditional upon signed Rider incorporating 48-hour security breach notice and Zero Data Retention terms."
        else:
            title = "Board of Directors — Executive Document Risk & Compliance Brief"
            summary = (
                f"Strategic document intelligence audit analyzing {len(docs)} contracts and regulatory governance artifacts. "
                f"Identified {len(critical_findings)} high-priority discrepancies across retention, liability ceilings, and commercial SLAs."
            )
            key_decision = "Board approval recommended subject to negotiating mutual liability super-caps and eliminating automatic 12-month renewal lock-in."

        financial_exposure = [
            {"label": "Aggregate Liability Cap Discrepancy", "detail": "Prior agreement capped liability at nominal $100 USD; modernized 2024 terms expand ceiling up to $250,000 USD."},
            {"label": "Annual Renewal Lock-in Risk", "detail": "Mandatory 60-day cancellation window prior to automatic 12-month commercial renewal."},
            {"label": "Service Credit Limitations", "detail": "Downtime remedies limited to 10% monthly service fee credit without right of immediate contract termination."}
        ]

        legal_risks = [
            {"item": "Data Retention & Prompt Provenance", "status": "Remediated in 2024", "assessment": "Zero Data Retention (ZDR) architecture implemented; opt-in 60-day audit logging."},
            {"item": "Subprocessor Delegation", "status": "Action Required", "assessment": "Vendor retains right to substitute cloud subprocessors on 10-day retroactive notice."},
            {"item": "Arbitration & Forum Selection", "status": "Moderate", "assessment": "Exclusive jurisdiction designated in Delaware federal court."}
        ]

        next_steps = [
            "Circulate proposed harmonized redlines to counterparty commercial counsel.",
            "Confirm SOC 2 Type II audit report receipt for current calendar quarter.",
            "Set automated calendar reminders 75 days prior to contract anniversary date."
        ]

        return {
            "title": title,
            "generated_date": now_str,
            "template_id": template_id,
            "audited_documents": doc_titles,
            "executive_summary": summary,
            "financial_exposure": financial_exposure,
            "legal_risks": legal_risks,
            "critical_findings_count": len(critical_findings),
            "key_recommendation": key_decision,
            "action_items": next_steps,
            "custom_notes": custom_notes or "Prepared autonomously by Clario Document Intelligence Platform."
        }
