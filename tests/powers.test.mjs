import test from "node:test";
import assert from "node:assert/strict";
import {POWER_REGISTRY,POWER_TABLE,identifyPower} from "../module/powers/registry.mjs";
import {pointsFor,initialPoints,spendPoints,recoverPoints,powerResult,effectivePowerHealth,powerModifier,effectExpired} from "../module/powers/rules.mjs";
import {powerForRoll} from "../module/creation/config.mjs";
import {evaluateCheck} from "../module/rolls/rules.mjs";
import {actionSnapshot} from "../module/combat/rules.mjs";

test("20 canonical powers retain creation order and legacy aliases without duplicate definitions",()=>{
  assert.equal(Object.keys(POWER_REGISTRY).length,20);assert.equal(new Set(POWER_TABLE).size,20);
  for(let i=1;i<=20;i++)assert.equal(identifyPower(powerForRoll(i)).key,POWER_TABLE[i-1]);
  for(const name of ["Hipersentido","Supersentido"])assert.equal(identifyPower(name).key,"superSense");
  for(const name of ["Adaptación metabólica","Supermetabolismo"])assert.equal(identifyPower(name).key,"superMetabolism");
  assert.equal(identifyPower("Visión de Rayos-X").key,"xRayVision");
  for(const p of Object.values(POWER_REGISTRY))assert.equal(Object.keys(p.results).length,4);
  assert.equal(POWER_REGISTRY.telekinesis.baselineWeightKg,10);
  assert.equal(POWER_REGISTRY.mindReading.rangeMeters,0);
});
test("PM is initialized from the Attribute once; zero remains exhausted; recovery is capped",()=>{
  const system={attributes:{mutantPower:{value:12}},mutantPower:{}};
  assert.deepEqual(pointsFor(system),initialPoints(12));
  system.mutantPower.points={value:0,max:12};assert.equal(pointsFor(system).value,0);
  assert.deepEqual(spendPoints({value:12,max:12},3),{value:9,max:12});
  assert.deepEqual(recoverPoints({value:7,max:12},3),{value:10,max:12});
  assert.deepEqual(recoverPoints({value:10,max:12},5),{value:12,max:12});
  assert.throws(()=>spendPoints({value:0,max:12},1));
  assert.equal(spendPoints({value:0,max:12},5,true).value,0);
  for(const cost of [0,6,1.2,NaN])assert.throws(()=>spendPoints({value:12,max:12},cost));
  assert.throws(()=>recoverPoints({value:7,max:12},-1));
});
test("power critical classes reuse the optional RollService interpretation",()=>{
  assert.equal(powerResult(evaluateCheck(1,0,false)),"failure");
  assert.equal(powerResult(evaluateCheck(20,25,false)),"success");
  assert.equal(powerResult(evaluateCheck(1,0,true)),"criticalSuccess");
  assert.equal(powerResult(evaluateCheck(20,25,true)),"criticalFailure");
});
test("temporary effects preserve base health and values; combat snapshots omit private notes",()=>{
  const actor={system:{cloneNumber:1,health:{status:"healthy",notes:"SECRET"}},effects:[{flags:{"paranoia-2-edition":{powerEffect:{fatigue:1,modifiers:[{type:"skill",key:"cynicism.con",value:5}]}}}}]};
  assert.equal(effectivePowerHealth(actor).status,"wounded");assert.equal(actor.system.health.status,"healthy");
  assert.equal(powerModifier(actor,"skill","cynicism.con"),5);assert.equal(powerModifier(actor,"skill","agility.club"),0);
  const snapshot=actionSnapshot({id:"a",actor},{action:"other",movement:"walk"});
  assert.equal(snapshot.health.status,"wounded");assert.equal(snapshot.health.notes,undefined);
  actor.effects[0].flags["paranoia-2-edition"].powerEffect.fatigue=2;
  assert.equal(actionSnapshot({id:"a",actor},{action:"other",movement:"walk"}),null);
  assert.equal(effectExpired({endsAt:60},59),false);assert.equal(effectExpired({endsAt:60},60),true);
  assert.equal(effectExpired({combatId:"c",endsRound:4},0,{id:"c",round:4}),true);
});
