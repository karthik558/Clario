import re
import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk, Finding

ENTERPRISE_POLICY_RULES = [
    {
        "id": "data_retention",
        "title": "Data Retention & Ephemeral Storage Window",
        "category": "Data Governance",
        "severity": "Critical",
        "benchmark": "Prompts and customer enterprise payloads must be purged within <= 30 days or processed ephemerally with zero data retention (ZDR).",
        "keywords": ["retention", "ephemeral", "zero data retention", "zdr", "retained for", "days", "store prompts", "deleted"],
        "compliant_pattern": r"\b(?:zero(?:\s*-\s*|\s+)data(?:\s*-\s*|\s+)retention|ephemeral|purged immediately|not retain(?:ed)?|within\s+(?:30|thirty)\s+days|deleted upon completion)\b",
        "violation_pattern": r"\b(?:indefinite(?:ly)?|stored permanently|retained indefinitely|without time limit|no guarantee of deletion)\b",
        "remediation_clause": "Vendor covenants that Customer Personal Data and API Payloads shall be retained solely for the duration necessary to execute the requested processing, and in all events permanently purged within thirty (30) calendar days of receipt, unless Customer executes an applicable Zero Data Retention (ZDR) amendment."
    },
    {
        "id": "ai_model_training",
        "title": "AI Model Training & Customer Data Opt-Out",
        "category": "AI Ethics & IP",
        "severity": "Critical",
        "benchmark": "Customer inputs, completions, and fine-tuning datasets must never be utilized to train, retrain, or improve foundation or commercial models.",
        "keywords": ["train", "training", "customer data", "inputs", "model training", "opt-out", "improve our models", "foundation models"],
        "compliant_pattern": r"\b(?:does not use.*customer data to train|will not use.*inputs.*to train|never train.*on customer data|customer data is not used for model training|opted out of training)\b",
        "violation_pattern": r"\b(?:may use.*inputs to train|improve our services and models|train our algorithms on customer content|grant a perpetual license to use content for training)\b",
        "remediation_clause": "Vendor expressly covenants and warrants that it shall not use, disclose, aggregate, or otherwise process Customer Data, inputs, prompts, or generated outputs to train, fine-tune, retrain, or validate any proprietary, foundation, commercial, or third-party artificial intelligence or machine learning models without express prior written consent."
    },
    {
        "id": "breach_notification",
        "title": "Security Incident & 72-Hour Breach Escalation",
        "category": "Security & Breach",
        "severity": "Critical",
        "benchmark": "Confirmed or suspected security breaches involving Customer Data must be escalated in writing within <= 72 hours (or 24 hours for critical incidents).",
        "keywords": ["breach notification", "security incident", "72 hours", "24 hours", "without undue delay", "unauthorized access", "notify customer"],
        "compliant_pattern": r"\b(?:within\s+(?:24|48|72)\s+hours|without undue delay|promptly and in no event later than\s+(?:24|48|72)\s+hours)\b",
        "violation_pattern": r"\b(?:reasonable commercial efforts to notify|as soon as commercially practicable without specific deadline|no liability for delayed notice)\b",
        "remediation_clause": "In the event of any confirmed or reasonably suspected Security Incident involving Customer Data, Vendor shall notify Customer in writing without undue delay, and in no event later than forty-eight (48) hours following confirmation, providing forensic details, impact scope, and immediate mitigation actions taken."
    },
    {
        "id": "subprocessor_notice",
        "title": "Subprocessor Prior Notice & Objection Rights",
        "category": "Data Governance",
        "severity": "High",
        "benchmark": "Vendors must provide at least 10 to 30 days prior written notice before engaging new third-party subprocessors, with customer right to object.",
        "keywords": ["subprocessor", "sub-processor", "prior notice", "third party", "objection", "written notice", "subcontractor"],
        "compliant_pattern": r"\b(?:prior written notice.*(?:10|14|30)\s+days|right to object to.*subprocessor|thirty\s+\(30\)\s+days.*notice before appointing)\b",
        "violation_pattern": r"\b(?:sole discretion to change subprocessors|no notice required for subcontractors|customer waives right to approve subprocessors)\b",
        "remediation_clause": "Vendor shall maintain an up-to-date public list of all authorized subprocessors and shall deliver written notice to Customer at least thirty (30) days prior to onboarding any new subprocessor. Customer retains the right to reasonably object on data security or regulatory grounds."
    },
    {
        "id": "liability_cap",
        "title": "Mutual Liability & IP Indemnification Protection",
        "category": "Commercial & Liability",
        "severity": "High",
        "benchmark": "Direct liability cap must be mutual and equal to at least 12 months fees, with uncapped indemnification for third-party intellectual property claims.",
        "keywords": ["limitation of liability", "indemnification", "aggregate liability", "fees paid", "12 months", "intellectual property infringement", "uncapped"],
        "compliant_pattern": r"\b(?:aggregate liability.*(?:12|twelve)\s+months|indemnify.*intellectual property|mutual indemnification|carve-out for gross negligence and ip)\b",
        "violation_pattern": r"\b(?:liability limited to\s+\$\s*(?:50|100|500)|unilateral indemnification|no indemnity for ip claims|customer indemnifies vendor)\b",
        "remediation_clause": "Each party's aggregate liability under this Agreement shall not exceed the total fees paid or payable by Customer in the twelve (12) months preceding the claim. Neither party's liability cap shall apply to gross negligence, willful misconduct, or Vendor's obligations to indemnify Customer against third-party intellectual property infringement claims."
    },
    {
        "id": "hipaa_baa",
        "title": "HIPAA BAA & Protected Health Information (PHI)",
        "category": "Data Governance",
        "severity": "Medium",
        "benchmark": "Where healthcare or patient telemetry is processed, vendor must execute a formal Business Associate Agreement compliant with HITECH/HIPAA.",
        "keywords": ["hipaa", "business associate agreement", "baa", "protected health information", "phi", "ephi", "hitech"],
        "compliant_pattern": r"\b(?:business associate agreement|baa executed|eligible for hipaa|hipaa-compliant infrastructure|safeguards for ephi)\b",
        "violation_pattern": r"\b(?:not suitable for hipaa|prohibited from submitting phi|vendor is not a business associate|customer warrants no health data)\b",
        "remediation_clause": "To the extent Customer transmits electronic Protected Health Information (ePHI) to the Service, the parties shall execute Vendor's standard Business Associate Agreement (BAA), which shall incorporate administrative, physical, and technical safeguards complying with 45 C.F.R. Part 160 and Part 164."
    },
    {
        "id": "audit_rights",
        "title": "Security Audit & SOC 2 Certification Access",
        "category": "Security & Breach",
        "severity": "Medium",
        "benchmark": "Vendor must undergo annual independent SOC 2 Type II or ISO 27001 audits and provide audit summaries to Customer upon reasonable request.",
        "keywords": ["soc 2", "soc 2 type ii", "iso 27001", "independent audit", "audit rights", "annual audit", "third-party assessment"],
        "compliant_pattern": r"\b(?:soc 2 type ii|iso 27001|annual independent security audit|third-party audit report available|aicpa trust services)\b",
        "violation_pattern": r"\b(?:no audit reports provided|self-attestation only|no independent security review)\b",
        "remediation_clause": "Vendor shall maintain annual SOC 2 Type II and ISO/IEC 27001 certifications conducted by an independent certified auditor, and shall deliver copies of its current audit reports (or executive summaries) to Customer at least annually upon written request under nondisclosure terms."
    },
    {
        "id": "termination_data_return",
        "title": "Termination for Convenience & Certified Erasure",
        "category": "Commercial & Liability",
        "severity": "High",
        "benchmark": "Customer must retain the right to terminate with 30-60 days notice and receive written confirmation of certified data destruction.",
        "keywords": ["termination for convenience", "data return", "data destruction", "certified erasure", "written notice", "transition assistance"],
        "compliant_pattern": r"\b(?:termination for convenience|certified destruction|data export prior to deletion|written confirmation of erasure|notice of termination)\b",
        "violation_pattern": r"\b(?:no right to terminate early|non-cancelable multi-year commitment|data retained post-termination without deletion covenant)\b",
        "remediation_clause": "Customer may terminate this Agreement for convenience upon sixty (60) days prior written notice. Within thirty (30) days following termination, Vendor shall certify in writing that all Customer Data, backups, and derivative copies have been irreversibly purged and destroyed in accordance with NIST SP 800-88 standards."
    }
]

