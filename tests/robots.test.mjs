import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {programSummary,validateMemory,robotTransition,repairedRobot,peripheralWarnings,robotBlocked} from "../module/robots/rules.mjs";
import {calculateHealthTarget} from "../module/rolls/rules.mjs";
import {integratedSelection,attackSlot,allAttacksResolved} from "../module/robots/combat.mjs";
import {actionSnapshot} from "../module/combat/rules.mjs";
const p=(skill,level,active=true,storageMode="resident")=>({type:"robotProgram",system:{skill,level,active,storageMode}});
const health=status=>({status,stunned:false,salvageAvailable:true});
test("resident memory 8 + 7 uses 15 of 20; Engineering 6 is rejected",()=>{
  const programs=[p("perception.medicine",8),p("dexterity.laserWeapons",7)];
  const s=validateMemory(programs,20);assert.equal(s.used,15);assert.equal(s.free,5);assert.equal(s.skills.perception.medicine.value,8);
  assert.throws(()=>validateMemory([...programs,p("perception.electronicEngineering",6)],20),/Memoria insuficiente/);
});
test("14 used leaves 6; inserted level-7 card rejected until resident program removed",()=>{
  const resident=p("perception.medicine",14),card=p("dexterity.laserWeapons",7,true,"card");
  assert.throws(()=>validateMemory([resident,card],20));resident.system.active=false;
  assert.equal(validateMemory([resident,card],20).used,7);card.system.active=false;assert.equal(programSummary([resident,card],20).used,0);
});
test("unknown capacity is not invented, existing verified knowledge survives, further installation blocks",()=>{
  assert.equal(programSummary([p("medicine",8)],null).free,null);
  assert.throws(()=>validateMemory([p("medicine",8),p("laserWeapons",7)],null,{previousUsed:8}));
  assert.equal(validateMemory([p("medicine",8)],null,{previousUsed:8}).used,8);
});
test("duplicate programs consume memory independently but never sum skill levels",()=>{
  const s=programSummary([p("medicine",4),p("medicine",8)],20);assert.equal(s.used,12);assert.equal(s.skills.perception.medicine.value,8);
  assert.throws(()=>programSummary([p("invented",8)],20));
});
test("robot maps all Damage Table results without copying the table",()=>{
  for(const [r,s]of Object.entries({noEffect:"operational",stunned:"shortCircuit",wounded:"lightDamage",incapacitated:"seriousDamage",dead:"destroyed",vaporized:"vaporized"}))assert.equal(robotTransition(health("operational"),r).status,s);
});
test("Light Damage penalizes combat skills once, never Medicine",()=>{
  assert.equal(calculateHealthTarget(10,"normal",0,health("lightDamage"),false,"dexterity.laserWeapons").finalTarget,6);
  assert.equal(calculateHealthTarget(8,"normal",0,health("lightDamage"),false,"perception.medicine").finalTarget,8);
  assert.equal(calculateHealthTarget(12,"normal",0,{status:"wounded"},false,"perception.medicine").finalTarget,8);
});
test("two light results become serious; further damaging results destroy; non-damage does not",()=>{
  const serious=robotTransition(robotTransition(health("operational"),"wounded"),"wounded");assert.equal(serious.status,"seriousDamage");assert.ok(robotBlocked(serious));
  assert.equal(robotTransition(serious,"stunned").status,"seriousDamage");assert.equal(robotTransition(serious,"noEffect").status,"seriousDamage");assert.equal(robotTransition(serious,"wounded").status,"destroyed");
  assert.equal(robotTransition(health("destroyed"),"noEffect").status,"destroyed");assert.equal(robotTransition(health("destroyed"),"vaporized").salvageAvailable,false);
});
test("repair steps do not resurrect destroyed or vaporized robots",()=>{
  assert.equal(repairedRobot(health("seriousDamage")).status,"lightDamage");assert.equal(repairedRobot(health("lightDamage")).status,"operational");
  assert.throws(()=>repairedRobot(health("destroyed")));assert.throws(()=>repairedRobot(health("vaporized")));
});
test("medical knowledge warns about missing peripherals, without blocking installation",()=>{
  const actor={items:[],system:{skills:programSummary([p("medicine",15)],20).skills}};assert.equal(peripheralWarnings(actor).length,1);
  actor.items.push({type:"robotPeripheral",system:{category:"medical",operational:true}});assert.equal(peripheralWarnings(actor).length,0);
});
test("only integrated robot weapons get separate declared slots; held weapons keep a single slot",()=>{
  const actor={type:"robot",items:new Map(["a","b","held"].map(id=>[id,{id,type:"weapon",system:{integrated:id!=="held"}}]))};
  const ids=integratedSelection(actor,["a","b"]),declaration={integratedWeaponIds:ids};
  assert.equal(attackSlot(actor,declaration,"a"),"a");assert.equal(attackSlot(actor,declaration,"b"),"b");assert.throws(()=>attackSlot(actor,declaration,"held"));
  assert.throws(()=>integratedSelection(actor,["held"]));assert.throws(()=>integratedSelection({...actor,type:"npc"},["a"]));assert.equal(attackSlot(actor,{},"held"),"single");
  assert.equal(allAttacksResolved({weapons:{a:{resolved:true}}},declaration),false);assert.equal(allAttacksResolved({weapons:{a:{resolved:true},b:{resolved:true}}},declaration),true);
});
test("simultaneous snapshot preserves integrated selection and pre-damage health",()=>{
  const a={type:"robot",system:{health:health("operational")},effects:[]};const s=actionSnapshot({id:"robot",actor:a},{action:"attack",movement:"walk",integratedWeaponIds:["a","b"]});
  a.system.health.status="destroyed";assert.equal(s.health.status,"operational");assert.deepEqual(s.integratedWeaponIds,["a","b"]);
});
test("13 robot sources and 3 programs contain only verified scores; unknown stats remain absent",async()=>{
  const robots=JSON.parse(await readFile(new URL("../packs-source/robots.json",import.meta.url))),programs=JSON.parse(await readFile(new URL("../packs-source/robot-programs.json",import.meta.url)));
  assert.equal(robots.length,13);assert.equal(programs.length,3);
  for(const [id,level]of [["i",4],["v",8],["xii",15]])assert.equal(robots.find(r=>r.catalogId===`robodoctor-model-${id}`).items.find(i=>i.type==="robotProgram").system.level,level);
  assert.equal(robots.find(r=>r.catalogId==="robosoldier").system.robot.asimovStatus,"absent");assert.equal(robots.find(r=>r.catalogId==="roboplane").system.robot.requiresVehicleSystem,true);
  for(const r of robots){assert.equal(r.system.attributes,undefined);assert.equal(r.system.securityClearance,undefined);assert.equal(r.system.robot.memory?.capacity,undefined);assert.ok(!r.items.some(i=>i.type==="weapon"||i.type==="armor"));}
});
