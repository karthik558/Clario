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
                "keywords": ["processor", "controller", "data processing", "audit rights", "subprocessor"],
                "required": True,
                "description": "Binding processor obligations to act strictly on documented instructions."
            },
            {
                "id": "gdpr-art32",
                "title": "Article 32 Technical Safeguards",
                "clause_target": "Security & Encryption Controls",
                "keywords": ["encryption", "pseudonymization", "confidentiality", "integrity", "resilience"],
                "required": True,
                "description": "State-of-the-art encryption at rest and in transit."
            },
            {
                "id": "gdpr-art33",
                "title": "Article 33 Incident Notification",
                "clause_target": "72-Hour Breach Escalation",
                "keywords": ["breach", "incident", "72 hours", "notification without undue delay"],
                "required": True,
                "description": "Mandatory breach notice within 72 hours of awareness."
            },
            {
                "id": "gdpr-art44",
                "title": "Article 44+ Cross-Border Transfers",
                "clause_target": "Standard Contractual Clauses (SCCs)",
                "keywords": ["transfer", "cross-border", "standard contractual clauses", "scc", "adequacy"],
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
                "keywords": ["business associate", "phi", "protected health information", "covered entity", "baa"],
                "required": True,
                "description": "Formal covenant governing third-party processing of PHI."
            },
            {
                "id": "hipaa-enc",
                "title": "Security Rule Safeguards & Encryption",
                "clause_target": "NIST-Grade PHI Encryption",
                "keywords": ["encryption", "fips", "aes-256", "transit", "at rest", "safeguard"],
                "required": True,
                "description": "End-to-end encryption for electronic Protected Health Information (ePHI)."
            },
            {
                "id": "hipaa-audit",
                "title": "Audit Logs & Access Verification",
                "clause_target": "Comprehensive Traceability",
                "keywords": ["audit trail", "access log", "immutable", "inspection", "retention"],
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
                "keywords": ["access control", "multi-factor", "mfa", "rbac", "least privilege"],
                "required": True,
                "description": "Enforcement of least privilege and multi-factor authentication."
            },
            {
                "id": "soc2-cc7",
                "title": "CC7.2 Continuous Security Monitoring",
                "clause_target": "Threat Detection & Alerting",
                "keywords": ["monitoring", "siem", "alerting", "vulnerability scan", "penetration testing"],
                "required": True,
                "description": "Real-time infrastructure telemetry and vulnerability management."
            },
            {
                "id": "soc2-cc8",
                "title": "CC8.1 Change Management Covenants",
                "clause_target": "Separation of Environments",
                "keywords": ["change management", "code review", "staging", "peer review", "deployment"],
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
                "keywords": ["transparency", "model card", "documentation", "explainability", "ai"],
                "required": True,
                "description": "Clear disclosure of AI system capabilities, boundaries, and model specifications."
            },
            {
                "id": "ai-human-oversight",
                "title": "Article 14 Human Oversight (HITL)",
                "clause_target": "Manual Intervention Controls",
                "keywords": ["human oversight", "human-in-the-loop", "override", "reviewable", "veto"],
                "required": True,
                "description": "Interface mechanisms enabling human operators to override automated decisions."
            },
            {
                "id": "ai-data-gov",
                "title": "Article 10 Training Data Governance",
                "clause_target": "Provenance & Zero Data Retention",
                "keywords": ["training data", "provenance", "copyright", "bias", "retention", "zdr"],
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
    def run_audit(db: Session, document_ids: Optional[List[str]] = None, framework_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.all()
        corpus_text = " ".join([c.content.lower() for c in chunks])

        target_fws = FRAMEWORKS
        if framework_ids:
            target_fws = [f for f in FRAMEWORKS if f["id"] in framework_ids]

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
                matched_keywords = [kw for kw in req["keywords"] if kw in corpus_text]
                is_passed = len(matched_keywords) >= 2 or (len(req["keywords"]) == 1 and len(matched_keywords) == 1)

                if is_passed:
                    fw_passed += 1
                    passed_checks += 1
                    status = "compliant"
                    # Find supporting chunk quote
                    supporting_quote = ""
                    for c in chunks:
                        if any(kw in c.content.lower() for kw in matched_keywords):
                            supporting_quote = c.content[:240].strip() + "..."
                            break
                    criteria_results.append({
                        "id": req["id"],
                        "title": req["title"],
                        "clause_target": req["clause_target"],
                        "status": status,
                        "description": req["description"],
                        "evidence_quote": supporting_quote or "Clause explicitly verified across active corpus."
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
            "frameworks": framework_reports,
            "gaps": all_gaps
        }
