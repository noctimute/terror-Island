import json, sys
sys.path.insert(0, sys.argv[1])
from build import sources
SITE = "/home/user/terror-Island/lumama"
Y = "https://tw.news.yahoo.com/%E5%A4%AA%E5%8E%9F%E7%A4%BE%E5%AE%85%E7%94%A8%E5%9C%B0%E6%A1%88-%E6%AC%A1%E8%AC%9B%E6%B8%85%E6%A5%9A-%E7%9B%A7%E7%A7%80%E7%87%95-%E5%89%8D%E5%B8%82%E9%95%B7%E6%9E%97%E4%BD%B3%E9%BE%8D%E7%9A%84%E6%B1%BA%E7%AD%96%E4%B8%94%E5%B7%B2%E5%85%88%E8%B3%A3-%E5%8D%8A-081735899.html"
G = "https://tw.news.yahoo.com/%E5%8F%B0%E4%B8%AD%E7%B6%A0%E5%B7%9D%E8%AE%8A-%E5%9E%83%E5%9C%BE%E5%B7%9D-%E8%80%97%E8%B3%878%E5%84%84%E6%95%B4%E6%B2%BB%E4%BB%8A%E6%98%94%E5%B0%8D%E6%AF%94-%E7%B6%B2%E6%89%B9-%E9%82%84%E6%9C%89%E5%B0%BF%E9%A8%B7%E5%91%B3-024100374.html"
land = [
    ("l-taiyuan", "北屯太原段社宅規劃用地 以38億元標售給建商", "2019-07-23", "北屯", "前市府規劃作社會住宅的北屯太原段市有地，以約 38 億元標出、由建商得標，引發「把社宅用地賣給財團」的批評；市府說明那是區段徵收配餘地，前市府任內已先賣出一半，程序合法、價高者得。", f"https://news.pts.org.tw/article/439144 https://newtalk.tw/news/view/2019-07-09/270211 https://news.ltn.com.tw/news/politics/breakingnews/3798070 https://www.chinatimes.com/realtimenews/20220118000391-263101 {Y}"),
    ("l-fiscal", "議員批靠賣地撐「財政平衡」 是財政幻術", "2021-04-22", "台中", "議員指出市府的財政平衡靠標售市有地、區段徵收配餘地與重劃區抵費地約 309 億元收入撐起，批評是「財政幻術」。", "https://www.nownews.com/news/5245458"),
    ("l-housing", "議員質疑社宅用地賣給建商 3年只新增3戶", "2022-01-12", "台中", "議員質疑市府取消部分社會住宅計畫、把社宅用地賣給建商，3 年只新增 3 戶；市府回應是易地興建，總戶數反而更多。", "https://news.ltn.com.tw/news/politics/breakingnews/3798143 https://newtalk.tw/news/view/2022-01-12/695200 https://newtalk.tw/news/view/2022-01-11/695169"),
    ("l-512", "「盧代書」爭議 9次標售約512億元市有地", "2022-03-28", "台中", "前交通局長指盧市府至少 9 次標售、共約 512 億元市有地，包括社宅用地與規劃作青創園區的土地；市府反駁是「竹篙湊菜刀」，賣地收入依法用來償還開發成本。", "https://www.nownews.com/news/5758465 https://newtalk.tw/news/view/2022-03-28/730613"),
    ("l-2024", "13、14期抵費地標售 底價逾200億 內政部曾喊話暫緩", "2024-03-07", "台中", "市府標售 13、14 期重劃區 123 筆抵費地，總底價逾 200 億元，標出 48 筆、約 86 億元，出現每坪逾百萬元的新地王；內政部曾喊話暫緩、改作社宅，綠營批「燕子不動產」助漲房價，市府說售價符合行情。", "https://news.pts.org.tw/article/684362 https://www.cna.com.tw/news/aloc/202403110284.aspx https://www.nownews.com/news/6380775 https://www.nownews.com/news/6380470 https://www.nownews.com/news/6378213"),
    ("l-724", "5年多賣地逾724億 被譏「燕子不動產」", "2024-04-16", "台中", "議員統計盧市府 5 年多標售土地總值逾 724 億元，遠高於前任，被譏為「燕子不動產」；市府強調重劃區抵費地依法要標售償還開發成本。", "https://news.ltn.com.tw/news/politics/breakingnews/4643384 https://www.cna.com.tw/news/aipl/202404160294.aspx https://www.storm.mg/article/5140796"),
    ("l-2025", "籌捷運藍線經費再標售 水湳土地底價520億 標脫率新低", "2025-05-26", "西屯", "為籌措捷運藍線經費，市府再啟動市地標售，水湳經貿園區配餘地總底價約 520 億元，開標結果標脫率、溢價率都創近年新低；民代批市府帶頭炒地皮。", "https://news.pts.org.tw/article/752954 https://www.ctee.com.tw/news/20250626701160-430602 https://www.ctee.com.tw/news/20250811701708-430601"),
    ("l-tears", "盧秀燕稱「賣地含淚籌錢」 議員：誰修法誰負責", "2026-09-18", "台中", "盧秀燕說被中央虧待，只能「賣地含淚籌錢」；議員回應財劃法修法的責任在誰，賣地是市府自己的選擇。", "https://news.ltn.com.tw/news/Taichung/breakingnews/5578713"),
    ("l-dome", "水湳超巨蛋BOT 卸任前簽約引爭議", "2026-10", "西屯", "水湳運動產業園區 BOT 案與民間業者簽約、總投資約 600 億元；藍綠議員都曾喊話應讓下任市長決定，也有議員質疑用地從產業用途改作場館。", "https://news.ltn.com.tw/news/politics/breakingnews/5385153 https://wantrich.chinatimes.com/news/20261017900030-420501 https://udn.com/news/story/7325/9149297"),
]
river = [
    ("r-2019", "整治獲國際獎的綠川 開放後水變混濁、飄異味", "2019-06-01", "中區", "花了多年整治、還得過國際獎項的綠川，開放後被民眾反映河水混濁、飄出異味，水面也有垃圾。", "https://www.setn.com/News.aspx?NewsID=549731"),
    ("r-fish", "綠川魚變少水變濁 居民質疑維護差", "2019-07-12", "中區", "居民反映綠川魚變少、水面長青苔、蚊蠅變多；水利局說是淨水的礫間處理廠設備故障，撈魚是為了護魚，每月光電費就要約 62 萬元。", "https://news.pts.org.tw/article/437684 https://news.pts.org.tw/article/437645"),
    ("r-xmas", "耶誕嘉年華期間 綠川漂死魚", "2024-12", "中區", "耶誕嘉年華期間綠川水面漂著死魚，市府說疑似是天冷造成。", "https://udn.com/news/story/7325/8447567"),
    ("r-trash", "綠川變「垃圾川」 耗資8億整治 網批像臭水溝", "2025-08-18", "中區", "網友比較整治前後的照片，指綠川週末常變成「垃圾川」，岸邊垃圾成堆、還有尿騷味，像臭水溝一樣。", G),
    ("r-yellow", "綠川變「黃河」 上游工地排泥水被罰", "2025-08-20", "中區", "綠川河水突然變黃，民眾怒批水色像大便；環保局查出是上游建築工地開挖地下室、抽地下水時混入泥沙排進綠川，已開罰。", "https://news.ltn.com.tw/news/life/breakingnews/5150086"),
    ("r-stink", "綠川魚死飄臭 議員批市府管理失當", "2025-09-27", "中區", "議員批評曾是整治樣板的綠川現在魚死、飄臭、遊客變少；水利局說定期檢驗水質都達未汙染標準，死魚是枯水期水太淺。", "https://river.udn.com/river/story/124359/9032683"),
]
def rec(t):
    i, title, date, place, summ, links = t
    return {"id": i, "title": title, "date": date, "place": place, "summary": summ, "sources": sources(links)}
