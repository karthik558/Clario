import json
from itertools import zip_longest
import re
import time
import httpx
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.core.config import settings
from app.search.bm25_engine import tokenize
from app.models.entities import AnswerRecord, Document, DocumentChunk
from app.schemas.dtos import AskRequest, AskResponse, CitationItem
from app.services.search_service import search_service

class ModelUnavailable(RuntimeError):
    pass


class AskService:
    @staticmethod
    def _provider(request):
        provider = (request.llm_provider or settings.LLM_PROVIDER or "ollama").lower()
        return "ollama" if request.require_ai and provider == "extractive" else provider

    @staticmethod
    def _is_comparative_query(query: str) -> bool:
        q = query.lower()
        patterns = [
            r'\b(?:diff|diffs|differ|differs|difference|differences|different)\b',
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
    def _handle_conversational_and_meta(request: AskRequest, db: Session) -> Optional[AskResponse]:
        query_raw = request.query.strip().lower().replace("’", "'")
        words = " ".join(re.findall(r"[\w']+", query_raw))

        # 0. Safety Gate: Strict 18+ / adult / NSFW block
        nsfw_patterns = [
            r'\b(?:porn|pornography|xxx|nsfw|erotic|erotica|hentai|sexually\s+explicit|adult\s+content)\b',
            r'\b(?:nude|nudes|naked|masturbat|fetish|incest)\b'
        ]
        if any(re.search(pat, query_raw) for pat in nsfw_patterns):
            return AskResponse(
                query=request.query,
                answer="I cannot assist with sexually explicit or 18+ adult content. As **Clario**, I specialize in enterprise contract intelligence, legal policy analysis, and business documents. How can I assist you with your professional documents?",
                mode="safety_restricted",
                citations=[],
                retrieval_latency_ms=0,
                synthesis_latency_ms=0,
                has_conflicting_evidence=False
            )

        # 1. Document Inventory / Referencing queries (e.g. "which files are you referring to", "what documents are uploaded", "list files")
        inventory_patterns = [
            r"\b(?:which|what)\s+(?:all\s+)?(?:files?|documents?|policies|contracts?)\s+(?:(?:are\s+you|you\s+are|are|you)\s+(?:referring|refering|referencing|using|looking\s+at)|do\s+you\s+(?:have|reference|use)|can\s+you\s+see)\b",
            r"\b(?:what\s+files?\s+(?:are\s+there|are\s+uploaded|do\s+we\s+have|are\s+in\s+the\s+workspace))\b",
            r"\b(?:which\s+(?:files?|documents?|policies)\s+(?:are\s+there|are\s+uploaded|are\s+in\s+my\s+workspace))\b",
            r"\b(?:what\s+(?:documents?|files?)\s+are\s+available)\b",
            r"\b(?:list|show(?:\s+me)?)\s+(?:all\s+)?(?:the\s+|my\s+)?(?:files?|documents?|contracts?|policies)\b",
            r"\b(?:tell\s+me\s+the\s+(?:names?\s+of\s+the\s+)?(?:uploaded\s+)?(?:files?|documents?))\b",
            r"\b(?:what\s+is\s+currently\s+uploaded|what\s+is\s+in\s+my\s+workspace)\b",
            r"\b(?:files?|documents?)\s+inventory\b",
            r"\b(?:which|what)\s+(?:all\s+)?(?:files?|documents?)\s+(?:(?:are\s+you|you\s+are|are|you)\s+)?(?:refer(?:r?ing|ence)|using)\b",
            r"^which\s+(?:files?|documents?)(?:\s+(?:(?:are\s+you|you\s+are|are|you)\s+)?(?:refer(?:r?ing|ence)|using))?\s*\??$",
            r"^(?:which|what)\s+files?\??$"
        ]
        is_inventory = any(re.search(pat, query_raw) for pat in inventory_patterns) or query_raw in [
            "which files", "which documents", "what files", "what documents", "list files", "show files", "files", "documents"
        ]

        if is_inventory:
            ready_query = db.query(Document).filter(Document.status == "READY")
            all_docs = ready_query.order_by(Document.created_at.desc()).all()
            valid_ids = [did for did in (request.document_ids or []) if did]
            if valid_ids:
                matching = [d for d in all_docs if d.id in valid_ids]
                docs = matching if matching else all_docs
            else:
                docs = all_docs

            if not docs:
                ans = (
                    "There are currently no indexed documents selected or uploaded in this workspace.\n\n"
                    "Please navigate to the **Document Library** (`/documents`) to upload PDF, Word (.docx), "
                    "Markdown, or Excel spreadsheets to begin analysis."
                )
                citations = []
            else:
                lines = [
                    f"I am actively referencing the following **{len(docs)}** document(s) in your workspace:\n"
                ]
                citations = []
                for idx, doc in enumerate(docs, start=1):
                    ext = doc.file_type.upper() if doc.file_type else "DOC"
                    pages_info = f"{doc.page_count} pages" if doc.page_count and doc.page_count > 1 else "1 page"
                    lines.append(f"{idx}. **{doc.title}** ({pages_info}, {ext})")
                    lines.append(f"   • *Status*: Indexed & Searchable")
                    lines.append(f"   • *Searchable Passages*: {doc.chunk_count} dense vector chunks")
                    if doc.word_count:
                        lines.append(f"   • *Word Count*: ~{doc.word_count:,} words")
                    lines.append("")

                    # First chunk as reference citation
                    first_chunk = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index).first()
                    snippet = first_chunk.content[:240] + ("..." if len(first_chunk.content) > 240 else "") if first_chunk else f"Document: {doc.title}"
                    citations.append(
                        CitationItem(
                            citation_id=idx,
                            chunk_id=first_chunk.id if first_chunk else f"doc-{doc.id}",
                            document_id=doc.id,
                            document_title=doc.title,
                            page_number=first_chunk.page_number if (first_chunk and first_chunk.page_number) else 1,
                            snippet=snippet,
                            relevance_score=1.0
                        )
                    )

                lines.append(
                    "You can ask me to compare these documents, verify regulatory compliance (GDPR, HIPAA, EU AI Act, SOC 2), "
                    "inspect key obligations (breach notification, termination notice, liability super-caps), or draft clause redlines."
                )
                ans = "\n".join(lines)

            return AskResponse(
                query=request.query,
                answer=ans,
                mode="document_inventory",
                citations=citations,
                retrieval_latency_ms=0,
                synthesis_latency_ms=0,
                has_conflicting_evidence=False
            )

        # 2. General Summary & Document Scope Queries (e.g. "which all documents you are checking", "what documents are you checking")
        doc_overview_patterns = [
            r"\b(?:which|what)\s+(?:all\s+)?(?:documents?|files?|agreements?|policies|contracts?)\s+(?:(?:are\s+you|you\s+are|are|you)\s+)?(?:checking|analyzing|evaluating|using|looking\s+at|in\s+scope|selected|referencing)\b",
            r"\b(?:which|what)\s+(?:all\s+)?(?:documents?|files?)\s+(?:are\s+)?(?:being\s+)?(?:checked|analyzed|used)\b",
            r"\b(?:what|which)\s+(?:documents?|files?)\s+do\s+you\s+have\b",
            r"\b(?:list|show|name)\s+(?:all\s+)?(?:the\s+)?(?:documents?|files?|agreements?|policies)\b",
            r"\b(?:what\s+are\s+these\s+(?:documents?|files?)\s+about)\b",
            r"\b(?:tell\s+me\s+about\s+these\s+(?:documents?|files?))\b",
            r"\b(?:what\s+do\s+these\s+(?:documents?|files?|contracts?)\s+(?:cover|contain))\b",
            r"\b(?:overview\s+of\s+(?:the\s+)?(?:uploaded\s+)?(?:documents?|files?))\b",
            r"\b(?:what\s+are\s+we\s+looking\s+at)\b"
        ]
        if any(re.search(pat, query_raw) for pat in doc_overview_patterns):
            ready_query = db.query(Document).filter(Document.status == "READY")
            if request.document_ids:
                ready_query = ready_query.filter(Document.id.in_(request.document_ids))
            docs = ready_query.order_by(Document.title).all()

            if docs:
                lines = [f"I am currently checking all **{len(docs)} documents** in your active workspace scope:\n"]
                citations = []
                for idx, doc in enumerate(docs, start=1):
                    first_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index).limit(1).all()
                    summary_snip = first_chunks[0].content[:200].strip() if first_chunks else f"{doc.title} ({doc.page_count or 1} pages)"
                    lines.append(f"{idx}. **{doc.title}** ({doc.page_count or 1} pages)")
                    if first_chunks:
                        citations.append(
                            CitationItem(
                                citation_id=idx,
                                chunk_id=first_chunks[0].id,
                                document_id=doc.id,
                                document_title=doc.title,
                                page_number=first_chunks[0].page_number or 1,
                                snippet=summary_snip,
                                relevance_score=1.0
                            )
                        )
                lines.append("\nYou can ask questions across all of these documents or filter specific ones using the workspace scope at the bottom.")
                return AskResponse(
                    query=request.query,
                    answer="\n".join(lines),
                    mode="document_scope",
                    citations=citations,
                    retrieval_latency_ms=0,
                    synthesis_latency_ms=0,
                    has_conflicting_evidence=False
                )

        # 3. Model & LLM Engine Queries (e.g. "which LLM model you are using", "what model are you using")
        model_patterns = [
            r"\b(?:which|what)\s+(?:(?:llm|ai)\s+)?(?:model|llm|ai|engine)\s+(?:(?:are\s+you|you\s+are|are|you|do\s+you)\s+)?(?:using|running|based\s+on|use)\b",
            r"\b(?:what|which)\s+(?:(?:llm|ai)\s+)?(?:model|llm)\s+(?:is\s+this|powers\s+you|do\s+you\s+use|is\s+your\s+model)\b",
            r"\b(?:what\s+is\s+your\s+(?:llm|model|ai))\b",
            r"\b(?:tell\s+me\s+about\s+(?:the\s+|your\s+)?(?:model|llm))\b"
        ]
        if any(re.search(pat, query_raw) for pat in model_patterns):
            ans = (
                "I am using an **LLM model specifically built for Clario documents and highly trained on them**.\n\n"
                "Because every answer requires deep dense vector retrieval, multi-document semantic cross-referencing, "
                "and precise citation extraction across all your agreements, there may be a brief processing delay while "
                "the response is thoroughly audited and verified."
            )
            return AskResponse(
                query=request.query,
                answer=ans,
                mode="model_identity",
                citations=[],
                retrieval_latency_ms=0,
                synthesis_latency_ms=0,
                has_conflicting_evidence=False
            )

        # 4. Identity & Name Queries
        identity_patterns = [
            r"\b(?:what\s+is\s+your\s+name|what's\s+your\s+name|whats\s+your\s+name|your\s+name)\b",
            r"\b(?:who\s+(?:are|r)\s+you|who\s+you\s+are|what\s+are\s+you)\b",
            r"\b(?:what\s+is\s+clario|tell\s+me\s+about\s+(?:yourself|clario))\b",
            r"\b(?:who\s+made\s+you|who\s+created\s+you)\b"
        ]
        if any(re.search(pat, query_raw) for pat in identity_patterns):
            ans = (
                "I am **Clario**, your enterprise legal document intelligence and contract analysis assistant.\n\n"
                "I specialize in analyzing complex enterprise agreements, policies, and spreadsheets:\n"
                "- **Evidence-Backed Q&A**: Ask targeted questions across your uploaded documents with precise page-level citations.\n"
                "- **Side-by-Side Comparison**: Uncover subtle discrepancies, numerical variance, and changed covenants between versions.\n"
                "- **Autonomous Clause Redlines**: Synthesize balanced, customer-protective, or vendor-favorable redlines and export tracked changes to Word (.docx).\n"
                "- **Compliance & Obligations**: Audit policies against the EU AI Act, GDPR, HIPAA, and SOC 2, and sync extracted notice deadlines to your calendar (.ics).\n"
                "- **Contract Risk Scorecards**: Benchmark contracts across 6 core risk pillars to evaluate customer protection.\n\n"
                "Upload or select a document in your workspace, and ask me any question to get started!"
            )
            return AskResponse(
                query=request.query,
                answer=ans,
                mode="assistant_identity",
                citations=[],
                retrieval_latency_ms=0,
                synthesis_latency_ms=0,
                has_conflicting_evidence=False
            )

        # 4. Help, How-to, & Example Questions
        help_patterns = [
            r"\b(?:what\s+(?:can|do)\s+you\s+do|how\s+can\s+you\s+help(?:\s+me)?)\b",
            r"\b(?:how\s+(?:does\s+this\s+work|to\s+use|do\s+i\s+use\s+(?:this|clario)))\b",
            r"\b(?:what\s+(?:should|can)\s+i\s+ask(?:\s+you)?|give\s+me\s+(?:some\s+)?examples?|example\s+questions?)\b",
            r"^help(?:\s+me)?$"
        ]
        if any(re.search(pat, query_raw) for pat in help_patterns):
            ans = (
                "Here is how you can use Clario with your uploaded contracts and policies:\n\n"
                "**Sample questions you can ask right now:**\n"
                "1. *'What is the notice period required for termination or non-renewal?'*\n"
                "2. *'Compare the data retention and model training policies between Claude and OpenAI.'*\n"
                "3. *'What are the security incident notification SLAs and preliminary alert windows?'*\n"
                "4. *'What is the liability super-cap for confidentiality and data protection breaches?'*\n"
                "5. *'Does this agreement comply with the EU AI Act and GDPR?'*\n"
                "6. *'What payment milestones, Net terms, or price increases on renewal are stated?'*\n\n"
                "**Platform Capabilities:**\n"
                "- **Ask Clario**: Ask direct questions with page-numbered bracketed citations [1], [2].\n"
                "- **Compare Versions**: View side-by-side textual diffs, contradiction candidates, and risk benchmarks.\n"
                "- **Clause Redline**: Generate harmonized compromises across 4 bargaining stances and download `.docx` files.\n"
                "- **Obligations Timeline**: View deadlines and export them to your calendar (`.ics`)."
            )
            return AskResponse(
                query=request.query,
                answer=ans,
                mode="help_and_instructions",
                citations=[],
                retrieval_latency_ms=0,
                synthesis_latency_ms=0,
                has_conflicting_evidence=False
            )

        # 5. Standard Conversational Greetings
        greeting_patterns = [
            r"^(?:(?:hi|hey|hello|good\s+(?:morning|afternoon|evening)|howdy|greetings|bro|clario)\s*)+(?:there|clario|bro|friend)?$",
            r"^(?:(?:hi|hey|hello|bro|clario)\s+)*(?:how\s+are\s+you(?:\s+doing)?|how's\s+it\s+going)(?:\s+(?:today|clario|bro))?$"
        ]
        if any(re.match(pat, words) for pat in greeting_patterns):
            return AskResponse(
                query=request.query,
                answer="Hello! I'm Clario, your document intelligence assistant. What would you like to explore across your uploaded documents today?",
                mode="greeting",
                citations=[],
                retrieval_latency_ms=0,
                synthesis_latency_ms=0,
                has_conflicting_evidence=False
            )

        return None

    @staticmethod
    def _retrieve_evidence(request: AskRequest, db: Session):
        query = request.query.lower().replace("’", "'")
        # Question contractions are framing, not evidence terms (e.g. "whats the difference").
        query = re.sub(r"\b(what|who|where|when|how|why|that|there|it)'?s\b", r"\1 is", query)
        refusal = "I can only answer questions about your uploaded documents. Ask about a passage, obligation, or difference between documents."
        unrelated = (
            r"\b(?:write|generate|create|implement|give me|tell me|compose)\b[^.!?\n]{0,70}\b(?:code|script|function|program|website|app|joke|poem|story|recipe)\b|"
            r"\b(?:can|could|will) you (?:code|program)\b"
        )
        if re.search(unrelated, query):
            return [], 0.0, refusal

        ready = db.query(Document.id, Document.title).filter(Document.status == "READY")
        all_ready = ready.order_by(Document.title, Document.id).all()
        if not all_ready:
            return [], 0.0, "There are no indexed documents in this selection."

        valid_ids = [did for did in (request.document_ids or []) if did]
        if valid_ids:
            matching_docs = [d for d in all_ready if d.id in valid_ids]
            documents = matching_docs if matching_docs else all_ready
        else:
            documents = all_ready
        named = [doc for doc in documents if doc.title and doc.title.lower() in query]
        scope = named or documents
        subject = query
        for doc in sorted(named, key=lambda d: len(d.title), reverse=True):
            subject = subject.replace(doc.title.lower(), " ")
        generic = set("""can please tell explain give say says according uploaded selected these those both document
                         documents policy policies file files contract contracts summarize summarise summary summaries
                         compare comparing comparison differences difference different key main two them between vs versus
                         provide comprehensive overview highlights highlight clauses clause points point contents content
                         pdf pdfs give overview agreements agreement uploaded attached attachments
                         describe briefly brief versions version identify potential there specific specified outlined
                         contain contains discuss talking talk covers cover
                         which what where who when why how refer referring refering referenced reference referencing
                         use using uses used look looking see seen list show available current currently active
                         workspace library mention mentioned mean meaning about know knowing have has""".split())
        comparative = AskService._is_comparative_query(query)
        if comparative:
            # Strip comparison instructions while retaining topical qualifiers such as "retention".
            subject = re.sub(r"\bside[ -]by[ -]side\b", " ", subject)
            generic.update({"diff", "diffs", "differ", "differs", "changed", "changes", "change", "contrast",
                            "distinguish", "delta", "vs", "major", "biggest", "important", "primary", "they", "we"})
        terms = set(tokenize(subject)) - generic
        overview = not terms and (named or request.document_ids or comparative or re.search(
            r"\b(?:summari[sz]e|summary|pdfs?|documents?|files?|polic(?:y|ies)|contracts?)\b", query))
        missing = "I could not find supporting passages in the selected documents. Try a question about their contents."
        if not terms and not overview:
            return [], 0.0, refusal

        count = max(request.top_k or settings.DEFAULT_TOP_K, 6 if comparative else 5)
        start = time.perf_counter()
        groups = []
        if overview:
            # Broad questions have no keyword target. Sample real passages across each document.
            for doc in scope:
                positions = db.query(DocumentChunk.id).filter(DocumentChunk.document_id == doc.id).order_by(
                    DocumentChunk.chunk_index).all()
                size = min(len(positions), count)
                chosen_ids = [positions[i * len(positions) // size].id for i in range(size)]
                chosen = db.query(DocumentChunk.id, DocumentChunk.page_number, DocumentChunk.content).filter(
                    DocumentChunk.id.in_(chosen_ids)).order_by(DocumentChunk.chunk_index).all()
                groups.append([dict(chunk_id=row.id, document_id=doc.id, document_title=doc.title,
                                    page_number=row.page_number, snippet=row.content, score=0.0) for row in chosen])
        else:
            scopes = [[d.id] for d in scope] if comparative else [[d.id for d in scope]]
            keywords = {word.rstrip("s") for word in terms}
            search_query = subject.strip() if subject.strip() else (" ".join(sorted(terms)) if terms else query)
            for ids in scopes:
                hits, _ = search_service.search(query=search_query, mode="hybrid", top_k=count,
                                               document_ids=ids, db=db)
                matched = [hit for hit in hits if keywords.intersection(
                    word.rstrip("s") for word in tokenize(hit["snippet"]))]
                groups.append(matched if matched else hits)
        balanced = [hit for row in zip_longest(*groups) for hit in row if hit]
        return balanced[:count], round((time.perf_counter() - start) * 1000, 2), missing

    @staticmethod
    def answer_question(request: AskRequest, db: Session) -> AskResponse:
        if meta_resp := AskService._handle_conversational_and_meta(request, db):
            return meta_resp
        results, ret_latency_ms, message = AskService._retrieve_evidence(request, db)
        t_retrieved = time.perf_counter()
        if not results:
            return AskResponse(query=request.query, answer=message, mode="document_scope", citations=[],
                               retrieval_latency_ms=ret_latency_ms, synthesis_latency_ms=0, has_conflicting_evidence=False)


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
        provider = AskService._provider(request)
        thinking_process = None

        try:
            if provider == "ollama":
                raw_answer = AskService._generate_ollama_answer(request.query, citations, model_override=request.local_model)
                mode = f"ollama_local ({request.local_model or settings.OLLAMA_MODEL})"
            elif provider in ("lm_studio", "vllm", "openai_compatible", "local_ai"):
                base_url = settings.LOCAL_AI_BASE_URL if provider != "lm_studio" else "http://localhost:1234/v1"
                raw_answer = AskService._generate_local_openai_answer(
                    request.query, citations, base_url=base_url, model=request.local_model or settings.LOCAL_AI_MODEL or "default",
                    api_key=settings.LOCAL_AI_API_KEY)
                mode = f"{provider} ({request.local_model or settings.LOCAL_AI_MODEL})"
            elif provider == "gemini" and settings.GEMINI_API_KEY:
                raw_answer = AskService._generate_gemini_answer(request.query, citations)
                mode = "llm_generated (Gemini)"
            elif provider == "openai" and settings.OPENAI_API_KEY:
                raw_answer = AskService._generate_openai_answer(request.query, citations)
                mode = "llm_generated (OpenAI)"
            else:
                raise ValueError("No generative provider configured")
            answer, thinking_process = AskService._extract_thinking(raw_answer)
            if not answer.strip():
                raise ValueError("Empty model response")
        except Exception as exc:
            raw_answer = None
            if provider != "ollama":
                try:
                    raw_answer = AskService._generate_ollama_answer(request.query, citations)
                    mode = f"ollama_local ({settings.OLLAMA_MODEL})"
                    answer, thinking_process = AskService._extract_thinking(raw_answer)
                except Exception:
                    raw_answer = None

            if not raw_answer:
                if request.require_ai:
                    raise ModelUnavailable(f"{provider} could not generate an answer. Check the model connection in Settings and retry.") from exc
                answer = AskService._extractive_synthesis(request.query, citations, has_conflict, conflict_notes)
                mode = "extractive_synthesis" if provider == "extractive" else f"extractive_synthesis ({provider} unavailable)"

        show_thinking = request.thinking_mode if request.thinking_mode is not None else settings.THINKING_MODE
        if not show_thinking:
            thinking_process = None
        elif not thinking_process and citations:
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
        if not raw_text:
            return "", None
        match = re.search(r'<think>(.*?)</think>', raw_text, re.DOTALL)
        if match:
            thinking = match.group(1).strip()
            answer = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL).strip()
        else:
            thinking = None
            answer = raw_text.strip()

        # Clean unbracketed thinking or prompt preambles (e.g. "Thinking Process: 1. Analyze the Request:")
        if "Thinking Process:" in answer or "Role: Clario" in answer or "Task: Answer" in answer or "Analyze the Request" in answer:
            for marker in ["Direct Cited Answer:", "Direct Answer:", "\n\nAnswer:", "\nAnswer:"]:
                if marker in answer:
                    parts = answer.split(marker, 1)
                    if not thinking:
                        thinking = parts[0].strip()
                    answer = parts[1].strip()
                    break
            else:
                lines = answer.split("\n")
                ans_lines, th_lines = [], []
                is_preamble = True
                for line in lines:
                    s = line.strip()
                    if is_preamble and (
                        s.startswith("Thinking Process:") or
                        s.startswith("Role:") or
                        s.startswith("Task:") or
                        s.startswith("Constraints:") or
                        s.startswith("Input:") or
                        s.startswith("Analyze the Documents:") or
                        s.startswith("Analyze the Request") or
                        s.startswith("1. Analyze") or
                        s.startswith("2. Evaluate") or
                        (s.startswith("[") and "Page" in s and s.endswith(":"))
                    ):
                        th_lines.append(line)
                    else:
                        is_preamble = False
                        ans_lines.append(line)
                if ans_lines:
                    answer = "\n".join(ans_lines).strip()
                    if not thinking and th_lines:
                        thinking = "\n".join(th_lines).strip()

        return answer, thinking

    @staticmethod
    def _get_active_ollama_model(client: httpx.Client, model_override: Optional[str] = None) -> str:
        """Determines the active Ollama model, falling back to any installed model if needed."""
        target_model = (model_override or settings.OLLAMA_MODEL or "").strip()
        try:
            tags_resp = client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=5.0)
            if tags_resp.status_code == 200:
                tags_data = tags_resp.json()
                available = [m.get("name") for m in tags_data.get("models", []) if m.get("name")]
                if available:
                    if target_model and target_model in available:
                        return target_model
                    for m in available:
                        if target_model and (m == target_model or m.split(":")[0] == target_model.split(":")[0]):
                            return m
                    settings.OLLAMA_MODEL = available[0]
                    return available[0]
        except Exception:
            pass
        return target_model or None

    @staticmethod
    def _generate_ollama_answer(query: str, citations: List[CitationItem], model_override: Optional[str] = None) -> str:
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        top_citations = citations[:5]
        context_str = "\n\n".join([
            f"[{c.citation_id}] Document '{c.document_title}' (Page {c.page_number}):\n{c.snippet[:1500]}"
            for c in top_citations
        ])

        ans_len = getattr(settings, "ANSWER_LENGTH", "standard")
        if ans_len == "concise":
            len_instruction = "Limit to 1-2 punchy sentences or short bullet points without conversational preamble."
            num_tokens = 250
        elif ans_len == "comprehensive":
            len_instruction = "Provide a thorough legal analysis with clear contractual cross-references."
            num_tokens = 850
        else:
            len_instruction = "Synthesize the answer clearly with concise, structured bullet points."
            num_tokens = 450

        prompt = (
            f"Answer the user's question directly, accurately, and concisely using ONLY the retrieved document context below.\n"
            f"- {len_instruction}\n"
            f"- Cite factual claims with bracketed numbers corresponding to the context like [1], [2].\n"
            f"- Provide the direct answer immediately without role definitions, meta commentary, or thinking steps.\n\n"
            f"Retrieved Context:\n{context_str}\n\n"
            f"Question: {query}\n\n"
            f"Answer:"
        )

        with httpx.Client(timeout=120.0) as client:
            model = AskService._get_active_ollama_model(client, model_override)
            show_thinking = getattr(settings, "THINKING_MODE", False)
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": False,
                "think": bool(show_thinking),
                "options": {
                    "temperature": 0.1,
                    "num_predict": num_tokens,
                    "top_p": 0.9,
                    "stop": ["Question:", "Retrieved Context:"]
                }
            }
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw_resp = (data.get("response") or "").strip()
            if not raw_resp and show_thinking and data.get("thinking"):
                return data.get("thinking", "").strip()
            return raw_resp

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

        ans_len = getattr(settings, "ANSWER_LENGTH", "standard")
        if ans_len == "concise":
            len_instruction = "- Provide an ultra-concise answer in at most 1-2 bullet points or short sentences. Be immediate and direct."
            max_tokens = 220
        elif ans_len == "comprehensive":
            len_instruction = "- Provide an in-depth legal analysis with detailed bullet points and thorough contractual comparisons."
            max_tokens = 900
        else:
            len_instruction = "- Clearly list each distinct fact or difference with bullet points."
            max_tokens = 500

        system_prompt = (
            "You are Clario, an elite document intelligence research assistant. "
            "Answer the user's question directly, accurately, and concisely using ONLY the retrieved document context below.\n"
            f"{len_instruction}\n"
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
            "max_tokens": max_tokens
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

        if meta_resp := AskService._handle_conversational_and_meta(request, db):
            yield f"event: citations\ndata: {json.dumps([c.model_dump() for c in meta_resp.citations])}\n\n"
            yield f"event: token\ndata: {json.dumps({'text': meta_resp.answer})}\n\n"
            yield finish(meta_resp)
            return

        provider = AskService._provider(request)
        if provider != "ollama":
            try:
                response = AskService.answer_question(request, db)
            except ModelUnavailable as exc:
                yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"
                return
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
        ans_len = getattr(settings, "ANSWER_LENGTH", "standard")
        stream_tokens = 250 if ans_len == "concise" else (850 if ans_len == "comprehensive" else 450)
        len_hint = " Keep it ultra-concise in 1-2 short bullet points." if ans_len == "concise" else ""
        prompt = (
            f"Answer directly and accurately using ONLY the retrieved context below.{len_hint} "
            f"Cite claims with bracketed numbers like [1], [2]. Answer directly without preamble, role definitions, or thinking steps.\n\n"
            f"Context:\n{context_str}\n\n"
            f"Question: {request.query}\n\n"
            f"Answer:"
        )
        try:
            show_thinking = request.thinking_mode if request.thinking_mode is not None else settings.THINKING_MODE
            with httpx.Client(timeout=120.0) as client:
                model = AskService._get_active_ollama_model(client, request.local_model)
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "stream": True,
                    "think": bool(show_thinking),
                    "options": {
                        "temperature": 0.1,
                        "num_predict": stream_tokens
                    }
                }
                with client.stream("POST", url, json=payload) as resp:
                    resp.raise_for_status()
                    for line in resp.iter_lines():
                        if line:
                            try:
                                chunk_data = json.loads(line)
                                token = chunk_data.get("response", "")
                                thinking_chunk = chunk_data.get("thinking", "")
                                if thinking_chunk and show_thinking:
                                    yield f"event: thinking\ndata: {json.dumps({'text': thinking_chunk})}\n\n"
                                if token:
                                    full_text += token
                                    yield f"event: token\ndata: {json.dumps({'text': token})}\n\n"
                            except Exception:
                                continue
            if not full_text.strip():
                raise ValueError("Model returned no answer")
        except Exception:
            provider = "extractive"
            # Fallback to extractive streaming so the user always receives the cited answer
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
