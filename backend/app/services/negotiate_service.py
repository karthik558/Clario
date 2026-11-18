import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Finding, Document
from app.schemas.dtos import NegotiateRequest, NegotiateResponse
from app.core.config import settings

class NegotiateService:
    @staticmethod
    def draft_redline(req: NegotiateRequest, db: Session) -> NegotiateResponse:
        statement_a = (req.statement_a or "").strip()
        statement_b = (req.statement_b or "").strip()
        doc_a_title = req.doc_a_title or "Document A"
        doc_b_title = req.doc_b_title or "Document B"
        topic = (req.topic or "Contractual Provision").strip()
        page_a = req.page_a or 1
        page_b = req.page_b or 1

        if req.finding_id:
            finding = db.query(Finding).filter(Finding.id == req.finding_id).first()
            if finding:
                topic = finding.title or topic
                statement_a = finding.doc_a_quote or finding.description or statement_a
                statement_b = finding.doc_b_quote or finding.description or statement_b
                doc_a_title = finding.doc_a_title or doc_a_title
                doc_b_title = finding.doc_b_title or doc_b_title
                page_a = finding.doc_a_page or page_a
                page_b = finding.doc_b_page or page_b

        stance = req.stance

        # Synthesize dynamic, grounded compromise redline
        topic_lower = topic.lower()
        stmt_a_lower = statement_a.lower()
        stmt_b_lower = statement_b.lower()

        # Dynamic clause synthesis based on provided statements and stance
        if not statement_a and not statement_b:
            proposed_clause = (
                f"Proposed Harmonized Clause ({topic}): The parties agree that all commitments under this provision "
                "shall be executed in mutual commercial good faith, adhering to documented operational procedures "
                "with standard thirty (30) days notice for material amendments."
            )
            rationale = f"Constructed baseline compromise framework for {topic}."
            risk_level = "Low (Baseline Provision)"
            concessions = [
                "Bilateral operational standard adopted.",
                "Mutual 30-day notice requirement instituted."
            ]
        else:
            # Clean core text from statement A and B
            clean_a = statement_a.strip().rstrip('.')
            clean_b = statement_b.strip().rstrip('.')

            if stance == "customer_protective":
                if clean_b:
                    proposed_clause = (
                        f"Amended Provision ({topic}): In accordance with Customer's protective governance standards, "
                        f"'{clean_b}'. Counterparty warrants that in the event of conflict with '{clean_a}', "
                        "the modernized protective covenant shall strictly govern and supersede all prior terms."
                    )
                else:
                    proposed_clause = (
                        f"Amended Provision ({topic}): In accordance with Customer's protective standards, "
                        f"'{clean_a}'. Provided, however, that Counterparty's obligations hereunder shall remain strictly "
                        "enforceable with mutual audit verification and zero unilateral exclusions."
                    )
                rationale = f"Prioritizes protective covenants for {topic}, minimizing customer operational and financial exposure."
                risk_level = "Low for Customer / High for Counterparty"
                concessions = [
                    f"Counterparty accepts binding governance under {doc_b_title or 'modernized terms'}.",
                    "Customer eliminates unilateral exception clauses."
                ]

            elif stance == "vendor_favorable":
                if clean_a:
                    proposed_clause = (
                        f"Amended Provision ({topic}): '{clean_a}'. Customer acknowledges and agrees that "
                        "Counterparty's cumulative commitments hereunder are subject to standard commercial feasibility "
                        "and trailing-fee remedy boundaries."
                    )
                else:
                    proposed_clause = (
                        f"Amended Provision ({topic}): '{clean_b}'. Subject to standard commercial force majeure "
                        "and exclusive remedy limitations."
                    )
                rationale = f"Maintains commercially bounded risk profile for {topic}."
                risk_level = "Medium"
                concessions = [
                    "Preserves predictable liability and operational remedy ceilings.",
                    "Provides reasonable commercial cure periods."
                ]

            elif stance == "strict_compliance":
                proposed_clause = (
                    f"Amended Compliance Provision ({topic}): Both parties agree that: (i) '{clean_b or clean_a}'; "
                    "(ii) all associated logs and records shall remain verifiable upon forty-eight (48) hours prior notice; "
                    "and (iii) any material breach of this covenant shall grant the non-breaching party immediate right of termination."
                )
                rationale = f"Strict compliance orientation for {topic} with statutory traceability and audit verification."
                risk_level = "Low (Strict Compliance Standard)"
                concessions = [
                    "Bilateral compliance verification with auditability.",
                    "Strict termination remedy for material breach."
                ]

            else: # balanced
                if clean_a and clean_b:
                    proposed_clause = (
                        f"Balanced Compromise Provision ({topic}): The parties harmonize prior terms with modernized requirements: "
                        f"'{clean_b}'. To ensure mutual feasibility, each party's performance shall be assessed against "
                        f"agreed milestone schedules, superseding the baseline specified in '{clean_a}'."
                    )
                elif clean_a:
                    proposed_clause = (
                        f"Balanced Provision ({topic}): Both parties agree that '{clean_a}', provided that each party "
                        "shall provide reasonable advance written notice of thirty (30) days prior to implementing material changes."
                    )
                else:
                    proposed_clause = (
                        f"Balanced Provision ({topic}): Both parties agree that '{clean_b}', governed under mutual commercial good faith."
                    )
                rationale = f"Equitably reconciles positions between {doc_a_title} and {doc_b_title} for {topic}."
                risk_level = "Low (Recommended Consensus)"
                concessions = [
                    "Both parties adopt modernized standard with reasonable transition notice.",
                    "Dispute resolution grounded in bilateral operational review."
                ]

        return NegotiateResponse(
            topic=topic,
            stance=stance,
            original_a={
                "doc_title": doc_a_title,
                "page": page_a,
                "quote": statement_a
            },
            original_b={
                "doc_title": doc_b_title,
                "page": page_b,
                "quote": statement_b
            },
            proposed_clause=proposed_clause,
            rationale=rationale,
            risk_level=risk_level,
            key_concessions=concessions,
            mode="dynamic_clause_harmonization"
        )
