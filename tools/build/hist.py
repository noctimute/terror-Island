# Import the research repo's 2018-12～2024-03 death timeline (history-2018-2024) into the island record files.
# Draft data, so: keep only clear death reports, drop follow-ups, merge leftovers of the same event,
# and never show a method / graphic headline or a name in our own summary.
import csv, json, re, sys
from datetime import date
from collections import defaultdict
sys.path.insert(0, sys.argv[1])
from build import sources, district, METHOD_WORDS, GRAPHIC, RES, SITE

ROWS = list(csv.DictReader(open(f"{RES}/history-2018-2024/events_2018-2024.csv", encoding="utf-8-sig")))
# 2026-10-23 revision: links come as "標題｜網址" lines and rows carry an in-term flag
LINK_TITLE = {}
if ROWS and "新聞連結（每行：標題｜網址）" in ROWS[0]:
    for x in ROWS:
        pairs = [l.rsplit("｜", 1) for l in x["新聞連結（每行：標題｜網址）"].splitlines() if "｜" in l]
        for t, u in pairs:
            LINK_TITLE[u.strip()] = t.strip()
        x["新聞連結"] = "\n".join(u.strip() for _, u in pairs)
        x["其他報導標題"] = "\n".join(t.strip() for t, _ in pairs[1:])
    ROWS = [x for x in ROWS if x["盧秀燕任內"] == "是"]
START = "2018-12-25"  # 盧秀燕 took office; the research repo keeps the rest of 2018-12 only as a baseline

STRONG = re.compile(r"(死|亡|不治|罹難|遺體|屍|喪命|喪生|命喪|葬身|奪命|奪\d+命|斃|命案|殞|無生命跡象|OHCA|噩耗|槍殺|殺害|殺妻|殺夫|悶殺|弒|白骨|往生|救不回)")
WEAK = re.compile(r"(輕生|跳樓|墜樓|墜落|燒炭|溺|滅頂|埋|殺|火警|大火)")
SURVIVE = re.compile(r"(救回|獲救|救她|救他|救起|搶救中|撿回一命|無大礙|重傷|命大|倖存)")
HARD = re.compile(r"(捐贈|求償|敗訴|勝訴|國賠|房價|週年|追思|紀念|保險金|喪葬費|判決|判刑|判處|宣判|求刑|起訴|定讞|上訴|二審|三審|更審|無罪|和解|調解|演習|演練|宣導|不忘|凶宅|兇宅|歇業|撿屍|獲賠)")
KILL = re.compile(r"(殺|砍|刺|槍|虐|毆|打死|勒斃|勒死|勒頸|悶死|兇|命案|棄屍|分屍|謀|嫌犯|落網|凶手|行兇)")
CHILD = re.compile(r"(嬰|幼童|女童|男童|童|幼兒|寶寶|(?<!\d)[1-9]歲)")
YOUTH = re.compile(r"(國中|國小|高中|高職|學生|少年|少女|大學生|大生|國三|高一|高二|高三)")

# on top of build.py's GRAPHIC: gore that keeps turning up in these older headlines
GORE = re.compile(r"(頭爆|臉爛|碳化|頭骨|割喉|剁|焚屍|封屍|灌桶|桶屍|分屍|裹屍|破頭|血流|多刀|數刀|刀傷|輾|夾死|悶死|活埋|撕票|爆頭|塞洗衣機|吃下肚)")

CATS = {  # research category -> (file, id prefix, label used when no headline can be shown)
    "墜樓": ("falls.json", "fall", "墜樓事件"),
    "浮屍／溺水": ("floaters.json", "float", "發現遺體"),
    "火災致死": ("fire.json", "fire", "火災"),
    "工安意外": ("safety.json", "s", "工安意外"),
    "工安／意外事故": ("safety.json", "s", "意外事故"),
    "命案": ("quiet.json", "q", "命案"),
    "燒炭": ("quiet.json", "q", "死亡事件"),
    "上吊": ("quiet.json", "q", "死亡事件"),
    "陳屍／死因不明": ("quiet.json", "q", "死亡事件"),
    "猝死／疑病故": ("quiet.json", "q", "死亡事件"),
    "輕生（方式未明）": ("quiet.json", "q", "死亡事件"),
}

def deaths(text):
    # death counts named in headlines: "6死", "6人亡", "6人枉死", "奪6命", "3屍"
    return {int(n) for n in re.findall(r"(\d+)\s*(?:人|名|位|口|工人|工)?\s*(?:死|亡|枉死|罹難|喪生|命|屍)", text) + re.findall(r"奪(\d+)命", text) + ["2"] * bool(re.search(r"雙(亡|屍|死)", text)) if 1 < int(n) < 100}

