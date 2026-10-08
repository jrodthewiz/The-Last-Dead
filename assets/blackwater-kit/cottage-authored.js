// CAPE LODGE 75 is an authored evacuation retreat, not a density preset.
// Its inspectable local-metre plan compiles through the existing material writer.
// Contents own named supports; tall detail inherits the base furnishing footprint.
export function isAuthoredCottage(s) {
  return s.enterable && s.kind === 'house' && s.label === 'CAPE LODGE 75';
}

export function getCottageDiscovery(s) {
  if (!isAuthoredCottage(s)) return null;
  return {
    id: 'cape75-radio-repair-kit', label: 'LODGERS’ RADIO REPAIR KIT',
    story: 'The radio repair was interrupted before the evacuation broadcast finished. Four salvaged fittings remain in the tool case.',
    position: [-3.55, 1.11, -1.30], approach: [-2.26, -1.30], supportId: 'bedroom-dresser',
  };
}

export function authorCottageFurnishings(items, s) {
  if (!isAuthoredCottage(s)) return items;
  const out = items.map(item => ({ ...item, position: [...item.position], size: [...item.size], collisionSize: [...item.collisionSize] }));
  for (const item of out) {
    // Finite landing guards replace this divider; legacy district diagnostics
    // can still read its former footprint while the structure owns gameplay.
    if(item.id==='room-partition-0'){item.authoredOverride=true;item.structureOverride=true;}
    if(item.id==='work-station-chair'){item.position[0]=-4.75;item.position[2]=3.70;}
    if (item.id === 'resident-work-station') { item.type = 'radio-desk'; item.detail = 'unfinished-storm-broadcast'; item.authoredRadio=true; }
    if (['bedroom-bed', 'bedroom-dresser', 'kitchen-worktop','kitchen-fridge'].includes(item.id)) item.authoredOverride = true;
    if (item.id === 'bedroom-dresser') {
      item.size[1]=1.03;item.position[1]=.08+item.size[1]/2;item.collisionSize[1]=1.08;
      item.collisionSize[2] = 1.20; // The pulled drawer is a real obstruction.
    }
  }
  out.push({
    id: 'packed-evacuation-suitcase', type: 'authored-luggage', purpose: 'cape-cottage', detail: 'departure-interrupted',
    position: [-4.06, .28, -3.22], size: [1.02, .40, .60], collisionSize: [1.12, .40, .72], authoredOverride: true,
  });
  return out;
}

