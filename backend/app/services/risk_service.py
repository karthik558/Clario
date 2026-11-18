import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk

RISK_PILLARS = [
    {
        "id": "privacy_retention",
        "name": "Data Privacy & AI Retention",
        "weight": 0.20,
        "indicators_protective": [
            (r'\bzero\s+data\s+retention\b', 30, "Zero Data Retention (ZDR) in volatile memory guaranteed."),
            (r'\bno\s+customer\s+data\s+training\b|\bwill\s+not\s+train\b|\bnot\s+used\s+to\s+train\b', 25, "Express warranty prohibiting training AI models on Customer data."),
            (r'\bcustomer-managed\s+encryption\s+keys?\b|\bcmek\b', 20, "Support for Customer-Managed Encryption Keys (CMEK)."),
            (r'\b30\s+days?\s+prior\s+written\s+notice\b.*\bsubprocessor\b|\bsubprocessors?\b.*\b30\s+days?\b', 15, "30-day prior notice required before onboarding new subprocessors with veto right."),
            (r'\bhipaa\b|\bbaa\b|\bbusiness\s+associate\s+agreement\b', 10, "HIPAA Business Associate Agreement (BAA) execution supported.")
        ],
        "indicators_vendor_favorable": [
            (r'\b30\s+days?\s+abuse\s+monitoring\b|\bretained\s+for\s+30\s+days\b', -15, "30-day default retention window for abuse and misuse review."),
            (r'\b15\s+days?\b.*\bsubprocessor\b', -10, "Short 15-day subprocessor notice window via electronic subscription.")
        ]
    },
    {
        "id": "termination_lockin",
        "name": "Termination & Auto-Renewal Lock-In",
        "weight": 0.15,
        "indicators_protective": [
            (r'\bconvenience\b.*\b30\s+days\b|\b30\s+calendar\s+days\b.*\bconvenience\b', 35, "30-day termination for convenience without early penalty."),
            (r'\bnon-automatic\s+renewal\b|\bexplicit\s+written\s+agreement\b', 35, "Non-automatic renewal; requires affirmative written agreement."),
            (r'\b(lesser\s+of\s+3%|capped\s+at\s+3%|cpi)\b', 30, "Renewal fee escalation capped to the lesser of 3% or annual CPI.")
        ],
        "indicators_vendor_favorable": [
            (r'\b60\s+calendar\s+days\b.*\bcancellation\b|\b60\s+days\b.*\bcancellation\b', -20, "Strict 60-day advance cancellation window required before term expiration."),
            (r'\bautomatically\s+renew\b|\bauto-renew\b', -15, "Automatic 12-month renewal lock-in unless cancelled prior to deadline."),
            (r'\blist\s+price\b.*\bdiscretion\b|\breserves\s+discretion\s+to\s+adjust\b', -15, "Vendor reserves discretion to adjust pricing to standard list price on renewal.")
        ]
    },
    {
        "id": "ip_indemnity",
        "name": "IP Ownership & Copyright Defense",
        "weight": 0.20,
        "indicators_protective": [
            (r'\bcustomer\s+owns\s+all\s+inputs?\s+and\s+outputs?\b|\bexclusive\s+property\s+of\s+customer\b', 40, "Customer retains sole exclusive ownership of all Inputs and Outputs."),
            (r'\bcopyright\s+shield\b|\bdefense\s+of\s+third-party\s+infringement\b|\bindemnify.*infringement\b', 35, "Comprehensive intellectual property infringement defense and hold-harmless."),
            (r'\buncapped\s+ip\s+indemnification\b|\bno\s+dollar\s+limitation\b.*\bindemnity\b', 25, "Uncapped defense coverage for third-party copyright claims.")
        ],
        "indicators_vendor_favorable": [
            (r'\bexcluding\s+intentional\s+prompting\b|\brequires\s+commercial\s+tier\b', -10, "Copyright defense conditioned on strict prompt guardrail adherence."),
            (r'\bas-is\b.*\bwithout\s+warranty\b', -15, "Disclaimers regarding non-infringement of outputs.")
        ]
    },
    {
        "id": "sla_incident",
        "name": "SLA & Incident Response",
        "weight": 0.15,
        "indicators_protective": [
            (r'\b48\s+hours?\b.*\b(?:security\s+incident|breach|notification)\b', 40, "Rapid 48-hour security breach preliminary alert commitment."),
            (r'\b99\.9%|\b99\.95%\b|\b99\.99%\b', 30, "Strict 99.9%+ monthly availability uptime commitment."),
            (r'\bservice\s+credit\b|\bfee\s+credit\b', 30, "Direct contract service credits for downtime threshold failures.")
        ],
        "indicators_vendor_favorable": [
            (r'\b72\s+hours?\b.*\b(?:security|breach|compromise)\b', -10, "Extended 72-hour notification window post-confirmed compromise."),
            (r'\bsole\s+and\s+exclusive\s+remedy\b.*\bservice\s+credit\b', -10, "Service credits designated as sole and exclusive remedy for outages.")
        ]
    },
    {
        "id": "liability_cap",
        "name": "Liability Super-Caps & Damages",
        "weight": 0.15,
        "indicators_protective": [
            (r'\$500,000|\b500k\b|2x\s+annual\s+contract\s+value', 45, "Elevated $500,000 USD / 2x ACV super-cap for confidentiality and data breach."),
            (r'\bunlimited\s+liability\b.*\bwillful\s+misconduct\b|\bgross\s+negligence\b', 35, "Uncapped liability for gross negligence, willful misconduct, and confidentiality breaches."),
            (r'\bmutual\s+waiver\b.*\bindirect\b', 20, "Bilateral mutual waiver of consequential and indirect damages.")
        ],
        "indicators_vendor_favorable": [
            (r'\$250,000|\b250k\b|12\s+months\s+fees', -15, "Low $250,000 USD / 12-month fee cap for data security incidents."),
            (r'\bdisclaimer\s+of\s+loss\s+of\s+data\b', -15, "Vendor disclaims liability for loss of data or goodwill.")
        ]
    },
    {
        "id": "regulatory_safety",
        "name": "Regulatory & Frontier Safety",
        "weight": 0.15,
        "indicators_protective": [
            (r'\beu\s+ai\s+act\b.*\b(article\s+9|high-risk|conformity)\b', 35, "EU AI Act compliance with technical documentation and CE marking alignment."),
            (r'\bsoc\s+2\s+type\s+ii\b|\biso\s+27001\b', 35, "Mandatory annual SOC 2 Type II audit attestation and certification."),
            (r'\bresponsible\s+scaling\s+policy\b|\brsp\b|\basl-3\b|\bfrontier\s+safety\s+framework\b|\bfsf\b', 30, "Formalized Frontier AI safety framework (ASL-3/FSF) threat evaluations.")
        ],
        "indicators_vendor_favorable": [
            (r'\bsole\s+discretion\s+to\s+suspend\b', -15, "Vendor retains sole discretion to suspend model access for safety triggers.")
        ]
    }
]

