export const ROOM_PATH='/api/blackwater/rooms';
export const HOST_TTL=30_000,GUEST_TTL=18_000;
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status)=>Object.assign(new Error(message),{status});
const name=(v,fallback)=>String(v||fallback).replace(/[\x00-\x1f<>]/g,'').trim().slice(0,28)||fallback;
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');
export function memoryRooms(){
 const rooms=new Map();return{
  async list(now){return [...rooms.values()].filter(r=>r.host_seen>now-HOST_TTL);},
  async get(id){const r=rooms.get(id);return r?{...r}:null;},
  async create(r){if(rooms.has(r.code))return false;rooms.set(r.code,{...r});return true;},
  async claim(id,t,n,now){const r=rooms.get(id);if(!r||r.status!=='waiting'||r.host_seen<=now-HOST_TTL||(r.guest_token&&r.guest_seen>now-GUEST_TTL))return false;Object.assign(r,{guest_token:t,guest_name:n,guest_seen:now,guest_json:'{}'});return true;},
  async update(id,role,t,packet,now,start=null){const r=rooms.get(id);if(!r||r[role+'_token']!==t)return false;if(start&&(r.status!=='waiting'||r.guest_token!==start.guest||r.guest_seen<=now-GUEST_TTL))return false;r[role+'_seen']=now;r[role+'_json']=packet;if(start)r.status='playing';return true;},
  async leave(id,role,t){const r=rooms.get(id);if(!r||r[role+'_token']!==t)return;if(role==='host')rooms.delete(id);else Object.assign(r,{guest_token:null,guest_name:'',guest_seen:0,guest_json:'{}'});},
  async prune(now){for(const [id,r]of rooms)if(r.host_seen<now-HOST_TTL)rooms.delete(id);}
 };
}
// Compare-and-set claims prevent two simultaneous visitors taking one seat.
export function d1Rooms(db){
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 return{
  async list(now){return(await db.prepare('SELECT * FROM coop_rooms WHERE host_seen > ? ORDER BY host_seen DESC LIMIT 100').bind(now-HOST_TTL).all()).results;},
  get:id=>db.prepare('SELECT * FROM coop_rooms WHERE code = ?').bind(id).first(),
  async create(r){const q=await run('INSERT OR IGNORE INTO coop_rooms (code,name,host_name,host_token,host_seen,host_json,guest_name,guest_seen,guest_json,status) VALUES (?,?,?,?,?,?,?,?,?,?)',r.code,r.name,r.host_name,r.host_token,r.host_seen,r.host_json,'',0,'{}','waiting');return q.meta.changes===1;},
  async claim(id,t,n,now){const q=await run("UPDATE coop_rooms SET guest_token=?,guest_name=?,guest_seen=?,guest_json='{}' WHERE code=? AND status='waiting' AND host_seen>? AND (guest_token IS NULL OR guest_seen<=?)",t,n,now,id,now-HOST_TTL,now-GUEST_TTL);return q.meta.changes===1;},
  async update(id,role,t,packet,now,start=null){const args=[now,packet,id,t];if(start)args.push(start.guest,now-GUEST_TTL);const q=await run(`UPDATE coop_rooms SET ${role}_seen=?,${role}_json=?${start?",status='playing'":''} WHERE code=? AND ${role}_token=?${start?" AND status='waiting' AND guest_token=? AND guest_seen>?":''}`,...args);return q.meta.changes===1;},
  async leave(id,role,t){if(role==='host')await run('DELETE FROM coop_rooms WHERE code=? AND host_token=?',id,t);else await run("UPDATE coop_rooms SET guest_token=NULL,guest_name='',guest_seen=0,guest_json='{}' WHERE code=? AND guest_token=?",id,t);},
  prune:now=>run('DELETE FROM coop_rooms WHERE host_seen < ?',now-HOST_TTL)
 };
}
export async function roomRequest(request,store,{now=Date.now()}={}){
 try{
  const url=new URL(request.url),origin=request.headers.get('origin');
  if(origin&&origin!==url.origin)throw fail('Use this game’s own lobby screen.',403);
  const rest=url.pathname.slice(ROOM_PATH.length).split('/').filter(Boolean),id=rest[0]?.toUpperCase(),action=rest[1];
  if(!url.pathname.startsWith(ROOM_PATH)||rest.length>2)throw fail('Unknown lobby route.',404);
  if(request.method==='GET'&&!id){const rows=await store.list(now);return json({rooms:rows.filter(r=>r.status==='waiting'&&(!r.guest_token||r.guest_seen<=now-GUEST_TTL)).map(r=>({code:r.code,name:r.name,host:r.host_name,players:1,capacity:2})),transport:'https',version:1});}
  if(!['POST','DELETE'].includes(request.method))throw fail('Unsupported lobby action.',405);
  const text=await request.text();if(text.length>96_000)throw fail('Lobby update is too large.',413);let body;try{body=JSON.parse(text||'{}');}catch{throw fail('Invalid lobby update.',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Invalid lobby update.',400);
  if(!id&&request.method==='POST'){
   await store.prune(now);if((await store.list(now)).length>=100)throw fail('All radio channels are busy. Try again shortly.',429);
   const r={code:code(),name:name(body.name,'Blackwater expedition'),host_name:name(body.player,'Survivor'),host_token:token(),host_seen:now,host_json:'{}',guest_token:null,guest_name:'',guest_seen:0,guest_json:'{}',status:'waiting'};
   if(!await store.create(r))throw fail('That channel was busy. Please host again.',409);
   return json({code:r.code,token:r.host_token,role:'host'},201);
  }
  if(!/^[A-Z2-9]{6}$/.test(id||''))throw fail('Enter a six-character lobby code.',400);
  let r=await store.get(id);if(!r||r.host_seen<=now-HOST_TTL)throw fail('That expedition has closed.',404);
  if(action==='join'&&request.method==='POST'){
   const t=token();if(!await store.claim(id,t,name(body.player,'Survivor'),now))throw fail('That lobby is full or has already started.',409);
   return json({code:id,token:t,role:'guest'});
  }
  const role=body.token===r.host_token?'host':body.token&&body.token===r.guest_token?'guest':null;
  if(!role)throw fail('This lobby connection is no longer valid.',403);
  if(request.method==='DELETE'){await store.leave(id,role,body.token);return json({left:true});}
  if(!['sync','start'].includes(action))throw fail('Unknown lobby action.',404);
  if(action==='start'&&(role!=='host'||!r.guest_token||r.guest_seen<=now-GUEST_TTL))throw fail('Wait for your second survivor before departing.',409);
  const packet=JSON.stringify(body.packet||{});if(packet.length>80_000)throw fail('World update is too large.',413);
  if(!await store.update(id,role,body.token,packet,now,action==='start'?{guest:r.guest_token}:null))throw fail(action==='start'?'Your second survivor left. Wait for a new partner.':'That lobby connection has ended.',action==='start'?409:403);
  r=await store.get(id);const connected=!!r.guest_token&&r.guest_seen>now-GUEST_TTL;
  // Public incarnation changes on every seat claim without exposing its credential.
  const guestEpoch=connected?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(r.guest_token))),b=>b.toString(16).padStart(2,'0')).join('').slice(0,32):'';
  return json({code:id,name:r.name,status:r.status,host:r.host_name,guest:connected?r.guest_name:'',guestEpoch,connected,packet:JSON.parse(role==='host'?(connected?r.guest_json:'{}'):r.host_json)});
 }catch(error){return json({error:error.status?error.message:'The radio service is unavailable. Please try again.'},error.status||503);}
}
