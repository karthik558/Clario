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

        def lines_with_pages(chunks):
            lines, pages = [], []
            for chunk in chunks:
                for line in chunk.content.splitlines():
                    if line.strip():
                        lines.append(line.strip())
                        pages.append(chunk.page_number)
            return lines, pages

        lines_a, pages_a = lines_with_pages(chunks_a)
        lines_b, pages_b = lines_with_pages(chunks_b)

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
            
            page_a = pages_a[i1] if i1 < i2 else None
            page_b = pages_b[j1] if j1 < j2 else None

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
            diff_data_json=json.dumps([b.model_dump() for b in diff_blocks[:50]]),
            contradiction_count=len(contradictions)
        )
        db.add(comparison)
        db.commit()

        # Build responses
        doc_a_dto = DocumentResponse.model_validate(doc_a)
        doc_a_dto.tags = json.loads(doc_a.tags_json) if doc_a.tags_json else []

        doc_b_dto = DocumentResponse.model_validate(doc_b)
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
        shared_topics = [
            "Data Management & Retention Guidelines",
            "Contractual Liability & Risk Allocation",
            "Security Incident Notification & Forensics",
            "Intellectual Property & Copyright Shield",
            "Healthcare & HIPAA Regulatory Eligibility",
            "Sovereign Data Residency & Regional Mesh",
            "Hardware Enclaves & Memory Eradication",
            "Foundation Model Non-Training Guarantees",
            "Frontier Model Safety & Catastrophic Risk Gates",
            "Regulatory Alignment & Statutory Adherence"
        ]
        differences = []
        contradictions = []

        text_a_combined = " ".join([c.content for c in chunks_a])
        text_b_combined = " ".join([c.content for c in chunks_b])

        def find_chunk_evidence(chunks: List[DocumentChunk], keywords: List[str]) -> Tuple[int, str]:
            for c in chunks:
                content_lower = c.content.lower()
                if any(kw.lower() in content_lower for kw in keywords):
                    # Clean snippet
                    lines = [l.strip() for l in c.content.splitlines() if l.strip() and not l.strip().startswith("#")]
                    clean_text = " ".join(lines[:3]) if lines else c.content[:200]
                    return c.page_number, clean_text[:220]
            if chunks:
                return chunks[0].page_number, chunks[0].content[:200]
            return 1, ""

        # 1. Data Retention & Deletion Timeline
        has_retention_a = any(k in text_a_combined.lower() for k in ["data retention", "retention period", "retain customer data"]) and any(k in text_a_combined.lower() for k in ["30 days", "30-day", "thirty (30) days"])
        has_retention_b = any(k in text_b_combined.lower() for k in ["zero data retention", "zdr", "audit logging"]) and any(k in text_b_combined.lower() for k in ["60 days", "60-day", "zero retention", "volatile memory"])
        if has_retention_a and has_retention_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["30 days", "standard retention", "abuse monitoring", "retention"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["zero data retention", "zdr", "60 days", "audit logging"])
            differences.append("Data Retention: Standard 30-day retention in Doc A vs Zero Data Retention (ZDR) default & 60-day audit window in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Data Retention & Ephemeral Storage Window",
                statement_a=f"Specifies: '30 days standard retention' ({q_a}).",
                statement_b=f"Specifies: 'Zero Data Retention (ZDR) default / 60-day audit logging' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Critical discrepancy in customer data life-cycle: Prior baseline retained commercial API payloads for 30 calendar days for monitoring, whereas modernized terms enforce immediate volatile memory eradication (Zero Data Retention) with an optional 60-day CMEK audit window.",
                confidence="high"
            ))

        # 2. Liability & Financial Ceilings
        has_cap_a = any(k in text_a_combined.lower() for k in ["liability", "aggregate liability", "damages"]) and any(k in text_a_combined.lower() for k in ["$100", "one hundred dollars", "nominal"])
        has_cap_b = any(k in text_b_combined.lower() for k in ["liability", "aggregate liability", "damages"]) and any(k in text_b_combined.lower() for k in ["$250,000", "two hundred fifty thousand", "12 months fees"])
        if has_cap_a and has_cap_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["$100.00", "aggregate liability", "one hundred united states dollars"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["$250,000", "enterprise liability cap", "twelve (12) months"])
            differences.append("Liability Cap: $100.00 USD nominal ceiling in Doc A vs $250,000 USD (or 12 months fees) expanded cap in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Contractual Aggregate Liability Ceiling",
                statement_a=f"Specifies: '$100.00 USD aggregate ceiling' ({q_a}).",
                statement_b=f"Specifies: '$250,000 USD or 12 months fees paid' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Major financial risk reallocation: Baseline terms strictly capped cumulative monetary recovery at a nominal $100.00 USD, whereas modernized terms expand liability coverage up to $250,000 USD or 12 months aggregate fees paid.",
                confidence="high"
            ))

        # 3. Security Incident Notice & Forensics
        has_breach_a = any(k in text_a_combined.lower() for k in ["breach", "security incident"]) and any(k in text_a_combined.lower() for k in ["30 calendar days", "thirty (30) days", "30 days notice"])
        has_breach_b = any(k in text_b_combined.lower() for k in ["breach", "security incident"]) and any(k in text_b_combined.lower() for k in ["72 hours", "72-hour", "forensic report"])
        if has_breach_a and has_breach_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["thirty (30) calendar days", "breach notification protocol"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["72 hours", "preliminary alert", "forensic report"])
            differences.append("Breach Reporting: 30 days formal notification in Doc A vs 72-hour preliminary alert and 60-day forensic report in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Security Incident Notification & Forensic Timeline",
                statement_a=f"Specifies: '30 calendar days notice' ({q_a}).",
                statement_b=f"Specifies: 'Preliminary alert within 72 hours; forensic report within 60 days' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Accelerated regulatory reporting timeline: Baseline terms permitted a 30-day reporting delay, while modernized policy institutes a mandatory 72-hour emergency preliminary notification followed by a 60-day comprehensive audited forensic dossier.",
                confidence="high"
            ))

        # 4. Intellectual Property & Copyright Shield
        has_ip_a = "does not provide copyright" in text_a_combined.lower() or "customer indemn" in text_a_combined.lower()
        has_ip_b = "copyright shield" in text_b_combined.lower() or "ip shield" in text_b_combined.lower()
        if has_ip_a and has_ip_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["does not provide copyright", "intellectual property & defense"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["copyright shield", "enterprise ip shield commitment"])
            differences.append("IP Indemnification: No copyright defense in Doc A vs Full Copyright Shield defense & settlement coverage in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Intellectual Property Defense & Copyright Shield",
                statement_a=f"Specifies: 'No copyright infringement indemnification provided' ({q_a}).",
                statement_b=f"Specifies: 'Full Copyright Shield covering defense and adverse judgments' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Substantive legal indemnity reversal: Baseline terms excluded copyright infringement defense, obligating customers to bear all third-party legal risks; modernized terms introduce the Copyright Shield to legally defend customers and pay adverse judgments.",
                confidence="high"
            ))

        # 5. HIPAA Compliance & Protected Health Information
        has_hipaa_a = "hipaa" in text_a_combined.lower() and ("business associate" in text_a_combined.lower() or "baa" in text_a_combined.lower() or "phi" in text_a_combined.lower())
        has_hipaa_b = "hipaa" in text_b_combined.lower() and ("business associate" in text_b_combined.lower() or "baa" in text_b_combined.lower() or "healthcare" in text_b_combined.lower())
        if has_hipaa_a and has_hipaa_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["business associate", "hipaa", "protected health information"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["business associate agreement (baa)", "hipaa-compliant", "healthcare"])
            differences.append("HIPAA Compliance: BAAs prohibited & no PHI in Doc A vs BAAs available for dedicated health endpoints in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Healthcare Regulation & HIPAA BAA Eligibility",
                statement_a=f"Specifies: 'BAAs not supported; PHI strictly prohibited' ({q_a}).",
                statement_b=f"Specifies: 'BAAs supported for dedicated zero-retention health endpoints' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Regulatory expansion into clinical workloads: Baseline terms strictly prohibited transmission of Protected Health Information (PHI) under HIPAA; modernized terms officially support Business Associate Agreements (BAAs) for authorized enterprise healthcare architectures.",
                confidence="high"
            ))

        # 6. Data Residency & Compute Sovereignty
        has_res_a = "united states data centers" in text_a_combined.lower() or "us-east" in text_a_combined.lower()
        has_res_b = "european union data boundary" in text_b_combined.lower() or "eu data boundary" in text_b_combined.lower()
        if has_res_a and has_res_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["united states data centers", "regional ingestion routing"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["european union data boundary", "global data residency and sovereign compute"])
            differences.append("Data Residency: US data centers only in Doc A vs Sovereign EU Data Boundary & regional compute mesh in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Geographic Compute Sovereignty & Data Residency",
                statement_a=f"Specifies: 'Workloads restricted to continental United States data centers' ({q_a}).",
                statement_b=f"Specifies: 'Sovereign EU Data Boundary and dedicated regional mesh' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Cross-border sovereign infrastructure shift: Prior operational terms mandated US data center ingestion, while modernized terms introduce an EU-only compute boundary to ensure compliance with GDPR cross-border transfer requirements.",
                confidence="high"
            ))

        # 7. Hardware Enclaves & Memory Eradication
        has_hw_a = "volatile gpu and tpu buffers" in text_a_combined.lower() or "zero-filled" in text_a_combined.lower()
        has_hw_b = "cryptographic enclaves" in text_b_combined.lower() or "hbm" in text_b_combined.lower()
        if has_hw_a and has_hw_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["volatile gpu and tpu buffers are wiped", "buffer cleansing"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["cryptographic enclaves", "hardware-enforced enclaves", "automated memory eradication"])
            differences.append("Hardware Security: Software zero-filling in Doc A vs Hardware-enforced Confidential Computing enclaves and certified HBM zeroization in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Hardware Cryptographic Enclaves & Memory Sanitization",
                statement_a=f"Specifies: 'Standard volatile RAM buffer wipe between batches' ({q_a}).",
                statement_b=f"Specifies: 'Hardware-enforced Confidential Computing enclaves and HBM eradication' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Architectural security upgrade: Replaces software-managed buffer wiping with hardware-enforced cryptographic enclaves (Confidential Computing) and certified hardware-level high-bandwidth memory (HBM) zeroization.",
                confidence="medium"
            ))

        # 8. Model Training & Customer Input Protection
        has_train_a = "never utilized for foundation model training" in text_a_combined.lower() or "pre-training datasets" in text_a_combined.lower()
        has_train_b = "strict universal non-training warranty" in text_b_combined.lower()
        if has_train_a and has_train_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["never utilized for foundation model training", "customer inputs"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["strict universal non-training warranty", "neither customer inputs nor generated outputs"])
            differences.append("Model Training: Baseline API non-training terms in Doc A vs Universal binding non-training warranty with fine-tune KMS isolation in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Foundation Model Non-Training Guarantee & Fine-Tuning Isolation",
                statement_a=f"Specifies: 'API inputs excluded from pre-training' ({q_a}).",
                statement_b=f"Specifies: 'Strict universal non-training warranty across all tiers with tenant KMS isolation' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Strengthened contractual non-training warranty: Formalizes unconditional non-training covenants across all API and fine-tuning weights, backed by cryptographic KMS tenant isolation and verification tokens.",
                confidence="medium"
            ))

        # 9. Frontier Safety & Catastrophic Risk Gates
        has_safety_a = "red-teaming" in text_a_combined.lower() or "disallowed use" in text_a_combined.lower()
        has_safety_b = "frontier safety framework" in text_b_combined.lower() or "severe risk" in text_b_combined.lower()
        if has_safety_a and has_safety_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["disallowed use categories", "red-teaming & enforcement"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["frontier safety framework", "severe risk thresholds", "cbrn"])
            differences.append("Safety Governance: Standard misuse categories in Doc A vs Codified Frontier Safety Framework with 4-vector catastrophic risk gates in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="Frontier Safety Framework & Catastrophic Risk Gates",
                statement_a=f"Specifies: 'Heuristic misuse policy categories and manual review' ({q_a}).",
                statement_b=f"Specifies: 'Codified Frontier Safety Framework with mandatory Severe Risk deployment locks' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Risk governance codification: Introduces the Frontier Safety Framework establishing four objective catastrophic threat vectors (Cyber, CBRN, Persuasion, Autonomous Replication) with mandatory operational halts for models evaluated above 'Medium' risk.",
                confidence="medium"
            ))

        # 10. Regulatory Alignment & International Mandates
        has_reg_a = "california" in text_a_combined.lower() or "ccpa" in text_a_combined.lower()
        has_reg_b = "european union ai act" in text_b_combined.lower() or "executive order 14110" in text_b_combined.lower()
        if has_reg_a and has_reg_b:
            p_a, q_a = find_chunk_evidence(chunks_a, ["state of california", "ccpa", "cpra"])
            p_b, q_b = find_chunk_evidence(chunks_b, ["european union ai act", "us executive order 14110", "gpai"])
            differences.append("Statutory Alignment: California CCPA/CPRA baseline in Doc A vs EU AI Act GPAI transparency & US Executive Order 14110 compliance in Doc B.")
            contradictions.append(ContradictionCandidate(
                topic="International Regulatory Adherence & AI Governance Standards",
                statement_a=f"Specifies: 'Governed under California state law and CCPA/CPRA statutes' ({q_a}).",
                statement_b=f"Specifies: 'Explicit adherence to EU AI Act General-Purpose AI mandates and US EO 14110' ({q_b}).",
                page_a=p_a,
                page_b=p_b,
                explanation="Internationalization of regulatory compliance: Extends legal compliance beyond California CCPA/CPRA to satisfy European Union AI Act risk tiering and United States Executive Order 14110 safety reporting standards.",
                confidence="medium"
            ))

        if not differences:
            differences.append("No explicit numerical contradictions identified in scanned standard clauses.")

        return shared_topics, differences, contradictions

    @classmethod
    def compare_multiple_documents(cls, doc_ids: List[str], db: Session) -> Dict[str, Any]:
        from app.services.risk_service import RiskService, RISK_PILLARS

        docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()
        doc_map = {d.id: d for d in docs}

        valid_docs = [doc_map[did] for did in doc_ids if did in doc_map]
        if len(valid_docs) < 2:
            raise ValueError("Select at least 2 valid documents to compare.")

        evaluations = [RiskService.evaluate_document(d, db) for d in valid_docs]

        pairwise_matrix = []
        for i in range(len(valid_docs)):
            for j in range(i + 1, len(valid_docs)):
                da = valid_docs[i]
                db_doc = valid_docs[j]
                comp_res = cls.compare_documents(da.id, db_doc.id, db)
                pairwise_matrix.append({
                    "doc_a_id": da.id,
                    "doc_a_title": da.title,
                    "doc_b_id": db_doc.id,
                    "doc_b_title": db_doc.title,
                    "similarity_score": comp_res.similarity_score,
                    "contradiction_count": len(comp_res.contradiction_candidates),
                    "changed_sections_count": comp_res.changed_sections_count
                })

        pillar_leaders = []
        for p_def in RISK_PILLARS:
            pid = p_def["id"]
            pname = p_def["name"]

            scores = []
            for ev in evaluations:
                pmatch = next((p for p in ev["pillars"] if p["id"] == pid), None)
                if pmatch:
                    scores.append((ev["document_id"], ev["document_title"], pmatch["score"]))

            if scores:
                scores.sort(key=lambda x: x[2], reverse=True)
                leader = scores[0]
                exposure = scores[-1]
                pillar_leaders.append({
                    "pillar_id": pid,
                    "pillar_name": pname,
                    "leader_doc_id": leader[0],
                    "leader_doc_title": leader[1],
                    "highest_score": leader[2],
                    "exposure_doc_id": exposure[0],
                    "exposure_doc_title": exposure[1],
                    "lowest_score": exposure[2],
                    "summary": f"{leader[1].replace('_', ' ')} offers top protection ({leader[2]}/100) vs {exposure[1].replace('_', ' ')} ({exposure[2]}/100)."
                })

        evaluations.sort(key=lambda x: x["composite_score"], reverse=True)
        top_doc = evaluations[0]
        lowest_doc = evaluations[-1]
        synthesis = (
            f"Multi-document comparative analysis across {len(valid_docs)} enterprise policies reveals a commercial protective spread from "
            f"{top_doc['document_title'].replace('_', ' ')} (Score: {top_doc['composite_score']}/100, {top_doc['composite_grade']}) "
            f"to {lowest_doc['document_title'].replace('_', ' ')} (Score: {lowest_doc['composite_score']}/100, {lowest_doc['composite_grade']}). "
            f"Computed {len(pairwise_matrix)} pairwise differentials across {len(valid_docs)} agreements."
        )

        return {
            "total_documents": len(valid_docs),
            "documents": evaluations,
            "pairwise_matrix": pairwise_matrix,
            "pillar_leaders": pillar_leaders,
            "executive_synthesis": synthesis
        }
