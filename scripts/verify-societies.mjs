import {createRequire} from "node:module";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {SOCIETY_REGISTRY,validateSocietyRegistry} from "../module/societies/registry.mjs";
import {societyReferenceHTML} from "../module/societies/reference.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),".."),app=process.env.FOUNDRY_APP;
if(!app)throw Error("Set FOUNDRY_APP to the installed Foundry resources/app directory.");
const {ClassicLevel}=createRequire(resolve(app,"package.json"))("classic-level");
const stable=value=>createHash("sha256").update(`paranoia-2-edition:${value}`).digest("hex").slice(0,16);
const db=new ClassicLevel(resolve(process.env.SOCIETY_PACK_OUTPUT??resolve(root,"packs/societies")),{keyEncoding:"utf8",valueEncoding:"json",readOnly:true});
validateSocietyRegistry();
try{
  await db.open();
  const journals=db.sublevel("journal",{valueEncoding:"json"}),pages=db.sublevel("journal.pages",{valueEncoding:"json"});
  assert.equal((await journals.keys().all()).length,16);assert.equal((await pages.keys().all()).length,16);
  for(const society of Object.values(SOCIETY_REGISTRY)){
    const catalogId=`society-${society.key}`,journalId=stable(catalogId),pageId=stable(`${catalogId}:reference`);
    const journal=await journals.get(journalId),page=await pages.get(`${journalId}.${pageId}`);
    assert.equal(journal.name,society.displayName);assert.equal(journal.flags["paranoia-2-edition"].societyKey,society.key);
    assert.deepEqual(journal.pages,[pageId]);assert.equal(journal.ownership.default,0);assert.equal(page.ownership.default,0);
    assert.equal(page.type,"text");assert.equal(page.text.content,societyReferenceHTML(society,{isGM:true,includeTitle:false}));
  }
  const manifest=(await import("node:fs/promises")).readFile;
  const system=JSON.parse(await manifest(resolve(root,"system.json"),"utf8")),pack=system.packs.find(p=>p.name==="societies");
  assert.equal(pack.path,"packs/societies");assert.equal(pack.type,"JournalEntry");
  for(const role of ["PLAYER","TRUSTED","ASSISTANT"])assert.equal(pack.ownership[role],"NONE");
  console.log("Verified installed pack: 16 stable Journals + 16 pages, exact canonical content, valid relationships and GM-only permissions.");
}finally{await db.close();}
