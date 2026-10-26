# 噤聲島: the research lawsuits table (lawsuits/taichung_gov_lawsuits.csv), only rows judged as silencing speech.
# Titles and summaries are written here (no names); sources come from the table's links.
import csv, json, re, sys
sys.path.insert(0, sys.argv[1])
from build import sources, RES, SITE

TEXT = {  # date in the table -> (id, place, title, summary)
    "2019-01-05": ("v-fbdelete", "台中", "市長粉專刪除批評空污留言 新聞局要求小編檢討",
                   "網友在市長臉書粉專貼霾害照片、質疑空污改善承諾，部分留言遭小編刪除並回覆「勿人身攻擊」，引發網友不滿；新聞局長表示已要求小編群檢討調整。"),
    "2019-07-02": ("v-policegag", "台中", "警局重大案件封口 卻開員警減肥記者會挨轟",
                   "警察局以偵查不公開新制為由，不說明保母虐童、疑似偽鈔等重大案件，還要民眾別把監視器畫面提供給記者，同時卻召開員警減肥成果記者會，遭記者批評；警局公關室主任承認解讀過嚴、影響知的權利，表示會檢討修正。"),
    "2019-07-27": ("v-fbblock", "台中", "市長粉專被指封鎖異見網友 議員批一言堂",
                   "議員指網友在市長臉書粉專留言反映空污、社宅公有地出售、競選經費等問題後遭封鎖，批評公費經營的粉專成了一言堂；新聞局長回應理性意見都會轉給局處，否認一言堂。"),
    "2022-07-25": ("v-gunnews", "大里", "潭子槍案隔天大里又傳槍響 議員質疑警方封鎖消息",
                   "潭子滷味攤槍殺案發生後，隔天大里又傳出槍響，議員質疑警方封鎖消息；警方之後證實大里案開槍主嫌在逃。"),
    "2024-10-17": ("v-busnews", "台中", "警局文件建議「勿一直發布公車違規新聞」 議員轟壓新聞",
                   "東海大學女大生遭左轉公車撞死後，市府啟動公車大執法；議員公開警察局一份文件，建議「勿一直發布公車違規或事故新聞，避免讓民眾有台中公車常常違規的負面觀感」，批評市府壓新聞。警局稱只是公關室的建議、未做成決議；市長表示不認同警局作法、必須調整。"),
    "2024-12-16": ("v-cvhide", "台中", "數位治理局長曾任職中資背景媒體 市府官網簡歷漏列",
                   "媒體揭露新任數位治理局長曾任職中資背景媒體，市府官網的局長簡歷卻沒有列出這段經歷，被批隱匿。之後未見市府說明。"),
    "2025-12-04": ("v-poolgun", "西屯", "親子泳池男子持槍對幼童扣扳機 拖 2 個月才曝光 議員批壓新聞",
                   "2025 年 10 月 10 日西屯一處親子泳池，有男子持改造手槍對幼童扣扳機，約 2 個月後才被媒體披露；議員批評市府粉飾太平、壓新聞、沒有即時示警，警方以偵查不公開為由不回應。另有評論文章批市府「封鎖新聞」。"),
    "2026-04-22": ("v-gagorder", "台中", "議會請警方說明辣椒水案 副分局長接電話後改口「統一回應」",
                   "議會民進黨團邀警方說明候選人掃街時遭辣椒水誤噴一案，第六分局副分局長接了一通電話後，只回應「由警察局統一回應」，議員質疑警方被下封口令、選擇性沉默。之後未見警局說明。"),
    "2026-07-20": ("v-oilhide", "台中", "中聯致癌油案 市府被質疑隱匿檢驗資料",
                   "中聯油脂致癌油案中，有評論者指市府沒有對中聯產品檢驗苯駢芘，對外說法卻前後不一，質疑市府隱匿、造假資料；市府新聞局長回應已盡力滿足民眾的知情權。"),
    "2026-08-26": ("v-fbblock2", "台中", "網友批評月餅、毒油案後 稱遭市長粉專封鎖",
                   "月餅棄單、預算凍結、毒油案等爭議期間，大批網友在市長臉書粉專留言批評後，回報被封鎖、看不到貼文；媒體詢問市府，未獲回應。"),
    "2019-07-26": ("v-qingji", "台中", "KUSO 短片諷「慶記之都」 導演等 4 人遭社維法移送",
                   "影片公司在 YouTube 上傳以道具槍演出路上開槍的 KUSO 短片，片尾字幕「別的地方可以，台中千萬不行」，被指暗諷台中治安；警察局刑大依社維法將導演等 4 人移送，影片下架。之後未見裁罰結果報導。"),
    "2020-09-16": ("v-carleak", "台中", "網友爆料局長公務車私用 建設局長揚言提告",
                   "網友跟拍台中市建設局長開公務車接送家人，影片上傳爆料公社；局長發聲明稱有付費，將依法對爆料者提出告訴。之後未見提告後續報導。"),
    "2023-07-08": ("v-rumor500m", "台中", "網傳市府官員與五億案關係人是親屬 市府揚言提告",
                   "網路流傳市長及稅務局副局長與「五億高中生案」關係人有親屬關係，市府發布謠言澄清，稱已保全證據，未刪文者將依法提出刑事告訴。之後未見提告後續報導。"),
    "2023-12-13": ("v-flashlight", "大里", "直播拔除爆閃燈電源抗議 路權團體 3 人遭移送",
                   "路權團體成員陳情路口爆閃燈刺眼、設置於法無據未果，直播自行拔除大里路口爆閃燈電源抗議，遭警方以毀損公物等罪移送，檢方緩起訴；立委質疑爆閃燈的法源依據。本件屬抗議行為。"),
    "2025-07-28": ("v-4wan", "南區", "Threads 貼「普發4萬」圖卡遭市府報警 法院裁定不罰",
                   "網友在 Threads 張貼「謝謝盧媽媽，台中普發4萬」圖卡，南區區公所報案、市府報警，第三分局依社維法移送，議員批評打壓言論自由。台中地院認屬公共議題的言論自由，裁定不罰。"),
    "2026-10-21": ("v-terrorisland", "台中", "整理台中新聞做成恐怖島 作者自述遭查水表",
                   "恐怖島作者整理台中死亡列表與事件地圖，自述 10/21 遭市府查水表、意圖以社維法法辦，自由時報、三立、鏡報等媒體報導轉述當事人說法。年代新聞 10/26 報導的警方說法則是：警方接獲民眾檢舉後上門將人帶回釐清，是否違反社維法將函送法院簡易庭審理。"),
}
OUTLET = {"threads.com": "Threads", "taichung.gov.tw": "台中市政府", "mradio.com.tw": "全國廣播", "hakkanews.tw": "客家新聞", "eracom.com.tw": "年代新聞"}
recs = []
for x in csv.DictReader(open(f"{RES}/lawsuits/taichung_gov_lawsuits.csv", encoding="utf-8-sig")):
    if not x.get("是否言論壓制", "").startswith("是"):
        continue
    if x["日期"] not in TEXT:
        raise SystemExit(f"new silencing row needs a title and summary: {x['日期']} {x['起因'][:40]}")
    rid, place, title, summary = TEXT[x["日期"]]
    lines = [l.rsplit("｜", 1) for l in x["新聞連結"].splitlines() if "｜" in l]
    head = {u.strip(): t.strip() for t, u in lines}
    srcs = sources("\n".join(head))
    for s in srcs:
        if head.get(s["url"]) and (s["title"].endswith("報導") or "threads.com" in s["url"]):
            s["title"] = head[s["url"]]
    for s in srcs:
        s["outlet"] = OUTLET.get(s["outlet"], s["outlet"])
        # 鏡週刊 reposts 鏡報 stories under /external/; link the original instead
        m = re.match(r"https://www\.mirrormedia\.mg/external/(?:amp/)?mirrordaily_(\d+)", s["url"])
        if m:
            s["url"], s["outlet"] = f"https://www.mirrordaily.news/story/{m[1]}", "鏡報"
    recs.append({"id": rid, "title": title, "date": x["日期"], "place": place, "summary": summary, "sources": srcs})
