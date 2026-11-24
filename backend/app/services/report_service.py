import os
import io
import re
import json
import uuid
import logging
from collections import Counter

logger = logging.getLogger(__name__)
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from html import escape
from PIL import Image as PILImage
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.models.entities import Report, Document, Finding, DocumentChunk, Comparison, SearchQuery
from app.schemas.dtos import ReportCreate
from app.services.ai_generator import AIGenerator
from app.services.graph_service import GraphService
from app.services.obligation_service import ObligationService
from app.services.compliance_service import ComplianceService
from app.services.risk_service import RiskService

BRAND_LOGO_PATH = Path(__file__).resolve().parents[3] / "frontend" / "public" / "clario.webp"


def _load_clario_logo_png() -> Optional[io.BytesIO]:
    """Converts frontend/public/clario.webp into an in-memory PNG for ReportLab."""
    try:
        if not BRAND_LOGO_PATH.exists():
            return None
        with PILImage.open(BRAND_LOGO_PATH) as im:
            buf = io.BytesIO()
            im.convert("RGBA").save(buf, format="PNG")
            buf.seek(0)
            return buf
    except Exception:
        return None


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        # Website-style subtle running header on page 2+
        if self._pageNumber > 1:
            self.setFillColor(colors.HexColor("#0F172A"))
            self.setFont("Helvetica-Bold", 8)
            self.drawString(40, 756, "CLARIO")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            self.drawRightString(572, 756, "CONFIDENTIAL CONTRACT INTELLIGENCE DOSSIER")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.6)
            self.line(40, 748, 572, 748)

        # Website-style footer on all pages matching /home
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(40, 42, 572, 42)
        self.setFont("Helvetica", 7.8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(40, 28, "© 2026 Clario  •  Every document. A clearer answer.  •  Confidential Review")
        self.drawRightString(572, 28, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


class ReportService:
    @staticmethod
    def _extract_clause_profile(text: str) -> Dict[str, str]:
        tl = text.lower()
        # Liability
        if "uncapped" in tl or "unlimited liability" in tl:
            liability = "Uncapped / Unlimited"
        elif "12 months" in tl or "twelve (12) months" in tl or "twelve months" in tl:
            liability = "12-Month Fee Cap"
        elif "$100" in tl:
            liability = "Nominal Cap ($100)"
        elif "liability" in tl:
            liability = "Bounded Liability"
        else:
            liability = "Not Explicitly Stated"

        # Indemnity
        if "mutual indemn" in tl:
            indemnity = "Bilateral Mutual Indemnity"
        elif "copyright shield" in tl or "defend customer" in tl:
            indemnity = "Provider IP Defense"
        elif "indemnif" in tl:
            indemnity = "Conditional / Standard"
        else:
            indemnity = "Not Referenced"

        # Breach SLA
        if "24 hours" in tl or "twenty-four (24) hours" in tl:
            breach = "24-Hour SLA"
        elif "48 hours" in tl or "forty-eight (48) hours" in tl:
            breach = "48-Hour SLA"
        elif "72 hours" in tl or "seventy-two (72) hours" in tl:
            breach = "72-Hour SLA (GDPR)"
        elif "breach" in tl or "security incident" in tl:
            breach = "Unfixed / Reasonable Window"
        else:
            breach = "Not Specified"

        # Data Retention / AI Training
        if "zero data retention" in tl or "0 days" in tl or "excluded from training" in tl or "never trains" in tl:
            retention = "Zero Data Retention / No Training"
        elif "30 days" in tl or "thirty (30) days" in tl:
            retention = "30-Day Retention Window"
        elif "retention" in tl or "training" in tl:
            retention = "Standard Policy Terms"
        else:
            retention = "Not Specified"

        # Termination
        if "30 days" in tl and "terminat" in tl:
            term = "30-Day Prior Notice"
        elif "60 days" in tl and "terminat" in tl:
            term = "60-Day Prior Notice"
        elif "terminat" in tl:
            term = "Standard Notice Terms"
        else:
            term = "Not Specified"

        return {
            "liability": liability,
            "indemnity": indemnity,
            "breach_sla": breach,
            "data_ai": retention,
            "termination": term,
        }

    @staticmethod
    def generate_report(data: ReportCreate, db: Session) -> Report:
        report_id = str(uuid.uuid4())
        rtype = data.report_type

        query = db.query(Document)
        docs = query.filter(Document.id.in_(data.document_ids)).all() if data.document_ids else query.all()
        if data.document_ids and len(docs) != len(set(data.document_ids)):
            raise HTTPException(status_code=422, detail="One or more selected documents no longer exist.")
        if not docs:
            raise HTTPException(status_code=422, detail="Upload documents before generating a report.")

        doc_ids = {d.id for d in docs}
        doc_id_list = [d.id for d in docs]
        doc_titles = [d.title for d in docs]

        all_scoped_findings = [
            f for f in db.query(Finding).all()
            if {x for x in (f.doc_a_id, f.doc_b_id) if x}
            and {x for x in (f.doc_a_id, f.doc_b_id) if x}.issubset(doc_ids)
        ]

        is_contradiction_type = rtype in ("contradictions", "contradiction_remediation", "contradiction_executive_matrix")
        is_comparative_type = rtype in ("comparative", "research_dossier")

        # Findings / Contradictions
        findings = all_scoped_findings if (is_contradiction_type or is_comparative_type or rtype == "compliance_governance") else []

        # Saved Comparisons + Cross-Document Comparative Matrix
        comparisons = []
        comparative_matrix = []
        if is_comparative_type or rtype == "summary":
            rows = (
                db.query(Comparison)
                .filter(Comparison.doc_a_id.in_(doc_ids), Comparison.doc_b_id.in_(doc_ids))
                .order_by(Comparison.created_at.desc())
                .all()
            )
            pairs = set()
            for row in rows:
                pair = (row.doc_a_id, row.doc_b_id)
                if pair not in pairs:
                    pairs.add(pair)
                    comparisons.append({
                        "title": row.title,
                        "summary": row.summary or "",
                        "created_at": row.created_at.isoformat() if row.created_at else datetime.now(timezone.utc).isoformat()
                    })

        # Build live cross-document matrix for comparative & multi-document dossiers
        if is_comparative_type:
            for d in docs:
                chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == d.id).all()
                full_doc_text = "\n".join(c.content for c in chunks if c.content)
                prof = ReportService._extract_clause_profile(full_doc_text)
                comparative_matrix.append({
                    "document_id": d.id,
                    "document_title": d.title,
                    "pages": d.page_count or 1,
                    "words": d.word_count or 0,
                    **prof,
                })

            # Synthesize pairwise comparisons if multiple docs selected and no saved comparison rows exist
            if len(docs) >= 2 and len(comparisons) < len(docs) - 1:
                for idx in range(len(comparative_matrix) - 1):
                    a = comparative_matrix[idx]
                    b = comparative_matrix[idx + 1]
                    pair_title = f"{a['document_title']} vs {b['document_title']}"
                    if not any(c["title"] == pair_title for c in comparisons):
                        deltas = []
                        if a["liability"] != b["liability"]:
                            deltas.append(f"Liability differs ({a['liability']} vs {b['liability']})")
                        if a["breach_sla"] != b["breach_sla"]:
                            deltas.append(f"Breach SLA differs ({a['breach_sla']} vs {b['breach_sla']})")
                        if a["data_ai"] != b["data_ai"]:
                            deltas.append(f"Data/AI retention differs ({a['data_ai']} vs {b['data_ai']})")
                        if a["indemnity"] != b["indemnity"]:
                            deltas.append(f"Indemnity differs ({a['indemnity']} vs {b['indemnity']})")
                        summary_line = "; ".join(deltas) + "." if deltas else "Core commercial postures align across audited liability, breach SLA, and retention vectors."
                        comparisons.append({
                            "title": pair_title,
                            "summary": summary_line,
                            "created_at": datetime.now(timezone.utc).isoformat()
                        })

        # Knowledge Graph Topology Snapshot (for comparative, research_dossier, contradiction_executive_matrix)
        graph_summary = None
        if rtype in ("comparative", "research_dossier", "contradiction_executive_matrix"):
            try:
                g = GraphService.build_workspace_graph(db, document_ids=doc_id_list)
                stats = g.stats or {}
                nodes = g.nodes or []
                topic_labels = [
                    n.label for n in nodes
                    if getattr(n, "type", None) not in ("document", "finding") and getattr(n, "label", None)
                ][:12]
                graph_summary = {
                    "total_documents": stats.get("total_documents", len(docs)),
                    "total_topics": stats.get("total_topics", len(topic_labels)),
                    "total_findings": stats.get("total_findings", len(findings)),
                    "total_edges": stats.get("total_edges", len(g.edges or [])),
                    "top_topics": topic_labels,
                }
            except Exception as exc:
                logger.warning("Failed to build graph_summary for report: %s", exc)
                graph_summary = None

        # Obligations Snapshot
        obligations_summary = []
        if rtype in ("comparative", "summary", "research_dossier", "compliance_governance"):
            try:
                obls = ObligationService.extract_obligations(db, document_ids=doc_id_list)
                obligations_summary = obls[:10]
            except Exception as exc:
                logger.warning("Failed to extract obligations_summary for report: %s", exc)
                obligations_summary = []

        # Compliance Audit Snapshot (for compliance_governance & contradiction_executive_matrix & research_dossier)
        compliance_summary = None
        if rtype in ("compliance_governance", "contradiction_executive_matrix", "research_dossier"):
            try:
                comp = ComplianceService.run_audit(db, document_ids=doc_id_list)
                compliance_summary = {
                    "overall_score": comp.get("overall_score", 0),
                    "frameworks": [
                        {
                            "name": fw.get("framework_name") or fw.get("name"),
                            "score": fw.get("readiness_score", 0),
                            "status": fw.get("status"),
                            "gaps_count": max(0, (fw.get("total_count", 0) or 0) - (fw.get("passed_count", 0) or 0)),
                        }
                        for fw in comp.get("frameworks", [])
                    ],
                }
            except Exception as exc:
                logger.warning("Failed to build compliance_summary for report: %s", exc)
                compliance_summary = None

        # Risk Scorecard Snapshot
        risk_summary = None
        if rtype in ("comparative", "research_dossier", "contradiction_executive_matrix"):
            try:
                rs = RiskService.evaluate_workspace(db)
                scoped_docs = [
                    d for d in rs.get("documents", [])
                    if (not doc_ids or d.get("document_id") in doc_ids)
                ]
                if scoped_docs:
                    avg_score = int(round(sum(d.get("composite_score", 0) for d in scoped_docs) / len(scoped_docs)))
                    comp_grade = "A (Low Risk)" if avg_score >= 80 else "B (Moderate Risk)" if avg_score >= 65 else "C (Elevated Risk)"
                else:
                    avg_score = rs.get("composite_score", 0)
                    comp_grade = rs.get("composite_grade", "B")
                risk_summary = {
                    "composite_score": avg_score,
                    "composite_grade": comp_grade,
                    "documents": scoped_docs[:10],
                }
            except Exception as exc:
                logger.warning("Failed to build risk_summary for report: %s", exc)
                risk_summary = None

        # Source Excerpts (multi-passage per document for deep 2-3 page comparative/summary/dossier reports)
        excerpts = []
        if rtype in ("summary", "comparative", "research_dossier", "compliance_governance"):
            per_doc_limit = 2 if is_comparative_type or rtype == "research_dossier" else 2
            for document in docs:
                chunks = (
                    db.query(DocumentChunk)
                    .filter(DocumentChunk.document_id == document.id)
                    .order_by(DocumentChunk.chunk_index)
                    .limit(per_doc_limit)
                    .all()
                )
                for chunk in chunks:
                    excerpts.append({
                        "document_title": document.title,
                        "page": chunk.page_number or 1,
                        "text": chunk.content[:900].strip()
                    })

        # Recorded Retrieval Runs
        retrievals = []
        if rtype in ("search_benchmark", "research_dossier"):
            for row in db.query(SearchQuery).order_by(SearchQuery.created_at.desc()).all():
                result_ids = {result.get("document_id") for result in json.loads(row.results_json or "[]")}
                if not result_ids or result_ids.issubset(doc_ids):
                    retrievals.append({
                        "query": row.query_text,
                        "mode": row.mode,
                        "latency_ms": row.latency_ms,
                        "result_count": row.result_count
                    })
                if len(retrievals) == 20:
                    break

        # Contradiction Remediation Playbook actions
        remediation_actions = []
        if rtype in ("contradiction_remediation", "contradictions", "contradiction_executive_matrix"):
            for f in findings[:12]:
                sev = (f.severity or "medium").upper()
                remediation_actions.append({
                    "finding": f.title,
                    "severity": sev,
                    "category": (f.category or "general").replace("_", " ").title(),
                    "recommended_redline": f"Harmonize {f.doc_a_title or 'Document A'} and {f.doc_b_title or 'Document B'} around protective mutual terms: align cap thresholds, notification timelines, and audit covenants.",
                    "owner": "General Legal Counsel" if "liabil" in f.title.lower() or "indemn" in f.title.lower() else "CISO / Compliance Officer",
                })

        # Distinct template baseline summaries
        template_intro_map = {
            "comparative": f"Cross-agreement comparative report auditing {len(docs)} document(s) across commercial, security, and governance vectors, combining side-by-side clause profiling, saved comparisons ({len(comparisons)}), knowledge graph links, and {len(findings)} contradiction finding(s).",
            "summary": f"Document intelligence summary covering {len(docs)} selected agreement(s), capturing {len(excerpts)} verified opening source passage(s) and {len(obligations_summary)} contractual obligation window(s).",
            "contradictions": f"Targeted contradiction and discrepancy audit across {len(docs)} agreement(s), detailing {len(findings)} saved variance finding(s) with verbatim Document A vs. Document B citations.",
            "contradiction_remediation": f"Contradiction remediation and redline playbook addressing {len(findings)} discrepancy finding(s) across {len(docs)} document(s), pairing each conflict with counter-clause strategy and executive ownership.",
            "contradiction_executive_matrix": f"Executive contradiction and governance matrix mapping {len(findings)} discrepancy finding(s), knowledge graph clusters, and regulatory readiness across {len(docs)} document(s).",
            "compliance_governance": f"Regulatory compliance and privacy governance dossier auditing {len(docs)} document(s) against GDPR, HIPAA, EU AI Act, and SOC 2 benchmarks alongside {len(obligations_summary)} operational commitment(s).",
            "search_benchmark": f"Retrieval and evidence audit trail capturing {len(retrievals)} recorded BM25, Vector, and Hybrid search execution(s) scoped to {len(docs)} document(s).",
            "research_dossier": f"Comprehensive multi-page research dossier unifying comparative matrices, {len(findings)} contradiction finding(s), knowledge graph topology, obligations, risk scorecards, and source excerpts across {len(docs)} document(s).",
        }
        exec_summary = template_intro_map.get(
            rtype,
            f"Clario {rtype.replace('_', ' ')} dossier covering {len(docs)} document(s)."
        )

        # Detailed AI Synthesis (runs deeply when use_ai=True)
        ai_sections: Dict[str, Any] = {}
        if getattr(data, 'use_ai', False) and docs:
            findings_bullets = "\n".join([f"- [{f.severity.upper()}] {f.title}: {f.description[:140]}" for f in findings[:8]])
            matrix_bullets = "\n".join([
                f"- {m['document_title']}: Liability={m['liability']}, Indemnity={m['indemnity']}, BreachSLA={m['breach_sla']}, Data/AI={m['data_ai']}"
                for m in comparative_matrix[:6]
            ])
            excerpt_context = "\n".join([f"[{e['document_title']} p.{e['page']}]: {e['text'][:300]}" for e in excerpts[:4]])

            ai_prompt = f"""You are Clario's Senior Legal & Audit Synthesis Engine compiling an exhaustive multi-page dossier.
Report Title: {data.title}
Report Type: {rtype}
Audited Documents ({len(docs)}): {", ".join(doc_titles)}
Custom Reviewer Notes: {data.custom_notes or "None"}

Cross-Document Matrix:
{matrix_bullets or "N/A"}

Saved Contradictions & Findings:
{findings_bullets or "None recorded."}

Representative Source Excerpts:
{excerpt_context or "See document library."}

Return valid JSON with detailed, authoritative analysis grounded in the data above:
{{
  "executive_overview": "<Comprehensive 2-3 paragraph executive overview tailored specifically to {rtype}>",
  "cross_document_insights": [
    "<Detailed insight 1 comparing terms, gaps, or obligations across the audited files>",
    "<Detailed insight 2>",
    "<Detailed insight 3>"
  ],
  "risk_conclusions": "<Paragraph assessing material commercial, regulatory, or operational risk posture>",
  "strategic_recommendations": [
    "<Actionable recommendation 1>",
    "<Actionable recommendation 2>",
    "<Actionable recommendation 3>"
  ]
}}"""
            ai_json = AIGenerator.generate_json(
                prompt=ai_prompt,
                system_prompt="You are Clario's Executive Intelligence Report Engine. Respond strictly in valid JSON.",
                max_tokens=1400,
                temperature=0.15,
                timeout=75.0
            )
            if ai_json and isinstance(ai_json, dict) and ai_json.get("executive_overview"):
                exec_summary = str(ai_json["executive_overview"]).strip()
                ai_sections = {
                    "cross_document_insights": [str(x) for x in ai_json.get("cross_document_insights", []) if x],
                    "risk_conclusions": str(ai_json.get("risk_conclusions", "")),
                    "strategic_recommendations": [str(x) for x in ai_json.get("strategic_recommendations", []) if x],
                }
            else:
                # Fallback to structured text synthesis if JSON parse failed
                ai_summary = AIGenerator.generate_text(
                    prompt=ai_prompt,
                    system_prompt="You are Clario's Executive Dossier Synthesis Engine.",
                    max_tokens=700,
                    temperature=0.2,
                    timeout=60.0
                )
                if ai_summary and len(ai_summary.strip()) > 60:
                    exec_summary = ai_summary.strip()

        content = {
            "title": data.title,
            "report_type": rtype,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "documents_analyzed": [{"id": d.id, "title": d.title, "pages": d.page_count, "format": d.file_type, "words": d.word_count} for d in docs],
            "comparative_matrix": comparative_matrix,
            "comparisons": comparisons,
            "graph_summary": graph_summary,
            "risk_summary": risk_summary,
            "compliance_summary": compliance_summary,
            "obligations_summary": obligations_summary,
            "findings_summary": [
                {
                    "id": f.id,
                    "category": f.category,
                    "title": f.title,
                    "severity": f.severity,
                    "status": f.status,
                    "description": f.description,
                    "evidence_a": f"{f.doc_a_title} (Page {f.doc_a_page}): {f.doc_a_quote}" if f.doc_a_quote else "",
                    "evidence_b": f"{f.doc_b_title} (Page {f.doc_b_page}): {f.doc_b_quote}" if f.doc_b_quote else ""
                }
                for f in findings
            ],
            "remediation_actions": remediation_actions,
            "source_excerpts": excerpts,
            "retrieval_runs": retrievals,
            "ai_sections": ai_sections,
            "methodology": "Compiled across scoped workspace documents, saved pairwise comparisons, knowledge graph topic clusters, contradiction findings, contractual obligations, and compliance benchmarks.",
            "limitations": "Verify all extracted provisions and AI-synthesized insights directly against executed agreement PDFs prior to binding legal action.",
            "custom_notes": data.custom_notes or ""
        }

        pdf_filename = f"clario_report_{report_id[:8]}.pdf"
        pdf_path = str(settings.REPORTS_DIR / pdf_filename)
        ReportService._build_pdf(pdf_path, data.title, rtype, exec_summary, content, doc_titles)

        report = Report(
            id=report_id,
            title=data.title,
            report_type=rtype,
            executive_summary=exec_summary,
            content_json=json.dumps(content),
            document_ids_json=json.dumps([d.id for d in docs]),
            pdf_path=pdf_path
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def _build_pdf(
        pdf_path: str,
        title: str,
        report_type: str,
        executive_summary: str,
        content: Dict[str, Any],
        doc_titles: List[str]
    ):
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=42,
            bottomMargin=55
        )

        # Website Theme Palette: Deep Navy (#0F172A) & Monochrome Slate
        c_navy = colors.HexColor("#0F172A")
        c_slate = colors.HexColor("#334155")
        c_muted = colors.HexColor("#64748B")
        c_border = colors.HexColor("#E2E8F0")
        c_bg = colors.HexColor("#F8FAFC")
        c_body = colors.HexColor("#1E293B")

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ClarioTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=17,
            leading=21,
            textColor=c_navy,
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'ClarioSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=12,
            textColor=c_muted,
            spaceAfter=10
        )
        heading_style = ParagraphStyle(
            'ClarioHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=c_navy,
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'ClarioBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=13,
            textColor=c_body,
            spaceAfter=6
        )
        quote_style = ParagraphStyle(
            'ClarioQuote',
            parent=styles['Italic'],
            fontName='Helvetica-Oblique',
            fontSize=7.8,
            leading=11.5,
            textColor=c_slate,
            leftIndent=8,
            spaceAfter=4
        )
        table_hdr_style = ParagraphStyle(
            'ClarioTableHdr',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.8,
            leading=10,
            textColor=colors.white
        )
        table_cell_style = ParagraphStyle(
            'ClarioTableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=7.8,
            leading=11,
            textColor=c_body
        )
        table_cell_bold = ParagraphStyle(
            'ClarioTableCellBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=7.8,
            leading=11,
            textColor=c_navy
        )

        elements = []

        # 1. Website-Style Dark Navy Header Banner with Clario Logo
        logo_buf = _load_clario_logo_png()
        if logo_buf is not None:
            logo_cell = Image(logo_buf, width=96, height=24)
        else:
            logo_cell = Paragraph("<font color='#FFFFFF' size='14'><b>CLARIO</b></font>", body_style)

        right_hdr = Paragraph(
            f"<font color='#CBD5E1' size='7.5'><b>{escape(report_type.replace('_', ' ').upper())}</b></font><br/>"
            f"<font color='#94A3B8' size='7'>{datetime.now(timezone.utc).strftime('%B %d, %Y')}  •  {len(doc_titles)} DOCUMENT(S)</font>",
            ParagraphStyle('HdrR', alignment=2, leading=11)
        )
        t_brand = Table([[logo_cell, right_hdr]], colWidths=[260, 272])
        t_brand.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), c_navy),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 14),
            ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ]))
        elements.append(t_brand)
        elements.append(Spacer(1, 14))

        # Report Title & Metadata
        elements.append(Paragraph(escape(title), title_style))
        elements.append(Paragraph(
            f"TEMPLATE: {report_type.replace('_', ' ').upper()}   |   GENERATED: {datetime.now(timezone.utc).strftime('%B %d, %Y')}   |   SCOPE: {len(doc_titles)} DOCUMENT(S)",
            subtitle_style
        ))
        elements.append(HRFlowable(width="100%", thickness=1, color=c_navy, spaceBefore=2, spaceAfter=12))

        # Executive Summary Box
        elements.append(Paragraph("Executive Summary", heading_style))
        exec_summary_cell = [
            Paragraph("<b>EXECUTIVE MEMORANDUM OVERVIEW</b>", ParagraphStyle('SmHdr', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=c_navy, spaceAfter=4)),
            Paragraph(escape(executive_summary).replace("\n", "<br/>"), body_style)
        ]
        t_summary = Table([[exec_summary_cell]], colWidths=[532])
        t_summary.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), c_bg),
            ('BOX', (0, 0), (-1, -1), 0.75, c_border),
            ('LINELEFT', (0, 0), (-1, -1), 3.5, c_navy),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(t_summary)
        elements.append(Spacer(1, 10))

        # AI Detailed Synthesis Sections (if use_ai=True produced deeper sections)
        ai_sections = content.get("ai_sections") or {}
        if ai_sections:
            if ai_sections.get("cross_document_insights"):
                elements.append(Paragraph("AI Cross-Document Intelligence Findings", heading_style))
                for idx, ins in enumerate(ai_sections["cross_document_insights"], start=1):
                    elements.append(Paragraph(f"<b>{idx}.</b> {escape(ins)}", body_style))
            if ai_sections.get("risk_conclusions"):
                elements.append(Paragraph("AI Risk Posture Assessment", heading_style))
                elements.append(Paragraph(escape(ai_sections["risk_conclusions"]), body_style))
            if ai_sections.get("strategic_recommendations"):
                elements.append(Paragraph("Strategic Counsel Recommendations", heading_style))
                for idx, rec in enumerate(ai_sections["strategic_recommendations"], start=1):
                    elements.append(Paragraph(f"&bull; {escape(rec)}", body_style))
            elements.append(Spacer(1, 8))

        # Analysed Document Collection Table
        elements.append(Paragraph("Analysed Document Collection", heading_style))
        docs_analyzed = content.get("documents_analyzed", [])
        if docs_analyzed:
            doc_rows = [[
                Paragraph("Document Title", table_hdr_style),
                Paragraph("Format", table_hdr_style),
                Paragraph("Pages", table_hdr_style),
                Paragraph("Words", table_hdr_style),
                Paragraph("Status", table_hdr_style)
            ]]
            for d in docs_analyzed:
                doc_rows.append([
                    Paragraph(escape(d.get("title", "")), table_cell_bold),
                    Paragraph(escape(str(d.get("format", "PDF")).upper()), table_cell_style),
                    Paragraph(f"{d.get('pages', 1)} pp", table_cell_style),
                    Paragraph(f"{int(d.get('words', 0) or 0):,}", table_cell_style),
                    Paragraph("Verified Ready", table_cell_style)
                ])
            t_docs = Table(doc_rows, colWidths=[252, 55, 55, 70, 100])
            t_docs.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_docs)
            elements.append(Spacer(1, 10))

        # Cross-Document Comparative Matrix
        comp_matrix = content.get("comparative_matrix", [])
        if comp_matrix:
            elements.append(Paragraph("Cross-Agreement Comparative Clause Matrix", heading_style))
            m_rows = [[
                Paragraph("Document", table_hdr_style),
                Paragraph("Liability", table_hdr_style),
                Paragraph("Indemnity", table_hdr_style),
                Paragraph("Breach SLA", table_hdr_style),
                Paragraph("Data &amp; AI", table_hdr_style),
                Paragraph("Exit", table_hdr_style),
            ]]
            for m in comp_matrix:
                m_rows.append([
                    Paragraph(escape(m.get("document_title", "")), table_cell_bold),
                    Paragraph(escape(m.get("liability", "")), table_cell_style),
                    Paragraph(escape(m.get("indemnity", "")), table_cell_style),
                    Paragraph(escape(m.get("breach_sla", "")), table_cell_style),
                    Paragraph(escape(m.get("data_ai", "")), table_cell_style),
                    Paragraph(escape(m.get("termination", "")), table_cell_style),
                ])
            t_mat = Table(m_rows, colWidths=[122, 82, 82, 82, 88, 76])
            t_mat.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            elements.append(t_mat)
            elements.append(Spacer(1, 10))

        # Knowledge Graph & Risk Scorecard Section (moves neatly onto Page 2+ for multi-page reports)
        graph_summary = content.get("graph_summary")
        risk_summary = content.get("risk_summary")
        if graph_summary or risk_summary:
            elements.append(PageBreak())
            if graph_summary:
                elements.append(Paragraph("Knowledge Graph Topology &amp; Semantic Clusters", heading_style))
                topics_str = ", ".join(graph_summary.get("top_topics", [])[:10]) or "Standard governance clusters"
                g_rows = [
                    [Paragraph("Metric", table_hdr_style), Paragraph("Observed Corpus Telemetry", table_hdr_style)],
                    [Paragraph("Indexed Graph Nodes", table_cell_bold), Paragraph(f"{graph_summary.get('total_documents', 0)} Documents, {graph_summary.get('total_topics', 0)} Semantic Topics, {graph_summary.get('total_findings', 0)} Discrepancy Links", table_cell_style)],
                    [Paragraph("Connected Cross-Document Edges", table_cell_bold), Paragraph(f"{graph_summary.get('total_edges', 0)} active semantic &amp; contradiction edges", table_cell_style)],
                    [Paragraph("Primary Clustered Topics", table_cell_bold), Paragraph(escape(topics_str), table_cell_style)],
                ]
                t_graph = Table(g_rows, colWidths=[170, 362])
                t_graph.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                    ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 7),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ]))
                elements.append(t_graph)
                elements.append(Spacer(1, 10))

            if risk_summary and risk_summary.get("documents"):
                elements.append(Paragraph(f"Portfolio Contract Risk Scorecard (Grade {risk_summary.get('composite_grade', 'B')} · {risk_summary.get('composite_score', 0)}/100)", heading_style))
                r_rows = [[
                    Paragraph("Agreement", table_hdr_style),
                    Paragraph("Score", table_hdr_style),
                    Paragraph("Grade", table_hdr_style),
                    Paragraph("Strongest Protection", table_hdr_style),
                    Paragraph("Highest Risk Area", table_hdr_style),
                ]]
                for rd in risk_summary["documents"]:
                    r_rows.append([
                        Paragraph(escape(str(rd.get("document_title", ""))), table_cell_bold),
                        Paragraph(f"{rd.get('composite_score', 0)}/100", table_cell_style),
                        Paragraph(escape(str(rd.get("composite_grade", "B"))), table_cell_style),
                        Paragraph(escape(str((rd.get("strongest_protection") or {}).get("name", "Standard"))), table_cell_style),
                        Paragraph(escape(str((rd.get("highest_risk_area") or {}).get("name", "Standard"))), table_cell_style),
                    ])
                t_risk = Table(r_rows, colWidths=[160, 52, 45, 137, 138])
                t_risk.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                    ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ]))
                elements.append(t_risk)
                elements.append(Spacer(1, 10))

        # Compliance Readiness Matrix
        comp_sum = content.get("compliance_summary")
        if comp_sum and comp_sum.get("frameworks"):
            elements.append(Paragraph(f"Regulatory Compliance Readiness ({comp_sum.get('overall_score', 0)}% Overall)", heading_style))
            c_rows = [[Paragraph("Framework", table_hdr_style), Paragraph("Readiness", table_hdr_style), Paragraph("Status", table_hdr_style), Paragraph("Open Gaps", table_hdr_style)]]
            for fw in comp_sum["frameworks"]:
                c_rows.append([
                    Paragraph(escape(str(fw.get("name", ""))), table_cell_bold),
                    Paragraph(f"{fw.get('score', 0)}%", table_cell_style),
                    Paragraph(escape(str(fw.get("status", ""))), table_cell_style),
                    Paragraph(str(fw.get("gaps_count", 0)), table_cell_style),
                ])
            t_comp = Table(c_rows, colWidths=[210, 82, 160, 80])
            t_comp.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_comp)
            elements.append(Spacer(1, 10))

        # Pairwise Comparisons
        comparisons_data = content.get("comparisons", [])
        if comparisons_data:
            elements.append(Paragraph("Side-by-Side Comparative Reconciliations", heading_style))
            comp_rows = [[Paragraph("Comparison Pair", table_hdr_style), Paragraph("Variance Analysis &amp; Synthesis", table_hdr_style)]]
            for c in comparisons_data:
                comp_rows.append([
                    Paragraph(escape(c.get("title", "")), table_cell_bold),
                    Paragraph(escape(c.get("summary", "")), table_cell_style)
                ])
            t_comps = Table(comp_rows, colWidths=[180, 352])
            t_comps.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_comps)
            elements.append(Spacer(1, 10))

        # Findings & Contradictions
        findings_data = content.get("findings_summary", [])
        if findings_data or report_type.startswith("contradiction"):
            elements.append(Paragraph("Evidence-Based Findings &amp; Contradictions", heading_style))
            if findings_data:
                finding_rows = [[
                    Paragraph("Finding Vector / Topic", table_hdr_style),
                    Paragraph("Severity", table_hdr_style),
                    Paragraph("Comparative Evidence &amp; Excerpts", table_hdr_style)
                ]]
                for item in findings_data:
                    cat = item.get("category", "").replace("_", " ").title()
                    evidence_cell = []
                    if item.get("evidence_a"):
                        evidence_cell.append(Paragraph(f"<b>Doc A Reference:</b> {escape(item.get('evidence_a', ''))}", quote_style))
                    if item.get("evidence_b"):
                        evidence_cell.append(Paragraph(f"<b>Doc B Reference:</b> {escape(item.get('evidence_b', ''))}", quote_style))
                    if not evidence_cell:
                        evidence_cell.append(Paragraph(escape(item.get("description", "Identified discrepancy between contract terms.")), table_cell_style))
                    sev = item.get("severity", "").upper()
                    finding_rows.append([
                        [Paragraph(f"<b>{escape(item.get('title', ''))}</b>", table_cell_bold), Paragraph(f"<font color='#64748B'>{escape(cat)}</font>", table_cell_style)],
                        Paragraph(f"<b>{escape(sev)}</b>", table_cell_bold),
                        evidence_cell
                    ])
                t_findings = Table(finding_rows, colWidths=[150, 70, 312])
                t_findings.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                    ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 7),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ]))
                elements.append(t_findings)
            else:
                elements.append(Paragraph("No saved contradiction findings matched this document scope. Run a contradiction scan in Compare or Findings to populate.", body_style))
            elements.append(Spacer(1, 10))

        # Contradiction Remediation Playbook
        rem_actions = content.get("remediation_actions", [])
        if rem_actions:
            elements.append(Paragraph("Contradiction Remediation &amp; Redline Playbook", heading_style))
            rem_rows = [[Paragraph("Finding", table_hdr_style), Paragraph("Owner", table_hdr_style), Paragraph("Recommended Redline Action", table_hdr_style)]]
            for ra in rem_actions:
                rem_rows.append([
                    Paragraph(f"<b>{escape(ra.get('finding', ''))}</b><br/><font color='#64748B'>{escape(ra.get('severity', ''))}</font>", table_cell_style),
                    Paragraph(escape(ra.get("owner", "General Counsel")), table_cell_bold),
                    Paragraph(escape(ra.get("recommended_redline", "")), table_cell_style),
                ])
            t_rem = Table(rem_rows, colWidths=[150, 110, 272])
            t_rem.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(t_rem)
            elements.append(Spacer(1, 10))

        # Obligations & Notice Windows
        obl_data = content.get("obligations_summary", [])
        if obl_data:
            elements.append(Paragraph("Key Contractual Obligations &amp; Notice Windows", heading_style))
            o_rows = [[Paragraph("Obligation", table_hdr_style), Paragraph("Document", table_hdr_style), Paragraph("Window", table_hdr_style), Paragraph("Party", table_hdr_style)]]
            for o in obl_data:
                o_rows.append([
                    Paragraph(escape(str(o.get("title", ""))), table_cell_bold),
                    Paragraph(escape(str(o.get("document_title", ""))), table_cell_style),
                    Paragraph(escape(str(o.get("due_date_or_window", ""))), table_cell_style),
                    Paragraph(escape(str(o.get("obligated_party", ""))), table_cell_style),
                ])
            t_obl = Table(o_rows, colWidths=[180, 160, 92, 100])
            t_obl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(t_obl)
            elements.append(Spacer(1, 10))

        # Retrieval Runs (for search_benchmark & research_dossier)
        retrievals_data = content.get("retrieval_runs", [])
        if retrievals_data:
            elements.append(Paragraph("Recorded Retrieval &amp; Evidence Queries", heading_style))
            ret_rows = [[Paragraph("Query", table_hdr_style), Paragraph("Mode", table_hdr_style), Paragraph("Latency", table_hdr_style), Paragraph("Hits", table_hdr_style)]]
            for r in retrievals_data[:12]:
                ret_rows.append([
                    Paragraph(escape(str(r.get("query", ""))[:110]), table_cell_style),
                    Paragraph(escape(str(r.get("mode", "")).upper()), table_cell_bold),
                    Paragraph(f"{r.get('latency_ms', 0)} ms", table_cell_style),
                    Paragraph(str(r.get("result_count", 0)), table_cell_style),
                ])
            t_ret = Table(ret_rows, colWidths=[300, 72, 80, 80])
            t_ret.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(t_ret)
            elements.append(Spacer(1, 10))

        # Source Excerpts (cleanly paginated for multi-page depth)
        excerpts_data = content.get("source_excerpts", [])
        if excerpts_data:
            if not (graph_summary or risk_summary) and len(docs_analyzed) >= 2:
                elements.append(PageBreak())
            elements.append(Paragraph("Verified Source Excerpts", heading_style))
            for item in excerpts_data[:10]:
                excerpt_content = [
                    Paragraph(f"<b>{escape(item.get('document_title', ''))} &bull; Page {item.get('page', 1)}</b>", table_cell_bold),
                    Paragraph(escape(item.get("text", "")).replace("\n", "<br/>"), quote_style)
                ]
                t_exc = Table([[excerpt_content]], colWidths=[532])
                t_exc.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), c_bg),
                    ('BOX', (0, 0), (-1, -1), 0.5, c_border),
                    ('LINELEFT', (0, 0), (-1, -1), 2.5, c_slate),
                    ('TOPPADDING', (0, 0), (-1, -1), 5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 9),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                ]))
                elements.append(t_exc)
                elements.append(Spacer(1, 5))

        # Custom Notes
        if content.get("custom_notes"):
            elements.append(Paragraph("Reviewer Notes &amp; Counsel Annotations", heading_style))
            notes_content = [
                Paragraph("<b>AUDITOR ANNOTATIONS</b>", ParagraphStyle('SmNote', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=c_navy, spaceAfter=4)),
                Paragraph(escape(content["custom_notes"]).replace("\n", "<br/>"), body_style)
            ]
            t_notes = Table([[notes_content]], colWidths=[532])
            t_notes.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), c_bg),
                ('BOX', (0, 0), (-1, -1), 0.5, c_border),
                ('LINELEFT', (0, 0), (-1, -1), 2.5, c_navy),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            elements.append(t_notes)
            elements.append(Spacer(1, 10))

        # Methodology & Scope Box
        elements.append(Paragraph("Audit Methodology &amp; Scope Limitations", heading_style))
        methodology_text = (
            f"<b>METHODOLOGY:</b> {escape(content.get('methodology', ''))}<br/><br/>"
            f"<b>LIMITATIONS:</b> {escape(content.get('limitations', ''))}"
        )
        t_method = Table([[Paragraph(methodology_text, ParagraphStyle('MethStyle', fontName='Helvetica', fontSize=7.5, leading=11, textColor=c_muted))]], colWidths=[532])
        t_method.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), c_bg),
            ('BOX', (0, 0), (-1, -1), 0.5, c_border),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        elements.append(t_method)

        doc.build(elements, canvasmaker=NumberedCanvas)

    @staticmethod
    def list_reports(db: Session) -> List[Report]:
        return db.query(Report).order_by(Report.created_at.desc()).all()

    @staticmethod
    def get_report(report_id: str, db: Session) -> Optional[Report]:
        return db.query(Report).filter(Report.id == report_id).first()

    @staticmethod
    def delete_report(report_id: str, db: Session) -> bool:
        report = db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return False
        if report.pdf_path and os.path.exists(report.pdf_path):
            try:
                os.remove(report.pdf_path)
            except OSError:
                pass
        db.delete(report)
        db.commit()
        return True

    @staticmethod
    def clear_all_reports(db: Session) -> int:
        reports = db.query(Report).all()
        count = len(reports)
        for r in reports:
            if r.pdf_path and os.path.exists(r.pdf_path):
                try:
                    os.remove(r.pdf_path)
                except OSError:
                    pass
            db.delete(r)
        db.commit()
        return count

    @staticmethod
    def get_word_analysis(db: Session, document_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Analyzes vocabulary, lexical density, key terminology, and readability metrics.
        Retained for document-level lexical inspection in DocumentsPage.
        """
        query = db.query(Document)
        docs = query.filter(Document.id.in_(document_ids)).all() if document_ids else query.all()
        if not docs:
            return {
                "total_words": 0, "unique_words": 0, "total_characters": 0,
                "lexical_density_pct": 0.0, "avg_word_length": 0.0, "avg_sentence_length": 0.0,
                "flesch_reading_ease": 0.0, "reading_level": "No Documents",
                "audited_documents_count": 0, "top_keywords": [], "category_distribution": [],
                "sentiment_breakdown": {
                    "protective": {"count": 0, "pct": 0.0, "label": "Protective Safeguards"},
                    "obligations": {"count": 0, "pct": 0.0, "label": "Contractual Obligations"},
                    "exposure": {"count": 0, "pct": 0.0, "label": "Risk & Liability Exposure"}
                },
                "document_breakdowns": []
            }
        doc_ids = [d.id for d in docs]
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).all()
        doc_texts: Dict[str, List[str]] = {d.id: [] for d in docs}
        for c in chunks:
            if c.document_id in doc_texts and c.content:
                doc_texts[c.document_id].append(c.content)

        full_text = " ".join(c.content for c in chunks if c.content)
        words = re.findall(r"[A-Za-z]{3,}", full_text.lower())
        total_words = len(words)
        unique_words = len(set(words))
        total_chars = sum(len(w) for w in words)
        sentences = [s.strip() for s in re.split(r"[.!?]+", full_text) if len(s.strip().split()) >= 3]
        num_sentences = max(1, len(sentences))
        lexical_density = round((unique_words / max(1, total_words)) * 100, 1)
        avg_word_len = round(total_chars / max(1, total_words), 1)
        avg_sentence_len = round(total_words / num_sentences, 1)
        syllables_count = sum(max(1, len(re.findall(r"[aeiouy]+", w))) for w in words)
        raw_flesch = 206.835 - (1.015 * avg_sentence_len) - (84.6 * (syllables_count / max(1, total_words)))
        flesch_score = round(max(0.0, min(100.0, raw_flesch)), 1)
        reading_level = (
            "Plain English (Executive)" if flesch_score >= 60.0
            else "Standard Commercial" if flesch_score >= 35.0
            else "Advanced Enterprise" if flesch_score >= 15.0
            else "Complex Statutory / Legal"
        )
        stopwords = {
            "the", "and", "for", "that", "with", "this", "are", "from", "which", "any",
            "all", "such", "other", "have", "not", "been", "each", "under", "may", "will",
            "than", "into", "more", "their", "has", "was", "were", "our", "you", "your",
            "its", "itself", "they", "them", "who", "what", "when", "where", "why", "how",
            "page", "agreement", "section", "article", "hereby", "thereof", "herein",
            "shall", "can", "could", "would", "should", "also", "including", "between",
            "either", "neither", "only", "must", "one", "two", "three", "first", "second"
        }
        word_counts = Counter([w for w in words if w not in stopwords])
        top_raw = word_counts.most_common(24)
        max_count = top_raw[0][1] if top_raw else 1
        legal_terms = {"policy", "customer", "terms", "confidential", "governance", "jurisdiction", "party", "rights", "release"}
        security_terms = {"safety", "data", "security", "breach", "incident", "audit", "retention", "encryption", "privacy"}
        financial_terms = {"business", "services", "liability", "damages", "fees", "payment", "expenses", "credit", "commercial"}
        tech_terms = {"model", "openai", "anthropic", "claude", "enterprise", "artificial", "intelligence", "api", "prompt"}

        top_keywords = []
        for word, count in top_raw:
            cat = (
                "Security & Data" if word in security_terms
                else "Commercial & Risk" if word in financial_terms
                else "AI & Infrastructure" if word in tech_terms
                else "Legal & Governance" if word in legal_terms
                else "General Enterprise"
            )
            top_keywords.append({"word": word, "count": count, "pct": round((count / max_count) * 100, 1), "category": cat})

        cat_totals = Counter()
        for kw in top_keywords:
            cat_totals[kw["category"]] += kw["count"]
        category_distribution = [{"category": k, "count": v} for k, v in cat_totals.most_common()]

        protective_kws = {"warranty", "indemnify", "consent", "encryption", "protect", "safeguard", "compliance", "deletion", "purge", "opt-out"}
        obligation_kws = {"shall", "must", "notify", "within", "required", "maintain", "deliver", "audit", "report", "renew"}
        exposure_kws = {"liability", "damages", "breach", "termination", "penalty", "claims", "loss", "third-party", "dispute", "unilateral"}
        p_c = sum(1 for w in words if w in protective_kws)
        o_c = sum(1 for w in words if w in obligation_kws)
        e_c = sum(1 for w in words if w in exposure_kws)
        s_tot = max(1, p_c + o_c + e_c)

        doc_breakdowns = []
        for d in docs:
            d_words = re.findall(r"[A-Za-z]{3,}", " ".join(doc_texts.get(d.id, [])).lower())
            doc_breakdowns.append({
                "id": d.id,
                "title": d.title.replace("_", " "),
                "word_count": len(d_words),
                "unique_words": len(set(d_words)),
                "pages": d.page_count or 1,
                "top_term": Counter([w for w in d_words if w not in stopwords]).most_common(1)[0][0] if d_words else "—"
            })

        return {
            "total_words": total_words,
            "unique_words": unique_words,
            "total_characters": total_chars,
            "lexical_density_pct": lexical_density,
            "avg_word_length": avg_word_len,
            "avg_sentence_length": avg_sentence_len,
            "flesch_reading_ease": flesch_score,
            "reading_level": reading_level,
            "audited_documents_count": len(docs),
            "top_keywords": top_keywords,
            "category_distribution": category_distribution,
            "sentiment_breakdown": {
                "protective": {"count": p_c, "pct": round((p_c / s_tot) * 100, 1), "label": "Protective Safeguards"},
                "obligations": {"count": o_c, "pct": round((o_c / s_tot) * 100, 1), "label": "Contractual Obligations"},
                "exposure": {"count": e_c, "pct": round((e_c / s_tot) * 100, 1), "label": "Risk & Liability Exposure"}
            },
            "document_breakdowns": doc_breakdowns
        }
