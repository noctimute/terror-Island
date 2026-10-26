# Merge follow-up reports of one case (charges, bail, verdicts) into a single record. Run after isl4.py and isl9.py.
# Groups were checked by hand (2026-10-24) and are stored as all links of the merged case, so a re-import that
# reshuffles ids or first links still finds every member: any record sharing a link with the case joins it.
import json, re, sys
SITE = "/home/user/terror-Island/lumama"
files = {}
def load(f):
    if f not in files:
        files[f] = json.load(open(f"{SITE}/{f}"))
    return files[f]
# ---- audit 2026-10-24 (reader report + full check): fixed before the case merges, all keyed by links ----
# records that are not Taichung deaths in the term: (file, any link on the record)
REMOVE = [("quiet.json", "https://www.ettoday.net/news/20240312/2698665.htm"),   # hikers died on 玉山, outside Taichung
          ("quiet.json", "https://www.ettoday.net/news/20220715/2294880.htm"),   # shooting in 南投草屯
          ("quiet.json", "https://www.ettoday.net/news/20191014/1556374.htm"),   # 2005 murder, body left in 彰化, retold in 2019
          ("quiet.json", "https://www.ettoday.net/news/20190528/1454269.htm"),   # 2012 murder retold in 2019
          ("fire.json", "https://news.ltn.com.tw/news/society/breakingnews/2805793"),  # 2019 ruling on an earlier arson
          ("fire.json", "https://news.ltn.com.tw/news/society/breakingnews/2868962"),  # nightclub fire show, nobody died
          ("quiet.json", "https://news.ltn.com.tw/news/society/paper/1307442"),        # same nightclub show
          ("quiet.json", "https://www.ettoday.net/news/20200106/1618903.htm"),         # a dead sea turtle
          ("empty.json", "https://www.ettoday.net/news/20261004/3248984.htm"),        # food poisoning filed on 空城島; the case is on 食安島 (reader report 2026-10-25)
          ("empty.json", "https://www.ettoday.net/news/20251124/3072859.htm"),         # hotel fall filed on 空城島; the case is on 墜落島
          ("empty.json", "https://www.ettoday.net/news/20230226/2448536.htm"),         # shop fire with no deaths, not an air-pollution case
# island audit 2026-10-25: not a death, not Taichung, or not an incident
          ("falls.json", "https://www.setn.com/news/1722491"),  # coma, no death reported
          ("quiet.json", "https://www.ettoday.net/news/20220409/2225749.htm"),  # escaped prisoner caught, no death
          ("quiet.json", "https://www.ettoday.net/news/20231012/2600614.htm"),  # underpass arson, nobody hurt
          ("quiet.json", "https://www.ettoday.net/news/20220715/2295159.htm"),  # 南投 shooting, suspect caught in Taichung
          ("quiet.json", "https://www.ettoday.net/news/20220614/2272854.htm"),  # wanted man caught
          ("falls.json", "https://ctinews.com/news/items/yDa2QZJpWK"),  # taken to hospital, no death reported
          ("falls.json", "https://www.ettoday.net/news/20240722/2782095.htm"),  # still alive in hospital, no death reported
          ("falls.json", "https://www.ettoday.net/news/20240527/2747048.htm"),  # death map notes he survived
          ("quiet.json", "https://tw.news.yahoo.com/%E5%8F%B0%E4%B8%AD%E6%9D%B1%E6%B5%B7%E8%A1%97%E9%80%81%E7%85%9E%E5%84%80%E5%BC%8F%E5%BC%95%E4%B8%8D%E6%BB%BF-%E6%B0%91%E7%9C%BE%E8%B3%AA%E7%96%91%E7%84%A1%E8%B7%AF%E6%AC%8A%E7%94%B3%E8%AB%8B-082755524.html"),  # 送肉粽 ritual, no death
          ("quiet.json", "https://mortuary.taichung.gov.tw/Frontend/IceBoxUse.aspx"),  # funeral-office web page
          ("quiet.json", "https://www.ettoday.net/news/20240204/2678019.htm"),  # fundraising, no death
          ("quiet.json", "https://www.ettoday.net/news/20221001/2349313.htm"),  # statistics
          ("quiet.json", "https://www.ettoday.net/news/20220629/2283362.htm"),  # traffic-camera notice
          ("quiet.json", "https://www.ettoday.net/news/20220409/2226174.htm"),  # defamation suit
          ("quiet.json", "https://www.ettoday.net/news/20210420/1963883.htm"),  # prosecutor forged records, no death
          ("quiet.json", "https://www.ettoday.net/news/20200711/1757826.htm"),  # drug hallucination, no death
          ("quiet.json", "https://www.ettoday.net/news/20191125/1587742.htm"),  # 2017 sexual assault, no death
          ("quiet.json", "https://www.ettoday.net/news/20230826/2569163.htm"),  # victim survived
          ("quiet.json", "https://news.ltn.com.tw/news/society/paper/1310002"),  # free-diving near misses, no death
          ("quiet.json", "https://news.ltn.com.tw/news/life/breakingnews/2879026"),  # mayor Facebook post
          ("quiet.json", "https://news.ltn.com.tw/news/local/paper/1290002"),  # underpass drainage
          ("quiet.json", "https://news.ltn.com.tw/news/society/breakingnews/2794576"),  # feature on teahouses, no new case
          ("quiet.json", "https://news.ltn.com.tw/news/society/breakingnews/2791218"),  # 2015 彰化 murder, final ruling
          ("quiet.json", "https://news.ltn.com.tw/news/society/breakingnews/2715152"),  # woman survived
          ("quiet.json", "https://www.ettoday.net/news/20220228/2197875.htm"),  # 2004 case retold
          ("quiet.json", "https://www.ettoday.net/news/20190209/1374461.htm"),  # critical, death not reported
          ("fire.json", "https://www.ettoday.net/news/20240318/2702605.htm"),  # no casualties
          ("fire.json", "https://www.ettoday.net/news/20230308/2454648.htm"),  # no death reported
          ("fire.json", "https://www.ettoday.net/news/20230221/2444776.htm"),  # no death reported
          ("fire.json", "https://news.ltn.com.tw/news/society/breakingnews/2924630"),  # no casualties
          ("fire.json", "https://news.ltn.com.tw/news/society/breakingnews/2859408"),  # no casualties
          ("fire.json", "https://news.ltn.com.tw/news/society/breakingnews/2784336"),  # no death reported
          ("garbage.json", "https://www.ettoday.net/news/20201019/1834819.htm"),  # 太平山 is in 宜蘭
          ("garbage.json", "https://www.ettoday.net/news/20250320/2928590.htm"),  # dumped in 彰化市
          ("land.json", "https://tfc-taiwan.org.tw/fact-check-reports/migration-5614/"),  # fact-check of a false rumour
          ("scam.json", "https://www.ettoday.net/news/20200520/1718352.htm")]  # threat case, not fraud
