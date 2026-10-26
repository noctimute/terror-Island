# Import islands-2018-2026/ (research repo, commit ba6eb4a+) for the non-death islands that are finished:
# 毒駕 (incl. 酒駕, user's call 2026-10-24), 詐騙, 髒川, 標案. Existing site records are kept; rows whose
# links are already on the site only add their extra links there.
import csv, json, re, sys
from collections import defaultdict
sys.path.insert(0, sys.argv[1])
from build import sources, METHOD_WORDS, GRAPHIC, RES, SITE

FILES = {"毒駕島": ("drug.json", "d", ["X"]), "詐騙島": ("scam.json", "x", ["Z"]),
         "髒川島": ("river.json", "r", []), "標案島": ("bid.json", "b", ["M"])}
# checked by hand (2026-10-24): routine tenders, awards, PR and "scam stopped" stories are not incidents;
# one leak case reported three times is merged and its suspects' names dropped
DROP = set()  # research applies these rules itself since 30a33b9
TITLE = {}
MERGE = {}
def fix_by_hand(f, d):
    recs = {r["id"]: r for r in d["records"]}
    for a, b in MERGE.items():
        if a in recs and b in recs:
            recs[b]["sources"] += [s for s in recs[a]["sources"] if s["url"] not in {t["url"] for t in recs[b]["sources"]}]
            DROP.add(a)
    for k, t in TITLE.items():
        if k in recs:
            recs[k]["title"] = t
    if False:
        recs["b-i20260811a"]["summary"] = "前市府祕書涉嫌在標案公告前，先把企畫與規格洩漏給特定廠商；檢調搜索市府，相關人士交保。"
    if f == "bid.json" and "b-i20260818a" in recs:  # same as 購物島 s-hotpot (鍋烤節 1400 萬標案): add the report there
        shop = json.load(open(f"{SITE}/shop.json"))
        hot = next(r for r in shop["records"] if r["id"] == "s-hotpot")
        hot["sources"] += [s for s in recs["b-i20260818a"]["sources"] if s["url"] not in {t["url"] for t in hot["sources"]}]
        json.dump(shop, open(f"{SITE}/shop.json", "w"), ensure_ascii=False, indent=1)
        DROP.add("b-i20260818a")
    d["records"] = [r for r in d["records"] if r["id"] not in DROP]
seq, added, skipped = defaultdict(int), defaultdict(int), defaultdict(list)
for isl, (f, pre, fear) in FILES.items():
    d = json.load(open(f"{SITE}/{f}"))
    d["records"] = [r for r in d["records"] if "-i20" not in r["id"]]  # a previous run of this import is replaced whole
    url2rec = {s["url"]: r for r in d["records"] for s in r["sources"]}
    for x in csv.DictReader(open(f"{RES}/islands-2018-2026/{isl}.csv", encoding="utf-8-sig")):
        pairs = [l.rsplit("｜", 1) for l in x["新聞連結"].splitlines() if "｜" in l]
        head = {u.strip(): t.strip() for t, u in pairs if re.match(r"https?://[^/]+/.", u.strip())}  # drop bare home pages
        srcs = sources("\n".join(head))
        for s in srcs:
            if s["title"].endswith("報導") and head.get(s["url"]):
                s["title"] = head[s["url"]]
        if not srcs:
            skipped["no usable link"].append(x["標題"])
            continue
        hit = next((url2rec[s["url"]] for s in srcs if s["url"] in url2rec), None)
        if hit:
            hit["sources"] += [s for s in srcs if s["url"] not in {t["url"] for t in hit["sources"]}]
            skipped["already on site"].append(x["標題"])
            continue
        title = x["網站標題"].strip() or x["標題"].strip()
        if METHOD_WORDS.search(title) or GRAPHIC.search(title):
            skipped["screened title"].append(title)
            continue
        place = x["行政區"] or "台中"
        note = x["島備註"]
        summary = x["網站摘要"]
        if isl == "毒駕島":
            kind = "毒駕" if "毒駕" in note else "酒駕"
            summary = f"{place}發生{kind}事件" + ("，有人死亡。" if "有人死亡" in note else "。")
        seq[(pre, x["日期"])] += 1
        rid = f"{pre}-i{x['日期'].replace('-', '')}{'abcdefghijklmnopqrstuvwxyz'[seq[(pre, x['日期'])] - 1]}"
        rec = {"id": rid, "title": title, "date": x["日期"], "place": place, "summary": summary, "sources": srcs}
        fr = fear + (["D"] if "有人死亡" in note else [])
        if fr:
            rec["fear"] = fr
        d["records"].append(rec)
        for s in srcs:
            url2rec[s["url"]] = rec
        added[f] += 1
    fix_by_hand(f, d)
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    d["updated"] = "2026-10-24"
    if f == "drug.json":
        d["title"] = "台中毒駕、酒駕與毒品新聞"
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
    print(f, len(d["records"]), "+", added[f])
print({k: len(v) for k, v in skipped.items()})