// Each primitive belongs to one story module and one pre-existing semantic slot.
export function createAuthoredCottagePlan(s, furniture, ceiling) {
  if (!isAuthoredCottage(s)) return null;
  const placements = [], supports = [], contentIds = [], detailVariant = Math.abs(s.seed) % 3;
  const item = id => furniture.find(entry => entry.id === id);
  const push = (shape, slot, role, values, supportId) => {
    const p = { id: `${role}-${placements.length}`, shape, slot, role: `cape75-${role}`, ...values };
    if (supportId) { p.supportId = supportId; contentIds.push(p.id); }
    placements.push(p); return p;
  };
  const box = (slot, position, size, role, rotation = [0, 0, 0], supportId) => push('box', slot, role, { position, size, rotation }, supportId);
  const soft = (slot, position, size, role, rotation = [0, 0, 0], supportId) => push('bevelBox', slot, role, { position, size, radius: .025, rotation }, supportId);
  const cyl = (slot, a, b, radius, role, supportId) => push('cylinder', slot, role, { a, b, radius }, supportId);
  const tri = (slot, points, role) => push('triangle', slot, role, { points });
  const support = (id, y, x, z, width, depth) => supports.push({ id, top: y, bounds: { x: [x - width / 2, x + width / 2], z: [z - depth / 2, z + depth / 2] } });
  // Closed four-sided rail profile: outer bevel, raised rail, inner bevel and backing.
  // The shallow construction catches grazing light without expensive rounded-box seams.
  const panelRail=(slot,x,y,z,width,height,rail,depth,role,front=1)=>{
    const rectangle=(w,h,d)=>[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([a,b])=>[x+a,y+b,z+d*front]);
    const rings=[rectangle(width,height,0),rectangle(width-.014,height-.014,depth),rectangle(width-2*rail+.014,height-2*rail+.014,depth),rectangle(width-2*rail,height-2*rail,0)];
    for(let j=0;j<4;j++)for(let i=0;i<4;i++){
      const k=(i+1)%4,a=rings[j][i],b=rings[j][k],c=rings[(j+1)%4][i],d=rings[(j+1)%4][k];
      tri(slot,front>0?[a,b,c]:[a,c,b],role);tri(slot,front>0?[b,d,c]:[b,c,d],role);
    }
  };
  const sheet = (slot, nx, nz, point, role, twoSided = false) => {
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const a = point(x / nx, z / nz), b = point((x + 1) / nx, z / nz);
      const c = point(x / nx, (z + 1) / nz), d = point((x + 1) / nx, (z + 1) / nz);
      tri(slot, [a, c, b], role); tri(slot, [b, c, d], role);
      if(twoSided){tri(slot,[a,b,c],role);tri(slot,[b,d,c],role);}
    }
  };

  const bed = item('bedroom-bed'), [bx,,bz] = bed.position, [bw,,bd] = bed.size;
  for (const x of [-1, 1]) for (const z of [-1, 1]) box('furnitureWood', [bx + x * (bw / 2 - .14), .225, bz + z * (bd / 2 - .14)], [.10, .29, .10], 'bed-square-leg');
  box('furnitureWood', [bx, .315, bz], [bw, .15, bd], 'bed-timber-rail');
  for (const x of [-1, 1]) box('furnitureWood', [bx + x * bw / 2, .365, bz], [.07, .16, bd], 'bed-side-rail');
  soft('pale', [bx, .475, bz], [bw - .09, .22, bd - .08], 'bed-layered-mattress');
  box('furnitureWood', [bx, .68, bz - bd / 2 + .045], [bw, .82, .10], 'bed-panel-headboard');
  for (const x of [-1, 1]) box('pale', [bx + x * bw * .25, .71, bz - bd / 2 + .106], [bw * .42, .51, .012], 'bed-headboard-inset');
  // Separate pillows with a depressed center and stitches, not a single slab.
  for (const [i, sign] of [-1, 1].entries()) {
    const x = bx + sign * .40, z = bz - .68 + i * .05;
    soft('pale', [x, .635, z], [.70, .13, .42], 'bed-split-pillow', [0, sign * (.06 + detailVariant * .01), 0]);
    for (const edge of [-1, 1]) box('rug', [x, .684, z + edge * .176], [.58, .008, .009], 'pillow-visible-stitch');
    box('rug', [x + sign * .09, .692, z + .017], [.018, .005, .22], 'pillow-pressed-crease', [0, sign * .14, 0]);
  }
  const blanketPoint = (u, v) => {
    const x = bx + (u - .5) * (bw - .10), z = bz - .23 + v * (bd * .60);
    // Three broad, 8–12 cm crests survive the standing 320 px inspection view.
    // Small periodic corrugations read as a board under the painted lighting.
    const fold = .009 + .087 * Math.sin(u * 2.6 * Math.PI + v * 1.3 + detailVariant * .19) ** 2 + .011 * Math.sin(v * 2.2 * Math.PI + u * .8) ** 2;
    const turned = .022 * Math.exp(-(((v - .10) / .12) ** 2));
    return [x, .592 + fold + turned, z];
  };
  sheet('fabric', 18, 15, blanketPoint, 'bed-draped-creased-blanket');
  // The side drape has width, gravity and a scalloped hem; it is inside the solid bed footprint.
  sheet('fabric', 3, 15, (u, v) => {
    const edge=blanketPoint(1,v);
    // Turn over the outer rail before falling below its top; cloth must not pass through timber.
    const overRail=Math.sin(Math.min(1,u/.34)*Math.PI/2)*(.093+.010*Math.sin(v*2.4*Math.PI)**2);
    return [edge[0]+overRail,edge[1]-u*(.38+.065*Math.sin(v*2*Math.PI)**2),edge[2]];
  }, 'bed-gravity-side-drape');
  for (let v = 0; v < 15; v++) {
    const a = blanketPoint(.04, v / 15), b = blanketPoint(.04, (v + 1) / 15);
    cyl('pale', a.map((n,i) => i === 1 ? n + .003 : n), b.map((n,i) => i === 1 ? n + .003 : n), .005, 'blanket-stitched-edge');
  }

  const dresser = item('bedroom-dresser'), [dx,,dz] = dresser.position, [dw,dh,dd] = dresser.size;
  const dresserTop = 1.11;
  support('bedroom-dresser', dresserTop, dx, dz, dw, dd);
  // Open carcass, drawer liners and rails remain visible through the pulled drawer.
  for (const sign of [-1, 1]) box('furnitureWood', [dx + sign * (dw / 2 - .04), .59, dz], [.08, .94, dd], 'dresser-carcass-side');
  box('furnitureWood', [dx, .59, dz - dd / 2 + .025], [dw, .94, .05], 'dresser-carcass-back');
  box('furnitureWood', [dx, .145, dz], [dw, .10, dd], 'dresser-plinth');
  soft('pale', [dx, dresserTop - .035, dz], [dw + .02, .07, dd + .02], 'dresser-clear-discovery-top');
  for (const [i, y] of [.88, .65, .39].entries()) {
    const open = i === 1, front = dz + dd / 2 + (open ? .27 : .018);
    if (open) {
      box('dark', [dx, y + .02, dz + .075], [dw - .16, .20, .08], 'dresser-open-drawer-recess');
      box('furnitureWood', [dx, y - .085, dz + .27], [dw - .15, .03, .47], 'dresser-pulled-drawer-bottom');
      for (const sign of [-1, 1]) box('furnitureWood', [dx + sign * (dw / 2 - .09), y, dz + .27], [.045, .17, .47], 'dresser-drawer-side');
      support('open-drawer-liner', y - .065, dx, dz + .27, dw - .22, .43);
      soft('fabric', [dx - .30, y - .043, dz + .27], [.57, .044, .29], 'packed-drawer-folded-shirt', [0, .04, 0], 'open-drawer-liner');
      box('pale', [dx + .31, y - .043, dz + .28], [.44, .044, .24], 'packed-drawer-towel', [0, -.04, 0], 'open-drawer-liner');
    }
    box('pale', [dx, y, front], [dw - .10, .20, .042], 'dresser-paneled-drawer-front');
    for (const sign of [-1, 1]) cyl('metal', [dx + sign * .47 - .075, y, front + .034], [dx + sign * .47 + .075, y, front + .034], .012, 'dresser-drawer-pull');
  }
  // Occupants packed beside the bed. An asymmetrical lid and straps read as luggage.
  const suitcase = item('packed-evacuation-suitcase'), [sx,,sz] = suitcase.position;
  soft('rug', [sx, .25, sz], [1.02, .34, .60], 'evacuation-suitcase-body');
  soft('fabric', [sx, .435, sz], [1.04, .065, .61], 'evacuation-suitcase-lid');
  for (const x of [-.33, .33]) {
    box('dark', [sx + x, .473, sz], [.047, .009, .58], 'suitcase-retention-strap');
    box('metal', [sx + x, .32, sz + .316], [.067, .055, .024], 'suitcase-brass-clasp');
  }
  cyl('metal', [sx - .12, .32, sz + .334], [sx + .12, .32, sz + .334], .019, 'suitcase-carry-handle');
  box('pale', [sx + .18, .476, sz - .12], [.21, .009, .11], 'suitcase-paper-name-tag', [0, -.08, 0]);
  for (let i = 0; i < 3; i++) box('dark', [sx + .12 + i * .045, .482, sz - .12], [.016, .006, .05], 'luggage-tag-mark');

  const kitchen = item('kitchen-worktop'), [kx,,kz] = kitchen.position, [kw,,kd] = kitchen.size;
  const kt = 1.075, sinkX = kx - kw * .25, hobX = kx + kw * .24;
  box('furnitureWood', [kx, .155, kz], [kw, .14, kd], 'kitchen-base-carcass');
  for(const sign of [-1,1]){
    box('furnitureWood',[kx+sign*(kw/2-.035),.57,kz],[.07,.92,kd],'kitchen-open-carcass-side');
    box('furnitureWood',[kx,1.003,kz+sign*(kd/2-.04)],[kw,.055,.065],'kitchen-carcass-upper-rail');
  }
  box('furnitureWood',[kx,.57,kz-kd/2+.035],[kw,.92,.07],'kitchen-open-carcass-back');
  box('furnitureWood',[kx-.08,.53,kz],[.055,.84,kd-.07],'kitchen-carcass-divider');
  box('dark', [kx, .15, kz + kd / 2 + .017], [kw - .12, .11, .025], 'kitchen-shadow-kick');
  // Countertop is constructed around a real bowl opening instead of painting a black square onto a solid top.
  const holeW = .67, holeD = .40, holeMin = sinkX - holeW / 2, holeMax = sinkX + holeW / 2;
  const cmin = kx - kw / 2, cmax = kx + kw / 2;
  for (const [a,b] of [[cmin,holeMin],[holeMax,cmax]]) soft('pale', [(a+b)/2, kt-.04, kz], [b-a,.08,kd+.025], 'kitchen-cutout-countertop');
  for (const sign of [-1,1]) box('pale', [sinkX,kt-.04,kz+sign*(holeD/2+(kd-holeD)/4)], [holeW,.08,(kd-holeD)/2], 'kitchen-cutout-countertop');
  box('metal', [sinkX, kt-.145, kz], [holeW-.036,.027,holeD-.036], 'kitchen-lowered-sink-bowl');
  for (const sign of [-1,1]) {
    box('metal',[sinkX+sign*(holeW/2-.017),kt-.07,kz],[.026,.145,holeD],'kitchen-sink-bowl-wall');
    box('metal',[sinkX,kt-.07,kz+sign*(holeD/2-.017)],[holeW,.145,.026],'kitchen-sink-bowl-wall');
    box('metal',[sinkX+sign*holeW/2,kt+.009,kz],[.038,.018,holeD+.048],'kitchen-sink-rim');
    box('metal',[sinkX,kt+.009,kz+sign*holeD/2],[holeW+.048,.018,.038],'kitchen-sink-rim');
  }
  cyl('dark',[sinkX,kt-.129,kz],[sinkX,kt-.124,kz],.039,'sink-dark-drain');
  cyl('metal',[sinkX,kt,-kd*.28+kz],[sinkX,kt+.26,-kd*.28+kz],.019,'kitchen-tap-rise');
  cyl('metal',[sinkX,kt+.26,-kd*.28+kz],[sinkX,kt+.26,kz-.025],.019,'kitchen-tap-spout');
  for (const sign of [-1,1]) {
    const x=kx+sign*kw*.25,frontZ=kz+kd/2+.017,doorW=kw*.46;
    box('dark',[x,.59,frontZ],[doorW+.024,.784,.012],'kitchen-door-recess-gasket');
    box('pale',[x,.59,frontZ+.012],[doorW-.14,.60,.012],'kitchen-recessed-door-panel');
    panelRail('pale',x,.59,frontZ+.015,doorW,.76,.069,.028,'kitchen-beveled-door-rail');
    cyl('metal',[kx+sign*kw*.25-.09,.88,kz+kd/2+.051],[kx+sign*kw*.25+.09,.88,kz+kd/2+.051],.014,'kitchen-door-pull');
  }
  box('metal',[hobX,kt+.013,kz],[kw*.40,.027,kd*.72],'kitchen-hob-surround');
  for(const a of [-1,1])for(const b of [-1,1]){
    const x=hobX+a*kw*.09,z=kz+b*kd*.17;
    cyl('dark',[x,kt+.027,z],[x,kt+.046,z],.084,'hob-solid-burner');
    for(const sign of [-1,1])box('metal',[x+sign*.043,kt+.050,z],[.015,.012,.18],'hob-cross-grate');
  }
  box('dark',[hobX,.62,kz+kd/2+.040],[kw*.33,.39,.025],'kitchen-oven-glass');
  box('pale',[hobX,.90,kz+kd/2+.041],[kw*.38,.13,.033],'kitchen-oven-controls');
  cyl('metal',[hobX-kw*.15,.83,kz+kd/2+.070],[hobX+kw*.15,.83,kz+kd/2+.070],.014,'kitchen-oven-handle');
  for(const x of [-.22,0,.22])cyl('dark',[hobX+x,.90,kz+kd/2+.062],[hobX+x,.90,kz+kd/2+.090],.025,'kitchen-control-knob');
  // Upper cabinet attaches to the base's backsplash: no additional floor obstruction.
  const upperY=Math.min(ceiling-.27,2.05),upperDepth=.30;
  const storageTop=upperY+.245;
  box('pale',[kx,(kt+storageTop)/2,kz-kd/2+.03],[kw,storageTop-kt,.062],'kitchen-painted-backsplash');
  const upperZ=kz-kd/2+.17,upperFront=upperZ+upperDepth/2;
  for(const sign of [-1,1]){
    box('furnitureWood',[kx+sign*(kw/2-.022),upperY,upperZ],[.044,.49,upperDepth],'kitchen-upper-storage');
    box('furnitureWood',[kx,upperY+sign*(.245-.02),upperZ],[kw,.040,upperDepth],'kitchen-upper-storage');
  }
  box('furnitureWood',[kx,upperY,upperZ],[.040,.45,upperDepth],'upper-storage-center-divider');
  box('dark',[kx,upperY,upperZ-upperDepth/2+.034],[kw-.07,.43,.025],'upper-storage-recessed-back');
  const upperDoorX=kx-kw*.25,upperDoorW=kw*.46;
  box('pale',[upperDoorX,upperY,upperFront+.009],[upperDoorW-.14,.29,.014],'upper-storage-inset-door-panel');
  panelRail('pale',upperDoorX,upperY,upperFront+.016,upperDoorW,.43,.065,.023,'upper-storage-beveled-door-rail');
  cyl('metal',[upperDoorX-.07,upperY-.12,upperFront+.050],[upperDoorX+.07,upperY-.12,upperFront+.050],.010,'upper-storage-pull');
  const openX=kx+kw*.25,openShelfY=upperY+.018;
  box('furnitureWood',[openX,openShelfY,upperZ],[kw/2-.055,.030,upperDepth-.026],'upper-open-shelf-board');
  support('upper-open-shelf-lower',upperY-.205,openX,upperZ,kw/2-.075,upperDepth-.032);
  support('upper-open-shelf-upper',openShelfY+.015,openX,upperZ,kw/2-.075,upperDepth-.032);
  for(let i=0;i<3;i++)cyl('pale',[openX-.25,upperY-.205+i*.013,upperZ],[openX-.25,upperY-.192+i*.013,upperZ],.120,'open-shelf-stacked-plate',i===0?'upper-open-shelf-lower':undefined);
  cyl('pale',[openX+.25,openShelfY+.015,upperZ],[openX+.25,openShelfY+.155,upperZ],.054,'open-shelf-cup','upper-open-shelf-upper');
  cyl('dark',[openX+.25,openShelfY+.155,upperZ],[openX+.25,openShelfY+.162,upperZ],.043,'open-shelf-cup-interior');
  cyl('pale',[openX+.303,openShelfY+.052,upperZ],[openX+.329,openShelfY+.055,upperZ],.012,'open-shelf-cup-handle');
  cyl('pale',[openX+.329,openShelfY+.055,upperZ],[openX+.329,openShelfY+.117,upperZ],.012,'open-shelf-cup-handle');
  cyl('pale',[openX+.329,openShelfY+.117,upperZ],[openX+.303,openShelfY+.120,upperZ],.012,'open-shelf-cup-handle');

  // This address's refrigerator has a stepped door/gasket assembly, real hardware and a rear condenser.
  const fridge=item('kitchen-fridge'),[fx,,fz]=fridge.position,[fw,fh,fd]=fridge.size,fridgeTop=.08+fh;
  for(const sign of [-1,1])for(const end of [-1,1])box('dark',[fx+sign*(fw/2-.11),.11,fz+end*(fd/2-.10)],[.10,.060,.11],'fridge-leveling-foot');
  soft('pale',[fx,.14+(fh-.14)/2,fz-.026],[fw-.028,fh-.14,fd-.062],'fridge-shaped-enamel-casing');
  soft('pale',[fx,fridgeTop-.040,fz-.024],[fw-.010,.080,fd-.043],'fridge-curved-top-cap');
  const fridgeFront=fz+fd/2-.024;
  for(const [doorY,doorH]of [[.79,1.14],[1.625,.46]]){
    box('dark',[fx,doorY,fridgeFront],[fw-.024,doorH+.026,.026],'fridge-dark-door-gasket');
    soft('pale',[fx,doorY,fridgeFront+.027],[fw-.044,doorH,.066],'fridge-stepped-enamel-door');
    const handleX=fx-fw*.31,lower=doorY+doorH*.18,upper=lower+Math.min(.30,doorH*.38),handleZ=fz+fd/2+.062;
    for(const y of [lower,upper])cyl('metal',[handleX,y,fridgeFront+.060],[handleX,y,handleZ],.014,'fridge-handle-standoff');
    cyl('metal',[handleX,lower,handleZ],[handleX,upper,handleZ],.014,'fridge-articulated-handle');
    for(const y of [doorY-doorH*.32,doorY+doorH*.32]){
      box('metal',[fx+fw*.39,y,fridgeFront+.066],[.057,.068,.030],'fridge-hinge-plate');
      cyl('rust',[fx+fw*.41,y-.042,fridgeFront+.080],[fx+fw*.41,y+.042,fridgeFront+.080],.011,'fridge-hinge-pin');
    }
  }
  box('dark',[fx,.17,fz+fd/2+.021],[fw-.12,.100,.025],'fridge-recessed-base-vent');
  for(let row=0;row<4;row++)box('pale',[fx,.134+row*.025,fz+fd/2+.039],[fw-.14,.010,.013],'fridge-layered-vent-louvre');
  for(const x of [-.28,-.10,.10,.28])cyl('dark',[fx+x,.27,fz-fd/2-.019],[fx+x,1.63,fz-fd/2-.019],.010,'fridge-rear-condenser-riser');
  for(let row=0;row<7;row++)cyl('metal',[fx-.28,.32+row*.18,fz-fd/2-.029],[fx+.28,.32+row*.18,fz-fd/2-.029],.008,'fridge-rear-condenser-fin');
  // The kettle and drying mug are physically seated on the hob/counter.
  support('kitchen-counter-clear',kt,kx+kw*.41,kz+.10,.36,.47);
  cyl('pale',[kx+kw*.41,kt,kz+.10],[kx+kw*.41,kt+.16,kz+.10],.048,'sink-drying-mug','kitchen-counter-clear');
  const kettleX=hobX-kw*.09,kettleZ=kz+kd*.17,kettleBase=kt+.056;
  support('kitchen-hob-grate',kettleBase,kettleX,kettleZ,.18,.18);
  cyl('metal',[kettleX,kettleBase,kettleZ],[kettleX,kettleBase+.19,kettleZ],.086,'abandoned-kettle-body','kitchen-hob-grate');
  cyl('dark',[kettleX,kettleBase+.19,kettleZ],[kettleX,kettleBase+.215,kettleZ],.087,'kettle-closed-lid');
  cyl('dark',[kettleX-.078,kettleBase+.17,kettleZ],[kettleX-.068,kettleBase+.29,kettleZ],.012,'kettle-handle');
  cyl('dark',[kettleX+.078,kettleBase+.17,kettleZ],[kettleX+.068,kettleBase+.29,kettleZ],.012,'kettle-handle');
  cyl('dark',[kettleX-.068,kettleBase+.29,kettleZ],[kettleX+.068,kettleBase+.29,kettleZ],.012,'kettle-handle');
  cyl('metal',[kettleX+.065,kettleBase+.065,kettleZ],[kettleX+.13,kettleBase+.14,kettleZ],.026,'kettle-spout');

  const breakfast = item('kitchen-breakfast-table'), [tx,,tz] = breakfast.position, tableTop = .08+breakfast.size[1];
  support('breakfast-table',tableTop,tx,tz,breakfast.size[0],breakfast.size[2]);
  // Existing plates and cups are retained; the knife, fork and interrupted toast add evidence of use.
  for(const sign of [-1,1]){
    box('rust',[tx+sign*.32,tableTop+.037,tz],[.16,.028,.12],'uneaten-toast',[0,sign*.08,0]);
    box('pale',[tx+sign*.32,tableTop+.054,tz],[.12,.006,.083],'toast-crust-highlight',[0,sign*.08,0]);
    box('metal',[tx+sign*.48,tableTop+.018,tz],[.021,.012,.22],'meal-knife',[0,sign*.03,0]);
    cyl('metal',[tx+sign*.13,tableTop+.017,tz-.11],[tx+sign*.13,tableTop+.017,tz+.07],.008,'meal-fork-handle');
    for(let tine=0;tine<3;tine++)box('metal',[tx+sign*.13+(tine-1)*.011,tableTop+.017,tz+.095],[.004,.010,.06],'meal-fork-tine');
  }
  box('pale',[tx-.02,tableTop+.009,tz+.30],[.36,.010,.16],'creased-evacuation-notice',[0,.03,0],'breakfast-table');
  for(let line=0;line<3;line++)box('dark',[tx-.02,tableTop+.016,tz+.25+line*.035],[line===0?.29:.22,.005,.009],'notice-painted-lines',[0,.03,0]);

  const desk = item('resident-work-station'), [rx,,rz] = desk.position, radioTop = .08+desk.size[1];
  support('radio-desk',radioTop,rx,rz,desk.size[0],desk.size[2]);
  const radioX=rx+.12,radioZ=rz-.10,radioBase=radioTop+.024,radioW=.72,radioH=.36,radioD=.30,radioFront=radioZ-radioD/2-.016;
  for(const sign of [-1,1])for(const end of [-1,1])box('dark',[radioX+sign*.26,radioTop+.012,radioZ+end*.105],[.086,.024,.09],'radio-supported-rubber-foot',[0,0,0],'radio-desk');
  box('metal',[radioX,radioBase+.014,radioZ],[radioW,.028,radioD],'radio-open-shell-bottom');
  for(const sign of [-1,1])box('metal',[radioX+sign*(radioW/2-.020),radioBase+radioH/2,radioZ],[.040,radioH,radioD],'radio-open-shell-side');
  soft('metal',[radioX,radioBase+radioH-.022,radioZ],[radioW,.044,radioD],'radio-shaped-top-shell');
  panelRail('pale',radioX,radioBase+radioH/2,radioFront,radioW,radioH,.041,.034,'radio-contrasting-enamel-bezel',-1);
  const speakerX=radioX-.16,speakerY=radioBase+.17;
  box('dark',[speakerX,speakerY,radioFront+.025],[.32,.245,.017],'radio-recessed-speaker-cavity');
  panelRail('metal',speakerX,speakerY,radioFront-.007,.34,.26,.018,.012,'radio-speaker-grille-trim',-1);
  for(let i=0;i<5;i++)box('pale',[speakerX,speakerY-.088+i*.044,radioFront-.006],[.293,.022,.019],'radio-raised-speaker-grille');
  box('pale',[radioX+.235,radioBase+.17,radioFront-.010],[.175,.25,.025],'radio-enamel-control-panel');
  const dialX=radioX+.235,dialY=radioBase+.115;
  cyl('metal',[dialX,dialY,radioFront-.022],[dialX,dialY,radioFront-.042],.082,'radio-tuning-dial-surround');
  cyl('pale',[dialX,dialY,radioFront-.040],[dialX,dialY,radioFront-.069],.067,'radio-big-tuning-dial');
  box('dark',[dialX+.011,dialY+.026,radioFront-.073],[.014,.057,.008],'radio-tuning-pointer',[0,0,-.30]);
  box('dark',[radioX+.235,radioBase+.270,radioFront-.028],[.154,.036,.012],'radio-recessed-tuning-scale');
  for(let i=0;i<5;i++)box('pale',[radioX+.173+i*.031,radioBase+.270,radioFront-.037],[.006,.018,.006],'radio-scale-tick');
  box('rust',[radioX+.253,radioBase+.270,radioFront-.040],[.007,.026,.005],'radio-scale-indicator');
  for(const sign of [-1,1]){
    cyl('rust',[radioX+sign*.225,radioBase+radioH-.012,radioZ],[radioX+sign*.225,radioBase+radioH+.132,radioZ],.018,'radio-handle-hinge');
    cyl('dark',[radioX+sign*.225,radioBase+radioH+.116,radioZ],[radioX+sign*.19,radioBase+radioH+.170,radioZ],.022,'radio-carry-handle-corner');
  }
  cyl('dark',[radioX-.19,radioBase+radioH+.170,radioZ],[radioX+.19,radioBase+radioH+.170,radioZ],.022,'radio-recognizable-carry-handle');
  const aerialX=radioX-.29;
  cyl('metal',[aerialX,radioBase+radioH-.014,radioZ+.061],[aerialX-.034,radioBase+radioH+.23,radioZ+.061],.010,'radio-telescopic-aerial-base');
  cyl('pale',[aerialX-.034,radioBase+radioH+.23,radioZ+.061],[aerialX-.085,radioBase+radioH+.49,radioZ+.061],.006,'radio-telescopic-aerial-tip');
  // Rear shell is genuinely open. Large coil and circuit shapes remain visible from the window side.
  box('dark',[radioX,radioBase+.175,radioZ+.074],[.58,.25,.018],'radio-exposed-rear-circuit-board');
  cyl('rust',[radioX-.19,radioBase+.19,radioZ+.099],[radioX-.075,radioBase+.19,radioZ+.099],.036,'radio-exposed-rear-coil');
  box('metal',[radioX+.135,radioBase+.18,radioZ+.110],[.10,.16,.045],'radio-exposed-tuning-block');
  for(const sign of [-1,1])cyl('pale',[radioX+sign*.245,radioBase+.053,radioZ+.114],[radioX+sign*.245,radioBase+.092,radioZ+.114],.021,'radio-rear-board-mount');
  // The removed back and readable circuit board sit beside the radio, not beneath it.
  const removedX=rx-.68,removedZ=rz+.16;
  box('rust',[removedX,radioTop+.014,removedZ],[.49,.028,.25],'radio-removed-back-panel',[0,0,0],'radio-desk');
  for(let i=0;i<5;i++)box('dark',[removedX-.16+i*.08,radioTop+.032,removedZ],[.040,.008,.17],'radio-back-panel-vent');
  const pcbX=rx+.73,pcbZ=rz+.08,pcbTop=radioTop+.024;
  box('metal',[pcbX,radioTop+.012,pcbZ],[.42,.024,.34],'radio-supported-repair-circuit-board',[0,0,0],'radio-desk');
  support('repair-circuit-board',pcbTop,pcbX,pcbZ,.42,.34);
  box('dark',[pcbX-.085,pcbTop+.026,pcbZ-.026],[.105,.052,.083],'radio-recognizable-circuit-chip',[0,0,0],'repair-circuit-board');
  for(const [x,z]of [[.09,-.065],[.085,.080]])cyl('pale',[pcbX+x,pcbTop,pcbZ+z],[pcbX+x,pcbTop+.092,pcbZ+z],.031,'radio-large-repair-capacitor','repair-circuit-board');
  box('rust',[pcbX-.060,pcbTop+.040,pcbZ+.104],[.15,.080,.059],'radio-readable-repair-transformer',[0,0,0],'repair-circuit-board');
  for(const [x,z,w,d]of [[-.075,-.122,.24,.013],[.032,.02,.014,.21],[-.11,.022,.014,.12],[.079,.127,.17,.011]])box('rust',[pcbX+x,pcbTop+.005,pcbZ+z],[w,.010,d],'radio-copper-circuit-trace');
  for(const [wireIndex,slot]of [[0,'rust'],[1,'dark']]){
    const points=[[radioX+.275,radioBase+.13,radioZ+.135],[radioX+.37,radioTop+.10,radioZ+.19],[pcbX-.22,radioTop+.025,pcbZ+.12-wireIndex*.028],[pcbX-.14,pcbTop+.014,pcbZ+.08-wireIndex*.030]];
    for(let i=0;i<points.length-1;i++)cyl(slot,points[i].map((n,k)=>k===2?n+wireIndex*.020:n),points[i+1].map((n,k)=>k===2?n+wireIndex*.020:n),.005,'radio-connected-repair-wire');
  }
  const screwZ=rz-.37;
  cyl('dark',[rx-.61,radioTop+.026,screwZ],[rx-.39,radioTop+.026,screwZ],.026,'repair-readable-screwdriver-grip');
  cyl('metal',[rx-.39,radioTop+.026,screwZ],[rx-.12,radioTop+.008,screwZ],.008,'repair-readable-screwdriver-shaft');
  box('metal',[rx-.094,radioTop+.0045,screwZ],[.050,.009,.026],'repair-supported-screwdriver-blade',[0,0,0],'radio-desk');
  const plierX=rx+.72,plierZ=rz-.30;
  for(const sign of [-1,1]){
    cyl('rust',[plierX+sign*.090,radioTop+.022,plierZ-.14],[plierX+sign*.027,radioTop+.022,plierZ-.025],.022,'repair-recognizable-plier-handle');
    cyl('metal',[plierX+sign*.027,radioTop+.022,plierZ-.025],[plierX+sign*.013,radioTop+.017,plierZ+.086],.015,'repair-plier-jaw');
  }
  cyl('dark',[plierX,radioTop+.006,plierZ-.028],[plierX,radioTop+.041,plierZ-.028],.028,'repair-plier-pivot');

  // Finishes own floor/wall construction rather than adding unmotivated props.
  const insideW=s.width-.52,minZ=-s.depth/2+.22,maxZ=s.depth/2-1.65-.18;
  for(let x=-insideW/2+.20;x<insideW/2;x+=.42)box('furnitureWood',[x,.073,(Math.max(0,minZ)+maxZ)/2],[.012,.003,maxZ-Math.max(0,minZ)],'living-floor-plank-seam');
  for(let x=-insideW/2+.10;x<insideW/2;x+=.84)for(let row=0;row<4;row++)box('furnitureWood',[x+.20,.073,.22+row*1.45+(Math.round(x*10)%2)*.12],[.40,.003,.012],'staggered-floor-board-joint');
  for(let x=-insideW/2+.45;x<insideW/2;x+=.90)box('pale',[x,.073,minZ/2],[.015,.003,-minZ],'kitchen-linoleum-grout');
  for(let z=minZ+.40;z<0;z+=.90)box('pale',[0,.073,z],[insideW,.003,.015],'kitchen-linoleum-grout');
  // Thin woven runner and borders occupy the route visually but never obstruct it.
  box('rug',[0,.077,2.70],[1.58,.010,4.64],'hall-woven-runner');
  for(const sign of [-1,1]){
    box('pale',[sign*.72,.083,2.70],[.050,.003,4.49],'runner-woven-border');
    box('pale',[0,.083,2.70+sign*2.20],[1.44,.003,.050],'runner-woven-border');
    for(let i=0;i<8;i++)box('pale',[(i-3.5)*.18,.083,2.70+sign*2.355],[.021,.003,.08],'runner-frayed-fringe');
  }
  const living = item('living-sofa'), [lx,,lz] = living.position;
  for(const sign of [-1,1])box('pale',[lx+sign*(living.size[0]+.04)/2,.079,lz-.55],[.036,.003,2.15],'living-rug-stitched-border');
  for(const sign of [-1,1])box('pale',[lx,.079,lz-.55+sign*1.055],[living.size[0]+.07,.003,.035],'living-rug-stitched-border');
  // One torn seam where a packed bag caught a cushion, with exposed batting confined to that tear.
  box('dark',[lx+.33,.684,lz+.09],[.15,.007,.033],'sofa-torn-cushion-seam',[0,.20,0]);
  for(let i=0;i<4;i++)box('pale',[lx+.27+i*.033,.690,lz+.10],[.022,.012,.019],'sofa-torn-exposed-batting',[0,i*.11,0]);
  const wallMinZ=-s.depth/2+.47,wallMaxZ=s.depth/2-1.65-.50;
  for(const sign of [-1,1])box('furnitureWood',[sign*(s.width/2-.57),.185,(wallMinZ+wallMaxZ)/2],[.067,.21,wallMaxZ-wallMinZ],'wall-profiled-skirting');
  for(const z of [wallMinZ,wallMaxZ])for(const [a,b]of [[-insideW/2,-2.10],[2.10,insideW/2]])box('furnitureWood',[(a+b)/2,.18,z],[b-a,.20,.075],'door-wall-profiled-skirting');

  // Two framed graphic seascapes attach to the actual room partitions, on both faces.
  for(const [x, facing, variant]of [[-4.05,-1,0],[4.05,1,1]]){
    const z=variant?facing*.132:-.69,y=variant?1.58:1.80,w=1.25,h=.64;
    box('pale',[x,y,z],[w-.05,h-.05,.025],'framed-scene-painted-ground');
    for(const sign of [-1,1]){
      box('furnitureWood',[x+sign*w/2,y,z+facing*.014],[.065,h+.055,.065],'framed-scene-timber-frame');
      box('furnitureWood',[x,y+sign*h/2,z+facing*.014],[w,.065,.065],'framed-scene-timber-frame');
    }
    box('fabric',[x,y-.13,z+facing*.020],[w-.11,.26,.010],'framed-scene-sea-band');
    box('rust',[x+(variant?.24:-.25),y+.10,z+facing*.026],[.14,.28,.010],'framed-scene-lighthouse');
    box('dark',[x+(variant?.24:-.25),y+.255,z+facing*.032],[.22,.060,.010],'framed-scene-lighthouse-roof');
    box('rug',[x-.24,y-.035,z+facing*.032],[.40,.065,.010],'framed-scene-coast-silhouette',[0,0,.06]);
    box('pale',[x,y-.26,z+facing*.037],[w-.15,.010,.009],'framed-scene-paint-wave');
  }
  // Additional pleats are exact geometry behind existing rods, sized to the side-window bays.
  const sideSpan=s.depth-1.85,bays=Math.max(2,Math.round(sideSpan/3)),bay=sideSpan/bays,windowY=ceiling*.51,windowH=Math.min(1.72,ceiling-.95),curtainWindows=[];
  for(const sign of [-1,1])for(const index of [1,3]){
    const centerZ=-.825-sideSpan/2+bay*(index+.5),wallX=sign*(s.width/2-.80),bottom=windowY-windowH/2-.10,top=windowY+windowH/2+.10;
    curtainWindows.push({id:`side-${sign}-bay-${index}`,center:[sign*(s.width/2-.20),windowY,centerZ]});
    for(const end of [-1,1]){
      sheet('fabric',5,10,(u,v)=>{
        const gather=.26*Math.exp(-(((v-.72)/.15)**2)),width=.38*(1-gather);
        const pleat=.112*Math.min(1,v/.12)*Math.sin(u*2*Math.PI+v*.35)**2;
        const hem=bottom+.040+.090*Math.sin(u*2*Math.PI+end*.34)**2;
        return[wallX-sign*pleat,top-v*(top-hem),centerZ+end*(.46+u*width)];
      },'curtain-sewn-pleated-panel',true);
      for(let clip=0;clip<3;clip++)box('metal',[wallX+sign*.008,top+.037,centerZ+end*(.50+clip*.16)],[.022,.073,.022],'curtain-hanging-clip');
      box('rug',[wallX-sign*.068,top-(top-bottom-.075)*.72,centerZ+end*.601],[.155,.045,.31],'curtain-fabric-tie');
    }
  }
  // Selective damp marks follow the leaking sink and rainward sill, not random noise over every surface.
  for(let i=0;i<5;i++)box('rug',[kx-.80+i*.12,.075,kz+.18],[.075,.004,.09+i*.04],'sink-localized-drip-stain',[0,i*.25,0]);
  for(let i=0;i<4;i++)box('rust',[-5.445,.115+i*.035,-3.67+i*.045],[.008,.020,.17],'rainward-sill-localized-damp');
  for(let i=0;i<4;i++)box('furnitureWood',[dx-dw/2+.14+i*.046,.89,dz+dd/2+.026],[.027,.020,.005],'dresser-single-chipped-edge');

  const modules=[...new Set(placements.map(p=>p.role))],moduleBounds={},owners=new Map(),duplicateOwners=[];
  for(const placement of placements){
    const bounds=primitiveBounds(placement),current=moduleBounds[placement.role]||{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(let i=0;i<3;i++){current.min[i]=Math.min(current.min[i],bounds.min[i]);current.max[i]=Math.max(current.max[i],bounds.max[i]);}
    moduleBounds[placement.role]=current;
    const key=JSON.stringify([placement.shape,placement.slot,placement.position,placement.size,placement.rotation,placement.a,placement.b,placement.radius,placement.points]);
    if(owners.has(key))duplicateOwners.push([owners.get(key),placement.id]);else owners.set(key,placement.id);
  }
  return {
    id:'cape75-authored-storm-retreat',seed:s.seed,detailVariant,story:'A storm retreat evacuated mid-breakfast, with a half-repaired radio, packed luggage and a useful remaining repair kit.',
    placements,supports,contentIds,curtainWindows,discovery:getCottageDiscovery(s),
    workstation:{radio:{center:[radioX,radioBase+radioH/2,radioZ],frontZ:radioFront-.034,speaker:[speakerX,speakerY,radioFront-.016],dial:[dialX,dialY,radioFront-.069],openBackZ:radioZ+radioD/2},circuitBoardSupport:'repair-circuit-board',taskLightBase:{center:[rx-.80,radioTop,rz-.20],radius:.12}},
    reservedPassage:{x:[s.doorOffset-2,s.doorOffset+2],z:[-s.depth/2,s.depth/2]},
    diagnostics:{moduleCount:modules.length,primitiveCount:placements.length,materialSlots:[...new Set(placements.map(p=>p.slot))],duplicateOwners,moduleBounds,floorDetailMaxY:.085,upperDetailMaxY:upperY+.245},
  };
}

