import difflib
import json
import re
import uuid
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.entities import Document, DocumentChunk, Comparison
from app.schemas.dtos import (
    ComparisonResponse,
    DocumentResponse,
    DiffBlock,
    ContradictionCandidate
)

class CompareService:
    @staticmethod
    def compare_documents(doc_a_id: str, doc_b_id: str, db: Session) -> ComparisonResponse:
        doc_a = db.query(Document).filter(Document.id == doc_a_id).first()
        doc_b = db.query(Document).filter(Document.id == doc_b_id).first()

        if not doc_a or not doc_b:
            raise ValueError("One or both documents could not be found.")

        # Gather text chunks
        chunks_a = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_a_id).order_by(DocumentChunk.chunk_index).all()
        chunks_b = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_b_id).order_by(DocumentChunk.chunk_index).all()

        text_a_paragraphs = [c.content for c in chunks_a]
        text_b_paragraphs = [c.content for c in chunks_b]

        full_text_a = "\n\n".join(text_a_paragraphs)
        full_text_b = "\n\n".join(text_b_paragraphs)

        lines_a = [line.strip() for line in full_text_a.splitlines() if line.strip()]
        lines_b = [line.strip() for line in full_text_b.splitlines() if line.strip()]

        # Compute sequence diff
        matcher = difflib.SequenceMatcher(None, lines_a, lines_b)
        similarity_score = round(matcher.ratio(), 4)

        diff_blocks: List[DiffBlock] = []
        added_count = 0
        removed_count = 0
        changed_count = 0

        opcodes = matcher.get_opcodes()
        for tag, i1, i2, j1, j2 in opcodes:
            sub_a = "\n".join(lines_a[i1:i2])
            sub_b = "\n".join(lines_b[j1:j2])
            
            # Approximate page numbers
            page_a = chunks_a[min(i1 // 4, len(chunks_a) - 1)].page_number if chunks_a else 1
            page_b = chunks_b[min(j1 // 4, len(chunks_b) - 1)].page_number if chunks_b else 1

            if tag == "equal":
                diff_blocks.append(DiffBlock(
                    type="equal",
                    text_a=sub_a,
                    text_b=sub_b,
                    page_a=page_a,
                    page_b=page_b
                ))
            elif tag == "insert":
                added_count += len(lines_b[j1:j2])
                diff_blocks.append(DiffBlock(
                    type="insert",
                    text_a="",
                    text_b=sub_b,
                    page_a=page_a,
                    page_b=page_b
                ))
            elif tag == "delete":
                removed_count += len(lines_a[i1:i2])
                diff_blocks.append(DiffBlock(
                    type="delete",
                    text_a=sub_a,
                    text_b="",
                    page_a=page_a,
                    page_b=page_b
                ))
            elif tag == "replace":
                changed_count += max(len(lines_a[i1:i2]), len(lines_b[j1:j2]))
                diff_blocks.append(DiffBlock(
                    type="replace",
                    text_a=sub_a,
                    text_b=sub_b,
                    page_a=page_a,
                    page_b=page_b
                ))

        # Detect semantic contradictions & topic changes
        shared_topics, differences, contradictions = CompareService._analyze_semantic_differences(
            chunks_a, chunks_b, doc_a.title, doc_b.title
        )

        # Summary text
        summary = (
            f"Comparison between '{doc_a.title}' and '{doc_b.title}' reveals a textual similarity of "
            f"{round(similarity_score * 100, 1)}%. Detected {added_count} added segments, "
            f"{removed_count} removed segments, and {changed_count} modified passages. "
            f"{len(contradictions)} potential substantive divergence(s) identified for human review."
        )

        comparison_id = str(uuid.uuid4())
        comparison = Comparison(
            id=comparison_id,
            doc_a_id=doc_a_id,
            doc_b_id=doc_b_id,
            title=f"Comparison: {doc_a.title} vs {doc_b.title}",
            summary=summary,
            similarity_score=similarity_score,
            added_count=added_count,
            removed_count=removed_count,
            changed_count=changed_count,
            diff_data_json=json.dumps([b.dict() for b in diff_blocks[:50]]),
            contradiction_count=len(contradictions)
        )
        db.add(comparison)
        db.commit()

        # Build responses
        doc_a_dto = DocumentResponse.from_orm(doc_a)
        doc_a_dto.tags = json.loads(doc_a.tags_json) if doc_a.tags_json else []

        doc_b_dto = DocumentResponse.from_orm(doc_b)
        doc_b_dto.tags = json.loads(doc_b.tags_json) if doc_b.tags_json else []

        return ComparisonResponse(
            id=comparison_id,
            doc_a=doc_a_dto,
            doc_b=doc_b_dto,
            title=f"Comparison: {doc_a.title} vs {doc_b.title}",
            similarity_score=similarity_score,
            added_tokens_count=added_count,
            removed_tokens_count=removed_count,
            changed_sections_count=changed_count,
            summary=summary,
            shared_topics=shared_topics,
            differences=differences,
            contradiction_candidates=contradictions,
            diff_blocks=diff_blocks
        )

    @staticmethod
    def _analyze_semantic_differences(
        chunks_a: List[DocumentChunk],
        chunks_b: List[DocumentChunk],
        title_a: str,
        title_b: str
    ) -> Tuple[List[str], List[str], List[ContradictionCandidate]]:
        shared_topics = []
        differences = []
        contradictions = []

        # Keywords to scan for policies, numbers, obligations
        patterns = [
            (
                "Data Retention & Deletion Timeline",
                r'(?:retain|retained|retention|delete|deleted|deletion|purge|purged)(?:[^\d]{1,60})?(\d+\s*(?:days|business days|months|years)|zero data retention)',
                "Retention period or zero-data retention window altered between versions."
            ),
            (
                "Liability & Financial Ceilings",
                r'(?:liability|damages|cap|capped|aggregate|ceiling)(?:[^\$\d]{1,120})?(\$\d+(?:,\d+)*(?:\.\d+)?|\d+\s*(?:months?\s+fees?|USD))',
                "Liability cap or financial ceiling differed between agreements."
            ),
            (
                "Notice of Breach Period",
                r'(?:notice|cure|remedy)(?:[^\d]{1,60})?(\d+\s*(?:days|business days))|(\d+\s*(?:days|business days))(?:[^\.\n]{1,60})?(?:notice|cure|remedy)',
                "Notice period for breach or default was modified."
            ),
            (
                "Jurisdiction & Governing Law",
                r'(?:governed by|jurisdiction of|laws of)\s+([A-Z][a-zA-Z\s,]+(?:State|Country|California|New York|Delaware|England|European Union))',
                "Governing jurisdiction or dispute venue changed."
            ),
            (
                "Differential Privacy Epsilon",
                r'epsilon\s*(?:=|is|of)?\s*(\d+(?:\.\d+)?)',
                "Differential privacy epsilon bound differs between study documents."
            )
        ]

        text_a_combined = " ".join([c.content for c in chunks_a])
        text_b_combined = " ".join([c.content for c in chunks_b])

        # Shared common topics
        common_words = set(re.findall(r'\b[A-Za-z]{5,}\b', text_a_combined.lower())).intersection(
            set(re.findall(r'\b[A-Za-z]{5,}\b', text_b_combined.lower()))
        )
        if "retention" in common_words or "privacy" in common_words:
            shared_topics.append("Data Management & Retention Guidelines")
        if "liability" in common_words or "indemnification" in common_words:
            shared_topics.append("Contractual Liability & Risk Allocation")
        if "termination" in common_words or "notice" in common_words:
            shared_topics.append("Termination Clauses & Cure Periods")
        if "security" in common_words or "confidentiality" in common_words:
            shared_topics.append("Confidentiality and Information Security")
        if not shared_topics:
            shared_topics = ["General Terms", "Operational Obligations", "Scope of Work"]

        for topic, pattern, expl in patterns:
            match_a = re.search(pattern, text_a_combined, re.IGNORECASE)
            match_b = re.search(pattern, text_b_combined, re.IGNORECASE)

            if match_a and match_b:
                val_a = (match_a.group(1) or (match_a.group(2) if match_a.lastindex and match_a.lastindex >= 2 else "")).strip()
                val_b = (match_b.group(1) or (match_b.group(2) if match_b.lastindex and match_b.lastindex >= 2 else "")).strip()

                if val_a and val_b and val_a.lower() != val_b.lower():
                    # Find chunk and page for Doc A
                    page_a = 1
                    quote_a = ""
                    for c in chunks_a:
                        if val_a in c.content:
                            page_a = c.page_number
                            quote_a = c.content[:200]
                            break

                    page_b = 1
                    quote_b = ""
                    for c in chunks_b:
                        if val_b in c.content:
                            page_b = c.page_number
                            quote_b = c.content[:200]
                            break

                    differences.append(f"{topic}: '{val_a}' in Doc A vs '{val_b}' in Doc B.")
                    contradictions.append(
                        ContradictionCandidate(
                            topic=topic,
                            statement_a=f"Specifies: '{val_a}' ({quote_a[:120]}...)",
                            statement_b=f"Specifies: '{val_b}' ({quote_b[:120]}...)",
                            page_a=page_a,
                            page_b=page_b,
                            explanation=f"{expl} Doc A specifies '{val_a}', whereas Doc B specifies '{val_b}'. Requires human review.",
                            confidence="high"
                        )
                    )

        if not differences:
            differences.append("No explicit numerical contradictions identified in scanned standard clauses.")

        return shared_topics, differences, contradictions
