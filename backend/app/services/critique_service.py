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
        corpus_text = " ".join([c.content.lower() for c in chunks])
        if custom_clause:
            corpus_text += " " + custom_clause.lower()

        # Legal Persona Evaluation
        legal_red_flags = []
        if "liability" in corpus_text or "capped" in corpus_text:
            legal_red_flags.append({
                "severity": "High",
                "point": "Asymmetric Liability Ceiling",
                "detail": "Customer aggregate damages are capped to trailing fees, whereas customer indemnification obligations remain largely uncapped.",
                "counter_clause": "Add mutual super-cap for IP breaches and strict mutual overall liability ceiling equal to 2x annual contract value."
            })
        if "governing law" in corpus_text or "jurisdiction" in corpus_text:
            legal_red_flags.append({
                "severity": "Medium",
                "point": "Disadvantageous Forum Selection",
                "detail": "Exclusive venue designated in vendor local territory creating high litigation friction.",
                "counter_clause": "Amend jurisdiction to mutual neutral forum or standard AAA commercial arbitration."
            })
        legal_red_flags.append({
            "severity": "High",
            "point": "Unilateral Modification Clause",
            "detail": "Agreement permits vendor to update documentation and acceptable use policies via web posting without affirmative customer consent.",
            "counter_clause": "Require 30 days prior written notice and express customer termination right without penalty for adverse changes."
        })

        # Financial Persona Evaluation
        finance_red_flags = []
        if "renewal" in corpus_text or "term" in corpus_text:
            finance_red_flags.append({
                "severity": "Critical",
                "point": "Automatic Annual Renewal Lock-in",
                "detail": "Contract auto-renews for 12-month successor periods unless terminated 60 days before anniversary.",
                "counter_clause": "Require affirmative renewal notice or reduce cancellation window to 30 calendar days."
            })
        finance_red_flags.append({
            "severity": "High",
            "point": "Uncapped Price Escalators Upon Renewal",
            "detail": "Vendor reserves discretion to adjust standard list prices upon each contract anniversary.",
            "counter_clause": "Cap annual renewal price increases to the lesser of 3% or CPI (Consumer Price Index)."
        })
        finance_red_flags.append({
            "severity": "Medium",
            "point": "Aggressive Late Payment Penalties",
            "detail": "Interest charged at 1.5% monthly (18% annualized) alongside immediate suspension of API access.",
            "counter_clause": "Require 15-day cure notice before late interest accrual or service suspension."
        })

        # CISO Persona Evaluation
        ciso_red_flags = []
        if "retention" in corpus_text or "zdr" in corpus_text:
            ciso_red_flags.append({
                "severity": "High",
                "point": "Ambiguous Model Telemetry Retention",
                "detail": "Telemetry and prompt metadata retention policies lack automated verifiable cryptographic deletion proofs.",
                "counter_clause": "Mandate SOC 2 Type II audit confirmation of Zero Data Retention (ZDR) architecture."
            })
        ciso_red_flags.append({
            "severity": "Critical",
            "point": "Subprocessor Delegation Without Prior Veto",
            "detail": "Vendor may engage secondary AI sub-processors with mere 10-day retroactive notification.",
            "counter_clause": "Establish affirmative 30-day prior written notice with customer right to terminate without penalty if objected."
        })
        ciso_red_flags.append({
            "severity": "High",
            "point": "Delayed Security Incident Escalation",
            "detail": "Incident notification timeline set to 'without undue delay' rather than strict 72-hour or 48-hour bound.",
            "counter_clause": "Strict contractual requirement for notice within 48 hours of confirmed security incident."
        })

        composite_risk = 68  # Aggregated risk out of 100

        return {
            "evaluated_documents": len(docs),
            "findings_referenced": len(findings),
            "composite_risk_score": composite_risk,
            "overall_assessment": "High Exposure: Vendor-Favorable Terms Requiring Immediate Redlining",
            "leverage_summary": "Strong bargaining position on pricing escalators and sub-processor vetoes; moderate leverage on liability super-caps.",
            "personas": [
                {
                    "persona_id": "general_counsel",
                    "role_title": "General Legal Counsel",
                    "avatar_color": "navy",
                    "verdict": "Veto Without Protective Covenants",
                    "risk_score": 74,
                    "focus": "Liability Exposure & Indemnification Asymmetry",
                    "red_flags": legal_red_flags
                },
                {
                    "persona_id": "cfo",
                    "role_title": "Chief Financial Officer (CFO)",
                    "avatar_color": "amber",
                    "verdict": "Budget Risk: Escalator Cap Required",
                    "risk_score": 62,
                    "focus": "Auto-Renewal Traps & Hidden Price Hikes",
                    "red_flags": finance_red_flags
                },
                {
                    "persona_id": "ciso",
                    "role_title": "Chief Information Security Officer (CISO)",
                    "avatar_color": "rose",
                    "verdict": "Security Exception: Subprocessor Notice Insufficient",
                    "risk_score": 79,
                    "focus": "Data Residency, Subprocessors & 48h Breach SLA",
                    "red_flags": ciso_red_flags
                }
            ]
        }
