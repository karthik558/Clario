import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Finding, Document
from app.schemas.dtos import NegotiateRequest, NegotiateResponse
from app.core.config import settings

class NegotiateService:
    @staticmethod
    def draft_redline(req: NegotiateRequest, db: Session) -> NegotiateResponse:
        # If finding_id is provided, populate missing details from DB
        statement_a = req.statement_a or ""
        statement_b = req.statement_b or ""
        doc_a_title = req.doc_a_title or "Baseline Agreement (Doc A)"
        doc_b_title = req.doc_b_title or "Modernized Terms (Doc B)"
        topic = req.topic or "Contractual Provision"
        page_a = req.page_a or 1
        page_b = req.page_b or 1

        if req.finding_id:
            finding = db.query(Finding).filter(Finding.id == req.finding_id).first()
            if finding:
                topic = finding.title
                statement_a = finding.doc_a_quote or finding.description
                statement_b = finding.doc_b_quote or finding.description
                doc_a_title = finding.doc_a_title or doc_a_title
                doc_b_title = finding.doc_b_title or doc_b_title
                page_a = finding.doc_a_page or page_a
                page_b = finding.doc_b_page or page_b

        stance = req.stance

        # Synthesize domain-specific proposed compromise redline
        topic_lower = topic.lower()

        if "retention" in topic_lower or "storage" in topic_lower:
            if stance == "customer_protective":
                clause = (
                    "Section 3.1 (Amended Data Lifecycle): Customer prompts and model outputs shall be processed exclusively "
                    "in volatile accelerator memory under a default Zero Data Retention (ZDR) policy and purged immediately upon response delivery. "
                    "Customer may, at its sole discretion, opt in via the administrative console to encrypted compliance audit logging for up to sixty (60) calendar days."
                )
                rationale = "Maximal data sovereignty and enterprise privacy alignment; eliminates third-party corporate data exposure while leaving audit logging strictly opt-in."
                risk = "Low (Enterprise Safe)"
                concessions = [
                    "Vendor gives up standard 30-day monitoring data retention.",
                    "Customer retains full audit capability via optional 60-day CMEK log window."
                ]
            elif stance == "vendor_favorable":
                clause = (
                    "Section 3.1 (Amended Data Lifecycle): Vendor shall retain customer API interaction logs for a period not to exceed "
                    "thirty (30) calendar days solely for security monitoring, platform abuse mitigation, and system integrity. "
                    "At the expiration of thirty (30) days, records shall be irrevocably purged via automated cryptographic wiping routines."
                )
                rationale = "Preserves necessary abuse monitoring telemetry for platform stability while establishing a rigid automated 30-day purge ceiling."
                risk = "Medium (Standard Commercial)"
                concessions = [
                    "Vendor agrees to strict automatic deletion at 30 days with no secondary indexing.",
                    "Customer accepts short-term ephemeral abuse monitoring logs."
                ]
            else: # balanced / strict_compliance
                clause = (
                    "Section 3.1 (Hybrid Data Retention Protocol): Default API inference shall operate under Zero Data Retention (ZDR) "
                    "in volatile memory without persistent disk writes. For regulatory and audit compliance, Customer may configure an isolated "
                    "logging window of up to thirty (30) days, extendable to sixty (60) days upon formal enterprise compliance request, secured with Customer-Managed Keys (CMEK)."
                )
                rationale = "Balanced enterprise posture: Zero Data Retention by default protects customer privacy, while customer-controlled logging (up to 30/60 days) preserves compliance audit trails."
                risk = "Low (Recommended Consensus)"
                concessions = [
                    "Vendor adopts ZDR volatile processing as default.",
                    "Customer accepts responsibility for enabling compliance audit logging if required by industry statutes."
                ]

        elif "liability" in topic_lower or "ceiling" in topic_lower or "damages" in topic_lower:
            if stance == "customer_protective":
                clause = (
                    "Section 6.1 (Amended Aggregate Liability Ceiling): Vendor's cumulative aggregate monetary liability arising out of or related to "
                    "this Agreement, whether in contract, tort, or statutory duty, shall not exceed the greater of two hundred fifty thousand United States dollars ($250,000 USD) "
                    "or twelve (12) months of aggregate platform fees paid. The foregoing limitation shall not apply to breach of confidentiality, data protection, or willful misconduct."
                )
                rationale = "Protects customer against catastrophic platform failures, data leaks, or gross negligence with a realistic enterprise liability ceiling."
                risk = "Low for Customer / High for Vendor"
                concessions = [
                    "Vendor assumes meaningful commercial liability backing enterprise SLA commitments.",
                    "Carve-out protects customer against egregious breaches of confidentiality."
                ]
            elif stance == "vendor_favorable":
                clause = (
                    "Section 6.1 (Amended Aggregate Liability Ceiling): Vendor's aggregate monetary liability under this Agreement shall be limited to "
                    "the total platform fees paid by Customer in the three (3) months preceding the incident, not to exceed twenty-five thousand United States dollars ($25,000 USD). "
                    "In no event shall either party be liable for indirect, incidental, or consequential damages."
                )
                rationale = "Limits vendor financial exposure to a predictable commercial percentage of fees paid while superseding the untenable nominal $100 baseline."
                risk = "Medium"
                concessions = [
                    "Vendor increases ceiling significantly above the prior $100 nominal cap.",
                    "Customer accepts fee-relative ceiling rather than fixed $250k."
                ]
            else: # balanced
                clause = (
                    "Section 6.1 (Tiered Liability Framework): For standard service delivery defects, each party's aggregate cumulative liability shall be capped at "
                    "the aggregate fees paid by Customer during the preceding twelve (12) months. For verified breach of customer confidentiality or data protection warranties, "
                    "Vendor's liability ceiling shall be expanded up to a maximum super-cap of two hundred fifty thousand United States dollars ($250,000 USD)."
                )
                rationale = "Tiered liability compromises vendor risk allocation: standard operational issues stay tied to fees paid, while security/privacy breaches unlock the expanded $250k protection ceiling."
                risk = "Low (Optimal Commercial Balance)"
                concessions = [
                    "Vendor limits general commercial liability to 12 months fees.",
                    "Customer gains $250k super-cap protection for security and data confidentiality incidents."
                ]

        elif "incident" in topic_lower or "breach" in topic_lower or "notification" in topic_lower:
            if stance == "customer_protective":
                clause = (
                    "Section 5.2 (Breach Alert & Forensic Timelines): In the event of confirmed unauthorized access or compromise of customer data, "
                    "Vendor shall provide written preliminary notification within forty-eight (48) hours of confirmation, followed by a comprehensive, "
                    "independent third-party audited forensic investigation report delivered within thirty (30) calendar days."
                )
                rationale = "Enables customer compliance teams to satisfy strict 72-hour GDPR and state privacy breach reporting mandates with forensic backing."
                risk = "Low for Customer"
                concessions = ["Vendor commits to 48-hour preliminary notice and 30-day forensic delivery."]
            elif stance == "vendor_favorable":
                clause = (
                    "Section 5.2 (Breach Notification Timeline): Vendor shall notify Customer in writing within five (5) business days following "
                    "internal verification of a material data breach, and deliver a formal incident report within sixty (60) days."
                )
                rationale = "Provides vendor engineering teams sufficient investigation time before issuing formal notifications."
                risk = "Medium (May stress tight GDPR 72-hour reporting windows)"
                concessions = ["Customer receives forensic report within 60 days instead of undefined timeline."]
            else: # balanced
                clause = (
                    "Section 5.2 (Accelerated Incident Notification Standard): Vendor shall deliver a preliminary informational breach alert "
                    "within seventy-two (72) hours of confirming a security incident affecting customer data, accompanied by initial scope metrics. "
                    "Vendor shall furnish an exhaustive third-party audited forensic report and root-cause analysis within forty-five (45) calendar days."
                )
                rationale = "Perfect alignment with GDPR 72-hour statutory notification rules, paired with an accelerated 45-day forensic deadline."
                risk = "Low (Regulatory Gold Standard)"
                concessions = [
                    "Vendor accepts binding 72-hour preliminary alert requirement.",
                    "Customer grants 45 calendar days for complete packet-level forensic delivery."
                ]

        elif "copyright" in topic_lower or "intellectual property" in topic_lower:
            clause = (
                "Section 4.1 (Copyright Shield Defense Covenant): Vendor agrees to defend Customer against third-party claims alleging that "
                "standard model completions infringe valid copyright rights, and shall pay adverse judgments or settlements, provided Customer "
                "complies with platform acceptable use guardrails and does not disable built-in citation filters."
            )
            rationale = "Adopts modern enterprise IP protection parity, protecting developers and enterprises deploying generative AI at scale."
            risk = "Low (Modern Enterprise Standard)"
            concessions = [
                "Vendor provides formal legal defense and settlement indemnification.",
                "Customer commits to maintaining guardrails and built-in citation features."
            ]

        elif "hipaa" in topic_lower or "healthcare" in topic_lower:
            clause = (
                "Section 8.3 (Healthcare & HIPAA Addendum): For customers executing a dedicated enterprise agreement, Vendor shall execute "
                "a standard Business Associate Agreement (BAA) governing authorized zero-retention health endpoints, enabling compliant processing of Protected Health Information (PHI)."
            )
            rationale = "Unlocks regulated healthcare and clinical operations under strict zero-retention architecture."
            risk = "Low"
            concessions = ["Vendor provides standard BAA; customer must route PHI exclusively through dedicated zero-retention endpoints."]

        else:
            clause = (
                f"Amended Clause for {topic}: Both parties agree to reconcile the prior standard ({statement_a[:60]}...) "
                f"with the modernized specification ({statement_b[:60]}...) by executing a mutual compliance amendment that balances operational feasibility with enterprise governance."
            )
            rationale = f"Harmonizes divergent obligations between {doc_a_title} and {doc_b_title} under a unified operating standard."
            risk = "Medium"
            concessions = ["Both parties agree to supersede baseline language with modernized terms."]

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
            proposed_clause=clause,
            rationale=rationale,
            risk_level=risk,
            key_concessions=concessions,
            mode=f"local_ai_autonomous_negotiation ({stance})"
        )