// The caller passes face.point(along,y,0) before the cottage body-Z translation.
// Replacing only these four windows keeps all other curtains and every rod.
export function coversAuthoredCottageCurtainWindow(plan, centerPoint){
  if(!plan.authoredCottage)return false;
  const translated=[centerPoint[0],centerPoint[1],centerPoint[2]-.825];
  return plan.authoredCottage.curtainWindows.some(window=>window.center.every((value,i)=>Math.abs(value-translated[i])<.00001));
}

// Exact primitive AABBs expose construction bounds without retaining GPU objects.
export function primitiveBounds(p){
  let points;
  if(p.shape==='triangle')points=p.points;
  else if(p.shape==='cylinder'){
    const delta=p.b.map((value,i)=>value-p.a[i]),length=Math.hypot(...delta);
    const extent=delta.map(value=>p.radius*Math.sqrt(Math.max(0,1-(value/length)**2)));
    return{min:p.a.map((value,i)=>Math.min(value,p.b[i])-extent[i]),max:p.a.map((value,i)=>Math.max(value,p.b[i])+extent[i])};
  }else{
    const [rx,ry,rz]=p.rotation,sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
    points=[];
    for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1]){
      const x=a*p.size[0]/2,y=b*p.size[1]/2,z=c*p.size[2]/2;
      const zx=x*cz-y*sz,zy=x*sz+y*cz,yx=zx*cy+z*sy,yz=-zx*sy+z*cy;
      points.push([p.position[0]+yx,p.position[1]+zy*cx-yz*sx,p.position[2]+zy*sx+yz*cx]);
    }
  }
  return{min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))};
}

export function compileAuthoredCottage(writer, plan, { finishes = false } = {}) {
  const authored=plan.authoredCottage;
  if(!authored)return;
  const isFinish=p=>/floor-|linoleum|hall-woven|runner-|living-rug|profiled-skirting|framed-scene|curtain-|localized-damp|localized-drip/.test(p.role);
  for(const p of authored.placements){
    if(isFinish(p)!==finishes)continue;
    if(p.shape==='box')writer.box(p.slot,p.position,p.size,p.rotation,p.role);
    else if(p.shape==='bevelBox')writer.bevelBox(p.slot,p.position,p.size,p.radius,p.rotation,p.role);
    else if(p.shape==='cylinder')writer.cylinder(p.slot,p.a,p.b,p.radius,p.role);
    else writer.triangle(p.slot,p.points,p.role);
  }
}
