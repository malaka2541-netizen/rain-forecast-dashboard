import http.server
import json
import math
import os
import socketserver
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_PORT = 8000
ENV_PATH = Path(__file__).with_name(".env")
DEFAULT_OBSERVATION_PROVINCES = [
    "Bangkok",
    "Samut Prakan",
    "Nonthaburi",
    "Pathum Thani",
    "Nakhon Pathom",
    "Samut Sakhon",
]
BANGKOK_TIMEZONE = timezone(timedelta(hours=7))


def log_event(message: str) -> None:
    print(message, flush=True)


def sanitize_json_value(value: Any) -> Any:
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: sanitize_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitize_json_value(item) for item in value]
    return value


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def build_openmeteo_url(lat: str, lon: str) -> str:
    return (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=precipitation_probability,precipitation,weather_code,"
        "wind_speed_10m,wind_gusts_10m,cape,dewpoint_2m,surface_pressure"
        "&timezone=Asia%2FBangkok"
        "&forecast_days=10"
    )


def build_tmd_url(lat: str, lon: str, forecast_type: str) -> str:
    if forecast_type == "hourly":
        return (
            "https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at"
            f"?lat={lat}&lon={lon}&fields=tc,rh,rain,cond&duration=48"
        )

    return (
        "https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at"
        f"?lat={lat}&lon={lon}&fields=tc_max,tc_min,rain,cond&duration=10"
    )


def build_tmd_public_url(feed_type: str, uid: str, ukey: str) -> str:
    if feed_type == "warning":
        return (
            "https://data.tmd.go.th/api/WeatherWarningNews/v2/"
            f"?format=json&uid={urllib.parse.quote(uid)}&ukey={urllib.parse.quote(ukey)}"
        )

    return (
        "https://data.tmd.go.th/api/DailyForecast/v2/"
        f"?format=json&uid={urllib.parse.quote(uid)}&ukey={urllib.parse.quote(ukey)}"
    )


def build_tmd_aws_url(province: str) -> str:
    return (
        "https://www.tmd.go.th/api/weather/get-aws-weather-by-province"
        f"?province={urllib.parse.quote(province)}"
    )


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_iso_datetime(value: str) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_openmeteo_datetime(value: str, utc_offset_seconds: int | None = None) -> datetime | None:
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc)

    source_tz = timezone(timedelta(seconds=utc_offset_seconds or 0))
    return parsed.replace(tzinfo=source_tz).astimezone(timezone.utc)


def to_bangkok_hour_bucket(value: str | datetime | None) -> str | None:
    if value is None:
        return None

    parsed = value if isinstance(value, datetime) else parse_iso_datetime(value)
    if not parsed:
        return None

    local_dt = parsed.astimezone(BANGKOK_TIMEZONE).replace(
        minute=0,
        second=0,
        microsecond=0,
    )
    return local_dt.isoformat()


def parse_observation_provinces(raw_value: str | None) -> list[str]:
    if not raw_value:
        return DEFAULT_OBSERVATION_PROVINCES[:]
    provinces = [item.strip() for item in raw_value.split(",") if item.strip()]
    return provinces or DEFAULT_OBSERVATION_PROVINCES[:]


def is_supabase_logging_enabled() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def build_supabase_url(path: str) -> str:
    base_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    return f"{base_url}{path}"


