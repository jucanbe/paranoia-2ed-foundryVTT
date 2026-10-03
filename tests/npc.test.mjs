import test from "node:test";
import assert from "node:assert/strict";
import {generationOptions,generateProfile,uniqueNPCIdentity,randomEquipmentEligible,selectNPCEquipment} from "../module/npc/generation.mjs";
import {LABELS} from "../module/sheets/labels.mjs";
import {isRulesActor} from "../module/actors/types.mjs";
import {buildCitizenId} from "../module/actors/identity.mjs";
const defaults=()=>({identity:{name:"",sector:"",useCitizenId:true},cloneNumber:1,
  attributes:Object.fromEntries(Object.keys(LABELS.attributeNames).map(k=>[k,{value:0}])),
  skills:Object.fromEntries(Object.entries(LABELS.skillNames).map(([group,skills])=>[group,Object.fromEntries(Object.keys(skills).map(k=>[k,{value:0}]))])),
  npc:{},mutantPower:{name:"",key:"",points:{}},secretSociety:{name:"",rank:"",notes:""},health:{status:"healthy"}});
test("minimal NPC uses seven native-injected d20 results and initializes every skill from Basic Skill",async()=>{
  let count=0;const options=generationOptions({service:"SDF"});
  const s=await generateProfile(defaults(),options,async()=>{count++;return 5;});
  assert.equal(count,7);assert.equal(s.attributes.mutantPower.value,0);assert.equal(s.service,"SDF");assert.equal(s.securityClearance,"red");
  for(const skills of Object.values(s.skills))for(const skill of Object.values(skills))assert.equal(skill.value,1);
  assert.equal(s.health.status,"healthy");assert.equal(s.creation,undefined);assert.equal(s.clones,undefined);
});
test("optional mutation rolls its eighth Attribute and independent power; society starts at level one without an invented title",async()=>{
  let count=0;const s=await generateProfile(defaults(),generationOptions({mutation:true,society:true}),async()=>{count++;return 5;});
  assert.equal(count,10);assert.equal(s.attributes.mutantPower.value,5);assert.equal(s.mutantPower.name,"Empatía");assert.equal(s.mutantPower.key,"empathy");
  assert.deepEqual(s.mutantPower.points,{value:5,max:5});assert.deepEqual(s.secretSociety.rank,{level:1,label:""});assert.equal(s.secretSociety.societyKey,"deathLeopards");
});
test("clearance never modifies Attributes; explicit competence heuristic clamps safely",async()=>{
  const red=await generateProfile(defaults(),generationOptions(),async()=>19);
  const uv=await generateProfile(defaults(),generationOptions({securityClearance:"ultraviolet"}),async()=>19);
  assert.deepEqual(red.attributes,uv.attributes);
  const elite=await generateProfile(defaults(),generationOptions({competence:"elite"}),async()=>19);
  const minor=await generateProfile(defaults(),generationOptions({competence:"minor"}),async()=>1);
  assert.equal(elite.attributes.strength.value,20);assert.equal(minor.attributes.strength.value,1);
});
test("citizen, plain name, and five repeated identities stay unique",()=>{
  const s=defaults();s.securityClearance="blue";const used=new Set();
  assert.equal(uniqueNPCIdentity(s,{name:"Marta",sector:"cpu"},used,()=>0),"MARTA-B-CPU-1");
  for(let i=0;i<4;i++)uniqueNPCIdentity(s,{name:"Marta",sector:"cpu"},used,()=>0);
  assert.equal(used.size,5);assert.equal(buildCitizenId({...s,identity:{...s.identity,useCitizenId:false}},"Guardia del acceso"),"Guardia del acceso");
});
test("generator validates bulk limits and context of assigned kit",()=>{
  for(const quantity of [0,21,1.5])assert.throws(()=>generationOptions({quantity}));
  assert.throws(()=>generationOptions({basicEquipment:true}));
  assert.throws(()=>generationOptions({basicEquipment:true,role:"troubleshooter",securityClearance:"infrared"}));
  assert.equal(generationOptions({quantity:20,basicEquipment:true,role:"troubleshooter"}).quantity,20);
  assert.throws(()=>generationOptions({securityClearance:"made-up"}));assert.throws(()=>generationOptions({cloneNumber:NaN}));
});
const item=(id,clearance,flags={})=>({type:"equipment",system:{securityClearance:clearance},flags:{"paranoia-2-edition":{catalogId:id,...flags}}});
test("random equipment rejects unknown clearance, higher clearance, excluded entries, and robots",()=>{
  assert.equal(randomEquipmentEligible(item("unknown",null),"red"),false);
  assert.equal(randomEquipmentEligible(item("blue","blue"),"red"),false);
  assert.equal(randomEquipmentEligible(item("excluded","red",{randomAssignable:false}),"red"),false);
  assert.equal(randomEquipmentEligible({...item("robot","red"),type:"robot"},"red"),false);
  assert.equal(randomEquipmentEligible(item("known","red"),"red"),true);
  assert.equal(randomEquipmentEligible(item("purchase",null,{startingPurchase:true}),"red"),true);
});
test("equipment uses stable catalogue IDs and fails before creation when a starter is missing",async()=>{
  const options=generationOptions({basicEquipment:true,role:"troubleshooter"});
  await assert.rejects(()=>selectNPCEquipment([],options,()=>0),/compendio/);
  const ids=["standard-troubleshooter-uniform","laser-pistol","laser-charge"];
  const selected=await selectNPCEquipment(ids.map(id=>item(id,null)),options,()=>0);
  assert.equal(selected.length,3);assert.ok(selected.every(row=>row.assigned));
});
test("shared rules accept Characters and NPCs only",()=>{
  assert.ok(isRulesActor({type:"character"}));assert.ok(isRulesActor({type:"npc"}));assert.equal(isRulesActor({type:"robot"}),false);
});
