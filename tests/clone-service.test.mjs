import test from "node:test";
import assert from "node:assert/strict";
import {buildCitizenId} from "../module/actors/identity.mjs";
import {CloneService,cloneRevision} from "../module/clones/service.mjs";
import {ItemCatalog,STARTER_IDS} from "../module/items/catalog.mjs";
let serial=0;
const healthy={status:"healthy",stunned:false,notes:"",equipmentDestroyed:false,woundedAt:null};
globalThis.CONFIG={Actor:{dataModels:{character:class{toObject(){return {health:structuredClone(healthy)};}}}},Item:{documentClass:class{}}};
globalThis.game={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},time:{worldTime:30}};
globalThis.ui={notifications:{warn(){}}};
globalThis.foundry={utils:{randomID:()=>String(++serial),escapeHTML:s=>s},dice:{Roll:class{async evaluate(){return {total:20};}}},documents:{ChatMessage:{async create(){}}}};
const entries=()=>STARTER_IDS.map((id,index)=>({uuid:`Compendium.test.${id}`,flags:{"paranoia-2-edition":{catalogId:id}},toObject(){return {_id:id,name:id,type:index===0?"armor":index===1?"weapon":"equipment",system:{quantity:1},flags:this.flags};}}));
ItemCatalog.entries=async()=>entries();
function actor(status="dead"){
  let data={_id:String(++serial),name:"DAVID-R-ARO-1",type:"character",effects:[{name:"Unrelated"}],items:[{_id:"old",name:"Old item",type:"equipment",system:{quantity:2}}],system:{identity:{name:"DAVID",sector:"ARO"},securityClearance:"red",cloneNumber:1,clones:{history:[]},credits:37,health:{...healthy,status,notes:"Old wound"},attributes:{mutantPower:{value:17}},skills:{agility:{club:{value:9}}},mutantPower:{name:"Telepatía",notes:"Secret",registered:true},secretSociety:{name:"Secret society",rank:"2"},service:"SSI",coverService:"SBD"}};
  return {uuid:`Actor.${data._id}`,type:"character",get name(){return data.name;},get system(){return data.system;},toObject:()=>structuredClone(data),async update(changes){data={...data,...structuredClone(changes)};data.name=buildCitizenId(data.system);return this;}};
}
test("service preserves citizen data, archives before reset and keeps inventory byte-for-byte",async()=>{
  const a=actor(),before=a.toObject();await CloneService.activateNextClone(a,{inventory:"keep",silent:true});
  assert.equal(a.name,"DAVID-R-ARO-2");assert.equal(a.system.credits,37);assert.equal(a.system.clones.history[0].notes,"Old wound");
  assert.deepEqual(a.system.health,healthy);
  for(const key of ["attributes","skills","secretSociety","service","coverService"])assert.deepEqual(a.system[key],before.system[key]);
  assert.deepEqual(a.system.mutantPower,{...before.system.mutantPower,points:{value:17,max:17}});
  assert.deepEqual(a.toObject().items,before.items);assert.deepEqual(a.toObject().effects,before.effects);
});
test("standard and no-equipment replace arrays, power modes reuse the creation table, credits never reset",async()=>{
  const a=actor("vaporized");await CloneService.activateNextClone(a,{power:"random",credits:20,silent:true});
  assert.equal(a.system.mutantPower.name,"Vista con Rayos X");assert.equal(a.system.attributes.mutantPower.value,17);
  assert.equal(a.system.credits,20);assert.equal(a.toObject().items.length,3);
  assert.ok(a.toObject().items.every(i=>i.system.assigned));assert.equal(a.system.clones.history[0].equipmentDisposition,"destroyed");
  const b=actor();await CloneService.activateNextClone(b,{inventory:"none",power:"manual",powerName:"Pirokinesis",silent:true});
  assert.equal(b.toObject().items.length,0);assert.equal(b.system.mutantPower.name,"Pirokinesis");
});
test("duplicate and stale requests cannot increment twice; living override and GM permission are explicit",async()=>{
  const a=actor();const expected=await cloneRevision(a);
  const outcomes=await Promise.allSettled([CloneService.activateNextClone(a,{expected,silent:true}),CloneService.activateNextClone(a,{expected,silent:true})]);
  assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);assert.equal(a.system.cloneNumber,2);assert.equal(a.system.clones.history.length,1);
  await assert.rejects(CloneService.activateNextClone(a,{silent:true}));
  await CloneService.activateNextClone(a,{livingOverride:true,inventory:"none",silent:true});assert.equal(a.system.cloneNumber,3);
  game.user.isGM=false;try{await assert.rejects(CloneService.activateNextClone(a));}finally{game.user.isGM=true;}
});
test("missing catalogue aborts without changing any document data",async()=>{
  const a=actor(),before=a.toObject();ItemCatalog.entries=async()=>[];
  try{await assert.rejects(CloneService.activateNextClone(a));assert.deepEqual(a.toObject(),before);}finally{ItemCatalog.entries=async()=>entries();}
});

