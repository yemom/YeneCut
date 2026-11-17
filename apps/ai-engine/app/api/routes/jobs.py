from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import verify_token
from app.schemas.models import JobStatusResponse
from app.workers.jobs import job_manager

router = APIRouter(dependencies=[Depends(verify_token)])


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job(job_id: str) -> JobStatusResponse:
    job = job_manager.get(job_id)
    return JobStatusResponse(
        job_id=job.job_id,
        job_type=job.job_type,
        status=job.status,
        progress=job.progress,
        error=job.error,
        result=job.result,
    )


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict:
    job = job_manager.get(job_id)
    job.cancel()
    return {"job_id": job_id, "status": "cancelling"}


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    job_manager.delete(job_id)
    return {"job_id": job_id, "deleted": True}