# a link on the wrong record: (file, a link that stays on the record, link to drop)
DROP_ON = [("quiet.json", "https://news.ebc.net.tw/news/society/272810", "https://news.tvbs.com.tw/local/3017358"),  # 2024 北屯 case, not this 2021 太平 one
           ("falls.json", "https://www.ettoday.net/news/20260603/3177276.htm", "https://www.chinatimes.com/realtimenews/20260607002124-260402"),  # 高雄前金
           ("quiet.json", "https://news.tvbs.com.tw/local/2912832", "https://www.yuanfengmedia.tw/detail.php?type=popular&id=43325"),            # unrelated page
           ("falls.json", "https://www.nownews.com/news/6528081", "https://www.cmoney.tw/forum/article/186076025"),                             # unrelated page
           ("floaters.json", "https://news.tvbs.com.tw/local/2498873", "https://new-reporter.com/news/282008/"),                                # 2026 body, not this 2024 case
# research rows chained into a neighbouring case (import 2026-10-25)
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.ltn.com.tw/news/society/breakingnews/5043634"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://udn.com/news/story/6885/8741095"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.pts.org.tw/article/750833"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.taichung.gov.tw/8868/8872/9962/2980255"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.ttv.com.tw/news/11405120018100N"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.chinatimes.com/realtimenews/20250513002467-260402"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.ltn.com.tw/news/society/breakingnews/5041369"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.setn.com/news/1655455"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.taichung.gov.tw/8868/8872/9962/2982890"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.ettoday.net/news/20250515/2960891.htm"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.pts.org.tw/article/751307"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://udn.com/news/story/121721/8738344"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.ettoday.net/news/20250516/2961943.htm"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.ltn.com.tw/news/society/breakingnews/5045589"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.pts.org.tw/article/751637"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.ltn.com.tw/news/society/breakingnews/5050071"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://news.pts.org.tw/article/752328"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250512/2958980.htm", "https://www.cna.com.tw/news/asoc/202505210181.aspx"),  # 豐原 private 托嬰 case, on y-fengyuan
           ("kids.json", "https://www.ettoday.net/news/20250515/2960891.htm", "https://news.ltn.com.tw/news/society/breakingnews/5050071"),  # 南區 托嬰 case, on y-south
           ("kids.json", "https://www.ettoday.net/news/20250515/2960891.htm", "https://news.pts.org.tw/article/752328"),  # 南區 托嬰 case, on y-south
           ("kids.json", "https://www.ettoday.net/news/20250515/2960891.htm", "https://www.cna.com.tw/news/asoc/202505210181.aspx"),  # 南區 托嬰 case, on y-south
           ("garbage.json", "https://www.cna.com.tw/news/aloc/202509020121.aspx", "https://www.nownews.com/news/6844499"),  # 沙鹿 case, on g-shalu
           ("garbage.json", "https://www.cna.com.tw/news/aloc/202509020121.aspx", "https://www.ctee.com.tw/news/20260608701238-431401"),  # 沙鹿 case, on g-shalu
           ("garbage.json", "https://www.cna.com.tw/news/aloc/202509020121.aspx", "https://www.chinatimes.com/newspapers/20260609000582-260107"),  # 沙鹿 case, on g-shalu
           ("garbage.json", "https://www.cna.com.tw/news/aloc/202509020121.aspx", "https://www.setn.com/News.aspx?NewsID=1851388"),  # 沙鹿 case, on g-shalu
           ("falls.json", "https://www.ettoday.net/news/20251101/3060012.htm", None)]                                                          # 西屯 man survived: drop link everywhere
