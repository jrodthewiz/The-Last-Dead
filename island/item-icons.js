export function itemIcon(id){
 const paths={
 'keeper-fuse':'<path d="M13 34h38v20H13z" fill="#c5b58a"/><path d="M8 31h11v26H8zM45 31h11v26H45z" fill="#8da28b"/><path d="M19 42h26v4H19z" fill="#65765c"/><path d="M22 35h19v3H22z" fill="#e0d4a7"/>',
 beer:'<path d="M27 7h10v18l8 12v44q-13 8-26 0V37l8-12z" fill="#685440"/><path d="M27 7h10v7H27z" fill="#c5ba8c"/><path d="M20 45h24v24H20z" fill="#c2a576"/><path d="m26 59 6-9 6 9-6 6z" fill="#4f6b56"/>',
 bandage:'<path d="m10 38 31-13 14 29-32 17z" fill="#c7c6aa"/><path d="m21 34 13 30m-5-33 13 28" stroke="#8c997f" stroke-width="3"/><path d="m32 39 9 18m-14-4 19-8" stroke="#9d6352" stroke-width="5"/>',
 dressing:'<path d="M10 24h44v46H10z" fill="#c7c6aa"/><path d="M28 32h8v30h-8zM17 43h30v8H17z" fill="#9d6352"/>',
 cloth:'<path d="m8 37 38-15 12 37-37 17z" fill="#a5b69d"/><path d="m21 33 10 37m-3-40 12 36m-19-8 31-13" stroke="#758a77" stroke-width="3"/>',
 antiseptic:'<path d="M23 14h18v12l9 10v41H14V36l9-10z" fill="#799c94"/><path d="M22 8h20v10H22z" fill="#c6c5a5"/><path d="M18 43h28v22H18z" fill="#c6c5a5"/><path d="m30 47 5 14m-10-5 14-4" stroke="#637a6a" stroke-width="4"/>',
 scrap:'<path d="m9 29 8-8 8 10 18-4 8 13-6 9-10-5-10 15-9-7 8-20z" fill="#a4a98e"/><path d="m24 66 25-11 6 12-24 12z" fill="#6d877d"/>',
 ammo:'<path d="M10 34h44v40H10z" fill="#9c8d62"/><path d="M10 42h44M21 34v40M43 34v40" stroke="#4c6453" stroke-width="5"/><path d="M23 15h8v18h-8zM35 11h8v22h-8z" fill="#c5b17b"/>',
 'weapon-ossuary':'<path d="m9 40 43-9 3 8-17 5-4 7-8-1-3 22-11-3 2-20-9 1z" fill="#9ca994"/><path d="m12 50 12 1-3 18-9-2z" fill="#8f6c49"/><circle cx="28" cy="42" r="9" fill="#657c70"/>',
 'weapon-bat':'<path d="m10 70 30-48q8-10 14-4t1 13L22 77z" fill="#9a7b55"/><path d="m12 66 10 6m-7-11 11 6m-8-11 11 6" stroke="#c5bda0" stroke-width="3"/>',
 'weapon-chainsaw':'<path d="m29 43 18-26 8 2-1 8-19 25z" fill="#a6b7a1" stroke="#536c5e" stroke-width="3"/><path d="m11 46 15-9 17 16-13 17-20-5z" fill="#a36c50"/><path d="m12 42-6 10 4 13m8-13 16 7m-19-2 14 8" fill="none" stroke="#3b5348" stroke-width="4"/>',
 'weapon-reliquary':'<path d="m9 60 33-39 14 13-33 40z" fill="#7d9483"/><path d="m10 55 15 14m13-41 13 12" stroke="#c3ba8d" stroke-width="7"/><path d="m20 71-7 9-7-6 8-10" fill="#8f714c"/>',
 'weapon-arc':'<path d="m22 60 21-29 5 4-21 30zM38 33l5-16 5 3-3 17M45 39l13-12 3 4-12 13" fill="#92a89a"/><path d="m28 38 12 8-10 16-12-8z" fill="#c5bd95"/><path d="m20 62 10 5-6 15-9-4z" fill="#7f6248"/>',
 'weapon-breach':'<path d="m19 51 26-34 5 3-25 35m1 2 25-34 5 3-25 35" stroke="#aab5a0" stroke-width="5"/><path d="m12 50 21 11-11 10-9-8-6 13-8-5z" fill="#947552"/>',
 'weapon-carrion':'<path d="m10 50 37-27 6 8-22 17-2 9-13 2-2 17-8-3 3-17-7 2z" fill="#91a394"/><path d="m27 51 9 3-1 20-9-4z" fill="#b1a16c"/>',
 'weapon-mourning':'<path d="m10 58 42-38 3 4-38 38 4 7-11 12-9-7z" fill="#9aa997"/><path d="m25 42 13-13 6 6-14 13z" fill="#3e584c"/><path d="m8 60 12 9-10 11-9-7z" fill="#9b7954"/>',
 'weapon-carbine':'<path d="m10 60 36-38 7 6-25 26 2 9-10 4-7 14-11-7z" fill="#92a695"/><path d="m12 56 10 9-9 15-10-6m19-29 15-15 5 4-14 16" fill="#9d7c54"/>',
 weapon:'<path d="m7 41 40-10 4 7 10-2 2 6-14 6-16 3-3 24-9-2 1-20-12 2z" fill="#98a89b"/><path d="m7 49 16-3-2 12-14 4z" fill="#9d7c54"/>',
 };
 return `<svg viewBox="0 0 64 88" aria-hidden="true" focusable="false">${paths[id]||paths[id.startsWith('ammo-')?'ammo':'weapon']}</svg>`;
}
