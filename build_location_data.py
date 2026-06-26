import urllib.request
import json
import os

print("Fetching province.json...")
prov_resp = urllib.request.urlopen('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/province.json')
prov_data = json.loads(prov_resp.read().decode('utf-8'))

print("Fetching district.json...")
dist_resp = urllib.request.urlopen('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/district.json')
dist_data = json.loads(dist_resp.read().decode('utf-8'))

# Create a mapping of province_id -> province_name
provinces = {}
for p in prov_data:
    provinces[p['id']] = p['name_th']

# Group districts by province_id
from collections import defaultdict
districts_by_prov = defaultdict(list)
for d in dist_data:
    prov_id = d['province_id']
    districts_by_prov[prov_id].append(d['name_th'])

# Build final output
output = []
for p_id, p_name in provinces.items():
    dists = sorted(districts_by_prov.get(p_id, []))
    output.append({
        "province": p_name,
        "districts": dists
    })

# Sort provinces by name
output.sort(key=lambda x: x['province'])

out_path = os.path.join(os.path.dirname(__file__), 'thailand_locations.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

print(f"Successfully wrote {out_path} with {len(output)} provinces.")
