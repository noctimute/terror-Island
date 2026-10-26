import json, sys
sys.path.insert(0, sys.argv[1])
from build import sources, titles
titles["https://www.ftvnews.com.tw/news/detail/2026331C06M1"] = "全面掃毒！ 破獲苗栗大型製毒廠 台中販毒集團「假外送真運毒」"
S = "/home/user/terror-Island/lumama/"
def R(i, t, dt, pl, sm, ln, fear=None):
    r = {"id": i, "title": t, "date": dt, "place": pl, "summary": sm, "sources": sources(ln)}
    if fear: r["fear"] = fear
    return r
scam = [
    R("x-mall17", "網路賣場當水房 2年洗17億 南投警破台中大型水房", "2026-08-16", "台中", "集團把水房設在台中，利用網路賣場和第三方支付掩護地下匯兌，替詐騙與線上博弈集團洗錢，兩年多經手約 17.1 億元；南投警方逮捕 28 人，19 人已被起訴。", "https://udn.com/news/story/124490/9694801 https://www.ettoday.net/news/20260816/3220090.htm https://www.setn.com/news/1890346"),
    R("x-drone", "台中刑大破詐團洗錢機房 無人機追捕首腦", "2026-09-30", "台中", "台中刑大破獲跨境詐欺集團的洗錢機房，主嫌逃往山區，警方出動無人機配合地面警力圍捕，全案逮捕約 30 人。", "https://www.mnews.tw/story/20260930sot1238001"),
    R("x-wine", "25家空殼公司洗55億 台中洗錢水房遭聲光彈攻堅", "2026-04-29", "台中", "檢警破獲專替非法博弈網站洗錢的水房，集團用 25 家空殼公司、以收購老酒等名義臨櫃存提現金，洗錢金額約 55 億元，9 名核心成員遭羈押。", "https://news.tvbs.com.tw/local/3191287 https://ctinews.com/news/items/4OaZqX8NW6"),
    R("x-bank", "台中銀分行主管涉勾結博弈詐團 洗錢逾36億", "2026-04-23", "台中", "一名銀行分行主管被控勾結博弈與詐騙集團協助洗錢，金額逾 36 億元，檢方依組織犯罪、詐欺與洗錢等罪起訴；銀行發聲明回應。", "https://udn.com/news/story/7239/9460284"),
    R("x-casino10", "非法博弈水房單月洗錢逾10億 警逮18人", "2024-10-05", "台中", "台中警方破獲替非法博弈網站處理金流的水房，單月洗錢金額逾 10 億元，逮捕 18 人送辦。", "https://www.cna.com.tw/news/asoc/202410050116.aspx"),
    R("x-pay10", "18家人頭公司對接博弈平台 半年洗錢逾10億", "2026-01-05", "台中", "集團用 18 家人頭公司透過非法第三方支付對接線上博弈平台、製造假交易紀錄，半年洗錢逾 10 億元，台中地檢署起訴 9 人。", "https://www.cna.com.tw/news/asoc/202601050090.aspx"),
    R("x-casino13", "刑事局破台中博弈集團 1年賭資1.3億", "2026-06-10", "台中", "刑事局破獲台中一處博弈集團，清查近一年賭資逾 1.3 億元，連同賭客共 24 人被起訴。", "https://www.cna.com.tw/news/asoc/202606100062.aspx"),
    R("x-yd", "「YD支付」跨境博弈洗錢 廈門設據點 半年洗13億", "2026-08-19", "台中", "檢警破獲在廈門設據點、以地產公司充當金流斷點的跨境博弈洗錢水房，半年經手贓款逾 13 億元，11 人被起訴。", "https://udn.com/news/story/7321/9700556"),
    R("x-shop40", "博弈集團偽裝網購 兩年洗錢近40億 起訴26人", "2026-10-21", "台中", "集團把線上博弈賭金包裝成網購商品交易，兩年洗錢近 40 億元、獲利約 1.2 億元；台中地檢署起訴 26 人，主嫌在逃遭通緝。", "https://udn.com/news/story/7315/9827235 https://www.ctwant.com/article/503185/"),
    R("x-relay", "七期豪景商辦設機房 轉接電話規避警示音", "2026-01-22", "西屯", "詐團在七期一處落地窗商辦設機房，用多層國際電話轉接，讓詐騙來電偽裝成市話、避開「注意詐騙」警示音，騙了 9 人逾千萬元，警方破門攻堅。", "https://udn.com/news/story/124490/9281190 https://news.tvbs.com.tw/local/3107604"),
    R("x-police", "假冒公安騙海外華人 詐團租7間豪宅當機房", "2026-06-24", "台中", "詐團在台中租下 7 間豪宅設話務機房，假冒中國公安詐騙海外華人，撈了約 3 千萬元。", "https://www.ettoday.net/news/20260624/3189179.htm"),
    R("x-invest65", "假投資詐騙65億 詐團買七期豪宅", "2024-01-02", "西屯", "假投資集團吸金與詐騙金額逾 65 億元，調查局與台中地檢署搜索 24 處；集團用不法所得買下七期豪宅、名車與名牌包。", "https://www.mirrormedia.mg/story/20240102inv014"),
    R("x-cbd", "七期商辦藏博弈機房 一棟查獲3處逮28人", "2022-12-15", "西屯", "刑事局在七期一棟商辦大樓裡查獲 3 處地下博弈與詐騙機房，逮捕 28 人，七期被形容成「詐欺聖地」。", "https://news.ebc.net.tw/news/society/348363"),
    R("x-lambo", "21歲男組詐團藏七期商辦 1年騙3千萬買藍寶堅尼", "2022-12-14", "西屯", "一名 21 歲男子組詐團，把機房設在七期高級商辦，一年騙走近 3 千萬元，錢全拿去買藍寶堅尼、名錶與名牌包。", "https://www.ctwant.com/article/226403/"),
]
drug = [
    R("d-benz", "賓士女毒駕撞6車 驗出4種毒品 男騎士遭夾擊身亡", "2026-07-19", "豐原", "一名女駕駛在豐原中山路追撞停等紅燈的機車，又一路衝撞多輛車，造成一名下班回家的騎士身亡；快篩驗出 4 種毒品反應，依公共危險罪送辦。", "https://www.chinatimes.com/realtimenews/20260719002329-260402 https://www.setn.com/news/1875101 https://www.worldjournal.com/wj/story/121222/9638530", ["X", "D"]),
    R("d-hitrun", "毒駕撞死行人肇逃還滅證 交保被駁回", "2026-04-05", "大雅", "一名男子毒駕撞倒行人後駕車逃逸，行人送醫不治；尿檢驗出安非他命，檢方依毒駕致死與肇逃起訴，法院駁回他的停押聲請。", "https://udn.com/news/story/7321/9808543", ["X", "D"]),
    R("d-ntus", "毒駕失控撞3名晨跑體大生 友人想頂替", "2026-10-03", "北區", "一名男子毒駕失控衝向雙十路天橋，撞傷 3 名晨跑的體大學生；同車友人還想頂替駕駛，檢方聲請羈押。", "https://udn.com/news/story/7315/9793012", ["X"]),
    R("d-bmw", "吸多種毒品開BMW撞死退休公務員 一審判12年多", "2024", "北屯", "一名少年吸食多種毒品後開租來的 BMW，在北屯撞死一名退休公務員後逃逸；一審以殺人等罪判處 12 年 5 月，二審審理中、法院裁定延押。", "https://www.chinatimes.com/realtimenews/20261016001110-260402", ["X", "D"]),
    R("d-572", "台中毒駕移送3年暴增572倍", "2026-06-21", "台中", "議員指台中毒駕移送人次從 2023 年 2 人次增加到 2025 年 1145 人次；警方說主要是全面使用唾液快篩、查緝更精準，今年 1 到 7 月已查獲 1449 件。", "https://www.cna.com.tw/news/aloc/202606210109.aspx https://udn.com/news/story/7325/9579023 https://www.cna.com.tw/news/asoc/202608060170.aspx", ["X"]),
    R("d-zombie", "喪屍煙彈分裝場 藥頭擁槍", "2026-07-13", "台中", "台中警方破獲一處依托咪酯（喪屍煙彈）分裝場，27 歲藥頭還持有槍枝；依托咪酯今年已升為一級毒品。", "https://udn.com/news/story/7315/9623747", ["X"]),
    R("d-pigeon", "鴿飼料工廠變毒品分裝場", "2026-08-31", "台中", "保三總隊查出有人利用鴿子飼料工廠掩護，在廠內製造、分裝依托咪酯毒品，嫌犯遭羈押禁見。", "https://news.ltn.com.tw/news/Taichung/breakingnews/5557694", ["X"]),
    R("d-8layer", "花9個月瓦解販毒集團 斬斷8層供銷網絡", "2026-06-24", "台中", "第三分局花 9 個月追查，瓦解 11 人販毒集團，斬斷 8 層垂直供銷網絡，起獲百餘顆喪屍菸彈，全案已起訴。", "https://udn.com/news/story/7315/9585513", ["X"]),
    R("d-delivery", "台中販毒集團「假外送真運毒」", "2026-03-31", "台中", "台中市刑大破獲用通訊軟體接單、以外送平台當掩護的販毒集團，逮捕 5 人。", "https://www.ftvnews.com.tw/news/detail/2026331C06M1", ["X"]),
    R("d-spicy", "嫌喪屍煙彈太辣自己稀釋 依製毒罪判2年8月", "2026-10-02", "台中", "一名男子嫌依托咪酯煙彈「太辣」，自行加甘油稀釋，法院認定是「毒品優化加工」，依製造二級毒品罪判 2 年 8 月。", "https://news.ltn.com.tw/news/Taichung/breakingnews/5600571 https://udn.com/news/story/7315/9790007", ["X"]),
]
g = json.load(open(S + "graft.json"))
moved = [r for r in g["records"] if r["id"] in ("k-shopee", "k-scam")]
g["records"] = [r for r in g["records"] if r["id"] not in ("k-shopee", "k-scam")]
if not any(r["id"] == "k-officer-verdict" for r in g["records"]):
    g["records"].append(R("k-officer-verdict", "【警察】刑事小隊長供毒給女線民、毒駕上班 台中地院判刑免職", "2026-10-13", "台中", "第二分局一名偵查隊小隊長在汽車旅館無償提供安非他命給辦案認識的女線民，自己吸毒後還騎車到分局上班；台中地院依轉讓禁藥罪、毒駕罪各判 6 月，警局記兩大過免職，全案可上訴。", "https://news.pts.org.tw/article/831565 https://news.ltn.com.tw/news/Taichung/breakingnews/5604871 https://udn.com/news/story/7315/9811655 https://news.ttv.com.tw/news/11510130003100W https://www.ftnn.com.tw/news/586992", ["K", "X"]))
g["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
json.dump(g, open(S + "graft.json", "w"), ensure_ascii=False, indent=1)
for r in moved:
    r["fear"] = ["Z"]
scam = [{**r, "fear": ["Z"]} for r in scam]
# the moved shopee record is the same case as x-mall17: keep the newer one, carry over its sources
mall = next(r for r in scam if r["id"] == "x-mall17")
for r in moved:
    if r["id"] == "k-shopee":
        mall["sources"] += [s for s in r["sources"] if s["url"] not in {x["url"] for x in mall["sources"]}]
    else:
        scam.append(r)
scam.sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
json.dump({"title": "台中詐騙與洗錢新聞", "updated": "2026-10-22", "records": scam}, open(S + "scam.json", "w"), ensure_ascii=False, indent=1)
drug.sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
json.dump({"title": "台中毒駕與毒品新聞", "updated": "2026-10-22", "records": drug}, open(S + "drug.json", "w"), ensure_ascii=False, indent=1)
print(len(scam), len(drug), len(g["records"]))
