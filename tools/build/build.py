# Merge the research repo's death tables into falls/floaters/quiet records (existing records are kept as written).
import csv, json, os, re, sys
from urllib.parse import urlparse
RES = "/home/user/taichung-research"
SITE = "/home/user/terror-Island/lumama"
B = os.path.dirname(os.path.abspath(__file__))
titles = json.load(open(f"{B}/titles.json"))
# the research repo's screenshot index: real-browser page titles, HTTP status and Wayback copies
INDEX = {x["新聞連結"].strip(): x for x in csv.DictReader(open(f"{RES}/screenshots/index.csv", encoding="utf-8-sig"))}
DEAD_TITLE = re.compile(r"(找不到網頁|404|頁面不存在|網頁不存在|已下架)")
OUT = {"ltn.com.tw": "自由時報", "udn.com": "聯合新聞網", "tvbs.com.tw": "TVBS", "ettoday.net": "ETtoday", "setn.com": "三立新聞網", "chinatimes.com": "中時新聞網", "mirrormedia.mg": "鏡週刊", "mirrordaily.news": "鏡報", "nownews.com": "NOWnews", "ebc.net.tw": "東森新聞", "ctwant.com": "CTWANT", "pts.org.tw": "公視新聞網", "nextapple.com": "壹蘋新聞網", "cna.com.tw": "中央社", "newtalk.tw": "Newtalk 新聞", "today.line.me": "LINE TODAY（轉載）", "msn.com": "MSN（轉載）", "storm.mg": "風傳媒", "ftvnews.com.tw": "民視新聞", "ftnn.com.tw": "FTNN 新聞網", "news.pchome.com.tw": "PChome 新聞（轉載）", "ctinews.com": "中天新聞網", "new-reporter.com": "新新聞報", "life.tw": "Life 生活網", "knews.com.tw": "知新聞", "worldjournal.com": "世界日報", "cdns.com.tw": "中華日報", "thenewslens.com": "關鍵評論網", "n.yam.com": "蕃新聞（轉載）", "taisounds.com": "太報", "nexttv.com.tw": "壹電視", "upmedia.mg": "上報", "tcpttw.com": "台灣新聞雲報", "thehubnews.net": "下班經濟學", "cts.com.tw": "華視新聞", "taiwannews.com.tw": "台灣英文新聞", "owlting.com": "OwlNews", "pronews.tw": "Pronews", "mnews.tw": "鏡新聞", "taiwantimes.com.tw": "台灣時報", "sjtv.com.tw": "三節新聞", "ntdtv.com": "新唐人", "taiwanhot.net": "台灣好新聞", "ttv.com.tw": "台視新聞", "yahoo.com": "Yahoo 新聞", "youtube.com": "YouTube", "17news.net": "17 新聞", "videoland.com.tw": "緯來新聞", "enews.tw": "eNews", "yuanfengmedia.tw": "遠方新聞"}
SKIP = ("ltn.com.tw/news/society/breakingnews/5150400", "notion.", "spreaker.", "contentplatform", "basketballtop5", "marketersgo", "mombaby", "lai-media")
def outlet(u):
    h = urlparse(u).netloc
    for k, v in OUT.items():
        if h.endswith(k):
            return v
    return h.replace("www.", "")
SUFFIX = re.compile(r"\s*[|｜\-–—_]\s*(社會|地方|生活|新聞|即時|焦點|要聞|中部|台中|LINE TODAY|Yahoo|ETtoday|TVBS|三立|聯合|自由|中時|鏡|NOWnews|東森|CTWANT|公視|壹蘋|中央社|Newtalk|MSN|風傳媒|民視|FTNN|PChome|中天|知新聞|世界日報|關鍵評論|上報|華視|台視|蕃新聞|太報).*$")
def clean_title(t):
    t = re.sub(r"\s+", " ", t or "").strip()
    for _ in range(3):
        t = SUFFIX.sub("", t).strip()
    if len(t) < 6 or re.search(r"(404|Not Found|找不到|Just a moment|Access Denied|Attention Required|網頁不存在|頁面不存在|Error|禁止訪問|Yahoo奇摩新聞$|^Yahoo|LINE TODAY$|首頁|Forbidden|403|502|Bad Gateway|Service Unavailable)", t, re.I):
        return ""
    return t
