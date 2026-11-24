import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import Document, DocumentChunk, Finding
from app.services.ai_generator import AIGenerator

class CritiqueService:
    @staticmethod
    def evaluate_corpus(
        db: Session,
        document_ids: Optional[List[str]] = None,
        custom_clause: Optional[str] = None,
        use_ai: bool = False
    ) -> Dict[str, Any]:
        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        findings_query = db.query(Finding)
        if document_ids:
            findings_query = findings_query.filter(
                (Finding.doc_a_id.in_(document_ids)) | (Finding.doc_b_id.in_(document_ids))
            )
        findings = findings_query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.all()

        if not chunks and not custom_clause and not docs:
            return {
                "evaluated_documents": 0,
                "findings_referenced": 0,
                "composite_risk_score": 0,
                "overall_assessment": "No documents uploaded in workspace. Upload documents to simulate red team review.",
                "leverage_summary": "Upload documents to begin adversarial review.",
                "mode": "standard",
                "personas": []
            }

        corpus_text = " ".join([c.content for c in chunks])
        if custom_clause:
            corpus_text += " " + custom_clause

        corpus_lower = corpus_text.lower()
        doc_names = [d.title or d.filename for d in docs]
        doc_label = ", ".join(doc_names[:3]) if doc_names else ("Custom Clause" if custom_clause else "Active Scope")

        # ---------------- AI-Powered Deep Multi-Persona Synthesis ----------------
        if use_ai and (corpus_text.strip() or findings):
            ai_result = CritiqueService._evaluate_with_ai(
                corpus_text=corpus_text,
                findings=findings,
                doc_label=doc_label,
                docs_count=len(docs)
            )
            if ai_result:
                return ai_result

        # ---------------- High-Precision Deterministic Multi-Persona Synthesis ----------------
        return CritiqueService._evaluate_heuristic(
            docs=docs,
            findings=findings,
            corpus_lower=corpus_lower,
            corpus_text=corpus_text
        )

    @staticmethod
    def _evaluate_with_ai(
        corpus_text: str,
        findings: List[Finding],
        doc_label: str,
        docs_count: int
    ) -> Optional[Dict[str, Any]]:
        sample_text = corpus_text[:2500] if len(corpus_text) > 2500 else corpus_text
        findings_bullets = "\n".join([f"- [{f.severity.upper()}] {f.title}: {f.description[:120]}" for f in findings[:4]])

        prompt = f"""You are the Red Team Audit Council reviewing '{doc_label}'.
Conduct an adversarial audit representing 5 executive roles:
1. general_counsel: General Legal Counsel (Liability caps, mutual indemnities)
2. cfo: Chief Financial Officer (Auto-renewals, price escalators)
3. ciso: Chief Information Security Officer (Data residency, 48h breach notice)
4. cco: Chief Compliance Officer (Regulatory compliance, GDPR/HIPAA audits)
5. coo: Chief Operating Officer (Uptime SLAs, exit transition)

Context:
\"\"\"
{sample_text}
\"\"\"
Known Prior Findings: {findings_bullets or "None pre-indexed"}

Respond strictly with a concise JSON object:
{{
  "composite_risk_score": <number 0-100>,
  "overall_assessment": "<2 sentence executive risk assessment>",
  "leverage_summary": "<1 sentence commercial leverage summary>",
  "personas": [
    {{
      "persona_id": "general_counsel",
      "role_title": "General Legal Counsel",
      "avatar_color": "navy",
      "focus": "Liability Super-Caps & Indemnification",
      "verdict": "<short verdict>",
      "risk_score": <number 0-100>,
      "red_flags": [
        {{
          "severity": "<Critical | High>",
          "point": "<Vulnerability Title>",
          "detail": "<Specific risk grounded in the text>",
          "counter_clause": "<Concrete replacement defense clause>"
        }}
      ]
    }},
    {{
      "persona_id": "cfo",
      "role_title": "Chief Financial Officer (CFO)",
      "avatar_color": "amber",
      "focus": "Auto-Renewal & Price Escalators",
      "verdict": "<short verdict>",
      "risk_score": <number 0-100>,
      "red_flags": [{{ "severity": "High", "point": "<Vulnerability>", "detail": "<Detail>", "counter_clause": "<Counter>" }}]
    }},
    {{
      "persona_id": "ciso",
      "role_title": "Chief Information Security Officer (CISO)",
      "avatar_color": "rose",
      "focus": "Data Residency & 48h Breach SLA",
      "verdict": "<short verdict>",
      "risk_score": <number 0-100>,
      "red_flags": [{{ "severity": "Critical", "point": "<Vulnerability>", "detail": "<Detail>", "counter_clause": "<Counter>" }}]
    }},
    {{
      "persona_id": "cco",
      "role_title": "Chief Compliance Officer (CCO)",
      "avatar_color": "emerald",
      "focus": "Regulatory Audits & Statutory DPA",
      "verdict": "<short verdict>",
      "risk_score": <number 0-100>,
      "red_flags": [{{ "severity": "High", "point": "<Vulnerability>", "detail": "<Detail>", "counter_clause": "<Counter>" }}]
    }},
    {{
      "persona_id": "coo",
      "role_title": "Chief Operating Officer (COO)",
      "avatar_color": "indigo",
      "focus": "Uptime SLAs & Exit Transition",
      "verdict": "<short verdict>",
      "risk_score": <number 0-100>,
      "red_flags": [{{ "severity": "High", "point": "<Vulnerability>", "detail": "<Detail>", "counter_clause": "<Counter>" }}]
    }}
  ]
}}"""

        data = AIGenerator.generate_json(
            prompt=prompt,
            system_prompt="You are Clario's Red Team Council Engine. Deliver rigorous, legally grounded adversarial contract analysis in strictly valid JSON.",
            max_tokens=1600,
            temperature=0.15,
            timeout=45.0
        )

        if not data or not isinstance(data, dict) or "personas" not in data or not isinstance(data["personas"], list):
            return None

        # Validate that personas list has valid items
        personas = data.get("personas", [])
        if len(personas) < 3:
            return None

        # Ensure all required persona fields are intact
        valid_personas = []
        for p in personas:
            if isinstance(p, dict) and p.get("persona_id") and p.get("role_title"):
                flags = p.get("red_flags", [])
                clean_flags = []
                for f in flags:
                    if isinstance(f, dict) and f.get("point"):
                        clean_flags.append({
                            "severity": f.get("severity", "High"),
                            "point": f.get("point", "Identified Contractual Risk"),
                            "detail": f.get("detail", "Contractual exposure detected upon deep AI analysis."),
                            "counter_clause": f.get("counter_clause", "Parties shall adopt standard mutual covenants.")
                        })
                valid_personas.append({
                    "persona_id": p.get("persona_id"),
                    "role_title": p.get("role_title"),
                    "avatar_color": p.get("avatar_color", "navy"),
                    "focus": p.get("focus", "Governance Scrutiny"),
                    "verdict": p.get("verdict", "Caution Advised"),
                    "risk_score": int(p.get("risk_score", 50)),
                    "red_flags": CritiqueService._deduplicate_flags(clean_flags, max_items=4)
                })

        return {
            "evaluated_documents": docs_count,
            "findings_referenced": len(findings),
            "composite_risk_score": int(data.get("composite_risk_score", 55)),
            "overall_assessment": data.get("overall_assessment", "Deep AI adversarial evaluation identified critical terms warranting redlines."),
            "leverage_summary": data.get("leverage_summary", "Counterparty terms contain unilateral restrictions; request mutual baseline amendments."),
            "mode": "ai_multi_persona_synthesis",
            "personas": valid_personas
        }

    @staticmethod
    def _deduplicate_flags(flags: List[Dict[str, Any]], max_items: int = 4) -> List[Dict[str, Any]]:
        seen_keys = set()
        deduped = []
        severity_priority = {"Critical": 3, "High": 2, "Medium": 1, "Low": 0}

        # Sort by severity priority so Critical and High risks take precedence
        sorted_flags = sorted(
            flags,
            key=lambda x: severity_priority.get(str(x.get("severity", "Medium")).capitalize(), 1),
            reverse=True
        )

        for f in sorted_flags:
            raw_title = str(f.get("point", "")).strip()
            # Normalize title to compare semantic duplicates
            norm_title = re.sub(r'[^a-z0-9]', '', raw_title.lower())
            if len(norm_title) < 4:
                norm_title = re.sub(r'[^a-z0-9]', '', str(f.get("detail", ""))[:40].lower())

            if norm_title in seen_keys:
                continue

            # Check if any existing key is an exact prefix or substring of another
            if any(norm_title in existing or existing in norm_title for existing in seen_keys if len(existing) > 10 and len(norm_title) > 10):
                continue

            seen_keys.add(norm_title)
            deduped.append(f)
            if len(deduped) >= max_items:
                break

        return deduped

    @staticmethod
    def _evaluate_heuristic(
        docs: List[Document],
        findings: List[Finding],
        corpus_lower: str,
        corpus_text: str
    ) -> Dict[str, Any]:
        # 1. Legal Persona Evaluation (General Legal Counsel)
        legal_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["liability", "indemn", "jurisdiction", "copyright", "defense"]):
                legal_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Add mutual liability super-cap and bilateral indemnification covenants."
                })

        if re.search(r'(?:aggregate|cumulative)\s+liability\s+(?:is\s+)?(?:capped|limited)|sole\s+remedy|waive[sd]?\s+(?:all\s+)?consequential\s+damages|capped\s+at\s+(?:fifty|\$100|nominal)', corpus_lower):
            legal_red_flags.append({
                "severity": "High",
                "point": "Asymmetric Liability Ceiling",
                "detail": "Damages are restricted by unilateral liability caps or exclusive remedy limitations.",
                "counter_clause": "Add mutual super-cap for confidentiality breaches and set mutual overall liability ceiling to trailing fees."
            })
        if re.search(r'exclusive\s+(?:jurisdiction|venue)\s+(?:shall\s+be|in)|binding\s+arbitration\s+in', corpus_lower):
            legal_red_flags.append({
                "severity": "Medium",
                "point": "Disadvantageous Forum Selection",
                "detail": "Exclusive venue designated in non-neutral territory creating dispute resolution friction.",
                "counter_clause": "Amend jurisdiction to mutual neutral forum or standard commercial arbitration."
            })
        if re.search(r'unilateral(?:ly)?\s+modify|update\s+(?:these\s+)?terms\s+without\s+notice|sole\s+discretion\s+to\s+amend', corpus_lower):
            legal_red_flags.append({
                "severity": "High",
                "point": "Unilateral Modification Clause",
                "detail": "Agreement permits counterparty to update terms or acceptable use policies without affirmative consent.",
                "counter_clause": "Require 30 days prior written notice and express customer termination right without penalty."
            })
        legal_red_flags = CritiqueService._deduplicate_flags(legal_red_flags, max_items=4)

        # 2. Financial Persona Evaluation (CFO)
        finance_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["renewal", "fee", "price", "financial", "payment"]):
                finance_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Eliminate auto-renewal lock-in and cap annual price escalation."
                })

        if re.search(r'auto(?:matic)?(?:ally)?\s+renew|renewal\s+for\s+(?:an\s+additional|\d+)\s+(?:months?|year)|prior\s+notice\s+of\s+non-renewal', corpus_lower):
            finance_red_flags.append({
                "severity": "Critical",
                "point": "Automatic Annual Renewal Lock-in",
                "detail": "Agreement auto-renews for successor multi-month periods unless formal non-renewal notice is delivered.",
                "counter_clause": "Require affirmative opt-in renewal notice or reduce non-renewal window to 30 calendar days."
            })
        if re.search(r'price\s+increase|annual\s+escalator|adjust\s+(?:the\s+)?fees?\s+(?:upon|at)|subsequent\s+term\s+pricing', corpus_lower):
            finance_red_flags.append({
                "severity": "High",
                "point": "Uncapped Price Escalators Upon Renewal",
                "detail": "Discretion reserved to adjust standard pricing or fees upon successive terms.",
                "counter_clause": "Cap annual renewal price increases to the lesser of 3% or CPI (Consumer Price Index)."
            })
        if re.search(r'late\s+(?:payment\s+)?fee|interest\s+at\s+(?:the\s+rate\s+of\s+)?\d+%(?:\s+per\s+month)?|penalty\s+for\s+late\s+payment', corpus_lower):
            finance_red_flags.append({
                "severity": "Medium",
                "point": "Aggressive Late Payment Penalties",
                "detail": "Overdue invoices incur compound interest or immediate suspension of service.",
                "counter_clause": "Require 15-day formal cure notice prior to late interest accrual or service suspension."
            })
        finance_red_flags = CritiqueService._deduplicate_flags(finance_red_flags, max_items=4)

        # 3. CISO Persona Evaluation
        ciso_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["retention", "breach", "telemetry", "incident", "security", "subprocessor"]):
                ciso_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Mandate strict data eradication and 72-hour security incident notification."
                })

        if re.search(r'(?:model|algorithm)\s+(?:training|retraining)\s+on\s+customer|telemetry\s+retention|prompt\s+(?:data\s+)?retention', corpus_lower):
            ciso_red_flags.append({
                "severity": "High",
                "point": "Ambiguous Model Telemetry Retention",
                "detail": "Customer prompt metadata and interaction telemetry retained without verified deletion schedules.",
                "counter_clause": "Mandate verifiable Zero Data Retention (ZDR) architecture."
            })
        if re.search(r'sub-?processors?\s+without\s+(?:prior\s+)?(?:notice|consent)|substitute\s+sub-?processors?', corpus_lower):
            ciso_red_flags.append({
                "severity": "Critical",
                "point": "Subprocessor Delegation Without Prior Veto",
                "detail": "Subprocessors may be engaged or substituted without affirmative customer approval.",
                "counter_clause": "Establish affirmative 30-day prior written notice with customer right to object or terminate."
            })
        if re.search(r'breach\s+notification|security\s+incident\s+(?:reporting|escalation)|notify\s+of\s+(?:any\s+)?security\s+breach', corpus_lower):
            ciso_red_flags.append({
                "severity": "High",
                "point": "Security Incident Notification Timeline",
                "detail": "Security incident notice window is not bound to a strict emergency timeline.",
                "counter_clause": "Strict contractual requirement for notice within 48 to 72 hours of confirmed security incident."
            })
        ciso_red_flags = CritiqueService._deduplicate_flags(ciso_red_flags, max_items=4)

        # 4. Chief Compliance Officer (CCO) Persona Evaluation
        cco_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["gdpr", "compliance", "regulatory", "audit", "sanctions", "statutory", "dpa"]):
                cco_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Incorporate standardized Data Protection Addendum (DPA) with explicit annual third-party audit verification."
                })

        if re.search(r'no\s+audit\s+rights|sole\s+expense\s+of\s+customer\s+audit|audit\s+limited\s+to\s+once\s+every\s+(?:two|three)\s+years', corpus_lower):
            cco_red_flags.append({
                "severity": "High",
                "point": "Restricted Regulatory Audit Rights",
                "detail": "Customer or supervisory authority inspection rights are unduly constrained or shifted fully to customer expense.",
                "counter_clause": "Grant customer and regulatory authorities annual inspection rights with SOC 2 Type II audit report delivery."
            })
        elif re.search(r'cross-?border\s+transfer|transfer\s+of\s+personal\s+data\s+outside|international\s+data\s+transfer', corpus_lower):
            cco_red_flags.append({
                "severity": "Critical",
                "point": "Unregulated Cross-Border Data Flows",
                "detail": "Customer personal data transferred across borders without incorporated Standard Contractual Clauses (SCCs).",
                "counter_clause": "Incorporate EU Standard Contractual Clauses (SCCs) and UK International Data Transfer Addendum."
            })
        else:
            cco_red_flags.append({
                "severity": "Medium",
                "point": "Absence of Express Statutory Indemnity",
                "detail": "Agreement lacks dedicated indemnity protecting customer against supervisory regulatory fines arising from vendor defaults.",
                "counter_clause": "Vendor shall defend and indemnify customer against all administrative fines and civil penalties resulting from vendor data breaches."
            })
        cco_red_flags = CritiqueService._deduplicate_flags(cco_red_flags, max_items=4)

        # 5. Chief Operating Officer (COO) Persona Evaluation
        coo_red_flags = []
        for f in findings:
            if any(k in f.title.lower() for k in ["sla", "uptime", "availability", "service level", "disaster", "transition", "continuity"]):
                coo_red_flags.append({
                    "severity": f.severity.title(),
                    "point": f.title,
                    "detail": f.description[:220],
                    "counter_clause": "Institute 99.9% availability SLA with tiered financial service credits and termination rights for chronic outages."
                })

        if re.search(r'as\s+is|as\s+available|no\s+(?:warranty\s+of\s+)?uninterrupted|best\s+efforts\s+availability', corpus_lower):
            coo_red_flags.append({
                "severity": "High",
                "point": "Disclaimed Operational Availability",
                "detail": "Services provided without formal Service Level Agreement (SLA) or enforceable uptime commitments.",
                "counter_clause": "Provide 99.9% monthly uptime guarantee backed by tiered service fee credits for non-compliance."
            })
        if re.search(r'no\s+transition\s+assistance|immediate\s+cessation\s+upon\s+termination|data\s+destroyed\s+(?:within\s+)?(?:\d+\s+days\s+of|immediately\s+upon)\s+termination', corpus_lower):
            coo_red_flags.append({
                "severity": "Critical",
                "point": "Abrupt Termination & Zero Exit Assistance",
                "detail": "Lack of disengagement assistance or orderly transition period creates severe vendor operational lock-in.",
                "counter_clause": "Vendor must provide 60-day post-termination transition support at standard rates and export all customer data in structured formats."
            })
        else:
            coo_red_flags.append({
                "severity": "Medium",
                "point": "Unspecified Disaster Recovery / RTO SLAs",
                "detail": "Recovery Time Objective (RTO) and Recovery Point Objective (RPO) SLAs are absent from contractual exhibits.",
                "counter_clause": "Contractually commit to a 4-hour RTO and 1-hour RPO with annual disaster recovery drill validation."
            })
        coo_red_flags = CritiqueService._deduplicate_flags(coo_red_flags, max_items=4)

        legal_score = min(100, len(legal_red_flags) * 32)
        finance_score = min(100, len(finance_red_flags) * 32)
        ciso_score = min(100, len(ciso_red_flags) * 32)
        cco_score = min(100, len(cco_red_flags) * 32)
        coo_score = min(100, len(coo_red_flags) * 32)
        composite_risk = round((legal_score + finance_score + ciso_score + cco_score + coo_score) / 5)

        def get_verdict(score: int, high_label: str) -> str:
            if score >= 60:
                return high_label
            elif score > 0:
                return "Caution: Minor Amendments Advised"
            return "Compliant: Low Exposure Detected"

        overall_assessment = (
            "High Exposure: Critical Provisions Requiring Immediate Redlining"
            if composite_risk >= 50
            else "Moderate Exposure: Review Identified Provisions Prior to Execution"
            if composite_risk > 0
            else "Balanced Risk Profile: No Severe Red Flags Detected in Analyzed Scope"
        )
        leverage_summary = (
            "Strong bargaining position on pricing escalators and unilateral terms; address identified red flags."
            if composite_risk >= 40
            else "Standard terms with manageable exposure."
        )

        return {
            "evaluated_documents": len(docs),
            "findings_referenced": len(findings),
            "composite_risk_score": composite_risk,
            "overall_assessment": overall_assessment,
            "leverage_summary": leverage_summary,
            "mode": "heuristic_synthesis",
            "personas": [
                {
                    "persona_id": "general_counsel",
                    "role_title": "General Legal Counsel",
                    "avatar_color": "navy",
                    "verdict": get_verdict(legal_score, "Veto Without Protective Covenants"),
                    "risk_score": legal_score,
                    "focus": "Liability Super-Caps, Indemnification Asymmetry & Governing Law",
                    "red_flags": legal_red_flags
                },
                {
                    "persona_id": "cfo",
                    "role_title": "Chief Financial Officer (CFO)",
                    "avatar_color": "amber",
                    "verdict": get_verdict(finance_score, "Budget Risk: Escalator Cap Required"),
                    "risk_score": finance_score,
                    "focus": "Auto-Renewal Lock-in, Uncapped Price Escalation & Hidden Fees",
                    "red_flags": finance_red_flags
                },
                {
                    "persona_id": "ciso",
                    "role_title": "Chief Information Security Officer (CISO)",
                    "avatar_color": "rose",
                    "verdict": get_verdict(ciso_score, "Security Exception: Subprocessor Notice Insufficient"),
                    "risk_score": ciso_score,
                    "focus": "Data Residency, Subprocessor Veto & 48h Breach Notification SLA",
                    "red_flags": ciso_red_flags
                },
                {
                    "persona_id": "cco",
                    "role_title": "Chief Compliance Officer (CCO)",
                    "avatar_color": "emerald",
                    "verdict": get_verdict(cco_score, "Regulatory Gap: DPA & Audit Rights Deficient"),
                    "risk_score": cco_score,
                    "focus": "Regulatory Governance, Audit Rights, GDPR / Statutory Mandates",
                    "red_flags": cco_red_flags
                },
                {
                    "persona_id": "coo",
                    "role_title": "Chief Operating Officer (COO)",
                    "avatar_color": "indigo",
                    "verdict": get_verdict(coo_score, "Operational Risk: Uncommitted SLAs & Lock-in"),
                    "risk_score": coo_score,
                    "focus": "Service Level Commitments (SLAs), Business Continuity & Transition Exit",
                    "red_flags": coo_red_flags
                }
            ]
        }

    @staticmethod
    def draft_counter_clause(
        point: str,
        detail: str,
        persona_id: str = "general_counsel",
        document_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Drafts a tailored counter-clause for a specific council vulnerability option using AI.
        """
        role_map = {
            "general_counsel": "General Legal Counsel (focus on liability super-caps, mutual indemnification, and dispute venue)",
            "cfo": "Chief Financial Officer (focus on eliminating auto-renewal traps, capping price escalators at CPI/3%, and cure periods for billing)",
            "ciso": "Chief Information Security Officer (focus on 48h emergency breach notice, zero data retention, and subprocessor veto rights)",
            "cco": "Chief Compliance Officer (focus on statutory audit rights, EU SCCs, and indemnification against regulatory fines)",
            "coo": "Chief Operating Officer (focus on 99.9% uptime SLA service credits, disaster recovery RTO/RPO, and 60-day exit transition support)"
        }
        role_desc = role_map.get(persona_id, "Senior Enterprise Corporate Counsel")

        ans_len = getattr(settings, "ANSWER_LENGTH", "standard")
        if ans_len == "concise":
            len_guideline = "Provide a crisp, ultra-concise 1-sentence protective clause and 1 sentence rationale. Minimize verbosity for fast execution."
            token_limit = 250
        elif ans_len == "comprehensive":
            len_guideline = "Provide a comprehensive, robust multi-sentence covenant with complete indemnification and warranty terms."
            token_limit = 800
        else:
            len_guideline = "Provide a balanced, enforceable protective contractual clause."
            token_limit = 500

        ai_prompt = f"""You are the {role_desc}.
Vulnerability Identified: {point}
Contract Risk Detail: {detail}
Document Context: {document_title or "Commercial Agreement"}
Instruction: {len_guideline}

Draft a precise, enforceable, protective counter-clause that senior counsel can insert directly into a redline to neutralize this risk.
Return a valid JSON object:
{{
  "counter_clause": "<Direct, ready-to-use contractual clause text in quotes>",
  "rationale": "<1-2 sentence strategic reason why this counter-clause protects the client>"
}}"""

        ai_data = AIGenerator.generate_json(
            prompt=ai_prompt,
            system_prompt="You are Clario's Red Team Counter-Clause Drafting Engine. Respond strictly in JSON.",
            max_tokens=token_limit,
            temperature=0.15,
            timeout=25.0
        )

        if ai_data and isinstance(ai_data, dict) and ai_data.get("counter_clause"):
            return {
                "point": point,
                "counter_clause": str(ai_data.get("counter_clause")).strip().strip('"'),
                "rationale": str(ai_data.get("rationale", "AI-synthesized protective amendment.")),
                "mode": "ai_generated"
            }

        # High-quality fallback counter-clauses if LLM is unavailable
        fallback_map = {
            "general_counsel": "Notwithstanding any provision to the contrary, each party's aggregate liability under this Agreement shall be subject to a mutual ceiling of twelve (12) months of fees paid, with uncapped liability strictly preserved for breaches of confidentiality and third-party IP indemnification.",
            "cfo": "This Agreement shall not renew automatically without affirmative written consent delivered at least thirty (30) days prior to term expiration. In no event shall renewal pricing increase by more than the lesser of three percent (3%) or the annual Consumer Price Index (CPI).",
            "ciso": "Vendor shall maintain verifiable Zero Data Retention (ZDR) architecture and covenants to deliver formal written notice of any confirmed or suspected Security Incident within forty-eight (48) hours of discovery, together with forensic mitigation logs.",
            "cco": "Vendor warrants compliance with all applicable statutory and regulatory mandates (including GDPR and HIPAA) and grants Customer and supervisory authorities the right to conduct annual third-party audits with delivery of certified SOC 2 Type II reports.",
            "coo": "Vendor commits to a 99.9% monthly Service Level Agreement (SLA). In the event of chronic unexcused downtime exceeding 0.5% in any calendar quarter, Customer may terminate without penalty and receive full unearned prepaid refunds."
        }
        fallback_clause = fallback_map.get(
            persona_id,
            "The parties agree to bilateral good-faith commercial remedies and thirty (30) days prior notice for material operational modifications."
        )
        return {
            "point": point,
            "counter_clause": fallback_clause,
            "rationale": f"Standardized institutional safeguard formulated for {role_desc.split('(')[0].strip()}.",
            "mode": "standard_safeguard"
        }

    @staticmethod
    def evaluate_single_persona(
        db: Session,
        persona_id: str,
        document_ids: Optional[List[str]] = None,
        custom_clause: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Runs a focused AI evaluation from a single executive persona's distinct viewpoint & personality.
        """
        persona_profiles = {
            "general_counsel": {
                "role_title": "General Legal Counsel",
                "avatar_color": "navy",
                "focus": "Liability Super-Caps & Indemnification",
                "personality": "Skeptical chief legal officer who rejects uncapped customer liability, unilateral indemnities, and hostile governing venues.",
            },
            "cfo": {
                "role_title": "Chief Financial Officer (CFO)",
                "avatar_color": "amber",
                "focus": "Auto-Renewal & Price Escalators",
                "personality": "Disciplined finance executive focused on budget predictability, multi-year lock-in traps, CPI fee caps, and prepaid refund rights.",
            },
            "ciso": {
                "role_title": "Chief Information Security Officer (CISO)",
                "avatar_color": "rose",
                "focus": "Data Residency & 48h Breach SLA",
                "personality": "Zero-trust security leader who demands Zero Data Retention, 48-hour breach notification, SOC 2 Type II, and subprocessor vetting.",
            },
            "cco": {
                "role_title": "Chief Compliance Officer (CCO)",
                "avatar_color": "emerald",
                "focus": "Regulatory Audits & Statutory DPA",
                "personality": "Strict regulatory gatekeeper enforcing GDPR Article 28/32, EU AI Act transparency, HIPAA BAAs, and statutory audit rights.",
            },
            "coo": {
                "role_title": "Chief Operating Officer (COO)",
                "avatar_color": "indigo",
                "focus": "Uptime SLAs & Exit Transition",
                "personality": "Pragmatic operations chief guarding service continuity, 99.9% uptime SLA service credits, and 60-day exit transition assistance.",
            },
        }
        profile = persona_profiles.get(persona_id, persona_profiles["general_counsel"])

        query = db.query(Document).filter(Document.status == "READY")
        if document_ids:
            query = query.filter(Document.id.in_(document_ids))
        docs = query.all()

        chunks_query = db.query(DocumentChunk)
        if document_ids:
            chunks_query = chunks_query.filter(DocumentChunk.document_id.in_(document_ids))
        chunks = chunks_query.order_by(DocumentChunk.chunk_index).limit(12).all()

        corpus_text = "\n".join([c.content for c in chunks])
        if custom_clause:
            corpus_text = f"{custom_clause}\n\n{corpus_text}"

        if not corpus_text.strip():
            return {
                "persona_id": persona_id,
                "role_title": profile["role_title"],
                "avatar_color": profile["avatar_color"],
                "focus": profile["focus"],
                "verdict": "Upload Documents to Audit",
                "risk_score": 0,
                "red_flags": [],
                "mode": "empty_scope",
            }

        prompt = f"""Adopt this exact executive persona and personality:
Role: {profile['role_title']}
Personality & Mandate: {profile['personality']}
Primary Focus: {profile['focus']}

Review the following document excerpts strictly through the lens of {profile['role_title']}:
\"\"\"
{corpus_text[:2200]}
\"\"\"

Return valid JSON with 2-3 concrete findings:
{{
  "verdict": "<2-4 word verdict reflecting this persona's stance>",
  "risk_score": <integer 0-100>,
  "red_flags": [
    {{
      "severity": "<Critical | High | Medium>",
      "point": "<Concise risk title from this persona's viewpoint>",
      "detail": "<Specific finding in this persona's voice>",
      "counter_clause": "<Ready-to-insert protective clause>"
    }}
  ]
}}"""

        ai_data = AIGenerator.generate_json(
            prompt=prompt,
            system_prompt=f"You are acting strictly as {profile['role_title']}. Stay in character and respond in valid JSON.",
            max_tokens=700,
            temperature=0.2,
            timeout=65.0,
        )

        if ai_data and isinstance(ai_data, dict) and isinstance(ai_data.get("red_flags"), list) and len(ai_data["red_flags"]) > 0:
            clean_flags = [
                {
                    "severity": str(f.get("severity", "High")),
                    "point": str(f.get("point", "Identified Exposure")),
                    "detail": str(f.get("detail", "Review recommended.")),
                    "counter_clause": str(f.get("counter_clause", "Parties shall adopt mutual safeguards.")),
                }
                for f in ai_data["red_flags"]
                if isinstance(f, dict) and f.get("point")
            ]
            if clean_flags:
                return {
                    "persona_id": persona_id,
                    "role_title": profile["role_title"],
                    "avatar_color": profile["avatar_color"],
                    "focus": profile["focus"],
                    "verdict": str(ai_data.get("verdict", "Caution Advised")),
                    "risk_score": int(ai_data.get("risk_score", 55)),
                    "red_flags": CritiqueService._deduplicate_flags(clean_flags, max_items=4),
                    "mode": "ai_persona_synthesis",
                }

        # Fallback to deterministic evaluation for that specific persona
        baseline = CritiqueService.evaluate_corpus(db, document_ids=document_ids, custom_clause=custom_clause, use_ai=False)
        for p in baseline.get("personas", []):
            if p.get("persona_id") == persona_id:
                p["mode"] = "heuristic_persona"
                return p

        return {
            "persona_id": persona_id,
            "role_title": profile["role_title"],
            "avatar_color": profile["avatar_color"],
            "focus": profile["focus"],
            "verdict": "Standard Review",
            "risk_score": 40,
            "red_flags": [],
            "mode": "heuristic_persona",
        }
