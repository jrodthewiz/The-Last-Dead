"""Offline orthographic image -> UV bake with normal selection and depth rejection.
Use prepare <kind> before imagegen; bake <kind> <painted-sheet> afterwards.
No projector, AI, Blender, or Python runs in the browser.
"""
import argparse,json,os
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter

ROOT=Path(__file__).resolve().parents[1]
VIEWS=[('front',[0,0,-1],[0,1,0]),('back',[0,0,1],[0,1,0]),('right',[1,0,0],[0,1,0]),('left',[-1,0,0],[0,1,0]),('top',[0,1,0],[0,0,-1]),('bottom',[0,-1,0],[0,0,1])]
CELL=512
def srgb(c):
    c=np.asarray(c);return np.where(c<=.0031308,c*12.92,1.055*np.power(c,1/2.4)-.055)
def raster(xy,size):
    lo=np.maximum(0,np.floor(xy.min(axis=0)).astype(int));hi=np.minimum(size-1,np.ceil(xy.max(axis=0)).astype(int))
    if np.any(hi<lo):return None
    x,y=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
    a,b,c=xy;den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
    if abs(den)<1e-8:return None
    u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
    v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den
    w=1-u-v;inside=(u>=-1e-5)&(v>=-1e-5)&(w>=-1e-5)
    return x[inside],y[inside],np.stack([u[inside],v[inside],w[inside]],axis=1)
def load(kind):
    folder=ROOT/'.art-source/projection-texture'/kind
    data=json.load(open(folder/'unwrapped.json'));p=np.asarray(data['positions']);n=np.asarray(data['normals'])
    center=(p.min(axis=0)+p.max(axis=0))*.5;span=max(p.max(axis=0)-p.min(axis=0))*1.14
    views=[]
    for name,normal,up in VIEWS:
        normal=np.asarray(normal,dtype=float);up=np.asarray(up,dtype=float);right=np.cross(up,normal)
        q=p-center;xy=np.stack([(q@right/span+.5)*(CELL-1),(.5-q@up/span)*(CELL-1)],axis=1);depth=q@normal
        z=np.full((CELL,CELL),-np.inf);colors=np.full((CELL,CELL,3),24,dtype=np.uint8);mask=np.zeros((CELL,CELL),bool)
        for tri in data['triangles']:
            ids=tri['vertices'];r=raster(xy[ids],CELL)
            if r is None:continue
            x,y,b=r;d=b@depth[ids];keep=d>z[y,x]
            x=x[keep];y=y[keep];b=b[keep];d=d[keep]
            if not len(x):continue
            z[y,x]=d;mask[y,x]=True
            ns=b@n[ids];light=np.maximum(0,ns@normal)
            # Clay reference uses only silhouette/normal cues. No existing art.
            shade=np.clip(125+light*55,0,255).astype(np.uint8)
            colors[y,x]=shade[:,None]
        # Depth discontinuities clarify coplanar-looking assembled parts for
        # the painting reference. These lines are guides, never runtime art.
        edge=np.zeros_like(mask)
        for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
            other=np.roll(z,(dy,dx),(0,1));other_mask=np.roll(mask,(dy,dx),(0,1));both=mask&other_mask
            delta=np.zeros_like(z);np.subtract(z,other,out=delta,where=both)
            edge|=mask&((~other_mask)|(both&(np.abs(delta)>span*.002)))
        colors[edge]=65
        views.append(dict(name=name,normal=normal,up=up,right=right,depth=z,mask=mask,colors=colors))
    return folder,data,p,n,center,span,views
