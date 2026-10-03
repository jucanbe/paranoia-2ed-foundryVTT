import test from "node:test";
import assert from "node:assert/strict";
import * as service from "../module/credits/service.mjs";
import {entry,creationLedger,purchaseCost} from "../module/credits/rules.mjs";
import {ItemCatalog} from "../module/items/catalog.mjs";
import {purchaseSummary} from "../module/creation/purchases.mjs";
import * as treason from "../module/treason/service.mjs";
const gm={id:"gm",isGM:true},owner={id:"owner",isGM:false},other={id:"other",isGM:false},users=[gm,owner,other];users.activeGM=gm;
let serial=0,ledger={},fail=false;const actors=new Map(),messages=[];
globalThis.game={user:gm,users,actors:[],time:{worldTime:123},settings:{get:()=>structuredClone(ledger),set:async(_ns,_key,v)=>{ledger=structuredClone(v);}},messages};
globalThis.Hooks={callAll(){}};globalThis.ui={notifications:{warn(){}}};
function merge(a,b){for(const [k,v] of Object.entries(b)){if(v&&typeof v==="object"&&!Array.isArray(v)){a[k]??={};merge(a[k],v);}else a[k]=structuredClone(v);}return a;}
function expand(value){const out={};for(const [path,v] of Object.entries(value)){let target=out;const parts=path.split(".");for(const p of parts.slice(0,-1))target=target[p]??={};target[parts.at(-1)]=v;}return out;}
globalThis.foundry={utils:{randomID:()=>`id${++serial}`,escapeHTML:String},documents:{ChatMessage:{async create(v){messages.push(v);return v;}}}};
globalThis.CONFIG={Actor:{dataModels:{character:class{},npc:class{}}},Item:{documentClass:class{}}};globalThis.fromUuid=async id=>actors.get(id);
function actor(balance=0,type="character"){
  let data={name:"TEST-R-ARO-1",system:{credits:balance,creditLedger:{history:[]},creditTrackingEnabled:false,securityClearance:"red",securityProgress:{successfulMissions:0},clearanceProgressionEnabled:false,development:{available:0},skills:{},secretSociety:{}},items:[]};
  const a={uuid:`Actor.${++serial}`,type,get name(){return data.name;},get system(){return {...data.system,toObject:()=>structuredClone(data.system)};},get items(){const items=data.items.map(i=>({...i,id:i._id,toObject:()=>structuredClone(i)}));items.get=id=>items.find(i=>i.id===id);return items;},testUserPermission:u=>u.id==="owner",toObject:()=>structuredClone(data),async update(changes){if(fail)throw Error("Actor write failed");data=merge(data,expand(changes));return a;}};actors.set(a.uuid,a);game.actors.push(a);return a;
}
const item=(name,price,unit="item",id=name)=>({uuid:`Compendium.test.${id}`,name,type:"equipment",system:{price,priceUnit:unit,quantity:1,securityClearance:"infrared",assigned:false},flags:{"paranoia-2-edition":{catalogId:id,startingPurchase:true}},toObject(){return {name:this.name,type:this.type,system:structuredClone(this.system),flags:structuredClone(this.flags),effects:[]};}});
const kit=item("Kit",25),rope=item("Plasticuerda",3,"meter"),flashlight=item("Linterna",10);
ItemCatalog.entries=async()=>[kit,rope,flashlight];
test("creation budget and distinct consolidated ledger preserve the existing 100 credits",()=>{
  const a=actor(),purchases=purchaseSummary({Kit:1,Linterna:1},[kit,flashlight],"red");assert.equal(purchases.remaining,65);
  const history=creationLedger(a,purchases,{id:"create",userId:"gm"}).history;assert.deepEqual(history.map(h=>h.delta),[100,-25,-10]);assert.equal(history.at(-1).resultingBalance,65);
  assert.equal(purchaseCost(rope,4),12);assert.throws(()=>purchaseCost(kit,1.5));assert.throws(()=>entry(0,10,{}));
});
test("credit ledger, negative balances, purchases, privacy, corrections, reports and permissions",async t=>{
  const a=actor(200),b=actor(50),npc=actor(20,"npc");
  await t.test("fines exceed balance without clamping; rewards pay down negative balance",async()=>{
    await service.fine(a,500,"Daños");assert.equal(service.getBalance(a),-300);await service.reward(a,1000,"Mérito");assert.equal(service.getBalance(a),700);
    assert.deepEqual(service.getHistory(a).map(h=>[h.previousBalance,h.delta,h.resultingBalance]),[[200,-500,-300],[-300,1000,700]]);
  });
  await t.test("purchase qty two costs 50 and embeds Items atomically; overspend rejects; GM debt override",async()=>{
    await service.purchase(b,kit,2);assert.equal(service.getBalance(b),0);assert.equal(b.items.length,1);assert.equal(b.items[0].system.quantity,2);assert.equal(b.items[0].system.assigned,false);
    const before=b.toObject();await assert.rejects(service.purchase(b,kit,1));assert.deepEqual(b.toObject(),before);
    await service.purchase(b,kit,1,{allowDebt:true});assert.equal(service.getBalance(b),-25);
    const c=actor(50);await assert.rejects(service.purchase(c,kit,3));await service.purchase(c,kit,3,{allowDebt:true});assert.equal(service.getBalance(c),-25);
  });
  await t.test("per-meter purchase retains structured unit and length; intact purchase can be reversed at actual cost",async()=>{
    const c=actor(50);await service.purchase(c,rope,4);assert.equal(c.items[0].system.quantity,1);assert.equal(c.items[0].system.length,4);assert.equal(c.items[0].system.price,3);assert.equal(service.getBalance(c),38);
    const h=service.getHistory(c)[0];await service.refundPurchase(c,h.id,{reason:"Cancelación"});assert.equal(service.getBalance(c),50);assert.equal(c.items.length,0);assert.equal(service.getHistory(c).length,2);await assert.rejects(service.refundPurchase(c,h.id,{reason:"Repeat"}));
    await service.purchase(c,kit,1);const last=service.getHistory(c).at(-1),source=c.toObject();source.items[0].system.quantity=0;await c.update({items:source.items});await assert.rejects(service.refundPurchase(c,last.id,{reason:"Consumed"}));
  });
  await t.test("failed parent writes do not deduct money or leave partial Items/history; assigned drops are free",async()=>{
    const c=actor(50),before=c.toObject();fail=true;try{await assert.rejects(service.purchase(c,kit,1));}finally{fail=false;}assert.deepEqual(c.toObject(),before);
    await c.update({items:[{_id:"issued",name:"Pistola asignada",type:"weapon",system:{assigned:true}}]});assert.equal(service.getBalance(c),50);assert.equal(service.getHistory(c).length,0);
  });
  await t.test("GM compensation appends instead of deleting, malformed amounts reject",async()=>{
    const original=service.getHistory(a)[1];await service.correctTransaction(a,original.id,-500,{reason:"Recompensa corregida"});assert.equal(service.getBalance(a),200);assert.equal(service.getHistory(a).length,3);assert.equal(service.getHistory(a).at(-1).corrects,original.id);
    for(const bad of [NaN,Infinity,"100"]){assert.throws(()=>service.adjust(a,bad,{reason:"Bad"}));}
  });
  await t.test("native private notes are omitted from owner history and public cards",async()=>{
    await service.reward(a,10,"SECRET-SOCIETY-PAYMENT",{notes:"GM-ONLY-CREDIT-NOTE",privateNotes:true,notification:"public",showReason:true});
    assert.equal(JSON.stringify(a.toObject()).includes("GM-ONLY-CREDIT-NOTE"),true);assert.equal(messages.at(-1).content.includes("SECRET-SOCIETY-PAYMENT"),false);
    const h=service.getHistory(a).at(-1);assert.equal(h.private,true);assert.equal(h.privateData,undefined);assert.equal((await service.getPrivateDetails(a,h.id)).notes,"GM-ONLY-CREDIT-NOTE");
  });
  await t.test("owner coordinator spend works but cannot award, fine, override, read private details or spend others' funds",async()=>{
    const c=actor(50);await service.executeSpend(c,25,"Gasto",{requestId:"owner-spend"},owner);assert.equal(service.getBalance(c),25);await service.executeSpend(c,25,"Gasto",{requestId:"owner-spend"},owner);assert.equal(service.getBalance(c),25);
    assert.throws(()=>service.executeSpend(c,50,"Forged",{allowDebt:true},owner));assert.throws(()=>service.executePurchase(c,kit,3,{allowDebt:true},owner));
    game.user=owner;try{assert.throws(()=>service.reward(a,100,"Forged"));assert.throws(()=>service.fine(a,1,"Forged"));assert.throws(()=>service.adjust(a,100,{reason:"Forged"}));await assert.rejects(service.getPrivateDetails(a,service.getHistory(a).at(-1).id));}finally{game.user=gm;}
    game.user=other;try{assert.throws(()=>service.getBalance(a));assert.throws(()=>service.spend(a,1,"Other"));}finally{game.user=gm;}
  });
  await t.test("normal purchase checks canonical clearance; optional NPC tracking; robots/vehicles excluded",async()=>{
    const high=item("High",25);high.system.securityClearance="orange";ItemCatalog.entries=async()=>[kit,rope,flashlight,high];
    const c=actor(50);await assert.rejects(service.purchase(c,high,1));await service.purchase(c,high,1,{clearanceOverride:true});assert.equal(service.getBalance(c),25);
    assert.throws(()=>service.reward(npc,10,"Disabled"));await service.enableTracking(npc,true);await service.reward(npc,10,"Recurring");assert.equal(service.getBalance(npc),30);
    for(const type of ["robot","vehicle"])assert.throws(()=>service.getBalance({type}));
  });
  await t.test("Final Report distinct reward/fine, failure allowed, idempotent retry, invalid batch aborts before PT",async()=>{
    const c=actor(100),rows=[{actor:c,delta:1,reason:"Failure",result:"failure",validSurvivor:false,countForPromotion:true,creditReward:1000,creditFine:250,creditReason:"Recompensa y daños"}];
    await treason.applyMissionReport(rows,{missionId:"credit-report"});assert.equal(service.getBalance(c),850);assert.deepEqual(service.getHistory(c).map(h=>[h.type,h.delta]),[["reward",1000],["fine",-250]]);
    await treason.applyMissionReport(rows,{missionId:"credit-report"});assert.equal(service.getBalance(c),850);assert.equal(service.getHistory(c).length,2);assert.equal(treason.getRecord(c).history.length,1);
    const saved=structuredClone(ledger);await assert.rejects(treason.applyMissionReport([{...rows[0],creditReward:-1}],{missionId:"bad-credit-report"}));assert.deepEqual(ledger,saved);
    const before=service.getBalance(c);await treason.declareTraitor(c,"Conviction",5000);assert.equal(service.getBalance(c),before);
  });
  await t.test("stable direct reward ID prevents double click",async()=>{
    const c=actor();await Promise.all([service.reward(c,1000,"Reward",{requestId:"same"}),service.reward(c,1000,"Reward",{requestId:"same"})]);assert.equal(service.getBalance(c),1000);assert.equal(service.getHistory(c).length,1);
  });
});
