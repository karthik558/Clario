import re
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk, Finding

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
            findings_query = findings_query.filter(
                (Finding.doc_a_id.in_(document_ids)) | (Finding.doc_b_id.in_(document_ids))
            )
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
                "key_recommendation": "Upload documents in the Document Library to begin executive risk synthesis.",
                "financial_exposure": [],
                "legal_risks": [],
                "action_items": ["Upload documents to start the executive audit."],
                "custom_notes": custom_notes or "Workspace currently empty."
            }

        # Gather chunks to analyze actual content
        doc_ids = [d.id for d in docs]
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).order_by(DocumentChunk.chunk_index).all()
        corpus_text = "\n".join([c.content for c in chunks])
        corpus_lower = corpus_text.lower()

        # Detect domain characteristics
        is_financial = any(w in corpus_lower for w in [
            "capex", "opex", "budget", "lakhs", "crores", "expenditure", "rate | budget", "quantity | rate", "spent + committed"
        ])
        is_contract = any(w in corpus_lower for w in [
            "indemnif", "liability", "governing law", "termination for convenience", "breach", "intellectual property", "warranties"
        ])
        is_privacy = any(w in corpus_lower for w in [
            "gdpr", "hipaa", "data protection", "subprocessor", "personal data", "telemetry"
        ])

        # Detect prominent entity names if present
        entity_name = ""
        for line in corpus_text.splitlines()[:15]:
            if any(k in line.lower() for k in ["limited", "corp", "inc", "ltd", "company", "ihcl", "hotel", "technologies"]):
                clean_line = re.sub(r'^[#| \-:]+', '', line).split('|')[0].strip()
                if len(clean_line) > 3 and len(clean_line) < 80:
                    entity_name = clean_line
                    break

        doc_lead = doc_titles[0]
        if len(doc_titles) > 1:
            doc_context = f"{doc_lead} and {len(doc_titles) - 1} other document(s)"
        else:
            doc_context = doc_lead

        # Titles and summaries per template and domain
        if template_id == "ma_due_diligence":
            title = f"M&A Due Diligence Memorandum — {doc_lead}"
            if is_financial:
                summary = (
                    f"Transaction due diligence audit covering {len(docs)} document(s) ({doc_context}). "
                    f"Analyzed capital asset inventory, planned Capex commitments, and operational replacement budgets "
                    f"{f'for {entity_name}' if entity_name else ''} to quantify balance sheet impact."
                )
                key_decision = (
                    "Reconcile proposed Capex allocations against historical run-rates and ensure capital commitments "
                    "are formal conditions in transaction asset adjustment schedules."
                )
            elif is_contract:
                summary = (
                    f"Legal due diligence review across {len(docs)} commercial agreement(s). "
                    "Evaluated change-of-control covenants, exclusivity restrictions, and potential liabilities."
                )
                key_decision = (
                    "Require seller to deliver formal estoppel certificates confirming no active material default "
                    "under identified commercial covenants."
                )
            else:
                summary = f"Due diligence analysis across {len(docs)} document(s) in active workspace ({doc_context})."
                key_decision = "Complete document verification against target governance checklists."

        elif template_id == "procurement_closing":
            title = f"Procurement & Vendor Closing Memorandum — {doc_lead}"
            if is_financial:
                summary = (
                    f"Commercial procurement assessment of {doc_context}. "
                    "Itemizes requisition quantities, unit rates, and replacement allocations across operational departments."
                )
                key_decision = (
                    "Authorize purchase order execution conditional upon verified multi-vendor quotation benchmarks "
                    "and departmental controller sign-offs."
                )
            elif is_contract:
                summary = (
                    f"Commercial readiness review across {len(docs)} vendor contract artifact(s). "
                    "Assesses service level commitments, payment schedules, and performance indemnities."
                )
                key_decision = "Authorize contract execution conditional upon signed commercial rider incorporating agreed service levels."
            else:
                summary = f"Procurement closing summary evaluating {len(docs)} document(s) in active workspace."
                key_decision = "Approve vendor documentation subject to final commercial review."

        else: # board_executive
            title = f"Board of Directors — Strategic Risk & Governance Brief ({doc_lead})"
            if is_financial:
                summary = (
                    f"Executive financial and operational intelligence brief analyzing {doc_context}. "
                    f"Synthesizes capital budget allocations, hardware and asset lifecycle requirements "
                    f"{f'at {entity_name}' if entity_name else ''}, and operational continuity considerations."
                )
                key_decision = (
                    "Approve recommended capital expenditure allocations subject to verified vendor quote validation "
                    "and quarterly budget variance monitoring."
                )
            elif is_contract:
                summary = (
                    f"Strategic document intelligence audit analyzing {len(docs)} commercial and regulatory artifact(s). "
                    f"Identified {len(critical_findings)} high-priority discrepancies across commercial terms."
                )
                key_decision = "Board approval recommended subject to negotiating mutual liability caps and verified governance protections."
            else:
                summary = f"Strategic intelligence brief covering {len(docs)} document(s) ({doc_context}) in active workspace."
                key_decision = "Review document scope and adopt recommended procedural controls."

        # Keep evidence separate from the template's recommended next steps.
        titles = {doc.id: doc.title or doc.filename for doc in docs}
        financial_exposure = []
        for label, pattern in [
            ("Liability", r"\b(?:liability|damages)\b"),
            ("Fees and payment", r"\b(?:fees|payments?|budget)\b"),
            ("Renewal and notice", r"\b(?:renewal|renewals|non-renewal)\b"),
        ]:
            for chunk in chunks:
                line = next((line.strip() for line in chunk.content.splitlines()
                             if re.search(pattern, line, re.I)), None)
                if line:
                    financial_exposure.append({
                        "label": label,
                        "detail": f"{titles[chunk.document_id]}, p. {chunk.page_number}: {line[:260]}",
                    })
                    break

        legal_risks = [
            {"item": f.title, "status": f.status.replace("_", " ").title(), "assessment": f.description}
            for f in sorted(findings, key=lambda item: item not in critical_findings)[:3]
        ]

        # Dynamically build Action Items
        if is_financial:
            action_items = [
                f"Obtain competitive vendor quotes for the expenditure line items in {doc_lead}.",
                "Validate capital budget allocations against annual operating plans and finance committee ceilings.",
                "Ensure final purchase orders reflect approved unit rates and standard delivery warranties."
            ]
        elif is_contract:
            action_items = [
                "Circulate proposed harmonized redlines to counterparty commercial counsel.",
                "Confirm contractual notice milestones and calendar renewal deadlines.",
                "Archive countersigned final executed agreement in the document repository."
            ]
        else:
            action_items = [
                f"Verify key provisions and metrics extracted from {doc_lead}.",
                "Review scope alignment across related enterprise operating documents.",
                "Archive audit record in Clario document repository."
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
            "action_items": action_items,
            "custom_notes": custom_notes or f"Generated autonomously by Clario from {len(docs)} verified document(s)."
        }
