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
    assert len(data["personas"]) in (0, 3)

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
