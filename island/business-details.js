// Broad silhouettes and a few readable mechanisms survive the console picture.
// Every substantial feature supplies the same solid volume as its visible kit.
export function businessDetails({box,cylinder,disc,label,palette},identity,x,z,{feature=false,station='active'}={}){
 const {edge,wood,paper,metal}=palette,colour=identity.colour;
 const placard=(text,subline,xx,yy,zz,w,h)=>{
  box('feature-sign-board',xx,yy,zz,w+.10,h+.08,.08,edge,true);
  for(const dx of [-w*.38,w*.38])box('feature-sign-upright',xx+dx,yy/2,zz-.025,.06,yy,.07,metal,true);
  label(text,subline,xx,yy,zz+.045,w,h);
 };
 const crt=(xx,zz)=>{
  box('terminal-base',xx,.95,zz,.65,.12,.55,edge);
  box('crt-housing',xx,1.26,zz-.16,.79,.55,.64,0xaba98a);
  box('crt-bezel',xx,1.28,zz+.185,.67,.43,.055,edge);
  box('crt-screen',xx,1.29,zz+.221,.54,.32,.016,0x536e5d);
  for(let i=0;i<3;i++)box('terminal-lines',xx-.05,1.36-i*.075,zz+.232,.32-i*.04,.015,.008,0xb1bd8b);
  box('terminal-keyboard',xx,.925,zz+.39,.68,.07,.28,paper);
  for(let i=0;i<3;i++)box('keyboard-row',xx,.966,zz+.31+i*.075,.53,.012,.03,edge);
 };
 if(!feature){
  // Table tops end at .89 m. Secondary stations use a few broad, supported
  // forms instead of repeating the full working machine four times.
  if(station==='handover'){
   box('handover-folio',x-.25,.909,z,1.22,.038,.82,colour);
   for(const dx of [-.28,.28]){
    box('handover-open-page',x-.25+dx,.936,z,.53,.018,.72,paper);
    for(const dz of [-.19,.02])box('handover-log-entry',x-.25+dx,.951,z+dz,.37,.012,.055,edge);
   }
   box('handover-page-marker',x-.25,.953,z-.22,.08,.012,.42,wood);
   cylinder('handover-cup',x+.85,1.00,z+.12,.14,.22,paper);
   cylinder('handover-cold-tea',x+.85,1.114,z+.12,.11,.012,edge);
   return;
  }
  if(station==='packing'){
   const flat=identity.id==='press'||identity.id==='studio';
   box('outgoing-parcel',x-.27,flat?1.00:1.13,z,.99,flat?.22:.48,.74,wood);
   box('parcel-cross-strap',x-.27,flat?1.117:1.377,z,.13,.014,.76,paper);
   box('parcel-address',x-.01,flat?1.117:1.377,z+.10,.36,.014,.27,paper);
   box('dispatch-docket',x+.69,.91,z+.05,.52,.04,.66,paper);
   box('docket-heading',x+.69,.938,z-.16,.37,.014,.07,colour);
   return;
  }
  if(station==='proof'){
   const studio=identity.id==='studio',radio=identity.id==='radio';
   box(studio?'survey-proof-board':radio?'broadcast-rundown':'paper-proof-board',x-.21,.915,z,1.55,.05,.94,edge);
   box('proof-sheet',x-.21,.949,z,1.43,.018,.84,paper);
   if(studio){
    box('survey-proof-coast',x-.21,.967,z,.12,.018,.68,metal);
    for(const dx of [-.43,.32])box('survey-proof-block',x-.21+dx,.967,z+.08,.30,.018,.37,colour);
   }else{
    for(const dx of [-.34,.34])for(const dz of [-.22,.04])box(radio?'rundown-time-block':'proof-column',x-.21+dx,.967,z+dz,.48,.018,.10,colour);
   }
   box('proof-return-folder',x+.91,.93,z+.06,.42,.08,.62,colour);
   return;
  }
  if(station==='offline'){
   if(identity.id==='radio'){
    box('standby-receiver',x,1.10,z,1.22,.42,.66,wood);
    box('receiver-grille',x-.21,1.10,z+.338,.61,.27,.025,edge);
    disc('receiver-tuning-dial',x+.40,1.12,z+.341,.105,.03,paper);
    for(const dx of [-.40,.40])box('receiver-handle-upright',x+dx,1.37,z,.08,.12,.10,edge);
    box('receiver-carry-handle',x,1.47,z,.88,.10,.10,edge);
   }else{
    box(identity.id==='press'?'covered-typewriter':identity.id==='studio'?'closed-survey-case':'closed-records-case',x,1.07,z,1.29,.36,.76,identity.id==='press'?palette.cloth:metal);
    box('equipment-cover-band',x,1.258,z,.13,.016,.78,paper);
    box('equipment-case-latch',x+.38,1.07,z+.395,.14,.15,.04,wood);
   }
   return;
  }
  if(identity.id==='press'){
   box('typewriter-body',x,1.01,z,.83,.24,.62,edge);
   box('typewriter-platen',x,1.18,z-.16,.64,.17,.17,metal);
   box('typewriter-paper',x,1.33,z-.20,.53,.55,.025,paper);
   for(let i=0;i<4;i++)box('manuscript-line',x,1.46-i*.075,z-.18,.37,.018,.01,edge);
   for(let i=0;i<3;i++)box('typewriter-keys',x,1.15,z+.10+i*.075,.65,.04,.04,paper);
  }else if(identity.id==='studio'){
   box('drawing-board',x,.925,z,1.65,.07,.92,paper);
   box('plan-outline',x,.968,z,.90,.016,.60,edge);
   box('plan-paper',x,.982,z,.84,.012,.54,paper);
   for(const dx of [-.30,.1,.30])box('plan-partition',x+dx,.994,z,.035,.012,.46,colour);
   box('set-square',x+.63,.973,z,.065,.025,.63,wood);
   box('set-square',x+.42,.973,z+.28,.46,.025,.065,wood);
  }else if(identity.id==='radio'){
   box('mixing-console',x,1.01,z,1.7,.24,.95,edge);
   for(let i=0;i<4;i++){const xx=x-.57+i*.38;box('fader-channel',xx,1.137,z+.08,.045,.012,.42,paper);box('fader-cap',xx,1.16,z+.08+(i%3-.8)*.12,.15,.05,.11,colour);cylinder('console-knob',xx,1.15,z-.24,.065,.05,paper);}
   box('console-meter',x,1.22,z-.36,1.30,.18,.12,wood);
   for(const dx of [-.33,.33])box('meter-window',x+dx,1.24,z-.292,.49,.10,.018,0xb2b887);
  }else if(identity.id==='shipping'){
   box('manifest-board',x-.38,.91,z,1.02,.04,.79,paper);
   for(let i=0;i<4;i++)box('manifest-lines',x-.38,.938,z-.25+i*.15,.78,.014,.035,edge);
   box('dispatch-phone',x+.65,.99,z+.10,.52,.20,.46,colour);
   box('phone-receiver',x+.65,1.14,z+.08,.64,.10,.15,edge);
  }else{
   crt(x-.32,z);box('file-tray',x+.84,.96,z,.44,.14,.59,metal);
   for(let i=0;i<3;i++)box('file-envelope',x+.84,1.04+i*.028,z,.39,.022,.51,paper);
  }
  return;
 }
 if(identity.id==='press'){
  box('press-base',x,.30,z,2.6,.6,2.0,edge,true);
  for(const dx of [-.95,.95])box('press-side-frame',x+dx,1.10,z,.23,1.55,1.7,metal,true);
  for(let i=0;i<3;i++)box('press-print-stack',x,.68+i*.085,z+.70,1.45,.07,.91,paper);
  box('press-upper-platen',x,1.87,z,2.4,.18,1.8,wood);
  box('press-ink-drum',x,1.50,z-.12,1.60,.38,.52,edge);
  placard(identity.notice,identity.detail,x,2.35,z-.70,3.7,.64);
 }else if(identity.id==='bank'){
  box('vault-plinth',x,.12,z,2.2,.24,1.4,edge,true);
  box('safe-body',x,1.23,z,1.86,2.22,1.16,metal,true);
  box('safe-door',x,1.26,z+.60,1.68,1.93,.12,0x7b8c7b);
  disc('safe-dial',x-.3,1.42,z+.72,.13,.07,edge);
  box('safe-handle',x+.45,1.22,z+.73,.10,.56,.12,paper);
  for(const dx of [-.67,.67])for(const yy of [.47,2.05])box('safe-hinge',x+dx,yy,z+.73,.12,.22,.10,edge);
  placard('RECORDS VAULT','CLOSED FOR THE EVENING',x,2.65,z+.66,2.7,.43);
 }else if(identity.id==='studio'){
  box('model-table',x,.80,z,3.2,.16,2.25,wood,true);
  for(const dx of [-1.25,1.25])box('model-table-trestle',x+dx,.38,z,.16,.76,1.65,edge,true);
  box('model-site',x,.91,z,2.8,.08,1.98,0xa2af8a);
  box('model-river',x,.958,z,2.7,.018,.46,metal);
  for(const side of [-1,1])for(let i=0;i<3;i++)box('model-city',x-.85+i*.85,1.15+(i%2)*.17,z+side*.6,.47,.38+(i%2)*.34,.43,paper);
  box('model-bridge',x,.99,z,.48,.06,1.30,wood);
  for(const side of [-1,1])box('model-bridge-pier',x,1.20,z+side*.40,.055,.46,.07,edge);
  placard(identity.notice,identity.detail,x,2.12,z-.75,3.8,.62);
 }else if(identity.id==='radio'){
  for(const side of [-1,1]){
   box('studio-speaker',x+side*.9,1.12,z,.75,1.85,.62,edge,true);
   for(const y of [.70,1.42])disc('speaker-cone',x+side*.9,y,z+.325,.26,.045,0x374d43);
  }
  box('tape-stand',x,.395,z,1.04,.79,.75,edge,true);
  box('tape-deck',x,1.1,z,1.04,.62,.75,wood,true);
  for(const dx of [-.28,.28]){disc('tape-reel',x+dx,1.21,z+.39,.21,.06,paper);disc('reel-centre',x+dx,1.21,z+.43,.06,.015,edge);}
  placard('COASTLINE / STUDIO','THE EMERGENCY FREQUENCY',x,2.35,z-.40,3.4,.55);
 }else{
  for(let row=0;row<3;row++){
   box('dispatch-cabinet',x, .42+row*.73,z,2.6,.68,.88,metal,true);
   for(const dx of [-.65,.65]){box('cabinet-drawer',x+dx,.42+row*.73,z+.46,1.21,.59,.045,colour);box('drawer-pull',x+dx,.44+row*.73,z+.50,.27,.06,.07,paper);}
  }
  placard(identity.notice,identity.detail,x,2.9,z-.40,3.6,.57);
 }
}
