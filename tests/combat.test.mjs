import test from "node:test";
import assert from "node:assert/strict";
import {phaseAfter,weaponSkill,modifiersForAttack,assertAttackAllowed,validateDeclaration,actionSnapshot} from "../module/combat/rules.mjs";
import {evaluateCheck} from "../module/rolls/rules.mjs";
import {COMBAT_TURN_SECONDS,MOVEMENT} from "../module/combat/config.mjs";
import {declarationOf} from "../module/combat/state.mjs";
test("four phases wrap to the next five-second turn; rewind stays in current round",()=>{
 let s={round:1,phase:"npcDecision"};for(const phase of ["playerDecision","resolution","movement","npcDecision"]){s=phaseAfter(s.round,s.phase);assert.equal(s.phase,phase);}assert.equal(s.round,2);assert.equal(COMBAT_TURN_SECONDS,5);assert.deepEqual(phaseAfter(2,"npcDecision",-1),s);
});
test("weapon keys preserve canonical and short-key compatibility",()=>{
 assert.equal(weaponSkill("laserWeapons"),"dexterity.laserWeapons");assert.equal(weaponSkill("agility.club"),"agility.club");assert.throws(()=>weaponSkill("Pistola láser"));assert.throws(()=>weaponSkill("cynicism.flattery"));
});
test("attack comparisons reuse the generic evaluator, including equality",()=>{
 for(const [die,hit] of [[7,true],[10,true],[11,false]])assert.equal(evaluateCheck(die,10).success,hit);
 assert.equal(evaluateCheck(1,-5,true).success,true);assert.equal(evaluateCheck(20,40,true).success,false);
});
test("point blank excludes melee, energy sword, and neural whip",()=>{
 assert.equal(modifiersForAttack({baseValue:8,skill:"dexterity.laserWeapons",pointBlank:true}).finalTarget,12);
 for(const skill of ["agility.energySword","agility.neuralWhip","agility.club","agility.brawling","agility.ancientMeleeWeapons"])assert.equal(modifiersForAttack({baseValue:8,skill,pointBlank:true}).modifiers.pointBlank,0);
 assert.equal(modifiersForAttack({baseValue:8,skill:"dexterity.energyWeapons",category:"B",pointBlank:true}).modifiers.pointBlank,0);
});
test("wounded, defense and GM arithmetic are separately retained",()=>{
 const base={baseValue:12,skill:"dexterity.laserWeapons"};assert.equal(modifiersForAttack({...base,defending:true}).finalTarget,8);
 const p=modifiersForAttack({...base,pointBlank:true,healthStatus:"wounded",defending:true});assert.equal(p.finalTarget,8);assert.deepEqual(p.modifiers,{pointBlank:4,wounded:-4,defenderEvading:-4,gmModifier:0});
 assert.equal(modifiersForAttack({...base,healthStatus:"unknown"}).modifiers.wounded,0);assert.equal(modifiersForAttack({...base,gmModifier:-3}).finalTarget,9);
 assert.equal(modifiersForAttack({...base,healthStatus:"wounded",pointBlank:true,defending:true,gmModifier:2}).finalTarget,10);
});
test("snapshot excludes pre-existing incapacity but preserves declared health after simultaneous damage",()=>{
 const c={id:"a",actor:{system:{cloneNumber:1,health:{status:"healthy",stunned:false}}}};
 const declaration={action:"attack",movement:"walk",weaponId:"w",targetId:"b",text:"Private intention"};
 const snapshot=actionSnapshot(c,declaration);c.actor.system.health.status="dead";
 assert.equal(snapshot.health.status,"healthy");assert.equal(snapshot.text,undefined);
 assert.equal(actionSnapshot(c,declaration),null);
 for(const health of [{status:"incapacitated"},{status:"vaporized"},{status:"wounded",stunned:true}]){c.actor.system.health=health;assert.equal(actionSnapshot(c,declaration),null);}
 c.actor.system.health={status:"wounded",stunned:false};assert.equal(actionSnapshot(c,declaration).health.status,"wounded");
 assert.equal(actionSnapshot(c,{...declaration,movement:"sprint"}),null);
 assert.ok(actionSnapshot(c,{...declaration,movement:"sprint",healthOverride:true}));
});
test("Sprint is rejected during declaration except for an explicit GM exception",()=>{
 const d={action:"attack",movement:"sprint"};assert.throws(()=>validateDeclaration(d));assert.throws(()=>validateDeclaration({...d,healthOverride:true}));
 assert.equal(validateDeclaration({...d,healthOverride:true},true).healthOverride,true);
});
test("attack entitlement, one attack, Sprint, and explicit GM override",()=>{
 const allowed={phase:"resolution",declaration:{action:"attack",movement:"run"},eligible:true,resolved:false};assert.doesNotThrow(()=>assertAttackAllowed(allowed));
 for(const change of [{phase:"movement"},{eligible:false},{resolved:true},{declaration:{action:"attack",movement:"sprint"}}]){assert.throws(()=>assertAttackAllowed({...allowed,...change}));assert.doesNotThrow(()=>assertAttackAllowed({...allowed,...change,override:true}));}
 // No health/defeated gate: already-declared simultaneous actions retain entitlement.
 assert.doesNotThrow(()=>assertAttackAllowed({...allowed,defeated:true}));
 for(const movement of ["walk","march","run"])assert.ok(!MOVEMENT[movement].preventsAttack);
});
test("defensive declarations, free text and restricted Zoom",()=>{
 assert.equal(validateDeclaration({action:"evade",movement:"walk",text:"Cubrirse"}).defending,true);
 assert.throws(()=>validateDeclaration({action:"move",movement:"zoom"}));assert.equal(validateDeclaration({action:"move",movement:"zoom"},true).movement,"zoom");assert.throws(()=>validateDeclaration({action:"hack",movement:"fly"}));
});

test("NPC declarations require a GM author and are never returned to a player",()=>{
 const data={combatId:"c",combatantId:"n",round:1,text:"GM declaration"};
 globalThis.game={user:{isGM:true},messages:{contents:[{author:{isGM:true},getFlag:()=>data},{author:{isGM:false},getFlag:()=>({...data,text:"Spoofed"})}]}};
 const combat={id:"c",round:1},npc={id:"n",actor:{hasPlayerOwner:false}};
 assert.equal(declarationOf(combat,npc).text,"GM declaration");
 game.user.isGM=false;assert.equal(declarationOf(combat,npc),null);
 delete globalThis.game;
});
