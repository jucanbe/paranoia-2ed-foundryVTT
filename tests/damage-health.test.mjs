import test from "node:test";
import assert from "node:assert/strict";
import {lookupDamage,DAMAGE_TABLE} from "../module/damage/table.mjs";
import {armorForAttack,damageNumber,usesStrength} from "../module/damage/rules.mjs";
import {nextHealthStatus,transitionHealth,clearStun,stunExpired,treatedHealth,blockedReason,assertCanAct,untreatedDue,hourlyDue,migrateHealth} from "../module/health/rules.mjs";
import {calculateHealthTarget} from "../module/rolls/rules.mjs";
import {modifiersForAttack} from "../module/combat/rules.mjs";
const healthy=()=>({status:"healthy",stunned:false,notes:"Keep notes",woundedAt:null,treated:false,incapacitatedAt:null,lastHourlyCheckAt:null,equipmentDestroyed:false});
const armor=(type,value,id="a",sort=0)=>({id,sort,name:"Armor",type:"armor",system:{protectionType:type,protectionValue:value,equipped:true}});

test("verified ND 8 boundaries; all other columns unavailable without clamping",()=>{
  for(const [die,result] of [[1,"noEffect"],[4,"noEffect"],[5,"stunned"],[9,"stunned"],[10,"wounded"],[14,"wounded"],[15,"incapacitated"],[18,"incapacitated"],[19,"dead"],[20,"dead"]])assert.equal(lookupDamage(8,die),result);
  assert.deepEqual(Object.keys(DAMAGE_TABLE),["8"]);
  for(const nd of [-10,0,1,4,7,9,30])assert.equal(lookupDamage(nd,12),null);
  assert.throws(()=>lookupDamage(NaN,1));assert.throws(()=>lookupDamage(8,21));
});
test("L4 match, mismatch and T3; no stacking and deterministic valid armor selection",()=>{
  const l4=armor("laser",4);
  assert.equal(damageNumber({baseDamageNumber:8,...armorForAttack([l4],"laser")}),4);
  assert.equal(armorForAttack([l4],"projectile").armorProtection,0);
  assert.equal(damageNumber({baseDamageNumber:8,...armorForAttack([armor("all",3)],"laser")}),5);
  const multiple=armorForAttack([armor("all",9,"z"),armor("laser",4,"a"),armor("",null,"0")],"laser");
  assert.equal(multiple.armorProtection,4);assert.ok(multiple.warnings.length>=1);
  assert.equal(armorForAttack([armor("laser",0)],"laser").armorProtection,0);
  assert.equal(armorForAttack([{...l4,system:{...l4.system,equipped:false}}],"laser").armorProtection,0);
  assert.throws(()=>armorForAttack([l4],""));
});
test("numeric arithmetic and melee eligibility do not invent missing source values",()=>{
  assert.equal(damageNumber({baseDamageNumber:8,strengthBonus:2,stamina:1,armorProtection:4}),5);
  assert.equal(damageNumber({baseDamageNumber:1,armorProtection:4}),-3);
  assert.throws(()=>damageNumber({baseDamageNumber:null}));assert.throws(()=>damageNumber({baseDamageNumber:"8"}));
  for(const skill of ["brawling","neuralWhip","club","energySword","ancientMeleeWeapons"])assert.equal(usesStrength({system:{skill}}),true);
  assert.equal(usesStrength({system:{skill:"agility.grenade",weaponCategory:"campaign"}}),false);
  assert.equal(usesStrength({system:{weaponCategory:"melee"}}),true);
});
test("health escalation preserves terminal states and no-effect never heals",()=>{
  for(const [current,result,next] of [["healthy","wounded","wounded"],["wounded","wounded","incapacitated"],["incapacitated","wounded","dead"],["healthy","incapacitated","incapacitated"],["healthy","dead","dead"],["dead","wounded","dead"],["vaporized","dead","vaporized"],["incapacitated","stunned","incapacitated"]])assert.equal(nextHealthStatus(current,result),next);
  for(const status of ["healthy","stunned","wounded","incapacitated","dead"]){assert.equal(nextHealthStatus(status,"vaporized"),"vaporized");assert.equal(nextHealthStatus(status,"noEffect"),status);}
  const h=healthy();assert.deepEqual(transitionHealth(h,"noEffect"),h);
  assert.equal(transitionHealth(h,"vaporized").equipmentDestroyed,true);
});
test("stun covers current and following turn and preserves underlying wound",()=>{
  const h=transitionHealth(healthy(),"wounded",{now:0,combat:{id:"combat",round:3}});
  assert.equal(h.status,"wounded");assert.equal(h.stunned,true);assert.equal(h.stunnedUntilRound,5);assert.equal(h.woundedAt,0);
  assert.equal(stunExpired(h,{id:"combat",round:4}),false);assert.equal(stunExpired(h,{id:"combat",round:5}),true);
  assert.equal(stunExpired(h,{id:"other",round:6}),false);assert.equal(clearStun(h).status,"wounded");
  assert.equal(clearStun(transitionHealth(healthy(),"stunned")).status,"healthy");
  assert.equal(transitionHealth(healthy(),"stunned").stunnedUntilRound,null);
});
test("roll and action health checks share one wound penalty; GM override is explicit",()=>{
  for(const status of ["stunned","incapacitated","dead","vaporized"])assert.ok(blockedReason({status}));
  assert.ok(blockedReason({status:"wounded",stunned:true}));assert.equal(blockedReason({status:"wounded",stunned:false}),"");
  const actor={system:{health:{status:"incapacitated"}}};
  assert.throws(()=>assertCanAct(actor,{user:{isGM:false}}));assert.throws(()=>assertCanAct(actor,{override:true,user:{isGM:false}}));
  assert.doesNotThrow(()=>assertCanAct(actor,{override:true,user:{isGM:true}}));
  assert.equal(calculateHealthTarget(12,"normal",0,{status:"wounded"}).finalTarget,8);
  assert.equal(calculateHealthTarget(12,"normal",2,{status:"wounded"}).finalTarget,10);
  assert.equal(calculateHealthTarget(17,"difficult",2,{status:"wounded"}).finalTarget,6);
  const preview=modifiersForAttack({baseValue:12,skill:"dexterity.laserWeapons",healthStatus:"wounded",gmModifier:2});
  assert.equal(preview.finalTarget,10);assert.equal(preview.situationalModifier,2);
  assert.equal(calculateHealthTarget(12,"normal",preview.situationalModifier,{status:"wounded"}).finalTarget,10);
});
test("world-time recovery boundaries, treatment and legacy notes",()=>{
  const h=clearStun(transitionHealth(healthy(),"wounded",{now:0}));
  assert.equal(untreatedDue(h,86399),false);assert.equal(untreatedDue(h,86400),true);assert.equal(untreatedDue({...h,treated:true},90000),false);
  const incap=transitionHealth(h,"incapacitated",{now:0});
  assert.equal(hourlyDue(incap,3599),false);assert.equal(hourlyDue(incap,3600),true);
  assert.equal(hourlyDue({...incap,lastHourlyCheckAt:3600},7199),false);
  assert.equal(hourlyDue({...incap,incapacitatedAt:null,lastHourlyCheckAt:0},3600),true);
  const treated=treatedHealth(incap,100);assert.equal(treated.status,"wounded");assert.equal(treated.stunned,false);assert.equal(treated.treated,true);
  assert.equal(treatedHealth(treated,200).status,"healthy");assert.throws(()=>treatedHealth({...h,status:"dead"},0));
  assert.equal(migrateHealth({status:"Herido"}).status,"wounded");
  const legacy=migrateHealth({status:"Old descriptive condition",notes:"Keep"});assert.ok(legacy.notes.includes("Old descriptive condition"));assert.ok(legacy.notes.includes("Keep"));
});
