"""Bake a registered flat cabinet projection into the existing shared UV tile.
Offline only. Avoids per-prop maps, UV changes, geometry changes and new samplers.
The six-view model sheet is art direction; the reusable map contains grain only.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
from importlib.util import spec_from_file_location,module_from_spec

ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('projection_bake',ROOT/'scripts/bake-projection-texture.py')
bake=module_from_spec(spec);spec.loader.exec_module(bake)
folder,data,p,n,center,span,views=bake.load('cabinet')
sheet_path=folder/'painted-wood-v3.png'
sheet=Image.open(sheet_path).convert('RGB')
if sheet.size!=(1536,1024):raise ValueError('Wood sheet registration must be exactly 1536x1024')
pixels=np.asarray(sheet,dtype=float)
native=json.loads((folder/'source.json').read_text())
part=next(part for part in native['parts'] if part['name']=='CaseBody')
points=np.asarray(part['positions']).reshape(-1,3)
normals=np.asarray(part['normals']).reshape(-1,3)
face=points[normals[:,2]>.99]
lo=face.min(axis=0);hi=face.max(axis=0)
# Sample the flat interior: omit posts/caps and any model-specific construction
# so the tile can also serve cabinets, drawer cover, piano and wood dressing.
size=512;u,v=np.meshgrid(np.linspace(.12,.88,size),np.linspace(.95,.05,size))
x=lo[0]+u*(hi[0]-lo[0]);y=lo[1]+v*(hi[1]-lo[1])
px=((x-center[0])/span+.5)*511+512
py=(.5-(y-center[1])/span)*511
atlas=bake.bilinear(pixels,px.ravel(),py.ravel()).reshape(size,size,3)
# The projection contributes broad wear/variation; retain the already shipped
# tile's high-frequency grain so the narrow model view does not reduce detail.
original=Image.open(ROOT/'assets/textures/afterlife-cabinet-wood-v1.webp').convert('RGB')
if original.size!=(size,size):raise ValueError('Existing shared slot changed dimensions')
old=np.asarray(original,dtype=float);detail=old-np.asarray(original.filter(ImageFilter.GaussianBlur(2)),dtype=float)
atlas*=old.mean()/max(1,atlas.mean());atlas+=detail*.65
# Periodic gutters inside the original 0..1 tile footprint, without increasing
# dimensions. Preserve detail away from the small boundary blend.
band=20
for axis in [0,1]:
    a=np.moveaxis(atlas,axis,0).copy()
    for i in range(band):
        front=a[i].copy();back=a[-1-i].copy();shared=(front+back)*.5;weight=(1-i/band)**2
        a[i]=front*(1-weight)+shared*weight;a[-1-i]=back*(1-weight)+shared*weight
    atlas=np.moveaxis(a,0,axis)
atlas=np.clip(np.rint(atlas),0,255).astype(np.uint8)
runtime=ROOT/'assets/textures/afterlife-cabinet-wood-projected-v3.webp'
Image.fromarray(atlas).save(runtime,quality=88,method=6)
previous=ROOT/'assets/textures/afterlife-cabinet-wood-v1.webp'
if runtime.stat().st_size>previous.stat().st_size:raise ValueError('Replacement exceeds the existing download budget')
decoded=np.asarray(Image.open(runtime).convert('RGB'),dtype=int)
decoded_boundary=max(int(np.abs(decoded[0]-decoded[-1]).max()),int(np.abs(decoded[:,0]-decoded[:,-1]).max()))
Image.fromarray(atlas).save(folder/'shared-wood-v3.png')
report={'source':'afterlife-props.js:CaseBody rear planar surface','paintedSheet':str(sheet_path.relative_to(ROOT)),
    'projectionView':'back','surfaceUVWindow':[.12,.88,.05,.95],'output':str(runtime.relative_to(ROOT)),
    'resolution':[size,size],'runtimeTextureSlots':1,'runtimeTextureBytesWithMipmaps':round(size*size*4*4/3),
    'replaces':'assets/textures/afterlife-cabinet-wood-v1.webp','runtimeGeometryChange':False,'runtimeUVChange':False,
    'runtimeShaderChange':False,'runtimeSamplerChange':False,'periodicBoundaryBandPixels':band,
    'detailSource':'existing v1 wood tile high-frequency grain, baked offline at 0.65 weight',
    'boundaryMaxDifference':max(int(np.abs(atlas[0].astype(int)-atlas[-1].astype(int)).max()),int(np.abs(atlas[:,0].astype(int)-atlas[:,-1].astype(int)).max())),
    'runtimeEncoding':'WebP quality 88 method 6','runtimeDownloadBytes':runtime.stat().st_size,
    'previousDownloadBytes':previous.stat().st_size,'decodedBoundaryMaxDifference':decoded_boundary,
    'policy':'Bake only a reusable surface field. Object-specific front details stay in the inspection prototype.'}
(folder/'shared-wood-v3-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
