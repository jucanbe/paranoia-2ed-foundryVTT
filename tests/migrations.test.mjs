import test from "node:test";
import assert from "node:assert/strict";
import {migratePower,legacyTreason} from "../module/migrations/legacy.mjs";
test("power aliases normalize without discarding notes, pool or unknown powers",()=>{
  const source={name:"Supersentido",notes:"legacy",points:{value:0,max:8},learned:[{key:"Hipersentido",source:"legacy"}]};
  const next=migratePower(source);assert.equal(next.key,"superSense");assert.equal(next.name,"Hipersentido");assert.equal(next.learned[0].key,"superSense");assert.deepEqual(next.points,source.points);assert.equal(next.notes,"legacy");assert.deepEqual(migratePower(next),next);assert.equal(source.name,"Supersentido");assert.deepEqual(migratePower({notes:"partial"}),{notes:"partial"});assert.equal(migratePower("Unknown power").name,"Unknown power");
});
test("legacy PT zero and records are preserved, invalid values are not guessed",()=>{
  assert.equal(legacyTreason({treasonPoints:0},"character").points,0);assert.equal(legacyTreason({treason:{points:8,bounty:5000}},"character").bounty,5000);assert.equal(legacyTreason({treasonPoints:21},"npc"),null);assert.equal(legacyTreason({},"character"),null);
});
