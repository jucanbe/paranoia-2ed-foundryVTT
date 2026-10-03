import test from "node:test";
import assert from "node:assert/strict";
import {initialRecord,adjustRecord,computerTrust,NS} from "../module/treason/rules.mjs";
import {createVault,encryptVault,unlockVault,encryptReport,decryptReport} from "../module/treason/crypto.mjs";
import * as store from "../module/treason/store.mjs";
import * as service from "../module/treason/service.mjs";

test("citizen defaults, opt-in NPCs, excluded robots and vehicles",()=>{
  assert.deepEqual([initialRecord("character").points,initialRecord("character").enabled],[1,true]);
  assert.equal(initialRecord("npc").enabled,false);
  for(const type of ["robot","vehicle"])assert.throws(()=>initialRecord(type));
});
test("adjustments append audit records and clamp to 0–20",()=>{
  let r=adjustRecord(initialRecord("character"),3,{reason:"Actividad sospechosa"});
  assert.equal(r.points,4);assert.equal(r.history[0].previous,1);
  r=adjustRecord(r,-1,{reason:"Éxito"});assert.equal(r.points,3);
  r=adjustRecord(r,-9,{reason:"Corrección"});assert.equal(r.points,0);assert.equal(r.history.length,3);
  assert.equal(r.history[2].delta,-3);assert.equal(r.history[2].requestedDelta,-9);
  assert.throws(()=>adjustRecord(r,NaN,{reason:"Bad"}));assert.throws(()=>adjustRecord(r,1,{}));
});
test("20 declares; lowering does not pardon; explicit revoke is audited",()=>{
  const r={...initialRecord("character"),points:19};
  const at20=adjustRecord(r,1,{reason:"Traición"});assert.equal(at20.declaredTraitor,true);
  const reduced=adjustRecord(at20,-4,{reason:"Corrección"});assert.equal(reduced.declaredTraitor,true);
  assert.equal(adjustRecord(reduced,0,{reason:"Indulto",revoke:true}).declaredTraitor,false);
  const revokedAt20=adjustRecord(at20,0,{reason:"Indulto explícito",revoke:true});
  assert.equal(adjustRecord(revokedAt20,0,{reason:"Anotación",bounty:0}).declaredTraitor,false);
  assert.equal(at20.bounty,null);assert.equal(r.points,19);
});
test("Computer Trust uses strict greater-than without special natural results",()=>{
  for(const [die,success] of [[7,true],[6,false],[1,false],[20,true]])assert.equal(computerTrust(die,6).success,success);
  assert.equal(computerTrust(1,0).success,true);assert.equal(computerTrust(20,20).success,false);
  assert.throws(()=>computerTrust(21,6));
});
test("encrypted vault survives reload; wrong keys fail; public key cannot expose private reports",async()=>{
  const body={actors:{secret:{points:13,history:[{reason:"SECRET-LEDGER"}]}},inbox:{}};
  const state=await createVault("DJ",body),box=await encryptVault(state);
  assert.equal(JSON.stringify(box).includes("SECRET-LEDGER"),false);assert.equal(JSON.stringify(box).includes("privateKey"),false);
  assert.deepEqual((await unlockVault("DJ",box)).body,body);
  await assert.rejects(unlockVault("wrong secret phrase",box));
  const packet=await encryptReport(box.publicKey,{reason:"PRIVATE-ACCUSATION"});
  assert.equal(JSON.stringify(packet).includes("PRIVATE-ACCUSATION"),false);
  assert.equal((await decryptReport(body.privateKey,packet)).reason,"PRIVATE-ACCUSATION");
  packet.data=packet.data.slice(0,-4)+"AAAA";await assert.rejects(decryptReport(body.privateKey,packet));
});

let persisted={},serial=0,die=7;
const actors=new Map();
const messages=[];messages.get=id=>messages.find(m=>m.id===id);
const gm={id:"gm",isGM:true},player={id:"player",isGM:false};
const users=[gm,player];users.activeGM=gm;
globalThis.game={user:gm,users,actors:[],messages,time:{worldTime:42},settings:{get:()=>structuredClone(persisted),set:async(_ns,_key,value)=>{
  if(!game.user.isGM)throw Error("World-setting permission");persisted=structuredClone(value);
}}};
globalThis.Hooks={callAll(){}};
globalThis.fromUuid=async uuid=>actors.get(uuid);
globalThis.foundry={utils:{randomID:()=>`id${++serial}`,escapeHTML:s=>s.replaceAll("<","&lt;")},dice:{Roll:class{
  constructor(formula){assert.equal(formula,"1d20");}async evaluate(){this.total=die;return this;}toJSON(){return {formula:"1d20",total:this.total};}
}},documents:{ChatMessage:{async create(data){const message={...data,id:`msg${++serial}`,author:game.user,timestamp:Date.now(),getFlag:(ns,key)=>data.flags?.[ns]?.[key]};messages.push(message);return message;}}}};
function actor(id,type="character"){const a={id,uuid:`Actor.${id}`,name:id,type,system:{cloneNumber:1},testUserPermission:user=>user===player};actors.set(a.uuid,a);game.actors.push(a);return a;}

