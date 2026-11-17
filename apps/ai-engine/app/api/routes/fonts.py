from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import verify_token
from app.engines.fonts import load_font_library, validate_font
from app.schemas.models import FontValidationRequest, FontValidationResponse

router = APIRouter(dependencies=[Depends(verify_token)])


@router.get("/fonts")
def list_fonts() -> dict:
    return {"fonts": load_font_library()}


@router.post("/fonts/validate", response_model=FontValidationResponse)
def validate_font_endpoint(request: FontValidationRequest) -> FontValidationResponse:
    from app.config import settings

    return validate_font(request, settings.max_upload_bytes)
