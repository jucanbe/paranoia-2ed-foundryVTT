import test from "node:test";
import assert from "node:assert/strict";
// Exercise the real static migration methods; schema construction is verified in Foundry.
globalThis.foundry={abstract:{TypeDataModel:class{static migrateData(source){return source;}}}};
const {CharacterData}=await import("../module/data/models/character.mjs");
const {WeaponData}=await import("../module/data/models/weapon.mjs");
test("partial Actor health-note updates never insert a healthy state",()=>{
  assert.deepEqual(CharacterData.migrateData({health:{notes:"Keep this"}}),{health:{notes:"Keep this"}});
  assert.equal(CharacterData.migrateData({health:{status:"Herido"}}).health.status,"wounded");
  assert.equal(CharacterData.migrateData({health:{status:""}}).health.status,"healthy");
});
test("partial Weapon notes/price updates do not clear the existing category",()=>{
  assert.deepEqual(WeaponData.migrateData({notes:"Keep",price:2}),{notes:"Keep",price:2});
  assert.equal(WeaponData.migrateData({weaponCategory:"L"}).weaponCategory,"laser");
  assert.equal(WeaponData.migrateData({damageNumber:"0"}).damageNumber,0);
});
