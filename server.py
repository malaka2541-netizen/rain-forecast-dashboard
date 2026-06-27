import http.server
import json
import os
import socketserver
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_PORT = 8000
ENV_PATH = Path(__file__).with_name(".env")


def log_event(message: str) -> None:
    print(message, flush=True)


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


def is_supabase_logging_enabled() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))


def build_supabase_url(path: str) -> str:
    base_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    schema = os.getenv("SUPABASE_DB_SCHEMA", "public")
    separator = "&" if "?" in path else "?"
    return f"{base_url}{path}{separator}schema={urllib.parse.quote(schema)}"


def supabase_headers(prefer: str | None = None) -> dict[str, str]:
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    headers = {
        "Content-Type": "application/json",
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def supabase_request(path: str, payload: Any, prefer: str | None = None, timeout: int = 10) -> Any:
    payload_size = len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
    log_event(
        f"Supabase request starting: path={path}, prefer={prefer or '-'}, "
        f"payload_bytes={payload_size}"
    )
    request = urllib.request.Request(
        build_supabase_url(path),
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    for key, value in supabase_headers(prefer).items():
        request.add_header(key, value)

    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
        log_event(
            f"Supabase request completed: path={path}, status={response.status}, "
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
    rows = []

    for index, forecast_time in enumerate(times):
        forecast_dt = parse_iso_datetime(forecast_time)
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

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params, lat, lon = self.parse_lat_lon(parsed_url)

        openmeteo_paths = {"/api/openmeteo", "/api/forecast/openmeteo"}
        tmd_hourly_paths = {"/api/tmd", "/api/tmd/hourly", "/api/forecast/tmd/hourly"}
        tmd_daily_paths = {"/api/tmd/daily", "/api/forecast/tmd/daily"}
        tmd_warning_paths = {"/api/tmd/warning", "/api/forecast/tmd/warning"}
        tmd_daily_summary_paths = {"/api/tmd/daily-summary", "/api/forecast/tmd/daily-summary"}

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
