import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {vehicleTransition,vehicleBlocked,smokeProtection,currentMovement,capacityWarning,controlAvailable,assertHumanSalvo} from "../module/vehicles/rules.mjs";
import {healthModifier,blockedReason} from "../module/health/rules.mjs";
import {DamageService} from "../module/damage/service.mjs";
import {actionSnapshot,modifiersForAttack} from "../module/combat/rules.mjs";
import {integratedSelection,attackSlot,allAttacksResolved} from "../module/robots/combat.mjs";
import {operatorAlreadyFired} from "../module/vehicles/combat.mjs";
import {fieldsDialog} from "../module/vehicles/ui.mjs";
const vehicles=JSON.parse(await readFile(new URL("../packs-source/vehicles.json",import.meta.url)));
const weapons=JSON.parse(await readFile(new URL("../packs-source/weapons.json",import.meta.url)));
const equipment=JSON.parse(await readFile(new URL("../packs-source/equipment.json",import.meta.url)));
globalThis.game={user:{isGM:true}};
const health=status=>({kind:"vehicle",status,stunned:false});
test("vehicle uses all six canonical damage results without human/robot escalation",()=>{
  const expected={noEffect:"operational",stunned:"cosmeticDamage",wounded:"lightDamage",incapacitated:"seriousDamage",dead:"destroyed",vaporized:"vaporized"};
  for(const [result,state] of Object.entries(expected))assert.equal(vehicleTransition(health("operational"),result).status,state);
  assert.equal(vehicleTransition(health("lightDamage"),"wounded").status,"lightDamage");
  assert.equal(vehicleTransition(health("seriousDamage"),"wounded").status,"seriousDamage");
  assert.equal(vehicleTransition(health("vaporized"),"stunned").status,"vaporized");
});
test("vehicle light damage has no invented penalty; serious damage blocks with GM adjudication",()=>{
  assert.equal(healthModifier(health("lightDamage"),"dexterity.artillery"),0);
  assert.equal(healthModifier({status:"lightDamage"},"dexterity.artillery"),-4);
  assert.equal(blockedReason(health("cosmeticDamage")),"");assert.ok(vehicleBlocked(health("seriousDamage")));
  assert.equal(modifiersForAttack({baseValue:10,skill:"dexterity.artillery",healthKind:"vehicle",healthStatus:"lightDamage"}).finalTarget,10);
});
function target(){return {type:"vehicle",items:[{id:"armor",type:"armor",system:{integrated:true,equipped:true,protectionType:"all",protectionValue:14}}],system:{health:health("operational"),vehicle:{defense:{smokeActive:false,smallArmsProtection:false}}}};}
test("vehicle T14 uses shared ND arithmetic; smoke adds exactly five without altering armor",()=>{
  const actor=target();assert.equal(DamageService.preview({target:actor,baseDamageNumber:20,category:"laser"}).finalDamageNumber,6);
  actor.system.vehicle.defense.smokeActive=true;assert.equal(DamageService.preview({target:actor,baseDamageNumber:20,category:"laser"}).finalDamageNumber,1);
  assert.equal(DamageService.preview({target:actor,baseDamageNumber:20,category:"energy"}).finalDamageNumber,6);
  assert.equal(actor.items[0].system.protectionValue,14);assert.equal(smokeProtection(actor.system.vehicle,"projectile"),0);
});
test("external hull protects occupant without stacking personal armor or copying health",()=>{
  const hull=target(),occupant={type:"character",system:{stamina:0,health:{status:"healthy"}},items:[{type:"armor",system:{equipped:true,protectionType:"all",protectionValue:9}}]};
  const result=DamageService.preview({target:occupant,protectionVehicle:hull,baseDamageNumber:20,category:"laser"});assert.equal(result.finalDamageNumber,6);assert.equal(occupant.system.health.status,"healthy");
  hull.items[0].system.integrated=false;assert.equal(DamageService.preview({target:hull,baseDamageNumber:20,category:"laser"}).finalDamageNumber,20);
});
test("capacity is mode-specific, zero is valid, unknown capacity stays unknown",()=>{
  const v={capacity:null,temporaryPassengerCapacity:null,crew:Array(7).fill({}),movement:{currentMode:"air",modes:[{key:"air",capacity:6,maxSpeed:50}]}};
  assert.match(capacityWarning(v),/7 \/ 6/);assert.equal(currentMovement(v).maxSpeed,50);v.movement.currentMode="land";assert.match(capacityWarning(v),/no especificada/);v.capacity=0;assert.match(capacityWarning(v),/7 \/ 0/);
});
test("each manual gunner has one weapon; brain may control every integrated weapon",()=>{
  assert.throws(()=>assertHumanSalvo({a:"Actor.human",b:"Actor.human"}),/un arma/);
  assert.doesNotThrow(()=>assertHumanSalvo({a:"electronicBrain",b:"electronicBrain",c:"electronicBrain"}));
  assert.doesNotThrow(()=>assertHumanSalvo({a:"Actor.a",b:"Actor.b"}));assert.throws(()=>assertHumanSalvo({a:""}));
  const actor={type:"vehicle",items:new Map(["a","b","c"].map(id=>[id,{type:"weapon",system:{integrated:true}}]))};
  const ids=integratedSelection(actor,["a","b","c"]);assert.equal(attackSlot(actor,{integratedWeaponIds:ids},"b"),"b");assert.throws(()=>attackSlot(actor,{integratedWeaponIds:ids},"d"));
  assert.equal(allAttacksResolved({weapons:{a:{resolved:true},b:{resolved:true}}},{integratedWeaponIds:ids}),false);
});
test("manual gunner limit crosses vehicle and personal combatant records",()=>{
  const actor={uuid:"Actor.gunner"},combat={round:2,combatants:[{getFlag:()=>({round:2,weapons:{a:{resolved:true,operatorUuid:actor.uuid}}})}]};
  assert.equal(operatorAlreadyFired(combat,actor),true);combat.round=3;assert.equal(operatorAlreadyFired(combat,actor),false);
});
test("resolution snapshot carries vehicle kind and operator health, preserving simultaneous fire",()=>{
  const actor={type:"vehicle",system:{health:health("operational")}},operators={a:{actorUuid:"Actor.g",health:{status:"healthy"}}};
  const snapshot=actionSnapshot({id:"v",actor},{action:"attack",movement:"walk",integratedWeaponIds:["a"],weaponOperators:operators});
  actor.system.health.status="destroyed";assert.equal(snapshot.health.status,"operational");assert.equal(snapshot.health.kind,"vehicle");assert.equal(snapshot.weaponOperators.a.actorUuid,operators.a.actorUuid);assert.equal(snapshot.weaponOperators.a.eligible,true);
});
test("BG 920 contains only supplied clearance, two crew, T14 and verified loadout",()=>{
  const bg=vehicles.find(v=>v.catalogId==="buitre-guerrero-920"),v=bg.system.vehicle;assert.equal(v.requiredClearance,"violet");assert.equal(v.capacity,2);assert.equal(controlAvailable(v,"electronicBrain"),true);
  assert.equal(bg.items.filter(i=>i.flags?.['paranoia-2-edition']?.catalogId==="laser-cannon-model-ii").length,2);assert.equal(bg.items.filter(i=>i.flags?.['paranoia-2-edition']?.catalogId==="vehicle-missile-launcher").length,4);
  assert.equal(bg.items.find(i=>i.type==="armor").system.protectionValue,14);assert.equal(v.movement.modes[0].maxSpeed,undefined);assert.equal(bg.items.some(i=>/nuclear/i.test(i.name)),false);
});
test("VTT 17 has source movement, no weapons/armor/autopilot/brain and hidden propeller flaw",()=>{
  const entry=vehicles.find(v=>v.catalogId==="robocoche-vtt-17"),v=entry.system.vehicle;assert.equal(v.requiredClearance,"indigo");assert.equal(v.movement.modes.length,3);
  const air=v.movement.modes.find(m=>m.key==="air");assert.equal(air.maxSpeed,50);assert.equal(air.capacity,6);assert.equal(v.movement.modes[0].maxSlopeDegrees,15);
  assert.equal(entry.items.length,0);assert.equal(controlAvailable(v,"autopilot"),false);assert.equal(controlAvailable(v,"electronicBrain"),false);assert.equal(v.flaws[0].hiddenFromPlayers,true);
});
test("source weapon metadata stays separate from unknown normal damage/range",()=>{
  const cannon=weapons.find(i=>i.catalogId==="laser-cannon-model-ii");assert.equal(cannon.system.sourceDetails.rechargeTurns,5);assert.equal(cannon.system.ammunition.capacity,3);assert.equal(cannon.system.damageNumber,13);assert.equal(cannon.system.maxRangeMeters,200);
  const missile=weapons.find(i=>i.catalogId==="vehicle-missile-launcher");assert.equal(missile.system.sourceDetails.maxFlightTurns,10);assert.equal(missile.system.sourceDetails.speedMetersPerSecond,300);assert.equal(missile.system.range,"15000 m");assert.equal(missile.system.damageNumber,null);
  assert.equal(equipment.find(i=>i.catalogId==="interference-emitter-r").system.sourceDetails.radiusKm,10);
});
test("operators are snapshotted at Resolution, with secret notes removed",()=>{
  const old=globalThis.fromUuidSync;
  try{
    globalThis.fromUuidSync=()=>({documentName:"Actor",system:{cloneNumber:1,health:{status:"wounded",stunned:false,notes:"PRIVATE"}}});
    const declaration={action:"attack",movement:"walk",integratedWeaponIds:["a"],weaponOperators:{a:{actorUuid:"Actor.g",cloneNumber:1,health:{status:"healthy"}}}};
    const c={id:"v",actor:{type:"vehicle",system:{health:health("operational")}}};
    const snapshot=actionSnapshot(c,declaration);assert.equal(snapshot.weaponOperators.a.health.status,"wounded");assert.equal(snapshot.weaponOperators.a.health.notes,undefined);
    globalThis.fromUuidSync=()=>({documentName:"Actor",system:{cloneNumber:1,health:{status:"incapacitated"}}});assert.equal(actionSnapshot(c,declaration),null);
  }finally{if(old)globalThis.fromUuidSync=old;else delete globalThis.fromUuidSync;}
});
test("V14 cancellation action keys never become a submitted vehicle draft",async()=>{
  const old=globalThis.foundry;
  try{globalThis.foundry={applications:{api:{DialogV2:{wait:async()=>"cancel"}}}};
    assert.equal(await fieldsDialog("Test",[]),null);
    globalThis.foundry.applications.api.DialogV2.wait=async()=>({back:true,values:{name:"draft"}});
    assert.deepEqual(await fieldsDialog("Test",[]),{back:true,values:{name:"draft"}});
  }finally{globalThis.foundry=old;}
});
