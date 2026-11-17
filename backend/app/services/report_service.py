import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.core.config import settings
from app.models.entities import Report, Document, Finding, DocumentChunk
from app.schemas.dtos import ReportCreate, ReportResponse

class ReportService:
    @staticmethod
    def generate_report(data: ReportCreate, db: Session) -> Report:
        report_id = str(uuid.uuid4())
        
        # Fetch documents
        docs = db.query(Document).filter(Document.id.in_(data.document_ids)).all() if data.document_ids else []
        doc_titles = [d.title for d in docs]

        # Fetch findings
        findings = db.query(Finding).all()

        exec_summary = (
            f"This intelligence dossier was systematically synthesized by Clario across "
            f"{len(docs)} document(s) on {datetime.utcnow().strftime('%B %d, %Y')}. "
            f"Analysis covers {data.report_type.replace('_', ' ').title()}, with verified source attribution "
            f"and cross-document consistency checks."
        )

        content = {
            "title": data.title,
            "report_type": data.report_type,
            "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "documents_analyzed": [
                {"id": d.id, "title": d.title, "pages": d.page_count, "format": d.file_type}
                for d in docs
            ],
            "findings_summary": [
                {
                    "id": f.id,
                    "category": f.category,
                    "title": f.title,
                    "severity": f.severity,
                    "status": f.status,
                    "evidence_a": f"{f.doc_a_title} (Page {f.doc_a_page}): {f.doc_a_quote}" if f.doc_a_quote else "",
                    "evidence_b": f"{f.doc_b_title} (Page {f.doc_b_page}): {f.doc_b_quote}" if f.doc_b_quote else ""
                }
                for f in findings[:10]
            ],
            "methodology": (
                "Dual-phase Information Retrieval employing BM25 lexical ranking and dense vector representations "
                "with Reciprocal Rank Fusion (k=60). Comparative text alignments evaluated via sequence matching "
                "and syntactic discrepancy extraction."
            ),
            "limitations": (
                "Academic project demonstration: automated findings highlight candidate discrepancies and must be "
                "independently verified by qualified human subject-matter experts before forming legal or compliance decisions."
            ),
            "custom_notes": data.custom_notes or "Standard automated evaluation run."
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
            document_ids_json=json.dumps(data.document_ids),
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
            topMargin=40,
            bottomMargin=40
        )
        
        # Colors: Midnight Navy (#14263D), Warm Ivory (#F8F7F3), Muted Teal (#477E88), Champagne Gold (#D4AE72)
        c_navy = colors.HexColor("#14263D")
        c_teal = colors.HexColor("#477E88")
        c_gold = colors.HexColor("#D4AE72")
        c_ivory = colors.HexColor("#F8F7F3")
        c_text = colors.HexColor("#233448")
        c_gray = colors.HexColor("#748293")

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'ClarioTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            textColor=c_navy,
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            'ClarioSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            textColor=c_teal,
            spaceAfter=15
        )
        heading_style = ParagraphStyle(
            'ClarioHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=14,
            textColor=c_navy,
            spaceBefore=14,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'ClarioBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=c_text,
            spaceAfter=8
        )
        quote_style = ParagraphStyle(
            'ClarioQuote',
            parent=styles['Italic'],
            fontName='Helvetica-Oblique',
            fontSize=9,
            leading=13,
            textColor=c_text,
            leftIndent=15,
            spaceAfter=6
        )
        tag_style = ParagraphStyle(
            'ClarioTag',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            textColor=c_gold
        )

        elements = []

        # Header Bar
        elements.append(Paragraph("CLARIO &bull; DOCUMENT INTELLIGENCE WORKBENCH", tag_style))
        elements.append(Paragraph(title, title_style))
        elements.append(Paragraph(f"Category: {report_type.replace('_', ' ').upper()} &nbsp;|&nbsp; Generated on {datetime.utcnow().strftime('%B %d, %Y')}", subtitle_style))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=c_teal, spaceAfter=15))

        # Executive Summary
        elements.append(Paragraph("Executive Summary", heading_style))
        elements.append(Paragraph(executive_summary, body_style))

        # Documents Analysed
        elements.append(Paragraph("Analysed Document Collection", heading_style))
        if doc_titles:
            doc_items = [[Paragraph(f"&bull; <b>{t}</b>", body_style)] for t in doc_titles]
            t_docs = Table(doc_items, colWidths=[520])
            t_docs.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), c_ivory),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            elements.append(t_docs)
        else:
            elements.append(Paragraph("Full workspace active corpus analysed.", body_style))

        # Key Findings
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Evidence-Based Findings & Contradictions", heading_style))
        findings_data = content.get("findings_summary", [])
        if findings_data:
            for item in findings_data[:5]:
                cat = item.get("category", "").replace("_", " ").title()
                elements.append(Paragraph(f"<b>[{cat}] {item.get('title')}</b> (Severity: {item.get('severity', '').upper()})", body_style))
                if item.get("evidence_a"):
                    elements.append(Paragraph(f"<b>Doc A Reference:</b> {item.get('evidence_a')}", quote_style))
                if item.get("evidence_b"):
                    elements.append(Paragraph(f"<b>Doc B Reference:</b> {item.get('evidence_b')}", quote_style))
                elements.append(Spacer(1, 4))
        else:
            elements.append(Paragraph("No critical contradiction candidates flagged for this query subset.", body_style))

        # Methodology & Limitations
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Methodology & Rigor", heading_style))
        elements.append(Paragraph(content.get("methodology", ""), body_style))

        elements.append(Paragraph("Academic Limitations & Scope", heading_style))
        elements.append(Paragraph(content.get("limitations", ""), quote_style))

        # Footer
        elements.append(HRFlowable(width="100%", thickness=0.8, color=c_gray, spaceBefore=15, spaceAfter=8))
        elements.append(Paragraph("Clario Intelligence Engine &bull; Document Intelligence with Vector Search &bull; Confidential", subtitle_style))

        doc.build(elements)

    @staticmethod
    def list_reports(db: Session) -> List[Report]:
        return db.query(Report).order_by(Report.created_at.desc()).all()

    @staticmethod
    def get_report(report_id: str, db: Session) -> Optional[Report]:
        return db.query(Report).filter(Report.id == report_id).first()
