import os
from pathlib import Path
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

from fastapi.responses import HTMLResponse, FileResponse
from fastapi.openapi.docs import get_swagger_ui_html

BRAND_ASSETS = Path(__file__).resolve().parents[2] / "frontend" / "public"

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Clario — AI Document Intelligence Workspace with Vector Search & Comparative Analysis",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
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

@app.get("/favicon.svg", include_in_schema=False)
@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse(BRAND_ASSETS / "favicon.svg", media_type="image/svg+xml")

@app.get("/clario.webp", include_in_schema=False)
async def brand_logo():
    return FileResponse(BRAND_ASSETS / "clario.webp", media_type="image/webp")

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui():
    html = get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title=f"{settings.PROJECT_NAME} — API Specification",
        swagger_favicon_url="/favicon.svg",
        swagger_ui_parameters={"defaultModelsExpandDepth": 1, "docExpansion": "list"}
    )
    custom_css = """
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after {
        box-sizing: border-box;
      }
      body {
        margin: 0 !important;
        background-color: #F8FAFC !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        color: #0F172A !important;
        -webkit-font-smoothing: antialiased;
      }
      .clario-header {
        background: #0F172A;
        padding: 0 28px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        position: sticky;
        top: 0;
        z-index: 100;
      }
      .clario-logo-wrap {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        cursor: pointer;
        transition: opacity 0.15s ease;
      }
      .clario-logo-wrap:hover {
        opacity: 0.9;
      }
      .clario-title {
        color: #FFFFFF;
        font-size: 20px;
        font-weight: 600;
        letter-spacing: -0.025em;
        margin: 0;
        line-height: 1;
      }
      .clario-badge-tag {
        font-size: 11px;
        font-weight: 500;
        color: #94A3B8;
        font-family: 'JetBrains Mono', monospace;
        background: rgba(255, 255, 255, 0.08);
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        margin-left: 2px;
      }
      .clario-nav-right {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .clario-badge {
        background: rgba(255, 255, 255, 0.08);
        color: #E2E8F0;
        padding: 4px 10px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 500;
        border: 1px solid rgba(255, 255, 255, 0.12);
        font-family: 'JetBrains Mono', monospace;
      }
      .clario-web-btn {
        color: #FFFFFF;
        text-decoration: none;
        font-size: 12px;
        font-weight: 500;
        padding: 7px 14px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 6px;
        transition: all 0.15s ease;
      }
      .clario-web-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #FFFFFF;
      }
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui { font-family: 'Inter', sans-serif !important; }
      .swagger-ui .wrapper { max-width: 1240px; padding: 0 24px; }
      .swagger-ui .info { margin: 32px 0 24px 0 !important; }
      .swagger-ui .info .title { font-size: 28px !important; font-weight: 700 !important; color: #0F172A !important; letter-spacing: -0.02em; }
      .swagger-ui .info p { font-size: 14px !important; color: #475569 !important; line-height: 1.6 !important; }
      .swagger-ui .opblock-tag { font-size: 17px !important; font-weight: 700 !important; color: #0F172A !important; border-bottom: 1px solid #E2E8F0 !important; padding: 16px 0 8px 0 !important; margin: 24px 0 12px 0 !important; }
      .swagger-ui .opblock { border-radius: 8px !important; margin-bottom: 12px !important; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important; border: 1px solid #E2E8F0 !important; background: #FFFFFF !important; overflow: hidden; }
      .swagger-ui .opblock .opblock-summary { padding: 10px 16px !important; }
      .swagger-ui .opblock-summary-method { border-radius: 6px !important; font-weight: 700 !important; font-size: 11px !important; padding: 4px 10px !important; min-width: 65px !important; text-shadow: none !important; letter-spacing: 0.02em; }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #0F172A !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-get { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #1E40AF !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-post { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #BE123C !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-delete { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #B45309 !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-put { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock-summary-path { font-family: 'JetBrains Mono', monospace !important; font-size: 13px !important; font-weight: 600 !important; color: #0F172A !important; }
      .swagger-ui .opblock-summary-description { font-size: 13px !important; color: #64748B !important; font-weight: 400 !important; }
      .swagger-ui .btn.execute { background: #0F172A !important; border-color: #0F172A !important; color: #FFFFFF !important; border-radius: 6px !important; font-weight: 600 !important; font-size: 12px !important; padding: 6px 18px !important; }
      .swagger-ui .btn.try-out__btn { border: 1px solid #CBD5E1 !important; color: #0F172A !important; border-radius: 6px !important; font-size: 12px !important; font-weight: 500 !important; background: #F8FAFC !important; }
      .swagger-ui .btn.try-out__btn:hover { background: #F1F5F9 !important; }
      .swagger-ui .btn.cancel { border: 1px solid #E2E8F0 !important; color: #64748B !important; border-radius: 6px !important; font-size: 12px !important; }
      .swagger-ui section.models { border: 1px solid #E2E8F0 !important; border-radius: 8px !important; background: #FFFFFF !important; margin: 32px 0 !important; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important; }
      .swagger-ui section.models h4 { font-weight: 700 !important; color: #0F172A !important; font-size: 16px !important; border-bottom: 1px solid #E2E8F0 !important; padding: 12px 16px !important; }
      .swagger-ui .model-box { font-family: 'JetBrains Mono', monospace !important; font-size: 12px !important; background: #F8FAFC !important; border-radius: 6px !important; padding: 14px !important; }
      .swagger-ui table.parameters { font-size: 13px !important; }
      .swagger-ui input[type=text], .swagger-ui textarea, .swagger-ui select { border: 1px solid #CBD5E1 !important; border-radius: 6px !important; font-family: 'Inter', sans-serif !important; font-size: 13px !important; }
      .swagger-ui input[type=text]:focus, .swagger-ui textarea:focus, .swagger-ui select:focus { outline: 2px solid #0F172A !important; border-color: #0F172A !important; }
      .clario-docs-footer {
        text-align: center;
        padding: 32px 24px;
        margin-top: 48px;
        border-top: 1px solid #E2E8F0;
        font-size: 12px;
        color: #64748B;
        background: #FFFFFF;
      }
    </style>
    """
    clario_header = """
    <div class="clario-header">
      <a href="http://localhost:5173" class="clario-logo-wrap clario-app-link" title="Open Clario Workspace">
        <img src="/clario.webp" alt="Clario" height="32" style="width:auto" />
        <span class="clario-badge-tag">API Docs</span>
      </a>
      <div class="clario-nav-right">
        <span class="clario-badge">v1.0.0</span>
        <a href="http://localhost:5173" class="clario-web-btn clario-app-link">&larr; Back to Clario App</a>
      </div>
    </div>
    """
    clario_footer = """
    <div class="clario-docs-footer">
      &copy; 2026 Clario &bull; Enterprise Document Intelligence Platform
    </div>
    <script>
      (function() {
        var host = window.location.hostname || 'localhost';
        var appUrl = (window.location.port === '8000') ? window.location.protocol + '//' + host + ':5173' : '/';
        document.querySelectorAll('.clario-app-link').forEach(function(el) {
          el.href = appUrl;
        });
      })();
    </script>
    """
    content = html.body.decode("utf-8")
    content = content.replace("</head>", f"{custom_css}</head>")
    content = content.replace("<body>", f"<body>{clario_header}")
    content = content.replace("</body>", f"{clario_footer}</body>")
    return HTMLResponse(content=content)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "version": "1.0.0",
        "api_docs": "/docs",
        "status": "operational"
    }
