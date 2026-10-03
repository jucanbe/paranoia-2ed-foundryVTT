import test from "node:test";
import assert from "node:assert/strict";
import {commitPowerUse,adjudicatePower,validatePowerUse,privateRecipients,availablePowers,learnPsionicPower,psionicTrainingLevels} from "../module/powers/service.mjs";
import {processPowerRequest} from "../module/powers/requests.mjs";
import {trackPowerEffect,endPowerEffect} from "../module/powers/effects.mjs";
import {POWER_REGISTRY} from "../module/powers/registry.mjs";
import {rollCheck} from "../module/rolls/service.mjs";
const NS="paranoia-2-edition";
let serial=0,dice=[],documents,chat,rollCount;
const gm={id:"gm",isGM:true},owner={id:"owner",isGM:false},outsider={id:"other",isGM:false};
function setPath(object,path,value){const keys=path.split("."),last=keys.pop();let target=object;for(const k of keys)target=target[k]??={};target[last]=value;}
function collection(items=[]){items.get=id=>items.find(i=>i.id===id);return items;}
function setup(){
  globalThis.CONFIG={Actor:{dataModels:{character:class{}}}};
  documents=new Map();chat=[];rollCount=0;dice=[20];
  const users=collection([gm,owner,outsider]);users.activeGM=gm;
  globalThis.game={user:gm,users,time:{worldTime:0},combats:collection(),settings:{get:(_ns,key)=>key==="specialRollResults"?false:"public"}};
  globalThis.ui={notifications:{error(){},info(){}}};
  globalThis.fromUuid=async uuid=>documents.get(uuid);
  globalThis.foundry={utils:{escapeHTML:s=>s,randomID:()=>String(++serial)},applications:{handlebars:{renderTemplate:async(_path,data)=>JSON.stringify(data)}},dice:{Roll:class{
    async evaluate(){rollCount++;this.total=dice.shift()??20;return this;}async render(){return `<dice>${this.total}</dice>`;}
  }},documents:{ChatMessage:{getSpeaker:({actor})=>({actor:actor.id}),async create(data){const message={id:String(++serial),...data,author:gm,
    getFlag:(_ns,key)=>message.flags?.[NS]?.[key],async update(changes){for(const [k,v]of Object.entries(changes))setPath(message,k,v);return message;}};chat.push(message);return message;}}}};
}
function actor(name="Telekinesis",status="healthy"){
  const data={attributes:{mutantPower:{value:12},endurance:{value:12},cynicism:{value:12},strength:{value:10}},
    skills:{cynicism:{con:{value:8}}},mutantPower:{name,points:{value:12,max:12}},cloneNumber:1,health:{status,stunned:false,notes:""}};
  Object.defineProperty(data,"toObject",{value:()=>structuredClone({...data})});
  const a={id:String(++serial),uuid:`Actor.${serial}`,name:"DAVID-R-ARO-1",type:"character",system:data,effects:collection(),
    testUserPermission:u=>u.isGM||u.id==="owner",async update(changes){for(const [k,v]of Object.entries(changes))setPath(a,k,v);return a;},
    async createEmbeddedDocuments(_type,rows){const result=rows.map(row=>{const e={id:String(++serial),...row,async update(changes){for(const [k,v]of Object.entries(changes))setPath(e,k,v);}};a.effects.push(e);return e;});return result;},
    async deleteEmbeddedDocuments(_type,ids){a.effects.splice(0,a.effects.length,...a.effects.filter(e=>!ids.includes(e.id)));}};
  documents.set(a.uuid,a);return a;
}
const options={cost:3,difficulty:"normal",modifier:0,intent:"Levantar una bandeja de 10 kg",approxWeightKg:10};
test("psionic training preserves original power, grants each level once and uses the existing private PM workflow",async()=>{
  setup();const a=actor("Telepatía");
  a.system.secretSociety={id:"membership",societyKey:"psionics",rank:{level:2},psionicLevels:[2]};
  assert.deepEqual(psionicTrainingLevels(a),[2]);
  const granted=await Promise.allSettled([learnPsionicPower(a,"mindReading",2),learnPsionicPower(a,"mindReading",2)]);
  assert.equal(granted.filter(r=>r.status==="fulfilled").length,1);
  assert.equal(a.system.mutantPower.name,"Telepatía");assert.equal(a.system.mutantPower.learned.length,1);
  assert.deepEqual(availablePowers(a).map(p=>p.key),["telepathy","mindReading"]);
  assert.deepEqual(psionicTrainingLevels(a),[]);
  await assert.rejects(learnPsionicPower(a,"mentalBlast",2));
  assert.throws(()=>validatePowerUse(a,{...options,powerKey:"mentalBlast"}));
  await commitPowerUse(a,{...options,powerKey:"mindReading"},{powerKey:"mindReading"},"learned-use");
  assert.equal(chat[0].getFlag(NS,"powerResult").powerKey,"mindReading");
  assert.deepEqual(chat[0].whisper,["gm","owner"]);assert.equal(a.system.mutantPower.points.value,9);
  assert.equal(a.system.mutantPower.name,"Telepatía");
  game.user=owner;assert.throws(()=>learnPsionicPower(a,"mentalBlast",3));game.user=gm;
});
test("failed native roll still spends PM, keeps Attribute, and whispers only to owner/GM",async()=>{
  setup();const a=actor();const result=await commitPowerUse(a,options,{},"request");
  assert.equal(result.result.resultClass,"failure");assert.equal(a.system.mutantPower.points.value,9);
  assert.equal(a.system.attributes.mutantPower.value,12);assert.equal(rollCount,1);assert.equal(chat.length,1);
  assert.deepEqual(chat[0].whisper,["gm","owner"]);assert.equal(chat[0].rolls.length,1);
  assert.deepEqual(privateRecipients(a),["gm","owner"]);
});
test("coordinator latches a double submission before cost and dice",async()=>{
  setup();const a=actor();const request=await foundry.documents.ChatMessage.create({flags:{[NS]:{powerRequest:{actorUuid:a.uuid,operation:"use",cloneNumber:1,status:"pending",options}}}});
  const results=await Promise.allSettled([processPowerRequest(request,options),processPowerRequest(request,options)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);assert.equal(rollCount,1);assert.equal(a.system.mutantPower.points.value,9);
});
test("zero PM blocks normally; explicit GM override works; old clone requests cannot spend",async()=>{
  setup();const a=actor();a.system.mutantPower.points.value=0;
  assert.throws(()=>validatePowerUse(a,options));
  await commitPowerUse(a,{...options,override:true},{},"override");assert.equal(a.system.mutantPower.points.value,0);
  assert.throws(()=>validatePowerUse(a,{...options,override:true},{cloneNumber:0}));
});
test("simultaneous Other action uses start-of-resolution health and cannot be used twice",async()=>{
  setup();const a=actor("Telepatía","dead");
  const p={id:"participant",actor:a,flags:{},getFlag:(_ns,key)=>p.flags[key],async setFlag(_ns,key,value){p.flags[key]=value;}};
  const c={id:"combat",round:1,combatants:collection([p]),getFlag:()=>({phase:"resolution",snapshots:[{id:p.id,cloneNumber:1,action:"other",health:{status:"healthy",stunned:false}}]})};game.combats.push(c);
  await commitPowerUse(a,options,{round:1,combatId:"combat"},"simultaneous");assert.equal(rollCount,1);
  assert.throws(()=>validatePowerUse(a,options));
});
test("Regeneration can be checked while incapacitated, uses canonical recovery and never revives",async()=>{
  setup();dice=[1];const a=actor("Regeneración","incapacitated");
  await commitPowerUse(a,options,{},"regen");
  await adjudicatePower(chat[0],{action:"heal"});assert.equal(a.system.health.status,"wounded");
  assert.equal(chat.length,1); // No public health announcement containing secret context.
  a.system.health.status="dead";assert.throws(()=>validatePowerUse(a,{...options,override:true}));
});
test("Mental Blast uses Endurance check and failed resistance permits canonical stun without ND",async()=>{
  setup();dice=[1,20];const a=actor("Rayo mental"),target=actor();
  await commitPowerUse(a,options,{},"blast");const message=chat[0];
  await assert.rejects(adjudicatePower(message,{action:"stun",targetUuid:target.uuid}));
  await adjudicatePower(message,{action:"resist",targetUuid:target.uuid,modifier:-2});
  await adjudicatePower(message,{action:"stun",targetUuid:target.uuid});
  assert.equal(target.system.health.status,"stunned");assert.equal(rollCount,2);
  assert.equal(JSON.stringify(message.flags).includes("damageNumber"),false);
});
test("Teleportation never moves a Token without explicit destination confirmation",async()=>{
  setup();dice=[1];const a=actor("Teleportación");let moved=0;
  documents.set("Scene.s.Token.t",{documentName:"Token",actor:a,async update(){moved++;}});
  await commitPowerUse(a,options,{},"teleport");assert.equal(moved,0);
  await assert.rejects(adjudicatePower(chat[0],{action:"teleport",tokenUuid:"Scene.s.Token.t",x:10,y:20}));
  await adjudicatePower(chat[0],{action:"teleport",tokenUuid:"Scene.s.Token.t",x:10,y:20,confirmed:true});assert.equal(moved,1);
});
test("temporary empathy and adrenaline modifiers affect rolls without changing base values; exhaustion is temporary",async()=>{
  setup();const a=actor("Empatía");await trackPowerEffect(a,POWER_REGISTRY.empathy,{durationType:"minutes",duration:1});
  const check=await rollCheck({actor:a,type:"skill",key:"cynicism.con",createMessage:false});assert.equal(check.finalTarget,13);assert.equal(a.system.skills.cynicism.con.value,8);
  const [effect]=await trackPowerEffect(a,POWER_REGISTRY.adrenalineControl,{durationType:"minutes",duration:1,strength:3,agility:2});
  const strength=await rollCheck({actor:a,type:"attribute",key:"strength",createMessage:false});assert.equal(strength.finalTarget,13);assert.equal(a.system.attributes.strength.value,10);
  await endPowerEffect(a,effect.id);assert.equal(a.system.health.status,"healthy");
  const tired=await rollCheck({actor:a,type:"attribute",key:"strength",createMessage:false});assert.equal(tired.finalTarget,6);
});

test("repeated adrenaline after exhaustion produces temporary incapacity; adequate rest clears it",async()=>{
  setup();const a=actor("Control de Adrenalina");
  for(let i=0;i<2;i++){
    const [effect]=await trackPowerEffect(a,POWER_REGISTRY.adrenalineControl,{durationType:"minutes",duration:1,strength:2});
    await endPowerEffect(a,effect.id);
  }
  assert.equal(a.effects.find(e=>e.flags[NS].powerEffect.fatigue).flags[NS].powerEffect.fatigue,2);
  await assert.rejects(rollCheck({actor:a,type:"attribute",key:"strength",createMessage:false}));
  assert.equal(a.system.health.status,"healthy");
  await endPowerEffect(a,a.effects[0].id,{rested:true});
  assert.equal((await rollCheck({actor:a,type:"attribute",key:"strength",createMessage:false})).finalTarget,10);
});

test("GM result correction preserves native dice and PM without replaying effects",async()=>{
  setup();const a=actor();await commitPowerUse(a,options,{},"correct");const message=chat[0];
  await adjudicatePower(message,{action:"result",resultClass:"criticalSuccess"});
  assert.equal(message.getFlag(NS,"powerResult").resultClass,"criticalSuccess");
  assert.equal(rollCount,1);assert.equal(a.system.mutantPower.points.value,9);assert.equal(message.rolls[0].total,20);
});