json.dump({"title": "台中賣地與建商爭議新聞", "updated": "2026-10-22", "records": [rec(t) for t in reversed(land)]}, open(f"{SITE}/land.json", "w"), ensure_ascii=False, indent=1)
json.dump({"title": "綠川髒亂新聞", "updated": "2026-10-22", "records": [rec(t) for t in reversed(river)]}, open(f"{SITE}/river.json", "w"), ensure_ascii=False, indent=1)
d = json.load(open(f"{SITE}/safety.json"))
if not any(r["id"] == "s-mrt" for r in d["records"]):
    r = rec(("s-mrt", "建案吊臂掉落砸中捷運列車 1死8傷", "2023-05-10", "南屯", "南屯一處建案工地拆除吊車時，吊臂從頂樓掉落、砸中行駛中的中捷綠線列車，造成 1 死 8 傷；市府勒令建案停工並開罰，檢方後來起訴工地相關人員。", "https://news.pts.org.tw/article/636252 https://news.pts.org.tw/article/636176 https://newtalk.tw/news/view/2023-05-12/870740 https://news.pts.org.tw/article/636276"))
    r["fear"] = ["S", "D"]
    d["records"].append(r)
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    json.dump(d, open(f"{SITE}/safety.json", "w"), ensure_ascii=False, indent=1)
for f in ("land", "river"):
    for r in json.load(open(f"{SITE}/{f}.json"))["records"]:
        print(f, r["date"], r["title"], [s["title"][:20] for s in r["sources"]])