def sources(links):
    out, seen, dead = [], set(), []
    for u in re.split(r"\s+", links or ""):
        u = u.strip()
        if not u.startswith("http") or u in seen or any(s in u for s in SKIP):
            continue
        seen.add(u)
        o = outlet(u)
        ix = INDEX.get(u, {})
        t = clean_title(ix.get("頁面標題", "")) if ix.get("HTTP狀態") == "200" else ""
        t = t or clean_title(titles.get(u, ""))
        gone = ix.get("HTTP狀態") in ("404", "410") or DEAD_TITLE.search(ix.get("頁面標題", "") or "")
        if gone:
            if ix.get("Wayback存檔"):
                out.append({"title": t or f"{o}報導（原文已下架）", "outlet": f"{o}（原文已下架・網頁存檔）", "url": ix["Wayback存檔"]})
            else:
                dead.append({"title": t or f"{o}報導（原文已下架）", "outlet": f"{o}（原文已下架）", "url": u})
            continue
        out.append({"title": t or f"{o}報導", "outlet": o, "url": u})
    # a taken-down link with no archive copy is only kept when it is the record's only source
    return out or dead
DIST = ["中區", "東區", "南區", "西區", "北區", "西屯", "南屯", "北屯", "豐原", "東勢", "大甲", "清水", "沙鹿", "梧棲", "后里", "神岡", "潭子", "大雅", "新社", "石岡", "外埔", "大安", "烏日", "大肚", "龍井", "霧峰", "太平", "大里", "和平"]
def district(*texts):
    for t in texts:
        t = t or ""
        for d in DIST:
            if d in t:
                return d
    return ""
SELF = ("上吊", "燒炭", "自宅燒炭", "車上燒炭", "藥物", "自焚")
KILL = ("殺死", "刀傷", "砍死", "打死", "虐死")
METHOD_WORDS = re.compile(r"(上吊|自縊|吊掛|掛樹|吊|燒炭|木炭|炭盆|割腕|服藥|農藥|自焚|跳樓|輕生|遺書|懸空|懸吊|勒斃|勒死|喝藥|吞藥|安眠藥)")
GRAPHIC = re.compile(r"(臟器|血泊|血跡|血肉|頭顱|顱骨|屍首|變形|腦漿|慘死|爆頭|斷頭|屍臭|白骨|肛門|赤裸|全裸|腫脹|焦屍|頭破|破洞|斷氣|活活|凌虐|虐死|刺死|砍死|裝箱|屍斑)")
def spot(loc):
    if not loc or loc in ("住宅", "住家"):
        return "一處住宅"
    if loc in ("路邊", "橋下", "水溝", "河邊", "田邊", "河堤", "河床", "水池"):
        return loc
    if loc in ("學校", "公園", "飯店", "工地", "停車場", "醫院", "大樓", "旅館", "汽車旅館", "KTV", "超商", "店家", "酒店", "招待所", "政府機關", "衛生所", "電影院"):
        return "一處" + loc if loc not in ("學校",) else "一所學校"
    return loc
def g(sex):
    return {"男": "一名男子", "女": "一名女子"}.get(sex, "一人")
def summary(cat, cause, loc, sex, dist, text=""):
    where = f"{dist}{spot(loc)}" if dist and not (loc or "").startswith(dist) else spot(loc)
    who = g(sex)
    if cat == "fall":
        return f"{where}發生墜樓事件，{who}身亡。"
    if cat == "float":
        return f"{where}發現{who}的遺體，報請檢警相驗。"
    if cause in SELF:
        return f"{where}發現{who}身亡，警方初步排除外力介入。"
    if cause in KILL:
        return f"{where}發生命案，{who}遇害身亡，警方偵辦中。"
    if cause in ("死在車上",):
        return f"{where}的車內發現{who}身亡，死因待查。"
    if cause in ("火燒車", "焦屍", "火燒"):
        return f"{where}發生火燒事件，{who}身亡。"
    if cause in ("火車撞擊",):
        return f"{where}{who}遭火車撞擊身亡。"
    if cause in ("壓死", "被車夾死", "撞死", "摔死", "墜落"):
        return f"{where}發生意外，{who}身亡。"
    if cause in ("溺死",):
        return f"{where}{who}溺水身亡。"
    if cause in ("病死",):
        return f"{where}{who}疑因病身亡。"
    return f"{where}發現{who}身亡，死因待查。"
def name(srcs, date, dist, label):
    for s in srcs:
        t = s["title"]
        if not t.endswith(("報導", "報導（原文已下架）")) and not METHOD_WORDS.search(t):
            return t
    m, d = date[5:7], date[8:10]
    return f"{int(m)}/{int(d)} {dist or '台中'}{label}" if m and d else f"{dist or '台中'}{label}"

