# Import the research rescan of the death-map period (deathmap/網站未收_2026-10重掃.csv, research 12bbc13):
# cases neither the death map nor the site had. Records get -r ids and are rebuilt whole on every run.
import csv, json, sys
from collections import defaultdict
sys.path.insert(0, sys.argv[1])
from build import sources, METHOD_WORDS, GRAPHIC, RES, SITE

FILES = {"墜落島": ("falls.json", "fall"), "漂浮島": ("floaters.json", "float"), "氣爆火災島": ("fire.json", "fire"),
         "公安災害島": ("safety.json", "s"), "無聲島": ("quiet.json", "q"), "兒少島": ("kids.json", "y")}
# 2024-09-18: two unrelated deaths in neighbouring 西屯 hotels, one row upstream; split into a fall and a quiet case
SPLIT = {"2024-09-18": [
    ("墜落島", "西屯旅館女子墜樓身亡", "西屯一家旅館一名女子住客墜樓身亡；同日鄰近另一家旅館也有住客陳屍，警方查兩案無關。", "https://news.ebc.net.tw/news/society/443391"),
    ("無聲島", "逢甲商圈日租套房 男性住客陳屍", "西屯逢甲商圈一處日租套房發現一名男性住客陳屍房內，警方調查死因。", "https://www.taisounds.com/news/content/96/148052")]}
# titles the screen flags (graphic or method words), rewritten
TITLE = {"西屯工業區情殺 男子持刀刺死移工": "西屯工業區情殺 男子持刀殺害移工",
         "清水男子遭凌虐送醫不治 7嫌落網": "清水男子遭多人施暴 送醫不治 7嫌落網",
         "大里金屬廠移工酒後刺死同鄉室友": "大里金屬廠移工酒後持刀殺害同鄉室友",
         "潭子石牌公園男子輕生 送醫不治": "潭子石牌公園男子送醫不治"}
SUMMARY = {"空軍一名上兵在清泉崗基地輕兵器射擊訓練時，步槍意外擊發，子彈貫穿臉部，送醫不治。": "空軍一名上兵在清泉崗基地輕兵器射擊訓練時，步槍意外擊發中彈，送醫不治。"}
files = {f: json.load(open(f"{SITE}/{f}")) for f, _ in FILES.values()}
for d in files.values():
    d["records"] = [r for r in d["records"] if "-r20" not in r["id"]]
used = {s["url"] for d in files.values() for r in d["records"] for s in r["sources"]}
seq, added = defaultdict(int), defaultdict(int)
def add(isle, date, place, title, summary, deaths, srcs):
    f, pre = FILES[isle]
    srcs = [s for s in srcs if s["url"] not in used]
    if not srcs:
        return
    used.update(s["url"] for s in srcs)
    if METHOD_WORDS.search(title) or GRAPHIC.search(title):
        raise SystemExit(f"title needs a rewrite: {title}")
    seq[(pre, date)] += 1
    rec = {"id": f"{pre}-r{date.replace('-', '')}{'abcdefghij'[seq[(pre, date)] - 1]}", "title": title, "date": date,
           "place": place or "台中", "summary": summary, "sources": srcs, "deaths": deaths}
    if f == "safety.json":
        rec["fear"] = ["D", "S"]
    files[f]["records"].append(rec)
    added[f] += 1
for x in csv.DictReader(open(f"{RES}/deathmap/網站未收_2026-10重掃.csv", encoding="utf-8-sig")):
    links = x["新聞連結（每行：標題｜網址）"]
    srcs = sources("\n".join(l.rsplit("｜", 1)[1].strip() for l in links.splitlines() if "｜" in l))
    head = {l.rsplit("｜", 1)[1].strip(): l.rsplit("｜", 1)[0].strip() for l in links.splitlines() if "｜" in l}
    for s in srcs:
        if s["title"].endswith("報導") and head.get(s["url"]):
            s["title"] = head[s["url"]]
    if x["日期"] in SPLIT:
        for isle, title, summary, url in SPLIT[x["日期"]]:
            add(isle, x["日期"], x["行政區"], title, summary, 1, [s for s in srcs if s["url"] == url])
        continue
    add(x["島"], x["日期"], x["行政區"], TITLE.get(x["網站標題"].strip(), x["網站標題"].strip()), SUMMARY.get(x["網站摘要"].strip(), x["網站摘要"].strip()), int(x["死亡人數"]), srcs)
for f, d in files.items():
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
print(dict(added))