class PolicyCheckerService:
    @staticmethod
    def audit_workspace_policies(
        db: Session,
        document_ids: Optional[List[str]] = None,
        category_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%B %d, %Y")

        if not docs:
            return {
                "audit_date": now_str,
                "overall_score": 0,
                "overall_grade": "N/A",
                "total_rules": len(ENTERPRISE_POLICY_RULES),
                "passed_count": 0,
                "warning_count": 0,
                "violation_count": 0,
                "audited_documents": [],
                "rules": [],
                "summary": "No indexed documents found in the selected scope. Upload documents in the Document Library to initiate a policy audit."
            }

        doc_ids = [d.id for d in docs]
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).order_by(DocumentChunk.chunk_index).all()
        findings = db.query(Finding).filter(
            (Finding.doc_a_id.in_(doc_ids)) | (Finding.doc_b_id.in_(doc_ids))
        ).all()

        doc_title_map = {d.id: d.title or d.filename for d in docs}
        all_text = " ".join([c.content for c in chunks])
        all_text_lower = all_text.lower()

        audited_rules = []
        passed_count = 0
        warning_count = 0
        violation_count = 0

        rules_to_eval = ENTERPRISE_POLICY_RULES
        if category_filter and category_filter != "all":
            rules_to_eval = [r for r in rules_to_eval if r["category"].lower() == category_filter.lower()]

        for rule in rules_to_eval:
            # 1. Search for keyword presence in chunks
            matching_chunks = []
            for c in chunks:
                c_lower = c.content.lower()
                matches = sum(1 for kw in rule["keywords"] if kw in c_lower)
                if matches >= 1:
                    matching_chunks.append((matches, c))

            matching_chunks.sort(key=lambda x: x[0], reverse=True)

            status = "NEEDS_REVIEW"
            evidence_line = ""
            evidence_source = ""
            violation_notes = ""

            if matching_chunks:
                top_chunk = matching_chunks[0][1]
                # Find best matching line in chunk
                lines = top_chunk.content.splitlines()
                best_line = ""
                for line in lines:
                    line_clean = re.sub(r'^[#| \-:]+', '', line).strip()
                    if any(kw in line_clean.lower() for kw in rule["keywords"]):
                        best_line = line_clean
                        break
                if not best_line and lines:
                    best_line = lines[0].strip()

                evidence_line = best_line[:240]
                evidence_source = f"{doc_title_map.get(top_chunk.document_id, 'Document')}, Page {top_chunk.page_number}"

                # Check regex compliance
                combined_chunk_text = " ".join([mc[1].content for mc in matching_chunks[:3]])
                has_violation = bool(re.search(rule["violation_pattern"], combined_chunk_text, re.IGNORECASE))
                has_compliant = bool(re.search(rule["compliant_pattern"], combined_chunk_text, re.IGNORECASE))

                if has_violation:
                    status = "VIOLATION"
                    violation_notes = f"Contractual language conflicts with standard policy benchmark ({rule['benchmark']})."
                    violation_count += 1
                elif has_compliant:
                    status = "COMPLIANT"
                    violation_notes = "Policy provision satisfies enterprise governance benchmark."
                    passed_count += 1
                else:
                    status = "NEEDS_REVIEW"
                    violation_notes = "Related terms identified, but explicit warranty or numerical SLA requires verification."
                    warning_count += 1
            else:
                status = "VIOLATION"
                evidence_line = "No explicit covenants or clauses addressing this policy requirement were identified in the corpus."
                evidence_source = "Corpus Scan (Omission)"
                violation_notes = "Omission: Missing mandatory enterprise policy provision."
                violation_count += 1

            audited_rules.append({
                "id": rule["id"],
                "title": rule["title"],
                "category": rule["category"],
                "severity": rule["severity"],
                "benchmark": rule["benchmark"],
                "status": status,
                "evidence_quote": evidence_line,
                "evidence_source": evidence_source,
                "violation_notes": violation_notes,
                "remediation_clause": rule["remediation_clause"]
            })

        total_rules = len(audited_rules)
        # Score calculation: Compliant = 100%, Needs Review = 50%, Violation = 0%
        if total_rules > 0:
            score_points = (passed_count * 100) + (warning_count * 50)
            overall_score = round(score_points / (total_rules * 100) * 100)
        else:
            overall_score = 100

        if overall_score >= 90:
            grade = "A+"
        elif overall_score >= 80:
            grade = "A"
        elif overall_score >= 70:
            grade = "B"
        elif overall_score >= 60:
            grade = "C"
        else:
            grade = "F"

        doc_titles = [d.title or d.filename for d in docs]
        summary_text = (
            f"Evaluated {len(docs)} document(s) against {total_rules} Fortune 500 enterprise governance rules. "
            f"Achieved an overall Policy Health Score of {overall_score}% (Grade {grade}), with {passed_count} fully compliant rule(s), "
            f"{warning_count} advisory review item(s), and {violation_count} flagged policy gap(s)."
        )

        return {
            "audit_date": now_str,
            "overall_score": overall_score,
            "overall_grade": grade,
            "total_rules": total_rules,
            "passed_count": passed_count,
            "warning_count": warning_count,
            "violation_count": violation_count,
            "audited_documents": doc_titles,
            "rules": audited_rules,
            "summary": summary_text
        }
