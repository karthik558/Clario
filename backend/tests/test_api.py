import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.session import SessionLocal
from app.models.entities import Document

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "Clario"

def test_dashboard_stats():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_documents"] >= 2
    assert data["total_searchable_passages"] >= 10
    assert "recent_documents" in data

def test_list_documents():
    response = client.get("/api/documents")
    assert response.status_code == 200
    docs = response.json()
    assert len(docs) >= 2
    doc_id = docs[0]["id"]

    # Test detail
    detail = client.get(f"/api/documents/{doc_id}")
    assert detail.status_code == 200
    assert len(detail.json()["chunks"]) > 0

def test_search_engines():
    # Test BM25
    r_bm25 = client.post("/api/search", json={"query": "retention policy days deletion", "mode": "bm25", "top_k": 3})
    assert r_bm25.status_code == 200
    assert len(r_bm25.json()["results"]) > 0

    # Test Vector
    r_vec = client.post("/api/search", json={"query": "limitation of liability damages cap", "mode": "vector", "top_k": 3})
    assert r_vec.status_code == 200
    assert len(r_vec.json()["results"]) > 0

    # Test Hybrid
    r_hyb = client.post("/api/search", json={"query": "differential privacy epsilon", "mode": "hybrid", "top_k": 3})
    assert r_hyb.status_code == 200
    assert len(r_hyb.json()["results"]) > 0

def test_search_compare_methods():
    response = client.post("/api/search/compare-methods", json={"query": "data retention termination", "top_k": 3})
    assert response.status_code == 200
    data = response.json()
    assert "latency_bm25_ms" in data
    assert "latency_vector_ms" in data
    assert "latency_hybrid_ms" in data
    assert "bm25_results" in data
    assert "vector_results" in data
    assert "hybrid_results" in data

def test_academic_ir_benchmark():
    response = client.post("/api/search/benchmark", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["total_queries"] >= 3
    assert "bm25_mean" in data
    assert "hybrid_mean" in data
    assert data["hybrid_mean"]["precision_at_3"] >= 0.0

def test_ask_clario():
    response = client.post("/api/ask", json={"query": "What is the data retention period after termination?", "top_k": 4})
    assert response.status_code == 200
    data = response.json()
    assert len(data["citations"]) > 0
    assert len(data["answer"]) > 20
    assert "retrieval_latency_ms" in data

    # Test history retrieval and deletion
    hist_res = client.get("/api/ask/history")
    assert hist_res.status_code == 200
    assert len(hist_res.json()) > 0

    del_res = client.delete("/api/ask/history")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    hist_after = client.get("/api/ask/history")
    assert hist_after.status_code == 200
    assert len(hist_after.json()) == 0

def test_document_comparison():
    db = SessionLocal()
    docs = db.query(Document).all()
    assert len(docs) >= 2
    doc_a_id = docs[0].id
    doc_b_id = docs[1].id
    db.close()

    response = client.post("/api/compare", json={"doc_a_id": doc_a_id, "doc_b_id": doc_b_id})
    assert response.status_code == 200
    data = response.json()
    assert "similarity_score" in data
    assert "diff_blocks" in data
    assert "shared_topics" in data

def test_findings_workflow():
    # Ensure at least one finding exists
    response = client.get("/api/findings")
    assert response.status_code == 200
    findings = response.json()
    if len(findings) == 0:
        create_res = client.post("/api/findings", json={
            "title": "Data Retention Policy Discrepancy",
            "category": "conflict",
            "description": "30-day API retention in 2023 vs 60-day in 2024.",
            "severity": "high",
            "status": "flagged",
            "doc_a_title": "OpenAI Policy 2023",
            "doc_b_title": "OpenAI Policy 2023 2024 Report"
        })
        assert create_res.status_code == 200
        findings = [create_res.json()]

    assert len(findings) > 0
    fid = findings[0]["id"]

    # Patch finding status
    patch_res = client.patch(f"/api/findings/{fid}", json={"status": "confirmed", "reviewer_notes": "Verified by human auditor."})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "confirmed"

def test_reports_generation():
    db = SessionLocal()
    doc = db.query(Document).first()
    doc_id = doc.id if doc else "dummy"
    db.close()

    response = client.post("/api/reports", json={
        "title": "Automated Legal & Policy Audit Dossier",
        "report_type": "comparative",
        "document_ids": [doc_id]
    })
    assert response.status_code == 200
    data = response.json()
    assert data["pdf_available"] is True
    report_id = data["id"]

    # Test download
    dl_res = client.get(f"/api/reports/{report_id}/download")
    assert dl_res.status_code == 200
    assert dl_res.headers["content-type"] == "application/pdf"


def test_negotiate_clause():
    response = client.post("/api/negotiate", json={
        "topic": "Data Retention & Archival",
        "statement_a": "Customer data is retained for 30 days following termination.",
        "statement_b": "Customer data is retained for 7 years to satisfy regulatory compliance requirements.",
        "doc_a_title": "Terms of Service 2023",
        "doc_b_title": "Enterprise Agreement 2024",
        "stance": "balanced"
    })
    assert response.status_code == 200
    data = response.json()
    assert "proposed_clause" in data
    assert "rationale" in data
    assert "risk_level" in data
    assert len(data["proposed_clause"]) > 20
    assert data["stance"] == "balanced"


def test_knowledge_graph():
    response = client.get("/api/graph")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
    assert "stats" in data
    assert data["stats"]["total_nodes"] >= 0


def test_ask_stream():
    response = client.post("/api/ask/stream", json={
        "query": "What is the policy?",
        "llm_provider": "extractive"
    })
    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")
    content = response.text
    assert "event: token" in content or "event: citations" in content
