// Native controls keep their own arrow keys; menus share one visible focus order.
const SCREENS={title:'title',pause:'overlay',settings:'overlay',dead:'overlay',won:'overlay',map:'map-screen',record:'record-screen',inspection:'inspection',flight:'flight-panel',backpack:'backpack'};
export function focusControl(id){const el=document.getElementById(id);if(el&&!el.disabled&&el.getClientRects().length)el.focus({preventScroll:true});}
export function menuNavigation(event,mode){
 const root=document.getElementById(SCREENS[mode]);if(!root)return false;
 const tab=event.code==='Tab',arrow=['ArrowUp','ArrowDown'].includes(event.code);
 if(!tab&&!arrow)return false;
 if(arrow&&event.target.matches('input,select,textarea'))return false;
 const controls=[...root.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&el.getClientRects().length),index=controls.indexOf(document.activeElement);
 if(!controls.length)return false;
 const step=tab?(event.shiftKey?-1:1):(event.code==='ArrowUp'?-1:1),next=index<0?(step>0?0:controls.length-1):(index+step+controls.length)%controls.length;
 event.preventDefault();controls[next].focus();return true;
}
