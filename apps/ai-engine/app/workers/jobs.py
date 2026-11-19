from __future__ import annotations

import asyncio
import time
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
    created_at: float = field(default_factory=time.time)
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def cancel(self) -> None:
        self._cancel_event.set()

    @property
    def cancelled(self) -> bool:
        return self._cancel_event.is_set()

    @property
    def cancel_event(self) -> asyncio.Event:
        return self._cancel_event

    def check_cancelled(self) -> None:
        if self._cancel_event.is_set():
            raise JobCancelledError(f"Job {self.job_id} was cancelled")


class JobManager:
    def __init__(self, max_jobs: int = 100, ttl_seconds: float = 3600.0, timeout_seconds: float = 3600.0) -> None:
        self._jobs: dict[str, Job] = {}
        self.max_jobs = max_jobs
        self.ttl_seconds = ttl_seconds
        self.timeout_seconds = timeout_seconds

    def _prune_expired(self) -> None:
        now = time.time()
        # Remove jobs older than TTL if completed or failed
        expired = [
            jid
            for jid, j in self._jobs.items()
            if j.status in ("completed", "failed", "cancelled") and (now - j.created_at) > self.ttl_seconds
        ]
        for jid in expired:
            self._jobs.pop(jid, None)

        # If still over max_jobs, remove oldest completed jobs
        if len(self._jobs) > self.max_jobs:
            completed = sorted(
                [j for j in self._jobs.values() if j.status in ("completed", "failed", "cancelled")],
                key=lambda j: j.created_at,
            )
            for j in completed[: len(self._jobs) - self.max_jobs]:
                self._jobs.pop(j.job_id, None)

    def create(self, job_type: str) -> Job:
        self._prune_expired()
        job = Job(job_id=str(uuid.uuid4()), job_type=job_type)
        self._jobs[job.job_id] = job
        return job

    def get(self, job_id: str) -> Job:
        job = self._jobs.get(job_id)
        if job is None:
            raise JobNotFoundError(f"Unknown job: {job_id}")
        return job

    def list(self) -> list[Job]:
        self._prune_expired()
        return list(self._jobs.values())

    async def run(self, job: Job, worker: Callable[[Job], Awaitable[Any]]) -> None:
        job.status = "running"
        try:
            result = await asyncio.wait_for(worker(job), timeout=self.timeout_seconds)
            if job.cancelled:
                job.status = "cancelled"
            else:
                job.status = "completed"
                job.result = result if isinstance(result, dict) else {"value": result}
                job.progress = 1.0
        except asyncio.TimeoutError:
            job.status = "timed_out"
            job.error = f"Job timed out after {self.timeout_seconds} seconds"
        except JobCancelledError:
            job.status = "cancelled"
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error = str(exc)

    def delete(self, job_id: str) -> None:
        self._jobs.pop(job_id, None)


job_manager = JobManager()
