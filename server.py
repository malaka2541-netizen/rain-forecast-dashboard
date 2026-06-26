import http.server
import json
import os
import socketserver
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_PORT = 8000
ENV_PATH = Path(__file__).with_name(".env")


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
        print(f"Proxying Open-Meteo request to: {openmeteo_url}")

        try:
            response_body = self.fetch_json(openmeteo_url, timeout=20)
            self.respond_json(json.loads(response_body.decode("utf-8")))
            print("Open-Meteo request completed successfully.")
        except Exception as error:
            print(f"Error during Open-Meteo proxy request: {error}")
            self.respond_json({"error": str(error), "source": "openmeteo"}, status=500)

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

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        query_params, lat, lon = self.parse_lat_lon(parsed_url)

        openmeteo_paths = {"/api/openmeteo", "/api/forecast/openmeteo"}
        tmd_hourly_paths = {"/api/tmd", "/api/tmd/hourly", "/api/forecast/tmd/hourly"}
        tmd_daily_paths = {"/api/tmd/daily", "/api/forecast/tmd/daily"}

        if parsed_url.path == "/health":
            self.respond_json(
                {
                    "status": "ok",
                    "service": "rain-forecast-dashboard",
                    "tmd_configured": bool(os.getenv("TMD_API_TOKEN")),
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

        if parsed_url.path in tmd_hourly_paths:
            self.handle_tmd_forecast(lat, lon, "hourly", query_params)
            return

        if parsed_url.path in tmd_daily_paths:
            self.handle_tmd_forecast(lat, lon, "daily", query_params)
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
