import http.server
import hmac
import json
import math
import os
import time
import socketserver
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_PORT = 8000
ENV_PATH = Path(__file__).with_name(".env")
DEFAULT_FORECAST_LAT = "13.7563"
DEFAULT_FORECAST_LON = "100.5018"
DEFAULT_OBSERVATION_PROVINCES = [
    "Bangkok",
    "Samut Prakan",
    "Nonthaburi",
    "Pathum Thani",
    "Nakhon Pathom",
    "Samut Sakhon",
]
BANGKOK_TIMEZONE = timezone(timedelta(hours=7))
OPENMETEO_PROXY_CACHE: dict[str, dict[str, Any]] = {}


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


def execute_backtest_step(
    step_name: str,
    callback: Callable[[], dict[str, Any]],
) -> dict[str, Any]:
    try:
        result = callback()
        if isinstance(result, dict):
            result.setdefault("success", True)
            result.setdefault("source", step_name)
        return result
    except Exception as error:
        log_event(
            f"Backtest step failed ({step_name}): {type(error).__name__}: {error}"
        )
        return {
            "success": False,
            "source": step_name,
            "error": str(error),
            "error_type": type(error).__name__,
        }


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


def build_openweather_url(lat: str, lon: str) -> str | None:
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return None
    return (
        f"https://api.openweathermap.org/data/4.0/onecall/timeline/1h"
        f"?lat={lat}&lon={lon}&units=metric&appid={api_key}"
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


def get_backtest_target_lat_lon() -> tuple[str, str]:
    lat = (os.getenv("BACKTEST_FORECAST_LAT") or DEFAULT_FORECAST_LAT).strip()
    lon = (os.getenv("BACKTEST_FORECAST_LON") or DEFAULT_FORECAST_LON).strip()
    return lat, lon


def get_backtest_cron_token() -> str:
    return (os.getenv("BACKTEST_CRON_TOKEN") or "").strip()


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


def fetch_json_url(url: str, headers: dict[str, str] | None = None, timeout: int = 20) -> dict[str, Any]:
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/json")
    for key, value in (headers or {}).items():
        request.add_header(key, value)

    last_error: Exception | None = None
    attempts = 3
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as error:
            last_error = error
            if attempt >= attempts:
                break
            log_event(
                f"Retrying JSON fetch ({attempt}/{attempts}) after "
                f"{type(error).__name__}: {error}"
            )
            time.sleep(min(attempt, 3))

    if last_error is not None:
        raise last_error
    raise RuntimeError("Unknown JSON fetch error.")


def redact_query_params(url: str, keys: tuple[str, ...]) -> str:
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    for key in keys:
        if key in query:
            query[key] = ["***"]
    redacted_query = urllib.parse.urlencode(query, doseq=True)
    return urllib.parse.urlunparse(parsed._replace(query=redacted_query))


def openweather_timezone_name(payload: dict[str, Any]) -> str | None:
    for key in ("timezone", "tz", "timezone_name"):
        value = payload.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def openweather_timezone_offset(payload: dict[str, Any]) -> int:
    for key in ("timezone_offset", "tz_offset", "utc_offset_seconds"):
        value = payload.get(key)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return 0


def openweather_hourly_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ("hourly", "data", "list"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def openweather_next_url(payload: dict[str, Any], current_url: str) -> str | None:
    candidate = payload.get("next")
    if not candidate and isinstance(payload.get("links"), dict):
        candidate = payload["links"].get("next")
    if not candidate and isinstance(payload.get("pagination"), dict):
        candidate = payload["pagination"].get("next")
    if not isinstance(candidate, str) or not candidate:
        return None

    next_url = urllib.parse.urljoin(current_url, candidate)
    current_parts = urllib.parse.urlparse(current_url)
    next_parts = urllib.parse.urlparse(next_url)
    current_query = urllib.parse.parse_qs(current_parts.query, keep_blank_values=True)
    next_query = urllib.parse.parse_qs(next_parts.query, keep_blank_values=True)

    # OpenWeather pagination links may omit the original request options such as units/appid.
    for key, value in current_query.items():
        if key not in next_query:
            next_query[key] = value

    merged_query = urllib.parse.urlencode(next_query, doseq=True)
    return urllib.parse.urlunparse(next_parts._replace(query=merged_query))


def openweather_item_dt(item: dict[str, Any]) -> int | None:
    for key in ("dt", "timestamp"):
        value = item.get(key)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue

    for key in ("time", "forecast_time", "start"):
        value = item.get(key)
        if not isinstance(value, str) or not value:
            continue
        parsed = parse_iso_datetime(value)
        if parsed:
            return int(parsed.timestamp())
    return None


def openweather_precipitation_mm(item: dict[str, Any]) -> float | None:
    rain = item.get("rain")
    if isinstance(rain, dict):
        for key in ("1h", "total", "amount"):
            value = rain.get(key)
            if value is not None:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    pass
    elif rain is not None:
        try:
            return float(rain)
        except (TypeError, ValueError):
            pass

    precipitation = item.get("precipitation")
    if isinstance(precipitation, dict):
        for key in ("1h", "total", "amount"):
            value = precipitation.get(key)
            if value is not None:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    pass
    elif precipitation is not None:
        try:
            return float(precipitation)
        except (TypeError, ValueError):
            pass

    for key in ("rain_1h", "precipitation_mm"):
        value = item.get(key)
        if value is not None:
            try:
                return float(value)
            except (TypeError, ValueError):
                pass
    return None


def normalize_temperature_celsius(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None

    # Defensive normalization in case paginated OpenWeather links drop `units=metric`
    # and a temperature-like value returns in Kelvin.
    if numeric > 170:
        return round(numeric - 273.15, 2)
    return numeric


def normalize_openweather_item(item: dict[str, Any]) -> dict[str, Any] | None:
    dt_value = openweather_item_dt(item)
    if dt_value is None:
        return None

    pop_value = item.get("pop")
    if pop_value is None:
        pop_value = item.get("probability_of_precipitation")
    if pop_value is None:
        pop_value = item.get("precipitation_probability")

    pop = None
    if pop_value is not None:
        try:
            pop = float(pop_value)
        except (TypeError, ValueError):
            pop = None
    if pop is not None and pop > 1:
        pop = pop / 100.0

    weather = item.get("weather")
    if isinstance(weather, dict):
        weather = [weather]
    if not isinstance(weather, list):
        weather = []

    wind_speed = item.get("wind_speed")
    if wind_speed is None and isinstance(item.get("wind"), dict):
        wind_speed = item["wind"].get("speed")

    wind_gust = item.get("wind_gust")
    if wind_gust is None and isinstance(item.get("wind"), dict):
        wind_gust = item["wind"].get("gust")

    normalized = {
        "dt": dt_value,
        "pop": pop if pop is not None else 0.0,
        "rain": {"1h": openweather_precipitation_mm(item)},
        "weather": weather,
        "wind_speed": wind_speed,
        "wind_gust": wind_gust,
        "dew_point": normalize_temperature_celsius(item.get("dew_point")),
        "pressure": item.get("pressure") or item.get("surface_pressure"),
        "raw": item,
    }
    return normalized


def fetch_openweather_payload(lat: str, lon: str, timeout: int = 20, max_records: int = 192) -> dict[str, Any]:
    url = build_openweather_url(lat, lon)
    if not url:
        raise RuntimeError("OPENWEATHER_API_KEY is missing")

    pages_fetched = 0
    current_url = url
    merged_items: list[dict[str, Any]] = []
    timezone_name: str | None = None
    timezone_offset = 0
    lat_value: float | None = None
    lon_value: float | None = None

    while current_url and len(merged_items) < max_records:
        pages_fetched += 1
        payload = fetch_json_url(current_url, timeout=timeout)

        timezone_name = timezone_name or openweather_timezone_name(payload)
        timezone_offset = openweather_timezone_offset(payload) or timezone_offset

        if lat_value is None:
            try:
                lat_value = float(payload.get("lat"))
            except (TypeError, ValueError):
                lat_value = float(lat)
        if lon_value is None:
            try:
                lon_value = float(payload.get("lon"))
            except (TypeError, ValueError):
                lon_value = float(lon)

        for raw_item in openweather_hourly_items(payload):
            if not isinstance(raw_item, dict):
                continue
            normalized = normalize_openweather_item(raw_item)
            if normalized:
                merged_items.append(normalized)

        next_url = openweather_next_url(payload, current_url)
        if not next_url or next_url == current_url:
            break
        current_url = next_url

    deduped: dict[int, dict[str, Any]] = {}
    for item in merged_items:
        dt_value = item["dt"]
        if dt_value not in deduped:
            deduped[dt_value] = item

    hourly = [deduped[key] for key in sorted(deduped.keys())][:max_records]
    return {
        "lat": lat_value if lat_value is not None else float(lat),
        "lon": lon_value if lon_value is not None else float(lon),
        "timezone": timezone_name or "UTC",
        "timezone_offset": timezone_offset,
        "hourly": hourly,
        "meta": {
            "provider": "openweather",
            "api_version": "onecall-4.0",
            "endpoint": "timeline/1h",
            "pages_fetched": pages_fetched,
            "records_returned": len(hourly),
            "requested_at": utc_now_iso(),
            "source_url": redact_query_params(url, ("appid",)),
        },
    }


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


def build_openweather_run_record(lat: str, lon: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "source": "openweather",
        "requested_lat": float(lat),
        "requested_lon": float(lon),
        "requested_at": utc_now_iso(),
        "timezone": payload.get("timezone"),
        "generation_time_ms": None,
        "utc_offset_seconds": payload.get("timezone_offset"),
        "raw_payload": payload,
    }


def build_openweather_hour_rows(run_id: int, payload: dict[str, Any]) -> list[dict[str, Any]]:
    hourly = payload.get("hourly") or []
    issued_at = parse_iso_datetime(utc_now_iso())
    rows = []

    for item in hourly:
        dt_timestamp = item.get("dt")
        if not dt_timestamp:
            continue
        
        forecast_dt = datetime.fromtimestamp(dt_timestamp, timezone.utc)
        lead_hours = None
        if issued_at:
            lead_hours = round((forecast_dt - issued_at).total_seconds() / 3600, 2)

        pop = item.get("pop", 0)
        prob = pop * 100 if pop is not None else None

        rain_obj = item.get("rain") or {}
        rain_mm = rain_obj.get("1h")

        weather_arr = item.get("weather") or []
        weather_id = weather_arr[0].get("id") if weather_arr else None

        rows.append(
            {
                "run_id": run_id,
                "forecast_time": forecast_dt.isoformat(),
                "lead_hours": lead_hours,
                "precipitation_probability": prob,
                "precipitation_mm": rain_mm,
                "weather_code": weather_id,
                "wind_speed_10m": item.get("wind_speed"),
                "wind_gusts_10m": item.get("wind_gust"),
                "cape": None,
                "dewpoint_2m": item.get("dew_point"),
                "surface_pressure": item.get("pressure"),
            }
        )

    return rows


def fetch_recent_openmeteo_runs(limit: int = 20) -> list[dict[str, Any]]:
    return supabase_get(
        "/rest/v1/forecast_runs"
        "?select=id,source,requested_lat,requested_lon,requested_at,timezone,"
        "generation_time_ms,utc_offset_seconds,raw_payload"
        "&source=eq.openmeteo"
        f"&order=requested_at.desc&limit={limit}",
        timeout=20,
    ) or []


def pick_closest_forecast_run(
    runs: list[dict[str, Any]],
    target_lat: str,
    target_lon: str,
) -> tuple[dict[str, Any] | None, float | None]:
    if not runs:
        return None, None

    try:
        lat_value = float(target_lat)
        lon_value = float(target_lon)
    except (TypeError, ValueError):
        return runs[0], None

    best_run: dict[str, Any] | None = None
    best_distance: float | None = None

    for run in runs:
        try:
            run_lat = float(run.get("requested_lat"))
            run_lon = float(run.get("requested_lon"))
        except (TypeError, ValueError):
            continue

        distance = abs(run_lat - lat_value) + abs(run_lon - lon_value)
        if best_distance is None or distance < best_distance:
            best_run = run
            best_distance = distance

    return (best_run or runs[0]), best_distance


def fetch_latest_openmeteo_payload_from_supabase(
    lat: str,
    lon: str,
    limit: int = 20,
) -> dict[str, Any] | None:
    if not is_supabase_logging_enabled():
        return None

    runs = fetch_recent_openmeteo_runs(limit=limit)
    selected_run, distance = pick_closest_forecast_run(runs, lat, lon)
    if not selected_run:
        return None

    payload = selected_run.get("raw_payload")
    if not isinstance(payload, dict):
        return None

    hydrated_payload = json.loads(json.dumps(payload))
    existing_meta = hydrated_payload.get("_meta")
    meta = existing_meta if isinstance(existing_meta, dict) else {}
    hydrated_payload["_meta"] = {
        **meta,
        "fallback_source": "supabase-last-openmeteo-run",
        "supabase_run_id": selected_run.get("id"),
        "supabase_requested_at": selected_run.get("requested_at"),
        "supabase_distance_score": round(distance, 6) if distance is not None else None,
    }
    return hydrated_payload


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

    if value <= 40:
        return "low"
    if value <= 70:
        return "medium"
    if value <= 90:
        return "high"
    return "very-high"


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
        f"/rest/v1/forecast_runs?select=id,source,requested_lat,requested_lon,requested_at"
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
        "?select=id,run_id,forecast_time,lead_hours,precipitation_probability,precipitation_mm"
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


def fetch_verification_results(limit: int = 5000) -> list[dict[str, Any]]:
    return supabase_get(
        "/rest/v1/verification_results"
        "?select=station_code,observed_time,observed_rainfall_mm,did_rain,"
        "rain_intensity_class,probability_bucket,absolute_error_mm,forecast_source,lead_hours,created_at"
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
                "forecast_probability": forecast_point.get("precipitation_probability"),
                "matched_distance_km": round(best_distance, 2) if best_distance is not None else None,
                "absolute_error_mm": absolute_error_mm,
                "forecast_source": run.get("source"),
                "lead_hours": forecast_point.get("lead_hours"),
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
    province_errors: list[dict[str, Any]] = []

    for province in target_provinces:
        try:
            station_rows = fetch_tmd_aws_observations(province)
            observation_rows = build_tmd_aws_observation_rows(province, station_rows)
            province_stats.append(
                {
                    "province": province,
                    "stations_returned": len(station_rows),
                    "rows_prepared": len(observation_rows),
                    "success": True,
                }
            )
            all_rows.extend(observation_rows)
        except Exception as error:
            log_event(
                f"TMD AWS observation fetch failed for {province}: "
                f"{type(error).__name__}: {error}"
            )
            province_errors.append(
                {
                    "province": province,
                    "error": str(error),
                    "error_type": type(error).__name__,
                }
            )
            province_stats.append(
                {
                    "province": province,
                    "stations_returned": 0,
                    "rows_prepared": 0,
                    "success": False,
                }
            )

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
        "success": not province_errors or inserted_count > 0,
        "source": build_observation_source_name(),
        "provinces": target_provinces,
        "province_stats": province_stats,
        "errors": province_errors,
        "rows_inserted": inserted_count,
    }


def collect_openmeteo_forecast_snapshot(lat: str | None = None, lon: str | None = None) -> dict[str, Any]:
    target_lat = str(lat or get_backtest_target_lat_lon()[0])
    target_lon = str(lon or get_backtest_target_lat_lon()[1])
    openmeteo_url = build_openmeteo_url(target_lat, target_lon)
    log_event(f"Collecting Open-Meteo snapshot for backtest: {openmeteo_url}")
    payload = fetch_json_url(openmeteo_url, timeout=20)
    log_openmeteo_snapshot(target_lat, target_lon, payload)

    hourly_count = len((payload.get("hourly") or {}).get("time") or [])
    return {
        "success": True,
        "source": "openmeteo",
        "lat": float(target_lat),
        "lon": float(target_lon),
        "hourly_points": hourly_count,
        "timezone": payload.get("timezone"),
        "generated_at": utc_now_iso(),
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


def run_backtest_cycle(
    lat: str | None = None,
    lon: str | None = None,
    provinces: list[str] | None = None,
) -> dict[str, Any]:
    openmeteo_result = execute_backtest_step(
        "openmeteo",
        lambda: collect_openmeteo_forecast_snapshot(lat, lon),
    )
    openweather_result = execute_backtest_step(
        "openweather",
        lambda: collect_openweather_forecast_snapshot(lat, lon),
    )
    observation_result = execute_backtest_step(
        "observations",
        lambda: collect_tmd_aws_observations(provinces),
    )
    verification_result = execute_backtest_step(
        "verification",
        run_backtest_verification,
    )
    summary_result = execute_backtest_step(
        "summary",
        summarize_backtest_results,
    )
    step_results = {
        "forecast_openmeteo": openmeteo_result,
        "forecast_openweather": openweather_result,
        "observations": observation_result,
        "verification": verification_result,
        "summary": summary_result,
    }
    failed_steps = [
        step_name
        for step_name, result in step_results.items()
        if not result.get("success", False)
    ]

    return {
        "success": True,
        "partial_failure": bool(failed_steps),
        "failed_steps": failed_steps,
        "cycle": {
            "forecast_openmeteo": openmeteo_result,
            "forecast_openweather": openweather_result,
            "observations": observation_result,
            "verification": verification_result,
            "summary": summary_result.get("summary", {}),
            "confidence_flags": summary_result.get("confidence_flags", []),
            "step_results": step_results,
        },
    }


def build_lead_time_bucket(lead_hours: Any) -> str:
    if lead_hours is None:
        return "unknown"
    try:
        val = float(lead_hours)
    except (TypeError, ValueError):
        return "unknown"
    
    if val < 0:
        return "past"
    if val <= 6:
        return "0-6h"
    if val <= 12:
        return "6-12h"
    if val <= 24:
        return "12-24h"
    if val <= 48:
        return "24-48h"
    if val <= 72:
        return "48-72h"
    return "72h+"


def build_diurnal_bucket(observed_time: Any) -> str:
    """Classify observed_time into time-of-day buckets for diurnal analysis."""
    if not observed_time:
        return "unknown"
    try:
        from datetime import datetime, timezone, timedelta
        bkk = timezone(timedelta(hours=7))
        if isinstance(observed_time, str):
            dt = datetime.fromisoformat(observed_time.replace("Z", "+00:00"))
        else:
            dt = observed_time
        hour = dt.astimezone(bkk).hour
    except Exception:
        return "unknown"

    if 6 <= hour < 12:
        return "morning"
    if 12 <= hour < 18:
        return "afternoon"
    if 18 <= hour < 24:
        return "evening"
    return "night"

def average(values: list[float]) -> float | None:
    return round(sum(values) / len(values), 3) if values else None


def summarize_group(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total_checks = len(rows)
    rain_hits = sum(1 for row in rows if row.get("did_rain") is True)
    observed_mm_values = []
    error_values = []
    
    brier_sum = 0.0
    brier_count = 0
    hits = 0
    false_alarms = 0
    misses = 0
    correct_negatives = 0

    for row in rows:
        rainfall_mm = row.get("observed_rainfall_mm")
        abs_error = row.get("absolute_error_mm")
        did_rain = row.get("did_rain") is True

        try:
            if rainfall_mm is not None:
                observed_mm_values.append(float(rainfall_mm))
        except (TypeError, ValueError):
            pass
        try:
            if abs_error is not None:
                error_values.append(float(abs_error))
        except (TypeError, ValueError):
            pass

        # Use real forecast_probability if available, fall back to bucket midpoint
        prob_val = None
        raw_prob = row.get("forecast_probability")
        if raw_prob is not None:
            try:
                prob_val = float(raw_prob) / 100.0
            except (TypeError, ValueError):
                prob_val = None

        if prob_val is None:
            prob_bucket = row.get("probability_bucket")
            if prob_bucket == "very-high": prob_val = 0.95
            elif prob_bucket == "high": prob_val = 0.80
            elif prob_bucket == "medium": prob_val = 0.55
            elif prob_bucket == "low": prob_val = 0.20

        if prob_val is not None:
            actual_val = 1.0 if did_rain else 0.0
            brier_sum += (prob_val - actual_val) ** 2
            brier_count += 1
            
            predicted_rain = prob_val > 0.5
            if did_rain:
                if predicted_rain:
                    hits += 1
                else:
                    misses += 1
            else:
                if predicted_rain:
                    false_alarms += 1
                else:
                    correct_negatives += 1

    hit_rate = round((rain_hits / total_checks) * 100, 1) if total_checks else None
    brier_score = round(brier_sum / brier_count, 3) if brier_count > 0 else None
    
    actual_positives = hits + misses
    actual_negatives = correct_negatives + false_alarms
    miss_rate = round((misses / actual_positives) * 100, 1) if actual_positives > 0 else None
    false_alarm_rate = round((false_alarms / actual_negatives) * 100, 1) if actual_negatives > 0 else None

    # Brier Skill Score: compare against climatology (base rate)
    climatology_rate = rain_hits / total_checks if total_checks > 0 else 0
    brier_ref = climatology_rate * (1 - climatology_rate)
    brier_skill_score = None
    if brier_score is not None and brier_ref > 0:
        brier_skill_score = round(1 - (brier_score / brier_ref), 3)

    return {
        "total_checks": total_checks,
        "rain_hits": rain_hits,
        "actual_rain_rate_pct": hit_rate,
        "avg_observed_rain_mm": average(observed_mm_values),
        "avg_abs_error_mm": average(error_values),
        "brier_score": brier_score,
        "brier_skill_score": brier_skill_score,
        "miss_rate_pct": miss_rate,
        "false_alarm_rate_pct": false_alarm_rate,
        "hits": hits,
        "misses": misses,
        "false_alarms": false_alarms,
        "correct_negatives": correct_negatives,
    }


def summarize_backtest_results() -> dict[str, Any]:
    if not is_supabase_logging_enabled():
        raise RuntimeError("Supabase logging is not configured.")

    rows = fetch_verification_results()
    if not rows:
        return {
            "success": True,
            "summary": {
                "total_checks": 0,
                "message": "No verification results yet.",
            },
        }

    probability_groups: dict[str, list[dict[str, Any]]] = {}
    intensity_groups: dict[str, list[dict[str, Any]]] = {}
    source_groups: dict[str, list[dict[str, Any]]] = {}
    lead_time_groups: dict[str, list[dict[str, Any]]] = {}
    diurnal_groups: dict[str, list[dict[str, Any]]] = {}

    # Separate "past" (lead_hours < 0) from real forecast data
    forecast_rows = []
    for row in rows:
        lt_bucket = build_lead_time_bucket(row.get("lead_hours"))
        lead_time_groups.setdefault(lt_bucket, []).append(row)

        if lt_bucket == "past":
            continue  # exclude from main summary

        forecast_rows.append(row)
        probability_groups.setdefault(row.get("probability_bucket") or "unknown", []).append(row)
        intensity_groups.setdefault(row.get("rain_intensity_class") or "unknown", []).append(row)
        source_groups.setdefault(row.get("forecast_source") or "unknown", []).append(row)

        diurnal_bucket = build_diurnal_bucket(row.get("observed_time"))
        diurnal_groups.setdefault(diurnal_bucket, []).append(row)

    # Main summary uses only real forecast rows (not "past")
    summary = summarize_group(forecast_rows) if forecast_rows else summarize_group(rows)
    observed_times = [row["observed_time"] for row in rows if row.get("observed_time")]
    updated_times = [row["created_at"] for row in rows if row.get("created_at")]
    summary["observed_start"] = min(observed_times) if observed_times else None
    summary["observed_end"] = max(observed_times) if observed_times else None
    summary["latest_updated_at"] = max(updated_times) if updated_times else None
    summary["total_checks_all"] = len(rows)  # include past for reference

    probability_breakdown = {
        key: summarize_group(group_rows)
        for key, group_rows in sorted(probability_groups.items())
    }
    intensity_breakdown = {
        key: summarize_group(group_rows)
        for key, group_rows in sorted(intensity_groups.items())
    }
    source_breakdown = {
        key: summarize_group(group_rows)
        for key, group_rows in sorted(source_groups.items())
    }
    lead_time_breakdown = {
        key: summarize_group(group_rows)
        for key, group_rows in sorted(lead_time_groups.items())
    }
    diurnal_breakdown = {
        key: summarize_group(group_rows)
        for key, group_rows in sorted(diurnal_groups.items())
    }

    confidence_note = []
    total_checks = summary["total_checks"]
    if total_checks < 24:
        confidence_note.append("sample-small")
    if total_checks < 100:
        confidence_note.append("early-stage")

    return {
        "success": True,
        "summary": summary,
        "probability_breakdown": probability_breakdown,
        "rain_intensity_breakdown": intensity_breakdown,
        "source_breakdown": source_breakdown,
        "lead_time_breakdown": lead_time_breakdown,
        "diurnal_breakdown": diurnal_breakdown,
        "confidence_flags": confidence_note,
    }


def print_json(payload: Any) -> None:
    print(json.dumps(payload, ensure_ascii=False, indent=2), flush=True)


def run_cli_command(argv: list[str]) -> int:
    if not argv:
        return -1

    command = argv[0]
    lat, lon = get_backtest_target_lat_lon()
    provinces = parse_observation_provinces(os.getenv("OBSERVATION_PROVINCES"))

    try:
        if command == "collect-forecast":
            print_json(collect_openmeteo_forecast_snapshot(lat, lon))
            return 0
        if command == "collect-observations":
            print_json(collect_tmd_aws_observations(provinces))
            return 0
        if command == "run-verification":
            print_json(run_backtest_verification())
            return 0
        if command == "run-backtest-cycle":
            print_json(run_backtest_cycle(lat, lon, provinces))
            return 0
        if command == "backtest-summary":
            print_json(summarize_backtest_results())
            return 0

        print(
            "Unknown command. Use one of: collect-forecast, collect-observations, "
            "run-verification, run-backtest-cycle, backtest-summary",
            flush=True,
        )
        return 1
    except Exception as error:
        log_event(f"CLI command failed ({command}): {type(error).__name__}: {error}")
        return 1


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


def log_openweather_snapshot(lat: str, lon: str, payload: dict[str, Any]) -> None:
    if not is_supabase_logging_enabled():
        return

    try:
        hourly_count = len(payload.get("hourly") or [])
        log_event(
            f"Supabase logging start: source=openweather, lat={lat}, lon={lon}, "
            f"hourly_points={hourly_count}"
        )
        run_rows = supabase_request(
            "/rest/v1/forecast_runs",
            build_openweather_run_record(lat, lon, payload),
            prefer="return=representation",
        )
        if not run_rows:
            return

        run_id = run_rows[0]["id"]
        hour_rows = build_openweather_hour_rows(run_id, payload)
        if hour_rows:
            supabase_request(
                "/rest/v1/forecast_hourly_points",
                hour_rows,
                prefer="return=minimal",
                timeout=15,
            )
        log_event(
            f"Supabase logging completed for OpenWeather run {run_id} "
            f"with {len(hour_rows)} hourly rows."
        )
    except Exception as error:
        log_event(f"Supabase logging failed: {type(error).__name__}: {error}")


def collect_openweather_forecast_snapshot(lat: str | None = None, lon: str | None = None) -> dict[str, Any]:
    target_lat = str(lat or get_backtest_target_lat_lon()[0])
    target_lon = str(lon or get_backtest_target_lat_lon()[1])
    openweather_url = build_openweather_url(target_lat, target_lon)
    if not openweather_url:
        return {"success": False, "source": "openweather", "error": "OPENWEATHER_API_KEY is missing"}
    
    log_event(
        "Collecting OpenWeather snapshot for backtest: "
        f"{redact_query_params(openweather_url, ('appid',))}"
    )
    try:
        payload = fetch_openweather_payload(target_lat, target_lon, timeout=20)
        log_openweather_snapshot(target_lat, target_lon, payload)

        hourly_count = len(payload.get("hourly") or [])
        return {
            "success": True,
            "source": "openweather",
            "lat": float(target_lat),
            "lon": float(target_lon),
            "hourly_points": hourly_count,
            "timezone": payload.get("timezone"),
            "generated_at": utc_now_iso(),
        }
    except Exception as e:
        log_event(f"OpenWeather collect error: {e}")
        return {"success": False, "source": "openweather", "error": str(e)}


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

    def fetch_json(self, url, headers=None, timeout=20, attempts=3):
        request = urllib.request.Request(url)
        request.add_header("Accept", "application/json")
        for key, value in (headers or {}).items():
            request.add_header(key, value)

        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                with urllib.request.urlopen(request, timeout=timeout) as response:
                    return response.read()
            except Exception as error:
                last_error = error
                if attempt >= attempts:
                    break
                log_event(
                    f"Retrying proxy fetch ({attempt}/{attempts}) for {url} after "
                    f"{type(error).__name__}: {error}"
                )
                time.sleep(min(attempt, 3))

        if last_error is not None:
            raise last_error
        raise RuntimeError("Unknown proxy fetch error.")

    def parse_lat_lon(self, parsed_url):
        query_params = urllib.parse.parse_qs(parsed_url.query)
        lat = query_params.get("lat", [""])[0]
        lon = query_params.get("lon", [""])[0]
        return query_params, lat, lon

    def handle_openmeteo_forecast(self, lat, lon):
        openmeteo_url = build_openmeteo_url(lat, lon)
        cache_key = f"{lat},{lon}"
        log_event(f"Proxying Open-Meteo request to: {openmeteo_url}")

        try:
            response_body = self.fetch_json(openmeteo_url, timeout=20, attempts=3)
            payload = json.loads(response_body.decode("utf-8"))
            
            # Apply probability calibration (Shadow Mode) if OpenWeather is configured
            try:
                if build_openweather_url(lat, lon):
                    ow_payload = fetch_openweather_payload(lat, lon, timeout=15, max_records=72)
                    payload = self.apply_probability_calibration(payload, ow_payload)
            except Exception as e:
                log_event(f"Could not apply OpenWeather calibration: {e}")

            OPENMETEO_PROXY_CACHE[cache_key] = json.loads(json.dumps(payload))
            self.respond_json(payload)
            log_openmeteo_snapshot(lat, lon, payload)
            log_event("Open-Meteo request completed successfully.")
        except Exception as error:
            cached_payload = OPENMETEO_PROXY_CACHE.get(cache_key)
            if cached_payload:
                stale_payload = json.loads(json.dumps(cached_payload))
                stale_payload["_meta"] = {
                    **(stale_payload.get("_meta") or {}),
                    "stale": True,
                    "fallback_reason": str(error),
                    "served_at": utc_now_iso(),
                }
                log_event(
                    f"Serving cached Open-Meteo payload for {cache_key} after "
                    f"{type(error).__name__}: {error}"
                )
                self.respond_json(
                    stale_payload,
                    status=200,
                    extra_headers={"X-Forecast-Stale": "1"},
                )
                return
            supabase_payload = fetch_latest_openmeteo_payload_from_supabase(lat, lon)
            if supabase_payload:
                stale_payload = json.loads(json.dumps(supabase_payload))
                stale_payload["_meta"] = {
                    **(stale_payload.get("_meta") or {}),
                    "stale": True,
                    "fallback_reason": str(error),
                    "served_at": utc_now_iso(),
                }
                OPENMETEO_PROXY_CACHE[cache_key] = json.loads(json.dumps(stale_payload))
                log_event(
                    f"Serving Supabase fallback Open-Meteo payload for {cache_key} after "
                    f"{type(error).__name__}: {error}"
                )
                self.respond_json(
                    stale_payload,
                    status=200,
                    extra_headers={
                        "X-Forecast-Stale": "1",
                        "X-Forecast-Fallback": "supabase",
                    },
                )
                return
            log_event(f"Error during Open-Meteo proxy request: {type(error).__name__}: {error}")
            self.respond_json({"error": str(error), "source": "openmeteo"}, status=500)

    def apply_probability_calibration(self, om_payload, ow_payload):
        from datetime import datetime
        
        ow_hourly = ow_payload.get("hourly", [])
        timezone_offset = ow_payload.get("timezone_offset", 0)
        ow_prob_map = {}
        
        for item in ow_hourly:
            dt_unix = item.get("dt")
            if dt_unix is not None:
                # Convert UTC timestamp + offset to local string matching OM format
                local_dt = datetime.utcfromtimestamp(dt_unix + timezone_offset)
                dt_txt = local_dt.strftime("%Y-%m-%dT%H:00")
                ow_prob_map[dt_txt] = float(item.get("pop", 0))

        if "hourly" in om_payload and "time" in om_payload["hourly"] and "precipitation_probability" in om_payload["hourly"]:
            om_times = om_payload["hourly"]["time"]
            om_probs = om_payload["hourly"]["precipitation_probability"]
            adjusted_probs = []

            for i, time_str in enumerate(om_times):
                om_prob = om_probs[i] if om_probs[i] is not None else 0
                
                if time_str in ow_prob_map:
                    ow_prob = ow_prob_map[time_str] * 100
                    
                    if om_prob >= 30 and ow_prob < 30:
                        adj_prob = round(om_prob * 0.70)
                    elif om_prob < 30 and ow_prob >= 30:
                        adj_prob = min(round(om_prob + 15), 40)
                    else:
                        adj_prob = om_prob
                else:
                    adj_prob = om_prob

                adjusted_probs.append(adj_prob)
            
            om_payload["hourly"]["adjusted_precipitation_probability"] = adjusted_probs

        return om_payload

    def handle_openweather_forecast(self, lat, lon):
        openweather_url = build_openweather_url(lat, lon)
        if not openweather_url:
            self.respond_json(
                {
                    "error": "OpenWeather API key is not configured.",
                    "configured": False,
                    "source": "openweather",
                },
                status=503,
            )
            return

        log_event(
            "Proxying OpenWeather request to: "
            f"{redact_query_params(openweather_url, ('appid',))}"
        )
        try:
            payload = fetch_openweather_payload(lat, lon, timeout=20)
            self.respond_json(payload)
            log_openweather_snapshot(lat, lon, payload)
            log_event("OpenWeather request completed successfully.")
        except urllib.error.HTTPError as error:
            error_body = error.read().decode("utf-8")
            self.respond_json({"error": error_body, "source": "openweather"}, status=error.code)
        except Exception as error:
            log_event(f"Error during OpenWeather proxy request: {type(error).__name__}: {error}")
            self.respond_json({"error": str(error), "source": "openweather"}, status=500)

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

    def authorize_backtest_cron(self, query_params):
        expected_token = get_backtest_cron_token()
        if not expected_token:
            return True

        auth_header = self.headers.get("Authorization", "")
        provided_token = ""

        if auth_header.startswith("Bearer "):
            provided_token = auth_header[7:].strip()

        if not provided_token or not hmac.compare_digest(provided_token, expected_token):
            self.respond_json(
                {
                    "error": "Unauthorized",
                    "source": "backtest-cycle",
                    "message": "Missing or invalid bearer token.",
                },
                status=401,
            )
            return False

        return True

    def handle_run_backtest_cycle(self, query_params):
        lat = query_params.get("lat", [get_backtest_target_lat_lon()[0]])[0]
        lon = query_params.get("lon", [get_backtest_target_lat_lon()[1]])[0]
        provinces = [item for item in query_params.get("province", []) if item] or None

        try:
            payload = run_backtest_cycle(lat, lon, provinces)
            self.respond_json(payload)
        except Exception as error:
            log_event(f"Error during backtest cycle: {type(error).__name__}: {error}")
            self.respond_json(
                {"error": str(error), "source": "backtest-cycle"},
                status=500,
            )

    def handle_backtest_summary(self):
        try:
            payload = summarize_backtest_results()
            self.respond_json(payload)
        except Exception as error:
            log_event(f"Error during backtest summary: {type(error).__name__}: {error}")
            self.respond_json(
                {"error": str(error), "source": "forecast-vs-observation-summary"},
                status=500,
            )

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params, lat, lon = self.parse_lat_lon(parsed_url)

        openmeteo_paths = {"/api/openmeteo", "/api/forecast/openmeteo"}
        openweather_paths = {"/api/openweather", "/api/forecast/openweather"}
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
        run_backtest_cycle_paths = {
            "/api/backtest/run-cycle",
            "/api/forecast/backtest/run-cycle",
        }
        backtest_summary_paths = {
            "/api/backtest/summary",
            "/api/forecast/backtest/summary",
        }

        if parsed_url.path == "/health":
            self.respond_json(
                {
                    "status": "ok",
                    "service": "rain-forecast-dashboard",
                    "tmd_configured": bool(os.getenv("TMD_API_TOKEN")),
                    "openweather_configured": bool(os.getenv("OPENWEATHER_API_KEY")),
                    "supabase_configured": is_supabase_logging_enabled(),
                }
            )
            return

        if parsed_url.path in openmeteo_paths | openweather_paths | tmd_hourly_paths | tmd_daily_paths:
            if not lat or not lon:
                self.respond_json({"error": "Missing parameters (lat, lon)"}, status=400)
                return

        if parsed_url.path in openmeteo_paths:
            self.handle_openmeteo_forecast(lat, lon)
            return

        if parsed_url.path in openweather_paths:
            self.handle_openweather_forecast(lat, lon)
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

        if parsed_url.path in run_backtest_cycle_paths:
            self.respond_json(
                {
                    "error": "Method Not Allowed",
                    "source": "backtest-cycle",
                    "message": "Use POST with Authorization: Bearer <token>.",
                },
                status=405,
            )
            return

        if parsed_url.path in backtest_summary_paths:
            self.handle_backtest_summary()
            return

        super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        run_backtest_cycle_paths = {
            "/api/backtest/run-cycle",
            "/api/forecast/backtest/run-cycle",
        }

        if parsed_url.path in run_backtest_cycle_paths:
            if not self.authorize_backtest_cron(query_params):
                return
            self.handle_run_backtest_cycle(query_params)
            return

        self.respond_json(
            {
                "error": "Method Not Allowed",
                "message": "POST is not supported for this path.",
            },
            status=405,
        )


class ThreadingReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


load_env_file(ENV_PATH)
PORT = int(os.getenv("PORT", str(DEFAULT_PORT)))

if len(sys.argv) > 1:
    exit_code = run_cli_command(sys.argv[1:])
    if exit_code >= 0:
        sys.exit(exit_code)

print(f"Starting server with forecast proxy on port {PORT}...")
try:
    with ThreadingReusableTCPServer(("", PORT), ForecastProxyHandler) as httpd:
        print(f"Server successfully running at: http://localhost:{PORT}")
        print("Serving static files and routing /api/forecast/* endpoints")
        httpd.serve_forever()
except Exception as error:
    print(f"Failed to start server: {error}")
    sys.exit(1)
