"""Gera src/lib/winery-map/countries.json (contornos simplificados dos países produtores de vinho).
Fonte: Natural Earth 1:50m (domínio público). Uso: python3 scripts/build-country-shapes.py /caminho/ne_50m_admin_0_countries.geojson
"""
import json, math, sys

ISO = ["BRA","ARG","CHL","URY","PER","BOL","MEX","USA","CAN","FRA","ITA","ESP","PRT","DEU","AUT","CHE","HUN","GRC",
       "SVN","HRV","ROU","MDA","BGR","SRB","GEO","ARM","TUR","LBN","ISR","CYP","ZAF","AUS","NZL","CHN","JPN","GBR",
       "MAR","TUN","CZE","SVK","UKR","LUX","BEL","NLD","DNK","COL","VEN","IND","MKD","MNE","ALB","BIH","PRY","ECU"]

def area(r):
    return abs(sum(r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1] for i in range(len(r)-1)))/2

def centroid(r):
    xs=[p[0] for p in r]; ys=[p[1] for p in r]
    return sum(xs)/len(xs), sum(ys)/len(ys)

def dp(pts, tol):
    if len(pts) < 3: return pts
    stack=[(0,len(pts)-1)]; keep={0,len(pts)-1}
    while stack:
        a,b=stack.pop(); ax,ay=pts[a]; bx,by=pts[b]; dx,dy=bx-ax,by-ay; L=math.hypot(dx,dy) or 1e-12
        best,bi=0,-1
        for i in range(a+1,b):
            px,py=pts[i]; d=abs(dy*px-dx*py+bx*ay-by*ax)/L
            if d>best: best,bi=d,i
        if best>tol: keep.add(bi); stack+= [(a,bi),(bi,b)]
    return [pts[i] for i in sorted(keep)]

src=json.load(open(sys.argv[1]))
out={}
for f in src["features"]:
    p=f["properties"]; a3=p["ADM0_A3"]
    if a3 not in ISO: continue
    g=f["geometry"]; polys=g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
    outers=[pl[0] for pl in polys]
    big=max(outers,key=area); A=area(big)
    x0=min(q[0] for q in big); x1=max(q[0] for q in big); y0=min(q[1] for q in big); y1=max(q[1] for q in big)
    ex,ey=(x1-x0)*0.25,(y1-y0)*0.25
    kept=[r for r in outers if area(r)>=A*0.005 and x0-ex<=centroid(r)[0]<=x1+ex and y0-ey<=centroid(r)[1]<=y1+ey]
    allx=[q[0] for r in kept for q in r]; ally=[q[1] for r in kept for q in r]
    tol=max(max(allx)-min(allx), max(ally)-min(ally))*0.0025
    rings=[]
    for r in kept:
        m=len(r)//2
        s=dp(r[:m+1],tol)[:-1]+dp(r[m:],tol)
        if len(s)>=4: rings.append([[round(x,3),round(y,3)] for x,y in s])
    iso2=p["ISO_A2_EH"] if p["ISO_A2_EH"]!="-99" else p["ISO_A2"]
    out[a3]={"iso2":iso2.lower(),"name":p["NAME"],"pt":p.get("NAME_PT"),"rings":rings}
missing=[i for i in ISO if i not in out]
json.dump(out,open("src/lib/winery-map/countries.json","w"),separators=(",",":"),ensure_ascii=False)
print("ok",len(out),"missing",missing)
