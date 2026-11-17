from __future__ import annotations

class YeneCutError(Exception):
    """Base error for YeneCut AI engine."""


class ValidationError(YeneCutError):
    pass


class EngineUnavailableError(YeneCutError):
    pass


class JobNotFoundError(YeneCutError):
    pass


class JobCancelledError(YeneCutError):
    pass


class ProcessingError(YeneCutError):
    pass


class SecurityError(YeneCutError):
    pass
