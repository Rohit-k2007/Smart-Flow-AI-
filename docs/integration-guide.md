# Frontend / Backend Integration

## Configure and start

1. Apply `supabase/migrations` using the Supabase CLI and run
   `supabase test db` in a local Supabase environment.
2. Configure backend values in `apps/api/.env`: `HERE_API_KEY`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `FRONTEND_URL` with port
   `5174`. Keep the service-role key server-only.
3. Configure `apps/web/.env.local` with
   `VITE_API_URL=http://localhost:8001`, `VITE_SUPABASE_URL`, and
   `VITE_SUPABASE_ANON_KEY`. The browser anonymous key is intended for public
   clients and is constrained by RLS.
4. Start FastAPI from `apps/api`, then Vite from `apps/web` with `npm run dev`.
5. `/api/health` reports backend health; `/api/integrations/here/status`
   reports provider configuration. Dashboard data is fetched on demand from
   `/api/traffic/live` and can be manually refreshed; there is no poller.

FastAPI allows only the configured `FRONTEND_URL` origins. Keep this value
aligned with the frontend's actual browser origin. Never place HERE or
Supabase service-role credentials in Vite environment variables.

## API client contract

`src/services/api.ts` validates and unwraps the shared
`success/message/data/timestamp` envelope into `ApiResult<T>`. Non-2xx
responses preserve the server's envelope message. Backend field names use
snake_case. Traffic, AI, and analytics responses carry an `available` flag,
`items`, and a reason; the UI must not display unavailable data as live data.

Live flow, incidents, speeds, jam factors, and road geometry must come from
HERE. This integration does not infer vehicle counts or queues. The supplied
`SmartFlow_AI_Traffic_Data.xlsx` labels its observations as synthetic/example
data and is shown only in a visibly marked demo panel.

Authenticated users save dashboard preferences to `user_preferences` through
Supabase Auth. RLS restricts profile and preference access by `auth.uid()`.
Public users can view the Jaipur live traffic endpoints without signing in.

Simulation commands currently return HTTP 503 because SUMO is not configured.
Emergency creation accepts user-submitted requests only and does not imply
vehicle detection, persisted history, or applied signal priority.

## WebSocket

Use `createSimulationSocket(runId)` from `src/services/websocket.ts` with a
UUID run ID. The server sends a single `simulation.status` event and no
periodic data until a simulation engine is implemented. Treat disconnect and
unavailable state as normal, visible service states; do not synthesize data.

## Phase 3 demos

Existing operational pages keep their labeled local sample data and
interactions. Those demo controls are intentionally independent of the actual
backend state displayed in the navigation. Do not relabel demo metrics as API
measurements.
