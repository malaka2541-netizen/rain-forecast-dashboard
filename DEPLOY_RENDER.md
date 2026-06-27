# Deploy on Render

This project can be deployed as a Render Web Service.

## Before you start

- Push this project to a GitHub repository.
- Keep `.env` local only. Do not commit it.
- Add your TMD token in Render as `TMD_API_TOKEN`.
- Optional: add TMD public-feed credentials if you want to override the example keys used for warning feeds.

## Render setup

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Render should detect `render.yaml` automatically.
4. Set **Auto-Deploy** to `On Commit` so every push to branch `main` redeploys automatically.
5. In the service settings, add:

   - `TMD_API_TOKEN` = your real TMD API token
   - `TMD_WARNING_UID` = optional, defaults to `demo`
   - `TMD_WARNING_UKEY` = optional, defaults to `demokey`
   - `TMD_PUBLIC_UID` = optional, defaults to `api`
   - `TMD_PUBLIC_UKEY` = optional, defaults to `api12345`

6. Deploy the service.

## Daily workflow

- Edit code locally
- Commit and push to GitHub branch `main`
- Render rebuilds and deploys automatically

Note:
- Render auto-deploy works on `push` to the linked branch, not on unsaved local file edits.
- If you ever use **Deploy a specific commit**, Render can disable auto-deploy for that service until you turn it back on in Settings.

## Runtime details

- Start command: `python server.py`
- Health check: `/health`
- App serves both:

  - static frontend files
  - forecast proxy endpoints under `/api/forecast/*`

## Verify after deploy

Open these paths:

- `/`
- `/health`
- `/api/forecast/openmeteo?lat=13.7563&lon=100.5018`
- `/api/forecast/tmd/daily?lat=13.7563&lon=100.5018`
- `/api/forecast/tmd/warning`
- `/api/forecast/tmd/daily-summary`
