# Import the other 9 non-death islands of islands-2018-2026/ (research commit 470122a). Same approach as isl4.py:
# existing site records are kept, rows whose links are already on the site only add their extra links there.
import csv, json, re, sys
from collections import defaultdict
sys.path.insert(0, sys.argv[1])
from build import sources, METHOD_WORDS, GRAPHIC, RES, SITE

FILES = {"兒少島": ("kids.json", "y", ["Y"]), "空城島": ("empty.json", "e", []), "賣地島": ("land.json", "l", []),
         "垃圾山太空包": ("garbage.json", "g", None), "貪瀆島": ("graft.json", "k", ["K"]), "購物島": ("shop.json", "p", ["P"]),
         "食安島": ("food.json", "f", ["F"]), "廚餘湖": ("foodwaste.json", "w", None), "國安島": ("nat.json", "n", ["N"])}
CITY = re.compile(r"掩埋場|清潔隊|焚化|環保局|市府|公所|回收場|轉運站|堆置場|處理場|貯留")
TITLE = json.load(open(f"{sys.argv[1]}/isl9_titles.json")) if len(sys.argv) > 2 else {}
DROP = set(json.load(open(f"{sys.argv[1]}/isl9_drop.json"))) if len(sys.argv) > 2 else set()
FINAL = {"https://www.mirrormedia.mg/story/20211211soc003": "中市前議會祕書長陳健楷貪瀆判刑確定　近日發監執行",
         "https://www.ettoday.net/news/20251210/3081520.htm": "拿1成回扣是傳統？台中和平前區長林建堂索賄589萬還債 判6年半定讞",
         "https://www.ettoday.net/news/20211102/2114616.htm": "「家裡小孩欠電腦」台中消防小隊長蔡旺財收賄放水　判刑6年10月定讞"}
seq, added, skipped = defaultdict(int), defaultdict(int), defaultdict(list)
for isl, (f, pre, fear) in FILES.items():
    d = json.load(open(f"{SITE}/{f}"))
    d["records"] = [r for r in d["records"] if "-i20" not in r["id"]]
    url2rec = {s["url"]: r for r in d["records"] for s in r["sources"]}
    for x in csv.DictReader(open(f"{RES}/islands-2018-2026/{isl}.csv", encoding="utf-8-sig")):
        pairs = [l.rsplit("｜", 1) for l in x["新聞連結"].splitlines() if "｜" in l]
        head = {u.strip(): t.strip() for t, u in pairs if re.match(r"https?://[^/]+/.", u.strip())}
        srcs = sources("\n".join(head))
        for s in srcs:
            if s["title"].endswith("報導") and head.get(s["url"]):
                s["title"] = head[s["url"]]
        if not srcs:
            skipped["no usable link"].append(x["標題"]); continue
        hit = next((url2rec[s["url"]] for s in srcs if s["url"] in url2rec), None)
        if hit:
            hit["sources"] += [s for s in srcs if s["url"] not in {t["url"] for t in hit["sources"]}]
            skipped["already on site"].append(x["標題"]); continue
        title = x["網站標題"].strip() or x["標題"].strip()
        if METHOD_WORDS.search(title) or GRAPHIC.search(title):
            skipped["screened title"].append(title); continue
        seq[(pre, x["日期"])] += 1
        rid = f"{pre}-i{x['日期'].replace('-', '')}{'abcdefghijklmnopqrstuvwxyz'[seq[(pre, x['日期'])] - 1]}"
        if rid in DROP:
            skipped["dropped by hand"].append(title); continue
        title = TITLE.get(rid, title)
        # public officials whose conviction is final keep their full name (user's call, 2026-10-24)
        title = next((t for s in srcs if (t := FINAL.get(s["url"]))), title)
        rec = {"id": rid, "title": title, "date": x["日期"], "place": x["行政區"] or "台中", "summary": x["網站摘要"], "sources": srcs}
        fr = fear if fear is not None else (["C"] if CITY.search(x["標題"]) else ["I"])
        if fr:
            rec["fear"] = fr
        d["records"].append(rec)
        for s in srcs:
            url2rec[s["url"]] = rec
        added[f] += 1
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    d["updated"] = "2026-10-24"
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
    print(f, len(d["records"]), "+", added[f])
print({k: len(v) for k, v in skipped.items()})
