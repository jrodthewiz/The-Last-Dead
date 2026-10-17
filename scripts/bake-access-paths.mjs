import{writeFile}from'node:fs/promises';
import{createWorldData,ROADS,terrainHeight}from'../island/data.js';
import{YARDS}from'../island/settlement-plan.js';
import{createAccessPaths,accessSignature}from'../island/access-plan.js';
const data=createWorldData(),paths=createAccessPaths(data.buildings,ROADS,terrainHeight,YARDS,{useCache:false});
await writeFile(new URL('../island/access-layout.js',import.meta.url),'// Canonical access routes. Regenerate with scripts/bake-access-paths.mjs.\nexport const ACCESS_SIGNATURE='+JSON.stringify(accessSignature(data.buildings,ROADS,YARDS))+';\nexport const ACCESS_LAYOUT='+JSON.stringify(paths)+';\n');
console.log('Prepared '+paths.length+' village access routes.');
