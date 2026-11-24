import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk

BENCHMARKS = [
    {
        "category": "Limitation of Liability",
        "market_standard": "Mutual aggregate liability capped at twelve (12) months trailing fees; super-cap for IP/confidentiality at 2x annual contract value.",
        "common_pitfall": "Unilateral customer cap with uncapped vendor claims or excluding indemnity from the cap.",
        "risk_weight": "Critical"
    },
    {
        "category": "Indemnification",
        "market_standard": "Mutual third-party infringement indemnification with defense, settlement authority, and standard mitigations.",
        "common_pitfall": "Customer indemnifies vendor for all end-user content while vendor disclaims third-party IP defense.",
        "risk_weight": "High"
    },
    {
        "category": "Data Retention & Telemetry",
        "market_standard": "Zero Data Retention (ZDR) default for inference; customer opt-in for 30-day compliance logs with customer-managed keys.",
        "common_pitfall": "Vendor reserves perpetual right to use prompts and generated artifacts for model training.",
        "risk_weight": "Critical"
    },
    {
        "category": "Termination for Convenience",
        "market_standard": "Either party may terminate upon thirty (30) to sixty (60) days prior written notice with pro-rata refund of prepaid fees.",
        "common_pitfall": "No termination for convenience allowed, or full contract balance accelerates upon early termination.",
        "risk_weight": "Medium"
    },
    {
        "category": "Governing Law & Venue",
        "market_standard": "State of Delaware or New York law with exclusive commercial arbitration or mutual neutral federal courts.",
        "common_pitfall": "Mandatory venue in obscure foreign jurisdiction with prevailing-party attorney fee shifting.",
        "risk_weight": "Low"
    }
]

