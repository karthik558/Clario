import os
import shutil
import uuid
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from app.core.config import settings
from app.core.logging import logger
from app.database.session import SessionLocal, engine, Base
from app.models.entities import Document, Workspace, Finding
from app.services.document_service import DocumentService
from app.services.compare_service import CompareService
from app.services.search_service import search_service

def create_sample_pdf(title: str, text: str, output_path: str):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=50,
        leftMargin=50,
        topMargin=50,
        bottomMargin=50
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        textColor=colors.HexColor('#14263D'),
        spaceAfter=12
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#233448'),
        spaceAfter=10
    )
    elements = [Paragraph(title, title_style), Spacer(1, 10)]
    for p in text.split("\n\n"):
        if p.strip():
            elements.append(Paragraph(p.strip().replace("\n", "<br/>"), body_style))
    doc.build(elements)

def seed_sample_documents():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing_docs = db.query(Document).count()
    if existing_docs > 0:
        logger.info(f"Database already has {existing_docs} documents. Skipping seed.")
        search_service.reload_index(db)
        db.close()
        return

    logger.info("Seeding synthetic sample documents into Clario database...")

    sample_dir = settings.DATA_DIR.parent.parent / "sample_documents"
    sample_files = [
        ("CloudScale Data Retention Policy 2023 (v1.0)", "CloudScale_Data_Retention_Policy_2023_v1.0.md", "Policy", ["compliance", "retention", "v1"]),
        ("CloudScale Data Retention Policy 2024 (v2.0)", "CloudScale_Data_Retention_Policy_2024_v2.0.md", "Policy", ["compliance", "retention", "v2", "updated"]),
        ("NexusAI Commercial Service Agreement 2023", "NexusAI_Commercial_Service_Agreement_2023.md", "Contracts", ["legal", "contract", "liability", "2023"]),
        ("NexusAI Commercial Service Agreement 2024 (Revised)", "NexusAI_Commercial_Service_Agreement_2024_Revised.md", "Contracts", ["legal", "contract", "liability", "2024"]),
        ("Synthetic Patient Data Under Differential Privacy", "Research_Paper_Synthetic_Data_Healthcare_AI.md", "Research", ["differential-privacy", "healthcare", "ai"]),
        ("Evaluation of EHR Privacy Risks in Synthetic Models", "Research_Paper_Evaluation_of_EHR_Privacy_Risks.md", "Research", ["differential-privacy", "vulnerabilities", "shadow-model"]),
    ]

    for title, fname, coll, tags in sample_files:
        src = sample_dir / fname
        if not src.exists():
            continue

        with open(src, "r", encoding="utf-8") as f:
            content = f.read()

        # Generate corresponding PDF for half of the documents to show multi-format support!
        is_pdf = "Retention" in fname or "NexusAI_Commercial_Service_Agreement_2023" in fname
        ext = "pdf" if is_pdf else "md"
        doc_id = str(uuid.uuid4())
        dest_filename = f"{doc_id}_{fname.rsplit('.', 1)[0]}.{ext}"
        dest_path = str(settings.DOCUMENTS_DIR / dest_filename)

        if is_pdf:
            create_sample_pdf(title, content, dest_path)
            file_size = os.path.getsize(dest_path)
        else:
            shutil.copyfile(str(src), dest_path)
            file_size = os.path.getsize(dest_path)

        import json
        doc = Document(
            id=doc_id,
            title=title,
            filename=f"{fname.rsplit('.', 1)[0]}.{ext}",
            file_type=ext,
            file_size=file_size,
            storage_path=dest_path,
            status="PROCESSING",
            tags_json=json.dumps(tags),
            collection=coll
        )
        db.add(doc)
        db.commit()

        DocumentService.process_file_content(doc_id, dest_path, ext, db)

    # Reload search indexes
    search_service.reload_index(db)

    # Automatically scan for initial contradiction candidates to populate Findings!
    docs = db.query(Document).filter(Document.status == "READY").all()
    if len(docs) >= 2:
        for i in range(len(docs)):
            for j in range(i + 1, len(docs)):
                doc_a, doc_b = docs[i], docs[j]
                try:
                    comp = CompareService.compare_documents(doc_a.id, doc_b.id, db)
                    for cand in comp.contradiction_candidates:
                        existing = db.query(Finding).filter(
                            Finding.title == cand.topic,
                            Finding.doc_a_id == doc_a.id,
                            Finding.doc_b_id == doc_b.id
                        ).first()
                        if not existing:
                            finding = Finding(
                                id=str(uuid.uuid4()),
                                category="possible_contradiction",
                                title=cand.topic,
                                description=cand.explanation,
                                severity="high" if cand.confidence == "high" else "medium",
                                status="open",
                                doc_a_id=doc_a.id,
                                doc_a_title=doc_a.title,
                                doc_a_page=cand.page_a,
                                doc_a_quote=cand.statement_a,
                                doc_b_id=doc_b.id,
                                doc_b_title=doc_b.title,
                                doc_b_page=cand.page_b,
                                doc_b_quote=cand.statement_b,
                                reviewer_notes="Initial finding flagged automatically during corpus ingestion."
                            )
                            db.add(finding)
                except Exception as e:
                    logger.warning(f"Error during initial seed comparison: {e}")

    db.commit()
    db.close()
    logger.info("Sample documents seeded successfully.")

if __name__ == "__main__":
    seed_sample_documents()
