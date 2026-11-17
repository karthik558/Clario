import httpx
from typing import Dict, Any, Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
from pydantic import BaseModel, Field, field_validator
from urllib.parse import urlsplit
from app.services.settings_service import save_settings

from app.core.config import settings
from app.database.session import get_db, engine
from app.services.search_service import search_service

router = APIRouter()

class SettingsUpdateRequest(BaseModel):
    llm_provider: Optional[Literal["extractive", "ollama", "gemini", "openai"]] = None
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = Field(default=None, min_length=1, max_length=200)
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    bm25_k1: Optional[float] = Field(default=None, gt=0, le=10, allow_inf_nan=False)
    bm25_b: Optional[float] = Field(default=None, ge=0, le=1, allow_inf_nan=False)
    rrf_k: Optional[int] = Field(default=None, ge=1, le=1000)
    default_top_k: Optional[int] = Field(default=None, ge=1, le=50)

    @field_validator("ollama_base_url")
    @classmethod
    def valid_ollama_url(cls, value):
        if value is None:
            return value
        parsed = urlsplit(value.strip())
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Enter an HTTP(S) server URL without credentials, query, or fragment")
        return value.strip().rstrip("/")

    @field_validator("ollama_model")
    @classmethod
    def nonempty_model(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Model name is required")
        return value.strip() if value is not None else value

@router.get("/settings")
def get_system_settings():
    return {
        "project_name": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "llm_provider": settings.LLM_PROVIDER,
        "ollama_base_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
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
    save_settings(db, data.model_dump(exclude_none=True))
    # Existing credential updates stay in memory; never include secrets in the database explorer.
    if data.gemini_api_key is not None:
        settings.GEMINI_API_KEY = data.gemini_api_key
    if data.openai_api_key is not None:
        settings.OPENAI_API_KEY = data.openai_api_key

    return {
        "status": "success",
        "message": "Settings saved to the database.",
        "settings": {
            "llm_provider": settings.LLM_PROVIDER,
            "ollama_base_url": settings.OLLAMA_BASE_URL,
            "ollama_model": settings.OLLAMA_MODEL,
            "gemini_api_key_configured": bool(settings.GEMINI_API_KEY),
            "openai_api_key_configured": bool(settings.OPENAI_API_KEY),
            "bm25_k1": settings.BM25_K1,
            "bm25_b": settings.BM25_B,
            "rrf_k": settings.RRF_K,
            "default_top_k": settings.DEFAULT_TOP_K
        }
    }

@router.get("/settings/ollama/status")
def check_ollama_status():
    """
    Checks if Ollama is running locally and queries installed models.
    """
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags"
    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {
                    "running": True,
                    "url": settings.OLLAMA_BASE_URL,
                    "models": models,
                    "active_model": settings.OLLAMA_MODEL,
                    "message": f"Connected to Ollama. {len(models)} model(s) available."
                }
    except (httpx.HTTPError, ValueError, TypeError):
        pass
    return {
        "running": False,
        "url": settings.OLLAMA_BASE_URL,
        "models": [],
        "active_model": settings.OLLAMA_MODEL,
        "message": f"Could not reach Ollama at {settings.OLLAMA_BASE_URL}. Start Ollama and check the saved server address."
    }

@router.get("/settings/database/tables")
def get_database_tables():
    """
    Returns all tables and row counts in the SQLite database.
    """
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    tables_info = []

    with engine.connect() as conn:
        for tname in table_names:
            try:
                count_res = conn.execute(text(f"SELECT COUNT(*) FROM {tname}"))
                row_count = count_res.scalar() or 0
                tables_info.append({
                    "name": tname,
                    "row_count": row_count
                })
            except Exception:
                tables_info.append({"name": tname, "row_count": 0})

    return {
        "database_file": str(settings.DATA_DIR / "clario.db"),
        "tables": tables_info
    }

@router.get("/settings/database/table/{table_name}")
def inspect_database_table(table_name: str, limit: int = 50):
    """
    Inspects rows from a specific database table.
    """
    inspector = inspect(engine)
    valid_tables = inspector.get_table_names()
    if table_name not in valid_tables:
        raise HTTPException(status_code=404, detail="Table not found")

    with engine.connect() as conn:
        columns = [c["name"] for c in inspector.get_columns(table_name)]
        query = text(f"SELECT * FROM {table_name} LIMIT :limit")
        rows = conn.execute(query, {"limit": limit}).fetchall()
        
        result_rows = []
        for r in rows:
            row_dict = {}
            for i, col in enumerate(columns):
                val = r[i]
                # truncate long text/vectors for clean display
                if isinstance(val, str) and len(val) > 160:
                    val = val[:160] + "..."
                row_dict[col] = val
            result_rows.append(row_dict)

        return {
            "table": table_name,
            "columns": columns,
            "total_rows_returned": len(result_rows),
            "rows": result_rows
        }

@router.post("/settings/reindex")
def trigger_reindex(db: Session = Depends(get_db)):
    search_service.reload_index(db)
    return {
        "status": "success",
        "indexed_chunks": search_service._last_chunk_count,
        "message": "All document chunks successfully reloaded and reindexed."
    }
