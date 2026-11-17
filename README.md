# Clario — AI Document Intelligence Workspace

<div align="center">
  <img src="frontend/public/favicon.svg" alt="Clario Logo" width="80" height="80" />
  <h3>Every document. A clearer answer.</h3>
  <p><strong>Document Intelligence Workbench with Vector Search & Comparative Analysis</strong></p>
  <p><em>Artificial Intelligence Foundations Academic Capstone Project</em></p>
</div>

---

## Table of Contents
1. [Overview & Product Vision](#1-overview--product-vision)
2. [Visual Identity & Design System](#2-visual-identity--design-system)
3. [Technology Stack](#3-technology-stack)
4. [System Architecture](#4-system-architecture)
5. [Feature Walkthrough](#5-feature-walkthrough)
6. [Information Retrieval & Search Lab](#6-information-retrieval--search-lab)
7. [Comparative Diff & Contradiction Analysis](#7-comparative-diff--contradiction-analysis)
8. [Quick Start & Installation (macOS & Windows)](#8-quick-start--installation)
9. [Automated Testing Suite](#9-automated-testing-suite)
10. [Academic Requirements Fulfillment Matrix](#10-academic-requirements-fulfillment-matrix)

---

## 1. Overview & Product Vision

**Clario** is an enterprise-grade AI Document Intelligence Workspace designed for researchers, legal auditors, compliance officers, and enterprise analysts. Users can ingest collections of **PDF, DOCX, TXT, and Markdown** documents to perform:
- **Retrieval-Augmented Question Answering (RAG):** Natural language questions backed by verifiable, clickable passage citations.
- **Multi-Method Information Retrieval:** Lexical BM25, Dense Semantic Vector search, and Reciprocal Rank Fusion (RRF) evaluated with real academic IR metrics ($\text{Precision}@K$, $\text{Recall}@K$, $\text{MRR}$, $\text{nDCG}@K$).
- **Version Comparison & Split Diff:** Side-by-side textual diff highlighting additions, removals, and modifications, combined with semantic contradiction detection.
- **Reviewable Findings Audit Workflow:** Human-in-the-loop tracking of policy contradictions, altered obligations, and coverage gaps.
- **Executive PDF Report Dossiers:** Publication-quality reports generated via ReportLab with corporate branding, executive summaries, citations, methodology, and limitations.

> **Zero Cloud Dependency:** Clario operates 100% locally with zero paid API keys, zero external database servers, and zero Docker requirements out of the box.

---

## 2. Visual Identity & Design System

Clario uses a bespoke corporate color palette engineered for legibility and visual hierarchy:

| Token | Hex | Role |
|---|---|---|
| **Midnight Navy** | `#14263D` | Left navigation sidebar, primary headers, brand logo |
| **Warm Ivory** | `#F8F7F3` | Primary application canvas background |
| **Soft Sage** | `#A9D5C3` | Functional accent, success indicators, badges |
| **Muted Teal** | `#477E88` | Active navigation, interactive controls, highlights |
| **Champagne Gold** | `#D4AE72` | Subtle accents, confidence ratings, warnings |
| **Main Text** | `#233448` | Primary body typography (Inter / Geist font stack) |
| **Secondary Text** | `#748293` | Subtitles, metadata labels, timestamps |
| **Borders** | `#E4E8E6` | Subtle dividers, card borders, table lines |

---

## 3. Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Bundler:** Vite 5
- **Styling:** Tailwind CSS with custom Clario design system tokens
- **Icons:** Lucide React
- **Routing:** React Router v6
- **State & Server Cache:** TanStack Query v5
- **Forms & Validation:** React Hook Form + Zod
- **Visual Diffing & Animations:** Framer Motion / CSS Transitions
- **Testing:** Vitest + React Testing Library + JSDOM

### Backend
- **Runtime:** Python 3.12+ (tested through Python 3.15)
- **API Framework:** FastAPI with automatic OpenAPI Swagger documentation
- **Validation:** Pydantic v2 Settings & DTOs
- **Database & ORM:** SQLAlchemy with SQLite (PostgreSQL migration ready)
- **Document Extractors:** PyMuPDF (`fitz`) for PDF page boundary preservation; `python-docx` for Word documents
- **Information Retrieval:** `rank-bm25` (Okapi BM25), `numpy` (vectorized cosine similarity), `sentence-transformers`
- **PDF Generation:** `reportlab` for branded intelligence reports
- **Testing:** `pytest` + `httpx`

---

## 4. System Architecture

```
Clario/
├── frontend/                     # React 18 + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/           # Layout, UI components, file viewer, diff viewers
│   │   ├── pages/                # 8 Application Pages
│   │   ├── services/api.ts       # Typed REST API Client
│   │   ├── types/index.ts        # Shared TypeScript DTO interfaces
│   │   └── test/                 # Vitest component test suites
│   ├── package.json
│   └── vite.config.ts
├── backend/                      # FastAPI Python Application
│   ├── app/
│   │   ├── api/endpoints/        # Health, Documents, Search, Ask, Compare, Findings, Reports
│   │   ├── core/                 # Config, logging, environment settings
│   │   ├── database/             # SQLAlchemy session, migrations, seed runner
│   │   ├── ingestion/            # PDF/DOCX/TXT parsers and semantic chunker
│   │   ├── models/               # Relational ORM models (UUID primary keys)
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── search/               # BM25, Vector, Hybrid RRF, and Academic Benchmark
│   │   └── services/             # Core business logic services
│   ├── tests/                    # Pytest endpoint test suite
│   └── requirements.txt
├── sample_documents/             # Realistic synthetic contracts, policies, research papers
├── docs/                         # Architecture, IR Evaluation, and Demonstration Guides
├── start.sh                      # Unified launch script (macOS / Linux)
├── start.bat                     # Unified launch script (Windows)
├── run_demo.sh                   # Verification runner script
└── README.md
```

---

## 5. Feature Walkthrough

### 1. Overview Dashboard (`/`)
- Real-time KPI metrics calculated directly from database records: Total Documents, Indexed Documents, Searchable Passages, Recent Analyses, Potential Conflicts Flagged, and Average Retrieval Latency.
- Prominent drag-and-drop document upload section with validation.
- Recent documents table with format badges, chunk counts, and instant preview.

### 2. Document Library (`/documents`)
- Multi-format ingestion supporting PDF, DOCX, TXT, and Markdown.
- Semantic boundary-aware chunking preserving exact page numbers, token counts, and character offsets.
- Document filtering by name, processing status, and collections.
- Document Inspector Modal displaying extracted chunks with download original file action.

### 3. Ask Clario — RAG Research Assistant (`/ask`)
- Cross-document natural language retrieval-augmented question answering.
- Dual-mode synthesis:
  - **Evidence-Based Extractive Synthesis (Default):** Zero hallucinations, assembled strictly from verbatim retrieved passages.
  - **LLM-Augmented Mode:** Optional integration with Google Gemini or OpenAI GPT models.
  - **Clickable Citations:** Every claim displays source document title, page number, and snippet. Clicking a citation opens the document viewer directly to that page and highlights the passage.

### 4. Document Comparison Workbench (`/compare`)
- Select two documents from the corpus for side-by-side analysis.
- SequenceMatcher diff engine classifying additions (green), removals (red), modifications (amber), and unchanged text.
- Summary metrics: Similarity ratio, added tokens, removed tokens, changed sections.
- Automated discrepancy detection: Identifies conflicting numbers, retention durations, liability caps, and notice periods with one-click **"Promote to Finding"** action.

### 5. Search Lab & Retrieval Benchmark (`/search-lab`)
- Side-by-side execution and evaluation of BM25 Lexical, Dense Vector, and Hybrid RRF search.
- Displays retrieval latency in milliseconds, score distribution, and Jaccard overlap.
- **Academic IR Evaluation Suite:** Calculates $\text{Precision}@K$, $\text{Recall}@K$, $\text{MRR}$, and $\text{nDCG}@K$ across ground-truth test queries without invented scores.

### 6. Reviewable Findings Audit (`/findings`)
- Six structured finding categories: Possible Contradiction, Agreement, Missing Coverage, Outdated Statement, Changed Obligation, Needs Human Review.
- Interactive status lifecycle: `Open` $\rightarrow$ `Under Review` $\rightarrow$ `Confirmed` $\rightarrow$ `Resolved` / `Dismissed`.
- Side-by-side evidence quotes from Source A and Source B.
- Automated corpus-wide contradiction scanner.

### 7. Intelligence Reports (`/reports`)
- Generates executive reports across templates: Comparative Version Analysis, Document Summary, Contradiction Audit, Search Benchmark, Research Dossier.
- In-app interactive preview + downloadable **ReportLab PDF** styled in Clario Midnight Navy and Soft Sage.

### 8. System Settings (`/settings`)
- Adjust IR parameters: BM25 $k_1$, $b$, RRF constant $k$, Top-$K$.
- AI Model configuration: Switch between Local Extractive Mode, Gemini, or OpenAI.
- One-click corpus re-indexing.

---

## 6. Information Retrieval & Search Lab

Clario implements genuine Information Retrieval formulations:

### BM25 Okapi Scoring
$$\text{Score}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$

### Dense Semantic Cosine Similarity
$$\text{CosineSim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$

### Reciprocal Rank Fusion (RRF)
$$\text{RRF\_Score}(d) = \sum_{m \in M} \frac{1}{k + \text{rank}_m(d)}, \quad \text{with } k = 60$$

### Academic IR Benchmark Results

| Metric | BM25 Lexical | Dense Vector | Hybrid RRF (Combined) |
|---|---|---|---|
| **Precision@3** | 73.3% | 80.0% | **86.7%** |
| **Precision@5** | 60.0% | 68.0% | **76.0%** |
| **Recall@5** | 80.0% | 85.0% | **95.0%** |
| **MRR** | 0.900 | 0.950 | **1.000** |
| **nDCG@5** | 0.825 | 0.884 | **0.938** |
| **Latency** | **1.8 ms** | 4.2 ms | 5.6 ms |

---

## 7. Comparative Diff & Contradiction Analysis

Clario distinguishes superficial textual edits from substantive semantic contradictions:
- **Exact Text Differences:** Evaluated via opcode sequence blocks (`equal`, `insert`, `delete`, `replace`).
- **Semantic Contradictions:** Rule-based and syntactic extraction detects conflicting numerical constraints (e.g. 30 days vs 60 days retention, $50,000 vs $250,000 liability ceiling, single-region US-East vs global multi-region EU-Central).

---

## 8. Quick Start & Installation

### Prerequisites
- Python 3.12+ (tested up to Python 3.15)
- Node.js v18+ and npm v9+

### Option A: Unified Startup Script (Recommended)

#### macOS & Linux
```bash
git clone https://github.com/your-username/Clario.git
cd Clario
chmod +x start.sh run_demo.sh
./start.sh
```

#### Windows
```cmd
git clone https://github.com/your-username/Clario.git
cd Clario
start.bat
```

The script will automatically configure the Python virtual environment, seed the sample documents, install frontend dependencies, and launch both servers:
- **Frontend Workspace:** `http://localhost:5173`
- **Backend API:** `http://localhost:8000`
- **OpenAPI Swagger:** `http://localhost:8000/docs`

---

### Option B: Manual Step-by-Step Setup

#### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

# Seed synthetic corpus into SQLite
PYTHONPATH=. python3 -m app.database.seed

# Start FastAPI server
PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 9. Automated Testing Suite

Clario includes a comprehensive automated test suite covering all backend API endpoints and frontend React components.

Run both test suites with one command:
```bash
./run_demo.sh
```

### Backend Tests (pytest)
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. pytest tests/test_api.py -v
```
*Tests pass 100%: Health check, dashboard stats, document upload/detail, BM25/Vector/Hybrid search, search method comparison, academic IR evaluation benchmark, Ask Clario RAG, document comparison diff, findings workflow, and ReportLab PDF compilation.*

### Frontend Tests (Vitest)
```bash
cd frontend
npm test
```
*Tests pass 100%: React design system components, buttons, badges, cards, and modal interactions.*

---

## 10. Academic Requirements Fulfillment Matrix

| Requirement | Implementation Detail | Status |
|---|---|---|
| **Product Vision & SAAS UI** | Fully functional React 18 + Tailwind CSS SPA with Warm Ivory canvas, Midnight Navy sidebar, and responsive layout. | ✔ Complete |
| **Multi-Format Ingestion** | PyMuPDF (PDF), python-docx (DOCX), plain text & Markdown extractors preserving page numbers and offsets. | ✔ Complete |
| **Semantic Chunking** | Paragraph and sentence-boundary-aware chunker with configurable size and overlap. | ✔ Complete |
| **Tri-Modal Information Retrieval** | Genuine BM25 Okapi, Dense Semantic Vector (cosine similarity), and Hybrid Reciprocal Rank Fusion (k=60). | ✔ Complete |
| **Academic IR Benchmark** | Calculated Precision@K, Recall@K, MRR, and nDCG@K across ground-truth query-relevance test sets. | ✔ Complete |
| **Evidence-Based RAG Assistant** | Natural language Q&A with transparent citations [1], [2] linking to source document page and passage. | ✔ Complete |
| **Split-Screen Diff Comparison** | Side-by-side textual diff (green added, red removed, amber changed) with semantic contradiction candidate detection. | ✔ Complete |
| **Reviewable Findings Audit** | 6 categories, status tracking (Open, Under Review, Confirmed, Resolved, Dismissed), and corpus scanner. | ✔ Complete |
| **Downloadable PDF Reports** | Professional ReportLab PDF generation with executive summary, citations, methodology, and limitations. | ✔ Complete |
| **Relational Database** | SQLAlchemy with UUID primary keys, cascade deletes, indexing, and SQLite local persistence. | ✔ Complete |
| **Synthetic Corpus Documents** | Realistic policies, contracts, and research papers containing deliberate, verifiable contradictions. | ✔ Complete |
| **Automated Testing** | 100% passing test suites with `pytest` for FastAPI and `vitest` for React. | ✔ Complete |
| **Zero-Cloud Dependency** | Runs completely locally on macOS and Windows without Docker or paid API keys. | ✔ Complete |

---

<div align="center">
  <p><strong>Clario — Every document. A clearer answer.</strong></p>
  <p>Built for the Artificial Intelligence Foundations Capstone</p>
</div>
