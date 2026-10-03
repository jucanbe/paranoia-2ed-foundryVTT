import test from "node:test";
import assert from "node:assert/strict";
import {PROMOTION_REQUIREMENTS,requirement,missionProgress,progress,adjacent} from "../module/clearance/rules.mjs";
import * as service from "../module/clearance/service.mjs";
import * as treason from "../module/treason/service.mjs";
import * as store from "../module/treason/store.mjs";
import {buildCitizenId,synchronizeCitizenIdentity,synchronizeLinkedTokenNames} from "../module/actors/identity.mjs";
test("all supplied requirements use existing keys; infrared special and UV has no invented count",()=>{
  for(const [current,target,count] of [["red","orange",1],["orange","yellow",1],["yellow","green",2],["green","blue",2],["blue","indigo",3],["indigo","violet",3]]){
    const r=requirement(current,{successfulMissions:count});assert.equal(r.target,target);assert.equal(r.count,count);assert.equal(r.satisfied,true);
    assert.equal(requirement(current,{successfulMissions:count-1}).satisfied,false);
  }
  assert.equal(requirement("infrared",{successfulMissions:100}).satisfied,false);
  assert.equal(PROMOTION_REQUIREMENTS.ultraviolet.type,"specialGM");assert.equal(PROMOTION_REQUIREMENTS.ultraviolet.count,undefined);
  assert.equal(adjacent("infrared",-1),null);assert.equal(adjacent("ultraviolet",1),null);
});
test("success, survivor, traitor and deduplication are independent explicit checks",()=>{
  const row={missionId:"m1",result:"success",validSurvivor:true,countForPromotion:true,declaredTraitor:false};
  const first=missionProgress({},row);assert.equal(first.progress.successfulMissions,1);
  for(const change of [{result:"failure"},{result:"none"},{validSurvivor:false},{countForPromotion:false},{declaredTraitor:true}])assert.equal(missionProgress({}, {...row,...change}).counted,false);
  assert.equal(missionProgress(first.progress,row).counted,false);
  const reset={...first.progress,successfulMissions:0};assert.equal(missionProgress(reset,row).counted,false);
  assert.throws(()=>missionProgress(reset,{...row,override:true}));
  assert.equal(missionProgress(reset,{...row,override:true,reason:"DJ exception"}).counted,true);
  assert.deepEqual(progress(),{successfulMissions:0,requirementSatisfied:false,countedMissionIds:[]});
});
let persisted={},serial=0,show=true,failActor=false,failVault=false;
const gm={id:"gm",isGM:true},player={id:"player",isGM:false},observer={id:"observer",isGM:false};
const users=[gm,player,observer];users.activeGM=gm;
const actors=new Map(),messages=[];
globalThis.Hooks={callAll(){}};
globalThis.game={user:gm,users,actors:[],time:{worldTime:100},settings:{get:(_ns,key)=>key==="showPromotionProgressToPlayers"?show:structuredClone(persisted),set:async(_ns,_key,v)=>{if(failVault)throw Error("Storage failure");persisted=structuredClone(v);}},messages};
function merge(a,b){for(const [k,v] of Object.entries(b)){if(v&&typeof v==="object"&&!Array.isArray(v)){a[k]??={};merge(a[k],v);}else a[k]=structuredClone(v);}return a;}
globalThis.foundry={utils:{randomID:()=>`id${++serial}`,escapeHTML:String,expandObject:v=>structuredClone(v),mergeObject:(a,b)=>merge(structuredClone(a),b)},documents:{ChatMessage:{async create(v){messages.push(v);return v;}}}};
globalThis.fromUuid=async id=>actors.get(id);
function actor(key="red",type="character"){
  let data={name:"",prototypeToken:{name:""},system:{identity:{name:"DAVID",sector:"ARO"},securityClearance:key,securityProgress:progress(),clearanceProgressionEnabled:false,cloneNumber:3,credits:37,service:"SSI",secretSociety:{rank:{level:2}},mutantPower:{name:"Telepatía",points:{value:7,max:10}}}};
  data.name=buildCitizenId(data.system);data.prototypeToken.name=data.name;
  const a={uuid:`Actor.${++serial}`,type,get name(){return data.name;},get system(){return data.system;},get prototypeToken(){return data.prototypeToken;},toObject:()=>structuredClone(data),testUserPermission:u=>u.id==="player",getDependentTokens:()=>[],async update(changes){if(failActor)throw Error("Actor unavailable");synchronizeCitizenIdentity(a,changes);data=merge(data,changes);return a;}};
  actors.set(a.uuid,a);game.actors.push(a);return a;
}
test("service encrypted audit, identity, reset, demotion, recovery, report and permissions",async t=>{
  const a=actor(),b=actor("green"),npc=actor("red","npc");
  await store.unlock("clearance testing phrase only");
  await t.test("promote red to orange preserves unrelated fields and does not auto-publish",async()=>{
    const before=a.toObject();await assert.rejects(service.promote(a,{reason:"premature"}));
    await service.recordSuccessfulMission(a,"mission1",{validSurvivor:true});assert.equal(service.canPromote(a),true);
    assert.equal(a.system.securityClearance,"red");await service.promote(a,{reason:"Éxito",notes:"PRIVATE-GM-NOTE",missionReference:"mission1"});
    assert.equal(a.name,"DAVID-O-ARO-3");assert.equal(a.prototypeToken.name,a.name);
    assert.equal(service.getPromotionRequirements(a).target,"yellow");assert.equal(a.system.securityProgress.successfulMissions,0);
    for(const key of ["credits","service","secretSociety","mutantPower","identity","cloneNumber"])assert.deepEqual(a.system[key],before.system[key]);
    assert.equal(messages.length,0);assert.equal(JSON.stringify(persisted).includes("PRIVATE-GM-NOTE"),false);
    assert.equal(service.getHistory(a).at(-1).notes,"PRIVATE-GM-NOTE");
    assert.equal((await service.recordSuccessfulMission(a,"mission1",{validSurvivor:true})).counted,false);
  });
  await t.test("two successes into blue, three into indigo; nonzero PT allowed",async()=>{
    await treason.addPoints(b,6,"PT unrelated");
    await service.recordSuccessfulMission(b,"b1",{validSurvivor:true});assert.equal(service.canPromote(b),false);
    await service.recordSuccessfulMission(b,"b2",{validSurvivor:true});await service.promote(b,{reason:"Two missions"});
    assert.equal(b.name,"DAVID-B-ARO-3");
    for(const id of ["b3","b4","b5"])await service.recordSuccessfulMission(b,id,{validSurvivor:true});
    await service.promote(b,{reason:"Three missions"});assert.equal(b.name,"DAVID-I-ARO-3");
  });
  await t.test("traitor blocked even after reducing PT; explicit GM exception audited",async()=>{
    await treason.declareTraitor(a,"Convicted");await treason.removePoints(a,10,"Reduction");
    assert.equal((await service.recordSuccessfulMission(a,"traitor",{validSurvivor:true})).counted,false);
    await assert.rejects(service.promote(a,{reason:"Blocked"}));
    await service.promote(a,{reason:"Explicit GM exception",override:true});assert.equal(a.system.securityClearance,"yellow");
  });
  await t.test("demotion resets, preserve option, multi-step confirmation, floor and ceiling",async()=>{
    await service.correctProgress(b,{successfulMissions:2,reason:"Correction"});
    await assert.rejects(service.demote(b,{target:"red",reason:"Multi"}));
    await service.demote(b,{target:"green",confirmMultiLevel:true,reason:"Multi"});assert.equal(b.name,"DAVID-G-ARO-3");assert.equal(b.system.securityProgress.successfulMissions,0);
    await service.correctProgress(b,{successfulMissions:1,reason:"Correction"});await service.demote(b,{reason:"Preserve",preserveProgress:true});assert.equal(b.system.securityProgress.successfulMissions,1);
    const floor=actor("infrared"),ceiling=actor("ultraviolet");await assert.rejects(service.demote(floor,{reason:"Floor"}));await assert.rejects(service.promote(ceiling,{reason:"Ceiling"}));
    await service.correctProgress(floor,{successfulMissions:0,requirementSatisfied:true,reason:"Friend denounced"});await service.promote(floor,{reason:"Special confirmed"});assert.equal(floor.system.securityClearance,"red");
  });
  await t.test("failed Actor writes leave recoverable journal, failed vault writes do not mutate Actor",async()=>{
    const before=b.toObject();failVault=true;try{await assert.rejects(service.setClearance(b,"green",{reason:"Fail vault"}));}finally{failVault=false;}assert.deepEqual(b.toObject(),before);
    failActor=true;try{await assert.rejects(service.setClearance(b,"green",{reason:"Retry"}));}finally{failActor=false;}
    const pending=service.getHistory(b).at(-1);assert.equal(pending.status,"pending");await assert.rejects(service.correctProgress(b,{successfulMissions:1,reason:"Blocked by pending"}));
    await service.resumeAction(pending.id);assert.equal(b.system.securityClearance,"green");assert.equal(service.getHistory(b).at(-1).status,"completed");
  });
  await t.test("integrated report survives retries without repeating PT; invalid batch rolls back",async()=>{
    const c=actor(),d=actor();const row=actor=>({actor,delta:-1,reason:"Report success",result:"success",validSurvivor:true,countForPromotion:true});
    failActor=true;try{await assert.rejects(treason.applyMissionReport([row(c),row(d)],{missionId:"report1"}));}finally{failActor=false;}
    assert.equal(treason.getPoints(c),0);await treason.applyMissionReport([row(c),row(d)],{missionId:"report1"});assert.equal(c.system.securityProgress.successfulMissions,1);
    await treason.applyMissionReport([row(c),row(d)],{missionId:"report1"});assert.equal(treason.getRecord(c).history.length,1);assert.equal(c.system.securityProgress.successfulMissions,1);
    await assert.rejects(treason.applyMissionReport([{...row(c),delta:1}],{missionId:"report1"}));
    const saved=structuredClone(persisted);await assert.rejects(treason.applyMissionReport([row(c),{...row(d),result:"invalid"}],{missionId:"bad"}));assert.deepEqual(persisted,saved);
    await service.enableTracking(npc,true,{reason:"Recurring NPC"});await treason.applyMissionReport([row(npc)].map(v=>({...v,delta:0})),{missionId:"NPC-report"});assert.equal(npc.system.securityProgress.successfulMissions,1);assert.equal(treason.getRecord(npc).enabled,false);
  });
  await t.test("GM-only writes/history; owner progress setting; observers excluded; mechanical actors excluded",async()=>{
    game.user=player;try{assert.ok(service.getPromotionRequirements(a));await assert.rejects(service.demote(a,{reason:"Player"}));assert.throws(()=>service.getHistory(a));show=false;assert.equal(service.getPromotionRequirements(a),null);}finally{show=true;game.user=gm;}
    game.user=observer;try{assert.equal(service.getPromotionRequirements(a),null);}finally{game.user=gm;}
    for(const type of ["robot","vehicle"])assert.throws(()=>service.getCurrent({type,uuid:"bad"}));
    const c=actor();await service.setClearance(c,"orange",{reason:"Manual",notes:"Hidden note",announce:true});assert.equal(messages.length,1);assert.equal(messages[0].content.includes("Hidden note"),false);
  });
  await t.test("linked automatic names follow; manual aliases stay intact",async()=>{
    const renamed=[];const c=actor();c.getDependentTokens=()=>[{name:"DAVID-R-ARO-3",canUserModify:()=>true,update:async v=>renamed.push(v.name)},{name:"Alias",canUserModify:()=>true,update:async()=>assert.fail("Alias renamed")}];
    await service.setClearance(c,"orange",{reason:"Token test"});await synchronizeLinkedTokenNames(c,"DAVID-R-ARO-3");assert.deepEqual(renamed,["DAVID-O-ARO-3"]);
  });
});
