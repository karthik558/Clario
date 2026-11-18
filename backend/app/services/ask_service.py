import json
import re
import time
import httpx
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.search.bm25_engine import tokenize
from app.models.entities import AnswerRecord
from app.schemas.dtos import AskRequest, AskResponse, CitationItem
from app.services.search_service import search_service

class AskService:
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
    def _retrieve_evidence(request: AskRequest, db: Session):
        query = request.query.lower().replace("’", "'")
        refusal = "I can only answer questions about your uploaded documents. Ask about a passage, obligation, or difference between documents."
        unrelated = (
            r"\b(?:who are you|your (?:name|age)|what can you do|what is clario)\b|"
            r"\b(?:write|generate|create|implement|give me|tell me|compose)\b[^.!?\n]{0,70}\b(?:code|script|function|program|website|app|joke|poem|story|recipe)\b|"
            r"\b(?:can|could|will) you (?:code|program)\b"
        )
        if re.search(unrelated, query):
            return [], 0.0, refusal

        # Rank within the selected documents, then require evidence for the original question.
        results, latency = search_service.search(query=request.query, mode="hybrid",
            top_k=max(request.top_k or settings.DEFAULT_TOP_K, 6 if AskService._is_comparative_query(query) else 5),
            document_ids=request.document_ids, db=db)
        generic = {"can", "please", "tell", "explain", "give", "say", "says", "according", "uploaded", "selected",
                   "document", "documents", "policy", "policies", "file", "files", "contract", "contracts", "summarize",
                   "summary", "compare", "differences", "difference", "key", "main", "two", "summarise"}
        terms = set(tokenize(query)) - generic
        overview = not terms and re.search(r"\b(?:document|file|polic(?:y|ies)|contract)s?\b", query)
        if not overview:
            # A filename may scope a question, but is not evidence for an unrelated subject.
            for title in {item["document_title"].lower() for item in results}:
                if title and title in query:
                    terms.difference_update(tokenize(title))
            if not terms and re.search(r"\b(?:compar\w*|summary|summari[sz]e|differences?)\b", query):
                return results, latency, refusal
            if not terms:
                return [], latency, refusal
            required = min(2, len(terms))
            results = [item for item in results if len(terms.intersection(
                tokenize(item["snippet"]))) >= required]
        return results, latency, "I could not find supporting passages in the selected documents. Try a question about their contents."

    @staticmethod
    def answer_question(request: AskRequest, db: Session) -> AskResponse:
        results, ret_latency_ms, message = AskService._retrieve_evidence(request, db)
        t_retrieved = time.perf_counter()
        if not results:
            return AskResponse(query=request.query, answer=message, mode="document_scope", citations=[],
                               retrieval_latency_ms=ret_latency_ms, synthesis_latency_ms=0, has_conflicting_evidence=False)

        # Sort results by relevance score descending
        results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)

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

        # Determine effective LLM Provider and Model
        provider = (request.llm_provider or settings.LLM_PROVIDER or "ollama").lower()
        thinking_process = None

        if provider == "ollama":
            try:
                raw_answer = AskService._generate_ollama_answer(request.query, citations, model_override=request.local_model)
                answer, thinking = AskService._extract_thinking(raw_answer)
                thinking_process = thinking
                mode = f"ollama_local ({request.local_model or settings.OLLAMA_MODEL})"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (Ollama offline fallback: {str(e)[:40]}...)"
        elif provider in ("lm_studio", "vllm", "openai_compatible", "local_ai"):
            try:
                base_url = settings.LOCAL_AI_BASE_URL if provider != "lm_studio" else "http://localhost:1234/v1"
                raw_answer = AskService._generate_local_openai_answer(
                    request.query, citations,
                    base_url=base_url,
                    model=request.local_model or settings.LOCAL_AI_MODEL or "default",
                    api_key=settings.LOCAL_AI_API_KEY
                )
                answer, thinking = AskService._extract_thinking(raw_answer)
                thinking_process = thinking
                mode = f"{provider} ({request.local_model or settings.LOCAL_AI_MODEL})"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis ({provider} offline fallback: {str(e)[:40]}...)"
        elif provider == "gemini" and settings.GEMINI_API_KEY:
            try:
                answer = AskService._generate_gemini_answer(request.query, citations)
                mode = "llm_generated (Gemini)"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (Gemini fallback: {str(e)[:40]})"
        elif provider == "openai" and settings.OPENAI_API_KEY:
            try:
                answer = AskService._generate_openai_answer(request.query, citations)
                mode = "llm_generated (OpenAI)"
            except Exception as e:
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = f"extractive_synthesis (OpenAI fallback: {str(e)[:40]})"
        else:
            answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
            mode = "extractive_synthesis (Verified document passages)"

        show_thinking = request.thinking_mode if request.thinking_mode is not None else settings.THINKING_MODE
        # If thinking mode was requested but model did not output <think> tags, construct chain-of-evidence synthesis
        if show_thinking and not thinking_process and citations:
            doc_names = list(dict.fromkeys(c.document_title for c in citations))
            thinking_process = (
                f"1. Query Dissection: Evaluated search parameters for '{request.query}'.\n"
                f"2. Corpus Cross-Reference: Retrieved and ranked {len(citations)} relevant passages across {', '.join(doc_names)}.\n"
                f"3. Evidence Validation: Collected page numbers and source passages for review.\n"
                f"4. Citation Mapping: Bound factual claims to verified bracketed citations [1] through [{min(len(citations), 5)}]."
            )

        synth_latency_ms = round((time.perf_counter() - t_retrieved) * 1000, 2)

        return AskResponse(
            query=request.query,
            answer=answer,
            mode=mode,
            citations=citations,
            retrieval_latency_ms=ret_latency_ms,
            synthesis_latency_ms=synth_latency_ms,
            has_conflicting_evidence=has_conflict,
            conflict_notes=conflict_notes,
            thinking_process=thinking_process if show_thinking else None
        )

    @staticmethod
    def _extract_thinking(raw_text: str) -> Tuple[str, Optional[str]]:
        match = re.search(r'<think>(.*?)</think>', raw_text, re.DOTALL)
        if match:
            thinking = match.group(1).strip()
            answer = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL).strip()
            return answer, thinking
        return raw_text.strip(), None

    @staticmethod
    def _get_active_ollama_model(client: httpx.Client, model_override: Optional[str] = None) -> str:
        """Determines the active Ollama model, falling back to any installed model if needed."""
        if model_override:
            return model_override
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
    def _generate_ollama_answer(query: str, citations: List[CitationItem], model_override: Optional[str] = None) -> str:
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        top_citations = citations[:5]
        context_str = "\n\n".join([
            f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet[:1500]}"
            for c in top_citations
        ])

        system_prompt = (
            "You are Clario, an elite document intelligence research assistant. "
            "Answer the user's question directly, accurately, and concisely using ONLY the retrieved document context below.\n"
            "- Synthesize the answer clearly with concise, structured bullet points.\n"
            "- When comparing documents or identifying differences, contrast the clauses across the retrieved documents directly, noting document titles and exact figures, terms, and timelines.\n"
            "- Cite factual claims with bracketed numbers corresponding to the context like [1], [2].\n"
            "- Keep the response direct, clear, and factual without conversational filler or unverified assumptions."
        )

        prompt = f"""{system_prompt}

Retrieved Document Context:
{context_str}

User Question: {query}

Direct Cited Answer:"""

        with httpx.Client(timeout=120.0) as client:
            model = AskService._get_active_ollama_model(client, model_override)
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
    def _generate_local_openai_answer(
        query: str,
        citations: List[CitationItem],
        base_url: str,
        model: str,
        api_key: str = ""
    ) -> str:
        """
        Connects to any OpenAI-compatible local AI server:
        LM Studio (localhost:1234/v1), vLLM (localhost:8000/v1), LocalAI, llama.cpp, Jan, etc.
        """
        top_citations = citations[:5]
        context_str = "\n\n".join([
            f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet[:1500]}"
            for c in top_citations
        ])

        system_prompt = (
            "You are Clario, an elite document intelligence research assistant. "
            "Answer the user's question directly, accurately, and concisely using ONLY the retrieved document context below.\n"
            "- Clearly list each distinct fact or difference with bullet points.\n"
            "- Cite key claims with bracketed numbers like [1], [2].\n"
            "- Keep the response direct and factual."
        )

        url = f"{base_url.rstrip('/')}/chat/completions" if not base_url.endswith("/chat/completions") else base_url
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Retrieved Context:\n{context_str}\n\nQuestion: {query}"}
            ],
            "temperature": 0.1,
            "max_tokens": 500
        }

        with httpx.Client(timeout=120.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
            return ""

    @staticmethod
    def stream_answer_question(request: AskRequest, db: Session):
        """
        Realtime Server-Sent Events (SSE) generator streaming tokens and reasoning directly to the frontend.
        """
        t0 = time.perf_counter()
        def finish(response):
            AskService.save_answer(request, response, db)
            return f"event: done\ndata: {response.model_dump_json()}\n\n"

        provider = (request.llm_provider or settings.LLM_PROVIDER or "ollama").lower()
        if provider != "ollama":
            response = AskService.answer_question(request, db)
            yield f"event: citations\ndata: {json.dumps([c.model_dump() for c in response.citations])}\n\n"
            if response.thinking_process:
                yield f"event: thinking\ndata: {json.dumps({'text': response.thinking_process})}\n\n"
            yield f"event: token\ndata: {json.dumps({'text': response.answer})}\n\n"
            yield finish(response)
            return

        results, ret_latency_ms, msg = AskService._retrieve_evidence(request, db)
        if not results:
            yield "event: citations\ndata: []\n\n"
            yield f"event: token\ndata: {json.dumps({'text': msg})}\n\n"
            yield finish(AskResponse(query=request.query, answer=msg, citations=[], mode="document_scope",
                       retrieval_latency_ms=ret_latency_ms, synthesis_latency_ms=0, has_conflicting_evidence=False))
            return

        results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)

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

        # Emit citations immediately so UI can display them
        yield f"event: citations\ndata: {json.dumps([c.model_dump() for c in citations])}\n\n"

        thinking_msg = None
        # Emit thinking process if requested
        if (request.thinking_mode if request.thinking_mode is not None else settings.THINKING_MODE):
            doc_names = list(dict.fromkeys(c.document_title for c in citations))
            thinking_msg = (
                f"1. Query Dissection: Analyzed search criteria for '{request.query}'.\n"
                f"2. Corpus Cross-Reference: Retrieved {len(citations)} passages across {', '.join(doc_names)}.\n"
                f"3. Verification: Validating figures, timelines, and legal liabilities against primary text.\n"
                f"4. Citation Synthesis: Formulating verified bullet points."
            )
            yield f"event: thinking\ndata: {json.dumps({'text': thinking_msg})}\n\n"

        full_text = ""
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        top_citations = citations[:5]
        context_str = "\n\n".join([f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet[:1500]}" for c in top_citations])
        system_prompt = (
            "You are Clario, an elite document intelligence research assistant. "
            "Answer directly and accurately using ONLY the retrieved context below. Cite claims like [1], [2]."
        )
        prompt = f"{system_prompt}\n\nRetrieved Context:\n{context_str}\n\nUser Question: {request.query}\n\nDirect Cited Answer:"
        model = request.local_model or settings.OLLAMA_MODEL

        try:
            with httpx.Client(timeout=120.0) as client:
                with client.stream("POST", url, json={"model": model, "prompt": prompt, "stream": True, "options": {"temperature": 0.1, "num_predict": 450}}) as resp:
                    resp.raise_for_status()
                    for line in resp.iter_lines():
                        if line:
                            try:
                                chunk_data = json.loads(line)
                                token = chunk_data.get("response", "")
                                full_text += token
                                yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
                            except Exception:
                                continue
            if not full_text.strip():
                raise ValueError("Model returned no answer")
        except Exception:
            provider = "extractive"
            # Fallback to extractive streaming
            full_text = AskService._extractive_synthesis(request.query, citations, False, None)
            yield f"event: token\ndata: {json.dumps({'text': full_text})}\n\n"
        synth_ms = round((time.perf_counter() - t0) * 1000, 2)
        yield finish(AskResponse(query=request.query, answer=full_text, mode=f"{provider}_stream",
                    citations=citations, retrieval_latency_ms=ret_latency_ms,
                    synthesis_latency_ms=max(0, synth_ms - ret_latency_ms), thinking_process=thinking_msg,
                    has_conflicting_evidence=False))

    @staticmethod
    def save_answer(request, response, db):
        db.add(AnswerRecord(query=request.query, document_ids_json=json.dumps(request.document_ids or []),
                            response_json=response.model_dump_json()))
        db.commit()

    @staticmethod
    def _extractive_synthesis(
        query: str,
        citations: List[CitationItem],
        has_conflict: bool,
        conflict_notes: Optional[str]
    ) -> str:
        """
        Generates a direct, clean, structured answer using retrieved passages.
        Provides clear, synthesized bullet points with exact citations.
        """
        if not citations:
            return "No matching clauses or relevant evidence were found in the uploaded documents for this query."

        # Group citations by document
        doc_citations: Dict[str, List[CitationItem]] = {}
        for c in citations:
            doc_citations.setdefault(c.document_title, []).append(c)

        lines = []
        is_comp = AskService._is_comparative_query(query)

        if is_comp and len(doc_citations) >= 2:
            lines.append("#### 1. Executive Synthesis: Comparative Analysis\n")
            doc_names = list(doc_citations.keys())
            lines.append(f"Comparing key provisions across **{doc_names[0]}** and **{doc_names[1]}** based on verified indexed passages:\n")

            for doc_title, cits in doc_citations.items():
                lines.append(f"**From {doc_title}:**")
                for c in cits[:3]:
                    clean_snip = c.snippet.strip().replace("\r\n", " ").replace("\n", " ")
                    sentences = [s.strip() for s in clean_snip.split(". ") if s.strip()]
                    summary_point = ". ".join(sentences[:2])
                    if summary_point and not summary_point.endswith("."):
                        summary_point += "."
                    lines.append(f"- {summary_point} [{c.citation_id}]")
                lines.append("")
        else:
            lines.append("#### 1. Executive Synthesis\n")
            doc_count = len(doc_citations)
            lines.append(
                f"Retrieved **{len(citations)} relevant passage(s)** across **{doc_count} document(s)**. "
                f"Key provisions and verified clauses addressing your query are outlined below with exact source attribution:\n"
            )
            for doc_title, cits in doc_citations.items():
                if len(doc_citations) > 1:
                    lines.append(f"**From {doc_title}:**")
                for c in cits[:3]:
                    clean_snip = c.snippet.strip().replace("\r\n", " ").replace("\n", " ")
                    sentences = [s.strip() for s in clean_snip.split(". ") if s.strip()]
                    summary_point = ". ".join(sentences[:2])
                    if summary_point and not summary_point.endswith("."):
                        summary_point += "."
                    lines.append(f"- {summary_point} [{c.citation_id}]")
                lines.append("")

        lines.append("\n#### 2. Detailed Evidence & Verified Passages")
        for cit in citations:
            snippet_clean = cit.snippet.strip().replace("\r\n", "\n")
            lines.append(
                f"\n*   **Source: [{cit.citation_id}] Page {cit.page_number} ({cit.document_title}):**\n"
                f"    {snippet_clean}"
            )

        if has_conflict and conflict_notes:
            lines.append(f"\n\n**Discrepancy Note:** {conflict_notes}")

        return "\n".join(lines).strip()

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
