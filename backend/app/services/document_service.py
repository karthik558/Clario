import os
import json
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logging import logger
from app.models.entities import Document, DocumentChunk, IngestionJob
from app.ingestion.parser import DocumentParser
from app.ingestion.chunker import SemanticChunker
from app.search.vector_engine import FastSemanticEmbeddingProvider

chunker = SemanticChunker(target_chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
embedder = FastSemanticEmbeddingProvider(dim=384)

class DocumentService:
    @staticmethod
    def process_file_content(
        doc_id: str,
        file_path: str,
        file_type: str,
        db: Session
    ):
        job = db.query(IngestionJob).filter(IngestionJob.document_id == doc_id).first()
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        try:
            # Stage 1: Parsing / Text Extraction
            if job:
                job.status = "EXTRACTING"
                job.progress_percent = 20
                job.current_stage = "Extracting text and page boundaries"
                db.commit()

            pages = DocumentParser.parse(file_path, file_type)
            page_count = len(pages)
            total_text = "\n\n".join([p.text for p in pages])
            if not total_text.strip():
                raise ValueError("No readable text found in this document.")
            word_count = len(total_text.split())

            doc.page_count = max(1, page_count)
            doc.word_count = word_count
            db.commit()

            # Stage 2: Chunking
            if job:
                job.status = "CHUNKING"
                job.progress_percent = 50
                job.current_stage = f"Segmenting {page_count} pages into semantic chunks"
                db.commit()

            chunks_data = chunker.chunk_pages(pages)
            if not chunks_data and total_text.strip():
                # Fallback if chunker didn't produce chunks
                from app.ingestion.chunker import ChunkData
                chunks_data = [
                    ChunkData(
                        chunk_index=0,
                        page_number=1,
                        start_char=0,
                        end_char=len(total_text),
                        content=total_text[:1000],
                        token_count=len(total_text[:1000].split())
                    )
                ]

            # Stage 3: Embedding
            if job:
                job.status = "EMBEDDING"
                job.progress_percent = 75
                job.current_stage = f"Generating vector embeddings for {len(chunks_data)} passages"
                db.commit()

            db_chunks = []
            for cd in chunks_data:
                embedding_vector = embedder.encode(cd.content)
                db_chunk = DocumentChunk(
                    id=str(uuid.uuid4()),
                    document_id=doc.id,
                    chunk_index=cd.chunk_index,
                    page_number=cd.page_number,
                    start_char=cd.start_char,
                    end_char=cd.end_char,
                    content=cd.content,
                    token_count=cd.token_count,
                    embedding_json=json.dumps(embedding_vector),
                    metadata_json=json.dumps({
                        "document_title": doc.title,
                        "file_type": doc.file_type,
                        "page": cd.page_number
                    })
                )
                db_chunks.append(db_chunk)

            db.bulk_save_objects(db_chunks)
            doc.chunk_count = len(db_chunks)
            doc.status = "READY"

            if job:
                job.status = "COMPLETED"
                job.progress_percent = 100
                job.current_stage = "Ready for semantic search and comparative analysis"
                job.message = f"Successfully indexed {len(db_chunks)} chunks across {page_count} pages."
                db.commit()

            db.commit()
            logger.info(f"Document {doc.title} ({doc.id}) processed successfully with {len(db_chunks)} chunks.")

        except Exception as e:
            logger.error(f"Failed to process document {doc_id}: {str(e)}", exc_info=True)
            doc.status = "ERROR"
            doc.error_message = str(e)
            if job:
                job.status = "FAILED"
                job.message = str(e)
            db.commit()

    @classmethod
    def upload_document(
        cls,
        file: UploadFile,
        title: Optional[str],
        tags: Optional[List[str]],
        collection: Optional[str],
        db: Session
    ) -> Document:
        filename = file.filename or "uploaded_document"
        ext = filename.split(".")[-1].lower() if "." in filename else "txt"
        
        valid_exts = ["pdf", "docx", "doc", "txt", "md", "xlsx", "xls", "xlsm", "csv", "json"]
        if ext not in valid_exts:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '.{ext}'. Supported formats are: PDF, DOCX, TXT, MD, Excel (.xlsx, .xls), CSV, JSON."
            )

        doc_id = str(uuid.uuid4())
        clean_filename = Path(filename).name
        dest_candidate = settings.DOCUMENTS_DIR / clean_filename
        if dest_candidate.exists():
            stem = dest_candidate.stem
            suffix = dest_candidate.suffix
            safe_filename = f"{stem}_{doc_id[:8]}{suffix}"
        else:
            safe_filename = clean_filename
        storage_path = str(settings.DOCUMENTS_DIR / safe_filename)

        with open(storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size = os.path.getsize(storage_path)
        if file_size == 0:
            os.remove(storage_path)
            raise HTTPException(status_code=400, detail="Uploaded file is empty (0 bytes).")

        doc_title = title.strip() if title and title.strip() else filename.rsplit(".", 1)[0]
        tags_list = tags if tags is not None else []
        coll_name = collection.strip() if collection and collection.strip() else "General"

        doc = Document(
            id=doc_id,
            title=doc_title,
            filename=filename,
            file_type=ext,
            file_size=file_size,
            storage_path=storage_path,
            status="PROCESSING",
            tags_json=json.dumps(tags_list),
            collection=coll_name
        )
        db.add(doc)

        job = IngestionJob(
            id=str(uuid.uuid4()),
            document_id=doc_id,
            status="PENDING",
            progress_percent=10,
            current_stage="Queued for ingestion",
            message="File received and validated."
        )
        db.add(job)
        db.commit()
        db.refresh(doc)

        # Synchronously process for local reliability
        cls.process_file_content(doc_id, storage_path, ext, db)
        db.refresh(doc)
        return doc

    @staticmethod
    def get_document(doc_id: str, db: Session) -> Optional[Document]:
        return db.query(Document).filter(Document.id == doc_id).first()

    @staticmethod
    def list_documents(
        db: Session,
        search: Optional[str] = None,
        status: Optional[str] = None,
        collection: Optional[str] = None
    ) -> List[Document]:
        q = db.query(Document)
        if search:
            q = q.filter(Document.title.ilike(f"%{search}%") | Document.filename.ilike(f"%{search}%"))
        if status:
            q = q.filter(Document.status == status.upper())
        if collection:
            q = q.filter(Document.collection == collection)
        return q.order_by(Document.created_at.desc()).all()

    @staticmethod
    def delete_document(doc_id: str, db: Session) -> bool:
        from app.models.entities import Finding, Comparison, IngestionJob, DocumentChunk, AnswerRecord, Report
        from app.services.search_service import search_service

        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return False
        
        # Remove file from disk
        try:
            if os.path.exists(doc.storage_path):
                os.remove(doc.storage_path)
        except Exception as e:
            logger.warning(f"Could not remove file {doc.storage_path}: {e}")

        # Delete all findings and comparisons referencing this document
        db.query(Finding).filter(
            (Finding.doc_a_id == doc_id) | (Finding.doc_b_id == doc_id)
        ).delete(synchronize_session=False)

        db.query(Comparison).filter(
            (Comparison.doc_a_id == doc_id) | (Comparison.doc_b_id == doc_id)
        ).delete(synchronize_session=False)

        # Explicitly delete chunks and jobs
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete(synchronize_session=False)
        db.query(IngestionJob).filter(IngestionJob.document_id == doc_id).delete(synchronize_session=False)

        # Delete document record
        db.delete(doc)

        # Purge any remaining orphan findings or comparisons
        all_doc_ids = [d.id for d in db.query(Document.id).filter(Document.id != doc_id).all()]
        if not all_doc_ids:
            db.query(Finding).delete(synchronize_session=False)
            db.query(Comparison).delete(synchronize_session=False)
            db.query(Report).delete(synchronize_session=False)
            db.query(AnswerRecord).delete(synchronize_session=False)
        else:
            db.query(Finding).filter(~Finding.doc_a_id.in_(all_doc_ids)).delete(synchronize_session=False)
            db.query(Comparison).filter(~Comparison.doc_a_id.in_(all_doc_ids)).delete(synchronize_session=False)

        db.commit()

        # Reload in-memory search index immediately to purge deleted chunks
        search_service.reload_index(db)
        return True

    @staticmethod
    def clear_all_documents(db: Session) -> int:
        from app.models.entities import Finding, Comparison, IngestionJob, DocumentChunk, AnswerRecord, Report
        from app.services.search_service import search_service

        docs = db.query(Document).all()
        count = len(docs)
        for doc in docs:
            try:
                if os.path.exists(doc.storage_path):
                    os.remove(doc.storage_path)
            except Exception as e:
                logger.warning(f"Could not remove file {doc.storage_path}: {e}")
            db.delete(doc)
        
        db.query(DocumentChunk).delete()
        db.query(IngestionJob).delete()
        db.query(Finding).delete()
        db.query(Comparison).delete()
        db.query(AnswerRecord).delete()
        db.query(Report).delete()
        db.commit()

        # Reload in-memory search index so it is completely empty
        search_service.reload_index(db)
        return count

    @classmethod
    def sync_documents_folder(cls, db: Session) -> dict:
        """
        Scans the top-level documents/ directory.
        - Automatically ingests any new files that were placed in documents/ but not yet in database.
        - Automatically cleans up any database records whose underlying file was removed from documents/.
        """
        from app.services.search_service import search_service
        from app.models.entities import Finding, Comparison, IngestionJob, DocumentChunk

        valid_exts = {".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".xls", ".xlsm", ".csv", ".json"}
        added = 0
        removed = 0

        # 1. Clean up database records if the physical file was deleted from documents/
        all_docs = db.query(Document).all()
        for doc in all_docs:
            if not os.path.exists(doc.storage_path):
                logger.info(f"File missing on disk for '{doc.title}', purging from database...")
                db.query(Finding).filter((Finding.doc_a_id == doc.id) | (Finding.doc_b_id == doc.id)).delete(synchronize_session=False)
                db.query(Comparison).filter((Comparison.doc_a_id == doc.id) | (Comparison.doc_b_id == doc.id)).delete(synchronize_session=False)
                db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete(synchronize_session=False)
                db.query(IngestionJob).filter(IngestionJob.document_id == doc.id).delete(synchronize_session=False)
                db.delete(doc)
                removed += 1

        # 2. Ingest any files on disk not yet in database
        existing_paths = {os.path.abspath(d.storage_path) for d in db.query(Document).all()}
        
        if settings.DOCUMENTS_DIR.exists():
            for p in sorted(settings.DOCUMENTS_DIR.iterdir()):
                if p.is_file() and p.suffix.lower() in valid_exts and not p.name.startswith("."):
                    abs_path = os.path.abspath(str(p))
                    if abs_path not in existing_paths:
                        try:
                            logger.info(f"Syncing new document from documents/ folder: {p.name}")
                            doc_id = str(uuid.uuid4())
                            ext = p.suffix.lstrip(".").lower()
                            file_size = p.stat().st_size
                            doc_title = p.stem.replace("_", " ")

                            doc = Document(
                                id=doc_id,
                                title=doc_title,
                                filename=p.name,
                                file_type=ext,
                                file_size=file_size,
                                storage_path=str(p),
                                status="PROCESSING",
                                tags_json="[]",
                                collection="General"
                            )
                            db.add(doc)
                            job = IngestionJob(
                                id=str(uuid.uuid4()),
                                document_id=doc_id,
                                status="PENDING",
                                progress_percent=10,
                                current_stage="Queued for ingestion",
                                message="File discovered from documents/ directory."
                            )
                            db.add(job)
                            db.commit()
                            db.refresh(doc)

                            cls.process_file_content(doc_id, str(p), ext, db)
                            existing_paths.add(abs_path)
                            added += 1
                        except Exception as e:
                            logger.warning(f"Error ingesting {p.name} during folder sync: {e}")

        db.commit()
        if added > 0 or removed > 0:
            search_service.reload_index(db)

        total_docs = db.query(Document).count()
        return {"added": added, "removed": removed, "total_documents": total_docs}