# one record holding two deaths: (file, a link that stays, links that move, the new record)
SPLIT = [("falls.json", "https://www.ettoday.net/news/20260214/3118893.htm",
          ["https://tw.news.yahoo.com/%E5%BF%AB%E8%A8%8A-%E5%B9%B4%E7%AF%80%E5%89%8D%E5%82%B3%E6%86%BE%E4%BA%8B-%E5%8F%B0%E4%B8%AD27%E6%AD%B2%E5%A5%B3%E6%B7%B1%E5%A4%9C%E5%A2%9C%E6%A8%93-%E5%80%92%E5%A4%A7%E6%A8%93%E9%80%9A%E9%81%93-%E6%98%8E%E9%A1%AF%E6%AD%BB%E4%BA%A1-031000807.html"],
          {"id": "fall-x20260213", "title": "年節前西屯大樓深夜墜樓 27歲女明顯死亡", "date": "2026-02-13", "place": "西屯", "summary": "西屯一處大樓發生墜樓事件，一名女子身亡。", "deaths": 1}),
         ("fire.json", "https://www.ettoday.net/news/20230121/2427422.htm", ["https://www.ettoday.net/news/20230124/2428022.htm"],
          {"id": "fire-x20230124", "title": "初三凌晨烏日民宅大火 獨居男葬身火窟", "date": "2023-01-24", "place": "烏日", "summary": "烏日一處民宅凌晨發生大火，一名男子罹難。", "deaths": 1}),
         ("fire.json", "https://www.ettoday.net/news/20231116/2624289.htm", ["https://www.ettoday.net/news/20231117/2624854.htm"],
          {"id": "fire-x20231117", "title": "神岡工廠凌晨大火 折返屋內男子尋獲已罹難", "date": "2023-11-17", "place": "神岡", "summary": "神岡一處工廠凌晨發生火警，一名男子罹難。", "deaths": 1})]
# fields to correct on a record found by one of its links
FIX_PRE = [("fire.json", "https://www.ettoday.net/news/20230121/2427422.htm", {"title": "除夕大雅民宅火警 1人身亡", "place": "大雅", "summary": "大雅一處民宅發生火警，一名男子罹難。"}),
           ("fire.json", "https://www.ettoday.net/news/20231116/2624289.htm", {"place": "中區", "summary": "中區一處老宅發生火警，一名女子罹難。"}),
           ("floaters.json", "https://www.thenewslens.com/article/255328", {"summary": "豐原一處住宅，一名幼童在浴室溺斃。"}),
           ("quiet.json", "https://tw.news.yahoo.com/%E5%8F%B0%E4%B8%AD%E5%A4%AB%E5%A6%BB%E9%9B%99%E5%B1%8D%E6%A1%88-%E7%A0%B4%E9%96%80%E8%A6%8B2%E5%85%B7%E5%86%B0%E5%86%B7%E9%81%BA%E9%AB%94-%E9%AB%98%E4%B8%89%E5%85%92-%E9%9B%A2%E5%A5%87%E6%B6%88%E5%A4%B1%E6%95%B4%E6%99%9A-%E7%B5%82%E7%8F%BE%E8%BA%AB-085100800.html", {"deaths": 2, "summary": "西屯一處住宅發現一對夫妻身亡，死因待查。"})]
def has(r, u): return any(s["url"] == u or s["url"].startswith(u) for s in r["sources"])
for f, u in REMOVE:
    load(f)["records"][:] = [r for r in load(f)["records"] if not has(r, u)]
# whole record belongs on another island: (file, a link on it, target file, fields to set; None deletes the field)
MOVE = [
        ("safety.json", "https://www.setn.com/news/900205", "quiet.json", {"id": "q-h20210221s", "fear": None}),  # fall inside a company, not public safety
        ("quiet.json", "https://www.ettoday.net/news/20200605/1730839.htm", "food.json", {"id": "f-ratlunch", "title": "龍井國中營養午餐驚見老鼠全屍 3名學生腹痛送醫", "summary": "龍井一所國中的營養午餐被學生發現夾雜整隻死老鼠，3名學生腹痛送醫，無人死亡。", "fear": ["F"], "deaths": None}),  # food safety, nobody died
        ("quiet.json", "https://www.ettoday.net/news/20220213/2188123.htm", "kids.json", {"id": "y-tanzi"}),  # two young children killed
        ("quiet.json", "https://www.ettoday.net/news/20190911/1533611.htm", "scam.json", {"id": "x-i20190911z", "summary": "一名詐欺通緝犯逃亡多年後在台中開髮廊，以投資七期土地建案為由，再向 30 多人騙走近 3 億元。", "fear": ["Z"], "deaths": None}),  # fraud, nobody died
        ("quiet.json", "https://www.ettoday.net/news/20230915/2583178.htm", "scam.json", {"id": "x-i20230915z", "summary": "裝潢包商以低價承攬後收款不施工，逾135名屋主受害、金額逾億元，其中一名受害者在出庭途中過世。", "fear": ["Z"], "deaths": None}),  # fraud story, not a death case
        ("safety.json", "https://www.ettoday.net/news/20221009/2354715.htm", "quiet.json", {"id": "q-h20221009s", "fear": None}),  # personal accident, not public safety
        ("safety.json", "https://www.ettoday.net/news/20220708/2289897.htm", "quiet.json", {"id": "q-h20220708s", "fear": None}),  # personal accident, not public safety
        ("safety.json", "https://www.ettoday.net/news/20200928/1819672.htm", "quiet.json", {"id": "q-h20200928s", "fear": None}),  # personal accident, not public safety
        ("safety.json", "https://www.ettoday.net/news/20190923/1541386.htm", "quiet.json", {"id": "q-h20190923s", "fear": None}),  # personal accident, not public safety
        ("safety.json", "https://www.ettoday.net/news/20240109/2660194.htm", "quiet.json", {"id": "q-h20240109s", "fear": None}),  # personal accident, not public safety
        ("safety.json", "https://www.ettoday.net/news/20201201/1866873.htm", "quiet.json", {"id": "q-h20201201s", "fear": None}),  # personal accident, not public safety
        ("safety.json", "https://www.ettoday.net/news/20210503/1973596.htm", "quiet.json", {"id": "q-h20210503s", "fear": None}),  # personal accident, not public safety
]
for f, link, to, fields in MOVE:
    for r in [r for r in load(f)["records"] if has(r, link)]:
        load(f)["records"].remove(r)
        if any(has(t, link) for t in load(to)["records"]):  # already moved on an earlier run
            continue
        for k, v in fields.items():
            if v is None: r.pop(k, None)
            else: r[k] = v
        load(to)["records"].append(r)