class ClauseService:
    @staticmethod
    def extract_and_benchmark(db: Session, document_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.all()

        if not docs or not chunks:
            return {
                "total_categories": len(BENCHMARKS),
                "total_clauses_extracted": 0,
                "benchmarks": [
                    {
                        "category": b["category"],
                        "market_standard": b["market_standard"],
                        "common_pitfall": b["common_pitfall"],
                        "risk_weight": b["risk_weight"],
                        "detected_count": 0,
                        "clauses": []
                    }
                    for b in BENCHMARKS
                ]
            }

        doc_map = {d.id: (d.title or d.filename) for d in docs}

        categorized_clauses: Dict[str, List[Dict[str, Any]]] = {
            b["category"]: [] for b in BENCHMARKS
        }

        for chunk in chunks:
            text = chunk.content
            text_lower = text.lower()
            doc_title = doc_map.get(chunk.document_id, "Document")
            clean_snip = text[:300].strip() + ("..." if len(text) > 300 else "")

            # Liability
            if any(k in text_lower for k in ["limitation of liability", "aggregate liability", "cumulative liability", "consequential damages", "capped at $", "capped at nominal"]):
                favorability = "Vendor Favorable" if "aggregate cumulative liability" in text_lower or "$100" in text_lower or "shall not be liable" in text_lower else "Balanced"
                categorized_clauses["Limitation of Liability"].append({
                    "id": f"cls-{chunk.id}",
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "page_number": chunk.page_number or 1,
                    "text": clean_snip,
                    "favorability": favorability,
                    "deviation_from_market": "High" if favorability == "Vendor Favorable" else "Standard"
                })

            # Indemnification
            if any(k in text_lower for k in ["indemnification", "indemnify and hold", "defend and hold harmless"]):
                favorability = "Customer Favorable" if "mutual indemn" in text_lower or "copyright shield" in text_lower else "Vendor Favorable"
                categorized_clauses["Indemnification"].append({
                    "id": f"cls-{chunk.id}",
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "page_number": chunk.page_number or 1,
                    "text": clean_snip,
                    "favorability": favorability,
                    "deviation_from_market": "Standard" if favorability == "Customer Favorable" else "High"
                })

            # Data Retention
            if any(k in text_lower for k in ["data retention", "retention of customer data", "zero data retention", "zdr", "purge customer data", "telemetry retention", "model training on customer data"]):
                favorability = "Customer Favorable" if "zero data retention" in text_lower or "opt in" in text_lower or "excluded from training" in text_lower else "Vendor Favorable"
                categorized_clauses["Data Retention & Telemetry"].append({
                    "id": f"cls-{chunk.id}",
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "page_number": chunk.page_number or 1,
                    "text": clean_snip,
                    "favorability": favorability,
                    "deviation_from_market": "Moderate" if favorability == "Vendor Favorable" else "Compliant"
                })

            # Termination
            if any(k in text_lower for k in ["termination for convenience", "terminate without cause", "prior written notice of termination"]) or re.search(r"cure period of \d+", text_lower):
                favorability = "Balanced" if "convenience" in text_lower or "pro-rata" in text_lower else "Vendor Favorable"
                categorized_clauses["Termination for Convenience"].append({
                    "id": f"cls-{chunk.id}",
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "page_number": chunk.page_number or 1,
                    "text": clean_snip,
                    "favorability": favorability,
                    "deviation_from_market": "Standard" if favorability == "Balanced" else "Moderate"
                })

            # Governing Law
            if any(k in text_lower for k in ["governing law", "exclusive venue", "jurisdiction of the state", "arbitration rules"]):
                favorability = "Balanced"
                categorized_clauses["Governing Law & Venue"].append({
                    "id": f"cls-{chunk.id}",
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "page_number": chunk.page_number or 1,
                    "text": clean_snip,
                    "favorability": favorability,
                    "deviation_from_market": "Standard"
                })

        # Assemble library
        library = []
        total_extracted = 0
        for b in BENCHMARKS:
            detected = categorized_clauses.get(b["category"], [])
            total_extracted += len(detected)
            library.append({
                "category": b["category"],
                "market_standard": b["market_standard"],
                "common_pitfall": b["common_pitfall"],
                "risk_weight": b["risk_weight"],
                "detected_count": len(detected),
                "clauses": detected[:8]
            })

        return {
            "total_documents": len(docs),
            "total_categories": len(BENCHMARKS),
            "total_clauses_extracted": total_extracted,
            "benchmarks": library
        }

    @staticmethod
    def analyze_clause(clause_text: str) -> Dict[str, Any]:
        text_lower = clause_text.lower()
        risk_signals = [
            ("uncapped customer" in text_lower or "unlimited liability" in text_lower, "Unlimited liability exposure detected.", -25),
            ("vendor shall not be liable" in text_lower or "in no event shall provider" in text_lower or "capped at $100" in text_lower or "capped at 100" in text_lower, "Severely asymmetric or nominal vendor liability cap.", -30),
            ("as is" in text_lower or "disclaims all warranties" in text_lower, "Broad warranty disclaimer removes baseline fitness guarantees.", -15),
            ("train" in text_lower and ("model" in text_lower or "ai" in text_lower) and "not" not in text_lower and "never" not in text_lower and "excluded" not in text_lower, "Potential right for vendor to use customer data for AI model training.", -25),
            ("auto-renew" in text_lower or "automatically renew" in text_lower, "Auto-renewal lock-in detected; verify notice cutoff window.", -10),
            ("unilateral" in text_lower or "modify at any time" in text_lower, "Unilateral modification right creates commercial unpredictability.", -20),
        ]
        protective_signals = [
            ("zero data retention" in text_lower or "zdr" in text_lower or "excluded from training" in text_lower or "never be used to train" in text_lower, "Strong AI data privacy & zero-retention protection.", +18),
            ("mutual" in text_lower and ("indemn" in text_lower or "liability" in text_lower), "Bilateral risk allocation aligned with market norms.", +15),
            ("12 months" in text_lower or "twelve (12) months" in text_lower or "twelve months" in text_lower, "Standard 12-month trailing fee cap.", +12),
            ("48 hours" in text_lower or "24 hours" in text_lower or "72 hours" in text_lower, "Explicit incident notification SLA timeline.", +10),
            ("pro-rata refund" in text_lower or "termination for convenience" in text_lower, "Customer exit flexibility with prepaid fee recovery.", +10),
            ("soc 2" in text_lower or "gdpr" in text_lower or "iso 27001" in text_lower, "Recognized security/regulatory compliance commitment.", +8),
        ]

        score = 68
        notes = []
        for hit, msg, delta in risk_signals:
            if hit:
                score += delta
                notes.append(msg)
        for hit, msg, delta in protective_signals:
            if hit:
                score += delta
                notes.append(msg)

        score = max(15, min(98, score))

        if score < 50:
            stance = "Vendor Favorable (High Risk for Customer)"
            default_rec = "Reject unilateral terms; propose mutual 12-month trailing fee ceiling, explicit breach SLA, and bilateral indemnification."
        elif score >= 80:
            stance = "Customer Protective (Enterprise Standard)"
            default_rec = "Strong clause aligned with Fortune 500 procurement benchmarks. Safe to accept with standard audit verification."
        else:
            stance = "Balanced Commercial Standard"
            default_rec = "Acceptable baseline, but verify carve-outs for gross negligence, confidentiality breaches, and termination notice."

        recommendation = f"{' '.join(notes[:2])} {default_rec}".strip()

        return {
            "favorability": stance,
            "alignment_score": score,
            "recommendation": recommendation,
            "word_count": len(clause_text.split()),
            "key_phrases": [w for w in ["indemnification", "liability", "warranty", "retention", "termination", "super-cap", "sla", "gdpr", "renewal"] if w in text_lower]
        }