def main():
    dm = {x["編號"]: x for x in csv.DictReader(open(f"{RES}/deathmap/deathmap_all_全部462筆.csv", encoding="utf-8-sig"))}
    lst = {x["序"]: x for x in csv.DictReader(open(f"{RES}/death-lists/death_list_entries.csv", encoding="utf-8-sig"))}
    rows = list(csv.DictReader(open(f"{RES}/death-lists/all_deaths_合併總表.csv", encoding="utf-8-sig")))
    FILES = {"fall": ("falls.json", "fall"), "float": ("floaters.json", "float"), "q": ("quiet.json", "q")}
    CAT = {"墜樓": "fall", "浮屍／溺水": "float", "其他": "q"}
    LABEL = {"fall": "墜樓事件", "float": "發現遺體", "q": "死亡事件"}
    existing = {k: json.load(open(f"{SITE}/{f}")) for k, (f, _) in FILES.items()}
    have = {r["id"] for d in existing.values() for r in d["records"]}
    used = {}
    for d in existing.values():
        for r in d["records"]:
            for s_ in r["sources"]:
                used.setdefault(s_["url"], set()).add(r["date"])
    added = {k: [] for k in FILES}
    for x in rows:
        if not x["新聞連結"].strip():
            continue
        cat = CAT[x["類別"]]
        ids = x["編號"].split("／")
        lid = next((i.split("#")[1] for i in ids if i.startswith("列表")), None)
        did = next((i.split("#")[1] for i in ids if i.startswith("死亡地圖")), None)
        rid = f"{FILES[cat][1]}-{lid}" if lid else f"{FILES[cat][1]}-dm{did}"
        if did in ("309", "55"):  # same case as dm310 / list #106
            continue
        if rid in have or any(f"{p}-{lid}" in have for p in ("fall", "float", "q")) and lid:
            continue
        d = dm.get(did) if did else None
        dist = district(x["行政區"], d and d["行政區"], x["內容"])
        cause = d["死因（網站分類）"] if d else ""
        loc = d["地點"] if d else ""
        sex = d["性別"] if d else ""
        if not d:
            # list-only entry: take the spot from the list text ("5/27 筏子溪 墜橋") and the sex from the verified summary
            raw = lst.get(lid, {}).get("列表原文", x["內容"])
            loc = re.sub(r"^\s*\d+/\d+\s*", "", raw).split(" ")[0] if raw else ""
            loc = re.sub(r"(墜樓|浮屍|陳屍|猝死|墜橋).*", "", loc).strip()
            if loc == dist or not loc:
                loc = ""
            summ = lst.get(lid, {}).get("新聞摘要（含警方/檢方說法）", "")
            sex = "女" if re.search(r"(女|婦|嬤)", summ[:60]) and not re.search(r"(男|翁)", summ[:60]) else ("男" if re.search(r"(男|翁)", summ[:60]) else "")
            if cat == "q":
                cause = "自殺類" if METHOD_WORDS.search(summ + raw) else ("墜落" if "墜橋" in raw else "")
                if cause == "自殺類":
                    cause = "上吊"
        srcs = sources(x["新聞連結"])
        if not srcs or all(x["日期"] in used.get(s_["url"], ()) for s_ in srcs):
            continue
        for s_ in srcs:
            used.setdefault(s_["url"], set()).add(x["日期"])
        if cat == "q" and cause in ("不明", "") and sum(bool(re.search(r"墜(樓|落|下)|\d+樓墜|頂樓", s_["title"])) for s_ in srcs) * 2 > len(srcs):
            cat = "fall"
            rid = rid.replace("q-", "fall-", 1)
        rec = {"id": rid, "title": name(srcs, x["日期"], dist, LABEL[cat]), "date": x["日期"], "place": dist or "台中", "summary": summary(cat, cause, loc, sex, dist), "sources": srcs}
        added[cat].append(rec)
    for k, (f, _) in FILES.items():
        d = existing[k]
        recs = d["records"] + added[k]
        recs.sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
        d["records"] = recs
        d["note"] = "整理自 Threads 上流傳的「台中死亡列表」與網路新聞"
        d["updated"] = "2026-10-22"
        json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
        print(f, len(d["records"]), "+", len(added[k]))

if __name__ == "__main__":
    main()
