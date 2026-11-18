from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk, Finding

class CritiqueService:
    @staticmethod
    def evaluate_corpus(db: Session, document_ids: Optional[List[str]] = None, custom_clause: Optional[str] = None) -> Dict[str, Any]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        findings_query = db.query(Finding)
        if document_ids:
            findings_query = findings_query.filter(Finding.document_id.in_(document_ids))
        findings = findings_query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.all()

        if not chunks and not custom_clause:
            return {
                "evaluated_documents": 0,
                "findings_referenced": 0,
                "composite_risk_score": 0,
                "overall_assessment": "No documents uploaded in workspace. Upload documents to simulate red team review.",
                "leverage_summary": "Upload documents to begin adversarial review.",
                "personas": []
            }

        corpus_text = " ".join([c.content.lower() for c in chunks])
        if custom_clause:
            corpus_text += " " + custom_clause.lower()

        # Legal Persona Evaluation
        legal_red_flags = []
        if any(w in corpus_text for w in ["liability", "capped", "consequential", "indemnif"]):
            legal_red_flags.append({
                "severity": "High",
                "point": "Asymmetric Liability Ceiling",
                "detail": "Customer aggregate damages are capped to trailing fees, whereas customer indemnification obligations remain largely uncapped.",
                "counter_clause": "Add mutual super-cap for IP breaches and strict mutual overall liability ceiling equal to 2x annual contract value."
            })
        if any(w in corpus_text for w in ["governing law", "jurisdiction", "exclusive venue", "arbitration"]):
            legal_red_flags.append({
                "severity": "Medium",
                "point": "Disadvantageous Forum Selection",
                "detail": "Exclusive venue designated in vendor local territory creating high litigation friction.",
                "counter_clause": "Amend jurisdiction to mutual neutral forum or standard AAA commercial arbitration."
            })
        if any(w in corpus_text for w in ["unilateral", "modify", "update terms", "without notice", "discretion"]):
            legal_red_flags.append({
                "severity": "High",
                "point": "Unilateral Modification Clause",
                "detail": "Agreement permits vendor to update documentation and acceptable use policies via web posting without affirmative customer consent.",
                "counter_clause": "Require 30 days prior written notice and express customer termination right without penalty for adverse changes."
            })

        # Financial Persona Evaluation
        finance_red_flags = []
        if any(w in corpus_text for w in ["renewal", "anniversary", "term of agreement", "auto-renew"]):
            finance_red_flags.append({
                "severity": "Critical",
                "point": "Automatic Annual Renewal Lock-in",
                "detail": "Contract auto-renews for 12-month successor periods unless terminated 60 days before anniversary.",
                "counter_clause": "Require affirmative renewal notice or reduce cancellation window to 30 calendar days."
            })
        if any(w in corpus_text for w in ["price", "escalator", "increase", "rate adjustment", "fee"]):
            finance_red_flags.append({
                "severity": "High",
                "point": "Uncapped Price Escalators Upon Renewal",
                "detail": "Vendor reserves discretion to adjust standard list prices upon each contract anniversary.",
                "counter_clause": "Cap annual renewal price increases to the lesser of 3% or CPI (Consumer Price Index)."
            })
        if any(w in corpus_text for w in ["late fee", "interest", "penalty", "net 30", "overdue"]):
            finance_red_flags.append({
                "severity": "Medium",
                "point": "Aggressive Late Payment Penalties",
                "detail": "Interest charged at 1.5% monthly (18% annualized) alongside immediate suspension of API access.",
                "counter_clause": "Require 15-day cure notice before late interest accrual or service suspension."
            })

        # CISO Persona Evaluation
        ciso_red_flags = []
        if any(w in corpus_text for w in ["retention", "zdr", "telemetry", "log", "purge"]):
            ciso_red_flags.append({
                "severity": "High",
                "point": "Ambiguous Model Telemetry Retention",
                "detail": "Telemetry and prompt metadata retention policies lack automated verifiable cryptographic deletion proofs.",
                "counter_clause": "Mandate SOC 2 Type II audit confirmation of Zero Data Retention (ZDR) architecture."
            })
        if any(w in corpus_text for w in ["subprocessor", "third party", "vendor delegation", "contractor"]):
            ciso_red_flags.append({
                "severity": "Critical",
                "point": "Subprocessor Delegation Without Prior Veto",
                "detail": "Vendor may engage secondary AI sub-processors with mere 10-day retroactive notification.",
                "counter_clause": "Establish affirmative 30-day prior written notice with customer right to terminate without penalty if objected."
            })
        if any(w in corpus_text for w in ["breach", "incident", "security event", "72 hours", "notification"]):
            ciso_red_flags.append({
                "severity": "High",
                "point": "Delayed Security Incident Escalation",
                "detail": "Incident notification timeline set to 'without undue delay' rather than strict 72-hour or 48-hour bound.",
                "counter_clause": "Strict contractual requirement for notice within 48 hours of confirmed security incident."
            })

        legal_score = min(100, len(legal_red_flags) * 32)
        finance_score = min(100, len(finance_red_flags) * 32)
        ciso_score = min(100, len(ciso_red_flags) * 32)
        composite_risk = round((legal_score + finance_score + ciso_score) / 3)

        def get_verdict(score: int, high_label: str) -> str:
            if score >= 60:
                return high_label
            elif score > 0:
                return "Caution: Minor Amendments Advised"
            return "Compliant: Low Exposure Detected"

        overall_assessment = (
            "High Exposure: Vendor-Favorable Terms Requiring Immediate Redlining"
            if composite_risk >= 50
            else "Moderate Exposure: Review Key Provisions Prior to Execution"
            if composite_risk > 0
            else "Balanced Risk Profile: No Severe Red Flags Detected"
        )
        leverage_summary = (
            "Strong bargaining position on pricing escalators and sub-processor vetoes; moderate leverage on liability super-caps."
            if composite_risk >= 40
            else "Standard commercial terms with manageable exposure."
        )

        return {
            "evaluated_documents": len(docs),
            "findings_referenced": len(findings),
            "composite_risk_score": composite_risk,
            "overall_assessment": overall_assessment,
            "leverage_summary": leverage_summary,
            "personas": [
                {
                    "persona_id": "general_counsel",
                    "role_title": "General Legal Counsel",
                    "avatar_color": "navy",
                    "verdict": get_verdict(legal_score, "Veto Without Protective Covenants"),
                    "risk_score": legal_score,
                    "focus": "Liability Exposure & Indemnification Asymmetry",
                    "red_flags": legal_red_flags
                },
                {
                    "persona_id": "cfo",
                    "role_title": "Chief Financial Officer (CFO)",
                    "avatar_color": "amber",
                    "verdict": get_verdict(finance_score, "Budget Risk: Escalator Cap Required"),
                    "risk_score": finance_score,
                    "focus": "Auto-Renewal Traps & Hidden Price Hikes",
                    "red_flags": finance_red_flags
                },
                {
                    "persona_id": "ciso",
                    "role_title": "Chief Information Security Officer (CISO)",
                    "avatar_color": "rose",
                    "verdict": get_verdict(ciso_score, "Security Exception: Subprocessor Notice Insufficient"),
                    "risk_score": ciso_score,
                    "focus": "Data Residency, Subprocessors & 48h Breach SLA",
                    "red_flags": ciso_red_flags
                }
            ]
        }