# record is another report of a case kept elsewhere: (file, its link, target file, a link on the kept record)
MOVE_SRC = [
           ("quiet.json", "https://www.setn.com/news/715157", "quiet.json", "https://www.ettoday.net/news/20200326/1677014.htm"),  # same 太平 cemetery death
           ("quiet.json", "https://www.ettoday.net/news/20211029/2112561.htm", "quiet.json", "https://www.ettoday.net/news/20211030/2112931.htm"),  # same 大甲 abuse killing
           ("quiet.json", "https://news.ltn.com.tw/news/society/paper/1289650", "quiet.json", "https://www.ettoday.net/news/20190518/1447465.htm"),  # same 沙鹿 teahouse shooting
           ("safety.json", "https://www.ettoday.net/news/20210310/1935259.htm", "safety.json", "https://www.ettoday.net/news/20200702/1750952.htm"),  # follow-up of the 2020 elevator death
           ("garbage.json", "https://www.nownews.com/news/6722480", "river.json", "https://news.pts.org.tw/article/766981"),  # sewage dumping, on 髒川島
           ("garbage.json", "https://www.ettoday.net/news/20251030/3059246.htm", "foodwaste.json", "https://news.ltn.com.tw/news/life/breakingnews/5223227"),  # 霧峰 food-waste pit, on 廚餘湖
]
for f, link, to, anchor in MOVE_SRC:
    for r in [r for r in load(f)["records"] if has(r, link) and not has(r, anchor)]:
        load(f)["records"].remove(r)
        for t in load(to)["records"]:
            if has(t, anchor):
                t["sources"] += [x for x in r["sources"] if x["url"] not in {y["url"] for y in t["sources"]}]
for f, keep, drop in DROP_ON:
    for r in load(f)["records"]:
        if drop is None:
            r["sources"] = [s for s in r["sources"] if s["url"] != keep]
        elif has(r, keep):
            r["sources"] = [s for s in r["sources"] if s["url"] != drop]
for f, keep, move, new in SPLIT:
    R = load(f)["records"]
    for r in R:
        if has(r, keep) and any(has(r, m) for m in move) and not any(x["id"] == new["id"] for x in R):
            moved = [s for s in r["sources"] if any(s["url"].startswith(m) for m in move)]
            r["sources"] = [s for s in r["sources"] if s not in moved]
            R.append({**new, "sources": moved, **({"fear": r["fear"]} if r.get("fear") else {})})
            break
for f, u, fields in FIX_PRE:
    for r in load(f)["records"]:
        if has(r, u):
            r.update(fields)

done = 0
for g in json.load(open(f"{sys.argv[1]}/merges.json")):
    urls = set(g["urls"])
    members = [(f, r) for f in g["files"] for r in load(f)["records"] if urls & {s["url"] for s in r["sources"]}]
    keep = next((r for f, r in members if r["id"] == g["keep_id"]), None) or min((r for f, r in members if f == g["keep_file"]), key=lambda r: r["date"], default=None)
    if not keep:
        continue
    for f, r in members:
        if r is keep:
            continue
        keep["sources"] += [s for s in r["sources"] if s["url"] not in {t["url"] for t in keep["sources"]}]
        if "-i20" in keep["id"] and r["date"] < keep["date"]:
            keep["date"] = r["date"]
        if r.get("fear"):
            keep["fear"] = keep.get("fear", []) + [x for x in r["fear"] if x not in keep.get("fear", [])]
        load(f)["records"].remove(r)
        done += 1
    # a duplicate-death group states the true toll and fixes, since the members each counted the same people
    if g.get("deaths"):
        keep["deaths"] = g["deaths"]
    keep.update(g.get("set", {}))
# 2026-08 the former land-office director's conviction became final: name him on the merged case (user's rule)
for r in load("graft.json")["records"]:
    if r["id"] == "k-land":
        r["title"] = "前地政局長吳存金用首長特別費請親友吃飯 貪污判2年緩刑5年確定"