def prepare(kind):
    folder,data,p,n,center,span,views=load(kind)
    sheet=Image.new('RGB',(CELL*3,CELL*2),(24,24,24))
    for i,v in enumerate(views):sheet.paste(Image.fromarray(v['colors']),(i%3*CELL,i//3*CELL))
    sheet.save(folder/'clay-projections.png')
    meta={'cell':CELL,'sheet':[CELL*3,CELL*2],'viewOrder':[v['name'] for v in views],'center':center.tolist(),'span':span,'projection':'orthographic','source':data['source'],'triangles':len(data['triangles']),'invariants':['same topology','same silhouettes and framing','no baked directional lighting','occluded texels use source material']}
    json.dump(meta,open(folder/'projection-manifest.json','w'),indent=2)
    print('CLAY',folder/'clay-projections.png')
def bilinear(image,x,y):
    h,w=image.shape[:2];x=np.clip(x,0,w-1);y=np.clip(y,0,h-1)
    x0=x.astype(int);y0=y.astype(int);x1=np.minimum(x0+1,w-1);y1=np.minimum(y0+1,h-1)
    fx=(x-x0)[:,None];fy=(y-y0)[:,None]
    return image[y0,x0]*(1-fx)*(1-fy)+image[y0,x1]*fx*(1-fy)+image[y1,x0]*(1-fx)*fy+image[y1,x1]*fx*fy
def bake(kind,painted,size):
    folder,data,p,n,center,span,views=load(kind)
    overrides=json.loads((folder/'fallback-colors.json').read_text()) if (folder/'fallback-colors.json').exists() else {}
    paint=Image.open(painted).convert('RGB')
    if abs(paint.width/paint.height-1.5)>.08:raise ValueError('Generated sheet aspect changed; needs registration before baking')
    paint=np.asarray(paint.resize((CELL*3,CELL*2),Image.Resampling.LANCZOS),dtype=float)
    atlas=np.full((size,size,3),32,dtype=np.uint8);baseline=atlas.copy();orm=np.full((size,size,3),[255,210,20],np.uint8)
    occupied=np.zeros((size,size),bool);projected=np.zeros((size,size),bool);overlap=0
    source_view=np.full((size,size,3),12,np.uint8);view_colors=np.asarray([[216,86,68],[79,151,217],[228,178,72],[89,178,142],[187,104,196],[117,112,210]])
    for tri in data['triangles']:
        ids=tri['vertices'];uv=np.asarray(tri['uv']);xy=np.stack([uv[:,0]*(size-1),(1-uv[:,1])*(size-1)],axis=1)
        r=raster(xy,size)
        if r is None:continue
        x,y,b=r
        if not len(x):continue
        # Shared triangle edges are harmless; report interior UV collisions.
        overlap+=int(np.count_nonzero(occupied[y,x]&(b.min(axis=1)>.015)))
        occupied[y,x]=True;material=data['materials'][tri['material']]
        color=np.clip(srgb(material['color'])*255,0,255).astype(np.uint8);atlas[y,x]=overrides.get(material['name'],color);baseline[y,x]=color
        orm[y,x]=[255,round(material['roughness']*255),round(material['metalness']*255)]
        q=b@p[ids]-center;ns=b@n[ids];ns/=np.maximum(1e-8,np.linalg.norm(ns,axis=1))[:,None]
        best=np.zeros(len(x));picked=np.zeros((len(x),3));pickedview=np.zeros(len(x),int)
        for vi,v in enumerate(views):
            px=(q@v['right']/span+.5)*(CELL-1);py=(.5-q@v['up']/span)*(CELL-1)
            ix=np.clip(np.rint(px).astype(int),0,CELL-1);iy=np.clip(np.rint(py).astype(int),0,CELL-1)
            wanted=q@v['normal'];visible=v['mask'][iy,ix]&(np.abs(v['depth'][iy,ix]-wanted)<span*.006)
            # A thin face may miss the nearest reference pixel. Resolve only
            # the missing samples inside one pixel's projection footprint,
            # still requiring agreement with the reference depth buffer.
            sx=px.copy();sy=py.copy();missing=~visible
            for dy,dx in [(0,1),(0,-1),(1,0),(-1,0),(1,1),(-1,1),(1,-1),(-1,-1)]:
                nx=np.clip(ix+dx,0,CELL-1);ny=np.clip(iy+dy,0,CELL-1)
                take=missing&v['mask'][ny,nx]&(np.abs(v['depth'][ny,nx]-wanted)<span*.006)
                sx[take]=nx[take];sy[take]=ny[take];visible|=take;missing&=~take
            weight=np.maximum(0,ns@v['normal'])**6*visible;take=(weight>best)&(weight>.015)
            sample=bilinear(paint,sx+vi%3*CELL,sy+vi//3*CELL)
            picked[take]=sample[take];pickedview[take]=vi;best[take]=weight[take]
        good=best>0;atlas[y[good],x[good]]=picked[good].astype(np.uint8);projected[y[good],x[good]]=True;source_view[y[good],x[good]]=view_colors[pickedview[good]]
    # Island gutters for bilinear/mipmap filtering. Never blur the surface art.
    for image in [atlas,baseline,orm]:
        filled=occupied.copy()
        for _ in range(12):
            grown=filled.copy()
            for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
                neighbor=np.roll(filled,(dy,dx),(0,1));take=(~grown)&neighbor
                image[take]=np.roll(image,(dy,dx),(0,1))[take];grown|=take
            filled=grown
    runtime=ROOT/'assets/projection-texture'/kind;runtime.mkdir(parents=True,exist_ok=True)
    # A diagnostic baseline only; the default game never loads this experiment.
    (runtime/'native.json').write_bytes((folder/'source.json').read_bytes())
    for name,array in [('albedo',atlas),('baseline',baseline)]:Image.fromarray(array).save(runtime/(name+'.webp'),lossless=True)
    Image.fromarray(orm).save(folder/'material-values.png')
    Image.fromarray(source_view).save(folder/'projection-coverage.png');Image.fromarray(atlas).save(folder/'baked-atlas.png')
    # Indexed geometry preserves original triangle order, positions and normals.
    vertices=[];normals=[];uvs=[];surface_params=[];indices=[];unique={}
    for tri in data['triangles']:
        for idx,uv in zip(tri['vertices'],tri['uv']):
            key=(idx,round(uv[0],7),round(uv[1],7))
            if key not in unique:
                unique[key]=len(vertices)//3;vertices.extend(p[idx].tolist());normals.extend(n[idx].tolist());uvs.extend(uv)
                m=data['materials'][tri['material']];surface_params.extend([m['roughness'],m['metalness']])
            indices.append(unique[key])
    geometry={'positions':vertices,'normals':normals,'uvs':uvs,'surfaceParams':surface_params,'indices':indices,'source':data['source'],'dimensions':data['dimensions']}
    json.dump(geometry,open(runtime/'mesh.json','w'),separators=(',',':'))
    result={'kind':kind,'resolution':size,'triangles':len(indices)//3,'sourceVertices':data['sourceVertices'],'bakedVertices':len(vertices)//3,'uvOccupiedTexels':int(occupied.sum()),'projectedTexels':int(projected.sum()),'projectedCoverage':float(projected.sum()/max(1,occupied.sum())),'uvInteriorOverlapTexels':overlap,'runtimeTextureBytesWithMipmaps':round(size*size*4*4/3),'runtimeMaps':['albedo'],'materialValues':'source roughness/metalness preserved as constant-per-face vertex data','unprojectedPolicy':'source material color; no invented hidden geometry','sourceSheet':str(painted),'runtime':str(runtime)}
    if overrides:
        result['unprojectedPolicy']='source color, with explicit authored per-part palette overrides; no invented hidden geometry'
        result['fallbackColorOverrides']=overrides
    json.dump(result,open(folder/'bake-report.json','w'),indent=2);json.dump(result,open(runtime/'manifest.json','w'),indent=2)
    print(json.dumps(result,indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['prepare','bake']);parser.add_argument('kind',choices=['cabinet','recovery']);parser.add_argument('painted',nargs='?');parser.add_argument('--size',type=int,choices=[128,256,512,1024],default=512);a=parser.parse_args()
    if a.mode=='bake' and not a.painted:parser.error('bake requires a painted projection sheet')
    if a.mode=='prepare':prepare(a.kind)
    else:bake(a.kind,a.painted,a.size)
