import urllib.request
import re
import ssl
import html as html_parser
import json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Fetch the list page
req = urllib.request.Request("https://www.tmd.go.th/warning-and-events/warning-storm", headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as response:
    html_content = response.read().decode('utf-8')
    
    pattern = r'<div class="link-list-title">\s*<a href="(/warning-and-events/warning-storm/[^"]+)">(.*?)</a>\s*</div>'
    match = re.search(pattern, html_content)
    
    if match:
        url_path = match.group(1)
        import urllib.parse
        inner_url = f"https://www.tmd.go.th{urllib.parse.quote(html_parser.unescape(url_path))}"
        title = html_parser.unescape(match.group(2).strip())
        
        pdf_url = ""
        full_description = ""
        try:
            inner_req = urllib.request.Request(inner_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(inner_req, context=ctx) as inner_res:
                inner_html = inner_res.read().decode('utf-8')
                
                pdf_pattern = r'<button[^>]*onclick="window\.open\(\'([^\']+)\'\)"[^>]*>.*?fa-file-pdf'
                pdf_match = re.search(pdf_pattern, inner_html, re.IGNORECASE)
                if pdf_match:
                    pdf_url = pdf_match.group(1)
                    if not pdf_url.startswith("http"):
                        pdf_url = f"https://www.tmd.go.th{pdf_url}"
                        
                content_pattern = r'<div class="ps-3">(.*?)</div>\s*</section>'
                content_match = re.search(content_pattern, inner_html, re.DOTALL | re.IGNORECASE)
                if content_match:
                    raw_text = re.sub(r'<[^>]+>', ' ', content_match.group(1))
                    raw_text = html_parser.unescape(raw_text)
                    full_description = re.sub(r'\s+', ' ', raw_text).strip()
        except Exception as e:
            print(e)
        
        if not full_description:
            desc_pattern = r'<div class="link-list-description">\s*<a[^>]*>(.*?)</a>'
            desc_match = re.search(desc_pattern, html_content[match.end():match.end()+2000])
            full_description = html_parser.unescape(desc_match.group(1).strip()) if desc_match else ""
            
        date_pattern = r'วันที่ข้อมูล: (.*?) \|'
        date_match = re.search(date_pattern, html_content[match.end():match.end()+2000])
        date_str = html_parser.unescape(date_match.group(1).strip()) if date_match else ""
        
        payload = {
            "Warning": {
                "TitleThai": title,
                "DescriptionThai": full_description,
                "AnnounceDate": date_str,
                "WebUrlThai": inner_url,
                "DocumentFile": pdf_url
            }
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
