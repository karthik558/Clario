import os
from pathlib import Path
from typing import List, Dict, Any
import pymupdf as fitz  # PyMuPDF
import docx

class PageText:
    def __init__(self, page_number: int, text: str):
        self.page_number = page_number
        self.text = text

class DocumentParser:
    @staticmethod
    def parse_pdf(file_path: str) -> List[PageText]:
        pages: List[PageText] = []
        try:
            doc = fitz.open(file_path)
            for i, page in enumerate(doc):
                text = page.get_text("text") or ""
                # Clean up repeated trailing newlines
                cleaned = "\n".join([line.strip() for line in text.splitlines() if line.strip()])
                pages.append(PageText(page_number=i + 1, text=cleaned))
            doc.close()
        except Exception as e:
            raise ValueError("Could not read the PDF file.") from e
        return pages

    @staticmethod
    def parse_docx(file_path: str) -> List[PageText]:
        pages: List[PageText] = []
        try:
            doc = docx.Document(file_path)
            full_text = []
            for para in doc.paragraphs:
                if para.text.strip():
                    full_text.append(para.text.strip())
            
            # Approximate 350-400 words per page for DOCX
            combined = "\n\n".join(full_text)
            words = combined.split()
            words_per_page = 350
            if len(words) <= words_per_page:
                pages.append(PageText(page_number=1, text=combined))
            else:
                current_page = 1
                for i in range(0, len(words), words_per_page):
                    page_slice = " ".join(words[i:i + words_per_page])
                    pages.append(PageText(page_number=current_page, text=page_slice))
                    current_page += 1
        except Exception as e:
            raise ValueError("Could not read the DOCX file.") from e
        return pages

    @staticmethod
    def parse_plain_text(file_path: str) -> List[PageText]:
        pages: List[PageText] = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

            # Check for explicit page break markers first
            if "<!-- pagebreak -->" in content:
                raw_pages = content.split("<!-- pagebreak -->")
                for i, page_str in enumerate(raw_pages, start=1):
                    if page_str.strip():
                        pages.append(PageText(page_number=i, text=page_str.strip()))
                if pages:
                    return pages

            if "\f" in content:
                raw_pages = content.split("\f")
                for i, page_str in enumerate(raw_pages, start=1):
                    if page_str.strip():
                        pages.append(PageText(page_number=i, text=page_str.strip()))
                if pages:
                    return pages
            
            # Divide into pages by ~2500 characters
            chars_per_page = 2500
            if len(content) <= chars_per_page:
                pages.append(PageText(page_number=1, text=content.strip()))
            else:
                current_page = 1
                for i in range(0, len(content), chars_per_page):
                    chunk_text = content[i:i + chars_per_page].strip()
                    pages.append(PageText(page_number=current_page, text=chunk_text))
                    current_page += 1
        except Exception as e:
            raise ValueError("Could not read the text file.") from e
        return pages

    @staticmethod
    def parse_excel(file_path: str) -> List[PageText]:
        pages: List[PageText] = []
        try:
            import openpyxl
            wb = openpyxl.load_workbook(file_path, data_only=True)
            page_num = 1
            for sheetname in wb.sheetnames:
                sheet = wb[sheetname]
                rows_text = []
                headers: List[str] = []
                for row in sheet.iter_rows(values_only=True):
                    cells = [str(c).strip() if c is not None else "" for c in row]
                    if not any(cells):
                        continue
                    if not headers:
                        headers = cells
                        rows_text.append(f"### Sheet: {sheetname}")
                        rows_text.append(" | ".join([c if c else "-" for c in cells]))
                        rows_text.append("|".join(["---" for _ in cells]))
                    else:
                        rows_text.append(" | ".join([c if c else "-" for c in cells]))

                    if len(rows_text) >= 60:
                        pages.append(PageText(page_number=page_num, text="\n".join(rows_text)))
                        page_num += 1
                        rows_text = [f"### Sheet: {sheetname} (continued)", " | ".join(headers), "|".join(["---" for _ in headers])]

                if rows_text:
                    pages.append(PageText(page_number=page_num, text="\n".join(rows_text)))
                    page_num += 1
            wb.close()
        except Exception as e:
            raise ValueError("Could not read the Excel spreadsheet file.") from e
        if not pages:
            pages.append(PageText(page_number=1, text="Empty Excel spreadsheet."))
        return pages

    @staticmethod
    def parse_csv(file_path: str) -> List[PageText]:
        pages: List[PageText] = []
        try:
            import csv
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f)
                rows_text = []
                headers: List[str] = []
                page_num = 1
                for row in reader:
                    cells = [c.strip() for c in row]
                    if not any(cells):
                        continue
                    if not headers:
                        headers = cells
                        rows_text.append(" | ".join([c if c else "-" for c in cells]))
                        rows_text.append("|".join(["---" for _ in cells]))
                    else:
                        rows_text.append(" | ".join([c if c else "-" for c in cells]))
                    if len(rows_text) >= 60:
                        pages.append(PageText(page_number=page_num, text="\n".join(rows_text)))
                        page_num += 1
                        rows_text = [" | ".join(headers), "|".join(["---" for _ in headers])]
                if rows_text:
                    pages.append(PageText(page_number=page_num, text="\n".join(rows_text)))
        except Exception as e:
            raise ValueError("Could not read the CSV file.") from e
        if not pages:
            pages.append(PageText(page_number=1, text="Empty CSV file."))
        return pages

    @classmethod
    def parse(cls, file_path: str, file_type: str) -> List[PageText]:
        ext = file_type.lower().replace(".", "")
        if ext == "pdf":
            return cls.parse_pdf(file_path)
        elif ext in ["docx", "doc"]:
            return cls.parse_docx(file_path)
        elif ext in ["xlsx", "xls", "xlsm"]:
            return cls.parse_excel(file_path)
        elif ext == "csv":
            return cls.parse_csv(file_path)
        elif ext in ["txt", "md", "markdown", "json"]:
            return cls.parse_plain_text(file_path)
        else:
            return cls.parse_plain_text(file_path)
