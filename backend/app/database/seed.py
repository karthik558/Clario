import sys
import json
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.core.config import settings
from app.core.logging import logger
from app.database.session import SessionLocal, engine, Base
from app.models.entities import Document, Workspace, Finding, AppConfiguration
from app.services.document_service import DocumentService
from app.services.compare_service import CompareService
from app.services.search_service import search_service

def init_database(seed_samples: bool = False):
    """
    Initializes the local SQLite database schema.
    By default, creates a clean, fresh, empty database ready for user documents.
    Sample documents are NEVER seeded unless seed_samples=True is explicitly passed.
    """
    Base.metadata.create_all(bind=engine)
    logger.info("Local database schema verified and initialized.")

    db = SessionLocal()
    try:
        # Ensure default workspace configuration exists
        config = db.query(AppConfiguration).filter(AppConfiguration.id == "workspace").first()
        if not config:
            config = AppConfiguration(id="workspace", settings_json=json.dumps({"initialized": True}))
            db.add(config)
            db.commit()

        if seed_samples:
            seed_sample_documents(db)
    finally:
        db.close()


def seed_sample_documents(db=None):
    """
    Optional helper to populate the database with demonstration sample documents.
    This is only executed if explicitly invoked by the developer with --seed-samples.
    """
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    try:
        sample_dir = Path(__file__).resolve().parents[3] / "sample_documents"
        seeded_new = False

        if sample_dir.exists():
            for src in sorted(sample_dir.glob("*.pdf")):
                doc_title = src.stem
                existing = db.query(Document).filter(
                    (Document.filename == src.name) | (Document.title == doc_title)
                ).first()
                if not existing:
                    logger.info(f"Seeding sample document: {src.name}")
                    with src.open("rb") as stream:
                        DocumentService.upload_document(UploadFile(stream, filename=src.name), None, [], "General", db)
                    seeded_new = True

        # Reload search indexes
        search_service.reload_index(db)

        # Automatically scan for initial contradiction candidates if sample documents seeded
        docs = db.query(Document).filter(Document.status == "READY").all()
        if len(docs) >= 2 and (seeded_new or db.query(Finding).count() == 0):
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
        logger.info("Sample documents seeded successfully.")
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    # By default, creates an empty database. Only seeds if explicitly requested with --seed-samples
    seed_flag = "--seed-samples" in sys.argv or "--sample" in sys.argv
    init_database(seed_samples=seed_flag)
