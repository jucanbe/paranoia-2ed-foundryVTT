import test from "node:test";
import assert from "node:assert/strict";
import { buildCitizenId, CLEARANCE_CODES } from "../module/actors/identity.mjs";
import { basicSkillForAttribute, carryingCapacityForStrength, bonusForAttribute } from "../module/data/derived-capabilities.mjs";

test("citizen identifiers normalize components, preserve accents, and use every clearance code", () => {
  for (const [securityClearance, code] of Object.entries(CLEARANCE_CODES)) {
    assert.equal(buildCitizenId({identity: {name: "  María-José ", sector: " cpu "}, securityClearance, cloneNumber: 2}), `MARÍA-JOSÉ-${code}-CPU-2`);
  }
});

test("incomplete identity remains safe and existing names are not destroyed", () => {
  assert.equal(buildCitizenId({identity: {name: ""}}, "Old character name"), "Old character name");
  assert.equal(buildCitizenId({identity: {name: "David"}, securityClearance: "red", cloneNumber: 1}), "DAVID-R-???-1");
  assert.equal(buildCitizenId({identity: {name: "David"}, cloneNumber: NaN}), "DAVID-?-???-?");
});

test("all Basic Skill table values and boundaries", () => {
  const expected = [0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5];
  expected.forEach((result, index) => assert.equal(basicSkillForAttribute(index + 1), result));
});

test("carrying capacity and shared damage/stamina bonus tables", () => {
  for (const [value, kg] of [[1, 25], [5, 25], [12, 25], [13, 30], [18, 55], [20, 65]]) {
    assert.equal(carryingCapacityForStrength(value), kg);
  }
  for (const [value, bonus] of [[1, 0], [5, 0], [13, 0], [14, 1], [18, 1], [19, 2], [20, 2]]) {
    assert.equal(bonusForAttribute(value), bonus);
  }
});

test("uninitialized and invalid sources are not mistaken for legitimate zero results", () => {
  for (const fn of [basicSkillForAttribute, carryingCapacityForStrength, bonusForAttribute]) {
    for (const value of [0, -1, 21, 5.5, null, undefined, NaN, Infinity, "5"]) assert.equal(fn(value), null);
  }
});
