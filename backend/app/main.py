import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.session import engine, Base, SessionLocal
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

      /* Public Header matching /home and /terms */
      .clario-header {
        background: #0F172A;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        position: sticky;
        top: 0;
        z-index: 100;
        color: #FFFFFF;
      }
      .clario-header-inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 24px;
        height: 68px;
        display: flex;
        align-items: center;
        justify-content: space-between;
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
      .clario-badge-tag {
        font-size: 11px;
        font-weight: 500;
        color: #94A3B8;
        font-family: 'JetBrains Mono', monospace;
        background: rgba(255, 255, 255, 0.08);
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .clario-nav-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .clario-nav-link {
        color: #CBD5E1;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.15s ease;
      }
      .clario-nav-link:hover {
        color: #FFFFFF;
      }
      .clario-web-btn {
        color: #FFFFFF;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        padding: 6px 14px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 6px;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .clario-web-btn:hover {
        background: rgba(255, 255, 255, 0.18);
        color: #FFFFFF;
      }

      /* Hero Banner matching /home typography & layout */
      .clario-hero-banner {
        background: #FFFFFF;
        border-bottom: 1px solid #E2E8F0;
        padding: 40px 0 32px 0;
      }
      .clario-hero-inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 24px;
      }
      .clario-hero-tag {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #64748B;
        margin-bottom: 10px;
        display: block;
      }
      .clario-hero-title {
        font-size: 32px;
        font-weight: 600;
        color: #0F172A;
        letter-spacing: -0.04em;
        margin: 0 0 8px 0;
        line-height: 1.2;
      }
      .clario-hero-desc {
        font-size: 15px;
        color: #475569;
        margin: 0 0 20px 0;
        max-width: 760px;
        line-height: 1.6;
      }
      .clario-chips-strip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }
      .clario-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 6px;
        color: #475569;
        font-family: 'JetBrains Mono', monospace;
      }
      .clario-chip-link {
        color: #0F172A;
        font-weight: 600;
        text-decoration: none;
      }
      .clario-chip-link:hover {
        text-decoration: underline;
      }
      .clario-status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #10B981;
        display: inline-block;
      }

      /* Hide default Swagger UI Topbar and Info Title (replaced by Clario Hero) */
      .swagger-ui .topbar { display: none !important; }
      .swagger-ui .info { display: none !important; }
      .swagger-ui .scheme-container {
        background: transparent !important;
        box-shadow: none !important;
        padding: 24px 0 0 0 !important;
        margin: 0 !important;
        border: none !important;
      }
      .swagger-ui .scheme-container .schemes-title {
        font-size: 12px !important;
        font-weight: 600 !important;
        color: #64748B !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
      }

      /* Swagger UI Container Layout */
      .swagger-ui {
        font-family: 'Inter', sans-serif !important;
        color: #0F172A !important;
      }
      .swagger-ui .wrapper {
        max-width: 1280px !important;
        padding: 0 24px !important;
        margin: 0 auto !important;
      }

      /* Section Tags (e.g. Health, Documents, Search) */
      .swagger-ui .opblock-tag-section {
        margin-bottom: 24px !important;
      }
      .swagger-ui .opblock-tag {
        font-size: 18px !important;
        font-weight: 600 !important;
        color: #0F172A !important;
        letter-spacing: -0.02em !important;
        border-bottom: 1px solid #E2E8F0 !important;
        padding: 20px 0 10px 0 !important;
        margin: 0 0 16px 0 !important;
      }
      .swagger-ui .opblock-tag small {
        font-size: 13px !important;
        color: #64748B !important;
        font-weight: 400 !important;
        margin-left: 8px !important;
      }

      /* Operation Cards */
      .swagger-ui .opblock {
        border-radius: 8px !important;
        margin-bottom: 12px !important;
        box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.04) !important;
        border: 1px solid #E2E8F0 !important;
        background: #FFFFFF !important;
        overflow: hidden !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      .swagger-ui .opblock:hover {
        border-color: #CBD5E1 !important;
        box-shadow: 0 2px 4px 0 rgba(15, 23, 42, 0.06) !important;
      }
      .swagger-ui .opblock .opblock-summary {
        padding: 12px 18px !important;
        border-color: #E2E8F0 !important;
      }

      /* Method Badges */
      .swagger-ui .opblock-summary-method {
        border-radius: 6px !important;
        font-weight: 700 !important;
        font-size: 11px !important;
        padding: 4px 10px !important;
        min-width: 65px !important;
        text-shadow: none !important;
        letter-spacing: 0.03em !important;
        font-family: 'JetBrains Mono', monospace !important;
      }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #0F172A !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-get { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #1D4ED8 !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-post { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-delete .opblock-summary-method { background: #E11D48 !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-delete { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #D97706 !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-put { border-color: #E2E8F0 !important; background: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-patch .opblock-summary-method { background: #7E22CE !important; color: #FFFFFF !important; }
      .swagger-ui .opblock.opblock-patch { border-color: #E2E8F0 !important; background: #FFFFFF !important; }

      .swagger-ui .opblock-summary-path {
        font-family: 'JetBrains Mono', monospace !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        color: #0F172A !important;
      }
      .swagger-ui .opblock-summary-description {
        font-size: 13px !important;
        color: #475569 !important;
        font-weight: 400 !important;
      }

      /* Expanded Operation Interior */
      .swagger-ui .opblock-body {
        background: #FFFFFF !important;
        border-top: 1px solid #E2E8F0 !important;
      }
      .swagger-ui .opblock-section-header {
        background: #F8FAFC !important;
        border-bottom: 1px solid #E2E8F0 !important;
        box-shadow: none !important;
        padding: 8px 18px !important;
      }
      .swagger-ui .opblock-section-header h4 {
        font-size: 12px !important;
        font-weight: 600 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        color: #475569 !important;
      }

      /* BUTTON POLISH: Consistent Clario Button System */
      .swagger-ui .btn {
        border-radius: 6px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        transition: all 0.15s ease !important;
        cursor: pointer !important;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04) !important;
      }
      .swagger-ui .btn.try-out__btn {
        border: 1px solid #CBD5E1 !important;
        color: #0F172A !important;
        background: #FFFFFF !important;
        padding: 6px 14px !important;
        font-weight: 500 !important;
      }
      .swagger-ui .btn.try-out__btn:hover {
        background: #F1F5F9 !important;
        border-color: #94A3B8 !important;
      }
      /* Prevent giant 100% width execute button; style as primary Clario navy button */
      .swagger-ui .btn.execute {
        display: inline-flex !important;
        width: auto !important;
        min-width: 140px !important;
        background: #0F172A !important;
        border: 1px solid #0F172A !important;
        color: #FFFFFF !important;
        font-weight: 600 !important;
        font-size: 13px !important;
        padding: 8px 24px !important;
        text-align: center !important;
        justify-content: center !important;
        margin: 12px 0 !important;
      }
      .swagger-ui .btn.execute:hover {
        background: #1E293B !important;
        border-color: #1E293B !important;
      }
      .swagger-ui .btn.cancel {
        display: inline-flex !important;
        width: auto !important;
        border: 1px solid #E2E8F0 !important;
        background: #FFFFFF !important;
        color: #64748B !important;
        padding: 8px 18px !important;
        margin-left: 8px !important;
        font-weight: 500 !important;
      }
      .swagger-ui .btn.cancel:hover {
        background: #F8FAFC !important;
        color: #0F172A !important;
        border-color: #CBD5E1 !important;
      }
      .swagger-ui .btn-clear {
        border: 1px solid #E2E8F0 !important;
        background: #FFFFFF !important;
        color: #64748B !important;
        padding: 6px 14px !important;
      }
      .swagger-ui .btn-clear:hover {
        background: #F8FAFC !important;
        color: #0F172A !important;
      }
      .swagger-ui .btn.authorize {
        background: #0F172A !important;
        border-color: #0F172A !important;
        color: #FFFFFF !important;
        padding: 6px 16px !important;
        font-weight: 600 !important;
      }
      .swagger-ui .btn.authorize:hover {
        background: #1E293B !important;
      }
      .swagger-ui .copy-to-clipboard {
        border-radius: 6px !important;
        border: 1px solid #E2E8F0 !important;
        background: #FFFFFF !important;
      }

      /* Form Inputs, Textarea, Select */
      .swagger-ui input[type=text],
      .swagger-ui textarea,
      .swagger-ui select {
        border: 1px solid #CBD5E1 !important;
        border-radius: 6px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 13px !important;
        color: #0F172A !important;
        background: #FFFFFF !important;
        padding: 8px 12px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      .swagger-ui input[type=text]:focus,
      .swagger-ui textarea:focus,
      .swagger-ui select:focus {
        outline: none !important;
        border-color: #0F172A !important;
        box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.1) !important;
      }

      /* Tables & Responses */
      .swagger-ui table.parameters {
        font-size: 13px !important;
        border-collapse: collapse !important;
      }
      .swagger-ui table.parameters th {
        font-size: 11px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        font-weight: 600 !important;
        color: #64748B !important;
        border-bottom: 1px solid #E2E8F0 !important;
        padding: 10px 12px !important;
      }
      .swagger-ui table.parameters td {
        padding: 12px !important;
        border-bottom: 1px solid #F1F5F9 !important;
      }
      .swagger-ui .response-col_status {
        font-family: 'JetBrains Mono', monospace !important;
        font-weight: 700 !important;
        font-size: 13px !important;
      }
      .swagger-ui .response-col_links {
        font-size: 12px !important;
      }
      .swagger-ui .highlight-code pre,
      .swagger-ui pre.microlight {
        background: #0F172A !important;
        color: #F8FAFC !important;
        border-radius: 8px !important;
        font-family: 'JetBrains Mono', monospace !important;
        font-size: 12px !important;
        padding: 14px 18px !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
      }

      /* Models Section */
      .swagger-ui section.models {
        border: 1px solid #E2E8F0 !important;
        border-radius: 8px !important;
        background: #FFFFFF !important;
        margin: 32px 0 48px 0 !important;
        box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04) !important;
      }
      .swagger-ui section.models h4 {
        font-weight: 600 !important;
        color: #0F172A !important;
        font-size: 16px !important;
        border-bottom: 1px solid #E2E8F0 !important;
        padding: 14px 18px !important;
      }
      .swagger-ui .model-box {
        font-family: 'JetBrains Mono', monospace !important;
        font-size: 12px !important;
        background: #F8FAFC !important;
        border-radius: 6px !important;
        padding: 16px !important;
        border: 1px solid #E2E8F0 !important;
      }

      /* Public Website Footer matching /home and /terms */
      .clario-docs-footer {
        background: #0F172A;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding: 32px 0;
        margin-top: 64px;
        color: #94A3B8;
        font-size: 12px;
      }
      .clario-footer-inner {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      @media (min-width: 768px) {
        .clario-footer-inner {
          flex-direction: row;
        }
      }
      .clario-footer-legal {
        display: flex;
        align-items: center;
        gap: 20px;
      }
      .clario-footer-legal a {
        color: #CBD5E1;
        text-decoration: none;
        transition: color 0.15s ease;
      }
      .clario-footer-legal a:hover {
        color: #FFFFFF;
      }
    </style>
    """
    clario_header = """
    <header class="clario-header">
      <div class="clario-header-inner">
        <a href="http://localhost:5173" class="clario-logo-wrap clario-app-link" title="Open Clario Workspace">
          <img src="/clario.webp" alt="Clario" height="30" style="width:auto" />
          <span class="clario-badge-tag">API Docs</span>
        </a>
        <nav class="clario-nav-right">
          <a href="http://localhost:5173/home" class="clario-nav-link clario-home-link">Home</a>
          <a href="/api/openapi.json" target="_blank" class="clario-nav-link">OpenAPI JSON</a>
          <a href="http://localhost:5173" class="clario-web-btn clario-app-link">
            <span>Workspace</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
          </a>
        </nav>
      </div>
    </header>

    <section class="clario-hero-banner">
      <div class="clario-hero-inner">
        <span class="clario-hero-tag">Document Intelligence &bull; REST API Specification</span>
        <h1 class="clario-hero-title">Clario Workspace API</h1>
        <p class="clario-hero-desc">
          Interactive developer reference for document ingestion, dense vector embeddings, hybrid semantic retrieval, side-by-side contract diffs, and autonomous clause analysis.
        </p>
        <div class="clario-chips-strip">
          <div class="clario-chip">
            <span class="clario-status-dot"></span>
            <span>Status: Operational</span>
          </div>
          <div class="clario-chip">
            <span>Base URL:</span>
            <span style="font-weight:600;color:#0F172A">/api</span>
          </div>
          <div class="clario-chip">
            <span>Spec:</span>
            <span style="font-weight:600;color:#0F172A">OpenAPI 3.1.0</span>
          </div>
          <div class="clario-chip">
            <a href="/api/openapi.json" target="_blank" class="clario-chip-link">Download JSON Spec &darr;</a>
          </div>
        </div>
      </div>
    </section>
    """
    clario_footer = """
    <footer class="clario-docs-footer">
      <div class="clario-footer-inner">
        <div style="display:flex;align-items:center;">
          <a href="http://localhost:5173/home" class="clario-home-link">
            <img src="/clario.webp" alt="Clario" height="26" style="width:auto" />
          </a>
        </div>
        <div>
          &copy; 2026 Clario &bull; All rights reserved.
        </div>
        <nav class="clario-footer-legal">
          <a href="http://localhost:5173/terms" class="clario-terms-link">Terms</a>
          <a href="http://localhost:5173/privacy" class="clario-privacy-link">Privacy</a>
          <a href="http://localhost:5173/cookies" class="clario-cookies-link">Cookies</a>
          <a href="http://localhost:5173" class="clario-app-link">Workspace</a>
        </nav>
      </div>
    </footer>
    <script>
      (function() {
        var host = window.location.hostname || 'localhost';
        var appBase = (window.location.port === '8000') ? window.location.protocol + '//' + host + ':5173' : '';
        document.querySelectorAll('.clario-app-link').forEach(function(el) {
          el.href = appBase || '/';
        });
        document.querySelectorAll('.clario-home-link').forEach(function(el) {
          el.href = appBase ? appBase + '/home' : '/home';
        });
        document.querySelectorAll('.clario-terms-link').forEach(function(el) {
          el.href = appBase ? appBase + '/terms' : '/terms';
        });
        document.querySelectorAll('.clario-privacy-link').forEach(function(el) {
          el.href = appBase ? appBase + '/privacy' : '/privacy';
        });
        document.querySelectorAll('.clario-cookies-link').forEach(function(el) {
          el.href = appBase ? appBase + '/cookies' : '/cookies';
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
