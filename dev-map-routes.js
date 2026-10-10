export const DEV_MAPS = Object.freeze([
  {id:'island',name:'OPEN WORLD',detail:'Blackwater Island'},
  {id:'descent',name:'THE LAST DEAD',detail:'Connected dungeon'},
]);

// A selected map wins over any floor/arena route from an earlier inspection.
// Navigate to a fresh renderer so switching large worlds releases the old GPU.
export function devMapHref(map,search=globalThis.location?.search||'') {
  if(!DEV_MAPS.some(choice=>choice.id===map))throw new Error(`Unknown development map: ${map}`);
  const params=new URLSearchParams(search);
  for(const key of ['world','dungeon','campaign','sector','extended','district'])params.delete(key);
  params.set('dev','1');params.set('inspect','1');
  if(map==='island')params.set('world','island');
  return `?${params}`;
}
