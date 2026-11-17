from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.database.session import get_db
from app.services.search_service import search_service

router = APIRouter()

class SettingsUpdateRequest(BaseModel):
    llm_provider: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    bm25_k1: Optional[float] = None
    bm25_b: Optional[float] = None
    rrf_k: Optional[int] = None
    default_top_k: Optional[int] = None

@router.get("/settings")
def get_system_settings():
    return {
        "project_name": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "llm_provider": settings.LLM_PROVIDER,
        "gemini_api_key_configured": bool(settings.GEMINI_API_KEY),
        "openai_api_key_configured": bool(settings.OPENAI_API_KEY),
        "bm25_k1": settings.BM25_K1,
        "bm25_b": settings.BM25_B,
        "rrf_k": settings.RRF_K,
        "default_top_k": settings.DEFAULT_TOP_K,
        "chunk_size": settings.CHUNK_SIZE,
        "chunk_overlap": settings.CHUNK_OVERLAP,
        "storage_dir": str(settings.DOCUMENTS_DIR),
        "database_url": settings.DATABASE_URL
    }

@router.post("/settings")
def update_system_settings(data: SettingsUpdateRequest, db: Session = Depends(get_db)):
    if data.llm_provider is not None:
        settings.LLM_PROVIDER = data.llm_provider
    if data.gemini_api_key is not None:
        settings.GEMINI_API_KEY = data.gemini_api_key
    if data.openai_api_key is not None:
        settings.OPENAI_API_KEY = data.openai_api_key
    if data.bm25_k1 is not None:
        settings.BM25_K1 = data.bm25_k1
        search_service.bm25_engine.k1 = data.bm25_k1
    if data.bm25_b is not None:
        settings.BM25_B = data.bm25_b
        search_service.bm25_engine.b = data.bm25_b
    if data.rrf_k is not None:
        settings.RRF_K = data.rrf_k
        search_service.hybrid_engine.rrf_k = data.rrf_k
    if data.default_top_k is not None:
        settings.DEFAULT_TOP_K = data.default_top_k

    # Re-index
    search_service.reload_index(db)

    return {
        "status": "success",
        "message": "Settings updated and search index reloaded.",
        "settings": {
            "llm_provider": settings.LLM_PROVIDER,
            "gemini_api_key_configured": bool(settings.GEMINI_API_KEY),
            "openai_api_key_configured": bool(settings.OPENAI_API_KEY),
            "bm25_k1": settings.BM25_K1,
            "bm25_b": settings.BM25_B,
            "rrf_k": settings.RRF_K,
            "default_top_k": settings.DEFAULT_TOP_K
        }
    }

@router.post("/settings/reindex")
def trigger_reindex(db: Session = Depends(get_db)):
    search_service.reload_index(db)
    return {
        "status": "success",
        "indexed_chunks": search_service._last_chunk_count,
        "message": "All document chunks successfully reloaded and reindexed."
    }
