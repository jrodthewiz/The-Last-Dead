"""Arrange unmodified QA screenshots into labeled vision-review sheets."""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/(sys.argv[1] if len(sys.argv)>1 else 'output/playwright/fps-arms-v5-angle-review')
report=json.loads((folder/'report.json').read_text())
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',19)
angles=['dorsal','palmar','radial','ulnar','distal','proximal']
groups=sorted(set((c['weapon'],c['side']) for c in report['captures']))
index=[]
def tile(sheet,c,x,y,w=360,h=288):
    im=Image.open(folder/c['file']).convert('RGB');im.thumbnail((w,h))
    sheet.paste(im,(x+(w-im.width)//2,y))
    draw=ImageDraw.Draw(sheet)
    draw.text((x+6,y+h+3),f"{c['angle']} / {c['mode']} / {c['phase']} {c['time']:.3f}s",font=font,fill='#eeeeee')
for weapon,side in groups:
    sheet=Image.new('RGB',(2160,40+3*321),'#192126');draw=ImageDraw.Draw(sheet)
    draw.text((15,8),f'{weapon} / {side} — exported skin, six anatomical angles. Rows: material, clay, solid hardware.',font=font,fill='white')
    for row,mode in enumerate(['material','clay','contact']):
        for col,angle in enumerate(angles):
            c=next(c for c in report['captures'] if c['weapon']==weapon and c['side']==side and c['angle']==angle and c['mode']==mode and c['phase']=='idle')
            tile(sheet,c,col*360,40+row*321)
    path=f'SHEET-{weapon}-{side}-angles.jpg';sheet.save(folder/path,quality=95);index.append(path)
    for mode in ['material','clay','contact','xray']:
        selected=[c for c in report['captures'] if c['weapon']==weapon and c['side']==side and c['phase']=='idle' and c['mode']==mode]
        if not selected:continue
        sheet=Image.new('RGB',(1500,890),'#192126');draw=ImageDraw.Draw(sheet)
        draw.text((15,8),f'{weapon} / {side} / {mode} — six anatomical directions',font=font,fill='white')
        for i,angle in enumerate(angles):
            c=next(c for c in selected if c['angle']==angle)
            tile(sheet,c,(i%3)*500,40+(i//3)*425,500,400)
        path=f'SHEET-{weapon}-{side}-{mode}.jpg';sheet.save(folder/path,quality=95);index.append(path)
    for phase,angle in [(phase,angle) for phase in ['draw','fire','strike'] for angle in ['dorsal','palmar','radial']]:
        selected=[c for c in report['captures'] if c['weapon']==weapon and c['side']==side and c['phase']==phase and c['angle']==angle]
        if not selected:continue
        selected.sort(key=lambda c:c['time']);rows=math.ceil(len(selected)/4)
        sheet=Image.new('RGB',(2000,40+rows*425),'#192126');draw=ImageDraw.Draw(sheet)
        draw.text((15,8),f'{weapon} / {side} / {phase} — sampled authored poses, not continuous video.',font=font,fill='white')
        for i,c in enumerate(selected):tile(sheet,c,(i%4)*500,40+(i//4)*425,500,400)
        path=f'SHEET-{weapon}-{side}-{phase}-{angle}.jpg';sheet.save(folder/path,quality=95);index.append(path)
    selected=[c for c in report['captures'] if c['weapon']==weapon and c['side']==side and c['mode']=='handle']
    if selected:
        sheet=Image.new('RGB',(1500,40+math.ceil(len(selected)/3)*425),'#192126');draw=ImageDraw.Draw(sheet)
        draw.text((15,8),f'{weapon} / {side} — actual opaque handles, other hardware hidden',font=font,fill='white')
        for i,c in enumerate(selected):tile(sheet,c,(i%3)*500,40+(i//3)*425,500,400)
        path=f'SHEET-{weapon}-{side}-handle.jpg';sheet.save(folder/path,quality=95);index.append(path)
(folder/'sheet-index.json').write_text(json.dumps(index,indent=2))
print('Contact sheets:',len(index))
