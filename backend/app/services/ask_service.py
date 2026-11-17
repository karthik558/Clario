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
    def answer_question(request: AskRequest, db: Session) -> AskResponse:
        t0 = time.perf_counter()

        # Step 1: Retrieval via Hybrid Search
        results, ret_latency_ms = search_service.search(
            query=request.query,
            mode="hybrid",
            top_k=request.top_k or settings.DEFAULT_TOP_K or 5,
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
        context_str = "\n\n".join([
            f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet}"
            for c in citations
        ])

        system_prompt = (
            "You are Clario, an elite document intelligence research assistant. "
            "Answer the user's question clearly, comprehensively, and objectively using ONLY the retrieved document passages below. "
            "Provide full explanations rather than brief summaries. Cite every claim with bracketed source numbers like [1], [2]. "
            "If the documents state different policies or contain conflicts, explicitly contrast them."
        )

        prompt = f"""{system_prompt}

Retrieved Document Context:
{context_str}

User Question: {query}

Comprehensive Answer with source citations [1], [2]:"""

        with httpx.Client(timeout=120.0) as client:
            model = AskService._get_active_ollama_model(client)
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.2
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
        Generates a rich, comprehensive, structured answer using all retrieved document passages.
        Provides direct answers, full context quotes, and explicit cross-document comparisons.
        """
        lines = []
        lines.append(f"### Research Findings for: *\"{query}\"*\n")

        # Group citations by document
        by_doc: Dict[str, List[CitationItem]] = {}
        for c in citations:
            by_doc.setdefault(c.document_title, []).append(c)

        # 1. Executive Summary
        lines.append("#### 1. Executive Synthesis")
        doc_count = len(by_doc)
        total_passages = len(citations)
        lines.append(
            f"Retrieved **{total_passages} relevant passage(s)** across **{doc_count} document(s)**. "
            f"Key provisions and clauses addressing your inquiry are outlined below with exact source attribution:\n"
        )

        # 2. Detailed Findings by Document
        lines.append("#### 2. Detailed Evidence & Source Provisions")
        for doc_title, doc_cits in by_doc.items():
            lines.append(f"\n##### Document: **{doc_title}**")
            for cit in doc_cits:
                lines.append(
                    f"\n> {cit.snippet.strip()}\n"
                    f">\n"
                    f"> **— Source: [{cit.citation_id}] Page {cit.page_number} (Relevance Score: {cit.relevance_score})**\n"
                )

        # 3. Contradiction / Discrepancy Note if present
        if has_conflict and conflict_notes:
            lines.append(f"\n#### 3. ⚠️ Policy Divergence & Contradiction Alert")
            lines.append(f"> {conflict_notes}\n> *Note: Please review the conflicting terms above before finalizing compliance decisions.*")

        lines.append("\n---")
        lines.append("*All findings compiled directly from indexed passages with zero hallucination. Click any citation card below to inspect the full document page.*")

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
