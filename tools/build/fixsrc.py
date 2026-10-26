import json, glob, sys, re
sys.path.insert(0, sys.argv[1])
from build import INDEX, DEAD_TITLE, clean_title, outlet
n_title = n_arch = 0
for f in glob.glob("/home/user/terror-Island/lumama/*.json"):
    d = json.load(open(f))
    if not isinstance(d, dict) or "records" not in d: continue
    ch = False
    for r in d["records"]:
        for s in r["sources"]:
            ix = INDEX.get(s["url"])
            if not ix: continue
            if ix.get("HTTP狀態") == "200" and s["title"].endswith("報導"):
                t = clean_title(ix.get("頁面標題", ""))
                if t: s["title"] = t; n_title += 1; ch = True
            if (ix.get("HTTP狀態") in ("404", "410") or DEAD_TITLE.search(ix.get("頁面標題") or "")) and ix.get("Wayback存檔") and "web.archive.org" not in s["url"]:
                s["url"] = ix["Wayback存檔"]; s["outlet"] = f"{s['outlet']}（原文已下架・網頁存檔）"; n_arch += 1; ch = True
    if ch: json.dump(d, open(f, "w"), ensure_ascii=False, indent=1)
print("titles", n_title, "archived", n_arch)
