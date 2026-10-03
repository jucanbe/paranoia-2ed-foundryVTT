import test from "node:test";
import assert from "node:assert/strict";
import {calculateTarget, evaluateCheck, evaluateDuel} from "../module/rolls/rules.mjs";
import {readCheck} from "../module/rolls/service.mjs";
import {LABELS} from "../module/sheets/labels.mjs";

test("roll-under includes equality and has no mandatory natural overrides", () => {
  for (const [die, success] of [[1,true],[8,true],[12,true],[13,false],[20,false]]) assert.equal(evaluateCheck(die,12).success,success);
  assert.equal(evaluateCheck(1,0).success,false);
  assert.equal(evaluateCheck(20,24).success,true);
});
test("central difficulty floors before applying the modifier without clamping", () => {
  for (const [base, expected] of [[17,[34,17,8,4]],[5,[10,5,2,1]]]) {
    assert.deepEqual(["easy","normal","difficult","veryDifficult"].map(d => calculateTarget(base,d).finalTarget),expected);
  }
  assert.equal(calculateTarget(12,"normal",2).finalTarget,14);
  assert.equal(calculateTarget(12,"normal",-3).finalTarget,9);
  assert.equal(calculateTarget(17,"difficult","+2").finalTarget,10);
  assert.equal(calculateTarget(0).finalTarget,0);
});
test("optional special results override both outcome and label", () => {
  assert.equal(evaluateCheck(1,0,true).label,"ÉXITO ESPECTACULAR");
  assert.equal(evaluateCheck(1,0,true).success,true);
  assert.equal(evaluateCheck(20,34,true).label,"FALLO CRÍTICO");
  assert.equal(evaluateCheck(20,34,true).failure,true);
  assert.equal(evaluateCheck(12,12,true).success,true);
});
test("duels compare totals and preserve ties", () => {
  const a = {baseValue:12,dieResult:13}, b = {baseValue:12,dieResult:9};
  assert.deepEqual(evaluateDuel(a,b),{totalA:25,totalB:21,winner:"a",tie:false});
  assert.equal(evaluateDuel(b,a).winner,"b");
  assert.equal(evaluateDuel(a,a).tie,true);
  assert.equal(evaluateDuel(a,a).winner,null);
});
test("malformed values are rejected before dice execution", () => {
  for (const value of [undefined,null,NaN,Infinity,"12"]) assert.throws(()=>calculateTarget(value));
  for (const modifier of ["", "1.5", "2foo", NaN, {}, true]) assert.throws(()=>calculateTarget(12,"normal",modifier));
  assert.throws(()=>calculateTarget(12,"bogus"));
});

test("every existing Attribute and Skill resolves its own value without adding Basic Skills", () => {
  globalThis.game = {user: {}};
  const actor = {type: "character", testUserPermission: () => true, system: {
    attributes: Object.fromEntries(Object.keys(LABELS.attributeNames).map(k => [k,{value:17}])),
    skills: Object.fromEntries(Object.entries(LABELS.skillNames).map(([g, skills]) => [g,Object.fromEntries(Object.keys(skills).map(k => [k,{value:8}]))])),
    basicSkills: {agility:4,dexterity:4,perception:4,cynicism:4,mechanicalTalent:4}
  }};
  for (const key of Object.keys(LABELS.attributeNames)) assert.equal(readCheck(actor,"attribute",key).baseValue,17);
  for (const [group, skills] of Object.entries(LABELS.skillNames)) for (const key of Object.keys(skills)) assert.equal(readCheck(actor,"skill",`${group}.${key}`).baseValue,8);
  assert.throws(()=>readCheck(actor,"skill","dexterity.missing"));
  assert.throws(()=>readCheck(actor,"skill",undefined));
  actor.testUserPermission = () => false;
  assert.throws(()=>readCheck(actor,"attribute","strength"));
  delete globalThis.game;
});
