import test from "node:test";
import assert from "node:assert/strict";
import {rangeBand,rangeSkill,attackTarget,malfunctions,woundRestriction,mechanicalWounds} from "../module/combat/optional/rules.mjs";
import {getProtectionFor,protectionCode} from "../module/items/protection.mjs";
import {enabled} from "../module/combat/optional/settings.mjs";
import {optionalPreview,validateOptionalDeclaration,resolveHandling,recordShot,ammunitionData,distanceMeters} from "../module/combat/optional/runtime.mjs";
import {healedWounds} from "../module/combat/optional/wounds.mjs";
const settings=new Map();globalThis.game={user:{isGM:true},settings:{get:(_ns,k)=>settings.get(k)},messages:{contents:[]},time:{worldTime:0}};
function on(...keys){settings.clear();settings.set("useOptionalCombatRules",true);for(const k of keys)settings.set(`optionalCombat.${k}`,true);}
test("master off overrides every individual toggle; enabled modules remain independent",()=>{on("range");assert.equal(enabled("range"),true);assert.equal(enabled("cover"),false);settings.set("useOptionalCombatRules",false);assert.equal(enabled("range"),false);});
test("50m bands and source range arithmetic, unknown range manual, beyond max rejected band",()=>{
  for(const [d,band] of [[0,"pointBlank"],[5,"pointBlank"],[6,"short"],[16,"short"],[17,"medium"],[33,"medium"],[34,"long"],[50,"long"],[51,"out"]])assert.equal(rangeBand(d,50),band);
  assert.equal(rangeBand(20,null),"manual");assert.equal(rangeBand(null,50),"manual");assert.equal(rangeBand(1,0),"out");assert.deepEqual(["pointBlank","short","medium","long"].map(b=>rangeSkill(12,b)),[24,12,6,3]);assert.equal(rangeSkill(15,"long"),3);
});
test("burst rounds up before range and flat modifiers; cover and evasion stack without floor",()=>{
  assert.equal(attackTarget({baseValue:14,targetCount:3}).burstSkill,5);
  assert.equal(attackTarget({baseValue:14,targetCount:3,band:"medium",wounded:-4,cover:"half",attackerMovement:"march",targetMovement:"run",defending:true,gmModifier:2}).finalTarget,-13);
  assert.deepEqual(["light","half","nearTotal"].map(cover=>attackTarget({baseValue:12,cover}).finalTarget),[11,8,-3]);assert.equal(attackTarget({baseValue:12,cover:"half",defending:true}).finalTarget,4);
});
test("movement source values are cumulative; no invented sprint attack penalty",()=>{
  assert.equal(attackTarget({baseValue:12,attackerMovement:"march",targetMovement:"run"}).modifiers.movement,-5);assert.equal(attackTarget({baseValue:12,attackerMovement:"walk"}).modifiers.movement,0);assert.throws(()=>attackTarget({baseValue:12,attackerMovement:"sprint"}));
});
test("polyvalent armor matches one category, derived codes, T not additive, legacy supported",()=>{
  const p={protections:[{type:"melee",value:3},{type:"laser",value:1}]};assert.equal(protectionCode(p),"B3/L1");assert.deepEqual(["melee","laser","projectile"].map(k=>getProtectionFor(p,k)),[3,1,0]);
  const c={protections:[{type:"laser",value:4},{type:"melee",value:3},{type:"projectile",value:2},{type:"piercingProjectile",value:6}]};assert.equal(protectionCode(c),"L4/B3/P2/PP6");assert.deepEqual(c.protections.map(p=>getProtectionFor(c,p.type)),[4,3,2,6]);assert.equal(getProtectionFor({protections:[{type:"all",value:4},{type:"laser",value:3}]},"laser"),4);assert.equal(protectionCode({protectionType:"laser",protectionValue:4}),"L4");
});
test("local arm/leg/torso consequences, manual override and healing permanent effects",()=>{
  const arm=[{location:"arm",side:"left",active:true}];assert.ok(woundRestriction(arm,"none",{weaponArm:"left"}));assert.equal(woundRestriction(arm,"none",{weaponArm:"right"}),"");assert.equal(woundRestriction(arm,"march",{weaponArm:"none"}),"");
  assert.ok(woundRestriction([{location:"leg",active:true}],"run"));assert.equal(woundRestriction([{location:"leg",active:true}],"march"),"");assert.ok(woundRestriction([{location:"chest",active:true}],"walk"));assert.equal(woundRestriction([{location:"abdomen",active:true}],"walk",{override:true}),"");
  assert.deepEqual(healedWounds([{location:"leg",active:true},{location:"head",active:true,permanent:true}]).map(w=>w.active),[false,true]);
});
test("natural malfunction thresholds normal20 experimental19 truly10 manual when absent",()=>{
  for(const [system,results] of [[{reliabilityType:"normal"},[false,false,true]],[{reliabilityType:"experimental"},[false,true,true]]])assert.deepEqual([18,19,20].map(d=>malfunctions(system,d)),results);
  assert.deepEqual([9,10,15].map(d=>malfunctions({reliabilityType:"trulyExperimental",malfunctionThreshold:10},d)),[false,true,true]);assert.equal(malfunctions({reliabilityType:"trulyExperimental"},20),false);
});
function fixture(){
  const weapon={id:"w",type:"weapon",flags:{},system:{weaponCategory:"laser",skill:"dexterity.laserWeapons",integrated:false,ammunition:{capacity:6},ammoType:"laser-charge",ammoCurrent:0,reloadTurns:2,requiredArm:"right",reliabilityType:"normal",malfunctionShot:"manual"},async update(changes){for(const [key,v] of Object.entries(changes))this.system[key.replace("system.","")]=v;return this;},toObject(){return {_id:this.id,type:this.type,system:structuredClone(this.system)};}};
  const ammo={id:"ammo",type:"equipment",flags:{"paranoia-2-edition":{catalogId:"laser-charge"}},system:{quantity:1,securityClearance:"red"},toObject(){return {_id:this.id,type:this.type,flags:this.flags,system:structuredClone(this.system)};}};
  const items=[weapon,ammo];items.get=id=>items.find(i=>i.id===id);
  const actor={type:"character",hasPlayerOwner:true,system:{securityClearance:"red",health:{status:"healthy",wounds:[]},toObject(){return {health:this.health,securityClearance:"red"};}},items,async update(data){for(const source of data.items){const item=this.items.get(source._id);if(item){item.system=source.system;item.flags=source.flags??{};}}this.items=this.items.filter(i=>data.items.some(s=>s._id===i.id));this.items.get=id=>this.items.find(i=>i.id===id);return this;}};
  const c={id:"c",actor,flags:{declaration:{round:1,action:"reload",movement:"none",weaponId:"w"}},getFlag:(_ns,k)=>c.flags[k],async setFlag(_ns,k,v){c.flags[k]=v;},async unsetFlag(_ns,k){delete c.flags[k];}};
  const combat={round:1};return {weapon,actor,c,combat};
}
test("off ignores empty/holstered/broken weapons; independent cover does not enable ammo",()=>{
  const f=fixture(),args={baseValue:12,weapon:f.weapon,c:f.c,target:null,declaration:{movement:"walk"},options:{cover:"half"},user:game.user,health:{status:"healthy"},defending:false,gmModifier:0};settings.clear();f.weapon.system.malfunctioned=true;assert.equal(optionalPreview(args),null);on("cover");assert.equal(optionalPreview(args).finalTarget,8);on("ammunition");assert.throws(()=>optionalPreview(args),/descargada/);on("weaponHandling");assert.throws(()=>optionalPreview(args),/enfundada/);
});
test("reload progress consumes one real ammo unit only at completion and repeats are safe",async()=>{
  on("ammunition");const f=fixture();await resolveHandling(f.combat,f.c);assert.equal(f.weapon.system.ammoCurrent,0);assert.equal(f.actor.items.get("ammo").system.quantity,1);await resolveHandling(f.combat,f.c);assert.equal(f.c.flags.weaponProgress.done,1);f.combat.round=2;f.c.flags.declaration.round=2;await resolveHandling(f.combat,f.c);assert.equal(f.weapon.system.ammoCurrent,6);assert.equal(f.actor.items.get("ammo"),undefined);f.combat.round=3;f.c.flags.declaration.round=3;await assert.rejects(resolveHandling(f.combat,f.c),/Falta munición/);
});
test("draw/holster each cost a turn, switching requires holster, no sprint",async()=>{
  on("weaponHandling");const f=fixture();f.c.flags.declaration.action="draw";await resolveHandling(f.combat,f.c);assert.deepEqual(f.c.flags.weaponReady,["w"]);assert.throws(()=>validateOptionalDeclaration(f.actor,f.c,{action:"draw",weaponId:"w",movement:"sprint"},game.user),/sprint/);f.c.flags.weaponReady=["other"];f.combat.round=2;f.c.flags.declaration.round=2;await assert.rejects(resolveHandling(f.combat,f.c),/Enfunda/);f.c.flags.weaponReady=["w"];f.c.flags.declaration.action="holster";await resolveHandling(f.combat,f.c);assert.deepEqual(f.c.flags.weaponReady,[]);
});
test("shots consume current load separate from carried ammo; unknown burst cost stays manual",async()=>{
  on("ammunition","malfunctions");const f=fixture();f.weapon.system.ammoCurrent=6;await recordShot(f.weapon,19);assert.equal(f.weapon.system.ammoCurrent,5);assert.equal(f.weapon.system.malfunctioned,undefined);const result=await recordShot(f.weapon,20,{burst:true});assert.equal(f.weapon.system.ammoCurrent,5);assert.equal(result.shot,"manual");assert.equal(f.weapon.system.malfunctioned,true);assert.ok(result.notes.some(n=>n.includes("Consumo")));assert.equal(f.actor.items.get("ammo").system.quantity,1);
  f.weapon.flags={"paranoia-2-edition":{catalogId:"laser-pistol"}};f.weapon.system.ammunition.capacity=null;f.weapon.system.ammoType="";assert.deepEqual(ammunitionData(f.weapon),{capacity:6,type:"laser-charge"});
});

