import {readFileSync,writeFileSync,existsSync,readdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve('promotion/descent-film'), work=path.join(root,'.tesseract-work');
const project=path.join(root,'The Last Dead - Descent.tsrct');
const cli='C:/Users/wolfk/AppData/Local/Tesseract/public-cli/0.2.0-x86_64/bin/tsrct.exe';
const releaseRoot=path.resolve('.codex-temp/trailer-ffmpeg/release');
const release=readdirSync(releaseRoot).find(n=>n.startsWith('ffmpeg-'));
const ffmpeg=path.join(releaseRoot,release,'bin/ffmpeg.exe'),ffprobe=path.join(releaseRoot,release,'bin/ffprobe.exe');
writeFileSync(path.join(work,'tools.json'),JSON.stringify({ffmpeg,ffprobe,cli},null,2));
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const ts=(...args)=>{const raw=execFileSync(cli,args,{encoding:'utf8',maxBuffer:20*1024*1024,windowsHide:true});return raw.trim()?JSON.parse(raw):null};
const ff=args=>execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-threads','2','-filter_threads','2',...args],{stdio:'inherit',windowsHide:true});
const probe=file=>readFileProbe(file);
function readFileProbe(file){return JSON.parse(execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',windowsHide:true}));}
const mode=process.argv[2]||'assemble';
const audioSources=[
 {id:'score',file:'Score.wav',original:'assets/audio/music/abandoned-passages.ogg',start:0,volume:1},
 {id:'air',file:'Air.wav',original:'assets/audio/sourced/horror/dark-cavern-loop.ogg',start:0,volume:.48},
 {id:'industrial',file:'Industrial.wav',original:'assets/audio/sourced/horror/industrial-reveal.ogg',start:0,volume:.65},
 {id:'sting',file:'Sting.wav',original:'assets/audio/sourced/horror/string-sting.ogg',start:11.65,volume:.63},
 {id:'scream',file:'Distant scream.wav',original:'assets/audio/sourced/horror/distant-scream-rough.ogg',start:27.3,volume:.45},
];
if(mode==='audio'){
 const recipes=[];
 for(const source of audioSources){
  const output=path.join(root,'Sources',source.file);
  if(existsSync(output))continue;
  let args;
  if(source.id==='score'){
   args=['-n','-i',source.original,'-i',source.original,'-i',source.original,'-filter_complex_threads','2','-filter_complex','[0:a][1:a]acrossfade=d=2:c1=tri:c2=tri[ab];[ab][2:a]acrossfade=d=2:c1=tri:c2=tri,atrim=duration=67,loudnorm=I=-22:TP=-3:LRA=12,afade=t=in:d=1.2,afade=t=out:st=61:d=6','-ar','48000',output];
  }else{
   const level=source.id==='air'?-26:-20;
   const tail=source.id==='air'?',afade=t=in:d=1.2,afade=t=out:st=61:d=6':',afade=t=in:d=0.025,afade=t=out:st='+Math.max(0,Number(probe(source.original).format.duration)-.45)+':d=0.45';
   args=['-n','-i',source.original,'-t','67','-af',`loudnorm=I=${level}:TP=-3:LRA=12${tail}`,'-ar','48000',output];
  }
  ff(args);recipes.push({source:source.original,output,command:args,metadata:probe(output)});
 }
 writeFileSync(path.join(work,'audio-recipes.json'),JSON.stringify(recipes,null,2));
 ff(['-n','-i',path.join(root,'Sources','Score.wav'),'-filter_complex','showwavespic=s=1600x280:colors=0xd6ba95','-frames:v','1',path.join(root,'Previews','score-waveform.png')]);
 console.log('Local soundtrack stems prepared.');
 process.exit(0);
}
const shots=read(path.join(work,'shots.json'));
const audio=audioSources.map(s=>({...s,path:path.join(root,'Sources',s.file)}));
const imports=[];
for(let i=0;i<shots.length;i++){
 const shot=shots[i];const stem=String(i+1).padStart(2,'0')+'-'+shot.name.toLowerCase().replaceAll(' ','-');
 const file=path.join(root,'Sources',stem+'.mp4');
 const result=ts('project','import-video','--project',project,'--file',file,'--asset-id','shot-'+i);
 imports.push({shot,file,result,metadata:probe(file)});console.log('Imported '+stem);
}
for(const a of audio){ts('project','import-asset','--project',project,'--file',a.path,'--asset-id',a.id,'--kind','audio');a.duration=Number(probe(a.path).format.duration);}
writeFileSync(path.join(work,'imports.json'),JSON.stringify({imports,audio},null,2));
const editable=path.join(work,'editable.json');ts('project','checkout','--project',project,'--output',editable);
const doc=read(editable);doc.dimensions={width:1920,height:1080};doc.duration=67;doc.composition.name='Five floors / One way down';
const transform=(x=0,y=0)=>({anchorPoint:[0,0],position:[x,y],scale:[100,100],rotation:0,opacity:100});
let time=0;
doc.composition.layers=imports.map(({shot,result},i)=>{
 const duration=Math.round(shot.duration*1000);const layer={type:'Video',id:i+1,name:`Floor ${shot.floor+1} / ${shot.name}`,activeRange:{start:time,duration},sourceRange:{start:0,duration},sourceIntrinsicDuration:result.durationMs,volume:0,transform:transform(),source:{assetId:result.assetId,fit:'contain'}};
 time+=duration;return layer;
});
let audioId=100;
for(const a of audio){
 const starts=a.id==='sting'?[11.65,35.65,61.65]:[a.start];
 for(const start of starts){const dur=Math.round(Math.min(a.duration,67-start)*1000);doc.composition.layers.push({type:'Audio',id:audioId++,name:a.id==='sting'?'Descent sting':a.id,activeRange:{start:Math.round(start*1000),duration:dur},sourceRange:{start:0,duration:dur},sourceIntrinsicDuration:Math.round(a.duration*1000),source:{assetId:a.id},volume:a.volume,captionsEnabled:false});}
}
writeFileSync(editable,JSON.stringify(doc,null,2));ts('project','commit','--project',project,'--file',editable);
let id=200;const actions=[];const ink=[.87,.845,.79,1],red=[.68,.16,.13,1];
const rect=(name,x,y,w,h,color,start=0,duration=67000)=>{const layerId=id++;actions.push({type:'createFxRectLayer',compositionId:'main',layerId,name,insertIndex:0,activeRange:{start,duration},transform:transform(x,y),rect:{size:[w,h],fillColor:color}});return layerId};
const text=(value,x,y,w,h,size,start,duration,options={})=>{const layerId=id++;actions.push({type:'createFxTextLayer',compositionId:'main',layerId,name:value,insertIndex:0,activeRange:{start,duration},transform:transform(x,y),sourceText:{text:value,fontFamily:options.sans?'Arial':'Georgia',fontStyle:'Regular',fontSize:size,fillColor:options.color||ink,strokeWidth:0,justification:options.align||'left',boxText:true,boxPosition:[0,0],boxSize:[w,h],tracking:options.tracking||0,verticalAlign:'top'}});return layerId};
const keys=(layerId,propertyType,points)=>actions.push({type:'setFxPropertyKeyframes',compositionId:'main',property:{layerId,propertyType},keyframes:points.map(([layerTime,value],i)=>({id:`${layerId}-${propertyType}-${i}`,layerTime,value:{type:'float',value},easing:{type:'linear'}}))});
const fade=(layerId,duration,hold=duration-650)=>keys(layerId,'opacity',[[0,0],[400,100],[hold,100],[duration-1,0]]);
// The final sting uses a shorter source window; fade its tail before the movie ends.
keys(105,'volume',[[0,.63],[4550,.63],[5349,0]]);
rect('Cinema top',0,0,1920,105,[0,0,0,1]);rect('Cinema bottom',0,975,1920,105,[0,0,0,1]);
const floors=['Intake Foundry','Graft Galleries','The Catacombs','Resonance','The Last Descent'];
for(let floor=0;floor<5;floor++){
 const start=floor*12000+650,duration=4800;
 const band=rect('Floor title shadow',88,789,800,158,[0,0,0,.62],start,duration);fade(band,duration);
 const line=rect('Descent marker',116,820,3,91,red,start,duration);fade(line,duration);
 const small=text(`FLOOR 0${floor+1}`,143,815,650,35,19,start,duration,{sans:true,tracking:180,color:[.75,.56,.49,1]});fade(small,duration);
 const title=text(floors[floor],140,850,1080,90,49,start,duration);fade(title,duration);
}
const hook=text('FIVE FLOORS. ONE WAY DOWN.',1070,145,740,55,23,800,4500,{sans:true,tracking:120,align:'right'});fade(hook,4500);
// Brief black breaths at the ends of chapters, with no flashes or visual fabrication.
for(const i of [2,5,8,11,14]){const d=Math.round(shots[i].duration*1000);keys(i+1,'opacity',[[0,100],[d-250,100],[d-1,0]]);}
rect('End card',0,0,1920,1080,[.009,.012,.013,1],62000,5000);
const cap=text('THE',160,326,1600,85,40,62250,4400,{align:'center',tracking:240});fade(cap,4400);
const name=text('LAST DEAD',160,425,1600,190,146,62250,4400,{align:'center',tracking:30});fade(name,4400);
const rule=rect('Final red line',873,638,174,2,red,62650,3850);fade(rule,3850);
const ending=text('THE ONLY WAY OUT IS DOWN.',160,687,1600,60,24,62700,3800,{sans:true,align:'center',tracking:160});fade(ending,3800);
writeFileSync(path.join(work,'edit-actions.json'),JSON.stringify(actions,null,2));ts('project','apply','--project',project,'--actions',path.join(work,'edit-actions.json'));
ts('project','checkout','--project',project,'--output',editable);
writeFileSync(path.join(work,'edit-plan.json'),JSON.stringify({duration:67,fps:24,canvas:[1920,1080],floors: floors.map((name,i)=>({name,start:i*12,end:i===4?62:(i+1)*12})),shots,audio,source:'Game Renderer, native dungeon courses, authored enemy spawns; staged cinematic cameras; combat AI held',audioReview:'Waveforms and loudness checked locally; no auditory perception tool available in this session.'},null,2));
console.log('Editable film assembled. Render with the installed Tesseract CLI.');
