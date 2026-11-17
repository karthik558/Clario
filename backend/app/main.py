import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import engine, Base, SessionLocal
from app.database.seed import seed_sample_documents
from app.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Initializing Clario database models...")
    Base.metadata.create_all(bind=engine)
    # Restore persisted public configuration before accepting requests.
    from app.services.settings_service import load_saved_settings
    with SessionLocal() as db:
        load_saved_settings(db)

    logger.info("Verifying seed corpus...")
    seed_sample_documents()

    logger.info(f"{settings.PROJECT_NAME} backend started successfully on port 8000.")
    yield
    logger.info("Shutting down Clario backend...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Clario — AI Document Intelligence Workspace with Vector Search & Comparative Analysis",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "version": "1.0.0",
        "api_docs": "/docs",
        "status": "operational"
    }
