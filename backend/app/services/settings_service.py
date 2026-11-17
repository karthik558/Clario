"""Persist public workspace configuration; credentials remain environment-owned."""
import json
from threading import RLock
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import AppConfiguration

SETTINGS_FIELDS = (
    "llm_provider",
    "ollama_base_url",
    "ollama_model",
    "local_ai_base_url",
    "local_ai_model",
    "local_ai_provider",
    "local_ai_api_key",
    "thinking_mode",
    "bm25_k1",
    "bm25_b",
    "rrf_k",
    "default_top_k"
)
settings_lock = RLock()


def apply_settings(values):
    from app.services.search_service import search_service
    for key in SETTINGS_FIELDS:
        if key in values:
            setattr(settings, key.upper(), values[key])
    search_service.bm25_engine.k1 = settings.BM25_K1
    search_service.bm25_engine.b = settings.BM25_B
    search_service.hybrid_engine.rrf_k = settings.RRF_K
    # Rebuild on the next retrieval using the loaded parameters.
    search_service._last_chunk_count = -1


def load_saved_settings(db: Session):
    with settings_lock:
        row = db.get(AppConfiguration, "workspace")
        if row is None:
            values = {key: getattr(settings, key.upper()) for key in SETTINGS_FIELDS}
            db.add(AppConfiguration(id="workspace", settings_json=json.dumps(values)))
            db.commit()
        else:
            values = json.loads(row.settings_json)
        apply_settings(values)


def save_settings(db: Session, updates):
    with settings_lock:
        row = db.get(AppConfiguration, "workspace")
        values = json.loads(row.settings_json) if row else {key: getattr(settings, key.upper()) for key in SETTINGS_FIELDS}
        values.update({key: value for key, value in updates.items() if key in SETTINGS_FIELDS})
        if row is None:
            row = AppConfiguration(id="workspace")
            db.add(row)
        row.settings_json = json.dumps(values)
        db.commit()
        apply_settings(values)
