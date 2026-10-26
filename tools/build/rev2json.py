# rev/<file>.txt lines "id<TAB>DROP" or "id<TAB>fear[,fear]<TAB>summary" -> review.json keyed by the record's first link
import glob, json, os, sys
S = sys.argv[1]; SITE = "/home/user/terror-Island/lumama"
p = f"{S}/review.json"; R = json.load(open(p)) if os.path.exists(p) else {}
for t in sorted(glob.glob(f"{S}/rev/*.txt")):
    f = os.path.basename(t)[:-4] + ".json"
    recs = {r["id"]: r for r in json.load(open(f"{SITE}/{f}"))["records"]}
    for line in open(t, encoding="utf-8"):
        if not line.strip(): continue
        a = line.rstrip("\n").split("\t")
        if a[0] not in recs:
            continue  # already applied (dropped) on an earlier run
        u = recs[a[0]]["sources"][0]["url"]
        if a[1] == "DROP": R[u] = {"file": f, "drop": True}
        elif a[1] == "MERGE": R[u] = {"file": f, "merge": recs[a[2]]["sources"][0]["url"]}
        else:
            R[u] = {"file": f, "fear": [] if a[1] == "_" else a[1].split(","), "summary": a[2]}
            if len(a) > 3: R[u]["title"] = a[3]
json.dump(R, open(p, "w"), ensure_ascii=False, indent=0)
print(len(R))
