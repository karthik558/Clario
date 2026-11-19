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
        elements.append(Paragraph(escape(title), title_style))
        elements.append(Paragraph(f"Category: {report_type.replace('_', ' ').upper()} &nbsp;|&nbsp; Generated on {datetime.now(timezone.utc).strftime('%B %d, %Y')}", subtitle_style))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=c_teal, spaceAfter=15))

        # Executive Summary
        elements.append(Paragraph("Executive Summary", heading_style))
        elements.append(Paragraph(escape(executive_summary), body_style))

        # Documents Analysed
        elements.append(Paragraph("Analysed Document Collection", heading_style))
        if doc_titles:
            doc_items = [[Paragraph(f"&bull; <b>{escape(t)}</b>", body_style)] for t in doc_titles]
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
            for item in findings_data:
                cat = item.get("category", "").replace("_", " ").title()
                elements.append(Paragraph(f"<b>[{escape(cat)}] {escape(item.get('title', ''))}</b> (Severity: {escape(item.get('severity', '').upper())})", body_style))
                if item.get("evidence_a"):
                    elements.append(Paragraph(f"<b>Doc A Reference:</b> {escape(item.get('evidence_a', ''))}", quote_style))
                if item.get("evidence_b"):
                    elements.append(Paragraph(f"<b>Doc B Reference:</b> {escape(item.get('evidence_b', ''))}", quote_style))
                elements.append(Spacer(1, 4))
        else:
            elements.append(Paragraph("No saved findings included in this report template and scope.", body_style))

        for heading, key in [("Source excerpts", "source_excerpts"), ("Saved comparisons", "comparisons"), ("Recorded retrieval runs", "retrieval_runs")]:
            records = content.get(key, [])
            if records:
                elements.append(Paragraph(heading, heading_style))
            for item in records:
                if key == "source_excerpts":
                    elements.append(Paragraph(escape(f"{item['document_title']} · Page {item['page']}"), body_style))
                    elements.append(Paragraph(escape(item["text"]).replace("\n", "<br/>"), quote_style))
                elif key == "comparisons":
                    elements.append(Paragraph(escape(item["title"]), body_style))
                    elements.append(Paragraph(escape(item["summary"]), body_style))
                else:
                    elements.append(Paragraph(escape(f"{item['query']} — {item['mode']}, {item['latency_ms']} ms, {item['result_count']} results"), body_style))
        if content.get("custom_notes"):
            elements.append(Paragraph("Reviewer notes", heading_style))
            elements.append(Paragraph(escape(content["custom_notes"]).replace("\n", "<br/>"), body_style))

        # Methodology & Limitations
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Methodology & Rigor", heading_style))
        elements.append(Paragraph(escape(content.get("methodology", "")), body_style))

        elements.append(Paragraph("Academic Limitations & Scope", heading_style))
        elements.append(Paragraph(escape(content.get("limitations", "")), quote_style))

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
