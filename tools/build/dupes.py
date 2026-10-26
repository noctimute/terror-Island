import json,re,sys,glob
from datetime import date
from collections import Counter
def grams(t):
    t=re.sub(r'【警察】|[^一-鿿0-9]','',t)
    return {t[i:i+2] for i in range(len(t)-1)}
def d(s):
    m=re.match(r'(\d{4})-(\d{2})(?:-(\d{2}))?',s)
    return date(int(m[1]),int(m[2]),int(m[3] or 15)) if m else None
DF=Counter()
ALL={}
for f in glob.glob('*.json'):
    if f=='data.json': continue
    try: R=json.load(open(f))['records']
    except Exception: continue
    for r in R:
        g=grams(r.get('title','')+' '+r.get('summary','')+' '+' '.join(s.get('title','') for s in r.get('sources',[])[:4]))
        ALL[(f,r['id'])]=g; DF.update(g)
days=int(sys.argv[1]); files=sys.argv[2:]
out=[]
for f in files:
    R=json.load(open(f+'.json'))['records']
    for i,a in enumerate(R):
        for b in R[i+1:]:
            if '-i20' not in a['id'] and '-i20' not in b['id']: continue
            da,db=d(a.get('sort') or a['date']),d(b.get('sort') or b['date'])
            if not da or not db or abs((da-db).days)>days: continue
            rare=[g for g in ALL[(f+'.json',a['id'])]&ALL[(f+'.json',b['id'])] if DF[g]<=6]
            if len(rare)>=3: out.append((len(rare),f,a['id'],a['title'][:50],b['id'],b['title'][:50],''.join(rare[:8])))
for o in sorted(out,reverse=True): print(*o,sep=' | ')
