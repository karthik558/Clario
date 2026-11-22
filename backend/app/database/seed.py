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
    Optional helper to populate the database with documents present in the documents/ directory.
    This is only executed if explicitly invoked by the developer with --seed-samples.
    """
    should_close = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        should_close = True

    try:
        result = DocumentService.sync_documents_folder(db)
        logger.info(f"Documents folder synced: {result}")
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    # By default, creates an empty database. Only seeds if explicitly requested with --seed-samples
    seed_flag = "--seed-samples" in sys.argv or "--sample" in sys.argv
    init_database(seed_samples=seed_flag)