# suspects not (yet) finally convicted: surname only (user's rule); found by hand after the research rebuild
RETITLE = {"https://www.ettoday.net/news/20220216/2190546.htm": "台中冉姓市議員詐領助理費供奉法師、買裙子 一審判4年",
           "https://news.cts.com.tw/cts/society/202402/202402012282769.html": "涉助董座掏空台中銀 豪車租賃老闆曾幫朱姓前董座偷渡"}
for f in ("graft.json", "nat.json"):
    for r in load(f)["records"]:
        t = next((RETITLE[s["url"]] for s in r["sources"] if s["url"] in RETITLE), None)
        if t:
            r["title"] = t
# 2023-03 follow-ups of the 2021-03-11 豐原 arson (husband died 2021-04-25) came in as two separate 2023 deaths
fire = load("fire.json")["records"]
fol = [r for r in fire if r["id"] in ("fire-h20230321a", "fire-h20230321b")]
if fol:
    for r in fol:
        fire.remove(r)
    fire.append({"id": "fire-fengyuan-2021", "title": "豐原前空姐潑汽油縱火 丈夫全身灼傷搶救45天不治", "date": "2021-03-11", "place": "豐原",
                 "summary": "一名女子與丈夫爭吵後，疑在住處潑灑汽油縱火，丈夫全身八成灼傷，搶救 45 天後不治；女子依殺人罪遭起訴判刑。",
                 "deaths": 1, "sources": [{"title": "前空姐婆婆曾預告「媳婦說要燒房子」　兒今被燒80%灼傷", "outlet": "鏡週刊", "url": "https://www.mirrormedia.mg/story/20210311soc006"},
                 {"title": "前空姐潑油縱火燒老公　尪全身80%燒傷搶救45天不治", "outlet": "鏡週刊", "url": "https://www.mirrormedia.mg/story/20210426edi012"},
                 {"title": "快訊》台中「驚世空姐」縱火燒死夫「原訂今天重獲自由」　典獄長：確定出不了獄「繼續關押」", "outlet": "風傳媒", "url": "https://www.storm.mg/article/4762035"}]
                 + [s for r in fol for s in r["sources"]]})
# follow-up reports the user sent by hand: (file, a link already on the case) -> the new source
EXTRA = [("quiet.json", "https://innews.com.tw/%E5%8F%B0%E4%B8%AD%E6%91%A9%E9%90%B5%E9%A9%9A%E6%82%9A%E5%91%BD%E6%A1%88%EF%BC%81%E6%B7%AB%E7%94%B7%E3%80%8C%E6%BB%B4%E7%AE%A1%E9%A4%B5%E6%AF%92%E3%80%8D%E6%80%A7%E4%BE%B5%E5%81%B7%E6%8B%8D%E3%80%80/",
          {"title": "台中汽旅爆命案！噁男「滴管餵毒」侵犯拍片 傳播妹為2萬慘死", "outlet": "TVBS", "url": "https://news.tvbs.com.tw/local/3017358"}),
         ("safety.json", "https://news.pts.org.tw/article/636252",
          {"title": "中捷吊臂砸落1死13傷 2吊車工人遭起訴、興富發不起訴", "outlet": "公視新聞網", "url": "https://news.pts.org.tw/article/712251"}),
         ("falls.json", "https://news.tvbs.com.tw/local/3053818",
          {"title": "台中火車站前商圈某飯店墜樓　女子12F墜下卡3樓欄杆", "outlet": "ETtoday", "url": "https://www.ettoday.net/news/20251124/3072859.htm"}),
         ("food.json", "https://news.tvbs.com.tw/life/4031457",
          {"title": "台中火雞肉飯名店爆食安風波！3歲女童吐到住院　8人身體不適", "outlet": "ETtoday", "url": "https://www.ettoday.net/news/20261004/3248984.htm"})]
for f, anchor, src in EXTRA:
    for r in load(f)["records"]:
        urls = {s["url"] for s in r["sources"]}
        if anchor in urls and src["url"] not in urls:
            r["sources"].append(src)
# links that belong to another case (reader report 2026-10-24: a 台北信義區 report was attached to the 潭子 death),
# or reposts on unrelated sites whose page title is junk
DROP_SRC = {"https://tw.news.yahoo.com/%E5%BF%AB%E8%A8%8A-%E5%8C%97%E5%B8%82%E4%BF%A1%E7%BE%A9%E5%8D%8030%E6%AD%B2%E5%A5%B3%E5%AD%90%E5%A2%9C%E6%A8%93%E8%BA%AB%E4%BA%A1-%E8%AD%A6%E6%B6%88%E5%88%B0%E5%A0%B4%E5%B7%B2%E6%98%8E%E9%A1%AF%E6%AD%BB%E4%BA%A1-093900593.html",
            "https://www.cijia.com.tw/news/detail/1000027469"}
