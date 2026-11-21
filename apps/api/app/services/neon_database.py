import logging
from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import urlsplit

import psycopg
from psycopg import Connection, sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = logging.getLogger(__name__)

READABLE_TABLES = frozenset({
    "junctions",
    "traffic_observations",
    "signal_config",
    "vehicle_types",
    "traffic_scenarios",
    "scenario_approaches",
    "intersections",
})


class NeonDatabaseError(RuntimeError):
    def __init__(self, message: str, *, category: str) -> None:
        super().__init__(message)
        self.category = category


class NeonDatabaseClient:
    def __init__(self) -> None:
        self._max_rows = 1000
        self._connect_timeout_seconds = 5

    @property
    def configured(self) -> bool:
        return bool(settings.database_url.strip())

    def _connection_info(self) -> str:
        database_url = settings.database_url.strip()
        if not database_url:
            raise NeonDatabaseError(
                "DATABASE_URL is not configured.",
                category="not_configured",
            )

        parsed = urlsplit(database_url)
        if (
            parsed.scheme not in {"postgres", "postgresql"}
            or not parsed.hostname
            or not parsed.hostname.lower().endswith(".neon.tech")
        ):
            raise NeonDatabaseError(
                "DATABASE_URL must be a Neon PostgreSQL connection URI.",
                category="invalid_configuration",
            )

        try:
            parameters = conninfo_to_dict(database_url)
            if parameters.get("sslmode") not in {"verify-ca", "verify-full"}:
                parameters["sslmode"] = "require"
            parameters["connect_timeout"] = str(self._connect_timeout_seconds)
            return make_conninfo(**parameters)
        except (psycopg.Error, ValueError):
            raise NeonDatabaseError(
                "DATABASE_URL is not a valid PostgreSQL connection URI.",
                category="invalid_configuration",
            ) from None

    @contextmanager
    def connection(
        self,
        *,
        read_only: bool = True,
    ) -> Iterator[Connection[dict[str, Any]]]:
        try:
            with psycopg.connect(
                self._connection_info(),
                row_factory=dict_row,
            ) as connection:
                if read_only:
                    connection.execute("SET TRANSACTION READ ONLY")
                yield connection
        except NeonDatabaseError:
            raise
        except psycopg.Error as exc:
            error = self._translate_error(exc)
            logger.warning("Neon PostgreSQL operation failed (%s).", error.category)
            raise error from None

    async def check_connection(self) -> bool:
        return await run_in_threadpool(self._check_connection)

    def _check_connection(self) -> bool:
        with self.connection(read_only=True) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 AS connected")
                row = cursor.fetchone()
        return bool(row and row["connected"] == 1)

    async def get_rows(self, table: str, *, limit: int = 1000) -> list[dict[str, Any]]:
        if table not in READABLE_TABLES:
            raise ValueError("The requested table is not allow-listed.")

        return await run_in_threadpool(
            self._get_rows,
            table,
            min(max(limit, 1), self._max_rows),
        )

    def _get_rows(self, table: str, limit: int) -> list[dict[str, Any]]:
        statement = sql.SQL("SELECT * FROM {} LIMIT %s").format(
            sql.Identifier("public", table)
        )
        return self._fetch_all(statement, (limit,))

    async def get_intersections(self, city: str) -> list[dict[str, Any]]:
        return await run_in_threadpool(self._get_intersections, city)

    def _get_intersections(self, city: str) -> list[dict[str, Any]]:
        return self._fetch_all(
            sql.SQL(
                "SELECT id, name, latitude, longitude, geometry "
                "FROM public.intersections "
                "WHERE city = %s ORDER BY name ASC LIMIT %s"
            ),
            (city, self._max_rows),
        )

    async def existing_tables(self, table_names: list[str]) -> set[str]:
        requested = set(table_names)
        if not requested.issubset(READABLE_TABLES):
            raise ValueError("The requested table list is not allow-listed.")

        return await run_in_threadpool(self._existing_tables, sorted(requested))

    def _existing_tables(self, table_names: list[str]) -> set[str]:
        with self.connection(read_only=True) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = %s AND table_name = ANY(%s)",
                    ("public", table_names),
                )
                rows = cursor.fetchall()
        return {row["table_name"] for row in rows}

    def _fetch_all(
        self,
        statement: sql.Composable,
        parameters: tuple[Any, ...],
    ) -> list[dict[str, Any]]:
        with self.connection(read_only=True) as connection:
            with connection.cursor() as cursor:
                cursor.execute(statement, parameters)
                return cursor.fetchall()

    @staticmethod
    def _translate_error(exc: psycopg.Error) -> NeonDatabaseError:
        sqlstate = exc.sqlstate
        if sqlstate == "42P01":
            return NeonDatabaseError(
                "The requested database table does not exist.",
                category="table_not_found",
            )
        if sqlstate == "42501":
            return NeonDatabaseError(
                "Neon PostgreSQL denied this database operation.",
                category="permission_denied",
            )
        if sqlstate and sqlstate.startswith("28"):
            return NeonDatabaseError(
                "Neon PostgreSQL authentication failed.",
                category="authentication_failed",
            )
        if not sqlstate or sqlstate.startswith("08"):
            return NeonDatabaseError(
                "Neon PostgreSQL connection failed.",
                category="connection_error",
            )
        return NeonDatabaseError(
            "Neon PostgreSQL query failed.",
            category="query_error",
        )


neon_database_client = NeonDatabaseClient()
