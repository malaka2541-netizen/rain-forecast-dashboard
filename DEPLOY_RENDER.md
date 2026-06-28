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
   - `SUPABASE_URL` = optional for backtest logging
   - `SUPABASE_SERVICE_ROLE_KEY` = optional for backtest logging
   - `SUPABASE_DB_SCHEMA` = optional, default `public`
   - `BACKTEST_FORECAST_LAT` = optional, default `13.7563`
   - `BACKTEST_FORECAST_LON` = optional, default `100.5018`
   - `BACKTEST_CRON_TOKEN` = recommended secret token for scheduled backtest triggers
   - `OBSERVATION_PROVINCES` = optional, comma-separated AWS provinces for actual-rain ingestion

6. Deploy the service.

## Automatic backtest updates

This blueprint now includes a Render **Cron Job**:

- `rain-forecast-backtest-hourly`
- schedule: every hour at minute `05`

What it does each run:

1. Collects a fresh Open-Meteo forecast snapshot
2. Collects TMD AWS actual-rain observations
3. Runs forecast-vs-observation verification
4. Updates the data used by `/api/backtest/summary`

Command used by the cron job:

- `python server.py run-backtest-cycle`

You can also run the steps manually:

- `python server.py collect-forecast`
- `python server.py collect-observations`
- `python server.py run-verification`
- `python server.py backtest-summary`

## Free alternative with GitHub Actions

If you do not want to pay for Render Cron Jobs yet, this repo also includes:

- `.github/workflows/backtest-hourly.yml`

It triggers the Render endpoint every hour at minute `07` using GitHub Actions.

Required GitHub repository secrets:

- `BACKTEST_TRIGGER_URL` = `https://rain-forecast-dashboard-0dub.onrender.com/api/backtest/run-cycle`
- `BACKTEST_CRON_TOKEN` = the same secret value you set in Render as `BACKTEST_CRON_TOKEN`

Recommended setup:

1. Add `BACKTEST_CRON_TOKEN` to Render Web Service environment variables.
2. Add `BACKTEST_TRIGGER_URL` and `BACKTEST_CRON_TOKEN` to GitHub repository secrets.
3. Push this repo to `main`.
4. Check the **Actions** tab in GitHub for hourly runs.

Notes:

- GitHub scheduled workflows are a good free option, but they are not as strict as paid cron infrastructure.
- The workflow can also be started manually with **Run workflow** from the GitHub Actions UI.

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
- `/api/backtest/collect-observations`
- `/api/backtest/run-cycle`
- `/api/backtest/summary`

If Supabase is configured, `/health` should also show `supabase_configured: true`.
