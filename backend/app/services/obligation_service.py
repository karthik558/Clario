import re
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk

OBLIGATION_PATTERNS = [
    {
        "category": "Termination & Notice",
        "keywords": ["prior written notice", "days notice", "termination for convenience", "cure period", "notice of termination", "expiration of the term"],
        "default_risk": "High",
        "default_party": "Mutual / Both Parties",
        "trigger": "Prior to Contract Expiration / Renewal Window"
    },
    {
        "category": "Data & Privacy",
        "keywords": ["zero data retention", "data retention", "retention of customer data", "breach notification", "security incident", "irrevocably deleted", "purge data"],
        "default_risk": "Critical",
        "default_party": "Vendor / Data Processor",
        "trigger": "Upon Security Incident or Continuous Processing"
    },
    {
        "category": "Financial & Payment",
        "keywords": ["net 30", "net 60", "invoice payment", "payment within", "annual subscription fee", "late payment interest", "capex allocation"],
        "default_risk": "Medium",
        "default_party": "Customer / Contracting Entity",
        "trigger": "Upon Invoice Issuance / Fiscal Cycle"
    },
    {
        "category": "Audit & Inspection",
        "keywords": ["audit rights", "annual audit", "inspection of books", "certified public accountant", "inspection rights"],
        "default_risk": "Medium",
        "default_party": "Service Provider / Audited Party",
        "trigger": "Upon Formal Prior Request / Annual Schedule"
    },
    {
        "category": "Service Level (SLA)",
        "keywords": ["uptime commitment", "service level agreement", "service credit", "sla penalty", "scheduled maintenance window"],
        "default_risk": "High",
        "default_party": "Service Provider",
        "trigger": "Continuous Monthly Assessment"
    }
]

# Obligation commitment indicators
COMMITMENT_INDICATORS = [
    "shall", "must", "agrees to", "agreed to", "covenants to", "required to",
    "solely responsible for", "obligated to", "will ensure", "undertakes to",
    "notice of", "payment within", "prior written notice", "within", "cure period"
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
        if not docs or not chunks:
            return []

        obligations = []
        doc_map = {d.id: (d.title or d.filename) for d in docs}

        for chunk in chunks:
            text = chunk.content
            text_lower = text.lower()

            for pattern in OBLIGATION_PATTERNS:
                matched_kw = [kw for kw in pattern["keywords"] if kw in text_lower]
                if not matched_kw:
                    continue

                # Extract sentences in chunk
                sentences = re.split(r'(?<=[.!?\n]) +', text)
                relevant_sentence = ""
                for s in sentences:
                    s_lower = s.lower()
                    if any(kw in s_lower for kw in matched_kw):
                        # Ensure the sentence contains an obligation/commitment verb or explicit covenant
                        has_commitment = any(ci in s_lower for ci in COMMITMENT_INDICATORS)
                        # Or the matched keyword itself is an explicit contractual trigger
                        is_contractual = any(kw in s_lower for kw in [
                            "prior written notice", "days notice", "termination for convenience",
                            "cure period", "net 30", "net 60", "audit rights", "zero data retention",
                            "breach notification", "service level agreement", "service credit"
                        ])
                        if has_commitment or is_contractual:
                            relevant_sentence = s.strip()
                            break

                if not relevant_sentence:
                    continue

                # Clean up markdown table markers or line breaks in sentence
                relevant_sentence = re.sub(r'^[|\s\-:]+', '', relevant_sentence).strip()
                if len(relevant_sentence) > 300:
                    relevant_sentence = relevant_sentence[:297] + "..."

                # Extract REAL timeframes or deadlines from sentence
                # 1. Day / hour windows (e.g., 30 calendar days, 48 hours)
                days_match = re.search(
                    r'(\d+)\s*(?:business\s+|calendar\s+)?(?:days?|hours?|weeks?|months?)',
                    relevant_sentence,
                    re.IGNORECASE
                )
                # 2. Fiscal years or quarters (e.g., FY 2027/28, Q1 2027)
                fy_match = re.search(
                    r'(?:(?:FY\s*)?20\d\d[-/]\d\d|Q[1-4]\s*20\d\d)',
                    relevant_sentence,
                    re.IGNORECASE
                )
                # 3. Calendar dates (e.g. March 31, 2027)
                date_match = re.search(
                    r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?',
                    relevant_sentence,
                    re.IGNORECASE
                )
                # 4. Payment terms (e.g. Net 30, Net 60)
                net_match = re.search(r'Net\s+\d+', relevant_sentence, re.IGNORECASE)

                if days_match:
                    due_date_or_window = days_match.group(0).strip()
                elif net_match:
                    due_date_or_window = net_match.group(0).strip()
                elif date_match:
                    due_date_or_window = date_match.group(0).strip()
                elif fy_match:
                    due_date_or_window = fy_match.group(0).strip()
                else:
                    due_date_or_window = "Event-Triggered (Upon Occurrence)"

                # Extract obligated party from context
                party = pattern["default_party"]
                party_match = re.search(
                    r'\b(Customer|Client|Vendor|Licensor|Licensee|Service Provider|Contractor|Company|Both Parties|Each Party)\b',
                    relevant_sentence,
                    re.IGNORECASE
                )
                if party_match:
                    p_str = party_match.group(0).title()
                    if p_str in ["Both Parties", "Each Party"]:
                        party = "Mutual / Both Parties"
                    else:
                        party = p_str

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
                    "obligated_party": party,
                    "due_date_or_window": due_date_or_window,
                    "trigger_condition": pattern["trigger"],
                    "risk_level": pattern["default_risk"],
                    "status": "Action Required" if pattern["default_risk"] in ["Critical", "High"] else "Active / Monitored",
                    "fulfillment_verified": False
                })
                break  # Avoid duplicating multiple categories per same chunk

        return obligations
