import test from "node:test";
import assert from "node:assert/strict";
import {SKILL_REFERENCES,skillReferenceHTML} from "../module/references/skills.mjs";
import {LABELS} from "../module/sheets/labels.mjs";
import {preparePublicSkillImport} from "../module/references/register.mjs";

test("reference pack covers every existing attribute and skill without duplicate keys",()=>{
  const fields=SKILL_REFERENCES.filter(e=>e.field).map(e=>e.field);
  for(const attribute of Object.keys(LABELS.attributeNames))assert.ok(fields.includes(`attributes.${attribute}`));
  for(const [group,skills] of Object.entries(LABELS.skillNames))for(const key of Object.keys(skills))assert.ok(fields.includes(`skills.${group}.${key}`));
  assert.equal(new Set(SKILL_REFERENCES.map(e=>e.key)).size,SKILL_REFERENCES.length);
  assert.equal(SKILL_REFERENCES.length,66);
  for(const entry of SKILL_REFERENCES){assert.ok(entry.description&&entry.englishDescription&&entry.page);assert.ok(skillReferenceHTML(entry).includes(entry.description));}
});

test("a native import defaults to Observer while preserving the importing user's ownership",()=>{
  const data={_stats:{compendiumSource:"Compendium.paranoia-2-edition.skills.JournalEntry.abc"},flags:{"paranoia-2-edition":{referencePack:"skills"}},ownership:{default:0,gm:3},pages:[{_id:"page",ownership:{default:0}}]};
  let result;preparePublicSkillImport({updateSource:changes=>result=changes},data);
  assert.deepEqual(result.ownership,{default:2,gm:3});assert.equal(result.pages[0].ownership.default,-1);
  assert.equal(data.ownership.default,0); // Input is not silently mutated.
});

test("public default applies only to world imports from this reference pack",()=>{
  let edits=0;const doc={updateSource:()=>edits++};
  for(const data of [{},{flags:{"paranoia-2-edition":{referencePack:"skills"}}},{_stats:{compendiumSource:"Compendium.paranoia-2-edition.societies.JournalEntry.abc"},flags:{"paranoia-2-edition":{referencePack:"skills"}}}])preparePublicSkillImport(doc,data);
  preparePublicSkillImport({...doc,pack:"paranoia-2-edition.skills"},{_stats:{compendiumSource:"Compendium.paranoia-2-edition.skills.JournalEntry.abc"},flags:{"paranoia-2-edition":{referencePack:"skills"}}});
  assert.equal(edits,0);
});
