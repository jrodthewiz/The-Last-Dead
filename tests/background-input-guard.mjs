// Install before loading an owned background QA page. Native capture attempts
// fail explicitly; they never delegate to Windows or pretend to acquire a lock.
export async function guardBackgroundInput(page){
 await page.addInitScript(()=>{
  const attempts={pointerLock:0,fullscreen:0,keyboardLock:0};
  window.__BACKGROUND_INPUT_GUARD__=attempts;
  const deny=(owner,name,kind)=>{
   if(!owner||typeof owner[name]!=='function')return;
   Object.defineProperty(owner,name,{configurable:true,value:function(){
    attempts[kind]++;
    throw new Error(`Background QA forbids native ${kind}`);
   }});
  };
  deny(Element.prototype,'requestPointerLock','pointerLock');
  deny(Element.prototype,'requestFullscreen','fullscreen');
  deny(navigator.keyboard,'lock','keyboardLock');
 });
}

export async function backgroundInputState(page){
 return page.evaluate(()=>({
  webdriver:navigator.webdriver===true,
  pointerLocked:!!document.pointerLockElement,
  fullscreen:!!document.fullscreenElement,
  attempts:{...window.__BACKGROUND_INPUT_GUARD__}
 }));
}
