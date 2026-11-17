import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Clario"
    TAGLINE: str = "Every document. A clearer answer."
    API_V1_PREFIX: str = "/api"
    
    # Storage
    DATA_DIR: Path = BASE_DIR / "data"
    DOCUMENTS_DIR: Path = BASE_DIR / "data" / "documents"
    REPORTS_DIR: Path = BASE_DIR / "data" / "reports"
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/data/clario.db"
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Information Retrieval Tuning
    BM25_K1: float = 1.5
    BM25_B: float = 0.75
    RRF_K: int = 60
    DEFAULT_TOP_K: int = 5
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    
    # AI / LLM Configuration
    # Options: "extractive", "ollama", "gemini", "openai"
    LLM_PROVIDER: str = "extractive"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"
    OPENAI_MODEL: str = "gpt-4o-mini"

settings = Settings()

settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
