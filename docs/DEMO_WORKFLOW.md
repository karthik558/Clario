# Clario — Academic Project Demonstration Workflow

Follow this step-by-step walkthrough to demonstrate every assigned requirement of the Clario Document Intelligence Workbench.

---

## Preparation & Quick Start

Ensure Clario is running:
```bash
./start.sh
```
Open your browser at **`http://localhost:5173`**.

---

## Step 1: Overview Dashboard (`/`)

1. **Review Corpus Metrics:**
   - Observe the 6 real-time metrics cards: Total Documents (6), Indexed Ready (6), Passages Indexed (22), Analyses Run, Potential Conflicts Flagged (1+), and Average Latency (~10-15ms).
2. **Inspect Seed Documents Table:**
   - Verify that 6 synthetic documents spanning policies, contracts, and research literature are loaded.
   - Click the eye icon next to any document to view its extracted chunks, page numbers, and token counts in the `DocumentViewerModal`.
3. **Test Quick Actions:**
   - Click the **"Ask a Question"** or **"Compare Documents"** shortcuts to verify fluid routing.

---

## Step 2: Document Library (`/documents`)

1. **Search & Filter:**
   - Type `"Retention"` in the search input to filter documents in real time.
   - Filter by collection (e.g. `"Policy"`, `"Contracts"`, `"Research"`).
2. **Upload Test:**
   - Click **"Upload Documents"**.
   - Drag or select any `.txt`, `.md`, `.docx`, or `.pdf` file.
   - Enter tags and click **"Upload & Ingest"**.
   - Observe immediate extraction, chunking, and embedding generation into the live index.
3. **Inspect Original File:**
   - Click the download icon on any document card to download the exact binary/text file from local disk.

---

## Step 3: Ask Clario — RAG Research Assistant (`/ask`)

1. **Test Starter Question:**
   - Click preset query: *"What are the main differences between Data Retention v1 and v2?"*
2. **Observe Synthesis & Contradiction Alert:**
   - Clario identifies that v1 specifies **30 days post-termination retention** and **US-East storage**, whereas v2 specifies **60 days** and **multi-region EU-Central**.
   - Note the yellow warning box: *"Divergent Terms Detected Across Sources"*.
3. **Verify Clickable Provenance:**
   - Click Citation `[1]` or `[2]`.
   - The `DocumentViewerModal` opens directly to the source document, page, and highlights the cited chunk!
4. **Test Legal Liability Question:**
   - Ask: *"What limitation of liability caps appear in the service agreements?"*
   - Observe evidence contrasting the **$50,000 cap** in the 2023 agreement against the **$250,000 / 12-month cap** in the 2024 revised agreement.

---

## Step 4: Document Comparison Workbench (`/compare`)

1. **Select Document Pair:**
   - Set Document A to: `OpenAI Policy 2023`
   - Set Document B to: `OpenAI Policy 2023 2024 Report`
   - Click **"Compare"**.
2. **Review Metrics Ribbon:**
   - Observe real similarity ratio, modified sections count, and topic coverage.
3. **Review Contradiction Candidates:**
   - Notice the flagged candidates: *"Data Retention & Deletion Timeline"* (30 days vs 60 days) and *"Liability & Financial Ceilings"* ($100 vs $250,000).
   - Read the side-by-side evidence quotes comparing the clauses.
   - Click **"Promote to Finding"** to save it as a reviewable audit item.
4. **Inspect Split-Screen Diff:**
   - Scroll through Document A (left) and Document B (right).
   - Verify green highlights for added lines, red highlights for removed lines, and amber highlights for modified clauses.

---

## Step 5: Search Lab & IR Benchmark (`/search-lab`)

1. **Live Method Comparison:**
   - Query: `customer data deletion days after contract termination`
   - Click **"Evaluate Retrieval"**.
   - Compare results across all three engines side-by-side:
     - **Column A:** Lexical BM25 (Okapi k1=1.5, b=0.75)
     - **Column B:** Dense Semantic Vector (Cosine similarity)
     - **Column C:** Hybrid Reciprocal Rank Fusion (RRF k=60)
   - Inspect the latency metrics and Jaccard overlap percentage.
2. **Academic IR Evaluation Suite:**
   - Click the **"Academic IR Evaluation Suite"** tab.
   - Click **"Run Benchmark Suite"**.
   - Review genuine calculated metrics: $\text{Precision}@3$, $\text{Precision}@5$, $\text{Recall}@5$, $\text{MRR}$, and $\text{nDCG}@5$ across test queries.

---

## Step 6: Reviewable Findings (`/findings`)

1. **Review Audit Items:**
   - Observe the findings list generated automatically or promoted during comparison.
2. **Reviewer Workflow:**
   - Change finding status from `Open` to `Under Review` or `Confirmed`.
   - Click `(Edit)` next to Notes and enter human evaluation notes (e.g. *"Confirmed by legal counsel on audit call."*).
3. **Corpus Scan:**
   - Click **"Run Contradiction Scan"** to perform automated pairwise combinatorial analysis across all indexed documents.

---

## Step 7: Intelligence Reports (`/reports`)

1. **Generate Official Report:**
   - Click **"Generate New Report"**.
   - Select template: `Comparative Version Analysis` or `Contradiction & Compliance Findings`.
   - Select documents and click **"Compile Report & PDF"**.
2. **Download PDF Report:**
   - Click **"Download ReportLab PDF"**.
   - Open the generated PDF: notice the executive summary, evidence quotes, methodology, and Clario corporate branding (Midnight Navy, Soft Sage, Champagne Gold).

---

## Step 8: System Settings (`/settings`)

1. **IR Algorithm Parameters:**
   - Adjust BM25 $k_1$, $b$, and RRF $k$ values.
2. **Model Engine:**
   - Switch between Extractive Zero-Cost mode, Google Gemini, or OpenAI.
3. **Reindex Corpus:**
   - Click **"Reindex All Chunks"** to trigger a full index refresh.
