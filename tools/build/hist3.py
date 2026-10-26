# Import the research repo's site-ready history table (commit 449dff4 onward): the research side now
# filters, merges and writes 島／網站標題／網站摘要 itself, so this only converts rows to site records.
import csv, json, os, re, sys
from collections import defaultdict
sys.path.insert(0, sys.argv[1])
from build import sources, METHOD_WORDS, GRAPHIC, RES, SITE

FILES = {"墜落島": ("falls.json", "fall", "墜樓事件"), "漂浮島": ("floaters.json", "float", "發現遺體"), "氣爆火災島": ("fire.json", "fire", "火災"),
         "公安災害島": ("safety.json", "s", "意外事故"), "無聲島": ("quiet.json", "q", "死亡事件"),
         "兒少島": ("kids.json", "y", "兒少事件")}
rows = [x for x in csv.DictReader(open(f"{RES}/history-2018-2024/events_2018-2024.csv", encoding="utf-8-sig")) if x["盧秀燕任內"] == "是"]
# pedestrians killed by cars come from the pedestrians/ table (ped.py), public transit only (user's call)
rows = [x for x in rows if x["類別"] != "行人遭撞死亡"]  # ped.py imports these from pedestrians/ instead
files = {}
for f, _, _ in FILES.values():
    if os.path.exists(f"{SITE}/{f}"):
        d = json.load(open(f"{SITE}/{f}"))
        d["records"] = [r for r in d["records"] if "-h20" not in r["id"]]  # previous history import is replaced whole
    else:
        d = {"records": []}
    files[f] = d
files["fire.json"].update({"title": "台中火災致死新聞", "note": "2018-12～2024-03 的火災致死事件，整理自各家社會新聞", "helpline": False, "fear": ["D", "S"], "danger": 5})
byid = {r["id"]: r for d in files.values() for r in d["records"]}
used = {s["url"] for d in files.values() for r in d["records"] for s in r["sources"]}
seq, added, skipped = defaultdict(int), defaultdict(int), defaultdict(list)
# checked by hand (2026-10-23): legends, statistics, old cases, out-of-county and no-death rows; reported upstream
DROP = ("台中男喝掛捷運站睡死",)  # slang "睡死" = fell asleep drunk, nobody died
for x in rows:
    if x["島"] not in FILES:  # research also lists these on a non-death island (e.g. 詐騙島); isl9.py imports them there
        continue
    f, pre, label = FILES[x["島"]]
    if any(k in x["新聞連結（每行：標題｜網址）"] for k in DROP):
        skipped["dropped by hand"].append(x["標題"])
        continue
    pairs = [l.rsplit("｜", 1) for l in x["新聞連結（每行：標題｜網址）"].splitlines() if "｜" in l]
    head = {u.strip(): t.strip() for t, u in pairs}
    srcs = sources("\n".join(head))
    for s in srcs:
        if s["title"].endswith("報導") and head.get(s["url"]):
            s["title"] = head[s["url"]]
    # cases already on the site from other sources (not in the death map), matched by hand
    same = {("2023-05-10", "公安災害島"): "s-mrt", ("2022-12-27", "公安災害島"): "s-bus-2022", ("2022-12-28", "公安災害島"): "s-bus-2022", ("2023-03-24", "兒少島"): "y-fengyuan-hs"}.get((x["日期"], x["島"]))
    if same and same in byid:
        byid[same]["sources"] += [s_ for s_ in srcs if s_["url"] not in {t["url"] for t in byid[same]["sources"]}]
        skipped["same as site record"].append(x["標題"])
        continue
    ref = x.get("對應其他資料表（死亡地圖／列表／執政議題／貼文）", x.get("對應死亡地圖／列表編號", ""))
    # same case as a site record from the death map or death list: only add its extra reports there
    m = re.search(r"死亡地圖#(\d+)", ref)
    l = re.search(r"死亡列表#(\d+)", ref)
    tgt = next((r for r in byid.values() if (m and r["id"].endswith(f"-dm{m.group(1)}")) or (l and re.fullmatch(rf"(fall|float|q)-{l.group(1)}", r["id"]))), None)
    if tgt:
        tgt["sources"] += [s for s in srcs if s["url"] not in {t["url"] for t in tgt["sources"]}]
        skipped["linked"].append(x["標題"])
        continue
    srcs = [s for s in srcs if s["url"] not in used]
    if not srcs:
        skipped["already on site"].append(x["標題"])
        continue
    used.update(s["url"] for s in srcs)
    title = x["網站標題"].strip()
    if title and (METHOD_WORDS.search(title) or GRAPHIC.search(title)):
        title = ""  # belt and braces; the research side already screens these
    m, dd = int(x["日期"][5:7]), x["日期"][8:10]  # some rows only know the month
    title = title or f"{x['日期'][:4]}/{m}{'/' + str(int(dd)) if dd else ''} {x['行政區'] or '台中'}{label}"
    seq[(pre, x["日期"])] += 1
    rid = f"{pre}-h{x['日期'].replace('-', '')}{'abcdefghijklmnopqrstuvwxyz'[seq[(pre, x['日期'])] - 1]}"
    rec = {"id": rid, "title": title, "date": x["日期"], "place": x["行政區"] or "台中", "summary": x["網站摘要"], "sources": srcs}
    if x.get("死亡人數", "").strip().isdigit():
        rec["deaths"] = int(x["死亡人數"])
    if f == "safety.json":
        rec["fear"] = ["D", "S"]  # 公安災害島 also holds non-fatal items, so its deaths carry 有人死亡 themselves
    files[f]["records"].append(rec)
    added[f] += 1
LIST = {x["序"]: x.get("死亡人數", "") for x in csv.DictReader(open(f"{RES}/death-lists/death_list_entries.csv", encoding="utf-8-sig"))}
for d in files.values():
    for r in d["records"]:
        if re.search(r"-dm\d+$", r["id"]):
            r["deaths"] = 1
        elif (m := re.fullmatch(r"(fall|float|q)-(\d+)", r["id"])) and LIST.get(m.group(2), "").isdigit():
            r["deaths"] = int(LIST[m.group(2)])
for f, d in files.items():
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    d["updated"] = "2026-10-23"
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
    print(f, len(d["records"]), "+", added[f])
print({k: len(v) for k, v in skipped.items()})
