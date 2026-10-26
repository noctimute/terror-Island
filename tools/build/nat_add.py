import json, sys
sys.path.insert(0, sys.argv[1])
from build import sources
p = "/home/user/terror-Island/lumama/nat.json"
d = json.load(open(p))
ids = {r["id"] for r in d["records"]}
Y1 = "https://tw.news.yahoo.com/%E8%AD%B0%E5%93%A1%E8%B3%AA%E7%96%91%E4%B8%AD%E5%B8%82%E5%BA%9C%E4%BD%BF%E7%94%A8%E4%B8%AD%E5%9C%8B%E5%93%81%E7%89%8C%E7%84%A1%E4%BA%BA%E6%A9%9F-%E7%B1%B2%E5%84%98%E9%80%9F%E6%9B%B4%E6%8F%9B-%E5%9C%96-104826002.html"
Y2 = "https://tw.news.yahoo.com/%E7%96%91%E6%8E%A1%E8%B3%BC%E4%B8%AD%E5%9C%8B%E5%93%81%E7%89%8C%E7%84%A1%E4%BA%BA%E6%A9%9F-%E4%B8%AD%E5%B8%82%E5%BA%9C%E7%A2%BA%E8%AA%8D%E5%87%BA%E7%94%A2%E4%BE%86%E6%BA%90%E5%85%88%E5%81%9C%E7%94%A8-103453601.html"
Y3 = "https://tw.news.yahoo.com/%E4%B8%AD%E5%B8%82%E5%BA%9C%E7%84%A1%E4%BA%BA%E6%A9%9F%E7%BE%8E%E5%9C%8B%E5%93%81%E7%89%8C%E6%B7%B1%E5%9C%B3%E8%A3%BD%E9%80%A0-%E4%BA%A4%E9%80%9A%E5%B1%80%E8%A6%81%E6%9F%A5-095926668.html"
NEW = [
    ("n-bus324", "324路公車行駛中起火燒成骨架 議員指是中國福田製柴油車", "2024-07-30", "西屯", "台中客運 324 路公車在西屯都會公園附近起火、燒到只剩骨架，司機及時疏散 5 名乘客；議員指這款低地板車是中國福田汽車生產的柴油車、不是電動車，交通局要求同款 55 輛一個月內完成安檢。", "https://www.ettoday.net/news/20240730/2787590.htm https://newtalk.tw/news/view/2024-07-31/930285 https://news.ltn.com.tw/news/life/breakingnews/4755196"),
    ("n-brt", "BRT雙節公車中國母公司停產 恐成維修孤兒", "2020-05-29", "台中", "台中當年為 BRT 引進的 64 輛宇通雙節公車，議員指中國母公司鄭州宇通已停產這款車型，擔心零件與維修沒有著落；交通局說零件已備料，營運不受影響。", "https://news.ltn.com.tw/news/politics/breakingnews/3181317 https://news.pts.org.tw/article/480925"),
    ("n-autel", "交通局無人機竟是中國品牌 先停用查產地", "2024-05-07", "台中", "議員質詢指交通局 3 台無人機品牌是 Autel Robotics，母公司是深圳道通智能；交通局說依中央共同供應契約採購，已先停用並確認產地，若有中資背景就更換。", f"{Y1} {Y2} {Y3}"),
    ("n-dji", "消防局救災被拍到用中國製無人機 盧秀燕要求嚴查", "2025-11-14", "龍井", "龍井一場工廠火警中，台中市消防局被拍到使用中國大疆無人機，議員質疑違反規定；盧秀燕要求嚴查，消防局說已封存所有中國製無人機。", "https://www.cna.com.tw/news/aloc/202511140276.aspx"),
    ("n-underpass", "台灣大道地下道裝海康威視監視器 8座128支", "2019-07-18", "台中", "議員發現台灣大道沿線地下道裝的是中國海康威視監視器；養工處清查有 8 座地下道、共 128 支，承諾請廠商更換，後來說已全數汰換為台製設備。", "https://newtalk.tw/news/view/2019-07-18/274217 https://news.pts.org.tw/article/438508"),
]
for i, t, dt, pl, sm, ln in NEW:
    if i in ids: continue
    d["records"].append({"id": i, "title": t, "date": dt, "place": pl, "summary": sm, "sources": sources(ln)})
d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
json.dump(d, open(p, "w"), ensure_ascii=False, indent=1)
print(len(d["records"]))
