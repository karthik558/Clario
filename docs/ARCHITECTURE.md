# Clario — System Architecture & Technical Specifications

**Product Name:** Clario  
**Tagline:** *Every document. A clearer answer.*  
**Project Category:** AI Document Intelligence Workspace  
**Academic Module:** Document Intelligence Workbench with Vector Search & Comparative Analysis  

---

## 1. High-Level Architectural Overview

Clario is an enterprise-grade document intelligence platform combining lexical indexing, dense semantic vector retrieval, and automated comparative difference analysis. The system is designed to run 100% locally without external cloud dependencies or paid APIs, while supporting seamless scaling to PostgreSQL, Qdrant, and external LLM models (Google Gemini, OpenAI).

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            REACT 18 FRONTEND                             │
│       Vite + TypeScript + Tailwind CSS + Lucide + TanStack Query        │
│                                                                          │
│  [Overview]  [Documents]  [Ask Clario]  [Compare]  [Search Lab]  ...    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │ JSON REST API / Fast HTTP
┌────────────────────────────────────▼─────────────────────────────────────┐
│                            FASTAPI BACKEND                               │
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────────┐  ┌───────────────────┐ │
│  │ Ingestion Pipeline│  │ Information Retrieval │  │ Comparative Engine│ │
│  │  - PyMuPDF (PDF)  │  │  - BM25 Okapi Lexical │  │  - SequenceMatcher│ │
│  │  - python-docx    │  │  - Dense Embeddings   │  │  - Token Differ   │ │
│  │  - Boundary Chunk │  │  - RRF Fusion (k=60)  │  │  - Contradictions │ │
│  └─────────┬─────────┘  └───────────┬───────────┘  └─────────┬─────────┘ │
│            │                        │                        │           │
│  ┌─────────▼────────────────────────▼────────────────────────▼─────────┐ │
│  │                     SQLAlchemy Relational ORM                       │ │
│  │               (SQLite local / PostgreSQL migration ready)            │ │
│  └──────────────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────────────┼────────────────────────────────────┘
                                      │
                     ┌────────────────┴────────────────┐
                     │ Local Storage & SQLite DB       │
                     │  - data/clario.db               │
                     │  - data/documents/ (PDF, DOCX)  │
                     │  - data/reports/ (PDF Exports)  │
                     └─────────────────────────────────┘