def supabase_headers(prefer: str | None = None) -> dict[str, str]:
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    schema = os.getenv("SUPABASE_DB_SCHEMA", "public")
    headers = {
        "Content-Type": "application/json",
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept-Profile": schema,
        "Content-Profile": schema,
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def supabase_request(path: str, payload: Any, prefer: str | None = None, timeout: int = 10) -> Any:
    sanitized_payload = sanitize_json_value(payload)
    payload_json = json.dumps(sanitized_payload, ensure_ascii=False, allow_nan=False)
    payload_size = len(payload_json.encode("utf-8"))
    log_event(
        f"Supabase request starting: path={path}, prefer={prefer or '-'}, "
        f"payload_bytes={payload_size}"
    )
    request = urllib.request.Request(
        build_supabase_url(path),
        data=payload_json.encode("utf-8"),
        method="POST",
    )
    for key, value in supabase_headers(prefer).items():
        request.add_header(key, value)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            log_event(
                f"Supabase request completed: path={path}, status={response.status}, "
                f"body_bytes={len(raw.encode('utf-8')) if raw else 0}"
            )
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8", errors="replace")
        log_event(
            f"Supabase HTTP error: path={path}, status={error.code}, "
            f"reason={error.reason}, body={error_body}"
        )
        raise


def supabase_get(path: str, timeout: int = 10) -> Any:
    log_event(f"Supabase GET starting: path={path}")
    request = urllib.request.Request(build_supabase_url(path), method="GET")
    for key, value in supabase_headers().items():
        request.add_header(key, value)

    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
        log_event(
            f"Supabase GET completed: path={path}, status={response.status}, "
            f"body_bytes={len(raw.encode('utf-8')) if raw else 0}"
        )
        return json.loads(raw) if raw else None


def build_openmeteo_run_record(lat: str, lon: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "openmeteo",
        "requested_lat": float(lat),
        "requested_lon": float(lon),
        "requested_at": utc_now_iso(),
        "timezone": payload.get("timezone"),
        "generation_time_ms": payload.get("generationtime_ms"),
        "utc_offset_seconds": payload.get("utc_offset_seconds"),
        "raw_payload": payload,
    }


def build_openmeteo_hour_rows(run_id: int, payload: dict[str, Any]) -> list[dict[str, Any]]:
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    issued_at = parse_iso_datetime(utc_now_iso())
    utc_offset_seconds = payload.get("utc_offset_seconds")
    rows = []

    for index, forecast_time in enumerate(times):
        forecast_dt = parse_openmeteo_datetime(forecast_time, utc_offset_seconds)
        lead_hours = None
        if forecast_dt and issued_at:
            lead_hours = round((forecast_dt - issued_at).total_seconds() / 3600, 2)

        rows.append(
            {
                "run_id": run_id,
                "forecast_time": forecast_dt.isoformat() if forecast_dt else forecast_time,
                "lead_hours": lead_hours,
                "precipitation_probability": hourly.get("precipitation_probability", [None])[index],
                "precipitation_mm": hourly.get("precipitation", [None])[index],
                "weather_code": hourly.get("weather_code", [None])[index],
                "wind_speed_10m": hourly.get("wind_speed_10m", [None])[index],
                "wind_gusts_10m": hourly.get("wind_gusts_10m", [None])[index],
                "cape": hourly.get("cape", [None])[index],
                "dewpoint_2m": hourly.get("dewpoint_2m", [None])[index],
                "surface_pressure": hourly.get("surface_pressure", [None])[index],
            }
        )

    return rows


def fetch_tmd_aws_observations(province: str) -> list[dict[str, Any]]:
    aws_url = build_tmd_aws_url(province)
    log_event(f"Fetching TMD AWS observations for province={province}: {aws_url}")
    request = urllib.request.Request(aws_url)
    request.add_header("Accept", "application/json")
    request.add_header("User-Agent", "RainForecastDashboard/1.0")

    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))

    rows = payload.get("data") if isinstance(payload, dict) else payload
    return rows if isinstance(rows, list) else []


def build_observation_source_name() -> str:
    return "tmd-aws-1h"


def build_probability_bucket(probability: Any) -> str:
    if probability is None:
        return "unknown"

    try:
        value = float(probability)
    except (TypeError, ValueError):
        return "unknown"

    if value <= 30:
        return "low"
    if value <= 70:
        return "medium"
    return "high"


def build_rain_intensity_class(rainfall_mm: Any) -> str:
    if rainfall_mm is None:
        return "unknown"

    try:
        value = float(rainfall_mm)
    except (TypeError, ValueError):
        return "unknown"

    if value < 1.0:
        return "drizzle"
    if value < 2.5:
        return "light"
    if value < 10.0:
        return "moderate"
    if value < 25.0:
        return "heavy"
    if value < 50.0:
        return "very-heavy"
    return "extreme"


def did_rain_from_mm(rainfall_mm: Any) -> bool:
    try:
        return float(rainfall_mm or 0) >= 0.1
    except (TypeError, ValueError):
        return False


