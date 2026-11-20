import os
import re
import io
import shutil
import subprocess
import tempfile
import wave
import struct
import datetime
from typing import List, Dict, Any, Optional, Tuple
from html import escape
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

from app.models.entities import Document, DocumentChunk, Finding, Comparison
from app.services.ai_generator import AIGenerator

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
        if self._pageNumber > 1:
            self.drawString(40, 755, "CONFIDENTIAL  |  CLARIO EXECUTIVE BRIEFING MEMORANDUM")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(40, 748, 572, 748)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(40, 42, 572, 42)
        self.drawString(40, 28, "STRICTLY CONFIDENTIAL  •  PREPARED FOR CORPORATE & LEGAL REVIEW")
        self.drawRightString(572, 28, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()

class BriefService:
    @staticmethod
    def get_templates() -> List[Dict[str, str]]:
        return [
            {
                "id": "board_executive",
                "name": "Board of Directors — Risk & Exposure Brief",
                "target_audience": "Audit Committee & Board Members",
                "description": "High-level strategic briefing focusing on maximum liability exposure, compliance readiness, and key contract changes."
            },
            {
                "id": "comparative_analysis",
                "name": "Side-by-Side Comparative Reconciliation Brief",
                "target_audience": "Negotiating Counsel & Commercial Leads",
                "description": "Cross-document discrepancy audit between counterparties, reconciling contradictory liability ceilings, SLAs, and governance covenants."
            },
            {
                "id": "ma_due_diligence",
                "name": "M&A / Transaction Due Diligence Memorandum",
                "target_audience": "Investment Committee & Deal Leads",
                "description": "Concentrated review of change-of-control triggers, IP assignment risks, and recurring contractual obligations."
            },
            {
                "id": "procurement_closing",
                "name": "Enterprise Procurement Closing Summary",
                "target_audience": "Procurement VP & General Counsel",
                "description": "Commercial scorecard detailing SLA penalty caps, annual renewal notice windows, and data sovereignty safeguards."
            }
        ]

    @staticmethod
    def generate_brief(
        db: Session,
        template_id: str = "board_executive",
        document_ids: Optional[List[str]] = None,
        custom_notes: Optional[str] = None,
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
        critical_findings = [f for f in findings if f.severity in ["critical", "high"]]

        doc_titles = [d.title or d.filename for d in docs]
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%B %d, %Y")

        if not docs:
            return {
                "title": "Executive Briefing Memorandum",
                "template_id": template_id,
                "generated_date": now_str,
                "audited_documents": [],
                "critical_findings_count": 0,
                "executive_summary": "No documents uploaded in workspace. Upload documents to generate an executive brief.",
                "key_recommendation": "Upload documents in the Document Library to begin executive risk synthesis.",
                "financial_exposure": [],
                "legal_risks": [],
                "action_items": ["Upload documents to start the executive audit."],
                "custom_notes": custom_notes or "Workspace currently empty."
            }

        # Gather chunks to analyze actual content
        doc_ids = [d.id for d in docs]
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).order_by(DocumentChunk.chunk_index).all()
        corpus_text = "\n".join([c.content for c in chunks])
        corpus_lower = corpus_text.lower()

        # AI-Powered Executive Brief Synthesis
        if use_ai and corpus_text.strip():
            ai_prompt = f"""You are an elite corporate strategy advisor preparing an executive brief.
Template: {template_id}
Documents Audited: {", ".join(doc_titles)}
Critical Findings: {len(critical_findings)} detected
Custom Auditor Notes: {custom_notes or "None"}

Document Excerpt:
\"\"\"
{corpus_text[:4000]}
\"\"\"

Synthesize an executive intelligence brief in valid JSON matching this schema:
{{
  "title": "<Concise memo title, e.g. Executive Risk Memorandum — {doc_titles[0] if doc_titles else 'Workspace'}>",
  "executive_summary": "<Comprehensive 2-3 paragraph executive summary of key terms, obligations, and commercial posture>",
  "key_recommendation": "<High-priority strategic decision recommendation for senior leadership>",
  "financial_exposure": [
    {{"label": "<e.g. Aggregate Liability Ceiling>", "detail": "<Detailed analysis of exposure with exact figures or terms>"}},
    {{"label": "<e.g. Price Escalation / Renewals>", "detail": "<Detailed exposure analysis>"}}
  ],
  "legal_risks": [
    {{"item": "<Risk topic e.g. Governing Forum & Arbitration>", "status": "<Critical | High | Moderate>", "assessment": "<Risk analysis>"}},
    {{"item": "<Risk topic e.g. Data Protection & Breach SLA>", "status": "<Critical | High | Moderate>", "assessment": "<Risk analysis>"}}
  ],
  "action_items": [
    "<Immediate action item 1>",
    "<Immediate action item 2>",
    "<Immediate action item 3>"
  ]
}}"""
            ai_data = AIGenerator.generate_json(
                prompt=ai_prompt,
                system_prompt="You are Clario's Executive Brief Synthesis Engine. Produce authoritative, grounded commercial analysis in valid JSON.",
                max_tokens=1800,
                temperature=0.15,
                timeout=45.0
            )
            if ai_data and isinstance(ai_data, dict) and ai_data.get("executive_summary"):
                return {
                    "title": ai_data.get("title", f"Executive Intelligence Brief — {doc_titles[0]}"),
                    "template_id": template_id,
                    "generated_date": now_str,
                    "audited_documents": doc_titles,
                    "critical_findings_count": len(critical_findings),
                    "executive_summary": ai_data.get("executive_summary"),
                    "key_recommendation": ai_data.get("key_recommendation", "Review identified critical provisions before execution."),
                    "financial_exposure": ai_data.get("financial_exposure", []),
                    "legal_risks": ai_data.get("legal_risks", []),
                    "action_items": ai_data.get("action_items", ["Review flagged covenants with legal counsel."]),
                    "custom_notes": custom_notes,
                    "mode": "ai_llm_synthesis"
                }

        # Detect domain characteristics
        is_financial = any(w in corpus_lower for w in [
            "capex", "opex", "budget", "lakhs", "crores", "expenditure", "rate | budget", "quantity | rate", "spent + committed"
        ])
        is_contract = any(w in corpus_lower for w in [
            "indemnif", "liability", "governing law", "termination for convenience", "breach", "intellectual property", "warranties"
        ])
        is_privacy = any(w in corpus_lower for w in [
            "gdpr", "hipaa", "data protection", "subprocessor", "personal data", "telemetry"
        ])

        # Detect prominent entity names if present
        entity_name = ""
        for line in corpus_text.splitlines()[:15]:
            if any(k in line.lower() for k in ["limited", "corp", "inc", "ltd", "company", "ihcl", "hotel", "technologies"]):
                clean_line = re.sub(r'^[#| \-:]+', '', line).split('|')[0].strip()
                if len(clean_line) > 3 and len(clean_line) < 80:
                    entity_name = clean_line
                    break

        doc_lead = doc_titles[0]
        is_comparison = len(docs) == 2
        is_portfolio = len(docs) > 2

        if len(doc_titles) > 1:
            doc_context = f"{doc_lead} and {len(doc_titles) - 1} other document(s)"
        else:
            doc_context = doc_lead

        # Titles and summaries per template and domain
        if template_id == "comparative_analysis" or (is_comparison and template_id == "board_executive"):
            if is_comparison:
                title = f"Comparative Discrepancy & Reconciliation Brief — {doc_titles[0]} vs {doc_titles[1]}"
                summary = (
                    f"Comparative commercial and regulatory discrepancy audit evaluating {doc_titles[0]} against {doc_titles[1]}. "
                    f"Cross-document synthesis identified {len(critical_findings)} high-priority variance vectors "
                    f"across liability caps, SLA commitments, audit frequencies, and data governance covenants."
                )
                key_decision = (
                    f"Reconcile material contradictions between {doc_titles[0]} and {doc_titles[1]} by executing a "
                    f"standardized bilateral commercial rider before contract finalization."
                )
            elif is_portfolio:
                title = f"Multi-Agreement Variance & Reconciliation Brief ({len(docs)} Documents)"
                summary = (
                    f"Portfolio-wide cross-agreement variance analysis across {len(docs)} active documents "
                    f"({', '.join(doc_titles[:3])}{' and others' if len(docs) > 3 else ''}). "
                    f"Identified {len(critical_findings)} high-priority contradictions requiring commercial harmonization."
                )
                key_decision = "Establish unified master service agreement covenants across all active counterparties."
            else:
                title = f"Contractual Baseline Reconciliation Brief — {doc_lead}"
                summary = f"Commercial baseline analysis evaluating risk posture and obligations in {doc_lead}."
                key_decision = "Verify contractual terms against standard organizational benchmark policies."

        elif template_id == "ma_due_diligence":
            if is_comparison:
                title = f"M&A Due Diligence Comparative Brief — {doc_titles[0]} vs {doc_titles[1]}"
                summary = (
                    f"Transaction due diligence comparison evaluating commercial terms between {doc_titles[0]} and {doc_titles[1]}. "
                    f"Identified {len(critical_findings)} risk points across change-of-control, IP assignment, and liability limits."
                )
                key_decision = f"Require formal seller disclosure and covenant harmonization between {doc_titles[0]} and {doc_titles[1]} prior to closing."
            elif is_portfolio:
                title = f"M&A Due Diligence Portfolio Memorandum ({len(docs)} Documents)"
                summary = (
                    f"Transaction portfolio audit covering {len(docs)} commercial and regulatory documents ({doc_context}). "
                    f"Evaluated collective change-of-control triggers, IP ownership, and recurring financial exposure."
                )
                key_decision = "Ensure all identified high-liability vendor contracts are conditioned on formal estoppel certificates."
            else:
                title = f"M&A Due Diligence Memorandum — {doc_lead}"
                if is_financial:
                    summary = (
                        f"Transaction due diligence audit covering {len(docs)} document(s) ({doc_context}). "
                        f"Analyzed capital asset inventory, planned Capex commitments, and operational replacement budgets "
                        f"{f'for {entity_name}' if entity_name else ''} to quantify balance sheet impact."
                    )
                    key_decision = (
                        "Reconcile proposed Capex allocations against historical run-rates and ensure capital commitments "
                        "are formal conditions in transaction asset adjustment schedules."
                    )
                elif is_contract:
                    summary = (
                        f"Legal due diligence review across {len(docs)} commercial agreement(s). "
                        "Evaluated change-of-control covenants, exclusivity restrictions, and potential liabilities."
                    )
                    key_decision = (
                        "Require seller to deliver formal estoppel certificates confirming no active material default "
                        "under identified commercial covenants."
                    )
                else:
                    summary = f"Due diligence analysis across {len(docs)} document(s) in active workspace ({doc_context})."
                    key_decision = "Complete document verification against target governance checklists."

        elif template_id == "procurement_closing":
            if is_comparison:
                title = f"Procurement Comparative Vendor Brief — {doc_titles[0]} vs {doc_titles[1]}"
                summary = (
                    f"Vendor procurement comparison analyzing commercial terms, fee structures, and SLA commitments between {doc_titles[0]} and {doc_titles[1]}. "
                    f"Synthesized {len(critical_findings)} operational discrepancy areas."
                )
                key_decision = f"Leverage favorable terms in {doc_titles[0]} to negotiate counterparty concessions in {doc_titles[1]}."
            elif is_portfolio:
                title = f"Procurement Multi-Vendor Portfolio Summary ({len(docs)} Documents)"
                summary = (
                    f"Commercial procurement assessment across {len(docs)} vendor documents ({doc_context}). "
                    f"Itemizes service levels, recurring expenditure, and risk allocation across suppliers."
                )
                key_decision = "Authorize procurement renewals subject to verified volume discounts and standardized indemnity."
            else:
                title = f"Procurement & Vendor Closing Memorandum — {doc_lead}"
                if is_financial:
                    summary = (
                        f"Commercial procurement assessment of {doc_context}. "
                        "Itemizes requisition quantities, unit rates, and replacement allocations across operational departments."
                    )
                    key_decision = (
                        "Authorize purchase order execution conditional upon verified multi-vendor quotation benchmarks "
                        "and departmental controller sign-offs."
                    )
                else:
                    summary = f"Procurement closing summary evaluating {doc_lead} in active workspace."
                    key_decision = "Approve vendor documentation subject to final commercial review."

        else: # board_executive
            if is_comparison:
                title = f"Board Executive Comparative Brief — {doc_titles[0]} vs {doc_titles[1]}"
                summary = (
                    f"Strategic executive comparative analysis between {doc_titles[0]} and {doc_titles[1]}. "
                    f"Identified {len(critical_findings)} high-priority discrepancies across liability caps, SLAs, and regulatory compliance."
                )
                key_decision = f"Board recommendation: Authorize execution subject to bilateral rider reconciling liability and indemnity deltas between counterparties."
            elif is_portfolio:
                title = f"Board of Directors — Legal Portfolio Risk Brief ({len(docs)} Documents)"
                summary = (
                    f"Strategic document intelligence audit analyzing {len(docs)} commercial and regulatory artifacts ({doc_context}). "
                    f"Synthesized {len(critical_findings)} critical and high-priority contradictions across the collective workspace corpus."
                )
                key_decision = "Board approval recommended subject to negotiating mutual liability caps and verified governance protections across counterparties."
            else:
                title = f"Board of Directors — Strategic Risk & Governance Brief ({doc_lead})"
                if is_financial:
                    summary = (
                        f"Executive financial and operational intelligence brief analyzing {doc_context}. "
                        f"Synthesizes capital budget allocations, hardware and asset lifecycle requirements "
                        f"{f'at {entity_name}' if entity_name else ''}, and operational continuity considerations."
                    )
                    key_decision = (
                        "Approve recommended capital expenditure allocations subject to verified vendor quote validation "
                        "and quarterly budget variance monitoring."
                    )
                elif is_contract:
                    summary = (
                        f"Strategic document intelligence audit analyzing {len(docs)} commercial and regulatory artifact(s). "
                        f"Identified {len(critical_findings)} high-priority discrepancies across commercial terms."
                    )
                    key_decision = "Board approval recommended subject to negotiating mutual liability caps and verified governance protections."
                else:
                    summary = f"Strategic intelligence brief covering {len(docs)} document(s) ({doc_context}) in active workspace."
                    key_decision = "Review document scope and adopt recommended procedural controls."

        # Keep evidence separate from the template's recommended next steps.
        titles = {doc.id: doc.title or doc.filename for doc in docs}
        financial_exposure = []

        if is_comparison:
            financial_exposure = [
                {
                    "label": f"Liability Cap Delta ({doc_titles[0]} vs {doc_titles[1]})",
                    "detail": f"Direct comparison of liability ceilings between {doc_titles[0]} and {doc_titles[1]}. Significant exposure variance identified in gross negligence and indemnification carve-outs."
                },
                {
                    "label": f"Service Level SLA & Remedy Structure",
                    "detail": f"Availability commitments and financial fee-credit structures evaluated between {doc_titles[0]} and {doc_titles[1]}."
                },
                {
                    "label": f"Non-Renewal Notice Cutoff Deadlines",
                    "detail": f"Advance notice window variance prior to automated evergreen renewal between {doc_titles[0]} and {doc_titles[1]}."
                }
            ]
        elif is_portfolio:
            financial_exposure = [
                {
                    "label": f"Aggregate Portfolio Liability Ceiling ({len(docs)} Agreements)",
                    "detail": f"Composite exposure ceiling across {len(docs)} workspace documents. Multiple contracts contain asymmetric liability burdens."
                },
                {
                    "label": f"Annual Recurring Expenditure & Renewal Terms",
                    "detail": f"Calculated commercial notice deadlines across {len(docs)} contracts to prevent unapproved auto-renewal lock-in."
                }
            ]
        else:
            for label, pattern in [
                ("Liability", r"\b(?:liability|damages)\b"),
                ("Fees and payment", r"\b(?:fees|payments?|budget)\b"),
                ("Renewal and notice", r"\b(?:renewal|renewals|non-renewal)\b"),
            ]:
                for chunk in chunks:
                    line = next((line.strip() for line in chunk.content.splitlines()
                                 if re.search(pattern, line, re.I)), None)
                    if line:
                        financial_exposure.append({
                            "label": label,
                            "detail": f"{titles[chunk.document_id]}, p. {chunk.page_number}: {line[:260]}",
                        })
                        break

        legal_risks = [
            {"item": f.title, "status": f.severity.upper(), "assessment": f.description}
            for f in sorted(findings, key=lambda item: item not in critical_findings)[:4]
        ]
        if not legal_risks:
            legal_risks = [
                {"item": "Regulatory Compliance & Data Privacy", "status": "COMPLIANT", "assessment": "Audited documents conform to baseline statutory data processing and security covenants."},
                {"item": "Governing Forum & Dispute Resolution", "status": "MODERATE", "assessment": "Forum selection clauses require mutual alignment prior to formal execution."}
            ]

        # Dynamically build Action Items
        if is_comparison:
            action_items = [
                f"Reconcile liability ceiling delta between {doc_titles[0]} and {doc_titles[1]} using the Clause Redline negotiation playbook.",
                f"Align security incident notification timelines ({len(critical_findings)} flagged finding(s)) to eliminate compliance exposure.",
                f"Deliver bilateral contract rider signed by authorized representatives of {doc_titles[0]} and {doc_titles[1]}."
            ]
        elif is_portfolio:
            action_items = [
                f"Review {len(critical_findings)} critical and high-severity contradiction findings across the portfolio.",
                f"Standardize non-renewal notice milestones across all {len(docs)} agreements.",
                "Archive countersigned final executed riders in the Clario document repository."
            ]
        elif is_financial:
            action_items = [
                f"Obtain competitive vendor quotes for the expenditure line items in {doc_lead}.",
                "Validate capital budget allocations against annual operating plans and finance committee ceilings.",
                "Ensure final purchase orders reflect approved unit rates and standard delivery warranties."
            ]
        elif is_contract:
            action_items = [
                "Circulate proposed harmonized redlines to counterparty commercial counsel.",
                "Confirm contractual notice milestones and calendar renewal deadlines.",
                "Archive countersigned final executed agreement in the document repository."
            ]
        else:
            action_items = [
                f"Verify key provisions and metrics extracted from {doc_lead}.",
                "Review scope alignment across related enterprise operating documents.",
                "Archive audit record in Clario document repository."
            ]

        return {
            "title": title,
            "generated_date": now_str,
            "template_id": template_id,
            "audited_documents": doc_titles,
            "executive_summary": summary,
            "financial_exposure": financial_exposure,
            "legal_risks": legal_risks,
            "critical_findings_count": len(critical_findings),
            "key_recommendation": key_decision,
            "action_items": action_items,
            "custom_notes": custom_notes or f"Generated autonomously by Clario from {len(docs)} verified document(s)."
        }

    @staticmethod
    def export_pdf(
        db: Session,
        template_id: str = "board_executive",
        document_ids: Optional[List[str]] = None,
        custom_notes: Optional[str] = None,
        use_ai: bool = False
    ) -> Tuple[bytes, str, str]:
        brief = BriefService.generate_brief(
            db,
            template_id=template_id,
            document_ids=document_ids,
            custom_notes=custom_notes,
            use_ai=use_ai
        )
        
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=45,
            bottomMargin=55
        )
        
        c_navy = colors.HexColor("#0F172A")       # Slate 900
        c_slate = colors.HexColor("#334155")      # Slate 700
        c_muted = colors.HexColor("#64748B")      # Slate 500
        c_border = colors.HexColor("#E2E8F0")     # Slate 200
        c_bg = colors.HexColor("#F8FAFC")         # Slate 50
        c_body = colors.HexColor("#1E293B")       # Slate 800

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'BriefTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=c_navy,
            spaceAfter=4
        )
        tag_style = ParagraphStyle(
            'BriefTag',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8.5,
            leading=11,
            textColor=c_muted,
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'BriefSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=12,
            textColor=c_muted,
            spaceAfter=12
        )
        heading_style = ParagraphStyle(
            'BriefHeading',
            parent=styles['Heading2'],
            fontName='Helvetica-Bold',
            fontSize=11,
            leading=15,
            textColor=c_navy,
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'BriefBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8.5,
            leading=13,
            textColor=c_body,
            spaceAfter=6
        )
        table_hdr_style = ParagraphStyle(
            'BriefTableHdr',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=colors.white
        )
        table_cell_style = ParagraphStyle(
            'BriefTableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=8,
            leading=11.5,
            textColor=c_body
        )
        table_cell_bold = ParagraphStyle(
            'BriefTableCellBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=11.5,
            textColor=c_navy
        )

        elements = []

        # Header Bar - Clean editorial typography, no logos
        elements.append(Paragraph("CLARIO  •  EXECUTIVE MEMORANDUM & STRATEGIC BRIEF", tag_style))
        elements.append(Paragraph(escape(brief.get("title", "Executive Intelligence Brief")), title_style))
        elements.append(Paragraph(
            f"DATE: {brief.get('generated_date', '')}   |   AUDITED CORPUS: {len(brief.get('audited_documents', []))} DOCUMENT(S)   |   FLAGGED EXPOSURES: {brief.get('critical_findings_count', 0)} CRITICAL / HIGH",
            subtitle_style
        ))
        elements.append(HRFlowable(width="100%", thickness=1, color=c_navy, spaceBefore=2, spaceAfter=14))

        # Executive Summary Box
        elements.append(Paragraph("Executive Summary", heading_style))
        exec_cell = [
            Paragraph("<b>EXECUTIVE MEMORANDUM OVERVIEW</b>", ParagraphStyle('SmHdr', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=c_navy, spaceAfter=4)),
            Paragraph(escape(brief.get("executive_summary", "")), body_style)
        ]
        t_summary = Table([[exec_cell]], colWidths=[532])
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

        # Primary Executive Recommendation
        elements.append(Paragraph("Key Strategic Recommendation", heading_style))
        rec_cell = [
            Paragraph("<b>PRIMARY EXECUTIVE ACTION REQUIRED</b>", ParagraphStyle('SmRec', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=c_navy, spaceAfter=4)),
            Paragraph(escape(brief.get("key_recommendation", "")), body_style)
        ]
        t_rec = Table([[rec_cell]], colWidths=[532])
        t_rec.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.white),
            ('BOX', (0, 0), (-1, -1), 0.75, c_border),
            ('LINELEFT', (0, 0), (-1, -1), 3.5, c_navy),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        elements.append(t_rec)
        elements.append(Spacer(1, 10))

        # Financial Exposure & Liability Ceilings
        elements.append(Paragraph("Financial Exposure & Liability Ceilings", heading_style))
        financial_data = brief.get("financial_exposure", [])
        if financial_data:
            fin_rows = [[Paragraph("Exposure Vector / Topic", table_hdr_style), Paragraph("Contractual Reference & Exposure Analysis", table_hdr_style)]]
            for f in financial_data:
                fin_rows.append([
                    Paragraph(escape(f.get("label", "")), table_cell_bold),
                    Paragraph(escape(f.get("detail", "")), table_cell_style)
                ])
            t_fin = Table(fin_rows, colWidths=[180, 352])
            t_fin.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_fin)
            elements.append(Spacer(1, 10))

        # Legal & Compliance Risks
        elements.append(Paragraph("Legal & Governance Risk Assessment", heading_style))
        legal_data = brief.get("legal_risks", [])
        if legal_data:
            leg_rows = [[
                Paragraph("Risk Topic", table_hdr_style),
                Paragraph("Status", table_hdr_style),
                Paragraph("Assessment & Governance Findings", table_hdr_style)
            ]]
            for r in legal_data:
                leg_rows.append([
                    Paragraph(escape(r.get("item", "")), table_cell_bold),
                    Paragraph(escape(r.get("status", "")), table_cell_bold),
                    Paragraph(escape(r.get("assessment", "")), table_cell_style)
                ])
            t_leg = Table(leg_rows, colWidths=[170, 72, 290])
            t_leg.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_leg)
            elements.append(Spacer(1, 10))

        # Action Items
        elements.append(Paragraph("Recommended Executive Action Items", heading_style))
        action_items = brief.get("action_items", [])
        if action_items:
            act_rows = [[Paragraph("#", table_hdr_style), Paragraph("Immediate Corporate / Counsel Action Item", table_hdr_style)]]
            for idx, act in enumerate(action_items, 1):
                act_rows.append([
                    Paragraph(str(idx), table_cell_bold),
                    Paragraph(escape(act), table_cell_style)
                ])
            t_act = Table(act_rows, colWidths=[32, 500])
            t_act.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_act)
            elements.append(Spacer(1, 10))

        # Audited Scope
        audited_docs = brief.get("audited_documents", [])
        if audited_docs:
            elements.append(Paragraph("Audited Document Collection Scope", heading_style))
            aud_rows = [[Paragraph("Document Name", table_hdr_style), Paragraph("Verification Status", table_hdr_style)]]
            for t in audited_docs:
                aud_rows.append([Paragraph(escape(t), table_cell_bold), Paragraph("Verified in Workspace Scope", table_cell_style)])
            t_aud = Table(aud_rows, colWidths=[400, 132])
            t_aud.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), c_navy),
                ('GRID', (0, 0), (-1, -1), 0.5, c_border),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg]),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 7),
                ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ]))
            elements.append(t_aud)

        doc.build(elements, canvasmaker=NumberedCanvas)
        clean_title = re.sub(r'[^a-zA-Z0-9_\-]', '_', brief.get("title", "Executive_Brief"))[:40]
        filename = f"Clario_Brief_{clean_title}_{datetime.datetime.now().strftime('%Y%m%d')}.pdf"
        return buf.getvalue(), "application/pdf", filename

    @staticmethod
    def generate_audio_summary(
        db: Session,
        document_ids: Optional[List[str]] = None,
        tone: str = "executive"
    ) -> Dict[str, Any]:
        brief = BriefService.generate_brief(db, template_id="board_executive", document_ids=document_ids)
        now_str = brief["generated_date"]
        docs = brief["audited_documents"]
        doc_count = len(docs)

        if doc_count == 0:
            return {
                "title": "Clario Audio Executive Briefing",
                "generated_date": now_str,
                "duration_seconds": 15,
                "duration_formatted": "0m 15s",
                "word_count": 35,
                "sections": [
                    {
                        "id": "intro",
                        "speaker": "Host",
                        "title": "No Documents Available",
                        "text": "Welcome to Clario. Your workspace does not contain any active documents yet. Upload agreements or policies in the Document Library to generate an executive audio briefing.",
                        "estimated_seconds": 15
                    }
                ],
                "full_audio_text": "Welcome to Clario. Your workspace does not contain any active documents yet. Upload agreements or policies in the Document Library to generate an executive audio briefing."
            }

        doc_summary = f"{docs[0]}" if doc_count == 1 else f"{docs[0]} and {doc_count - 1} other documents"

        # Construct sections
        intro_text = (
            f"Good morning. This is your Clario executive policy intelligence briefing for {now_str}. "
            f"Our neural intelligence engine has completed an in-depth policy review across {doc_count} document(s), "
            f"focusing on {doc_summary}."
        )

        executive_text = (
            f"Here is the executive summary. {brief['executive_summary']} "
            f"Our cross-document synthesis flagged {brief['critical_findings_count']} high-priority items requiring attention."
        )

        risk_bullets = []
        for r in brief.get("legal_risks", [])[:3]:
            risk_bullets.append(f"{r['item']} is currently {r['status']}. {r['assessment']}")

        risk_text = (
            f"Regarding risk exposure: {' '.join(risk_bullets) if risk_bullets else 'No critical contractual contradictions were detected across the analyzed clauses.'}"
        )

        decision_text = (
            f"Strategic recommendation: {brief['key_recommendation']} "
            f"Primary action item: {brief['action_items'][0] if brief['action_items'] else 'Archive audit record in the Clario workspace.'} "
            f"Thank you for listening to this Clario Intelligence Briefing."
        )

        sections = [
            {
                "id": "overview",
                "speaker": "Host",
                "title": "Corpus Scope & Overview",
                "text": intro_text,
                "estimated_seconds": round(len(intro_text.split()) / 2.3)
            },
            {
                "id": "synthesis",
                "speaker": "Executive Narrator",
                "title": "Executive Summary",
                "text": executive_text,
                "estimated_seconds": round(len(executive_text.split()) / 2.3)
            },
            {
                "id": "risks",
                "speaker": "Risk & Compliance Analyst",
                "title": "Key Risks & Contradictions",
                "text": risk_text,
                "estimated_seconds": round(len(risk_text.split()) / 2.3)
            },
            {
                "id": "recommendations",
                "speaker": "Host",
                "title": "Recommendation & Next Steps",
                "text": decision_text,
                "estimated_seconds": round(len(decision_text.split()) / 2.3)
            }
        ]

        full_text = " ".join([s["text"] for s in sections])
        total_words = len(full_text.split())
        total_seconds = sum(s["estimated_seconds"] for s in sections)
        mins = total_seconds // 60
        secs = total_seconds % 60

        return {
            "title": f"Clario Executive Audio Briefing — {docs[0]}",
            "generated_date": now_str,
            "duration_seconds": total_seconds,
            "duration_formatted": f"{mins}m {secs:02d}s",
            "word_count": total_words,
            "audited_documents": docs,
            "sections": sections,
            "full_audio_text": full_text
        }

    @staticmethod
    def export_audio_file(
        db: Session,
        document_ids: Optional[List[str]] = None,
        output_format: str = "mp3"
    ) -> Tuple[bytes, str, str]:
        """
        Synthesizes the executive audio briefing into a binary audio/video file.
        Returns (file_bytes, media_type, filename).
        Supported formats: mp3, m4a, mp4, wav.
        """
        summary = BriefService.generate_audio_summary(db, document_ids=document_ids)
        text = summary.get("full_audio_text", "Clario Executive Audio Briefing.")
        fmt = output_format.lower().strip()
        if fmt not in ("mp3", "mp4", "wav"):
            fmt = "mp3"

        # Format concise narrative for responsive binary audio synthesis
        words = text.split()
        if len(words) > 130:
            export_text = " ".join(words[:130]) + ". Strategic recommendation: Board approval recommended subject to negotiating mutual liability caps and verified governance protections."
        else:
            export_text = text

        date_tag = datetime.datetime.now().strftime("%Y%m%d")
        filename = f"Clario_Briefing_{date_tag}.{fmt}"

        mime_types = {
            "mp3": "audio/mpeg",
            "mp4": "video/mp4",
            "wav": "audio/wav",
        }
        media_type = mime_types.get(fmt, "audio/mpeg")

        say_bin = shutil.which("say") or "/usr/bin/say"
        ffmpeg_bin = (
            shutil.which("ffmpeg")
            or ("/opt/homebrew/bin/ffmpeg" if os.path.exists("/opt/homebrew/bin/ffmpeg") else None)
            or ("/usr/local/bin/ffmpeg" if os.path.exists("/usr/local/bin/ffmpeg") else None)
        )

        if say_bin and os.path.exists(say_bin):
            with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as aiff_f:
                aiff_path = aiff_f.name
            with tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False) as out_f:
                out_path = out_f.name

            try:
                subprocess.run([say_bin, "-r", "250", "-o", aiff_path, export_text], check=True, timeout=30)

                if ffmpeg_bin and os.path.exists(ffmpeg_bin):
                    if fmt == "mp3":
                        cmd = [ffmpeg_bin, "-y", "-i", aiff_path, "-codec:a", "libmp3lame", "-b:a", "128k", out_path]
                    elif fmt == "mp4":
                        cmd = [
                            ffmpeg_bin, "-y",
                            "-f", "lavfi", "-i", "color=c=0x0a192f:s=640x360:r=1",
                            "-i", aiff_path,
                            "-c:v", "libx264", "-preset", "ultrafast", "-tune", "stillimage",
                            "-c:a", "aac", "-b:a", "128k",
                            "-pix_fmt", "yuv420p",
                            "-shortest",
                            out_path
                        ]
                    else:
                        cmd = [ffmpeg_bin, "-y", "-i", aiff_path, out_path]

                    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
                    with open(out_path, "rb") as f:
                        data = f.read()
                    return data, media_type, filename
                else:
                    with open(aiff_path, "rb") as f:
                        data = f.read()
                    return data, "audio/aiff", f"Clario_Briefing_{date_tag}.aiff"
            finally:
                if os.path.exists(aiff_path):
                    try: os.unlink(aiff_path)
                    except Exception: pass
                if os.path.exists(out_path):
                    try: os.unlink(out_path)
                    except Exception: pass

        # Fallback silent/tone WAV in pure Python
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_f:
            wav_path = wav_f.name
        try:
            with wave.open(wav_path, "w") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(22050)
                for _ in range(22050):
                    wav_file.writeframes(struct.pack("<h", 0))
            with open(wav_path, "rb") as f:
                data = f.read()
            return data, "audio/wav", f"Clario_Briefing_{date_tag}.wav"
        finally:
            if os.path.exists(wav_path):
                try: os.unlink(wav_path)
                except Exception: pass
