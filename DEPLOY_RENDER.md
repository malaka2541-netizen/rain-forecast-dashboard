# Deploy on Render

This project can be deployed as a Render Web Service.

## Before you start

- Push this project to a GitHub repository.
- Keep `.env` local only. Do not commit it.
- Add your TMD token in Render as `TMD_API_TOKEN`.

## Render setup

1. Create a new **Web Service** on Render.
2. Connect your GitHub repository.
3. Render should detect `render.yaml` automatically.
4. In the service settings, add:

   - `TMD_API_TOKEN` = your real TMD API token

5. Deploy the service.

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