# (file, a link on the record) -> fields to set, for records whose title or place came from a wrong or vague source
FIX = [("floaters.json", "https://www.chinatimes.com/realtimenews/20230321004655-260402", {"summary": "新社大甲溪畔一名釣客溺水，送醫不治。"}),
       ("floaters.json", "https://www.cna.com.tw/news/asoc/202110030185.aspx", {"summary": "6名高中生到外埔石頭公園大安溪南岸戲水，一名學生溺水不治。"}),
       ("floaters.json", "https://www.chinatimes.com/realtimenews/20200616005378-260402", {"summary": "太平頭汴坑溪自行車道景觀橋下水塘發現一名男子遺體，警方初步排除他殺。"}),
       ("floaters.json", "https://www.setn.com/news/596532", {"summary": "大甲溪埤豐橋下一名男子落水失蹤，遺體尋獲。"}),
       ("quiet.json", "https://news.ltn.com.tw/news/society/breakingnews/3677243", {"summary": "一名獨居老翁死亡多時已成白骨，中秋節姊姊探視才發現。"}),
       ("quiet.json", "https://news.ebc.net.tw/news/society/272810", {"summary": "一名男子因網路簽賭糾紛遭3人毆打、塞住口鼻窒息死亡，遺體被棄置在太平一家汽車旅館，3人投案。"}),
       ("quiet.json", "https://www.setn.com/news/865743", {"title": "稅務員上門催稅 發現女房客已在屋內身亡多時"}),
       ("quiet.json", "https://www.setn.com/news/715157", {"place": "太平", "title": "男子失聯 陳屍太平七星山公墓停車場車內", "summary": "一名男子失聯一夜，被發現在太平七星山花園公墓停車場的車內身亡，警方排除他殺。"}),
       ("kids.json", "https://www.ettoday.net/news/20220213/2188123.htm",
        {"title": "潭子職業軍人涉殺害2幼子", "summary": "潭子一名職業軍人疑因與妻子感情不睦，凌晨到妻子住處殺害兩名幼童，隨後輕生送醫，昏迷4天後不治；共3人死亡。", "deaths": 3, "sources": [{"title": "快訊／台中人倫悲劇！25歲職軍涉狠殺2幼兒後輕生　命危搶救中", "outlet": "ETtoday", "url": "https://www.ettoday.net/news/20220213/2188123.htm"}, {"title": "空軍上兵涉殺2子輕生昏迷4天不治　檢方下午相驗", "outlet": "ETtoday", "url": "https://www.ettoday.net/news/20220217/2191051.htm"}]}),
       ("quiet.json", "https://www.ettoday.net/news/20220303/2200619.htm", {"title": "逢甲商圈女大生感情生變 持刀傷人後輕生亡"}),
       ("quiet.json", "https://www.ettoday.net/news/20220606/2266741.htm",
        {"summary": "太平一名男子因向母親要錢不成，持水果刀殺害母親，母親身中多刀死亡；男子被依殺害直系血親尊親屬罪起訴。"}),
       ("quiet.json", "https://www.ettoday.net/news/20211030/2112931.htm",
        {"title": "大甲派遣粗工遭老闆娘等11人押往山區虐殺",
         "summary": "大甲一名派遣粗工，被承包老闆娘與多名同事押上車載往外埔山區以棍棒毆打，運往彰化途中身亡；警方查獲時嫌犯仍與遺體同處一室，8人收押。"}),
       ("floaters.json", "https://www.ettoday.net/news/20231011/2600120.htm",
        {"title": "筏子溪虹揚橋下發現浮屍 外縣市男大生",
         "summary": "西屯筏子溪虹揚橋下發現一具男性遺體，警方查出是在高雄就讀的男大生，與台中無地緣關係，死因由檢警解剖釐清。"}),
("quiet.json", "https://www.nfa.gov.tw/cht/index.php?code=list&flag=detail&ids=22&article_id=21709",
        {"title": "潭子圓通南路住宅1女身亡 另3女送醫", "place": "潭子"}),
       ("fire.json", "https://www.ettoday.net/news/20230220/2443977.htm",
        {"summary": "東區後站一處民宅發生火警，一名獨居婦人來不及逃生罹難。"}),
       ("safety.json", "https://www.ettoday.net/news/20210707/2024735.htm", {"fear": ["S"], "deaths": None}),  # collapse, the couple survived
       ("quiet.json", "https://www.ettoday.net/news/20191017/1558715.htm", {"deaths": 2}),  # gravel truck killed girl and grandmother
       ("scam.json", "https://www.ettoday.net/news/20190911/1533611.htm",
        {"summary": "一名詐欺通緝犯逃亡多年後在台中開髮廊，以投資七期土地建案為由，再向 30 多人騙走近 3 億元。", "fear": ["Z"]}),
       ("scam.json", "https://www.ettoday.net/news/20230915/2583178.htm", {"fear": ["Z"]}),  # fraud stories: no death mark
       ("falls.json", "https://www.chinatimes.com/realtimenews/20241008005258-260402",
        {"title": "北區高中生放學自校舍墜落 送醫不治"}),  # took the title of the 東區 case from a shared round-up link
       ("food.json", "https://news.tvbs.com.tw/life/4031457",
        {"summary": "台中一家火雞肉飯名店傳出食物中毒，至少8人吐瀉不適、一名幼童住院，衛生局勒令停業。"}),
       ("quiet.json", "https://www.ettoday.net/news/20210422/1965634.htm",
        {"title": "梧棲運動公園清晨發現男子身亡 晨運民眾報警", "place": "梧棲", "summary": "梧棲運動公園清晨發現一名男子身亡，警方初步排除外力介入。"}),
       # crimes stated as fact: say 涉嫌 until a court rules (2026-10-26 review)
       ("quiet.json", "https://news.tvbs.com.tw/local/3107644", {"summary": "霧峰一名男子涉嫌因借款糾紛殺害同事、棄屍山區產業道路，遺體被釣客聞屍臭發現。"}),
       ("quiet.json", "https://www.ettoday.net/news/20260530/3174701.htm", {"summary": "潭子潭興路深夜發生街頭持刀殺人案，一名男子身亡，一名移工涉案。"}),
       ("quiet.json", "https://news.tvbs.com.tw/local/2852442", {"summary": "大里一家金屬製造廠，一名泰籍移工涉嫌酒後持刀殺害平時不睦的同鄉室友。"}),
       ("quiet.json", "https://tw.news.yahoo.com/%E5%8F%B0%E4%B8%AD%E7%88%86%E6%83%85%E6%AE%BA%E6%A1%88-23%E6%AD%B2%E5%AB%A9%E5%A6%BB%E5%81%B7%E5%90%83%E6%B3%B0%E7%B1%8D%E7%A7%BB%E5%B7%A5-%E7%B6%A0%E5%B8%BD%E5%A4%AB-%E5%88%80%E6%8D%85%E6%AD%BB%E5%B0%8F%E7%8E%8B-045351787.html", {"summary": "西屯工業區一名男子疑不滿妻子與移工交往，涉嫌持刀殺害該名泰籍移工。"}),
       ("kids.json", "https://udn.com/news/story/7317/9564539", {"summary": "一名校車司機涉嫌長期性侵女學生，多名被害人感染 HIV，是衛生單位疫調時才發現；外界批評通報與校園監督失靈。"}),
       ("scam.json", "https://www.ettoday.net/news/20260624/3189179.htm", {"summary": "詐團涉嫌在台中租下 7 間豪宅設話務機房，假冒中國公安詐騙海外華人，金額約 3 千萬元。"}),
       # minors and infants the death list recorded as 男子/女子 (2026-10-26 review)
       ("falls.json", "https://news.tvbs.com.tw/local/4037554", {"summary": "大里一處住宅發生墜樓事件，一名國中生送醫不治。"}),
       ("falls.json", "https://www.taisounds.com/news/content/96/294015", {"summary": "北屯漢神洲際百貨發生墜樓事件，一名高中生送醫不治。"}),
       ("falls.json", "https://news.ltn.com.tw/news/society/breakingnews/5480294", {"summary": "北屯一所科大校園發生墜樓事件，一名女學生身亡。"}),
       ("falls.json", "https://tw.news.yahoo.com/%E6%96%B0-%E5%8F%B0%E4%B8%AD%E7%A7%81%E7%AB%8B%E9%AB%98%E4%B8%AD%E9%A9%9A%E5%82%B3%E5%A2%9C%E6%A8%93-%E5%AD%B8%E7%94%9F%E6%B8%85%E6%99%A8%E5%AE%BF%E8%88%8D%E5%A2%9C%E8%90%BD-%E9%81%AD%E7%88%86-%E6%A0%A1%E6%96%B9%E4%B8%8D%E5%A4%A0%E9%87%8D%E8%A6%96-053800205.html", {"summary": "大甲一所私立高中宿舍發生墜樓事件，一名學生身亡。"}),
       ("falls.json", "https://tw.news.yahoo.com/%E5%BF%AB%E8%A8%8A-%E5%8F%97%E4%B8%8D%E4%BA%86%E7%88%B6%E6%AF%8D%E5%90%B5%E6%9E%B6-%E5%8F%B0%E4%B8%AD14%E6%AD%B2%E5%B0%91%E5%B9%B4%E6%B7%B1%E5%A4%9C%E5%A2%9C%E6%A8%93-%E6%91%942%E6%A8%93%E5%B9%B3%E5%8F%B0%E9%80%81%E9%86%AB%E4%B8%8D%E6%B2%BB-002700737.html", {"summary": "北屯一處住宅發生墜樓事件，一名少年送醫不治。"}),
       ("falls.json", "https://news.ebc.net.tw/news/society/522372", {"summary": "西區一處住宅發生墜樓事件，一名少年身亡。"}),
       ("falls.json", "https://tw.nextapple.com/local/20250919/11AB72AA19C6299B58B345093E9CC001", {"summary": "龍井一所學校發生墜樓事件，一名高中生身亡。"}),
       ("falls.json", "https://web.archive.org/web/20260313001736/https://udn.com/news/story/7320/8973279", {"summary": "北屯一處住宅發生墜樓事件，一名幼童傷重不治。"}),
       ("floaters.json", "https://tw.news.yahoo.com/%E5%8F%B0%E4%B8%AD%E7%94%B7%E5%AC%B0%E8%A2%AB%E4%B8%9F%E5%A4%A7%E6%8E%92%E4%BA%A1-%E5%85%A8%E8%BA%AB%E8%B5%A4%E8%A3%B8-%E8%87%8D%E5%B8%B6%E6%9C%AA%E5%89%AA-%E8%AD%A6%E8%BF%BD%E5%8F%AF%E7%96%91%E4%BA%BA%E5%A3%AB-083800122.html", {"summary": "龍井一處大排發現一名男嬰遺體，警方追查可疑人士。"}),
       ("floaters.json", "https://www.ettoday.net/news/20231101/2614282.htm", {"summary": "太平發生溺水事件，一名少年身亡。"}),
       ("quiet.json", "https://tw.news.yahoo.com/%E5%BF%AB%E8%A8%8A-%E5%8F%B0%E4%B8%AD%E6%A2%A7%E6%A3%B2%E9%9B%99%E5%B1%8D%E5%91%BD%E6%A1%88-21%E6%AD%B2%E5%A4%AB%E5%A6%BB%E9%99%B3%E5%B1%8D%E4%BD%8F%E8%99%95-4%E6%9C%88%E5%A4%A7%E5%A5%B3%E5%AC%B0%E6%91%94%E5%BA%8A%E5%BA%95%E7%8D%A8%E6%B4%BB-062100758.html", {"summary": "梧棲一處住宅發現一對年輕夫妻陳屍，家中女嬰獨活，死因待查。", "deaths": 2}),
       ("quiet.json", "https://www.ettoday.net/news/20251029/3058285.htm", {"summary": "潭子水溝發現一具棄嬰遺體，生母落網。"}),
       ("quiet.json", "https://www.ettoday.net/news/20220204/2182807.htm", {"summary": "台中發生命案，一名國中少女遭性侵殺害，警方偵辦。"}),
       ("quiet.json", "https://www.ettoday.net/news/20190727/1500001.htm", {"summary": "北屯發生命案，一名罕病幼童遇害，母親涉案。"}),
       ("quiet.json", "https://news.ltn.com.tw/news/society/paper/1305516", {"summary": "台中發生毒趴命案，一名少女身亡，涉案3人受審。"}),
       ("quiet.json", "https://news.ltn.com.tw/news/society/breakingnews/2855452", {"summary": "台中一家汽車旅館發現一名少女身亡，檢方相驗。"})]
