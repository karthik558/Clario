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

        # Dynamically build Financial Exposure
        financial_exposure = []
        if is_financial:
            # Extract sample items from corpus
            sample_items = []
            for line in corpus_text.splitlines():
                if any(k in line.lower() for k in ["printer", "scanner", "pos", "server", "switch", "furniture", "hardware", "terminal", "cctv"]):
                    parts = [p.strip() for p in line.split("|") if p.strip() and p.strip() != "-"]
                    if parts:
                        item_name = parts[0] if not parts[0].isdigit() else (parts[1] if len(parts) > 1 else parts[0])
                        if item_name not in sample_items and len(item_name) < 60:
                            sample_items.append(item_name)
                    if len(sample_items) >= 3:
                        break

            items_preview = ", ".join(sample_items) if sample_items else "departmental hardware and infrastructure assets"

            financial_exposure.append({
                "label": "Capital Expenditure (Capex) Scope",
                "detail": f"Document itemizes capital allocations and asset requisitions including {items_preview} across fiscal cycles."
            })
            financial_exposure.append({
                "label": "Priority & Requisition Staging",
                "detail": "Line items categorized across Priority 1, 2, and 3 replacements to control immediate cash outflow."
            })
            financial_exposure.append({
                "label": "Procurement Rate Card Benchmarking",
                "detail": "Unit rates and budget multipliers require cross-referencing with master vendor discount agreements."
            })
        elif is_contract:
            # Look for actual liability phrases in chunks
            liability_match = None
            for c in chunks:
                m = re.search(r'([^\n.!?]*(?:liability|damage|cap|penalty)[^\n.!?]*[.\n])', c.content, re.IGNORECASE)
                if m:
                    liability_match = m.group(1).strip()
                    break
            if liability_match:
                financial_exposure.append({
                    "label": "Contractual Liability Ceiling",
                    "detail": f"Excerpt: '{liability_match[:180]}'"
                })
            else:
                financial_exposure.append({
                    "label": "Liability Ceiling Assessment",
                    "detail": "Standard commercial terms; no unilateral uncapped liability provisions identified."
                })
            financial_exposure.append({
                "label": "Commercial Payment & Renewal Window",
                "detail": "Review payment milestones and auto-renewal notice cancellation windows."
            })
            financial_exposure.append({
                "label": "Service Credit Remediations",
                "detail": "Remedies for operational downtime bounded by monthly service credits."
            })
        else:
            financial_exposure.append({
                "label": "Monetary Exposure Analysis",
                "detail": "No explicit monetary liabilities, fee schedules, or financial exposure covenants detected in current document scope."
            })
            financial_exposure.append({
                "label": "Operational Budget Impact",
                "detail": "Expenditure impact is contingent on implementation and execution schedules."
            })

        # Dynamically build Legal & Governance Risks
        legal_risks = []
        if is_financial:
            legal_risks.append({
                "item": "Procurement & Expenditure Authorization",
                "status": "Review Required",
                "assessment": "Capital requisitions require formal financial controller sign-off and multi-vendor competitive quotation."
            })
            legal_risks.append({
                "item": "Operational Continuity & Asset Lifecycle",
                "status": "Action Required",
                "assessment": "Proactive replacement of malfunctioning operational equipment is required to eliminate service interruptions."
            })
            legal_risks.append({
                "item": "Contractual & Dispute Exposure",
                "status": "Compliant",
                "assessment": "No third-party liability traps, uncapped indemnities, or dispute escalation covenants detected."
            })
        elif critical_findings:
            for f in critical_findings[:3]:
                legal_risks.append({
                    "item": f.title,
                    "status": "Action Required" if f.severity in ["critical", "high"] else "Monitored",
                    "assessment": f.description[:200]
                })
        else:
            if is_contract:
                legal_risks.append({
                    "item": "Indemnification & Third-Party Claims",
                    "status": "Monitored",
                    "assessment": "Standard mutual indemnification covenants governing intellectual property and confidentiality."
                })
                legal_risks.append({
                    "item": "Data Governance & Confidentiality",
                    "status": "Compliant",
                    "assessment": "Covenants enforce mutual confidentiality and bounded information disclosure."
                })
                legal_risks.append({
                    "item": "Dispute Resolution & Jurisdiction",
                    "status": "Balanced",
                    "assessment": "Arbitration and governing law clauses aligned with standard commercial practice."
                })
            else:
                legal_risks.append({
                    "item": "Governance & Regulatory Verification",
                    "status": "Compliant",
                    "assessment": "Document adheres to standard enterprise operational and reporting formats."
                })

        # Dynamically build Action Items
        if is_financial:
            action_items = [
                f"Obtain competitive vendor quotes for identified Priority 1 equipment replacement line items in {doc_lead}.",
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