test("service persistence, atomic reports, authorization, requests, status and clone identity",async t=>{
  const a=actor("A"),b=actor("B"),c=actor("C"),npc=actor("NPC","npc"),robot=actor("Robot","robot");
  await store.unlock("long service test phrase");
  await t.test("safe default, additions, lowering, no Actor point fields",async()=>{
    assert.equal(service.getPoints(a),1);await service.addPoints(a,3,"Actividad sospechosa");await service.removePoints(a,1,"Éxito");
    assert.equal(service.getPoints(a),3);assert.equal(a.system.treason,undefined);
  });
  await t.test("multi-citizen final report is all or nothing",async()=>{
    await service.applyMissionReport([{actor:a,delta:-1,reason:"Éxito"},{actor:b,delta:1,reason:"Fracaso"},{actor:c,delta:3,reason:"Otro"}]);
    assert.deepEqual([a,b,c].map(service.getPoints),[2,2,4]);const snapshot=structuredClone(persisted);
    await assert.rejects(service.applyMissionReport([{actor:a,delta:1,reason:"OK"},{actor:b,delta:NaN,reason:"Invalid"}]));
    assert.deepEqual(persisted,snapshot);
  });
  await t.test("threshold, one declaration, no Actor or health mutation",async()=>{
    const original=structuredClone(a.system);await service.adjustPoints(a,17,{reason:"A 19"});await service.addPoints(a,1,"Umbral");
    assert.equal(service.checkTraitorStatus(a),true);await service.publishDeclarations();await service.publishDeclarations();
    assert.equal(messages.filter(m=>m.getFlag(NS,"treasonDeclaration")).length,1);assert.deepEqual(a.system,original);
    await service.removePoints(a,11,"Corrección");assert.equal(service.checkTraitorStatus(a),true);
    a.system.cloneNumber++;a.name="A-R-ARO-2";assert.equal(service.getPoints(a),9);assert.equal(service.checkTraitorStatus(a),true);
    await service.revokeTraitor(a,"Indulto");assert.equal(service.checkTraitorStatus(a),false);
  });
  await t.test("NPC opt in and mechanical exclusions",async()=>{
    await assert.rejects(service.addPoints(npc,2,"No"));await service.enableTracking(npc);await service.addPoints(npc,2,"Sí");assert.equal(service.getPoints(npc),3);
    assert.throws(()=>service.getPoints(robot));
  });
  await t.test("players cannot read or adjust points, submit encrypted accusation without penalty",async()=>{
    game.user=player;
    assert.throws(()=>service.getPoints(a));await assert.rejects(service.addPoints(a,2,"No"));
    await service.submitReport({kind:"accusation",actorUuid:a.uuid,accusedUuid:b.uuid,reason:"SECRET CHARGE",notes:"Evidence",public:false});
    assert.equal(JSON.stringify(messages.at(-1)).includes("SECRET CHARGE"),false);
    game.user=gm;await service.receiveReports();assert.equal(service.getPoints(b),2);
    const id=Object.keys(store.readInbox())[0];await service.adjudicateReport(id,{disposition:"apply",delta:2});
    assert.equal(service.getPoints(b),4);const h=service.getRecord(b).history.at(-1);assert.equal(h.category,"accusation");assert.equal(h.relatedActor,a.uuid);
    await assert.rejects(service.adjudicateReport(id,{disposition:"apply",delta:2}));
  });
  await t.test("trust public output omits die, threshold, history; requests process once",async()=>{
    await service.addPoints(b,2,"A seis");game.user=player;
    await service.submitReport({kind:"trust",actorUuid:b.uuid,reason:"Ayuda",public:false});game.user=gm;
    await service.receiveReports();const id=Object.entries(store.readInbox()).find(([,e])=>e.kind==="trust")[0];
    const result=await service.rollComputerTrust(b,{request:"Ayuda",requestId:id});assert.equal(result.success,true);assert.equal(result.points,6);
    assert.equal(messages.at(-1).content.includes("ACEPTADA"),true);assert.equal(JSON.stringify(messages.at(-1)).includes('"points"'),false);
    await assert.rejects(service.rollComputerTrust(b,{request:"Ayuda",requestId:id}));
  });
  await t.test("encrypted reload preserves values and ledger",async()=>{
    const before=service.getRecord(b);store.locked();assert.throws(()=>service.getPoints(b));
    await store.unlock("long service test phrase");assert.deepEqual(service.getRecord(b),before);
    assert.equal(JSON.stringify(persisted).includes("SECRET CHARGE"),false);
  });
  await t.test("failed save leaves every ledger unchanged",async()=>{
    const before=service.getRecord(a),save=game.settings.set;
    game.settings.set=async()=>{throw Error("Simulated storage failure");};
    try{await assert.rejects(service.addPoints(a,1,"Must not persist"));assert.deepEqual(service.getRecord(a),before);}
    finally{game.settings.set=save;}
  });
  await t.test("forged private report cannot impersonate an unowned citizen",async()=>{
    const restricted=actor("Restricted");restricted.testUserPermission=()=>false;
    game.user=player;
    const box=await store.sealReport({kind:"accusation",actorUuid:restricted.uuid,accusedUuid:a.uuid,reason:"Forged",public:false});
    const message=await foundry.documents.ChatMessage.create({content:"Private",flags:{[NS]:{treasonReport:{box}}}});
    game.user=gm;await service.receiveReports();assert.equal(store.readInbox()[message.id],undefined);
  });
  await t.test("concurrent confirmations resolve a request once",async()=>{
    game.user=player;await service.submitReport({kind:"trust",actorUuid:a.uuid,reason:"One request",public:false});game.user=gm;
    await service.receiveReports();const id=Object.entries(store.readInbox()).find(([,e])=>e.reason==="One request")[0];
    const count=messages.length;
    const outcomes=await Promise.allSettled([service.rollComputerTrust(a,{request:"One request",requestId:id}),service.rollComputerTrust(a,{request:"One request",requestId:id})]);
    assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);assert.equal(messages.length,count+1);
  });
});
