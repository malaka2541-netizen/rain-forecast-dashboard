import http.server
import socketserver
import urllib.request
import urllib.parse
import json
import sys

# Reconfigure stdout to use UTF-8
sys.stdout.reconfigure(encoding='utf-8')

PORT = 8000

class TmdProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # Check if the request is for the TMD proxy API
        is_hourly = (parsed_url.path == '/api/tmd/hourly') or (parsed_url.path == '/api/tmd')
        is_daily = (parsed_url.path == '/api/tmd/daily')
        is_openmeteo = (parsed_url.path == '/api/openmeteo')

        if is_hourly or is_daily:
            query_params = urllib.parse.parse_qs(parsed_url.query)
            lat = query_params.get('lat', [''])[0]
            lon = query_params.get('lon', [''])[0]
            token = query_params.get('token', [''])[0]
            
            if not lat or not lon or not token:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Missing parameters (lat, lon, token)"}).encode('utf-8'))
                return
                
            if is_hourly:
                tmd_url = f"https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at?lat={lat}&lon={lon}&fields=tc,rh,rain,cond&duration=48"
            else:
                tmd_url = f"https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at?lat={lat}&lon={lon}&fields=tc_max,tc_min,rain,cond&duration=10"
                
            print(f"Proxying TMD API request to: {tmd_url}")
            
            req = urllib.request.Request(tmd_url)
            req.add_header('Accept', 'application/json')
            req.add_header('Authorization', f'Bearer {token}')
            
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_data = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(res_data)
                    print("Proxy request completed successfully!")
            except urllib.error.HTTPError as e:
                print(f"HTTPError from TMD API: {e.code} - {e.reason}")
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                try:
                    error_body = e.read().decode('utf-8')
                    self.wfile.write(error_body.encode('utf-8'))
                except:
                    self.wfile.write(json.dumps({"error": f"TMD API returned HTTP error: {e.code} {e.reason}"}).encode('utf-8'))
            except Exception as e:
                print(f"Error during proxy request: {str(e)}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif is_openmeteo:
            # Proxy to Open-Meteo API (free, no API key required)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            lat = query_params.get('lat', [''])[0]
            lon = query_params.get('lon', [''])[0]

            if not lat or not lon:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Missing parameters (lat, lon)"}).encode('utf-8'))
                return

            # Request precipitation_probability, cape, dewpoint_2m, surface_pressure for 10 days
            openmeteo_url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&hourly=precipitation_probability,cape,dewpoint_2m,surface_pressure"
                f"&timezone=Asia%2FBangkok"
                f"&forecast_days=10"
            )

            print(f"Proxying Open-Meteo API request to: {openmeteo_url}")

            try:
                with urllib.request.urlopen(openmeteo_url, timeout=10) as response:
                    res_data = response.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                    self.end_headers()
                    self.wfile.write(res_data)
                    print("Open-Meteo proxy request completed successfully!")
            except Exception as e:
                print(f"Error during Open-Meteo proxy request: {str(e)}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        else:
            # Delegate to standard SimpleHTTPRequestHandler to serve static files
            super().do_GET()

# Set reuse address option to avoid port block on reload
class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

print(f"Starting server with TMD API Proxy on port {PORT}...")
try:
    with ReusableTCPServer(("", PORT), TmdProxyHandler) as httpd:
        print(f"Server successfully running at: http://localhost:{PORT}")
        print("Serving static files and routing /api/tmd -> data.tmd.go.th")
        httpd.serve_forever()
except Exception as e:
    print(f"Failed to start server: {e}")
    sys.exit(1)
