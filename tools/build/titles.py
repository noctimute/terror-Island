# fetch <title>/og:title for every url in urls.txt -> titles.json (cached)
import json, re, sys, html, concurrent.futures as cf, subprocess, os
urls = [u.strip() for u in open(sys.argv[1]) if u.strip()]
out = sys.argv[2]
cache = json.load(open(out)) if os.path.exists(out) else {}
todo = [u for u in urls if u not in cache]
def get(u):
    try:
        b = subprocess.run(["curl", "-sL", "--max-time", "20", "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36", "-H", "Accept-Language: zh-TW", u], capture_output=True, timeout=30).stdout[:600000].decode("utf-8", "ignore")
    except Exception:
        return u, ""
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', b) or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title', b) or re.search(r"<title[^>]*>(.*?)</title>", b, re.S)
    return u, html.unescape(m.group(1)).strip() if m else ""
with cf.ThreadPoolExecutor(24) as ex:
    for i, (u, t) in enumerate(ex.map(get, todo)):
        cache[u] = t
        if i % 50 == 0:
            json.dump(cache, open(out, "w"), ensure_ascii=False)
json.dump(cache, open(out, "w"), ensure_ascii=False, indent=0)
print(len(cache), sum(1 for v in cache.values() if v))