class RiskService:
    @staticmethod
    def _evaluate_text_for_pillar(text: str, pillar_def: Dict[str, Any]) -> Dict[str, Any]:
        score = 50  # Baseline neutral
        findings = []

        # Positive / Customer-Protective Indicators
        for pattern, points, desc in pillar_def["indicators_protective"]:
            if re.search(pattern, text, re.IGNORECASE):
                score += points
                findings.append({"type": "protective", "text": desc})

        # Negative / Vendor-Favorable Indicators
        for pattern, points, desc in pillar_def["indicators_vendor_favorable"]:
            if re.search(pattern, text, re.IGNORECASE):
                score += points
                findings.append({"type": "risk", "text": desc})

        score = max(10, min(98, score))

        if score >= 80:
            level = "Low Risk (Customer Protective)"
            grade = "A"
            rec = "Favorable terms aligned with enterprise risk governance."
        elif score >= 65:
            level = "Moderate Risk (Balanced)"
            grade = "B"
            rec = "Standard commercial baseline; recommend minor alignment on notice terms."
        elif score >= 50:
            level = "Elevated Risk (Vendor Favorable)"
            grade = "C"
            rec = "Vendor-favorable bias; redline notice windows and liability caps."
        else:
            level = "Critical Risk (High Exposure)"
            grade = "D"
            rec = "Significant legal exposure. Immediate redline and escalation required."

        return {
            "id": pillar_def["id"],
            "name": pillar_def["name"],
            "weight": pillar_def["weight"],
            "score": score,
            "grade": grade,
            "risk_level": level,
            "findings": findings,
            "recommendation": rec
        }

    @classmethod
    def evaluate_document(cls, doc: Document, db: Session) -> Dict[str, Any]:
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
        corpus = " ".join([c.content for c in chunks])

        pillar_evals = []
        weighted_score = 0.0

        for p_def in RISK_PILLARS:
            res = cls._evaluate_text_for_pillar(corpus, p_def)
            pillar_evals.append(res)
            weighted_score += res["score"] * p_def["weight"]

        composite_score = int(round(weighted_score))

        if composite_score >= 82:
            composite_grade = "A (Low Risk / Customer Protective)"
        elif composite_score >= 68:
            composite_grade = "B (Moderate Risk / Industry Standard)"
        elif composite_score >= 52:
            composite_grade = "C (Elevated Risk / Vendor Favorable)"
        else:
            composite_grade = "D (Critical Risk / High Exposure)"

        # Sort pillars by score
        sorted_pillars = sorted(pillar_evals, key=lambda x: x["score"])
        highest_risk = sorted_pillars[0]
        strongest = sorted_pillars[-1]

        return {
            "document_id": doc.id,
            "document_title": doc.title,
            "composite_score": composite_score,
            "composite_grade": composite_grade,
            "pillars": pillar_evals,
            "highest_risk_area": {
                "name": highest_risk["name"],
                "score": highest_risk["score"],
                "level": highest_risk["risk_level"],
                "recommendation": highest_risk["recommendation"]
            },
            "strongest_protection": {
                "name": strongest["name"],
                "score": strongest["score"],
                "level": strongest["risk_level"]
            }
        }

    @classmethod
    def evaluate_workspace(cls, db: Session, doc_id: Optional[str] = None) -> Dict[str, Any]:
        if doc_id:
            docs = db.query(Document).filter(Document.id == doc_id).all()
        else:
            docs = db.query(Document).filter(Document.status == "READY").all()

        if not docs:
            return {
                "total_documents": 0,
                "composite_score": 0,
                "composite_grade": "N/A (No Documents)",
                "documents": []
            }

        evals = [cls.evaluate_document(d, db) for d in docs]
        avg_score = int(round(sum(e["composite_score"] for e in evals) / len(evals)))

        return {
            "total_documents": len(docs),
            "composite_score": avg_score,
            "composite_grade": "A (Low Risk)" if avg_score >= 80 else "B (Moderate)" if avg_score >= 65 else "C (Elevated Risk)",
            "documents": evals
        }

    @classmethod
    def compare_documents(cls, doc_a_id: str, doc_b_id: str, db: Session) -> Dict[str, Any]:
        doc_a = db.query(Document).filter(Document.id == doc_a_id).first()
        doc_b = db.query(Document).filter(Document.id == doc_b_id).first()

        if not doc_a or not doc_b:
            return {"error": "One or both documents not found."}

        eval_a = cls.evaluate_document(doc_a, db)
        eval_b = cls.evaluate_document(doc_b, db)

        pillar_diffs = []
        for pa, pb in zip(eval_a["pillars"], eval_b["pillars"]):
            diff = pa["score"] - pb["score"]
            if diff > 5:
                winner = eval_a["document_title"]
                advantage = f"{eval_a['document_title']} has +{diff} higher customer protection."
            elif diff < -5:
                winner = eval_b["document_title"]
                advantage = f"{eval_b['document_title']} has +{-diff} higher customer protection."
            else:
                winner = "Parity / Equivalent"
                advantage = "Both policies exhibit comparable commercial standards."

            pillar_diffs.append({
                "pillar_id": pa["id"],
                "pillar_name": pa["name"],
                "doc_a_score": pa["score"],
                "doc_b_score": pb["score"],
                "winner": winner,
                "advantage": advantage,
                "doc_a_findings": pa["findings"],
                "doc_b_findings": pb["findings"]
            })

        overall_winner = (
            eval_a["document_title"]
            if eval_a["composite_score"] > eval_b["composite_score"]
            else eval_b["document_title"]
            if eval_b["composite_score"] > eval_a["composite_score"]
            else "Equal Overall Score"
        )

        return {
            "doc_a": eval_a,
            "doc_b": eval_b,
            "overall_winner": overall_winner,
            "score_differential": abs(eval_a["composite_score"] - eval_b["composite_score"]),
            "pillar_comparisons": pillar_diffs
        }
