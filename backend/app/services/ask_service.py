import re
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.dtos import AskRequest, AskResponse, CitationItem
from app.services.search_service import search_service

def extract_relevant_sentences(query: str, text: str, max_sentences: int = 3) -> List[str]:
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text)
    query_words = set(re.sub(r'[^a-z0-9\s]', '', query.lower()).split())
    scored = []
    for s in sentences:
        s_clean = s.strip()
        if len(s_clean) < 15:
            continue
        s_words = set(re.sub(r'[^a-z0-9\s]', '', s_clean.lower()).split())
        match_count = len(query_words.intersection(s_words))
        if match_count > 0:
            scored.append((match_count, s_clean))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:max_sentences]]

class AskService:
    @staticmethod
    def answer_question(request: AskRequest, db: Session) -> AskResponse:
        t0 = time.perf_counter()

        # Step 1: Retrieval via Hybrid Search
        results, ret_latency_ms = search_service.search(
            query=request.query,
            mode="hybrid",
            top_k=request.top_k,
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

        # Look for differing numeric specs or temporal terms across distinct documents
        doc_snippets = {}
        for c in citations:
            doc_snippets.setdefault(c.document_title, []).append(c.snippet)

        if len(doc_snippets) > 1:
            # Check for numbers associated with days, limits, dollars
            nums_by_doc = {}
            for doc_title, snips in doc_snippets.items():
                combined = " ".join(snips)
                numbers = re.findall(r'\b(?:\$\d+(?:,\d+)*(?:\.\d+)?|\d+\s*(?:days?|months?|years?|percent|%|USD))\b', combined, re.IGNORECASE)
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

        # Check if external LLM configured (Gemini or OpenAI)
        if settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                answer = AskService._generate_gemini_answer(request.query, citations)
                mode = "llm_generated (Gemini)"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (Fallback: {str(e)[:50]})"
        elif settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
            try:
                answer = AskService._generate_openai_answer(request.query, citations)
                mode = "llm_generated (OpenAI)"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (Fallback: {str(e)[:50]})"
        else:
            answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
            mode = "extractive_synthesis (Zero-hallucination local engine)"

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
    def _extractive_synthesis(
        query: str,
        citations: List[CitationItem],
        has_conflict: bool,
        conflict_notes: Optional[str]
    ) -> str:
        """
        Generates rigorous, evidence-based extractive answers using verbatim retrieved passages.
        Clearly labels each claim with source citations [1], [2] and outlines topic summaries.
        """
        lines = []
        lines.append(f"### Evidence Summary for: *\"{query}\"*\n")

        # Group citations by document
        by_doc: Dict[str, List[CitationItem]] = {}
        for c in citations:
            by_doc.setdefault(c.document_title, []).append(c)

        for doc_title, doc_cits in by_doc.items():
            lines.append(f"#### From **{doc_title}**:")
            for cit in doc_cits[:2]:
                key_sents = extract_relevant_sentences(query, cit.snippet, max_sentences=2)
                if key_sents:
                    quote = " ".join(key_sents)
                else:
                    quote = cit.snippet[:240].strip() + ("..." if len(cit.snippet) > 240 else "")
                lines.append(f"> \"{quote}\" **[[{cit.citation_id}] - Page {cit.page_number}]**\n")

        if has_conflict and conflict_notes:
            lines.append(f"\n> ⚠️ **Potential Contradiction / Divergence:**\n> {conflict_notes}")

        lines.append("\n*Note: This synthesis was compiled strictly from retrieved passages without generative hallucination. Click citations below to view source context.*")
        return "\n".join(lines)

    @staticmethod
    def _generate_gemini_answer(query: str, citations: List[CitationItem]) -> str:
        # Implementation when GEMINI_API_KEY is supplied
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        context_str = "\n\n".join([f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet}" for c in citations])
        prompt = f"""You are Clario, an AI Document Intelligence assistant. Answer the user's question based strictly on the provided retrieved passages.
Cite every factual claim using bracketed citation references like [1], [2]. If documents contradict each other, explicitly contrast them.

Retrieved Context:
{context_str}

User Question: {query}
"""
        response = httpx.post(url, json={"contents": [{"parts": [{"text": prompt}]}]}, timeout=15.0)
        response.raise_for_status()
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

    @staticmethod
    def _generate_openai_answer(query: str, citations: List[CitationItem]) -> str:
        import httpx
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
        response = httpx.post(url, json=payload, headers=headers, timeout=15.0)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
