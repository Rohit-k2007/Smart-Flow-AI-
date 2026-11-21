# SmartFlow AI API

Base URL: `http://localhost:8001`. REST routes are under `/api`; OpenAPI UI is
available at `/docs`.

## Response envelope

Successful REST responses use:

```json
{
  "success": true,
  "message": "API is healthy.",
  "data": {},
  "timestamp": "2026-01-01T12:00:00+00:00"
}
```

Errors use the same fields with `success: false`, a human-readable `message`,
and `data` containing validation details when applicable. HTTP status codes
remain meaningful (for example 422 validation, 404 missing report, 503
unconfigured simulation/AI control).

## Routes

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/health` | API health, name, and version |
| GET | `/api/database/health` | Executes `SELECT 1` against Neon PostgreSQL |
| GET | `/api/database/junctions`, `/traffic-observations`, `/signal-config`, `/vehicle-types`, `/traffic-scenarios`, `/scenario-approaches` | Read-only Neon table reads; errors distinguish missing tables and permission failures |
| GET | `/api/integrations/here/status` | HERE configuration and last known provider status; never returns the API key |
| GET | `/api/integrations/here/health` | Checks HERE flow connectivity independently from backend health |
| GET | `/api/integrations/here/flow` | Normalized HERE v7 flow segments, source units, geometry, and timestamps |
| GET | `/api/integrations/here/incidents` | Normalized HERE v7 incident information |
| GET | `/api/dashboard/summary` | Explicitly unavailable metrics until a simulator is connected |
| POST | `/api/simulation/start` | Validates scenario/controller; returns 503 while SUMO is absent |
| POST | `/api/simulation/pause`, `/resume`, `/stop`, `/reset` | 503 while simulation is unavailable |
| POST | `/api/simulation/scenario` | Validates scenario/controller; 503 while unavailable |
| GET | `/api/simulation/status`, `/metrics` | Inactive status and unavailable metrics |
| GET | `/api/traffic/live` | On-demand HERE flow and incidents, stale-data state, and persistence state |
| GET | `/api/traffic/intersections` | Verified Jaipur intersection catalog; empty until confirmed records are added |
| GET | `/api/traffic/metrics`, `/congestion` | Unavailable simulation-derived traffic data |
| GET | `/api/traffic/prediction` | Unavailable until a prediction model is configured |
| GET | `/api/ai/status`, `/decisions` | AI controller unavailable; no decisions fabricated |
| POST | `/api/ai/controller/mode` | Validates mode, then returns 503 until the controller exists |
| POST | `/api/traffic/emergency` | Records an explicit user submission in process memory only |
| GET | `/api/traffic/emergency`, `/history` | Lists process-local submissions; not live detection |
| GET | `/api/analytics/comparison`, `/performance` | Unavailable without completed simulation runs |
| GET | `/api/reports/{run_id}` | 404 when no completed run/report exists |

`/api/traffic/live` and HERE routes make provider requests only when called; no
background polling is configured. Speed values retain provider `m/s` fields and
include derived `km/h` display fields. Vehicle counts, queues, and named
intersections are not inferred from HERE road segments.

Simulation start accepts an optional JSON body:

```json
{
  "scenario": "normal",
  "controller_mode": "fixed_time",
  "config": { "name": "optional label", "seed": 12 }
}
```

Allowed scenarios are `normal`, `heavy`, and `emergency`. Controller modes are
`fixed_time` and `adaptive`. Unknown fields and out-of-range values are rejected.

Emergency submissions require `vehicle_type` (`ambulance` or `fire_engine`),
`intersection_id`, `direction` (`north`, `east`, `south`, or `west`), and
optional `priority` from 1 to 5. A successful response means only that the
request was accepted into this process's memory; `priority_applied` is false.

## WebSocket

Connect to `ws://localhost:8001/ws/simulation/{run_id}` with a UUID run ID.
Malformed IDs are closed with code 1008. A valid connection receives one
`simulation.status` event describing the inactive/unavailable simulation.
There are no fabricated periodic updates.