for f in ("quiet.json", "falls.json", "floaters.json", "fire.json", "safety.json", "kids.json", "drug.json"):
    for r in load(f)["records"]:
        r["sources"] = [s for s in r["sources"] if s["url"] not in DROP_SRC]
for f, link, fields in FIX:
    for r in load(f)["records"]:
        if link in {s["url"] for s in r["sources"]}:
            r.update(fields)
            for k in [k for k, v in fields.items() if v is None]: r.pop(k)
# 2026-10-26 hand review of the auto-imported rows (placeholder summaries): off-topic news is dropped,
# the rest get a summary written from the report and a checked type
REVIEW = json.load(open(f"{sys.argv[1]}/review.json"))
for f in {v["file"] for v in REVIEW.values()}:
    d = load(f); keep = []
    for r in d["records"]:
        v = REVIEW.get(r["sources"][0]["url"]) if r["sources"] else None
        if v and v["file"] != f: v = None
        if v and v.get("drop"): continue
        if v and v.get("merge"):  # a follow-up report of the same case: its links go to the first record
            t = next(x for x in d["records"] if x["sources"][0]["url"] == v["merge"])
            t["sources"] += [s for s in r["sources"] if s["url"] not in {x["url"] for x in t["sources"]}]
            continue
        if v and v.get("title"): r["title"] = v["title"]
        if v:
            r["summary"], r["fear"] = v["summary"], v["fear"] + [x for x in r.get("fear", []) if x == "D" and "D" not in v["fear"]]
            if not r["fear"]: r.pop("fear")  # no types of its own: the record takes its island's
        keep.append(r)
    d["records"] = keep
