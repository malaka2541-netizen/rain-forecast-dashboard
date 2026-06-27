# Supabase Setup

This project is ready to log Open-Meteo forecast snapshots into Supabase for future backtesting.

## What gets stored

- `forecast_runs`
  One record per Open-Meteo request handled by `server.py`
- `forecast_hourly_points`
  One row per forecast hour inside that run
- `rain_observations`
  Reserved for actual rainfall observations later
- `verification_results`
  Reserved for backtest matching later

## 1. Create a Supabase project

1. Open [Supabase](https://supabase.com/)
2. Create a new project
3. Wait until the database is ready

## 2. Run the schema

1. Open the SQL Editor in Supabase
2. Paste the contents of [supabase_schema.sql](/C:/Users/Dell/Desktop/ตารางรายงานฝน/supabase_schema.sql:1)
3. Run the script

## 3. Collect the credentials

From `Project Settings -> API`, copy:

- `Project URL`
- `service_role` key

Important:
- Use the `service_role` key on the server only
- Do not place this key in frontend JavaScript

## 4. Configure Render

Add these environment variables to the Render web service:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_SCHEMA=public`

Keep the existing TMD variables as they are.

## 5. Verify logging

After deploy:

1. Open the app once so it requests `/api/forecast/openmeteo`
2. Open Supabase Table Editor
3. Check:
   - `forecast_runs`
   - `forecast_hourly_points`

If logging works:
- `forecast_runs` should receive 1 new row per forecast request
- `forecast_hourly_points` should receive the hourly forecast rows linked by `run_id`

## Notes

- Logging is optional and only activates when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present.
- If Supabase is unavailable, the web app still serves forecast data normally. Logging failures are printed in the server logs and do not block the response.
- Backtest metrics are not implemented yet. This setup only starts collecting forecast history so we can compare it with real rainfall later.
