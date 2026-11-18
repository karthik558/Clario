import re
import uuid
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import Document, DocumentChunk

FRAMEWORKS = [
    {
        "id": "gdpr",
        "name": "General Data Protection Regulation (GDPR)",
        "jurisdiction": "European Union",
        "category": "Data Privacy & Protection",
        "version": "2016/679",
        "requirements": [
            {
                "id": "gdpr-art28",
                "title": "Article 28 Processor Covenants",
                "clause_target": "Data Processing Terms & Audit Rights",
                "keywords": ["processor covenants", "data processing terms", "controller instructions", "audit rights under dpa"],
                "required": True,
                "description": "Binding processor obligations to act strictly on documented instructions."
            },
            {
                "id": "gdpr-art32",
                "title": "Article 32 Technical Safeguards",
                "clause_target": "Security & Encryption Controls",
                "keywords": ["technical and organizational measures", "encryption at rest and in transit", "pseudonymization"],
                "required": True,
                "description": "State-of-the-art encryption at rest and in transit."
            },
            {
                "id": "gdpr-art33",
                "title": "Article 33 Incident Notification",
                "clause_target": "72-Hour Breach Escalation",
                "keywords": ["72 hours of becoming aware", "breach notification without undue delay", "personal data breach notification"],
                "required": True,
                "description": "Mandatory breach notice within 72 hours of awareness."
            },
            {
                "id": "gdpr-art44",
                "title": "Article 44+ Cross-Border Transfers",
                "clause_target": "Standard Contractual Clauses (SCCs)",
                "keywords": ["standard contractual clauses", "international data transfers", "adequacy decision", "eu sccs"],
                "required": False,
                "description": "Mechanisms governing data export outside the EEA."
            }
        ]
    },
    {
        "id": "hipaa",
        "name": "Health Insurance Portability & Accountability Act (HIPAA)",
        "jurisdiction": "United States",
        "category": "Healthcare Data Privacy",
        "version": "HITECH Omnibus",
        "requirements": [
            {
                "id": "hipaa-baa",
                "title": "Business Associate Agreement (BAA)",
                "clause_target": "BAA Execution & Permitted Uses",
                "keywords": ["business associate agreement", "protected health information", "baa execution", "covered entity"],
                "required": True,
                "description": "Formal covenant governing third-party processing of PHI."
            },
            {
                "id": "hipaa-enc",
                "title": "Security Rule Safeguards & Encryption",
                "clause_target": "NIST-Grade PHI Encryption",
                "keywords": ["nist-grade encryption", "fips 140-2", "ephi encryption", "hipaa security rule"],
                "required": True,
                "description": "End-to-end encryption for electronic Protected Health Information (ePHI)."
            },
            {
                "id": "hipaa-audit",
                "title": "Audit Logs & Access Verification",
                "clause_target": "Comprehensive Traceability",
                "keywords": ["phi access audit logs", "immutable access log", "hipaa accounting of disclosures"],
                "required": True,
                "description": "Maintenance and verification of PHI access audit records."
            }
        ]
    },
    {
        "id": "soc2",
        "name": "SOC 2 Type II (Trust Services Criteria)",
        "jurisdiction": "Global / AICPA",
        "category": "Cloud Security & Integrity",
        "version": "2024 TSC",
        "requirements": [
            {
                "id": "soc2-cc6",
                "title": "CC6.1 Logical Access Controls & MFA",
                "clause_target": "Role-Based Access & Identity",
                "keywords": ["multi-factor authentication", "rbac enforcement", "least privilege access controls"],
                "required": True,
                "description": "Enforcement of least privilege and multi-factor authentication."
            },
            {
                "id": "soc2-cc7",
                "title": "CC7.2 Continuous Security Monitoring",
                "clause_target": "Threat Detection & Alerting",
                "keywords": ["siem monitoring", "intrusion detection", "vulnerability management program"],
                "required": True,
                "description": "Real-time infrastructure telemetry and vulnerability management."
            },
            {
                "id": "soc2-cc8",
                "title": "CC8.1 Change Management Covenants",
                "clause_target": "Separation of Environments",
                "keywords": ["separation of development and production", "peer code review requirements", "change management policy"],
                "required": False,
                "description": "Pre-deployment testing and separation of dev and prod environments."
            }
        ]
    },
    {
        "id": "eu_ai_act",
        "name": "EU Artificial Intelligence Act",
        "jurisdiction": "European Union",
        "category": "AI Safety & Governance",
        "version": "2024/1689",
        "requirements": [
            {
                "id": "ai-transparency",
                "title": "Article 13 Transparency & Documentation",
                "clause_target": "Model Architecture & System Prompts",
                "keywords": ["model card documentation", "system transparency instructions", "technical documentation for ai systems"],
                "required": True,
                "description": "Clear disclosure of AI system capabilities, boundaries, and model specifications."
            },
            {
                "id": "ai-human-oversight",
                "title": "Article 14 Human Oversight (HITL)",
                "clause_target": "Manual Intervention Controls",
                "keywords": ["human-in-the-loop oversight", "manual override mechanisms", "human operator intervention"],
                "required": True,
                "description": "Interface mechanisms enabling human operators to override automated decisions."
            },
            {
                "id": "ai-data-gov",
                "title": "Article 10 Training Data Governance",
                "clause_target": "Provenance & Zero Data Retention",
                "keywords": ["training data provenance", "zero data retention covenant", "customer prompt exclusion from training"],
                "required": True,
                "description": "Covenants confirming customer prompt data is not used for model retraining."
            }
        ]
    }
]

