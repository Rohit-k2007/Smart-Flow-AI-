# Backend Setup

## Requirements

- Python 3.11 or newer (verified in this workspace with Python 3.14.6)
- PowerShell on Windows

## Install and run

```powershell
cd "D:\Digital project\apps\api"
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

If `.env` already exists, keep it and add only the required unset values; do
not overwrite it with the example file.

The API listens at `http://localhost:8001`; OpenAPI docs are at `/docs`.
`GET /api/health` verifies the backend. `GET /api/integrations/here/status`
reports provider configuration separately. HERE connectivity is checked by
`GET /api/integrations/here/health`, `/flow`, `/incidents`, or
`/api/traffic/live`.

## Environment

- `FRONTEND_URL`: comma-separated allowed origins. For local Vite, use
  `http://localhost:5174,http://127.0.0.1:5174`.
- `APP_ENV`: `development` enables debug-level server logging; other values use
  info-level logging.
- `APP_VERSION`: API version string.
- `HERE_API_KEY`: HERE API key; backend only. Never use a `VITE_` prefix.
- `HERE_TRAFFIC_BASE_URL`, `HERE_CITY`, `HERE_LATITUDE`, `HERE_LONGITUDE`, and
  `HERE_RADIUS_METERS`: provider URL and pilot circle.
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: backend-only configuration for public
  read endpoints. Reads use the anon/publishable key and remain subject to RLS.
- `SUPABASE_SERVICE_ROLE_KEY`: backend-only credential for HERE provider-data
  persistence. It bypasses RLS and is not used by the public read endpoints.

The backend fetches HERE data on request; it does not run a background poller.
If HERE is unavailable, live endpoints return explicit provider errors or
degraded state instead of manufacturing observations. Provider data is
persisted only when Supabase server credentials are configured. Confirm HERE
data storage/retention rights for the deployment contract before enabling
persistence in production.

Apply database changes from the project root using the Supabase CLI:

```powershell
supabase db push
supabase test db
```

The included RLS test expects a local Supabase/PostgreSQL test environment.
No synthetic intersection records are seeded; the catalog stays empty until
verified Jaipur intersections are provided.

## Tests

```powershell
python -m compileall app
python -m pytest -v
```
