"""Preserve generated alpha; resize/compress the selected native ImageGen output."""
from pathlib import Path
import hashlib,json,sys
from PIL import Image

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1])
archive=root/'.art-source'/'blood-atlas-v3';archive.mkdir(parents=True,exist_ok=True)
saved=archive/'imagegen-source.png';saved.write_bytes(source.read_bytes())
image=Image.open(saved).convert('RGBA')
native_size=image.size
image=image.resize((1024,1024),Image.Resampling.LANCZOS)
output=root/'assets'/'textures'/'blood-residue-atlas-v3.webp'
image.save(output,'WEBP',quality=92,method=6,exact=True)
decoded=Image.open(output).convert('RGBA')
tiles=[]
for row in range(2):
 for col in range(2):
  tile=decoded.crop((col*512,row*512,(col+1)*512,(row+1)*512))
  alpha=tile.getchannel('A');box=alpha.point(lambda value:255 if value>=8 else 0).getbbox()
  assert box and box[0]>=8 and box[1]>=8 and box[2]<=504 and box[3]<=504,('atlas gutter',row,col,box)
  tiles.append({'row':row,'column':col,'alphaBounds':box})
assert decoded.getchannel('A').getextrema()==(0,255)
evidence=root/'art'/'combat-realism-v1';evidence.mkdir(parents=True,exist_ok=True)
manifest={'source':'Native built-in ImageGen','archive':str(saved.relative_to(root)).replace('\\','/'),
 'nativeResolution':native_size,'runtime':str(output.relative_to(root)).replace('\\','/'),'runtimeResolution':decoded.size,
 'runtimeBytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'alphaPreserved':True,
 'processing':'RGBA Lanczos resize plus WebP encoding; no creative image edits','alphaAuditThreshold':8,'tiles':tiles}
(evidence/'blood-atlas-v3-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest))
