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

            # Liability
            if any(k in text_lower for k in ["limitation of liability", "aggregate liability", "cumulative liability", "consequential damages", "capped at $", "capped at nominal"]):
                favorability = "Vendor Favorable" if "aggregate cumulative liability" in text_lower or "$100" in text_lower else "Balanced"
                categorized_clauses["Limitation of Liability"].append({
                    "id": f"cls-{chunk.id}",
                    "document_title": doc_map.get(chunk.document_id, "Document"),
                    "page_number": chunk.page_number or 1,
                    "text": text[:280].strip() + "...",
                    "favorability": favorability,
                    "deviation_from_market": "High" if favorability == "Vendor Favorable" else "Standard"
                })

            # Indemnification
            if any(k in text_lower for k in ["indemnification", "indemnify and hold", "defend and hold harmless"]):
                favorability = "Customer Favorable" if "mutual indemn" in text_lower or "copyright shield" in text_lower else "Vendor Favorable"
                categorized_clauses["Indemnification"].append({
                    "id": f"cls-{chunk.id}",
                    "document_title": doc_map.get(chunk.document_id, "Document"),
                    "page_number": chunk.page_number or 1,
                    "text": text[:280].strip() + "...",
                    "favorability": favorability,
                    "deviation_from_market": "Standard" if favorability == "Customer Favorable" else "High"
                })

            # Data Retention
            if any(k in text_lower for k in ["data retention", "retention of customer data", "zero data retention", "zdr", "purge customer data", "telemetry retention", "model training on customer data"]):
                favorability = "Customer Favorable" if "zero data retention" in text_lower or "opt in" in text_lower else "Vendor Favorable"
                categorized_clauses["Data Retention & Telemetry"].append({
                    "id": f"cls-{chunk.id}",
                    "document_title": doc_map.get(chunk.document_id, "Document"),
                    "page_number": chunk.page_number or 1,
                    "text": text[:280].strip() + "...",
                    "favorability": favorability,
                    "deviation_from_market": "Moderate" if favorability == "Vendor Favorable" else "Compliant"
                })

            # Termination
            if any(k in text_lower for k in ["termination for convenience", "terminate without cause", "prior written notice of termination", "cure period of \d+"]):
                favorability = "Balanced"
                categorized_clauses["Termination for Convenience"].append({
                    "id": f"cls-{chunk.id}",
                    "document_title": doc_map.get(chunk.document_id, "Document"),
                    "page_number": chunk.page_number or 1,
                    "text": text[:280].strip() + "...",
                    "favorability": favorability,
                    "deviation_from_market": "Standard"
                })

            # Governing Law
            if any(k in text_lower for k in ["governing law", "exclusive venue", "jurisdiction of the state", "arbitration rules"]):
                favorability = "Balanced"
                categorized_clauses["Governing Law & Venue"].append({
                    "id": f"cls-{chunk.id}",
                    "document_title": doc_map.get(chunk.document_id, "Document"),
                    "page_number": chunk.page_number or 1,
                    "text": text[:280].strip() + "...",
                    "favorability": favorability,
                    "deviation_from_market": "Standard"
                })

        # Assemble library
        library = []
        for b in BENCHMARKS:
            detected = categorized_clauses.get(b["category"], [])
            library.append({
                "category": b["category"],
                "market_standard": b["market_standard"],
                "common_pitfall": b["common_pitfall"],
                "risk_weight": b["risk_weight"],
                "detected_count": len(detected),
                "clauses": detected[:5]
            })

        return {
            "total_documents": len(docs),
            "total_categories": len(BENCHMARKS),
            "benchmarks": library
        }

    @staticmethod
    def analyze_clause(clause_text: str) -> Dict[str, Any]:
        text_lower = clause_text.lower()
        if "vendor shall not be liable" in text_lower or "capped at 100" in text_lower or "as is" in text_lower:
            stance = "Vendor Favorable (High Risk for Customer)"
            score = 35
            recommendation = "Reject unilateral limit; propose mutual 12-month trailing fee ceiling with standard carve-outs."
        elif "zero data retention" in text_lower or "sole discretion" in text_lower or "mutual indemnity" in text_lower:
            stance = "Customer Protective (Standard Enterprise)"
            score = 88
            recommendation = "Balanced clause aligned with leading Fortune 500 procurement benchmarks."
        else:
            stance = "Balanced Commercial Standard"
            score = 72
            recommendation = "Verify carve-out definitions for gross negligence, willful misconduct, and breach of confidentiality."

        return {
            "favorability": stance,
            "alignment_score": score,
            "recommendation": recommendation,
            "word_count": len(clause_text.split()),
            "key_phrases": [w for w in ["indemnification", "liability", "warranty", "retention", "termination", "super-cap"] if w in text_lower]
        }