def haversine_km(lat1: Any, lon1: Any, lat2: Any, lon2: Any) -> float | None:
    try:
        lat1 = math.radians(float(lat1))
        lon1 = math.radians(float(lon1))
        lat2 = math.radians(float(lat2))
        lon2 = math.radians(float(lon2))
    except (TypeError, ValueError):
        return None

    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371.0 * c


def build_tmd_aws_observation_rows(province: str, stations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    source_name = build_observation_source_name()

    for station in stations:
        station_id = station.get("stationId")
        observed_time = parse_iso_datetime(station.get("dateTimeUtc7", ""))
        if not station_id or not observed_time:
            continue

        rows.append(
            {
                "station_code": str(station_id),
                "station_name": station.get("stationNameEn") or station.get("stationNameTh"),
                "province": station.get("provinceNameEn") or province,
                "district": None,
                "lat": station.get("stationLat"),
                "lon": station.get("stationLon"),
                "observed_time": observed_time.isoformat(),
                "rainfall_mm": station.get("precip1Hr"),
                "source": source_name,
                "raw_payload": station,
            }
        )

    return rows


def fetch_recent_forecast_runs(limit: int = 50) -> list[dict[str, Any]]:
    return supabase_get(
        f"/rest/v1/forecast_runs?select=id,requested_lat,requested_lon,requested_at"
        f"&order=requested_at.desc&limit={limit}",
        timeout=20,
    ) or []


def fetch_forecast_points_for_runs(
    run_ids: list[int], limit: int = 5000
) -> list[dict[str, Any]]:
    if not run_ids:
        return []

    run_filter = ",".join(str(run_id) for run_id in run_ids)
    return supabase_get(
        "/rest/v1/forecast_hourly_points"
        "?select=id,run_id,forecast_time,precipitation_probability,precipitation_mm"
        f"&run_id=in.({run_filter})"
        f"&order=forecast_time.asc&limit={limit}",
        timeout=20,
    ) or []


def fetch_recent_rain_observations(limit: int = 1000) -> list[dict[str, Any]]:
    return supabase_get(
        "/rest/v1/rain_observations"
        "?select=station_code,station_name,province,lat,lon,observed_time,rainfall_mm,source"
        f"&order=observed_time.desc&limit={limit}",
        timeout=20,
    ) or []


def group_observations_by_hour_bucket(
    observations: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for observation in observations:
        observed_time = to_bangkok_hour_bucket(observation.get("observed_time"))
        if not observed_time:
            continue
        grouped.setdefault(observed_time, []).append(observation)
    return grouped


def build_verification_rows() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    observations = fetch_recent_rain_observations()
    if not observations:
        return [], {"reason": "no_observations"}

    observed_times = [
        observation["observed_time"]
        for observation in observations
        if observation.get("observed_time")
    ]
    if not observed_times:
        return [], {"reason": "no_observation_times"}

    forecast_runs = fetch_recent_forecast_runs()
    run_lookup = {run["id"]: run for run in forecast_runs if run.get("id") is not None}
    forecast_points = fetch_forecast_points_for_runs(list(run_lookup.keys()))
    observations_by_time = group_observations_by_hour_bucket(observations)

    verification_rows: list[dict[str, Any]] = []
    matched_points = 0

    for forecast_point in forecast_points:
        forecast_time = to_bangkok_hour_bucket(forecast_point.get("forecast_time"))
        run = run_lookup.get(forecast_point.get("run_id"))
        station_candidates = observations_by_time.get(forecast_time, [])
        if not run or not station_candidates:
            continue

        best_match = None
        best_distance = None
        for candidate in station_candidates:
            distance_km = haversine_km(
                run.get("requested_lat"),
                run.get("requested_lon"),
                candidate.get("lat"),
                candidate.get("lon"),
            )
            if distance_km is None:
                continue
            if best_distance is None or distance_km < best_distance:
                best_distance = distance_km
                best_match = candidate

        if not best_match:
            continue

        observed_rainfall_mm = best_match.get("rainfall_mm")
        forecast_rainfall_mm = forecast_point.get("precipitation_mm")
        try:
            absolute_error_mm = abs(float(forecast_rainfall_mm or 0) - float(observed_rainfall_mm or 0))
        except (TypeError, ValueError):
            absolute_error_mm = None

        verification_rows.append(
            {
                "forecast_hour_id": forecast_point["id"],
                "station_code": best_match.get("station_code"),
                "observed_time": best_match.get("observed_time"),
                "observed_rainfall_mm": observed_rainfall_mm,
                "did_rain": did_rain_from_mm(observed_rainfall_mm),
                "rain_intensity_class": build_rain_intensity_class(observed_rainfall_mm),
                "probability_bucket": build_probability_bucket(
                    forecast_point.get("precipitation_probability")
                ),
                "absolute_error_mm": absolute_error_mm,
            }
        )
        matched_points += 1

    return verification_rows, {
        "observations_found": len(observations),
        "forecast_runs_found": len(forecast_runs),
        "forecast_points_considered": len(forecast_points),
        "matched_points": matched_points,
        "observed_start": min(observed_times),
        "observed_end": max(observed_times),
    }


def collect_tmd_aws_observations(provinces: list[str] | None = None) -> dict[str, Any]:
    if not is_supabase_logging_enabled():
        raise RuntimeError("Supabase logging is not configured.")

    target_provinces = provinces or parse_observation_provinces(
        os.getenv("OBSERVATION_PROVINCES")
    )
    all_rows: list[dict[str, Any]] = []
    province_stats: list[dict[str, Any]] = []

    for province in target_provinces:
        station_rows = fetch_tmd_aws_observations(province)
        observation_rows = build_tmd_aws_observation_rows(province, station_rows)
        province_stats.append(
            {
                "province": province,
                "stations_returned": len(station_rows),
                "rows_prepared": len(observation_rows),
            }
        )
        all_rows.extend(observation_rows)

    inserted_count = 0
    if all_rows:
        supabase_request(
            "/rest/v1/rain_observations?on_conflict=station_code,observed_time,source",
            all_rows,
            prefer="resolution=merge-duplicates,return=minimal",
            timeout=20,
        )
        inserted_count = len(all_rows)

    return {
        "success": True,
        "source": build_observation_source_name(),
        "provinces": target_provinces,
        "province_stats": province_stats,
        "rows_inserted": inserted_count,
    }


def run_backtest_verification() -> dict[str, Any]:
    if not is_supabase_logging_enabled():
        raise RuntimeError("Supabase logging is not configured.")

    verification_rows, stats = build_verification_rows()
    inserted_count = 0

    if verification_rows:
        supabase_request(
            "/rest/v1/verification_results?on_conflict=forecast_hour_id,station_code",
            verification_rows,
            prefer="resolution=merge-duplicates,return=minimal",
            timeout=20,
        )
        inserted_count = len(verification_rows)

    return {
        "success": True,
        "source": "forecast-vs-observation",
        "rows_inserted": inserted_count,
        "stats": stats,
    }


def log_openmeteo_snapshot(lat: str, lon: str, payload: dict[str, Any]) -> None:
    if not is_supabase_logging_enabled():
        log_event("Supabase logging skipped: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
        return

    try:
        hourly_count = len((payload.get("hourly") or {}).get("time") or [])
        log_event(
            f"Supabase logging start: source=openmeteo, lat={lat}, lon={lon}, "
            f"hourly_points={hourly_count}"
        )
        run_rows = supabase_request(
            "/rest/v1/forecast_runs",
            build_openmeteo_run_record(lat, lon, payload),
            prefer="return=representation",
        )
        if not run_rows:
            log_event("Supabase logging skipped: forecast_runs insert returned no row.")
            return

        run_id = run_rows[0]["id"]
        hour_rows = build_openmeteo_hour_rows(run_id, payload)
        if hour_rows:
            supabase_request(
                "/rest/v1/forecast_hourly_points",
                hour_rows,
                prefer="return=minimal",
                timeout=15,
            )
        log_event(
            f"Supabase logging completed for Open-Meteo run {run_id} "
            f"with {len(hour_rows)} hourly rows."
        )
    except Exception as error:
        log_event(f"Supabase logging failed: {type(error).__name__}: {error}")


class ForecastProxyHandler(http.server.SimpleHTTPRequestHandler):
    def respond_json(self, payload, status=200, extra_headers=None):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def fetch_json(self, url, headers=None, timeout=20):
        request = urllib.request.Request(url)
        request.add_header("Accept", "application/json")
        for key, value in (headers or {}).items():
            request.add_header(key, value)

        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()

    def parse_lat_lon(self, parsed_url):
        query_params = urllib.parse.parse_qs(parsed_url.query)
        lat = query_params.get("lat", [""])[0]
        lon = query_params.get("lon", [""])[0]
        return query_params, lat, lon

    def handle_openmeteo_forecast(self, lat, lon):
        openmeteo_url = build_openmeteo_url(lat, lon)
        log_event(f"Proxying Open-Meteo request to: {openmeteo_url}")

        try:
            response_body = self.fetch_json(openmeteo_url, timeout=20)
            payload = json.loads(response_body.decode("utf-8"))
            self.respond_json(payload)
            log_openmeteo_snapshot(lat, lon, payload)
            log_event("Open-Meteo request completed successfully.")
        except Exception as error:
            log_event(f"Error during Open-Meteo proxy request: {type(error).__name__}: {error}")
            self.respond_json({"error": str(error), "source": "openmeteo"}, status=500)

    def handle_geocode(self, lat, lon):
        nominatim_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&accept-language=th"
        log_event(f"Proxying Reverse Geocode request to: {nominatim_url}")

        try:
            req = urllib.request.Request(nominatim_url)
            req.add_header('User-Agent', 'RainForecastApp/1.0 (local@example.com)')
            req.add_header('Accept', 'application/json')
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = response.read()
                payload = json.loads(res_data.decode("utf-8"))
                self.respond_json(payload)
                log_event("Reverse Geocode request completed successfully.")
        except Exception as error:
            log_event(f"Error during Reverse Geocode request: {type(error).__name__}: {error}")
            self.respond_json({"error": str(error), "source": "nominatim"}, status=500)

    def handle_tmd_forecast(self, lat, lon, forecast_type, query_params):
        token = os.getenv("TMD_API_TOKEN") or query_params.get("token", [""])[0]
        if not token:
            self.respond_json(
                {
                    "error": "TMD API token is not configured on the server.",
                    "configured": False,
                    "source": f"tmd-{forecast_type}",
                },
                status=503,
            )
            return

        tmd_url = build_tmd_url(lat, lon, forecast_type)
        print(f"Proxying TMD {forecast_type} request to: {tmd_url}")

        try:
            response_body = self.fetch_json(
                tmd_url,
                headers={"Authorization": f"Bearer {token}"},
                timeout=20,
            )
            self.respond_json(json.loads(response_body.decode("utf-8")))
            print(f"TMD {forecast_type} request completed successfully.")
        except urllib.error.HTTPError as error:
            print(f"TMD {forecast_type} HTTP error: {error.code} {error.reason}")
            try:
                error_body = error.read().decode("utf-8")
                payload = json.loads(error_body)
            except Exception:
                payload = {"error": f"TMD API returned {error.code} {error.reason}"}

            payload["source"] = f"tmd-{forecast_type}"
            self.respond_json(payload, status=error.code)
        except Exception as error:
            print(f"Error during TMD {forecast_type} proxy request: {error}")
            self.respond_json({"error": str(error), "source": f"tmd-{forecast_type}"}, status=500)

    def handle_tmd_public_feed(self, feed_type, query_params):
        if feed_type == "warning":
            uid = os.getenv("TMD_WARNING_UID") or query_params.get("uid", ["demo"])[0]
            ukey = os.getenv("TMD_WARNING_UKEY") or query_params.get("ukey", ["demokey"])[0]
        else:
            uid = os.getenv("TMD_PUBLIC_UID") or query_params.get("uid", ["api"])[0]
            ukey = os.getenv("TMD_PUBLIC_UKEY") or query_params.get("ukey", ["api12345"])[0]

        public_url = build_tmd_public_url(feed_type, uid, ukey)
        print(f"Proxying TMD {feed_type} feed to: {public_url}")

        try:
            response_body = self.fetch_json(public_url, timeout=20)
            payload = json.loads(response_body.decode("utf-8"))
            payload["source"] = f"tmd-{feed_type}"
            self.respond_json(payload)
            print(f"TMD {feed_type} feed completed successfully.")
        except urllib.error.HTTPError as error:
            print(f"TMD {feed_type} feed HTTP error: {error.code} {error.reason}")
            try:
                error_body = error.read().decode("utf-8")
                payload = json.loads(error_body)
            except Exception:
                payload = {"error": f"TMD public feed returned {error.code} {error.reason}"}

            payload["source"] = f"tmd-{feed_type}"
            self.respond_json(payload, status=error.code)
        except Exception as error:
            print(f"Error during TMD {feed_type} feed request: {error}")
            self.respond_json({"error": str(error), "source": f"tmd-{feed_type}"}, status=500)

    def handle_collect_observations(self, query_params):
        provinces = []
        if "province" in query_params:
            provinces = [item for item in query_params.get("province", []) if item]

        try:
            payload = collect_tmd_aws_observations(provinces or None)
            self.respond_json(payload)
        except Exception as error:
            log_event(f"Error during observation collection: {type(error).__name__}: {error}")
            self.respond_json(
                {"error": str(error), "source": build_observation_source_name()},
                status=500,
            )

    def handle_run_verification(self):
        try:
            payload = run_backtest_verification()
            self.respond_json(payload)
        except Exception as error:
            log_event(f"Error during verification run: {type(error).__name__}: {error}")
            self.respond_json(
                {"error": str(error), "source": "forecast-vs-observation"},
                status=500,
            )

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params, lat, lon = self.parse_lat_lon(parsed_url)

        openmeteo_paths = {"/api/openmeteo", "/api/forecast/openmeteo"}
        tmd_hourly_paths = {"/api/tmd", "/api/tmd/hourly", "/api/forecast/tmd/hourly"}
        tmd_daily_paths = {"/api/tmd/daily", "/api/forecast/tmd/daily"}
        tmd_warning_paths = {"/api/tmd/warning", "/api/forecast/tmd/warning"}
        tmd_daily_summary_paths = {"/api/tmd/daily-summary", "/api/forecast/tmd/daily-summary"}
        collect_observation_paths = {
            "/api/backtest/collect-observations",
            "/api/forecast/backtest/collect-observations",
        }
        run_verification_paths = {
            "/api/backtest/run-verification",
            "/api/forecast/backtest/run-verification",
        }

        if parsed_url.path == "/health":
            self.respond_json(
                {
                    "status": "ok",
                    "service": "rain-forecast-dashboard",
                    "tmd_configured": bool(os.getenv("TMD_API_TOKEN")),
                    "supabase_configured": is_supabase_logging_enabled(),
                }
            )
            return

        if parsed_url.path in openmeteo_paths | tmd_hourly_paths | tmd_daily_paths:
            if not lat or not lon:
                self.respond_json({"error": "Missing parameters (lat, lon)"}, status=400)
                return

        if parsed_url.path in openmeteo_paths:
            self.handle_openmeteo_forecast(lat, lon)
            return

        if parsed_url.path == "/api/geocode":
            self.handle_geocode(lat, lon)
            return

        if parsed_url.path in tmd_hourly_paths:
            self.handle_tmd_forecast(lat, lon, "hourly", query_params)
            return

        if parsed_url.path in tmd_daily_paths:
            self.handle_tmd_forecast(lat, lon, "daily", query_params)
            return

        if parsed_url.path in tmd_warning_paths:
            self.handle_tmd_public_feed("warning", query_params)
            return

        if parsed_url.path in tmd_daily_summary_paths:
            self.handle_tmd_public_feed("daily-summary", query_params)
            return

        if parsed_url.path in collect_observation_paths:
            self.handle_collect_observations(query_params)
            return

        if parsed_url.path in run_verification_paths:
            self.handle_run_verification()
            return

        super().do_GET()


class ThreadingReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


load_env_file(ENV_PATH)
PORT = int(os.getenv("PORT", str(DEFAULT_PORT)))

print(f"Starting server with forecast proxy on port {PORT}...")
try:
    with ThreadingReusableTCPServer(("", PORT), ForecastProxyHandler) as httpd:
        print(f"Server successfully running at: http://localhost:{PORT}")
        print("Serving static files and routing /api/forecast/* endpoints")
        httpd.serve_forever()
except Exception as error:
    print(f"Failed to start server: {error}")
    sys.exit(1)
