import test from 'node:test';
import assert from 'node:assert/strict';
import {GamepadInput} from '../gamepad-input.js';
import {journeyPrompt,journeyTransmission} from '../journey-presentation.js';

test('operate input preserves the independent harvest binding and rearms after pause',()=>{
 const pad={index:0,id:'standard',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
 const input=new GamepadInput();input.poll([pad]);
 pad.buttons[8].pressed=true;
 let frame=input.poll([pad]);assert.equal(frame.interact,true);assert.equal(frame.harvest,false);
 pad.buttons[2].pressed=true;frame=input.poll([pad]);assert.equal(frame.interact,true);assert.equal(frame.harvest,true);
 input.suppress();assert.equal(input.poll([pad]).interact,false);
 pad.buttons[8].pressed=false;pad.buttons[2].pressed=false;input.poll([pad]);
 pad.buttons[8].pressed=true;assert.equal(input.poll([pad]).interact,true);
});
test('chapter communication survives action completion while the input prompt disappears',()=>{
 const run={playerId:'host',journey:{title:'No Further Transfers',progress:.6,prompts:{host:{available:true,label:'Stop further transfers'}},log:[{speaker:'The Warden',text:'Transfer intake closed.'}]}};
 assert.match(journeyPrompt(run).text,/HOLD Q/);assert.match(journeyPrompt(run,'gamepad').text,/VIEW/);
 run.journey.prompts={};run.journey.prompt=null;
 assert.equal(journeyPrompt(run),null);assert.equal(journeyTransmission(run).text,'Transfer intake closed.');
 assert.equal(journeyTransmission({}),null);
});
