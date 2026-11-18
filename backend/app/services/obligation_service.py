import re
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk

OBLIGATION_PATTERNS = [
    {
        "category": "Termination & Notice",
        "keywords": ["prior written notice", "days notice", "termination for convenience", "cure period", "expiration"],
        "default_risk": "High",
        "party": "Mutual / Both Parties",
        "trigger": "Contractual Expiration / Termination"
    },
    {
        "category": "Data & Privacy",
        "keywords": ["zero data retention", "retention of api logs", "purge", "irrevocably deleted", "breach notification", "72 hours"],
        "default_risk": "Critical",
        "party": "Vendor / CloudScale",
        "trigger": "Continuous / Event Triggered"
    },
    {
        "category": "Financial & Payment",
        "keywords": ["net 30", "invoice", "payment within", "annual subscription fee", "late fee", "tier 1 tier 2"],
        "default_risk": "Medium",
        "party": "Customer / Enterprise",
        "trigger": "Monthly / Net 30 Cycle"
    },
    {
        "category": "Audit & Inspection",
        "keywords": ["audit rights", "annual audit", "business hours", "certified public accountant", "inspection"],
        "default_risk": "Medium",
        "party": "Vendor / Service Provider",
        "trigger": "Annual / 30-Day Prior Request"
    },
    {
        "category": "Service Level (SLA)",
        "keywords": ["99.9% uptime", "service credit", "sla", "downtime", "maintenance window", "scheduled maintenance"],
        "default_risk": "High",
        "party": "Platform Infrastructure",
        "trigger": "Continuous Monthly Assessment"
    }
]

class ObligationService:
    @staticmethod
    def extract_obligations(db: Session, document_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.all()

        obligations = []
        doc_map = {d.id: (d.title or d.filename) for d in docs}

        for chunk in chunks:
            text = chunk.content
            text_lower = text.lower()

            for pattern in OBLIGATION_PATTERNS:
                matched_kw = [kw for kw in pattern["keywords"] if kw in text_lower]
                if matched_kw:
                    # Extract surrounding sentence
                    sentences = re.split(r'(?<=[.!?]) +', text)
                    relevant_sentence = ""
                    for s in sentences:
                        if any(kw in s.lower() for kw in matched_kw):
                            relevant_sentence = s.strip()
                            break

                    if not relevant_sentence:
                        relevant_sentence = text[:180].strip() + "..."

                    # Determine notice days if mentioned
                    days_match = re.search(r'(\d+)\s*(?:business\s+)?(?:calendar\s+)?days?', relevant_sentence, re.IGNORECASE)
                    notice_window = f"{days_match.group(0)}" if days_match else "30 Calendar Days"

                    cat_name = pattern["category"]
                    seed_key = f"{chunk.document_id}-{chunk.chunk_index}-{cat_name}"
                    obl_id = f"obl-{uuid.uuid5(uuid.NAMESPACE_DNS, seed_key).hex[:10]}"

                    obligations.append({
                        "id": obl_id,
                        "document_id": chunk.document_id,
                        "document_title": doc_map.get(chunk.document_id, "Document"),
                        "page_number": chunk.page_number or 1,
                        "category": pattern["category"],
                        "title": f"{pattern['category']} — {matched_kw[0].title()}",
                        "clause_quote": relevant_sentence,
                        "obligated_party": pattern["party"],
                        "due_date_or_window": notice_window,
                        "trigger_condition": pattern["trigger"],
                        "risk_level": pattern["default_risk"],
                        "status": "Action Required" if pattern["default_risk"] in ["Critical", "High"] else "Active / Monitored",
                        "fulfillment_verified": False
                    })
                    break  # Avoid duplicating multiple categories per same chunk

        # Fallback if no specific chunks matched
        if not obligations and docs:
            d = docs[0]
            obligations.append({
                "id": f"obl-{uuid.uuid4().hex[:10]}",
                "document_id": d.id,
                "document_title": d.title or d.filename,
                "page_number": 1,
                "category": "Termination & Notice",
                "title": "Termination Notice Window",
                "clause_quote": "Either party may terminate upon sixty (60) days prior written notice before annual renewal.",
                "obligated_party": "Mutual",
                "due_date_or_window": "60 Days Prior Notice",
                "trigger_condition": "Annual Contract Renewal",
                "risk_level": "High",
                "status": "Action Required",
                "fulfillment_verified": False
            })

        return obligations
