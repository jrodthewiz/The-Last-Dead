import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompilationBudget} from '../vendor/compilation-budget.js';

test('cached work shares an eight millisecond slice rather than yielding per object',async()=>{
 let clock=0,yields=0;
 const budget=createCompilationBudget(async()=>{yields++;},()=>clock);
 for(let i=0;i<10000;i++)await budget();
 assert.equal(yields,0);
 clock=7.99;await budget();assert.equal(yields,0);
 clock=8;await budget();assert.equal(yields,1);
 clock=15.99;await budget();assert.equal(yields,1);
 clock=16;await budget();assert.equal(yields,2);
});

test('the next slice begins after scheduler delay and long shader work still yields',async()=>{
 let clock=0,yields=0;
 const budget=createCompilationBudget(async()=>{yields++;clock+=25;},()=>clock);
 clock=12;await budget();assert.equal(yields,1);assert.equal(clock,37);
 await budget();assert.equal(yields,1);
 clock=100;await budget();assert.equal(yields,2);
});

test('scheduler rejection propagates to the loading failure path',async()=>{
 let clock=0;
 const budget=createCompilationBudget(async()=>{throw Error('scheduler stopped');},()=>clock);
 clock=9;await assert.rejects(budget(),/scheduler stopped/);
});
