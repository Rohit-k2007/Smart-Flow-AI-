# SmartFlow AI Backend Architecture

## Current scope

The backend is a modular FastAPI service. It provides API contracts, health
reporting, request validation, CORS, error envelopes, an inactive simulation
WebSocket foundation, and on-demand HERE Traffic API v7 routes. SUMO/TraCI and
trained AI remain unconfigured and are reported unavailable.

## Request flow

```text
React app -> FastAPI routers -> Pydantic schemas -> service layer
                                      |                  |
                                      +-> envelope       +-> explicit unavailable state
```

- `app/main.py` assembles the application and route modules.
- `app/core` owns settings, logging, CORS, and error handlers.
- `app/api` contains health, dashboard, simulation, traffic, AI, emergency,
  analytics, and report routes.
- `app/schemas` defines validated request and response data.
- `app/services` contains capability status and domain service boundaries.
  `here_traffic_service.py` makes bounded, on-demand HERE Traffic API v7
  requests, normalizes provider flow and incident fields, and retains original
  speed units. `neon_database.py` performs parameterized read-only queries
  against Neon PostgreSQL; `neon_traffic_store.py` reads verified Jaipur
  intersections and persists provider responses when the existing tables are
  available.
- `app/websocket` accepts UUID-formatted run IDs and reports the inactive
  simulation status; it does not stream fabricated updates.
- `app/simulation` and `app/ai` are reserved module boundaries.

Emergency requests are explicit user submissions held in process memory only.
They are neither detected vehicles nor persisted records, and do not apply
signal priority.

## Configuration and future work

`FRONTEND_URL` is a comma-separated allowlist of exact browser origins.
`APP_ENV` controls logging verbosity. `DATABASE_URL` and HERE credentials are
backend-only and are never sent to the browser or written to logs. Supabase
Auth and browser preferences remain a separate frontend integration; do not
put Neon credentials or server keys in Vite environment variables.

The main dashboard and heatmap use on-demand HERE responses. They do not synthesize
speed, jam factor, geometry, incidents, vehicle counts, or queues. The attached
`SmartFlow_AI_Traffic_Data.xlsx` identifies its traffic snapshot as synthetic;
it is displayed only as a separately labeled demo sample. Intersection records
are not inferred from HERE road segments.