def who(text):
    n = max(deaths(text), default=0)
    if n:
        return f" {n} 人", True
    # who it was comes from the lead headline only; merged follow-ups mention other people
    head = text[:40]
    if CHILD.search(head):
        return "一名幼童", False
    if YOUTH.search(head):
        return "一名學生", False
    # gender only when the headline names nobody else (妻、母、兄… are often relatives)
    f_ = re.search(r"(女|婦|嬤)", head)
    m_ = re.search(r"(男|翁|阿伯|老伯|工人|工頭|師傅)", head)
    rel = re.search(r"(妻|母|媽|夫|父|爸|兄|弟|姊|妹|兒|女友|男友|前任|同居)", head)
    if f_ and not m_ and not rel:
        return "一名女子", False
    if m_ and not f_ and not rel:
        return "一名男子", False
    return "一人", False

def summary(cat, text, dist):
    where = dist or "台中"
    w, many = who(text)
    if cat == "墜樓":
        return f"{where}發生墜樓事件，{w}身亡。"
    if cat == "浮屍／溺水":
        if re.search(r"(溺|落水|戲水|游泳|沖走|滅頂)", text):
            return f"{where}發生溺水事件，{w}身亡。"
        return f"{where}發現{w}的遺體，報請檢警相驗。"
    if cat == "火災致死":
        return f"{where}發生火警，造成{w}罹難。" if many else f"{where}發生火警，{w}罹難。"
    if cat == "工安／意外事故" and not re.search(r"(工安|工人|工地|施工|職災|作業)", text):
        return f"{where}發生意外事故，{w}身亡。"
    if cat in ("工安意外", "工安／意外事故"):
        return f"{where}發生工安意外，{w}身亡。"
    if cat == "命案" and not KILL.search(text) and re.search(r"(意外|夾|車禍|機械|跌|摔|撞|倒塌|觸電)", text):
        return f"{where}發生意外，{w}身亡。"
    if cat == "命案" or KILL.search(text):
        return f"{where}發生命案，{w}遇害身亡，警方偵辦。" if not many else f"{where}發生命案，造成{w}死亡，警方偵辦。"
    if cat == "猝死／疑病故":
        return f"{where}{w}突然倒下身亡，疑似因病。"
    if cat in ("燒炭", "上吊", "輕生（方式未明）"):
        return f"{where}發現{w}身亡，警方初步排除外力介入。"
    if re.search(r"(車禍|撞|翻覆|火車|列車|意外|夾|機械|跌|摔|倒塌|觸電)", text):
        return f"{where}發生事故，{w}身亡。"
    return f"{where}發現{w}身亡，死因待查。"

def bigrams(t):
    t = re.sub(r"[^一-鿿0-9]", "", t)
    return {t[i : i + 2] for i in range(len(t) - 1)}

def clean_head(t):
    return re.sub(r"^(快訊|影|獨家|更新|直擊|最新)[／/]", "", t or "").strip()

