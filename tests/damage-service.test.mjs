import test from "node:test";
import assert from "node:assert/strict";
import {DamageService} from "../module/damage/service.mjs";
let rolls=0;
globalThis.game={user:{isGM:true},time:{worldTime:0},combats:{find:()=>null}};
globalThis.foundry={utils:{randomID:()=>"test-damage"},dice:{Roll:class{async evaluate(){rolls++;return {total:20};}}}};
function target(){
 const actor={type:"character",uuid:"Actor.test",system:{cloneNumber:1,stamina:0,health:{status:"healthy",stunned:false}},items:[],
 toObject:()=>({system:{health:structuredClone(actor.system.health)}}),async update(changes){actor.system.health=changes['system.health'];return actor;}};
 actor.system.toObject=()=>({health:structuredClone(actor.system.health)});return actor;
}
test("explicit manual health result uses DamageService without inventing ND or a die",async()=>{
 const a=target();rolls=0;const r=await DamageService.resolveDamage({target:a,manualOnly:true,manualResult:"wounded",sourceAttackId:"attack1",post:false});
 assert.equal(rolls,0);assert.equal(r.finalDamageNumber,undefined);assert.equal(a.system.health.status,"wounded");assert.equal(r.sourceAttackId,"attack1");
 await DamageService.applyResolution(r,{manualResult:"wounded",post:false});assert.equal(a.system.health.status,"wounded");
});
test("damage awaiting adjudication cannot affect a replacement clone",async()=>{
 const a=target();const r=await DamageService.resolveDamage({target:a,baseDamageNumber:8,category:"laser",apply:false,post:false});
 assert.equal(r.dieResult,20);a.system.cloneNumber=2;
 await assert.rejects(DamageService.applyResolution(r,{post:false}),/clon objetivo cambió/);
 assert.equal(a.system.health.status,"healthy");
});
