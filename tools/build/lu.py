import json, sys
sys.path.insert(0, sys.argv[1])
from build import sources  # noqa: reuses the title cache and outlet names
SITE = "/home/user/terror-Island/lumama"
ADD = {
    "food.json": [
        {"id": "f-avian", "title": "豐原蛋雞場禽流感 業者隱匿17天才通報", "date": "2026-01", "place": "豐原", "summary": "豐原一處蛋雞場雞隻從 1 月上旬開始異常死亡，業者未通報、私下掩埋死雞並繼續賣蛋；民眾在社群爆料後市府才介入，驗出 H5N1，撲殺約 7 千隻，業者被罰 115 萬元。", "links": "https://udn.com/news/story/7266/9293340 https://www.nownews.com/news/6780855 https://www.businesstoday.com.tw/article/category/183027/post/202601280061/ https://www.cna.com.tw/news/aloc/202602020252.aspx"},
        {"id": "f-ractopamine", "title": "台糖梅花肉片驗出瘦肉精西布特羅", "date": "2024-01", "place": "台中", "summary": "台中市食安處抽驗台糖梅花肉片，驗出瘦肉精西布特羅；中央與市府對是否為實驗室汙染各說各話，行政院結論是無法排除也無法證實。", "links": "https://udn.com/news/story/7266/7760392 https://news.pts.org.tw/article/679612 https://news.tvbs.com.tw/politics/2388524 https://health.ettoday.net/news/2679868"},
    ],
    "graft.json": [
        {"id": "k-land", "title": "地政局長用首長特別費請親友吃飯 依貪污判2年緩刑", "date": "2025-02", "place": "台中", "summary": "台中市地政局長被控 11 次以首長特別費核銷親友餐敘，遭搜索後交保並請辭；台中地院依貪污罪判處 2 年、緩刑 5 年，所得已全數繳回。", "links": "https://newtalk.tw/news/view/2025-03-03/958845 https://news.ltn.com.tw/news/politics/breakingnews/4967596 https://udn.com/news/story/7321/9468414 https://udn.com/news/story/7321/9223227"},
    ],
    "nat.json": [
        {"id": "n-rapidtest", "title": "市府採購的快篩 33萬劑疑混充中國製", "date": "2022-05", "place": "台中", "summary": "Omicron 疫情期間市府採購 43.8 萬劑快篩，其中約 33 萬劑批號疑似是中國製品改貼美國製標籤；市府退貨並移送檢調，進口商負責人遭羈押，多個機關也買到同一廠商的貨。", "links": "https://newtalk.tw/news/view/2022-05-22/758790 https://www.mirrormedia.mg/story/20220613inv006 https://news.pts.org.tw/article/585489 https://www.thenewslens.com/article/168179"},
    ],
    "garbage.json": [
        {"id": "g-shalu-fake", "title": "沙鹿「假停車場」真轉運站 8個月收3萬立方米廢棄物", "date": "2025-12", "place": "沙鹿", "summary": "沙鹿一處登記為停車場的土地，實際上是非法的營建廢棄物轉運站，8 個月收了約 3 萬立方米廢棄物，台中地檢署起訴 104 人。", "links": "https://www.mirrormedia.mg/story/20251226inv002 https://news.pts.org.tw/article/787826"},
    ],
    "safety.json": [
        {"id": "s-pedestrian", "title": "台中2025年行人死亡57人 全國最多", "date": "2025", "sort": "2025-12", "place": "台中", "summary": "交通部統計，台中 2025 年行人事故 30 日內死亡 57 人，是各縣市最多；市府回應整體事故死亡人數較前年減少，減幅六都第一。", "links": "https://udn.com/news/story/7266/9134533 https://www.ctee.com.tw/news/20260313701369-431401 https://news.ltn.com.tw/news/Taichung/breakingnews/5556716"},
    ],
    "kids.json": [
        {"id": "y-bus", "title": "校車司機長期性侵女學生 疫調才揭發", "date": "2026-06", "place": "台中", "summary": "一名校車司機長期性侵女學生，多名被害人感染 HIV，是衛生單位疫調時才發現；外界批評通報與校園監督失靈。", "links": "https://udn.com/news/story/7317/9564539 https://udn.com/news/story/7320/9565598 https://www.mirrormedia.mg/story/20260613edi009 https://www.chinatimes.com/realtimenews/20260613002187-260405 https://news.ebc.net.tw/news/society/556387"},
    ],
}
for f, recs in ADD.items():
    d = json.load(open(f"{SITE}/{f}"))
    ids = {r["id"] for r in d["records"]}
    for r in recs:
        if r["id"] in ids:
            continue
        r["sources"] = sources(r.pop("links"))
        d["records"].append(r)
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    d["updated"] = "2026-10-22"
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
    print(f, len(d["records"]), [s["title"][:25] for r in recs for s in r["sources"]])
