# Supabase Setup

This project is ready to log forecast history, actual rain observations, and verification results into Supabase for backtesting.

## What gets stored

- `forecast_runs`
  One record per Open-Meteo request handled by `server.py`
- `forecast_hourly_points`
  One row per forecast hour inside that run
- `rain_observations`
  Stores actual rainfall observations collected from TMD AWS station feeds
- `verification_results`
  Stores forecast-vs-observation comparison results

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
- `BACKTEST_FORECAST_LAT=13.7563`
- `BACKTEST_FORECAST_LON=100.5018`

Keep the existing TMD variables as they are.

## Observation collection

The server can now collect actual hourly rainfall observations from the official TMD AWS province feed and store them in `rain_observations`.

Default provinces:

- Bangkok
- Samut Prakan
- Nonthaburi
- Pathum Thani
- Nakhon Pathom
- Samut Sakhon

You can override them in Render with:

- `OBSERVATION_PROVINCES=Bangkok,Samut Prakan,Nonthaburi,...`

Trigger a collection manually:

- `/api/backtest/collect-observations`

Or collect only one province:

- `/api/backtest/collect-observations?province=Bangkok`

## Verification and summary

Run verification manually:

- `/api/backtest/run-verification`

Run the full cycle manually:

- `/api/backtest/run-cycle`

Read the current summary:

- `/api/backtest/summary`

## Automatic hourly updates on Render

The Render blueprint now includes a cron job that runs:

- `python server.py run-backtest-cycle`

every hour at minute `05`.

That means the summary screen can grow automatically over time without someone having to open the dashboard first.

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
- `rain_observations` should receive TMD AWS observation rows
- `verification_results` should receive matched forecast-vs-observation rows

## Notes

- Logging is optional and only activates when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present.
- If Supabase is unavailable, the web app still serves forecast data normally. Logging failures are printed in the server logs and do not block the response.
- The backtest summary API reads from `verification_results`, so early numbers can still look unstable until more hourly runs accumulate.
