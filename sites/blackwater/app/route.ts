import game from '../lib/game-shell';
export function GET(){return new Response(game,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}});}
