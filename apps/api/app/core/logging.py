import logging
import re

from app.core.config import settings


class CredentialRedactionFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        record.msg = re.sub(
            r"([?&]apiKey=)[^&\s\"']+",
            r"\1[REDACTED]",
            message,
            flags=re.IGNORECASE,
        )
        record.args = ()
        return True


def configure_logging() -> None:
    level = logging.DEBUG if settings.app_env == "development" else logging.INFO
    httpx_logger = logging.getLogger("httpx")
    httpx_logger.setLevel(logging.WARNING)
    httpx_logger.addFilter(CredentialRedactionFilter())
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
