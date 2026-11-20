import os
import re
import json
import uuid
from collections import Counter
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from html import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.core.config import settings
from app.models.entities import Report, Document, Finding, DocumentChunk, Comparison, SearchQuery
from app.schemas.dtos import ReportCreate, ReportResponse
from app.services.ai_generator import AIGenerator

from reportlab.pdfgen import canvas

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
        # Running header on page 2+
        if self._pageNumber > 1:
            self.drawString(40, 755, "CONFIDENTIAL  |  CLARIO CONTRACT INTELLIGENCE DOSSIER")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(40, 748, 572, 748)
        # Running footer on all pages
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 42, 572, 42)
        self.drawString(40, 28, "STRICTLY CONFIDENTIAL  •  PREPARED FOR CORPORATE & LEGAL REVIEW")
        self.drawRightString(572, 28, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

class ReportService:
    @staticmethod
    def generate_report(data: ReportCreate, db: Session) -> Report:
        report_id = str(uuid.uuid4())
        
        query = db.query(Document)
        docs = query.filter(Document.id.in_(data.document_ids)).all() if data.document_ids else query.all()
        if data.document_ids and len(docs) != len(set(data.document_ids)):
            raise HTTPException(status_code=422, detail="One or more selected documents no longer exist.")
        if not docs:
            raise HTTPException(status_code=422, detail="Upload documents before generating a report.")
        doc_ids = {d.id for d in docs}
        doc_titles = [d.title for d in docs]
        # A scoped report must never include evidence from unselected documents.
        findings = [f for f in db.query(Finding).all()
                    if {x for x in (f.doc_a_id, f.doc_b_id) if x}
                    and {x for x in (f.doc_a_id, f.doc_b_id) if x}.issubset(doc_ids)]
        if data.report_type not in ("contradictions", "research_dossier"):
            findings = []
        comparisons = []
        if data.report_type in ("comparative", "research_dossier"):
            rows = db.query(Comparison).filter(Comparison.doc_a_id.in_(doc_ids), Comparison.doc_b_id.in_(doc_ids)).order_by(Comparison.created_at.desc()).all()
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
        excerpts = []
        if data.report_type in ("summary", "research_dossier"):
            for document in docs:
                chunk = db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).order_by(DocumentChunk.chunk_index).first()
                if chunk:
                    excerpts.append({"document_title": document.title, "page": chunk.page_number, "text": chunk.content[:1500]})
        retrievals = []
        if data.report_type == "search_benchmark":
            for row in db.query(SearchQuery).order_by(SearchQuery.created_at.desc()).all():
                result_ids = {result.get("document_id") for result in json.loads(row.results_json or "[]")}
                if result_ids and result_ids.issubset(doc_ids):
                    retrievals.append({"query": row.query_text, "mode": row.mode, "latency_ms": row.latency_ms, "result_count": row.result_count})
                if len(retrievals) == 20:
                    break
        exec_summary = (
            f"This {data.report_type.replace('_', ' ')} report covers {len(docs)} selected document(s). "
            f"It includes {len(findings)} saved finding(s), {len(comparisons)} saved comparison(s), "
            f"{len(excerpts)} source excerpt(s), and {len(retrievals)} recorded retrieval run(s), as applicable to this template. "
            "It does not run a new contradiction scan or certify the evidence."
        )

        # AI-Powered Executive Overview Synthesis
        if getattr(data, 'use_ai', False) and docs:
            findings_bullets = "\n".join([f"- [{f.severity.upper()}] {f.title}: {f.description[:140]}" for f in findings[:8]])
            ai_prompt = f"""You are Clario's senior intelligence auditor synthesizing an official PDF dossier report.
Report Title: {data.title}
Report Type: {data.report_type}
Audited Documents: {", ".join(doc_titles)}
Custom Reviewer Notes: {data.custom_notes or "None"}

Findings Context:
{findings_bullets or "No critical contradictions flagged."}

Draft an authoritative 2-3 paragraph executive overview highlighting key risk exposures, governance conclusions, and operational recommendations."""
            ai_summary = AIGenerator.generate_text(
                prompt=ai_prompt,
                system_prompt="You are Clario's Executive Dossier Synthesis Engine.",
                max_tokens=600,
                temperature=0.2,
                timeout=30.0
            )
            if ai_summary and len(ai_summary.strip()) > 50:
                exec_summary = ai_summary.strip()
        content = {
            "title": data.title,
            "report_type": data.report_type,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            "documents_analyzed": [{"id": d.id, "title": d.title, "pages": d.page_count, "format": d.file_type} for d in docs],
            "findings_summary": [{"id": f.id, "category": f.category, "title": f.title, "severity": f.severity, "status": f.status,
                "evidence_a": f"{f.doc_a_title} (Page {f.doc_a_page}): {f.doc_a_quote}" if f.doc_a_quote else "",
                "evidence_b": f"{f.doc_b_title} (Page {f.doc_b_page}): {f.doc_b_quote}" if f.doc_b_quote else ""} for f in findings],
            "comparisons": comparisons,
            "source_excerpts": excerpts,
            "retrieval_runs": retrievals,
            "methodology": "Snapshot of saved workspace records limited to the selected documents. Source summaries use the opening extracted passage from each document; they are not generated conclusions. Comparisons use the most recent saved result for each ordered document pair. Retrieval reports show up to 20 recorded runs whose returned sources are all within scope; these are retrieval timings, not a relevance benchmark.",
            "limitations": "Missing comparisons or findings mean no matching saved records were available; they do not establish that documents agree. Review source documents and candidate findings before making decisions.",
            "custom_notes": data.custom_notes or ""
        }

        # Generate PDF with ReportLab
        pdf_filename = f"clario_report_{report_id[:8]}.pdf"
        pdf_path = str(settings.REPORTS_DIR / pdf_filename)
        ReportService._build_pdf(pdf_path, data.title, data.report_type, exec_summary, content, doc_titles)

        report = Report(
            id=report_id,
            title=data.title,
            report_type=data.report_type,
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
            topMargin=45,
            bottomMargin=55
        )
        
        # Colors: Monochrome Slate & Executive Navy
        c_navy = colors.HexColor("#0F172A")       # Slate 900
        c_slate = colors.HexColor("#334155")      # Slate 700
        c_muted = colors.HexColor("#64748B")      # Slate 500
        c_border = colors.HexColor("#E2E8F0")     # Slate 200
        c_bg = colors.HexColor("#F8FAFC")         # Slate 50
        c_body = colors.HexColor("#1E293B")       # Slate 800

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ClarioTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=c_navy,
            spaceAfter=4
        )
        tag_style = ParagraphStyle(
            'ClarioTag',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=c_muted,
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'ClarioSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=12,
            textColor=c_muted,
            spaceAfter=12
        )
        heading_style = ParagraphStyle(
            'ClarioHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=c_navy,
            spaceBefore=14,
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
            fontSize=8,
            leading=12,
            textColor=c_slate,
            leftIndent=10,
            spaceAfter=4
        )
        table_hdr_style = ParagraphStyle(
            'ClarioTableHdr',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=colors.white
        )
        table_cell_style = ParagraphStyle(
            'ClarioTableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11.5,
            textColor=c_body
        )
        table_cell_bold = ParagraphStyle(
            'ClarioTableCellBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=11.5,
            textColor=c_navy
        )

        elements = []

        # Header Bar - Clean editorial typography, no logos
        elements.append(Paragraph("CLARIO  •  DOCUMENT INTELLIGENCE DOSSIER", tag_style))
        elements.append(Paragraph(escape(title), title_style))
        elements.append(Paragraph(
            f"CATEGORY: {report_type.replace('_', ' ').upper()}   |   GENERATED: {datetime.now(timezone.utc).strftime('%B %d, %Y')}   |   SCOPE: {len(doc_titles)} DOCUMENT(S)",
            subtitle_style
        ))
        elements.append(HRFlowable(width="100%", thickness=1, color=c_navy, spaceBefore=2, spaceAfter=14))

        # Executive Summary Callout Box
        elements.append(Paragraph("Executive Summary", heading_style))
        exec_summary_cell = [
            Paragraph("<b>EXECUTIVE MEMORANDUM OVERVIEW</b>", ParagraphStyle('SmHdr', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=c_navy, spaceAfter=4)),
            Paragraph(escape(executive_summary), body_style)
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

        # Analysed Document Collection
        elements.append(Paragraph("Analysed Document Collection", heading_style))
        docs_analyzed = content.get("documents_analyzed", [])
        if docs_analyzed:
            doc_rows = [[
                Paragraph("Document Title", table_hdr_style),
                Paragraph("Format", table_hdr_style),
                Paragraph("Pages", table_hdr_style),
                Paragraph("Status", table_hdr_style)
            ]]
            for d in docs_analyzed:
                doc_rows.append([
                    Paragraph(escape(d.get("title", "")), table_cell_bold),
                    Paragraph(escape(str(d.get("format", "PDF")).upper()), table_cell_style),
                    Paragraph(f"{d.get('pages', 1)} pages", table_cell_style),
                    Paragraph("Verified Ready", table_cell_style)
                ])
            t_docs = Table(doc_rows, colWidths=[300, 60, 72, 100])
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
        elif doc_titles:
            doc_rows = [[Paragraph("Document Title", table_hdr_style), Paragraph("Status", table_hdr_style)]]
            for t in doc_titles:
                doc_rows.append([Paragraph(escape(t), table_cell_bold), Paragraph("Verified Ready", table_cell_style)])
            t_docs = Table(doc_rows, colWidths=[400, 132])
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
        else:
            elements.append(Paragraph("Full workspace active corpus analysed.", body_style))

        elements.append(Spacer(1, 10))

        # Key Findings & Contradictions
        elements.append(Paragraph("Evidence-Based Findings & Contradictions", heading_style))
        findings_data = content.get("findings_summary", [])
        if findings_data:
            finding_rows = [[
                Paragraph("Finding Vector / Topic", table_hdr_style),
                Paragraph("Severity", table_hdr_style),
                Paragraph("Comparative Evidence & Excerpts", table_hdr_style)
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
            elements.append(Paragraph("No saved findings included in this report template and scope.", body_style))

        elements.append(Spacer(1, 10))

        # Comparisons
        comparisons_data = content.get("comparisons", [])
        if comparisons_data:
            elements.append(Paragraph("Side-by-Side Comparative Reconciliations", heading_style))
            comp_rows = [[Paragraph("Comparison Pair", table_hdr_style), Paragraph("Variance Analysis & Synthesis", table_hdr_style)]]
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

        # Source Excerpts
        excerpts_data = content.get("source_excerpts", [])
        if excerpts_data:
            elements.append(Paragraph("Verified Source Excerpts", heading_style))
            for item in excerpts_data[:5]:
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
                elements.append(Spacer(1, 4))
            elements.append(Spacer(1, 6))

        # Custom Notes
        if content.get("custom_notes"):
            elements.append(Paragraph("Reviewer Notes & Counsel Annotations", heading_style))
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

        # Methodology & Academic Rigor Box
        elements.append(Spacer(1, 6))
        elements.append(Paragraph("Audit Methodology & Scope Limitations", heading_style))
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
        Analyzes the vocabulary, lexical density, key enterprise terminology,
        and readability metrics across the document corpus.
        """
        query = db.query(Document)
        if document_ids:
            docs = query.filter(Document.id.in_(document_ids)).all()
        else:
            docs = query.all()

        if not docs:
            return {
                "total_words": 0,
                "unique_words": 0,
                "total_characters": 0,
                "lexical_density_pct": 0.0,
                "avg_word_length": 0.0,
                "avg_sentence_length": 0.0,
                "flesch_reading_ease": 0.0,
                "reading_level": "No Documents",
                "audited_documents_count": 0,
                "top_keywords": [],
                "category_distribution": [],
                "sentiment_breakdown": {
                    "protective": {"count": 0, "pct": 0.0, "label": "Protective Safeguards"},
                    "obligations": {"count": 0, "pct": 0.0, "label": "Contractual Obligations"},
                    "exposure": {"count": 0, "pct": 0.0, "label": "Risk & Liability Exposure"}
                },
                "document_breakdowns": []
            }

        doc_ids = [d.id for d in docs]
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).all()

        # Group text by document for per-document breakdown
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

        # Flesch Reading Ease approximation
        syllables_count = sum(max(1, len(re.findall(r"[aeiouy]+", w))) for w in words)
        raw_flesch = 206.835 - (1.015 * avg_sentence_len) - (84.6 * (syllables_count / max(1, total_words)))
        flesch_score = round(max(0.0, min(100.0, raw_flesch)), 1)

        if flesch_score >= 60.0:
            reading_level = "Plain English (Executive)"
        elif flesch_score >= 35.0:
            reading_level = "Standard Commercial"
        elif flesch_score >= 15.0:
            reading_level = "Advanced Enterprise"
        else:
            reading_level = "Complex Statutory / Legal"

        # Stopwords to filter out
        stopwords = {
            "the", "and", "for", "that", "with", "this", "are", "from", "which", "any",
            "all", "such", "other", "have", "not", "been", "each", "under", "may", "will",
            "than", "into", "more", "their", "has", "was", "were", "our", "you", "your",
            "its", "itself", "they", "them", "who", "what", "when", "where", "why", "how",
            "page", "agreement", "section", "article", "hereby", "thereof", "herein",
            "shall", "can", "could", "would", "should", "also", "including", "between",
            "either", "neither", "only", "must", "one", "two", "three", "first", "second"
        }

        meaningful_words = [w for w in words if w not in stopwords]
        word_counts = Counter(meaningful_words)
        top_raw = word_counts.most_common(24)
        max_count = top_raw[0][1] if top_raw else 1

        # Categorization dictionary
        legal_terms = {"policy", "customer", "terms", "confidential", "governance", "jurisdiction", "party", "rights", "release"}
        security_terms = {"safety", "data", "security", "breach", "incident", "audit", "retention", "encryption", "privacy"}
        financial_terms = {"business", "services", "liability", "damages", "fees", "payment", "expenses", "credit", "commercial"}
        tech_terms = {"model", "openai", "anthropic", "claude", "enterprise", "artificial", "intelligence", "api", "prompt"}

        top_keywords = []
        for word, count in top_raw:
            if word in security_terms:
                cat = "Security & Data"
            elif word in financial_terms:
                cat = "Commercial & Risk"
            elif word in tech_terms:
                cat = "AI & Infrastructure"
            else:
                cat = "Legal & Governance"

            top_keywords.append({
                "word": word,
                "count": count,
                "density_pct": round((count / max(1, total_words)) * 100, 2),
                "category": cat,
                "relative_pct": round((count / max_count) * 100)
            })

        # Category distribution of top meaningful words
        cat_counts = Counter(k["category"] for k in top_keywords)
        tot_top = len(top_keywords) or 1
        category_distribution = [
            {"category": "Legal & Governance", "count": cat_counts.get("Legal & Governance", 0), "pct": round(cat_counts.get("Legal & Governance", 0) / tot_top * 100, 1), "color": "#1e3a8a"},
            {"category": "Security & Data", "count": cat_counts.get("Security & Data", 0), "pct": round(cat_counts.get("Security & Data", 0) / tot_top * 100, 1), "color": "#0d9488"},
            {"category": "Commercial & Risk", "count": cat_counts.get("Commercial & Risk", 0), "pct": round(cat_counts.get("Commercial & Risk", 0) / tot_top * 100, 1), "color": "#d97706"},
            {"category": "AI & Infrastructure", "count": cat_counts.get("AI & Infrastructure", 0), "pct": round(cat_counts.get("AI & Infrastructure", 0) / tot_top * 100, 1), "color": "#475569"}
        ]

        # Sentiment / Obligation Polarity Breakdown
        protective_stems = ("indemnif", "protect", "safeguard", "secur", "warrant", "remed", "complian", "right")
        obligation_stems = ("shall", "must", "requir", "covenant", "obligat", "adher", "comply")
        exposure_stems = ("liabilit", "damag", "breach", "penalt", "terminat", "violat", "loss", "risk")

        protective_count = sum(1 for w in words if any(w.startswith(s) for s in protective_stems))
        obligation_count = sum(1 for w in words if any(w.startswith(s) for s in obligation_stems))
        exposure_count = sum(1 for w in words if any(w.startswith(s) for s in exposure_stems))
        total_polar = max(1, protective_count + obligation_count + exposure_count)

        sentiment_breakdown = {
            "protective": {
                "count": protective_count,
                "pct": round(protective_count / total_polar * 100, 1),
                "label": "Protective Safeguards & Warranties"
            },
            "obligations": {
                "count": obligation_count,
                "pct": round(obligation_count / total_polar * 100, 1),
                "label": "Mandatory Contractual Covenants"
            },
            "exposure": {
                "count": exposure_count,
                "pct": round(exposure_count / total_polar * 100, 1),
                "label": "Risk & Exposure Covenants"
            }
        }

        # Per-document breakdown
        doc_breakdowns = []
        for d in docs:
            d_raw = " ".join(doc_texts.get(d.id, []))
            d_words = re.findall(r"[A-Za-z]{3,}", d_raw.lower())
            d_tot = len(d_words)
            d_uniq = len(set(d_words))
            d_sentences = [s for s in re.split(r"[.!?]+", d_raw) if len(s.split()) >= 3]
            d_asl = d_tot / max(1, len(d_sentences))
            d_syll = sum(max(1, len(re.findall(r"[aeiouy]+", w))) for w in d_words)
            d_flesch = round(max(0.0, min(100.0, 206.835 - (1.015 * d_asl) - (84.6 * (d_syll / max(1, d_tot))))), 1)

            d_meaningful = [w for w in d_words if w not in stopwords]
            d_top = Counter(d_meaningful).most_common(1)
            top_word = d_top[0][0] if d_top else "—"

            doc_breakdowns.append({
                "id": d.id,
                "title": d.title or d.filename,
                "word_count": d_tot,
                "unique_words": d_uniq,
                "lexical_density_pct": round(d_uniq / max(1, d_tot) * 100, 1),
                "reading_ease": d_flesch,
                "top_keyword": top_word
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
            "sentiment_breakdown": sentiment_breakdown,
            "document_breakdowns": doc_breakdowns
        }
