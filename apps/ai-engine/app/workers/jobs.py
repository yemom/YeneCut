from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

from app.core.exceptions import JobCancelledError, JobNotFoundError


@dataclass
class Job:
    job_id: str
    job_type: str
    status: str = "queued"
    progress: float = 0.0
    result: dict[str, Any] | None = None
    error: str | None = None
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def cancel(self) -> None:
        self._cancel_event.set()

    @property
    def cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def check_cancelled(self) -> None:
        if self._cancel_event.is_set():
            raise JobCancelledError(f"Job {self.job_id} was cancelled")


class JobManager:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def create(self, job_type: str) -> Job:
        job = Job(job_id=str(uuid.uuid4()), job_type=job_type)
        self._jobs[job.job_id] = job
        return job

    def get(self, job_id: str) -> Job:
        job = self._jobs.get(job_id)
        if job is None:
            raise JobNotFoundError(f"Unknown job: {job_id}")
        return job

    def list(self) -> list[Job]:
        return list(self._jobs.values())

    async def run(self, job: Job, worker: Callable[[Job], Awaitable[Any]]) -> None:
        job.status = "running"
        try:
            result = await worker(job)
            if job.cancelled:
                job.status = "cancelled"
            else:
                job.status = "completed"
                job.result = result if isinstance(result, dict) else {"value": result}
                job.progress = 1.0
        except JobCancelledError:
            job.status = "cancelled"
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error = str(exc)

    def delete(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)


job_manager = JobManager()