```

---

## 2. Document Ingestion & Chunking Pipeline

When a file is uploaded (`PDF`, `DOCX`, `TXT`, `MD`):
1. **Validation & Storage:** Validates MIME type, file extension, and non-zero byte size. Saves original document into `data/documents/<uuid>_<filename>`. Original files are never stored inside the database, adhering to enterprise document management best practices.
2. **Text & Page Boundary Extraction:**
   - **PDF:** Extracted using `PyMuPDF` (`fitz`), preserving exact page boundaries, text blocks, and character offsets.
   - **DOCX:** Extracted paragraph-by-paragraph using `python-docx`, with calibrated page mapping (~350 words per page).
   - **TXT / Markdown:** Processed with UTF-8 decoding and standard section boundary preservation.
3. **Semantic Chunking:**
   - Evaluated by `SemanticChunker` (`backend/app/ingestion/chunker.py`).
   - Boundary-aware: Splits on paragraph double-newlines or sentence terminators (`. `, `! `, `? `).
   - Target chunk size: 800 characters (~150-200 tokens) with 150-character overlap.
   - Chunks maintain persistent foreign keys to the parent `Document`, exact page numbers, start/end character offsets, and token counts.

---

## 3. Information Retrieval (IR) Multi-Engine Architecture

Clario implements three distinct information retrieval mechanisms evaluated side-by-side in the Search Lab:

### A. Lexical Keyword Retrieval (BM25)
Utilizes the Okapi BM25 ranking algorithm:
$$\text{Score}(D, Q) = \sum_{i=1}^{n} \text{IDF}(q_i) \cdot \frac{f(q_i, D) \cdot (k_1 + 1)}{f(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{\text{avgdl}}\right)}$$
- Parameters: $k_1 = 1.5$ (term frequency saturation), $b = 0.75$ (document length penalty).
- Tokenization: Lowercasing, punctuation stripping, and standard English stopword filtering.

### B. Dense Semantic Vector Search
- Generates 384-dimensional dense semantic embeddings.
- Ranks candidate document passages by Cosine Similarity on normalized L2 unit vectors:
$$\text{Sim}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2}$$
- Uses NumPy for vectorized inner product evaluation, executing in $< 5\text{ms}$ locally. Supports `sentence-transformers` models (`all-MiniLM-L6-v2`) when torch is available.

### C. Hybrid Reciprocal Rank Fusion (RRF)
Combines lexical and vector rankings using the formula:
$$\text{RRF\_Score}(d) = \sum_{m \in \{\text{BM25}, \text{Vector}\}} \frac{1}{k + \text{rank}_m(d)}$$
- Where $k = 60$ is the standard IR smoothing factor preventing high-ranking single outlier dominance.
- Normalized to $[0, 1]$ and sorted descending.

---

## 4. Evidence-Based Research Assistant & RAG Engine

Section 7 mandates verifiable question answering with transparent attribution:
1. **Passage Retrieval:** User queries undergo hybrid search to retrieve the top $K$ most relevant document chunks across selected workspace scopes.
2. **Dual-Mode Synthesis:**
   - **Extractive Local Synthesis (Default):** Extracts declarative sentences from top retrieved passages, organizes findings by document source, and appends explicit bracketed citations `[1]`, `[2]`. Guarantees zero hallucinations and operates completely without external API keys.
   - **LLM-Augmented Mode (Optional):** When user configures Gemini or OpenAI API keys in Settings, retrieved passages are supplied as grounding context to generate a structured synthesis citing source passages.
3. **Interactive Citation Linking:** Every claim citation displays Document Title, Page Number, and Snippet. Clicking any citation opens the `DocumentViewerModal`, auto-scrolling to and highlighting the exact cited chunk!

---

## 5. Comparative Difference & Contradiction Detection

Section 8 requires side-by-side document comparison:
1. **Sequence Matching:** Employs Python's `difflib.SequenceMatcher` to compute the Ratcliff-Obershelp similarity ratio and generates opcode segments:
   - `insert`: Added segments (highlighted in soft green)
   - `delete`: Removed segments (highlighted in soft red)
   - `replace`: Modified passages (highlighted in champagne amber)
   - `equal`: Unchanged passages (neutral styling)
2. **Semantic Contradiction Heuristics:**
   - Compares corresponding sections across document versions.
   - Scans for divergence in numeric retention durations, liability monetary caps, cure notice periods, and privacy parameters.
   - Packages detected discrepancies as `ContradictionCandidate` items with quotes from Document A and Document B.
   - Reviewers can click **"Promote to Finding"** to save candidates directly into the reviewable findings database.

---

## 6. Relational Database Schema

All primary entities are modeled with UUID primary keys and ISO-8601 timestamps:

| Model | Table | Description |
|---|---|---|
| `Document` | `documents` | Metadata, file size, page count, chunk count, status, tags, collection |
| `DocumentChunk` | `document_chunks` | Chunk text, page number, character offsets, token count, embedding vector |
| `IngestionJob` | `ingestion_jobs` | Tracking of extraction, chunking, and indexing states |
| `SearchQuery` | `search_queries` | Query text, mode, top-K, execution latency, serialized results |
| `Comparison` | `comparisons` | Doc A & B IDs, similarity score, token counts, diff blocks, contradictions |
| `Finding` | `findings` | Category, title, description, severity, status, dual evidence quotes, notes |
| `Report` | `reports` | Report type, executive summary, content JSON, ReportLab PDF path |
| `Workspace` | `workspaces` | Workspace name, slug, description |