# press the research table has not picked up yet; skipped once the table carries the same link
EXTRA = {"v-terrorisland": [
    {"title": "20座爭議島嶼直球對決！評論市政遭社維法威脅　網友自建「台中恐怖島」附新聞連結嗆：有憑有據", "outlet": "FTNN 新聞網", "url": "https://www.ftnn.com.tw/news/590303"}]}
for r in recs:
    r["sources"] += [s for s in EXTRA.get(r["id"], []) if s["url"] not in {x["url"] for x in r["sources"]}]
# links left off the site at the author's request (the headline names where the author lives)
DROP = {"https://www.eracom.com.tw/EraNews/Home/Society/2026-10-26/2506842.html"}
for r in recs:
    r["sources"] = [s for s in r["sources"] if s["url"] not in DROP]
recs.sort(key=lambda r: r["date"], reverse=True)
d = {"title": "台中市府壓制言論新聞", "note": "整理自研究資料：市府、警方對批評、爆料、諷刺或整理資料的民眾提告、報警、移送或約談，以及被質疑壓新聞、封口、隱匿資訊、刪留言或封鎖網友的新聞", "helpline": False,
     "fear": ["V"], "danger": 3, "updated": "2026-10-26", "records": recs}
json.dump(d, open(f"{SITE}/silence.json", "w"), ensure_ascii=False, indent=1)
print(len(recs), [len(r["sources"]) for r in recs])
