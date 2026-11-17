from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.entities import IngestionJob
from app.schemas.dtos import IngestionJobResponse

router = APIRouter()

@router.get("/jobs/{job_id}", response_model=IngestionJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(IngestionJob).filter(IngestionJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return job
