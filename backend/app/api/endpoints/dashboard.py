from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.schemas.dtos import DashboardStatsResponse
from app.services.dashboard_service import DashboardService

router = APIRouter()

@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_metrics(db: Session = Depends(get_db)):
    return DashboardService.get_stats(db)
