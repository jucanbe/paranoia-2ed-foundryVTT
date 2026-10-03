import test from "node:test";
import assert from "node:assert/strict";
import {archiveClone,validateReplacement,nextCitizenId,revisionSource} from "../module/clones/rules.mjs";
const system={identity:{name:"DAVID",sector:"ARO"},securityClearance:"red",cloneNumber:1,credits:37,health:{status:"dead",notes:"Laser",treatmentNotes:""}};
const options={inventory:"standard",power:"keep",credits:37};
test("replacement validates terminal state, explicit living override and unbounded safe clone number",()=>{
  validateReplacement(system,options);
  assert.throws(()=>validateReplacement({...system,health:{status:"wounded"}},options));
  validateReplacement({...system,health:{status:"wounded"}},{...options,livingOverride:true});
  validateReplacement({...system,cloneNumber:100},options);
  assert.throws(()=>validateReplacement(system,{...options,credits:NaN}));
  assert.throws(()=>validateReplacement(system,{...options,power:"manual",powerName:" "}));
  assert.throws(()=>validateReplacement(system,{...options,inventory:"invented"}));
});
test("history is a compact audit, with previous-body and vaporized dispositions",()=>{
  const source={name:"DAVID-R-ARO-1",system,items:[{name:"Laser",type:"weapon",system:{quantity:1,assigned:true,description:"Do not copy"},flags:{"paranoia-2-edition":{catalogId:"laser-pistol"}}}]};
  const record=archiveClone(source,{...options,causeOfDeath:"Laser",gmNotes:"Hidden"},{timestamp:100,worldTime:20});
  assert.equal(record.credits,37);assert.equal(record.number,1);assert.equal(record.citizenId,source.name);
  assert.equal(record.equipmentDisposition,"leftWithPreviousBody");
  assert.equal(record.inventorySnapshot[0].catalogId,"laser-pistol");
  assert.equal(record.inventorySnapshot[0].description,undefined);
  assert.equal(archiveClone({...source,system:{...system,health:{status:"vaporized"}}},options).equipmentDisposition,"destroyed");
  assert.equal(archiveClone(source,{...options,inventory:"keep"}).equipmentDisposition,"retainedByGM");
});
test("preview delegates to the existing citizen ID helper",()=>{
  assert.equal(nextCitizenId({system,name:"DAVID-R-ARO-1"}),"DAVID-R-ARO-2");
  assert.equal(system.cloneNumber,1);
});
test("revision fingerprints ignore client-local timestamps but retain all gameplay state",()=>{
  assert.deepEqual(revisionSource({system,items:[{name:"A",_stats:{modifiedTime:1}}]}),revisionSource({items:[{_stats:{modifiedTime:null},name:"A"}],system}));
  assert.notDeepEqual(revisionSource({system}),revisionSource({system:{...system,credits:20}}));
});
