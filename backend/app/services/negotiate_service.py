import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.entities import Finding, Document
from app.schemas.dtos import NegotiateRequest, NegotiateResponse
from app.core.config import settings

class NegotiateService:
    @staticmethod
    def draft_redline(req: NegotiateRequest, db: Session) -> NegotiateResponse:
        statement_a = (req.statement_a or "").strip()
        statement_b = (req.statement_b or "").strip()
        doc_a_title = req.doc_a_title or "Document A"
        doc_b_title = req.doc_b_title or "Document B"
        topic = (req.topic or "Contractual Provision").strip()
        page_a = req.page_a or 1
        page_b = req.page_b or 1

        if req.finding_id:
            finding = db.query(Finding).filter(Finding.id == req.finding_id).first()
            if finding:
                topic = finding.title or topic
                statement_a = finding.doc_a_quote or finding.description or statement_a
                statement_b = finding.doc_b_quote or finding.description or statement_b
                doc_a_title = finding.doc_a_title or doc_a_title
                doc_b_title = finding.doc_b_title or doc_b_title
                page_a = finding.doc_a_page or page_a
                page_b = finding.doc_b_page or page_b

        stance = req.stance

        # Synthesize dynamic, grounded compromise redline
        topic_lower = topic.lower()
        stmt_a_lower = statement_a.lower()
        stmt_b_lower = statement_b.lower()

        # Dynamic clause synthesis based on provided statements and stance
        if not statement_a and not statement_b:
            proposed_clause = (
                f"Proposed Harmonized Clause ({topic}): The parties agree that all commitments under this provision "
                "shall be executed in mutual commercial good faith, adhering to documented operational procedures "
                "with standard thirty (30) days notice for material amendments."
            )
            rationale = f"Constructed baseline compromise framework for {topic}."
            risk_level = "Low (Baseline Provision)"
            concessions = [
                "Bilateral operational standard adopted.",
                "Mutual 30-day notice requirement instituted."
            ]
        else:
            # Clean core text from statement A and B
            clean_a = statement_a.strip().rstrip('.')
            clean_b = statement_b.strip().rstrip('.')

            if stance == "customer_protective":
                if clean_b:
                    proposed_clause = (
                        f"Amended Provision ({topic}): In accordance with Customer's protective governance standards, "
                        f"'{clean_b}'. Counterparty warrants that in the event of conflict with '{clean_a}', "
                        "the modernized protective covenant shall strictly govern and supersede all prior terms."
                    )
                else:
                    proposed_clause = (
                        f"Amended Provision ({topic}): In accordance with Customer's protective standards, "
                        f"'{clean_a}'. Provided, however, that Counterparty's obligations hereunder shall remain strictly "
                        "enforceable with mutual audit verification and zero unilateral exclusions."
                    )
                rationale = f"Prioritizes protective covenants for {topic}, minimizing customer operational and financial exposure."
                risk_level = "Low for Customer / High for Counterparty"
                concessions = [
                    f"Counterparty accepts binding governance under {doc_b_title or 'modernized terms'}.",
                    "Customer eliminates unilateral exception clauses."
                ]

            elif stance == "vendor_favorable":
                if clean_a:
                    proposed_clause = (
                        f"Amended Provision ({topic}): '{clean_a}'. Customer acknowledges and agrees that "
                        "Counterparty's cumulative commitments hereunder are subject to standard commercial feasibility "
                        "and trailing-fee remedy boundaries."
                    )
                else:
                    proposed_clause = (
                        f"Amended Provision ({topic}): '{clean_b}'. Subject to standard commercial force majeure "
                        "and exclusive remedy limitations."
                    )
                rationale = f"Maintains commercially bounded risk profile for {topic}."
                risk_level = "Medium"
                concessions = [
                    "Preserves predictable liability and operational remedy ceilings.",
                    "Provides reasonable commercial cure periods."
                ]

            elif stance == "strict_compliance":
                proposed_clause = (
                    f"Amended Compliance Provision ({topic}): Both parties agree that: (i) '{clean_b or clean_a}'; "
                    "(ii) all associated logs and records shall remain verifiable upon forty-eight (48) hours prior notice; "
                    "and (iii) any material breach of this covenant shall grant the non-breaching party immediate right of termination."
                )
                rationale = f"Strict compliance orientation for {topic} with statutory traceability and audit verification."
                risk_level = "Low (Strict Compliance Standard)"
                concessions = [
                    "Bilateral compliance verification with auditability.",
                    "Strict termination remedy for material breach."
                ]

            else: # balanced
                if clean_a and clean_b:
                    proposed_clause = (
                        f"Balanced Compromise Provision ({topic}): The parties harmonize prior terms with modernized requirements: "
                        f"'{clean_b}'. To ensure mutual feasibility, each party's performance shall be assessed against "
                        f"agreed milestone schedules, superseding the baseline specified in '{clean_a}'."
                    )
                elif clean_a:
                    proposed_clause = (
                        f"Balanced Provision ({topic}): Both parties agree that '{clean_a}', provided that each party "
                        "shall provide reasonable advance written notice of thirty (30) days prior to implementing material changes."
                    )
                else:
                    proposed_clause = (
                        f"Balanced Provision ({topic}): Both parties agree that '{clean_b}', governed under mutual commercial good faith."
                    )
                rationale = f"Equitably reconciles positions between {doc_a_title} and {doc_b_title} for {topic}."
                risk_level = "Low (Recommended Consensus)"
                concessions = [
                    "Both parties adopt modernized standard with reasonable transition notice.",
                    "Dispute resolution grounded in bilateral operational review."
                ]

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
            proposed_clause=proposed_clause,
            rationale=rationale,
            risk_level=risk_level,
            key_concessions=concessions,
            mode="dynamic_clause_harmonization"
        )

    @staticmethod
    def export_redline_docx(
        topic: str,
        stance: str,
        doc_a_title: str,
        doc_b_title: str,
        statement_a: str,
        statement_b: str,
        proposed_clause: str,
        rationale: str,
        risk_level: str,
        key_concessions: List[str]
    ) -> bytes:
        """
        Generate a professional Microsoft Word (.docx) document with tracked changes redlining.
        Includes styled deletion strikes and insertion underlines, structured executive tables,
        and legal negotiation rationales.
        """
        import io
        import datetime
        from docx import Document as WordDoc
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.enum.table import WD_TABLE_ALIGNMENT
        from docx.oxml import parse_xml, OxmlElement
        from docx.oxml.ns import nsdecls, qn

        doc = WordDoc()

        # Page Margins
        sections = doc.sections
        for s in sections:
            s.top_margin = Inches(1.0)
            s.bottom_margin = Inches(1.0)
            s.left_margin = Inches(1.0)
            s.right_margin = Inches(1.0)

        # Header Title
        title_p = doc.add_paragraph()
        title_p.paragraph_format.space_before = Pt(0)
        title_p.paragraph_format.space_after = Pt(2)
        run_super = title_p.add_run("CLARIO ENTERPRISE LEGAL INTELLIGENCE\n")
        run_super.font.size = Pt(9.5)
        run_super.font.bold = True
        run_super.font.color.rgb = RGBColor(71, 85, 105)

        run_title = title_p.add_run(f"Contract Clause Redline Memorandum: {topic}")
        run_title.font.size = Pt(17)
        run_title.font.bold = True
        run_title.font.color.rgb = RGBColor(15, 23, 42)

        # Subtitle
        sub_p = doc.add_paragraph()
        sub_p.paragraph_format.space_before = Pt(2)
        sub_p.paragraph_format.space_after = Pt(14)
        run_sub = sub_p.add_run(f"Negotiation Stance: {stance.replace('_', ' ').title()} • Date: {datetime.datetime.now().strftime('%B %d, %Y')}")
        run_sub.font.size = Pt(10)
        run_sub.font.color.rgb = RGBColor(100, 116, 139)

        # Metadata Summary Table
        table = doc.add_table(rows=5, cols=2)
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        rows_data = [
            ("Contract Provision / Topic", topic),
            ("Negotiation Stance", stance.replace('_', ' ').title()),
            ("Assessed Risk Level", risk_level),
            ("Primary Baseline Document", doc_a_title),
            ("Counterparty Document", doc_b_title)
        ]

        for i, (k, v) in enumerate(rows_data):
            row = table.rows[i]
            cell_k = row.cells[0]
            cell_v = row.cells[1]
            cell_k.width = Inches(2.2)
            cell_v.width = Inches(4.3)

            # Cell styling
            shd_xml = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{"F8FAFC" if i % 2 == 0 else "FFFFFF"}"/>')
            cell_k._tc.get_or_add_tcPr().append(shd_xml)
            cell_v._tc.get_or_add_tcPr().append(parse_xml(f'<w:shd {nsdecls("w")} w:fill="{"F8FAFC" if i % 2 == 0 else "FFFFFF"}"/>'))

            pk = cell_k.paragraphs[0]
            pk.paragraph_format.space_before = Pt(3)
            pk.paragraph_format.space_after = Pt(3)
            rk = pk.add_run(k)
            rk.font.size = Pt(9.5)
            rk.font.bold = True
            rk.font.color.rgb = RGBColor(51, 65, 85)

            pv = cell_v.paragraphs[0]
            pv.paragraph_format.space_before = Pt(3)
            pv.paragraph_format.space_after = Pt(3)
            rv = pv.add_run(v)
            rv.font.size = Pt(9.5)
            rv.font.color.rgb = RGBColor(15, 23, 42)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

        # Section 1: Comparison Basis
        h1 = doc.add_heading(level=2)
        h1.paragraph_format.space_before = Pt(14)
        h1.paragraph_format.space_after = Pt(6)
        r_h1 = h1.add_run("1. Existing Comparative Contract Language")
        r_h1.font.size = Pt(12)
        r_h1.font.color.rgb = RGBColor(15, 23, 42)

        # Baseline A
        p_a = doc.add_paragraph()
        p_a.paragraph_format.space_before = Pt(4)
        p_a.paragraph_format.space_after = Pt(4)
        r_a_lbl = p_a.add_run(f"Baseline Provision ({doc_a_title}):\n")
        r_a_lbl.font.size = Pt(10)
        r_a_lbl.font.bold = True
        r_a_lbl.font.color.rgb = RGBColor(71, 85, 105)
        r_a_txt = p_a.add_run(f"\"{statement_a}\"")
        r_a_txt.font.size = Pt(10)
        r_a_txt.font.italic = True
        r_a_txt.font.color.rgb = RGBColor(30, 41, 59)

        # Counterparty B
        if statement_b:
            p_b = doc.add_paragraph()
            p_b.paragraph_format.space_before = Pt(4)
            p_b.paragraph_format.space_after = Pt(8)
            r_b_lbl = p_b.add_run(f"Counterparty Provision ({doc_b_title}):\n")
            r_b_lbl.font.size = Pt(10)
            r_b_lbl.font.bold = True
            r_b_lbl.font.color.rgb = RGBColor(71, 85, 105)
            r_b_txt = p_b.add_run(f"\"{statement_b}\"")
            r_b_txt.font.size = Pt(10)
            r_b_txt.font.italic = True
            r_b_txt.font.color.rgb = RGBColor(30, 41, 59)

        # Section 2: Redline Amendment (Tracked Changes)
        h2 = doc.add_heading(level=2)
        h2.paragraph_format.space_before = Pt(14)
        h2.paragraph_format.space_after = Pt(6)
        r_h2 = h2.add_run("2. Proposed Redline Amendment (Track Changes Markup)")
        r_h2.font.size = Pt(12)
        r_h2.font.color.rgb = RGBColor(15, 23, 42)

        # Render tracked changes clause
        p_redline = doc.add_paragraph()
        p_redline.paragraph_format.space_before = Pt(6)
        p_redline.paragraph_format.space_after = Pt(10)
        p_redline.paragraph_format.line_spacing = 1.25

        # Show previous text struck through if superseded
        if statement_a and statement_a.strip() != proposed_clause.strip():
            r_del = p_redline.add_run(f"[DELETED: {statement_a[:220]}{'...' if len(statement_a) > 220 else ''}] ")
            r_del.font.strike = True
            r_del.font.color.rgb = RGBColor(190, 18, 60)
            r_del.font.size = Pt(10.5)

        r_ins = p_redline.add_run(proposed_clause)
        r_ins.font.underline = True
        r_ins.font.bold = True
        r_ins.font.color.rgb = RGBColor(16, 120, 80)
        r_ins.font.size = Pt(10.5)

        # Section 3: Legal Rationale & Fallback Positions
        h3 = doc.add_heading(level=2)
        h3.paragraph_format.space_before = Pt(14)
        h3.paragraph_format.space_after = Pt(6)
        r_h3 = h3.add_run("3. Legal Rationale & Commercial Fallback Strategy")
        r_h3.font.size = Pt(12)
        r_h3.font.color.rgb = RGBColor(15, 23, 42)

        p_rat = doc.add_paragraph()
        p_rat.paragraph_format.space_before = Pt(2)
        p_rat.paragraph_format.space_after = Pt(6)
        r_rat = p_rat.add_run(rationale)
        r_rat.font.size = Pt(10)
        r_rat.font.color.rgb = RGBColor(30, 41, 59)

        if key_concessions:
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            p_conc_h = doc.add_paragraph()
            r_ch = p_conc_h.add_run("Negotiation Fallback Concessions:")
            r_ch.font.size = Pt(10)
            r_ch.font.bold = True
            r_ch.font.color.rgb = RGBColor(71, 85, 105)

            for conc in key_concessions:
                p_c = doc.add_paragraph(style='List Bullet')
                p_c.paragraph_format.space_before = Pt(1)
                p_c.paragraph_format.space_after = Pt(2)
                r_c = p_c.add_run(conc)
                r_c.font.size = Pt(9.5)
                r_c.font.color.rgb = RGBColor(30, 41, 59)

        # Footer Notice
        footer_p = doc.add_paragraph()
        footer_p.paragraph_format.space_before = Pt(24)
        footer_p.paragraph_format.space_after = Pt(0)
        r_foot = footer_p.add_run("CONFIDENTIAL & PRIVILEGED • PREPARED WITH CLARIO ENTERPRISE DOCUMENT INTELLIGENCE")
        r_foot.font.size = Pt(8)
        r_foot.font.color.rgb = RGBColor(148, 163, 184)

        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()
