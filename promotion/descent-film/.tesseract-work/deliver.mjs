import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve('promotion/descent-film'),work=path.join(root,'.tesseract-work');
const {ffmpeg,ffprobe}=JSON.parse(readFileSync(path.join(work,'tools.json'),'utf8'));
const raw=path.join(work,'Tesseract master.mp4');
const master=path.join(root,'The Last Dead - Descent.mp4');
const compact=path.join(root,'The Last Dead - In-Game Preview.mp4');
function measure(file){
 const result=spawnSync(ffmpeg,['-hide_banner','-nostdin','-i',file,'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','NUL'],{encoding:'utf8',windowsHide:true,maxBuffer:5*1024*1024});
 if(result.status!==0)throw new Error(result.stderr);
 const matches=result.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/g);if(!matches?.length)throw new Error('No loudness measurements');return JSON.parse(matches.at(-1));
}
const pass=measure(raw);writeFileSync(path.join(work,'loudness-before.json'),JSON.stringify(pass,null,2));
const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${pass.input_i}:measured_TP=${pass.input_tp}:measured_LRA=${pass.input_lra}:measured_thresh=${pass.input_thresh}:offset=${pass.target_offset}:linear=true`;
execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-i',raw,'-map','0:v:0','-map','0:a:0','-c:v','copy','-af',norm,'-ar','48000','-c:a','aac','-b:a','192k','-movflags','+faststart',master],{stdio:'inherit',windowsHide:true});
execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-i',master,'-vf','scale=1280:720:flags=lanczos','-c:v','libx264','-threads','3','-crf','22','-preset','medium','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',compact],{stdio:'inherit',windowsHide:true});
const report=[];
for(const file of [master,compact]){
 const meta=JSON.parse(execFileSync(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',windowsHide:true}));
 const video=meta.streams.find(s=>s.codec_type==='video'),audio=meta.streams.find(s=>s.codec_type==='audio');
 if(!video||!audio||Math.abs(Number(meta.format.duration)-67)>.15||video.r_frame_rate!=='24/1')throw new Error('Unexpected delivery streams: '+file);
 const loudness=measure(file);if(Number(loudness.input_tp)>-1)throw new Error('Encoded peak exceeds -1 dBTP: '+file);
 execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-i',file,'-f','null','NUL'],{stdio:'pipe',windowsHide:true});
 report.push({file,sizeBytes:statSync(file).size,metadata:meta,loudness,fullDecode:'passed'});
}
execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-ss','1.8','-i',master,'-frames:v','1','-q:v','2',path.join(root,'Previews','Poster.jpg')],{stdio:'inherit',windowsHide:true});
writeFileSync(path.join(work,'delivery-verification.json'),JSON.stringify({revision:'descent-v1',finalNormalization:norm,outputs:report},null,2));
console.log(JSON.stringify(report.map(r=>({file:r.file,bytes:r.sizeBytes,lufs:r.loudness.input_i,truePeak:r.loudness.input_tp,decode:r.fullDecode})),null,2));
