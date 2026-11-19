from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_docs_page_custom_style():
    response = client.get("/docs")
    assert response.status_code == 200
    assert "clario-header" in response.text
    assert "clario-app-link" in response.text
    assert "Clario" in response.text
    assert "/favicon.svg" in response.text

    # Verify favicon endpoint
    fav_res = client.get("/favicon.svg")
    assert fav_res.status_code == 200
    assert fav_res.headers["content-type"] == "image/svg+xml"
    assert "<svg" in fav_res.text

def test_compliance_endpoints():
    r1 = client.get("/api/compliance/frameworks")
    assert r1.status_code == 200
    frameworks = r1.json()
    assert len(frameworks) >= 4
    assert any(f["id"] == "gdpr" for f in frameworks)

    r2 = client.post("/api/compliance/audit", json={})
    assert r2.status_code == 200
    data = r2.json()
    assert "overall_score" in data
    assert "frameworks" in data
    assert "gaps" in data

def test_obligations_endpoints():
    r1 = client.get("/api/obligations")
    assert r1.status_code == 200
    data = r1.json()
    assert "items" in data

    r2 = client.post("/api/obligations/scan", json={})
    assert r2.status_code == 200
    assert "items" in r2.json()

def test_critique_endpoints():
    r = client.post("/api/critique/evaluate", json={})
    assert r.status_code == 200
    data = r.json()
    assert "composite_risk_score" in data
    assert "personas" in data
    assert len(data["personas"]) in (0, 3, 5)
    if len(data["personas"]) == 5:
        persona_ids = [p["persona_id"] for p in data["personas"]]
        assert "general_counsel" in persona_ids
        assert "cfo" in persona_ids
        assert "ciso" in persona_ids
        assert "cco" in persona_ids
        assert "coo" in persona_ids

    # Test with custom clause
    r2 = client.post(
        "/api/critique/evaluate",
        json={"custom_clause": "Vendor liability is capped at fifty dollars total."}
    )
    assert r2.status_code == 200
    data2 = r2.json()
    assert "overall_assessment" in data2
    assert "leverage_summary" in data2

def test_clauses_endpoints():
    r1 = client.get("/api/clauses")
    assert r1.status_code == 200
    data = r1.json()
    assert "benchmarks" in data
    assert len(data["benchmarks"]) >= 5

    r2 = client.post(
        "/api/clauses/analyze",
        json={"clause_text": "Vendor shall not be liable for any consequential damages capped at 100."}
    )
    assert r2.status_code == 200
    res = r2.json()
    assert "favorability" in res
    assert "alignment_score" in res

    r3 = client.post(
        "/api/clauses/analyze",
        json={"clause_text": "Each party shall indemnify the other against third party claims.", "category": "Indemnification"}
    )
    assert r3.status_code == 200
    assert r3.json()["alignment_score"] > 0

def test_briefs_endpoints():
    r1 = client.get("/api/briefs/templates")
    assert r1.status_code == 200
    templates = r1.json()
    assert len(templates) >= 3

    for tmpl in ["board_executive", "ma_due_diligence", "procurement_closing"]:
        r2 = client.post("/api/briefs/generate", json={"template_id": tmpl})
        assert r2.status_code == 200
        brief = r2.json()
        assert "title" in brief
        assert "financial_exposure" in brief
        assert "legal_risks" in brief
        assert "action_items" in brief

def test_calendar_export_endpoint():
    res = client.get("/api/obligations/export-calendar")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/calendar")
    assert "BEGIN:VCALENDAR" in res.text
    assert "END:VCALENDAR" in res.text

def test_redline_docx_export_endpoint():
    res = client.post(
        "/api/negotiate/export-docx",
        json={
            "topic": "Data Retention",
            "stance": "customer_protective",
            "doc_a_title": "Doc A",
            "doc_b_title": "Doc B",
            "statement_a": "Zero data retention",
            "statement_b": "30 days retention"
        }
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert len(res.content) > 1000

def test_risk_scorecard_endpoints():
    res1 = client.get("/api/risk/scorecard")
    assert res1.status_code == 200
    data1 = res1.json()
    assert "composite_score" in data1
    assert "documents" in data1

def test_conversational_and_meta_basic_questions():
    basic_queries = [
        "whats your name",
        "who are you",
        "which files are you refering ?",
        "which files are you referring to",
        "what documents are uploaded",
        "list my files",
        "what can I ask?",
        "how does this work?",
        "what are these documents about?",
        "hello"
    ]
    for q in basic_queries:
        res = client.post("/api/ask", json={"query": q})
        assert res.status_code == 200
        data = res.json()
        assert any(data["mode"].startswith(m) for m in ("assistant_identity", "document_inventory", "corpus_overview", "help_and_instructions", "greeting", "ollama_local", "extractive_synthesis"))
        assert len(data["answer"]) > 20
        # Ensure it NEVER returns the rigid document_scope refusal
        assert "I can only answer questions about your uploaded documents" not in data["answer"]
        assert "I could not find supporting passages in the selected documents" not in data["answer"]

def test_audio_summary_endpoints():
    res1 = client.get("/api/briefs/audio-summary")
    assert res1.status_code == 200
    data1 = res1.json()
    assert "title" in data1
    assert "duration_seconds" in data1
    assert "sections" in data1
    assert "full_audio_text" in data1
    assert len(data1["sections"]) >= 1

    res2 = client.post("/api/briefs/audio-summary", json={"tone": "executive"})
    assert res2.status_code == 200
    data2 = res2.json()
    assert "duration_formatted" in data2

    # Audio export endpoints
    res_mp3 = client.get("/api/briefs/audio-export?format=mp3")
    assert res_mp3.status_code == 200
    assert len(res_mp3.content) > 1000

    res_mp4 = client.get("/api/briefs/audio-export?format=mp4")
    assert res_mp4.status_code == 200
    assert len(res_mp4.content) > 1000

def test_policy_checker_endpoints():
    r1 = client.get("/api/policy-checker/rules")
    assert r1.status_code == 200
    rules_data = r1.json()
    assert rules_data["total_rules"] >= 8
    assert any(r["id"] == "data_retention" for r in rules_data["rules"])
    assert any(r["id"] == "ai_model_training" for r in rules_data["rules"])

    r2 = client.get("/api/policy-checker/audit")
    assert r2.status_code == 200
    audit = r2.json()
    assert "overall_score" in audit
    assert "overall_grade" in audit
    assert "rules" in audit
    assert len(audit["rules"]) >= 8
    assert any(r["status"] in ("COMPLIANT", "NEEDS_REVIEW", "VIOLATION") for r in audit["rules"])

    r3 = client.post("/api/policy-checker/audit", json={"category_filter": "all"})
    assert r3.status_code == 200
    assert r3.json()["total_rules"] >= 8

def test_word_analysis_endpoints():
    r1 = client.get("/api/reports/analysis/words")
    assert r1.status_code == 200
    data = r1.json()
    assert "total_words" in data
    assert "unique_words" in data
    assert "lexical_density_pct" in data
    assert "top_keywords" in data
    assert "sentiment_breakdown" in data
    assert "document_breakdowns" in data
    assert len(data["top_keywords"]) >= 1

    r2 = client.post("/api/reports/analysis/words", json={})
    assert r2.status_code == 200
    assert r2.json()["total_words"] == data["total_words"]
