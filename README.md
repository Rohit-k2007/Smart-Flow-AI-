# SmartFlow AI

SmartFlow AI is a React + TypeScript + Vite frontend with a modular FastAPI backend foundation for an intelligent traffic management simulator.

The website includes a landing page, command-center dashboard, interactive frontend simulation demo, AI control overview, emergency event UI, Leaflet heatmap, traffic prediction and analytics charts, simulation history, settings, and authentication form previews.

The FastAPI backend provides health reporting, validated REST contracts, structured errors, restricted CORS, and an inactive WebSocket status foundation. SUMO simulation, real traffic data, AI decisions, database persistence, and authentication are not connected. Frontend sample metrics and simulation actions remain labeled as demo data; emergency submissions are process-local requests and do not apply priority.

## Run

```powershell
cd "D:\Digital project\apps\web"
npm install
npm run dev
```

## Build

```powershell
npm run build
npm run lint
```

## Backend

```powershell
cd "D:\Digital project\apps\api"
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
uvicorn app.main:app --reload
```

If `.env` already exists, keep it rather than replacing it with the example.

API docs: `http://localhost:8000/docs`. Backend tests:

```powershell
python -m compileall app
python -m pytest -v
```

See [backend setup](./docs/backend-setup.md), [API documentation](./docs/api-documentation.md),
[backend architecture](./docs/backend-architecture.md), and
[integration guide](./docs/integration-guide.md).