test("reload receipt recovers a failed Combatant acknowledgement without consuming twice",async()=>{
  on("ammunition");const f=fixture();f.weapon.system.reloadTurns=1;
  const original=f.c.setFlag;let fail=true;f.c.setFlag=async function(ns,key,value){if(key==="otherAction"&&fail){fail=false;throw Error("Acknowledgement unavailable");}return original.call(this,ns,key,value);};
  await assert.rejects(resolveHandling(f.combat,f.c),/Acknowledgement/);assert.equal(f.weapon.system.ammoCurrent,6);assert.equal(f.actor.items.get("ammo"),undefined);
  const result=await resolveHandling(f.combat,f.c);assert.equal(result.duplicate,true);assert.equal(f.weapon.system.ammoCurrent,6);assert.equal(f.c.flags.otherAction.resolved,true);
});
test("failed reload Actor update leaves load and carried ammo unchanged",async()=>{
  on("ammunition");const f=fixture();f.weapon.system.reloadTurns=1;f.actor.update=async()=>null;await assert.rejects(resolveHandling(f.combat,f.c),/guardó/);assert.equal(f.weapon.system.ammoCurrent,0);assert.equal(f.actor.items.get("ammo").system.quantity,1);assert.equal(f.c.flags.otherAction,undefined);
});

test("native distance adapter converts recognized units and safely falls back without geometry",()=>{
  const scene={id:"scene",grid:{units:"m"}},a={parent:scene,object:{center:{x:100,y:100}}},b={parent:scene,object:{center:{x:300,y:100}}};let passed;
  globalThis.canvas={scene,grid:{measurePath:path=>{passed=path;return {distance:10};}}};assert.equal(distanceMeters(a,b),10);assert.deepEqual(passed,[a.object.center,b.object.center]);scene.grid.units="feet";assert.equal(distanceMeters(a,b),3.048);scene.grid.units="unknown";assert.equal(distanceMeters(a,b),null);assert.equal(distanceMeters(a,null),null);delete globalThis.canvas;
});
test("simultaneous wound snapshots omit medical and GM notes",()=>{
  const records=mechanicalWounds([{location:"arm",side:"left",active:true,notes:"Medical private prose",gmNotes:"Hidden"}]);assert.equal(records[0].location,"arm");assert.equal(records[0].active,true);assert.equal(JSON.stringify(records).includes("private"),false);assert.equal(Object.hasOwn(records[0],"gmNotes"),false);
});
