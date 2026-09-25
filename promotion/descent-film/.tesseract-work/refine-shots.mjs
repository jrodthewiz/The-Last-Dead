import {readFileSync,writeFileSync} from 'node:fs';
const root='promotion/descent-film';
const shots=JSON.parse(readFileSync(root+'/.tesseract-work/scout-report.json','utf8')).shots;
// More separation between the camera and foreground machinery, followed by an authored enemy reveal.
shots[1].from=[19.8,9.6,3.0];shots[1].to=[19.0,9.5,3.1];shots[1].look=[17,7,2.4];
Object.assign(shots[2],{name:'Receiving Watcher',from:[4.7,24.3,1.65],to:[4.2,24.1,1.7],look:[3.5,23.5,1.75],fov:52});
shots[4].from=[21.5,9.1,3.0];shots[4].to=[21.0,9.0,3.0];shots[4].look=[17,7,2.4];
Object.assign(shots[5],{name:'Ward A Watcher',from:[6.7,17.7,1.7],to:[6.3,17.4,1.8],look:[5.5,16.5,1.8],fov:56});
shots[7].from=[22.8,10.3,2.6];shots[7].to=[22.3,10.2,2.8];shots[7].look=[19,8,2.5];
Object.assign(shots[8],{name:'Reliquary Warden',from:[22.8,9.7,1.8],to:[22.2,9.4,1.9],look:[20.5,8.5,2.1],fov:55});
shots[9].from=[14.7,18.3,2.3];shots[9].to=[14.6,17.9,2.5];shots[9].look=[17,15,3];
Object.assign(shots[11],{name:'Organ Loft Watcher',from:[30.2,6.8,1.7],to:[29.7,6.5,1.85],look:[28.5,5.5,1.9],fov:58});
shots[13].from=[11.5,17.2,2.2];shots[13].to=[12,17.3,2.4];shots[13].look=[14.5,16,2.5];
Object.assign(shots[14],{name:'The Last Watcher',from:[17.7,6.4,1.7],to:[16.6,6.1,1.8],look:[15.5,5.5,2.05],fov:53});
writeFileSync(root+'/.tesseract-work/shots.json',JSON.stringify(shots,null,2));
