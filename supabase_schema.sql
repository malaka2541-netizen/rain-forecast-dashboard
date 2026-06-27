create table if not exists public.forecast_runs (
  id bigint generated always as identity primary key,
  source text not null,
  requested_lat double precision not null,
  requested_lon double precision not null,
  requested_at timestamptz not null default now(),
  timezone text,
  generation_time_ms double precision,
  utc_offset_seconds integer,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists forecast_runs_source_requested_at_idx
  on public.forecast_runs (source, requested_at desc);

create index if not exists forecast_runs_location_idx
  on public.forecast_runs (requested_lat, requested_lon);

create table if not exists public.forecast_hourly_points (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.forecast_runs(id) on delete cascade,
  forecast_time timestamptz not null,
  lead_hours double precision,
  precipitation_probability double precision,
  precipitation_mm double precision,
  weather_code integer,
  wind_speed_10m double precision,
  wind_gusts_10m double precision,
  cape double precision,
  dewpoint_2m double precision,
  surface_pressure double precision,
  created_at timestamptz not null default now(),
  unique (run_id, forecast_time)
);

create index if not exists forecast_hourly_points_run_time_idx
  on public.forecast_hourly_points (run_id, forecast_time);

create index if not exists forecast_hourly_points_forecast_time_idx
  on public.forecast_hourly_points (forecast_time);

create table if not exists public.rain_observations (
  id bigint generated always as identity primary key,
  station_code text not null,
  station_name text,
  province text,
  district text,
  lat double precision,
  lon double precision,
  observed_time timestamptz not null,
  rainfall_mm double precision,
  source text not null,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (station_code, observed_time, source)
);

create index if not exists rain_observations_station_time_idx
  on public.rain_observations (station_code, observed_time);

create table if not exists public.verification_results (
  id bigint generated always as identity primary key,
  forecast_hour_id bigint not null references public.forecast_hourly_points(id) on delete cascade,
  station_code text,
  observed_time timestamptz not null,
  observed_rainfall_mm double precision,
  did_rain boolean,
  rain_intensity_class text,
  probability_bucket text,
  absolute_error_mm double precision,
  created_at timestamptz not null default now(),
  unique (forecast_hour_id, station_code)
);

create index if not exists verification_results_observed_time_idx
  on public.verification_results (observed_time);
