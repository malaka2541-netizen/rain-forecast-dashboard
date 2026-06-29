import urllib.request
import re

url = "https://weather.bangkok.go.th/radar/RadarAnimationNk.aspx"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
    images = re.findall(r'<img.*?src=[\'"](.*?)[\'"]', html)
    print("Images:", images)
except Exception as e:
    print("Error:", e)