test("new clone restores the spent PM pool and removes only system-managed power effects",async()=>{
  const a=actor();const source=a.toObject();source.system.mutantPower.points={value:2,max:17};
  source.effects.push({name:"Temporary power",flags:{"paranoia-2-edition":{powerEffect:{powerKey:"empathy"}}}});
  await a.update({system:source.system,effects:source.effects});
  await CloneService.activateNextClone(a,{inventory:"keep",silent:true});
  assert.deepEqual(a.system.mutantPower.points,{value:17,max:17});
  assert.equal(a.system.mutantPower.name,"Telepatía");assert.equal(a.system.attributes.mutantPower.value,17);
  assert.deepEqual(a.toObject().effects,[{name:"Unrelated"}]);
});
test("clone preserves complete society membership, missions, contacts, favors and GM-only GM history",async()=>{
  const a=actor(),source=a.toObject();
  source.system.mutantPower.learned=[{id:"learned",key:"mindReading",source:"psionics",societyLevel:2,membershipId:"society",learnedAt:123}];
  source.system.securityClearance="blue";
  source.system.securityProgress={successfulMissions:2,requirementSatisfied:false,countedMissionIds:["mission1","mission2"]};
  source.system.development={available:3,lifetimeEarned:8,lifetimeSpent:5,history:[{kind:"award",amount:8}],usage:[{skillKey:"agility.club",count:2}]};
  source.system.credits=375;source.system.creditLedger={history:[{type:"reward",delta:100,resultingBalance:375}]};
  source.system.skills.agility.club.value=15;
  source.system.secretSociety={societyKey:"sierraClub",rank:{level:2,label:""},status:"active",exposed:true,
    missions:[{id:"secret",title:"Robar prototipo",status:"active"}],contacts:[{name:"Contacto"}],favors:[{description:"Favor pendiente"}],
    gmData:{memberships:{legacy:{notes:"GM note",rankHistory:[]}}},membershipHistory:[{societyKey:"humanists"}]};
  await a.update({system:source.system});await CloneService.activateNextClone(a,{inventory:"keep",silent:true});
  assert.deepEqual(a.system.secretSociety,source.system.secretSociety);assert.equal(a.system.cloneNumber,2);
  assert.deepEqual(a.system.mutantPower.learned,source.system.mutantPower.learned);
  assert.equal(a.system.securityClearance,"blue");assert.deepEqual(a.system.securityProgress,source.system.securityProgress);assert.equal(a.name,"DAVID-B-ARO-2");
  assert.deepEqual(a.system.development,source.system.development);assert.equal(a.system.skills.agility.club.value,15);
  assert.equal(a.system.credits,375);assert.deepEqual(a.system.creditLedger,source.system.creditLedger);
});