class ComplianceService:
    @staticmethod
    def list_frameworks() -> List[Dict[str, Any]]:
        return [
            {
                "id": fw["id"],
                "name": fw["name"],
                "jurisdiction": fw["jurisdiction"],
                "category": fw["category"],
                "version": fw["version"],
                "total_criteria": len(fw["requirements"]),
            }
            for fw in FRAMEWORKS
        ]

    @staticmethod
    def run_audit(
        db: Session,
        document_ids: Optional[List[str]] = None,
        framework_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        doc_query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            doc_query = doc_query.filter(Document.id.in_(document_ids))
        docs = doc_query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.all()

        if not docs or not chunks:
            return {
                "overall_score": 0,
                "audited_documents": 0,
                "total_checks": 0,
                "passed_checks": 0,
                "gaps_count": 0,
                "scope_status": "empty_workspace",
                "scope_description": "No indexed documents found in the selected scope.",
                "frameworks": [],
                "gaps": []
            }

        corpus_text = " ".join([c.content for c in chunks])

        # Check if the active documents pertain to data privacy, healthcare, or AI regulatory covenants
        regulatory_patterns = [
            r'\bdata\s+processing\s+agreement\b',
            r'\bpersonal\s+data\s+processing\b',
            r'\bdata\s+controller\s+and\s+processor\b',
            r'\bbusiness\s+associate\s+agreement\b',
            r'\bprotected\s+health\s+information\b',
            r'\b\s*phi\s+covenants?\b',
            r'\bgdpr\s+(?:compliance|art(?:icle)?)\b',
            r'\bhipaa\s+(?:compliance|security\s+rule)\b',
            r'\bsoc\s*2\s+type\s+ii\b',
            r'\btrust\s+services\s+criteria\b',
            r'\bartificial\s+intelligence\s+act\b',
            r'\bgeneral-?purpose\s+ai\b',
            r'\bdata\s+protection\s+addendum\b',
            r'\bstandard\s+contractual\s+clauses\b'
        ]
        is_regulatory_contract = any(re.search(pat, corpus_text, re.IGNORECASE) for pat in regulatory_patterns)

        target_fws = FRAMEWORKS
        if framework_ids:
            target_fws = [f for f in FRAMEWORKS if f["id"] in framework_ids]

        # If the corpus is an internal spreadsheet/budget or non-regulatory record
        if not is_regulatory_contract:
            framework_reports = []
            for fw in target_fws:
                criteria_results = [
                    {
                        "id": req["id"],
                        "title": req["title"],
                        "clause_target": req["clause_target"],
                        "status": "not_applicable",
                        "description": req["description"],
                        "evidence_quote": f"Not applicable: Active documents ({docs[0].title if docs else 'Document'}) do not govern third-party data processing or cloud vendor commitments."
                    }
                    for req in fw["requirements"]
                ]
                framework_reports.append({
                    "framework_id": fw["id"],
                    "framework_name": fw["name"],
                    "jurisdiction": fw["jurisdiction"],
                    "category": fw["category"],
                    "readiness_score": 100,
                    "status": "Not Applicable to Scope",
                    "passed_count": 0,
                    "total_count": len(fw["requirements"]),
                    "criteria": criteria_results
                })

            return {
                "overall_score": 100,
                "audited_documents": len(docs),
                "total_checks": sum(len(f["requirements"]) for f in target_fws),
                "passed_checks": 0,
                "gaps_count": 0,
                "scope_status": "operational_non_regulatory",
                "scope_description": (
                    f"Analyzed {len(docs)} document(s) in active workspace. "
                    "The current scope consists of operational and financial records (such as Capex budget schedules) "
                    "rather than third-party data processing agreements (DPAs) or cloud vendor contracts. "
                    "Regulatory frameworks (GDPR, HIPAA, SOC 2, EU AI Act) apply to vendor data handling, clinical information, and AI systems."
                ),
                "frameworks": framework_reports,
                "gaps": []
            }

        # Otherwise, run the real compliance audit on regulatory/contractual documents
        total_checks = 0
        passed_checks = 0
        framework_reports = []
        all_gaps = []

        for fw in target_fws:
            fw_checks = 0
            fw_passed = 0
            criteria_results = []

            for req in fw["requirements"]:
                fw_checks += 1
                total_checks += 1

                supporting_chunk = None
                for c in chunks:
                    c_lower = c.content.lower()
                    chunk_matches = [kw for kw in req["keywords"] if kw in c_lower]
                    if len(chunk_matches) >= 1:
                        supporting_chunk = c
                        break

                is_passed = supporting_chunk is not None

                if is_passed:
                    fw_passed += 1
                    passed_checks += 1
                    status = "compliant"
                    supporting_quote = supporting_chunk.content[:240].strip() + "..."
                    criteria_results.append({
                        "id": req["id"],
                        "title": req["title"],
                        "clause_target": req["clause_target"],
                        "status": status,
                        "description": req["description"],
                        "evidence_quote": supporting_quote
                    })
                else:
                    status = "gap_identified" if req["required"] else "advisory_warning"
                    remediation = (
                        f"Insert mandatory amendment in agreement: 'Vendor shall ensure adherence to {req['title']} "
                        f"({req['clause_target']}) with documented auditability and zero unapproved delegation.'"
                    )
                    gap_item = {
                        "id": f"gap-{uuid.uuid4().hex[:8]}",
                        "framework_id": fw["id"],
                        "framework_name": fw["name"],
                        "criterion_id": req["id"],
                        "criterion_title": req["title"],
                        "severity": "critical" if req["required"] else "medium",
                        "clause_target": req["clause_target"],
                        "gap_summary": f"Missing or incomplete covenant covering {req['title']}.",
                        "remediation_clause": remediation
                    }
                    all_gaps.append(gap_item)
                    criteria_results.append({
                        "id": req["id"],
                        "title": req["title"],
                        "clause_target": req["clause_target"],
                        "status": status,
                        "description": req["description"],
                        "evidence_quote": "No unambiguous compliance covenant discovered in current document scope."
                    })

            fw_score = round((fw_passed / max(1, fw_checks)) * 100)
            framework_reports.append({
                "framework_id": fw["id"],
                "framework_name": fw["name"],
                "jurisdiction": fw["jurisdiction"],
                "category": fw["category"],
                "readiness_score": fw_score,
                "status": "Ready / Compliant" if fw_score >= 85 else "Partially Compliant" if fw_score >= 50 else "High Risk / Gaps Found",
                "passed_count": fw_passed,
                "total_count": fw_checks,
                "criteria": criteria_results
            })

        overall_score = round((passed_checks / max(1, total_checks)) * 100)

        return {
            "overall_score": overall_score,
            "audited_documents": len(docs),
            "total_checks": total_checks,
            "passed_checks": passed_checks,
            "gaps_count": len(all_gaps),
            "scope_status": "regulatory_scope",
            "scope_description": f"Audited {len(docs)} document(s) against selected regulatory compliance frameworks.",
            "frameworks": framework_reports,
            "gaps": all_gaps
        }
