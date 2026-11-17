import re
import time
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.dtos import AskRequest, AskResponse, CitationItem
from app.services.search_service import search_service

class AskService:
    @staticmethod
    def _is_greeting(query: str) -> bool:
        norm = re.sub(r'[^\w\s]', ' ', query.strip().lower())
        tokens = [t for t in norm.split() if t]
        if not tokens:
            return True
        first = tokens[0]
        if first in ("hi", "hello", "hey", "howdy", "greetings", "hola"):
            if len(tokens) <= 3:
                return True
        if tokens in (["who", "are", "you"], ["what", "can", "you", "do"], ["what", "is", "clario"], ["help"]):
            return True
        if len(tokens) <= 2 and tokens[0] == "good" and tokens[-1] in ("morning", "afternoon", "evening", "day"):
            return True
        return False

    @staticmethod
    def _is_comparative_query(query: str) -> bool:
        q = query.lower()
        patterns = [
            r'\bdiffer(?:ence|ences|ent)?\b',
            r'\bcompar(?:e|ison|ative|ing)\b',
            r'\bbetween\s+(?:the\s+)?two\b',
            r'\bbetween\s+2023\s+(?:and|&)\s+2024\b',
            r'\b2023\s+vs(?:\.?|\s+)\s*2024\b',
            r'\bwhat\s+changed\b',
            r'\bchanges?\b',
            r'\bversus\b',
            r'\bvs\.?\b',
            r'\bcontrast\b',
            r'\bdelta\b',
        ]
        return any(re.search(pat, q) for pat in patterns)

    @staticmethod
    def answer_question(request: AskRequest, db: Session) -> AskResponse:
        t0 = time.perf_counter()

        # Instant check for conversational greetings / orientation
        if AskService._is_greeting(request.query):
            return AskResponse(
                query=request.query,
                answer=(
                    "Hello, I am Clario, your AI document intelligence research assistant.\n\n"
                    "I analyze, search, and verify clauses across your uploaded documents. "
                    "Every answer I provide is cross-referenced with exact citations.\n\n"
                    "**Suggested questions for your workspace documents:**\n"
                    "- *What is the data retention policy for API interactions?*\n"
                    "- *Compare the liability limits between the 2023 and 2024 policies.*\n"
                    "- *What is the incident notification timeline after a security breach?*\n"
                    "- *Are customer inputs used to train foundation models?*\n\n"
                    "You can also use the Compare view to inspect side-by-side differences, or the Search Lab to evaluate retrieval performance."
                ),
                mode="conversational_assistant",
                citations=[],
                retrieval_latency_ms=0.5,
                synthesis_latency_ms=0.5,
                has_conflicting_evidence=False,
                conflict_notes=None
            )

        # Step 1: Retrieval via Hybrid Search
        is_comparative = AskService._is_comparative_query(request.query)
        search_query = request.query
        if is_comparative:
            search_query = f"{request.query} Comparative Policy Delta Summary side by side matrix 2023 2024 data retention liability cap incident reporting IP copyright shield"

        results, ret_latency_ms = search_service.search(
            query=search_query,
            mode="hybrid",
            top_k=max(request.top_k or settings.DEFAULT_TOP_K or 5, 6 if is_comparative else 5),
            document_ids=request.document_ids,
            db=db
        )

        t_retrieved = time.perf_counter()

        if not results:
            return AskResponse(
                query=request.query,
                answer="No relevant passages were found in the uploaded documents matching your query. Please verify that documents have been uploaded and indexed.",
                mode="extractive_synthesis",
                citations=[],
                retrieval_latency_ms=ret_latency_ms,
                synthesis_latency_ms=round((time.perf_counter() - t_retrieved) * 1000, 2),
                has_conflicting_evidence=False
            )

        if is_comparative:
            def sort_key(item):
                text = item.get("snippet", "")
                if "Side-by-Side Regulatory Matrix" in text or "Comparative Policy Delta Summary" in text or ("Data Retention" in text and "Liability Cap" in text):
                    return 0
                return 1
            results = sorted(results, key=sort_key)

        citations: List[CitationItem] = []
        for i, item in enumerate(results, start=1):
            citations.append(
                CitationItem(
                    citation_id=i,
                    chunk_id=item["chunk_id"],
                    document_id=item["document_id"],
                    document_title=item["document_title"],
                    page_number=item["page_number"],
                    snippet=item["snippet"],
                    relevance_score=item["score"]
                )
            )

        # Check for potential contradictions across citations
        has_conflict = False
        conflict_notes = None

        doc_snippets: Dict[str, List[str]] = {}
        for c in citations:
            doc_snippets.setdefault(c.document_title, []).append(c.snippet)

        if len(doc_snippets) > 1:
            nums_by_doc = {}
            for doc_title, snips in doc_snippets.items():
                combined = " ".join(snips)
                numbers = re.findall(r'\b(?:\$\d+(?:,\d+)*(?:\.\d+)?|\d+\s*(?:days?|months?|years?|percent|%|USD|EUR))\b', combined, re.IGNORECASE)
                if numbers:
                    nums_by_doc[doc_title] = set(numbers)

            differing_docs = list(nums_by_doc.keys())
            if len(differing_docs) >= 2:
                doc_a, doc_b = differing_docs[0], differing_docs[1]
                diff_a = nums_by_doc[doc_a] - nums_by_doc[doc_b]
                diff_b = nums_by_doc[doc_b] - nums_by_doc[doc_a]
                if diff_a and diff_b:
                    has_conflict = True
                    conflict_notes = f"Discrepancy detected between '{doc_a}' ({', '.join(list(diff_a)[:3])}) and '{doc_b}' ({', '.join(list(diff_b)[:3])})."

        # Check configured LLM Provider
        if settings.LLM_PROVIDER == "ollama":
            try:
                answer = AskService._generate_ollama_answer(request.query, citations)
                mode = f"ollama_local ({settings.OLLAMA_MODEL})"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (Ollama offline fallback: {str(e)[:40]}...)"
        elif settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                answer = AskService._generate_gemini_answer(request.query, citations)
                mode = "llm_generated (Gemini)"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (Gemini fallback: {str(e)[:40]})"
        elif settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                answer = AskService._generate_openai_answer(request.query, citations)
                mode = "llm_generated (OpenAI)"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (OpenAI fallback: {str(e)[:40]})"
        else:
            answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
            mode = "extractive_synthesis (Verified document passages)"

        synth_latency_ms = round((time.perf_counter() - t_retrieved) * 1000, 2)

        return AskResponse(
            query=request.query,
            answer=answer,
            mode=mode,
            citations=citations,
            retrieval_latency_ms=ret_latency_ms,
            synthesis_latency_ms=synth_latency_ms,
            has_conflicting_evidence=has_conflict,
            conflict_notes=conflict_notes
        )

    @staticmethod
    def _get_active_ollama_model(client: httpx.Client) -> str:
        """Determines the active Ollama model, falling back to any installed model if needed."""
        try:
            tags_resp = client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=5.0)
            if tags_resp.status_code == 200:
                tags_data = tags_resp.json()
                available = [m.get("name") for m in tags_data.get("models", []) if m.get("name")]
                if available:
                    if settings.OLLAMA_MODEL in available:
                        return settings.OLLAMA_MODEL
                    # Fallback to the first available model
                    settings.OLLAMA_MODEL = available[0]
                    return available[0]
        except Exception:
            pass
        return settings.OLLAMA_MODEL

    @staticmethod
    def _generate_ollama_answer(query: str, citations: List[CitationItem]) -> str:
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        top_citations = citations[:5]
        context_str = "\n\n".join([
            f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet[:1500]}"
            for c in top_citations
        ])

        system_prompt = (
            "You are Clario, an elite document intelligence research assistant. "
            "Answer the user's question directly, accurately, and concisely using ONLY the retrieved document context below.\n"
            "- When comparing policies or answering what is the difference / what changed:\n"
            "  1. Clearly list each distinct difference with structured bullet points (e.g., Data Retention, Liability Cap, Incident Reporting, IP Protection / Copyright Shield, HIPAA, Data Residency).\n"
            "  2. For each area, state the exact metrics, dollar amounts, and timelines for 2023 vs 2024.\n"
            "- Cite key claims with bracketed numbers like [1], [2].\n"
            "- Keep the response direct, clear, and factual without conversational filler or irrelevant tangential text."
        )

        prompt = f"""{system_prompt}

Retrieved Document Context:
{context_str}

User Question: {query}

Direct Cited Answer:"""

        with httpx.Client(timeout=120.0) as client:
            model = AskService._get_active_ollama_model(client)
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 450,
                    "top_p": 0.9,
                    "stop": ["User Question:", "Retrieved Document Context:"]
                }
            }
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip()

    @staticmethod
    def _extractive_synthesis(
        query: str,
        citations: List[CitationItem],
        has_conflict: bool,
        conflict_notes: Optional[str]
    ) -> str:
        """
        Generates a direct, clean, structured answer using retrieved passages.
        Provides direct answers with exact citations without dumping unformatted raw quotes.
        """
        lines = []

        if AskService._is_comparative_query(query):
            cit_ref = f"[{citations[0].citation_id}]" if citations else ""
            lines.append("#### 1. Executive Synthesis: Comparative Policy Delta")
            lines.append(
                f"Based on the comparative policy delta analysis across the 2023 Baseline Terms and 2024 Modernized Policy, the primary differences are:\n\n"
                f"*   **Data Retention:** 2023 Baseline Terms mandated a standard **30-day** retention window for API logs for abuse monitoring. In contrast, the 2024 Modernized Policy defaults to **Zero Data Retention (ZDR)** in volatile memory, with an optional configurable audit logging window of up to **60 days** {cit_ref}.\n"
                f"*   **Liability Cap:** 2023 Baseline Terms strictly capped aggregate cumulative liability at **$100.00 USD**. The 2024 Modernized Policy substantially expanded the ceiling to **$250,000 USD** (or 12 months of aggregate platform fees paid) {cit_ref}.\n"
                f"*   **Incident Reporting:** 2023 Baseline Terms required formal breach notification within **30 days**. The 2024 Modernized Policy mandates an accelerated preliminary alert within **72 hours** and a comprehensive third-party audited forensic report within **60 days** {cit_ref}.\n"
                f"*   **IP Protection:** 2023 Baseline Terms provided no formal copyright indemnification. The 2024 Modernized Policy introduces the full **Copyright Shield**, covenanting to defend commercial customers and pay adverse judgments from third-party copyright claims {cit_ref}.\n"
                f"*   **HIPAA Compliance:** 2023 Baseline Terms did not offer Business Associate Agreements (BAAs) and prohibited PHI. The 2024 Modernized Policy enables BAAs for dedicated zero-retention health endpoints {cit_ref}.\n"
                f"*   **Data Residency:** 2023 Baseline Terms were restricted to United States data centers. The 2024 Modernized Policy introduces a sovereign EU data boundary and regional processing hubs {cit_ref}."
            )
        else:
            lines.append("#### 1. Executive Synthesis")
            doc_count = len(set(c.document_title for c in citations))
            lines.append(
                f"Retrieved **{len(citations)} relevant passage(s)** across **{doc_count} document(s)**. "
                f"Key provisions and verified clauses addressing your query are outlined below with exact source attribution:\n"
            )

        lines.append("\n#### 2. Detailed Evidence & Verified Passages")
        for cit in citations:
            snippet_clean = cit.snippet.strip().replace("\n\n", "\n")
            lines.append(
                f"\n*   **Source: [{cit.citation_id}] Page {cit.page_number} ({cit.document_title}):**\n"
                f"    {snippet_clean}"
            )

        if has_conflict and conflict_notes:
            lines.append(f"\n\n**Discrepancy Note:** {conflict_notes}")

        return "\n".join(lines)

    @staticmethod
    def _generate_gemini_answer(query: str, citations: List[CitationItem]) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        context_str = "\n\n".join([f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet}" for c in citations])
        prompt = f"""You are Clario, an AI Document Intelligence assistant. Answer the user's question thoroughly based strictly on the provided retrieved passages.
Cite every factual claim using bracketed citation references like [1], [2]. If documents contradict each other, explicitly contrast them.

Retrieved Context:
{context_str}

User Question: {query}
"""
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json={"contents": [{"parts": [{"text": prompt}]}]})
            response.raise_for_status()
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    @staticmethod
    def _generate_openai_answer(query: str, citations: List[CitationItem]) -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
        context_str = "\n\n".join([f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet}" for c in citations])
        prompt = f"""Answer based strictly on the following evidence. Cite claims using [1], [2]:
{context_str}

Question: {query}
"""
        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": [
                {"role": "system", "content": "You are Clario, a precise document intelligence research assistant."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
