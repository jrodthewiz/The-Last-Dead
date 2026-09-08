import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const out=path.resolve('docs/build06-reviews');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const results=[],errors=[];
try{const page=await browser.newPage({viewport:{width:1000,height:800}});page.on('pageerror',e=>errors.push(e.message));
for(const asset of ['reliquary','bellwraith','ossuary'])for(const view of ['three-quarter','front','side']){
 await page.goto(`http://127.0.0.1:5200/tests/build06-model-review.html?asset=${asset}&view=${view}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.reviewReady,undefined,{timeout:20000});
 results.push(await page.evaluate(()=>window.review));await page.screenshot({path:path.join(out,`${asset}-${view}.png`)});
}
await writeFile(path.join(out,'model-results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));if(errors.length||results.some(r=>r.failedPrograms))process.exitCode=1;
}finally{await browser.close();}
