import test from "node:test";
import assert from "node:assert/strict";
globalThis.foundry={abstract:{TypeDataModel:class{static migrateData(source){return source;}}}};
const {LegacyDataModel}=await import("../module/data/models/legacy.mjs");
class Fixture extends LegacyDataModel{static schema={fields:{known:{},nested:{fields:{note:{}}},legacyData:{}}};}
test("undeclared old root and nested fields survive schema cleaning and repeated migration",()=>{
  const source={known:0,old:{value:42},nested:{note:"kept",unknown:"saved"}};
  const migrated=Fixture.migrateData(source);assert.deepEqual(migrated.legacyData,{old:{value:42},"nested.unknown":"saved"});assert.equal(migrated.known,0);assert.deepEqual(Fixture.migrateData(structuredClone(migrated)),migrated);assert.deepEqual(Fixture.migrateData({known:0}),{known:0});
});