# court or settlement reports whose first report is not on the site: the record stands for the case, so it keeps its death
KEEP_DEATH = {"https://news.tvbs.com.tw/local/3212634", "https://udn.com/news/story/7321/9447325",
              "https://news.tvbs.com.tw/local/3081543", "https://www.ettoday.net/news/20200513/1712977.htm"}
for r in load("drug.json")["records"]:
    if KEEP_DEATH & {s["url"] for s in r["sources"]} and "D" not in r.get("fear", []):
        r["fear"] = r.get("fear", []) + ["D"]
# drug-island records about statistics, notices or a crash with no deaths: keep the news, drop the death mark
NOT_DEATH = {"https://news.tvbs.com.tw/local/2204620", "https://www.setn.com/news/1640405", "https://www.taichung.gov.tw/8868/8872/9962/3310440", "https://news.pts.org.tw/article/741380", "https://news.ltn.com.tw/news/society/breakingnews/5227207", "https://news.ebc.net.tw/news/society/404119"}
for r in load("drug.json")["records"]:
    if NOT_DEATH & {s["url"] for s in r["sources"]}:
        r["fear"] = [x for x in r.get("fear", []) if x != "D"]
# death records whose place was only 台中 or whose title was a date placeholder: district from the article leads,
# title from a source headline (never one naming a suicide method), checked by hand 2026-10-24
for e in json.load(open(f"{sys.argv[1]}/placefix.json")):
    for r in load(e["file"])["records"]:
        if e["url"] in {s["url"] for s in r["sources"]}:
            if e.get("place") and r.get("place") in ("台中", "臺中", None):
                r["place"] = e["place"]
                r["summary"] = r.get("summary", "").replace("台中", e["place"], 1) if r.get("summary", "").startswith("台中") else r.get("summary")
            if e.get("title") and (not r.get("title") or re.match(r"\d{4}/\d+/\d+ ", r["title"])):
                r["title"] = e["title"]
for f, d in files.items():
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
print("merged", done)
