# Gera public/materials/manual-impressao-de-cartas.pdf. Rode: bun scripts/build-manual-pdf.ts && python3 scripts/build-manual-pdf.py
import json, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
for n,q in [("D","DejaVu Sans"),("DB","DejaVu Sans:bold")]:
    pdfmetrics.registerFont(TTFont(n, subprocess.check_output(["fc-match","-f","%{file}",q],text=True).strip()))
m=json.load(open("/tmp/manual.json"))
GOLD,WINE,INK,MUT,BG=HexColor("#B08D1E"),HexColor("#800020"),HexColor("#1f1f1f"),HexColor("#555555"),HexColor("#f6f2e7")
S=lambda n,**k:ParagraphStyle(n,fontName=k.pop("f","D"),fontSize=k.pop("s",10),leading=k.pop("l",14),textColor=k.pop("c",INK),**k)
h1=S("h1",f="DB",s=24,l=30,c=WINE); h2=S("h2",f="DB",s=15,l=20,c=WINE,spaceBefore=4,spaceAfter=4)
lab=S("lab",f="DB",s=8,l=11,c=GOLD); body=S("b"); mut=S("m",c=MUT); small=S("s",s=9,l=12)
def footer(c,d):
    c.saveState(); c.setFont("D",8); c.setFillColor(MUT)
    c.drawString(40,25,f"La Bodeguita · Manual de operação · Impressão de Cartas · v{m['MANUAL_VERSION']} · {m['MANUAL_REVISION']}")
    c.drawRightString(555,25,str(d.page)); c.setStrokeColor(GOLD); c.line(40,38,555,38); c.restoreState()
f=[Spacer(1,120),Paragraph("MANUAL DE OPERAÇÃO",lab),Paragraph("Módulo 1<br/>Impressão de Cartas de Vinhos",h1),Spacer(1,12),
   Paragraph(f"Aprenda, passo a passo, a montar, salvar e imprimir sua carta usando como exemplo a carta do <b>{m['EXAMPLE_RESTAURANT']}</b>.",body),
   Spacer(1,20),Paragraph(f"Versão {m['MANUAL_VERSION']} · revisado em {m['MANUAL_REVISION']}",mut),
   Paragraph("Este PDF é atualizado junto com o aplicativo. Baixe sempre a versão mais recente em Menu › Manual.",mut),PageBreak(),
   Paragraph("Como usar este manual",h2),
   Paragraph("Cada passo traz: <b>o objetivo</b>, <b>onde clicar</b>, <b>o que fazer</b>, <b>um exemplo</b> com a carta do Sabor da Terra e <b>o que conferir</b>. Faça o exemplo no aplicativo e só avance quando o resultado bater.",body),
   Spacer(1,10),Paragraph("A carta de exemplo",h2)]
rows=[]
for s in m["EXAMPLE_MENU"]:
    rows.append([Paragraph(s["title"].upper(),lab),"","",""])
    for w in s["wines"]: rows.append([str(w["n"]),Paragraph(w["name"],small),w["country"],str(w["price"])])
t=Table(rows,colWidths=[28,280,110,60]); st=[("FONT",(0,0),(-1,-1),"D",9),("ALIGN",(3,0),(3,-1),"RIGHT"),("ALIGN",(0,0),(0,-1),"RIGHT"),("TEXTCOLOR",(0,0),(0,-1),MUT),("BOTTOMPADDING",(0,0),(-1,-1),2),("TOPPADDING",(0,0),(-1,-1),2)]
for i,r in enumerate(rows):
    if r[1]=="": st+= [("SPAN",(0,i),(-1,i)),("LINEBELOW",(0,i),(-1,i),0.5,GOLD),("TOPPADDING",(0,i),(-1,i),8)]
t.setStyle(TableStyle(st)); f+=[t,PageBreak()]
for i,s in enumerate(m["PRINTED_MENU_STEPS"],1):
    box=lambda title,txt: Table([[Paragraph(title,lab)],[Paragraph(txt,small)]],colWidths=[237],style=[("BACKGROUND",(0,0),(-1,-1),BG),("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8)])
    blk=[Paragraph(f"Passo {i} · {s['title']}",h2),Paragraph(s["goal"],mut),Spacer(1,4),Paragraph(f"<font color='#B08D1E'><b>Onde:</b></font> {s['where']}",body),Spacer(1,4)]
    blk+=[Paragraph(f"{j}. {a}",body) for j,a in enumerate(s["actions"],1)]
    blk+=[Spacer(1,6),Table([[box("EXEMPLO · SABOR DA TERRA",s["example"]),box("CONFIRA  ☐",s["check"])]],colWidths=[245,245],style=[("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0)])]
    if s.get("tip"): blk+=[Spacer(1,4),Paragraph(f"<font color='#B08D1E'><b>Dica:</b></font> {s['tip']}",mut)]
    f+=[KeepTogether(blk),Spacer(1,16)]
faq=[Paragraph("Dúvidas frequentes",h2)]
for q in m["PRINTED_MENU_FAQ"]: faq+=[Paragraph(f"<b>{q['q']}</b>",body),Paragraph(q["a"],mut),Spacer(1,6)]
f.append(KeepTogether(faq))
SimpleDocTemplate("public/materials/manual-impressao-de-cartas.pdf",pagesize=A4,leftMargin=40,rightMargin=40,topMargin=45,bottomMargin=50,title="Manual — Impressão de Cartas").build(f,onFirstPage=footer,onLaterPages=footer)
