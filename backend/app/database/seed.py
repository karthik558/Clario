import json
import uuid
from pathlib import Path
from fastapi import UploadFile
from app.core.config import settings
from app.core.logging import logger
from app.database.session import SessionLocal, engine, Base
from app.models.entities import Document, Workspace, Finding
from app.services.document_service import DocumentService
from app.services.compare_service import CompareService
from app.services.search_service import search_service

def seed_sample_documents():
    from app.models.entities import AppConfiguration

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    config = db.query(AppConfiguration).filter(AppConfiguration.id == "workspace").first()
    has_seeded = False
    if config:
        try:
            cfg_data = json.loads(config.settings_json or "{}")
            has_seeded = cfg_data.get("has_seeded", False)
        except Exception:
            has_seeded = False

    # If the workspace was already seeded before, respect user deletions!
    if has_seeded:
        logger.info("Workspace already initialized. Skipping auto-seed so deleted documents stay deleted.")
        search_service.reload_index(db)
        db.close()
        return

    existing_docs = db.query(Document).count()
    if existing_docs > 0:
        logger.info(f"Database already has {existing_docs} documents. Skipping seed.")
        if config:
            try:
                cfg_data = json.loads(config.settings_json or "{}")
                cfg_data["has_seeded"] = True
                config.settings_json = json.dumps(cfg_data)
                db.commit()
            except Exception:
                pass
        search_service.reload_index(db)
        db.close()
        return

    sample_dir = Path(__file__).resolve().parents[3] / "sample_documents"
    for src in sorted(sample_dir.glob("*.pdf")):
        with src.open("rb") as stream:
            DocumentService.upload_document(UploadFile(stream, filename=src.name), None, [], "General", db)

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

    # Mark workspace as seeded so deletions are permanent
    config = db.query(AppConfiguration).filter(AppConfiguration.id == "workspace").first()
    if not config:
        config = AppConfiguration(id="workspace", settings_json=json.dumps({"has_seeded": True}))
        db.add(config)
    else:
        try:
            cfg_data = json.loads(config.settings_json or "{}")
            cfg_data["has_seeded"] = True
            config.settings_json = json.dumps(cfg_data)
        except Exception:
            pass

    db.commit()
    db.close()
    logger.info("Sample documents seeded successfully.")

if __name__ == "__main__":
    seed_sample_documents()
