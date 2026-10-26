# Imports pedestrian deaths from taichung-research pedestrians/ into safety.json.
# The site keeps only crashes by public transit (大眾運輸肇事＝是); rows the research side marks as
# already on the site only add their extra reports to that record.
import csv, json, re, sys
from urllib.parse import urlparse
SITE = "/home/user/terror-Island/lumama"
RES = "/home/user/taichung-research"
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = {"udn.com": "聯合新聞網", "ettoday.net": "ETtoday", "cna.com.tw": "中央社", "setn.com": "三立新聞網", "tvbs.com.tw": "TVBS新聞網", "ftvnews.com.tw": "民視新聞", "dailyview.tw": "DailyView", "ltn.com.tw": "自由時報", "chinatimes.com": "中時新聞網", "pts.org.tw": "公視新聞網", "nownews.com": "NOWnews", "storm.mg": "風傳媒", "newtalk.tw": "Newtalk新聞", "mirrormedia.mg": "鏡週刊", "yahoo.com": "Yahoo新聞"}
def outlet(u):
    h = urlparse(u).netloc
    return next((v for k, v in OUT.items() if h.endswith(k)), h)
def srcs(cell):
    out = []
    for line in cell.splitlines():
        if "｜" in line:
            t, u = line.rsplit("｜", 1)
            if u.startswith("http"):
                out.append({"title": t.strip(), "outlet": outlet(u.strip()), "url": u.strip()})
    return out
# site records the research table points at, and the hand-written text for new ones
SAME = {"2022-12-27 北區學士路": "s-bus-2022", "2024-09 中區中山路": "s-bus-2024"}
NEW = {
    "2024-02-14": dict(id="s-bus-2024b", title="公車專用道撞闖紅燈過馬路行人 送醫不治", date="2024-02-13", place="龍井",
        summary="龍井區台灣大道五段公車專用道，一名行人疑闖紅燈穿越台灣大道，直行的公車煞車不及撞上，行人送醫搶救後不治；警方調查肇事原因。"),
    "2026-09-18": dict(id="s-bus-2026", title="外籍旅客走斑馬線遭轉彎客運撞輾 不治", date="2026-09-16", place="台中",
        summary="一名來台旅遊的外籍婦人與家人走斑馬線過馬路，落在最後面時，緩慢轉彎的國光客運疑未停讓，將她撞倒輾過，送醫搶救兩天後不治。"),
}
p = f"{SITE}/safety.json"
d = json.load(open(p))
byid = {r["id"]: r for r in d["records"]}
rows = [x for x in csv.DictReader(open(f"{RES}/pedestrians/pedestrian_deaths_行人遭撞死亡.csv", encoding="utf-8-sig")) if x["大眾運輸肇事"] == "是"]
for x in rows:
    ss = srcs(x["新聞連結（每行：標題｜網址）"])
    rid = next((v for k, v in SAME.items() if k in x["對應網站資料"]), None) or NEW.get(x["日期"], {}).get("id")
    if not rid:
        print("NO TEXT YET, skipped:", x["日期"], x["標題"]); continue
    if rid not in byid:
        n = NEW[x["日期"]]
        r = {**n, "fear": ["S", "D"], "deaths": int(x["死亡人數"] or 1), "sources": []}
        d["records"].append(r); byid[rid] = r
    have = {s["url"] for s in byid[rid]["sources"]}
    add = [s for s in ss if s["url"] not in have]
    byid[rid]["sources"] += add
    print(rid, "+", len(add), "sources")
json.dump(d, open(p, "w"), ensure_ascii=False, indent=1); open(p, "a").write("\n")
