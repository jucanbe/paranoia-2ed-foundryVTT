import test from "node:test";
import assert from "node:assert/strict";
import {WEAPON_CATEGORIES,PROTECTION_TYPES,normalizeWeaponCategory,canonicalSkill,skillLabel,armorCode,ITEM_CLEARANCES,EQUIPMENT_CATEGORIES} from "../module/items/config.mjs";
import {CLEARANCE_CODES} from "../module/actors/identity.mjs";
test("canonical categories preserve all six legacy codes",()=>{
  for(const [key,{code}] of Object.entries(WEAPON_CATEGORIES)){assert.equal(normalizeWeaponCategory(code),key);assert.equal(normalizeWeaponCategory(key),key);assert.equal(PROTECTION_TYPES[key].code,code);}
  assert.equal(normalizeWeaponCategory("unknown"),"");assert.equal(PROTECTION_TYPES.all.code,"T");
});
test("armor codes preserve zero and distinguish unconfigured protection",()=>{
  assert.equal(armorCode("laser",4),"L4");assert.equal(armorCode("all",2),"T2");assert.equal(armorCode("piercingProjectile",0),"PP0");
  for(const value of [null,undefined,NaN,"4"])assert.equal(armorCode("laser",value),"—");assert.equal(armorCode("",0),"—");
});
test("skill choices reuse existing identifiers and preserve unknown legacy text",()=>{
  assert.equal(canonicalSkill("laserWeapons"),"dexterity.laserWeapons");assert.equal(canonicalSkill("agility.grenade"),"agility.grenade");assert.equal(skillLabel("laserWeapons"),"Armas Láser");assert.equal(canonicalSkill("Old custom skill"),"Old custom skill");
});
test("Item clearances share Character configuration and equipment categories remain finite",()=>{
  assert.deepEqual(ITEM_CLEARANCES,Object.keys(CLEARANCE_CODES));assert.deepEqual(Object.keys(EQUIPMENT_CATEGORIES),["general","communicator","recorder","tool","medical","computer","consumable","other"]);
});
