import re
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
            findings_query = findings_query.filter(
                (Finding.doc_a_id.in_(document_ids)) | (Finding.doc_b_id.in_(document_ids))
            )
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

        corpus_text = " ".join([c.content for c in chunks])
        if custom_clause:
            corpus_text += " " + custom_clause

        corpus_lower = corpus_text.lower()

        # Legal Persona Evaluation
        legal_red_flags = []
        # Check actual findings first
        for f in findings:
            if any(k in f.title.lower() for k in ["liability", "indemn", "jurisdiction", "copyright", "defense"]):
                legal_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Add mutual liability super-cap and bilateral indemnification covenants."
                })

        # Check domain patterns with regex
        if not legal_red_flags:
            if re.search(r'(?:aggregate|cumulative)\s+liability\s+(?:is\s+)?(?:capped|limited)|sole\s+remedy|waive[sd]?\s+(?:all\s+)?consequential\s+damages|capped\s+at\s+(?:fifty|\$100|nominal)', corpus_lower):
                legal_red_flags.append({
                    "severity": "High",
                    "point": "Asymmetric Liability Ceiling",
                    "detail": "Damages are restricted by unilateral liability caps or exclusive remedy limitations.",
                    "counter_clause": "Add mutual super-cap for confidentiality breaches and set mutual overall liability ceiling to trailing fees."
                })
            if re.search(r'exclusive\s+(?:jurisdiction|venue)\s+(?:shall\s+be|in)|binding\s+arbitration\s+in', corpus_lower):
                legal_red_flags.append({
                    "severity": "Medium",
                    "point": "Disadvantageous Forum Selection",
                    "detail": "Exclusive venue designated in non-neutral territory creating dispute resolution friction.",
                    "counter_clause": "Amend jurisdiction to mutual neutral forum or standard commercial arbitration."
                })
            if re.search(r'unilateral(?:ly)?\s+modify|update\s+(?:these\s+)?terms\s+without\s+notice|sole\s+discretion\s+to\s+amend', corpus_lower):
                legal_red_flags.append({
                    "severity": "High",
                    "point": "Unilateral Modification Clause",
                    "detail": "Agreement permits counterparty to update terms or acceptable use policies without affirmative consent.",
                    "counter_clause": "Require 30 days prior written notice and express customer termination right without penalty."
                })

        # Financial Persona Evaluation
        finance_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["renewal", "fee", "price", "financial", "payment"]):
                finance_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Eliminate auto-renewal lock-in and cap annual price escalation."
                })

        if not finance_red_flags:
            if re.search(r'auto(?:matic)?(?:ally)?\s+renew|renewal\s+for\s+(?:an\s+additional|\d+)\s+(?:months?|year)|prior\s+notice\s+of\s+non-renewal', corpus_lower):
                finance_red_flags.append({
                    "severity": "Critical",
                    "point": "Automatic Annual Renewal Lock-in",
                    "detail": "Agreement auto-renews for successor multi-month periods unless formal non-renewal notice is delivered.",
                    "counter_clause": "Require affirmative opt-in renewal notice or reduce non-renewal window to 30 calendar days."
                })
            if re.search(r'price\s+increase|annual\s+escalator|adjust\s+(?:the\s+)?fees?\s+(?:upon|at)|subsequent\s+term\s+pricing', corpus_lower):
                finance_red_flags.append({
                    "severity": "High",
                    "point": "Uncapped Price Escalators Upon Renewal",
                    "detail": "Discretion reserved to adjust standard pricing or fees upon successive terms.",
                    "counter_clause": "Cap annual renewal price increases to the lesser of 3% or CPI (Consumer Price Index)."
                })
            if re.search(r'late\s+(?:payment\s+)?fee|interest\s+at\s+(?:the\s+rate\s+of\s+)?\d+%(?:\s+per\s+month)?|penalty\s+for\s+late\s+payment', corpus_lower):
                finance_red_flags.append({
                    "severity": "Medium",
                    "point": "Aggressive Late Payment Penalties",
                    "detail": "Overdue invoices incur compound interest or immediate suspension of service.",
                    "counter_clause": "Require 15-day formal cure notice prior to late interest accrual or service suspension."
                })

        # CISO Persona Evaluation
        ciso_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["retention", "breach", "telemetry", "incident", "security", "subprocessor"]):
                ciso_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Mandate strict data eradication and 72-hour security incident notification."
                })

        if not ciso_red_flags:
            if re.search(r'(?:model|algorithm)\s+(?:training|retraining)\s+on\s+customer|telemetry\s+retention|prompt\s+(?:data\s+)?retention', corpus_lower):
                ciso_red_flags.append({
                    "severity": "High",
                    "point": "Ambiguous Model Telemetry Retention",
                    "detail": "Customer prompt metadata and interaction telemetry retained without verified deletion schedules.",
                    "counter_clause": "Mandate verifiable Zero Data Retention (ZDR) architecture."
                })
            if re.search(r'sub-?processors?\s+without\s+(?:prior\s+)?(?:notice|consent)|substitute\s+sub-?processors?', corpus_lower):
                ciso_red_flags.append({
                    "severity": "Critical",
                    "point": "Subprocessor Delegation Without Prior Veto",
                    "detail": "Subprocessors may be engaged or substituted without affirmative customer approval.",
                    "counter_clause": "Establish affirmative 30-day prior written notice with customer right to object or terminate."
                })
            if re.search(r'breach\s+notification|security\s+incident\s+(?:reporting|escalation)|notify\s+of\s+(?:any\s+)?security\s+breach', corpus_lower):
                ciso_red_flags.append({
                    "severity": "High",
                    "point": "Security Incident Notification Timeline",
                    "detail": "Security incident notice window is not bound to a strict emergency timeline.",
                    "counter_clause": "Strict contractual requirement for notice within 48 to 72 hours of confirmed security incident."
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
            "High Exposure: Critical Provisions Requiring Immediate Redlining"
            if composite_risk >= 50
            else "Moderate Exposure: Review Identified Provisions Prior to Execution"
            if composite_risk > 0
            else "Balanced Risk Profile: No Severe Red Flags Detected in Analyzed Scope"
        )
        leverage_summary = (
            "Strong bargaining position on pricing escalators and unilateral terms; address identified red flags."
            if composite_risk >= 40
            else "Standard terms with manageable exposure."
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
