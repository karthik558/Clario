import json
import pytest
import pymupdf
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.config import settings
from app.database.session import Base, get_db
from app.models.entities import Document, DocumentChunk, Finding, Report, AnswerRecord
from app.schemas.dtos import AskResponse
from app.services.settings_service import load_saved_settings, SETTINGS_FIELDS
from app.services.search_service import search_service
from app.services.ask_service import AskService

@pytest.fixture
def workspace(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    for key in SETTINGS_FIELDS:
        monkeypatch.setattr(settings, key.upper(), getattr(settings, key.upper()))
    monkeypatch.setattr(settings, 'REPORTS_DIR', tmp_path)
    for obj, attr in [(search_service, '_last_chunk_count'), (search_service.bm25_engine, 'k1'), (search_service.bm25_engine, 'b'), (search_service.hybrid_engine, 'rrf_k')]:
        monkeypatch.setattr(obj, attr, getattr(obj, attr))
    def get_test_db():
        with factory() as db: yield db
    app.dependency_overrides[get_db] = get_test_db
    yield TestClient(app), factory
    app.dependency_overrides.clear()
    engine.dispose()

def test_settings_survive_new_session_and_startup_load(workspace):
    client, factory = workspace
    assert client.post('/api/settings', json={'ollama_model': 'custom-auditor', 'llm_provider': 'ollama', 'bm25_k1': 2, 'default_top_k': 9}).status_code == 200
    settings.OLLAMA_MODEL = 'temporary-reset'
    settings.DEFAULT_TOP_K = 5
    with factory() as db: load_saved_settings(db)
    saved = client.get('/api/settings').json()
    assert saved['ollama_model'] == 'custom-auditor'
    assert saved['default_top_k'] == 9
    assert search_service.bm25_engine.k1 == 2
    for invalid in [{'bm25_b': 2}, {'llm_provider': 'unknown'}, {'ollama_base_url': 'file:///tmp'}, {'ollama_model': '  '}]:
        assert client.post('/api/settings', json=invalid).status_code == 422
    assert client.get('/api/settings').json()['ollama_model'] == 'custom-auditor'

def test_answers_are_saved_and_restored(workspace, monkeypatch):
    client, factory = workspace
    answer = AskResponse(query='Retention?', answer='## Summary\n\n**Thirty days** [1].', mode='extractive', citations=[], retrieval_latency_ms=1, synthesis_latency_ms=1, has_conflicting_evidence=False)
    monkeypatch.setattr(AskService, 'answer_question', lambda request, db: answer)
    response = client.post('/api/ask', json={'query': 'Retention?', 'document_ids': ['doc-a']})
    assert response.status_code == 200
    with factory() as db:
        record = db.query(AnswerRecord).one()
        assert json.loads(record.response_json)['answer'] == answer.answer
        assert json.loads(record.document_ids_json) == ['doc-a']
    history = client.get('/api/ask/history').json()
    assert history[0]['response'] == response.json()
    assert history[0]['query'] == 'Retention?'

def seed_report_data(factory):
    with factory() as db:
        for doc_id in ['a', 'b', 'outside']:
            db.add(Document(id=doc_id, title=f'Document <{doc_id}> & notes', filename=f'{doc_id}.txt', file_type='txt', file_size=100, storage_path=f'{doc_id}.txt', status='READY', page_count=1, word_count=10, chunk_count=1))
            db.add(DocumentChunk(document_id=doc_id, chunk_index=0, content='Source evidence <tag> & plain text.', page_number=1))
        db.add(Finding(title='In scope <review>', description='Review', category='possible_contradiction', doc_a_id='a', doc_b_id='b', doc_a_title='A', doc_b_title='B', doc_a_quote='A < 30 days', doc_b_quote='B > 60 days', doc_a_page=1, doc_b_page=2))
        db.add(Finding(title='Outside finding', description='Exclude this', category='possible_contradiction', doc_a_id='outside', doc_b_id='b'))
        db.commit()

def test_report_scope_notes_and_pdf_match(workspace):
    client, factory = workspace
    seed_report_data(factory)
    response = client.post('/api/reports', json={'title': 'Audit <draft> & review', 'report_type': 'contradictions', 'document_ids': ['a', 'b'], 'custom_notes': 'Reviewer notes <keep> & verify.'})
    assert response.status_code == 200, response.text
    report = response.json()
    assert report['document_ids'] == ['a', 'b']
    assert [item['title'] for item in report['content']['findings_summary']] == ['In scope <review>']
    pdf = client.get(f"/api/reports/{report['id']}/download")
    assert pdf.status_code == 200
    with pymupdf.open(stream=pdf.content, filetype='pdf') as document:
        text = ''.join(page.get_text() for page in document)
    assert 'Reviewer notes <keep> & verify.' in text
    assert 'A < 30 days' in text and 'B > 60 days' in text
    assert 'Outside finding' not in text
    with factory() as db: assert db.query(Report).count() == 1
    assert client.get('/api/reports').json()[0]['content'] == report['content']

def test_report_templates_and_full_workspace_scope(workspace):
    client, factory = workspace
    seed_report_data(factory)
    response = client.post('/api/reports', json={'title': 'Source summary', 'report_type': 'summary', 'document_ids': []})
    assert response.status_code == 200
    report = response.json()
    assert len(report['document_ids']) == 3
    assert len(report['content']['source_excerpts']) == 3
    assert report['content']['findings_summary'] == []
    assert client.post('/api/reports', json={'title': 'Invalid', 'report_type': 'summary', 'document_ids': ['missing']}).status_code == 422
    assert client.post('/api/reports', json={'title': 'Invalid', 'report_type': 'invented'}).status_code == 422

def test_ollama_http_failure_has_structured_status(workspace, monkeypatch):
    from app.api.endpoints import settings as endpoint
    class OfflineClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def get(self, url): return type('Response', (), {'status_code': 503})()
    monkeypatch.setattr(endpoint.httpx, 'Client', OfflineClient)
    status = endpoint.check_ollama_status()
    assert status['running'] is False
    assert status['models'] == []

def test_multiline_query_keeps_summary_and_every_source():
    from app.schemas.dtos import CitationItem
    citations = [CitationItem(citation_id=i, chunk_id=str(i), document_id='a', document_title='Policy', page_number=i, snippet=f'Retention is {i * 30} days.\nReview the policy.', relevance_score=1) for i in range(1, 6)]
    answer = AskService._extractive_synthesis('Retention?\nInclude evidence.', citations, False, None)
    assert 'Executive Synthesis' in answer
    for i in range(1, 6):
        assert f'Source: [{i}] Page {i}' in answer


@pytest.mark.parametrize("question", ["Can you write a poem about contracts?", "Can you write code?", "Tell me a joke about contracts."])
def test_document_scope_applies_before_model_calls(workspace, monkeypatch, question):
    client, factory = workspace
    def unexpected(*args, **kwargs):
        pytest.fail("Off-topic request reached retrieval")
    monkeypatch.setattr(search_service, "search", unexpected)
    for endpoint in ["/api/ask", "/api/ask/stream"]:
        response = client.post(endpoint, json={"query": question, "llm_provider": "ollama"})
        assert response.status_code == 200
        assert "document_scope" in response.text
    history = client.get("/api/ask/history").json()
    assert len(history) == 2
    assert all(row["response"]["citations"] == [] for row in history)


def test_corrupt_upload_is_never_searchable(workspace, tmp_path, monkeypatch):
    client, factory = workspace
    monkeypatch.setattr(settings, "DOCUMENTS_DIR", tmp_path)
    response = client.post("/api/documents/upload", files={"file": ("broken.pdf", b"invalid PDF")})
    assert response.status_code == 422
    with factory() as db:
        assert db.query(Document).one().status == "ERROR"
        assert db.query(DocumentChunk).count() == 0


def test_ai_comparison_uses_both_selected_sources_or_reports_model_failure(workspace, monkeypatch):
    client, factory = workspace
    seed_report_data(factory)
    monkeypatch.setattr(settings, "LLM_PROVIDER", "extractive")
    captured = []
    def generate(query, citations, model_override=None):
        captured.extend(citations)
        return "The comparison uses both selected sources [1] [2]."
    monkeypatch.setattr(AskService, "_generate_ollama_answer", generate)
    payload = {"query": "Compare the two selected documents and summarize the key differences.",
               "document_ids": ["a", "b"], "require_ai": True}
    response = client.post("/api/ask", json=payload)
    assert response.status_code == 200
    assert response.json()["mode"].startswith("ollama_local")
    assert {item.document_id for item in captured} == {"a", "b"}

    def offline(*args, **kwargs):
        raise ConnectionError("offline")
    monkeypatch.setattr(AskService, "_generate_ollama_answer", offline)
    assert client.post("/api/ask", json=payload).status_code == 503
    assert len(client.get("/api/ask/history").json()) == 1

@pytest.mark.parametrize("query", [
    "whats the difference between two",
    "What's the biggest difference between the two PDFs?",
    "How do they differ?",
    "What changed?",
    "Compare them side by side",
])
def test_informal_comparisons_use_workspace_documents(workspace, query):
    client, factory = workspace
    seed_report_data(factory)
    response = client.post("/api/ask", json={"query": query, "llm_provider": "extractive"})
    assert response.status_code == 200
    assert {c["document_id"] for c in response.json()["citations"]} == {"a", "b", "outside"}

@pytest.mark.parametrize('path', ['/api/ask', '/api/ask/stream'])
def test_casual_greeting_is_saved_without_document_search(workspace, path):
    client, _ = workspace
    query = 'Bro, how are you?'
    response = client.post(path, json={'query': query, 'require_ai': True, 'llm_provider': 'ollama'})
    assert response.status_code == 200
    saved, = client.get('/api/ask/history').json()
    assert saved['query'] == query
    assert saved['response']['mode'] == 'greeting'
    assert saved['response']['citations'] == []
    assert saved['response']['answer'] in response.text
