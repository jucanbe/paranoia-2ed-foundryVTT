import test from "node:test";
import assert from "node:assert/strict";
import {development,improvementCost,improvementPlan,skillKey} from "../module/development/rules.mjs";
import * as service from "../module/development/service.mjs";
import {saveWorldDefinition} from "../module/societies/service.mjs";
import {calculateTarget,evaluateCheck} from "../module/rolls/rules.mjs";
import * as treason from "../module/treason/service.mjs";
const gm={id:"gm",isGM:true},owner={id:"owner",isGM:false},other={id:"other",isGM:false},users=[gm,owner,other];users.activeGM=gm;
let serial=0,fail=false,ledger={},custom={};const actors=new Map(),messages=[];
globalThis.game={user:gm,users,actors:[],time:{worldTime:99},settings:{get:(_ns,key)=>key==="customSocieties"?custom:structuredClone(ledger),set:async(_ns,key,v)=>{if(key==="customSocieties")custom=structuredClone(v);else ledger=structuredClone(v);}},messages};
globalThis.Hooks={callAll(){}};globalThis.ui={notifications:{warn(){}}};
function merge(a,b){for(const [k,v] of Object.entries(b)){if(v&&typeof v==="object"&&!Array.isArray(v)){a[k]??={};merge(a[k],v);}else a[k]=structuredClone(v);}return a;}
function expand(changes){const result={};for(const [path,value] of Object.entries(changes)){const parts=path.split(".");let target=result;for(const p of parts.slice(0,-1))target=target[p]??={};target[parts.at(-1)]=value;}return result;}
globalThis.foundry={utils:{randomID:()=>`id${++serial}`,escapeHTML:String,mergeObject:(a,b)=>merge(structuredClone(a),b)},documents:{ChatMessage:{async create(v){messages.push(v);return v;}}}};
globalThis.CONFIG={Actor:{dataModels:{character:class{},npc:class{}}}};globalThis.fromUuid=async id=>actors.get(id);
function actor(societyKey="",type="character"){
  let data={name:"TEST-R-ARO-1",system:{securityClearance:"red",credits:30,development:development(),developmentEnabled:false,skills:{perception:{survival:{value:6},medicine:{value:5}},dexterity:{laserWeapons:{value:8}}},attributes:{strength:{value:10}},secretSociety:{societyKey,status:"active"},mutantPower:{name:"Telepatía",points:{value:7,max:10}}}};
  const a={uuid:`Actor.${++serial}`,type,get name(){return data.name;},get system(){return data.system;},testUserPermission:u=>u.id==="owner",toObject:()=>structuredClone(data),async update(changes){if(fail)throw Error("Actor update failed");data=merge(data,expand(changes));return this;}};
  a.system.toObject=()=>{const {toObject,...rest}=data.system;return structuredClone(rest);};
  a.toObject=()=>({name:data.name,system:a.system.toObject()});actors.set(a.uuid,a);game.actors.push(a);return a;
}
test("post-creation cost policy, odd half-costs, no creation-only discount or artificial cap",()=>{
  assert.equal(improvementCost("perception.survival",2,{skillCostMultipliers:{"perception.survival":.5}}).cost,1);
  assert.equal(improvementCost("perception.survival",1,{skillCostMultipliers:{"perception.survival":.5}}).cost,1);
  assert.equal(improvementCost("perception.survival",3,{skillCostMultipliers:{"perception.survival":.5}}).cost,2);
  assert.equal(improvementCost("perception.survival",2,{scope:"creation",skillCostMultipliers:{"perception.survival":.5}}).cost,2);
  assert.throws(()=>skillKey("strength"));assert.throws(()=>improvementCost("perception.survival",1,{skillCostMultipliers:{"perception.survival":-1}}));
  assert.equal(calculateTarget(22).finalTarget,22);assert.equal(evaluateCheck(20,22).success,true);assert.equal(calculateTarget(22,"difficult").finalTarget,11);
});
test("development awards, atomic spending, audit, restrictions, refund, custom metadata and report",async t=>{
  const a=actor(),sierra=actor("sierraClub"),npc=actor("","npc");
  await t.test("awards start separately from creation 30 PD; record lifetime and idempotent receipt",async()=>{
    assert.equal(service.getAvailable(a),0);await service.award(a,5,{reason:"Contribución",awardId:"award1",missionReference:"failure1"});
    assert.equal(service.getAvailable(a),5);assert.equal(a.system.development.lifetimeEarned,5);assert.equal(service.getHistory(a)[0].missionReference,"failure1");
    await service.award(a,5,{reason:"Contribución",awardId:"award1"});assert.equal(service.getAvailable(a),5);
    assert.equal(messages.length,0);assert.throws(()=>service.award(a,-1,{reason:"Invalid"}));
  });
  await t.test("multi-point and multi-skill spending is one update with audit, preserving unrelated citizen data",async()=>{
    const fields=JSON.stringify({credits:a.system.credits,clearance:a.system.securityClearance,society:a.system.secretSociety,power:a.system.mutantPower,attributes:a.system.attributes});
    await service.spendBatch(a,[{skillKey:"dexterity.laserWeapons",increase:3},{skillKey:"perception.medicine",increase:1}]);
    assert.equal(a.system.skills.dexterity.laserWeapons.value,11);assert.equal(service.getAvailable(a),1);assert.equal(a.system.development.lifetimeSpent,4);
    assert.equal(service.getHistory(a).at(-1).rows.length,2);
    assert.equal(fields,JSON.stringify({credits:a.system.credits,clearance:a.system.securityClearance,society:a.system.secretSociety,power:a.system.mutantPower,attributes:a.system.attributes}));
  });
  await t.test("overspend, malformed skill, duplicate key and failed Actor save do not partly mutate",async()=>{
    const before=a.toObject();await assert.rejects(service.spend(a,"dexterity.laserWeapons",3));assert.deepEqual(a.toObject(),before);
    await assert.rejects(service.spendBatch(a,[{skillKey:"perception.survival",increase:1},{skillKey:"strength",increase:1}]));assert.deepEqual(a.toObject(),before);
    await assert.rejects(service.spendBatch(a,[{skillKey:"perception.survival",increase:1},{skillKey:"perception.survival",increase:1}]));
    fail=true;try{await assert.rejects(service.spend(a,"perception.survival",1));}finally{fail=false;}assert.deepEqual(a.toObject(),before);
  });
  await t.test("19 plus three equals 22; generation limits remain in their separate existing workflow",async()=>{
    a.system.skills.dexterity.laserWeapons.value=19;await service.award(a,3,{reason:"Adventure"});await service.spend(a,"dexterity.laserWeapons",3);
    assert.equal(a.system.skills.dexterity.laserWeapons.value,22);assert.equal(calculateTarget(a.system.skills.dexterity.laserWeapons.value).finalTarget,22);
  });
  await t.test("Sierra metadata discount and refund use actual paid PD, keep original ledger",async()=>{
    await service.award(sierra,1,{reason:"Award"});await service.spend(sierra,"perception.survival",2);assert.equal(sierra.system.skills.perception.survival.value,8);assert.equal(service.getAvailable(sierra),0);
    const entry=service.getHistory(sierra).at(-1);assert.equal(entry.rows[0].rule,"skillCostMultiplier:0.5");await service.refund(sierra,entry.id,{reason:"Error"});
    assert.equal(sierra.system.skills.perception.survival.value,6);assert.equal(service.getAvailable(sierra),1);assert.equal(sierra.system.development.lifetimeSpent,1);assert.equal(sierra.system.development.lifetimeRefunded,1);
    assert.ok(service.getHistory(sierra).some(h=>h.id===entry.id));await assert.rejects(service.refund(sierra,entry.id,{reason:"Repeat"}));
    const normal=actor();await service.award(normal,1,{reason:"Award"});await assert.rejects(service.spend(normal,"perception.survival",2));await service.spend(normal,"perception.survival",1);assert.equal(normal.system.skills.perception.survival.value,7);
  });
  await t.test("per-adventure usage counter, optional used-skill restrictions, manual additions, resets",async()=>{
    await service.recordSkillUse(a,"dexterity.laserWeapons");await service.recordSkillUse(a,"dexterity.laserWeapons");assert.equal(a.system.development.usage[0].count,2);
    const n=service.getHistory(a).length;await service.award(a,4,{reason:"Used skills",restriction:"used",resetUsage:true});
    assert.deepEqual(a.system.development.eligibleSkills,["dexterity.laserWeapons"]);assert.deepEqual(a.system.development.usage,[]);assert.equal(service.getHistory(a).length,n+1);
    assert.equal(service.canImprove(a,"perception.medicine"),false);await service.restrictSkills(a,["dexterity.laserWeapons","perception.medicine"],true,{reason:"Manual permission"});assert.equal(service.canImprove(a,"perception.medicine"),true);
    const skills=JSON.stringify(a.system.skills);await service.resetUsage(a);assert.equal(JSON.stringify(a.system.skills),skills);
  });
  await t.test("owner can spend through coordinator but cannot award, refund, correct or override",async()=>{
    const before=service.getAvailable(a);await service.executeSpend(a,[{skillKey:"perception.medicine",increase:1}],{requestId:"owner-request"},owner);assert.equal(service.getAvailable(a),before-1);
    await service.executeSpend(a,[{skillKey:"perception.medicine",increase:1}],{requestId:"owner-request"},owner);assert.equal(service.getAvailable(a),before-1);
    assert.throws(()=>service.executeSpend(a,[{skillKey:"perception.medicine",increase:1,overrideCost:0}],{reason:"Forged"},owner));
    game.user=owner;try{assert.throws(()=>service.award(a,100,{reason:"Forged"}));assert.throws(()=>service.refund(a,"x",{reason:"Forged"}));assert.throws(()=>service.correct(a,100,{reason:"Forged"}));assert.throws(()=>service.preview(a,[{skillKey:"perception.medicine",increase:1,overrideCost:0}]));}finally{game.user=gm;}
    game.user=other;try{assert.throws(()=>service.getHistory(a));assert.throws(()=>service.spend(a,"perception.medicine",1));}finally{game.user=gm;}
  });
  await t.test("GM correction changes balance explicitly, not lifetime totals; stale undo rejected",async()=>{
    const earned=a.system.development.lifetimeEarned,spent=a.system.development.lifetimeSpent;await service.correct(a,-1,{reason:"Balance correction"});assert.equal(a.system.development.lifetimeEarned,earned);assert.equal(a.system.development.lifetimeSpent,spent);
    await assert.rejects(service.correct(a,-100,{reason:"Below zero"}));assert.throws(()=>service.correct(a,1,{}));
    const e=service.getHistory(a).find(h=>h.kind==="expenditure"&&h.rows.some(r=>r.skillKey==="dexterity.laserWeapons"));await assert.rejects(service.refund(a,e.id,{reason:"Stale"}));
  });
  await t.test("custom World society metadata is validated and reused; inactive membership has no discount",async()=>{
    await saveWorldDefinition("world-costs",{name:"Custom",development:{skillCostMultipliers:{"perception.medicine":.5}}});
    const c=actor("custom");c.system.secretSociety.custom={worldKey:"world-costs"};await service.award(c,1,{reason:"Custom"});await service.spend(c,"perception.medicine",2);assert.equal(c.system.skills.perception.medicine.value,7);
    c.system.secretSociety.status="expelled";assert.equal(service.societyMetadata(c).skillCostMultipliers,undefined);
    await assert.rejects(saveWorldDefinition("world-bad",{name:"Bad",development:{skillCostMultipliers:{unknown:.5}}}));
    const phreak=actor("computerPhreaks");assert.equal(improvementPlan({...phreak,system:{...phreak.system,development:{available:2}}},[{skillKey:"perception.survival",increase:2}],service.societyMetadata(phreak)).totalCost,2);
  });
  await t.test("NPC opt-in, mechanical exclusions and batch preflight",async()=>{
    assert.throws(()=>service.award(npc,4,{reason:"Disabled"}));await service.enableTracking(npc,true);await service.award(npc,3,{reason:"Recurring NPC"});assert.equal(service.getAvailable(npc),3);
    for(const type of ["robot","vehicle"])assert.throws(()=>service.getAvailable({type}));
    const before=service.getAvailable(a);await assert.rejects(service.awardBatch([{actor:a,amount:2,options:{reason:"OK"}},{actor:npc,amount:-1,options:{reason:"Bad"}}]));assert.equal(service.getAvailable(a),before);
  });
  await t.test("failed mission still gets PD; report retries do not duplicate awards, PT or clearance",async()=>{
    const c=actor();
    const rows=[{actor:c,delta:1,reason:"Mission failed",result:"failure",validSurvivor:false,countForPromotion:true,developmentAward:4,developmentReason:"Adventure"}];
    await treason.applyMissionReport(rows,{missionId:"failed-mission"});assert.equal(service.getAvailable(c),4);assert.equal(treason.getPoints(c),2);assert.equal(c.system.securityClearance,"red");
    await treason.applyMissionReport(rows,{missionId:"failed-mission"});assert.equal(service.getAvailable(c),4);assert.equal(treason.getRecord(c).history.length,1);
    const saved=structuredClone(ledger);await assert.rejects(treason.applyMissionReport([{...rows[0],developmentAward:-1}],{missionId:"invalid-pd"}));assert.deepEqual(ledger,saved);
  });
});
