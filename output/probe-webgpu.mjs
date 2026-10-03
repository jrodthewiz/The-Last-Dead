import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/wolfk/Desktop/Dogfight/node_modules/playwright');
const b=await chromium.launch({headless:true,executablePath:'C:/Users/wolfk/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe',args:['--enable-unsafe-webgpu','--enable-unsafe-swiftshader']});
try{const p=await b.newPage();await p.goto('http://127.0.0.1:5200/scavenger-pack.js');console.log(await p.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter();return{gpu:!!navigator.gpu,adapter:!!a,info:a?.info,features:a?[...a.features]:[]};}));}finally{await b.close();}


