from datetime import datetime, timezone
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiEnvelope(BaseModel, Generic[T]):
    success: bool
    message: str
    data: T | None
    timestamp: datetime


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def success_response(message: str, data: object) -> dict[str, object]:
    return {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": utc_now().isoformat(),
    }
