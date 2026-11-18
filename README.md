# Clario — Enterprise Document Intelligence & Policy Analysis Workspace

> **Every document. A clearer answer.**  
> Local-first enterprise document intelligence workspace for contract comparison, clause negotiation, compliance tracking, and source-grounded policy verification.

[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18.3+-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4+-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC.svg)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 1. Overview

Clario is a local-first document intelligence platform engineered for legal auditors, procurement leads, compliance officers, and contract analysts. It enables multi-document analysis, side-by-side agreement diffing, autonomous clause redlining, and compliance matrix verification across PDF, DOCX, TXT, Excel, and Markdown files.

### Key Capabilities
- **Source-Grounded Question Answering:** Query documents with verbatim, bracketed citations (`[1]`, `[2]`) that open directly to exact pages and highlighted passages in the integrated source viewer.
- **Split-Screen Version Comparison:** Detect subtle covenant shifts, numerical variance (liability caps, notice windows, fee escalations), and textual additions/deletions between draft revisions.
- **Autonomous Clause Negotiation:** Generate compromise provisions across four standard commercial stances (*Balanced*, *Customer Protective*, *Vendor Favorable*, *Strict Compliance*) and export tracked redlines directly to `.docx`.
- **Compliance Matrix & Audit Findings:** Cross-examine agreements against regulatory standards (EU AI Act, GDPR, HIPAA, SOC 2) with human-in-the-loop review statuses.
- **Obligations & Renewal Tracker:** Extract notice deadlines, renewal windows, and service commitments, with one-click export to standard calendar events (`.ics`).
- **Complete Local Privacy:** Operates entirely on your infrastructure with local SQLite storage, vector embeddings, and optional local LLM runtime (Ollama, LM Studio, vLLM). No confidential client documents leave your system.

---

## 2. Quick Start

Clario provides automated environment initializers for macOS, Linux, and Windows. The setup script validates Python and Node.js environments, sets up dependencies, initializes the local database, and prepares sample policy documents.

### Setup

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

#### Windows
```cmd
git clone https://github.com/karthik558/Clario.git
cd Clario
initialize\init_windows.bat
```

---

### Launching the Application

Start both the backend API and frontend workspace with a single command:

- **macOS / Linux:**
  ```bash
  ./start.sh
  ```
- **Windows:**
  ```cmd
  start.bat
  ```

Once running, access the services:
- **Frontend Workspace:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 3. Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Tooling:** Vite 5
- **Styling:** Tailwind CSS with enterprise palette (Deep Navy `#0F172A`, Slate `#334155`, Ivory `#F8FAFC`)
- **Icons:** Lucide React
- **State & Caching:** TanStack Query v5 + React Router v6
- **Testing:** Vitest + React Testing Library

### Backend
- **Framework:** FastAPI with Python 3.12+
- **Database:** SQLAlchemy ORM with SQLite (automatic creation and migration)
- **Parsers:** PyMuPDF (`fitz`) for PDF page boundary preservation, `python-docx` for Word files, `openpyxl` for Excel spreadsheets, and Markdown parsers
- **Search & Retrieval:** Okapi BM25, Sentence Transformers embeddings, and Reciprocal Rank Fusion (RRF)
- **Document Generation:** ReportLab (PDF dossiers), `python-docx` (Word redlines)
- **Testing:** pytest + httpx

---

## 4. Local Model Integration (Optional)

Clario runs in two generation modes:
1. **Extractive Synthesis (Default):** Zero-latency factual extraction that pulls verified text and citations directly from indexed documents without external dependencies.
2. **Local AI Model (Ollama / LM Studio):** Connect a local model for conversational synthesis and automated drafting.

### Connecting Ollama
1. Install and start Ollama:
   ```bash
   ollama pull gemma3:latest
   ```
2. In Clario, navigate to **Settings** (`/settings`) or toggle **Answer Settings** in **Ask Clario** to select your active local model.

---

## 5. Manual Setup & Testing

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate.bat
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --port 8000 --reload
```

Run backend tests:
```bash
PYTHONPATH=backend backend/venv/bin/pytest backend/tests
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Run frontend tests:
```bash
npm test -- --run
```

Build production bundle:
```bash
npm run build
```

---

## 6. License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.
