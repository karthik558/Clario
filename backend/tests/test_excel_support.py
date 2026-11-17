import os
import tempfile
import openpyxl
from app.ingestion.parser import DocumentParser

def test_excel_parsing_supports_multiple_sheets_and_tables():
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Terms"
    ws1.append(["Clause", "Baseline", "Modernized"])
    ws1.append(["Liability Cap", "$100 USD", "$250,000 USD"])
    ws1.append(["Retention", "30 Days", "Zero Data Retention"])

    ws2 = wb.create_sheet(title="SLA_Metrics")
    ws2.append(["Service", "Uptime Target", "Remedy"])
    ws2.append(["API Core", "99.9%", "Service Credits"])

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
        tmp_path = tmp.name
        wb.save(tmp_path)

    try:
        pages = DocumentParser.parse(tmp_path, "xlsx")
        assert len(pages) == 2
        assert "Liability Cap" in pages[0].text
        assert "SLA_Metrics" in pages[1].text
        assert "99.9%" in pages[1].text
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_csv_parsing_formats_markdown_table():
    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write("Obligation,2023,2024\nBreach Notice,30 Days,72 Hours\nIP Defense,None,Copyright Shield\n")

    try:
        pages = DocumentParser.parse(tmp_path, "csv")
        assert len(pages) >= 1
        assert "Breach Notice" in pages[0].text
        assert "Copyright Shield" in pages[0].text
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