def main():
    files = {f: json.load(open(f"{SITE}/{f}")) if f != "fire.json" or __import__("os").path.exists(f"{SITE}/{f}") else None for f, _, _ in CATS.values()}
    if files["fire.json"] is None:
        files["fire.json"] = {"title": "台中火災致死新聞", "note": "整理自網路新聞（ETtoday 社會新聞每日列表與各家報導）", "fear": ["D", "S"], "danger": 5, "records": []}
    used = {s["url"] for d in files.values() for r in d["records"] for s in r["sources"]}
    have = {r["id"] for d in files.values() for r in d["records"]}

    # 1. keep clear, Taichung, post-inauguration death reports
    keep, dropped = [], defaultdict(list)
    for x in ROWS:
        text = re.sub(r"(撿屍|像屍體)", "", x["標題"] + " " + x["其他報導標題"])
        if x["日期"] < START:
            continue
        if HARD.search(x["標題"]):
            dropped["follow-up"].append(x["標題"]); continue
        if not STRONG.search(text) and (not WEAK.search(text) or SURVIVE.search(text)):
            dropped["no death"].append(x["標題"]); continue
        if x["類別"] == "陳屍／死因不明":
            if re.search(r"(墜樓|墜落|跳樓|\d+樓墜)", x["標題"]):
                x = {**x, "類別": "墜樓"}
            elif re.search(r"(溺|戲水|落水|浮屍|墜海|墜河|墜溪|水潭|魚池|溪中|河中|海中|海邊)", x["標題"]):
                x = {**x, "類別": "浮屍／溺水"}
        keep.append(x)

    # 2. merge what the research step left split: same file, within 3 days, similar headlines
    keep.sort(key=lambda x: x["日期"])
    groups = []
    for x in keep:
        f = CATS[x["類別"]][0]
        bx = bigrams(x["標題"] + x["其他報導標題"])
        for g in reversed(groups[-60:]):
            if CATS[g[0]["類別"]][0] != f:
                continue
            # measured from the group's latest story, so a running story keeps joining its event
            d = (date.fromisoformat(x["日期"]) - date.fromisoformat(g[-1]["日期"])).days
            if d > 3:
                continue
            gt = " ".join(z["標題"] + z["其他報導標題"] for z in g)
            by = bigrams(gt)
            same = len(bx & by) / max(1, min(len(bx), len(by))) > 0.27 or deaths(x["標題"] + x["其他報導標題"]) & deaths(gt)
            # a big fire is covered for days under "惡火/大火" headlines with counts that change as it goes
            if f == "fire.json" and d <= 2 and re.search(r"(惡火|大火)", x["標題"]) and re.search(r"(惡火|大火)", gt):
                same = True
            if same:
                g.append(x); break
        else:
            groups.append([x])

    added = defaultdict(list)
    seq = defaultdict(int)
    for g in groups:
        x = g[0]
        f, pre, label = CATS[x["類別"]]
        links = "\n".join(y["新聞連結"] for y in g)
        srcs = [s for s in sources(links) if s["url"] not in used]
        # a site that blocked the title fetch: the research row's own headline belongs to its first link
        first = {re.split(r"\s+", y["新聞連結"].strip())[0]: clean_head(y["標題"]) for y in g} | {u: clean_head(t) for u, t in LINK_TITLE.items()}
        for s_ in srcs:
            if s_["title"].endswith("報導") and first.get(s_["url"]):
                s_["title"] = first[s_["url"]]
        if not srcs:
            dropped["already on site"].append(x["標題"]); continue
        for s in srcs:
            used.add(s["url"])
        text = " ".join(y["標題"] + " " + y["其他報導標題"] for y in g)
        dist = district(x["行政區"], text)
        # our headline: the first one that names no method and nothing graphic; otherwise a neutral label
        heads = [clean_head(y["標題"]) for y in g] + [clean_head(t) for y in g for t in y["其他報導標題"].split("\n")] + [clean_head(s["title"]) for s in srcs]
        title = next((t for t in heads if len(re.findall(r"[\u4e00-\u9fff]", t)) >= 6 and not METHOD_WORDS.search(t) and not GRAPHIC.search(t) and not GORE.search(t) and not t.endswith("報導")), "")
        m, d = int(x["日期"][5:7]), int(x["日期"][8:10])
        title = title or f"{x['日期'][:4]}/{m}/{d} {dist or '台中'}{label}"
        seq[(pre, x["日期"])] += 1
        rid = f"{pre}-h{x['日期'].replace('-', '')}{'abcdefghijklmnop'[seq[(pre, x['日期'])] - 1]}"
        if rid in have:
            continue
        rec = {"id": rid, "title": title, "date": x["日期"], "place": dist or "台中", "summary": summary(x["類別"], text, dist), "sources": srcs}
        added[f].append(rec)

    # checked by hand: the day the death map takes over, both lists carry these two
    for keep, drop in (("q-dm1", "q-h20240326a"), ("q-h20240325a", "q-h20240325b")):
        k = next((r for d in files.values() for r in d["records"] if r["id"] == keep), None) or next((r for v in added.values() for r in v if r["id"] == keep), None)
        dr = next((r for r in added["quiet.json"] if r["id"] == drop), None)
        if k and dr:
            k["sources"] += [s_ for s_ in dr["sources"] if s_["url"] not in {t["url"] for t in k["sources"]}]
            added["quiet.json"].remove(dr)

    # last pass with every fetched headline in hand: fold same-event leftovers (≤3 days, similar headlines)
    for f, recs in added.items():
        recs.sort(key=lambda r: r["date"])
        out = []
        for r in recs:
            br = bigrams(" ".join(s_["title"] for s_ in r["sources"]))
            near = [o for o in out[-12:] if (date.fromisoformat(r["date"]) - date.fromisoformat(o["date"])).days <= 3]
            o = next((o for o in reversed(near) if len(br & (bo := bigrams(" ".join(s_["title"] for s_ in o["sources"])))) / max(1, min(len(br), len(bo))) > 0.3), None)
            if o:
                o["sources"] += [s_ for s_ in r["sources"] if s_["url"] not in {t["url"] for t in o["sources"]}]
            else:
                out.append(r)
        added[f] = out

    for f, d in files.items():
        if not added[f]:
            continue
        d["records"] = sorted(d["records"] + added[f], key=lambda r: r.get("sort") or r["date"], reverse=True)
        d["updated"] = "2026-10-23"
        json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
        print(f, len(d["records"]), "+", len(added[f]))
    for k, v in dropped.items():
        print("dropped", k, len(v))
    json.dump(dropped, open(f"{sys.argv[1]}/hist_dropped.json", "w"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
