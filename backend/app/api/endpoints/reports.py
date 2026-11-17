import os
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.dtos import ReportCreate, ReportResponse
from app.services.report_service import ReportService

router = APIRouter()

@router.post("/reports", response_model=ReportResponse)
def generate_report(data: ReportCreate, db: Session = Depends(get_db)):
    report = ReportService.generate_report(data, db)
    return ReportResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        executive_summary=report.executive_summary,
        content=json.loads(report.content_json) if report.content_json else {},
        document_ids=json.loads(report.document_ids_json) if report.document_ids_json else [],
        pdf_available=bool(report.pdf_path and os.path.exists(report.pdf_path)),
        created_at=report.created_at
    )

@router.get("/reports", response_model=List[ReportResponse])
def list_reports(db: Session = Depends(get_db)):
    reports = ReportService.list_reports(db)
    result = []
    for r in reports:
        result.append(
            ReportResponse(
                id=r.id,
                title=r.title,
                report_type=r.report_type,
                executive_summary=r.executive_summary,
                content=json.loads(r.content_json) if r.content_json else {},
                document_ids=json.loads(r.document_ids_json) if r.document_ids_json else [],
                pdf_available=bool(r.pdf_path and os.path.exists(r.pdf_path)),
                created_at=r.created_at
            )
        )
    return result

@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = ReportService.get_report(report_id, db)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type,
        executive_summary=report.executive_summary,
        content=json.loads(report.content_json) if report.content_json else {},
        document_ids=json.loads(report.document_ids_json) if report.document_ids_json else [],
        pdf_available=bool(report.pdf_path and os.path.exists(report.pdf_path)),
        created_at=report.created_at
    )

@router.get("/reports/{report_id}/download")
def download_report_pdf(report_id: str, db: Session = Depends(get_db)):
    report = ReportService.get_report(report_id, db)
    if not report or not report.pdf_path or not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="PDF report not found or not yet generated.")
    return FileResponse(
        path=report.pdf_path,
        filename=f"Clario_Report_{report.title.replace(' ', '_')}.pdf",
        media_type="application/pdf"
    )

@router.delete("/reports/{report_id}")
def delete_report(report_id: str, db: Session = Depends(get_db)):
    success = ReportService.delete_report(report_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted successfully"}

@router.delete("/reports")
def clear_all_reports(db: Session = Depends(get_db)):
    count = ReportService.clear_all_reports(db)
    return {"message": f"Successfully cleared {count} report(s).", "cleared_count": count}
