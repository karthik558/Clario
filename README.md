# Clario — AI Document Intelligence Workspace

> **Every document. A clearer answer.**  
> Production-grade AI Document Intelligence Workbench with Dense Vector Search, Hybrid RRF, Document Version Comparison, and Retrieval-Augmented Generation (RAG).

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC.svg)](https://tailwindcss.com/)
[![Ollama Supported](https://img.shields.io/badge/Ollama-Offline--First-black.svg)](https://ollama.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Keywords & Topics
`ai-document-intelligence` `vector-search` `retrieval-augmented-generation` `rag` `document-comparison` `semantic-search` `hybrid-search` `bm25` `reciprocal-rank-fusion` `ollama` `fastapi` `react-typescript` `pdf-intelligence` `contract-analysis` `policy-audit`

---

## 1. Quick Start & Initialization

Clario includes automated cross-platform initialization scripts in the `initialize/` directory. The initialization script automatically detects your environment, verifies or installs missing dependencies (Python, Node.js, Ollama), sets up the Python virtual environment, seeds the SQLite database with multi-page policy notes, and installs frontend dependencies.

### One-Command Setup

#### macOS
```bash
git clone https://github.com/karthik558/Clario.git
cd Clario
bash initialize/init_mac.sh
```

#### Linux (Ubuntu / Debian / Fedora / Arch)
```bash
git clone https://github.com/karthik558/Clario.git
cd Clario
bash initialize/init_linux.sh
```

#### Windows (Command Prompt / PowerShell)
```cmd
git clone https://github.com/karthik558/Clario.git
cd Clario
initialize\init_windows.bat
```

#### Universal Detection Script (macOS / Linux / WSL)
```bash
bash initialize/setup.sh
```

---

### Launching Clario

After initialization, launch both the FastAPI backend and React frontend with a single command:

- **macOS / Linux:**
  ```bash
  ./start.sh
  ```
- **Windows:**
  ```cmd
  start.bat
  ```

Access the application in your browser:
- **Frontend Workspace:** [http://localhost:5173](http://localhost:5173)
- **Backend REST API:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 2. What is Clario?

Clario is a local-first AI Document Intelligence Workspace designed for legal auditors, compliance officers, researchers, and technical analysts. It solves the problem of analyzing, comparing, and cross-referencing collections of PDF, DOCX, TXT, and Markdown files with zero hallucination.

### Key Capabilities
- **Verified Question Answering (RAG):** Ask natural language questions across documents. Every factual statement is attributed to exact page-level citations that open directly in the integrated source viewer.
- **Split-Screen Version Comparison:** Compare two document versions side-by-side with word-level additions, removals, and modifications, plus automated semantic contradiction detection (e.g., changes in liability caps, retention periods, notice timelines).
- **Tri-Modal Information Retrieval:** Benchmark Okapi BM25 keyword matching, Dense Vector semantic search (cosine similarity), and Hybrid Reciprocal Rank Fusion (RRF, $k=60$) against academic IR metrics (Precision@K, Recall@K, MRR, nDCG@K).
- **Reviewable Findings Audit Workflow:** Track detected policy contradictions and compliance gaps with human-in-the-loop status transitions (Flagged, Confirmed, Resolved, Dismissed).
- **Downloadable PDF Intelligence Reports:** Compile publication-quality dossiers using ReportLab with executive summaries, citations, methodology, and limitations.
- **Interactive Database Explorer:** Inspect raw SQLite tables, chunk embeddings, and audit logs directly from the UI.
- **Offline Privacy:** Runs 100% locally with local SQLite, fast vector embeddings, and local Ollama neural models. No external APIs or paid services required.

---

## 3. Technology Stack

### Frontend Architecture
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 5
- **Styling:** Tailwind CSS with enterprise color tokens (Warm Ivory `#F8F7F3`, Midnight Navy `#14263D`, Soft Sage `#A9D5C3`, Muted Teal `#477E88`)
- **Iconography:** Lucide React (monochrome neutral palette)
- **Routing:** React Router v6
- **Server Cache:** TanStack Query v5
- **Forms & Validation:** React Hook Form + Zod
- **Testing:** Vitest + React Testing Library + JSDOM

### Backend Architecture
- **Runtime:** Python 3.12+ (tested up to Python 3.15)
- **API Framework:** FastAPI with auto-generated OpenAPI v3 schemas
- **Database & ORM:** SQLAlchemy with SQLite (PostgreSQL migration ready)
- **Document Parsers:** PyMuPDF (`fitz`) for PDF page boundary preservation; `python-docx` for Word documents; Markdown parser with page-break splitting (`<!-- pagebreak -->`)
- **Search & Embeddings:** `rank-bm25` (Okapi BM25), `sentence-transformers`, `numpy` (vectorized cosine similarity)
- **PDF Generation:** ReportLab
- **Testing:** pytest + httpx

---

## 4. Local Ollama Integration

Clario natively integrates with local Ollama instances for zero-cost, private offline synthesis.

### Setup Steps
1. **Install Ollama:**
   - macOS: `brew install --cask ollama` or download from [ollama.com](https://ollama.com/download)
   - Linux: `curl -fsSL https://ollama.com/install.sh | sh`
   - Windows: Download from [ollama.com/download/windows](https://ollama.com/download/windows)
2. **Start Daemon & Pull Model:**
   ```bash
   ollama serve
   ollama pull llama3.2
   # Or use any existing model, e.g. mimo-v2.6
   ```
3. **Connect in Clario:**
   - Go to **Settings** (`/settings`).
   - Confirm **Ollama Status** shows **Ollama Online**.
   - Select **Ollama - local model** as your generation engine.
   - Select your model from the dropdown (auto-detects installed models).
   - Click **Save configuration**.

### Dual Generation Engines
On the **Ask Clario** page, toggle engines instantly:
- **Ollama Local (`mimo-v2.6` / `llama3.2`):** Synthesizes answers using your local neural model with cited source numbers (`[1]`, `[2]`).
- **Extractive Synthesis (Instant):** Delivers structured document evidence and verified quotes in under 15ms with zero hardware strain.

---

## 5. Repository Structure

```
Clario/
├── backend/                      # FastAPI Python Backend
│   ├── app/
│   │   ├── api/endpoints/        # REST APIs (documents, search, ask, compare, findings, reports, settings)
│   │   ├── core/                 # Config, logging, settings
│   │   ├── database/             # SQLAlchemy session, engine, seed script
│   │   ├── ingestion/            # PDF, DOCX, TXT, Markdown parsers & semantic chunker
│   │   ├── models/               # Relational ORM models (UUID keys)
│   │   ├── schemas/              # Pydantic validation DTOs
│   │   ├── search/               # BM25, Vector, and Hybrid RRF search engines
│   │   └── services/             # Core business logic services
│   ├── requirements.txt
│   └── tests/                    # Backend pytest test suite (16 tests)
├── frontend/                     # React 18 + TypeScript Frontend
│   ├── src/
│   │   ├── components/           # UI cards, modals, layout, and document viewers
│   │   ├── pages/                # 8 Application Pages
│   │   ├── services/api.ts       # Typed REST API client
│   │   ├── types/index.ts        # TypeScript data models
│   │   └── test/                 # Frontend Vitest test suite (14 tests)
│   ├── package.json
│   └── vite.config.ts
├── initialize/                   # Automated cross-platform setup scripts
│   ├── setup.sh                  # Smart OS detection wrapper
│   ├── init_mac.sh               # macOS initialization script
│   ├── init_linux.sh             # Linux initialization script
│   └── init_windows.bat          # Windows initialization script
├── sample_documents/             # Multi-page corporate policy notes
│   ├── OpenAI_Usage_and_Privacy_Policy_2023.md      # 8 pages, baseline terms
│   └── OpenAI_Policy_2023_2024_Report.md            # 8 pages, revised terms & amendments
├── start.sh                      # Launch script for macOS & Linux
├── start.bat                     # Launch script for Windows
├── run_demo.sh                   # Comprehensive verification test runner
└── README.md
```

---

## 6. Manual Setup (Alternative)

If you prefer to configure dependencies manually without the automated scripts:

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate.bat
pip install --upgrade pip
pip install -r requirements.txt
PYTHONPATH=. python3 -m app.database.seed
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 7. Verification & Automated Testing

Run the entire verification test suite with one command:
```bash
./run_demo.sh
```

### Backend Tests (pytest)
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/ -v
```
*16/16 tests pass: Health check, dashboard metrics, document ingestion, BM25/Vector/Hybrid search, academic IR evaluation benchmark, Ask Clario synthesis, document comparison diffing, findings workflow, ReportLab PDF generation, and workspace parameter updates.*

### Frontend Tests (Vitest)
```bash
cd frontend
npm test
```
*14/14 tests pass: Routing, dialog accessibility, search shortcut triggers, document scope selection, input retry behaviors, and timezone handling.*

### Production Build
```bash
cd frontend
npm run build
```
*Compiles cleanly with zero errors in ~1.7 seconds.*

---

## 8. License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

**Clario — Every document. A clearer answer.**
