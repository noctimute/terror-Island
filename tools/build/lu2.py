# Two issues added to the research repo's lu_issues.csv on 2026-10-23.
import csv, json, sys
sys.path.insert(0, sys.argv[1])
from build import sources, RES, SITE
LINKS = {x["議題"]: x["新聞連結"] for x in csv.DictReader(open(f"{RES}/lu-administration/lu_issues.csv", encoding="utf-8-sig"))}
ADD = {
    "nat.json": {"id": "n-unify", "issue": "統促會台中「和平統一」遊行與武統學者李毅來台", "title": "統促會台中「和平統一」車隊遊行 市府依法核准挨批", "date": "2019-04", "place": "台中", "fear": ["N"],
        "summary": "盧秀燕上任約三個半月時，統促會申請 4 月 13 日在台中舉辦「支持九二共識、支持統一」車隊遊行與論壇，原邀請鼓吹武統的中國學者主講；市警局依集會遊行法核准，被批替統戰開道。該學者入境後遭移民署廢止許可、強制遣返，遊行當天由主辦方宣布取消。市府表示依法審核，並否認派警車開道。"},
    "land.json": {"id": "l-thugs", "issue": "自辦重劃會理事長買兇毆打地政官員", "title": "自辦重劃會理事長買兇 毆打市府地政官員", "date": "2023-07", "place": "台中",
        "summary": "一個自辦重劃會的理事長因重劃案審查不如己意，花錢找打手，2023 年 7、8 月先後持球棒、鋁棒襲擊市府地政局重劃科科長與大里地政事務所主任，還全程錄影回報。事件到 2025 年一審判決才曝光，理事長依傷害罪被判 2 年（上訴中），被害官員拒絕和解。"},
}
for f, r in ADD.items():
    d = json.load(open(f"{SITE}/{f}"))
    if any(x["id"] == r["id"] for x in d["records"]):
        continue
    r["sources"] = sources(LINKS[r.pop("issue")])
    d["records"].append(r)
    d["records"].sort(key=lambda r: r.get("sort") or r["date"], reverse=True)
    d["updated"] = "2026-10-23"
    json.dump(d, open(f"{SITE}/{f}", "w"), ensure_ascii=False, indent=1)
    print(f, len(d["records"]), [(s["outlet"], s["title"][:30]) for s in r["sources"]])
