// Broad silhouettes and a few readable mechanisms survive the console picture.
// Every substantial feature supplies the same solid volume as its visible kit.
export function businessDetails({box,cylinder,disc,label,palette},identity,x,z,{feature=false}={}){
 const {edge,wood,paper,metal}=palette,colour=identity.colour;
 const placard=(text,subline,xx,yy,zz,w,h)=>{
  box('feature-sign-board',xx,yy,zz,w+.10,h+.08,.08,edge,true);
  for(const dx of [-w*.38,w*.38])box('feature-sign-upright',xx+dx,yy/2,zz-.025,.06,yy,.07,metal,true);
  label(text,subline,xx,yy,zz+.045,w,h);
 };
 const crt=(xx,zz)=>{
  box('terminal-base',xx,.95,zz,.65,.12,.55,edge);
  box('crt-housing',xx,1.26,zz-.13,.79,.55,.68,0xaba98a);
  box('crt-bezel',xx,1.28,zz+.225,.67,.43,.055,edge);
  box('crt-screen',xx,1.29,zz+.258,.54,.32,.016,0x536e5d);
  for(let i=0;i<3;i++)box('terminal-lines',xx-.05,1.36-i*.075,zz+.269,.32-i*.04,.015,.008,0xb1bd8b);
  box('terminal-keyboard',xx,.943,zz+.56,.68,.07,.29,paper);
  for(let i=0;i<4;i++)box('keyboard-row',xx,.983,zz+.47+i*.055,.53,.012,.025,edge);
 };
 if(!feature){
  if(identity.id==='press'){
   box('typewriter-body',x,1.01,z,.83,.24,.62,edge);
   box('typewriter-platen',x,1.18,z-.16,.64,.17,.17,metal);
   box('typewriter-paper',x,1.33,z-.20,.53,.55,.025,paper);
   for(let i=0;i<4;i++)box('manuscript-line',x,1.46-i*.075,z-.18,.37,.018,.01,edge);
   for(let i=0;i<5;i++)box('typewriter-keys',x,1.01,z+.24+i*.042,.65,.045,.025,paper);
  }else if(identity.id==='studio'){
   box('drawing-board',x,.94,z,1.65,.07,.92,paper);
   box('plan-outline',x, .982,z,.90,.015,.60,edge);
   box('plan-paper',x,.993,z,.84,.012,.54,paper);
   for(const dx of [-.30,.1,.30])box('plan-partition',x+dx,1.003,z,.018,.01,.46,colour);
   box('set-square',x+.63,1.005,z,.045,.025,.63,wood);
   box('set-square',x+.42,1.005,z+.28,.46,.025,.045,wood);
  }else if(identity.id==='radio'){
   box('mixing-console',x,1.01,z,1.7,.24,.95,edge);
   for(let i=0;i<7;i++){const xx=x-.67+i*.22;box('fader-channel',xx,1.137,z,.025,.012,.46,paper);box('fader-cap',xx,1.16,z+(i%3-.8)*.12,.10,.05,.09,colour);cylinder('console-knob',xx,1.15,z-.32,.045,.05,paper);}
   box('console-meter',x,1.18,z-.53,1.30,.18,.08,wood);
   for(const dx of [-.33,.33])box('meter-window',x+dx,1.20,z-.48,.49,.10,.018,0xb2b887);
  }else if(identity.id==='shipping'){
   box('manifest-board',x,.94,z,1.25,.035,.79,paper);
   for(let i=0;i<5;i++)box('manifest-lines',x,.965,z-.25+i*.12,.97,.012,.018,edge);
   box('dispatch-phone',x+.7,1.00,z+.10,.52,.20,.46,colour);
   box('phone-receiver',x+.7,1.14,z+.08,.64,.10,.15,edge);
  }else{
   crt(x,z);box('file-tray',x+.98,.97,z,.44,.14,.59,metal);
   for(let i=0;i<3;i++)box('file-envelope',x+.98,1.05+i*.028,z,.39,.022,.51,paper);
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
