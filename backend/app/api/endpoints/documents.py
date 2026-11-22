import os
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.entities import Document, DocumentChunk
from app.schemas.dtos import DocumentResponse, DocumentDetailResponse, ChunkResponse
from app.services.document_service import DocumentService
from app.services.search_service import search_service

router = APIRouter()

@router.post("/documents/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    collection: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    parsed_tags = []
    if tags:
        try:
            parsed_tags = json.loads(tags)
        except Exception:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    doc = DocumentService.upload_document(
        file=file,
        title=title,
        tags=parsed_tags,
        collection=collection,
        db=db
    )
    if doc.status == "ERROR":
        raise HTTPException(status_code=422, detail=doc.error_message or "Could not extract document text.")
    # Refresh search index
    search_service.reload_index(db)

    dto = DocumentResponse.model_validate(doc)
    dto.tags = json.loads(doc.tags_json) if doc.tags_json else []
    return dto

@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(
    search: Optional[str] = None,
    status: Optional[str] = None,
    collection: Optional[str] = None,
    db: Session = Depends(get_db)
):
    docs = DocumentService.list_documents(db=db, search=search, status=status, collection=collection)
    result = []
    for d in docs:
        dto = DocumentResponse.model_validate(d)
        dto.tags = json.loads(d.tags_json) if d.tags_json else []
        result.append(dto)
    return result

@router.get("/documents/{doc_id}", response_model=DocumentDetailResponse)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = DocumentService.get_document(doc_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    dto = DocumentDetailResponse.model_validate(doc)
    dto.tags = json.loads(doc.tags_json) if doc.tags_json else []
    dto.chunks = [ChunkResponse.model_validate(c) for c in doc.chunks]
    return dto

@router.get("/documents/{doc_id}/file")
def get_document_file(doc_id: str, db: Session = Depends(get_db)):
    doc = DocumentService.get_document(doc_id, db)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="Physical document file missing from storage.")

    media_type = "application/octet-stream"
    if doc.file_type == "pdf":
        media_type = "application/pdf"
    elif doc.file_type in ["txt", "md"]:
        media_type = "text/plain"

    return FileResponse(
        path=doc.storage_path,
        filename=doc.filename,
        media_type=media_type
    )

@router.post("/documents/sync")
def sync_documents_folder(db: Session = Depends(get_db)):
    result = DocumentService.sync_documents_folder(db)
    return {
        "status": "success",
        "message": f"Folder synced: {result['added']} added, {result['removed']} removed.",
        **result
    }

@router.delete("/documents/clear-all")
def clear_all_documents(delete_files: bool = True, db: Session = Depends(get_db)):
    count = DocumentService.clear_all_documents(db, delete_files=delete_files)
    search_service.reload_index(db)
    return {
        "message": f"Successfully cleared all {count} documents.",
        "cleared_count": count,
        "deleted_from_disk": delete_files
    }

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, delete_file: bool = True, db: Session = Depends(get_db)):
    success = DocumentService.delete_document(doc_id, db, delete_file=delete_file)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    search_service.reload_index(db)
    return {
        "message": "Document deleted successfully",
        "id": doc_id,
        "deleted_from_disk": delete_file
    }
