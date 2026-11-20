# SmartFlow AI Frontend Setup

## Requirements

- Node.js and npm
- Windows PowerShell or VS Code terminal

## Install

```powershell
cd "D:\Digital project\apps\web"
npm install
```

## Environment

Copy `.env.example` to `.env` only when local overrides are needed:

```powershell
Copy-Item .env.example .env
```

Configure `VITE_API_URL` for the FastAPI server. Public Supabase variables may be added in the future. Never put service-role keys or passwords in frontend environment variables.

## Development

```powershell
npm run dev
```

## Production Build

```powershell
npm run build
npm run preview
```
