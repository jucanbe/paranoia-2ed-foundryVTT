import test from "node:test";
import assert from "node:assert/strict";
import {actionSnapshot} from "../module/combat/rules.mjs";
import {snapshotOf} from "../module/combat/state.mjs";
import {pendingPhaseWork} from "../module/combat/service.mjs";
const NS="paranoia-2-edition";
function fixture(){
  const flags={state:{phase:"playerDecision",snapshots:[]}};
  const c={id:"a",defeated:false,actor:{hasPlayerOwner:true,system:{cloneNumber:1,health:{status:"healthy"}}},flags:{},getFlag:(_ns,k)=>c.flags[k]};
  const combat={id:"combat",round:1,combatants:[c],getFlag:(_ns,k)=>flags[k]};
  return {combat,c,flags};
}
test("phase warnings count missing declarations, unresolved attacks and movement without blocking GM",()=>{
 const {combat,c,flags}=fixture();assert.equal(pendingPhaseWork(combat).count,1);
 c.flags.declaration={round:1,action:"attack",movement:"walk",weaponId:"w",targetId:"b"};assert.equal(pendingPhaseWork(combat).count,0);
 flags.state={phase:"resolution",snapshots:[actionSnapshot(c,c.flags.declaration)]};assert.equal(pendingPhaseWork(combat).count,1);
 c.actor.system.health.status="dead";assert.equal(pendingPhaseWork(combat).count,1);
 c.flags.attack={round:1,resolved:true};assert.equal(pendingPhaseWork(combat).count,0);
 flags.state.phase="movement";assert.equal(pendingPhaseWork(combat).count,0);
 c.actor.system.health.status="healthy";assert.equal(pendingPhaseWork(combat).count,1);
 c.flags.movement={round:1,resolved:true};assert.equal(pendingPhaseWork(combat).count,0);
});
test("old-body entitlement is not transferred to a replacement clone",()=>{
 const {combat,c,flags}=fixture();flags.state.snapshots=[actionSnapshot(c,{action:"attack",movement:"walk"})];
 assert.ok(snapshotOf(combat,c));c.actor.system.cloneNumber=2;assert.equal(snapshotOf(combat,c),null);
});
