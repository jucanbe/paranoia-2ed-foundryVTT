const fs=require("node:fs"),assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const url=process.env.FOUNDRY_URL||"http://127.0.0.1:30001";
let browser;
(async()=>{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||"msedge"});
  const errors=[];
  async function login(name){const context=await browser.newContext(),page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));await page.goto(url);await page.locator('[name="username"]').fill(name);await page.getByRole("button",{name:/Join Game Session|Unirse a la partida/}).click();await page.waitForFunction(()=>globalThis.game?.ready);return page;}
  const gm=await login("Gamemaster");
  const setup=await gm.evaluate(async()=>{
    if(!game.world.id.startsWith("release-audit-")||!game.user.isGM)throw Error("Disposable validation world only");
    const pack=game.packs.get("paranoia-2-edition.skills"),docs=await pack.getDocuments();
    if(docs.length!==66||docs.some(d=>d.invalid||d.pages.size!==1))throw Error("Invalid reference pack");
    const strength=docs.find(d=>d.getFlag("paranoia-2-edition","referenceKey")==="attribute-strength");
    const imported=await game.journal.importFromCompendium(pack,strength.id);
    const batch=await pack.importAll({folderName:"Skill reference validation"});
    if(batch.length!==66||batch.some(d=>d.ownership.default!==2))throw Error("Batch public import failed");
    const folderIds=[...new Set(batch.map(d=>d.folder?.id).filter(Boolean))];
    return {count:docs.length,id:imported.id,default:imported.ownership.default,pageDefault:imported.pages.contents[0].ownership.default,batch:batch.map(d=>d.id),folderIds};
  });
  assert.equal(setup.default,2);assert.equal(setup.pageDefault,-1);
  const player=await login("Privacy Unrelated");
  const result=await player.evaluate(async setup=>{
    const pack=game.packs.get("paranoia-2-edition.skills"),doc=game.journal.get(setup.id);
    if(!pack.visible||!doc.testUserPermission(game.user,"OBSERVER")||doc.testUserPermission(game.user,"OWNER"))throw Error("Player read permissions failed");
    await doc.sheet.render(true);const text=doc.sheet.element.innerText;
    if(game.i18n.lang==="en"&&(!text.includes("What it is used for")||!text.includes("Measures physical strength")))throw Error("Imported English reference did not render");
    await doc.sheet.close();
    return {language:game.i18n.lang,packVisible:pack.visible,canRead:true,canEdit:false,text};
  },setup);
  await gm.evaluate(async setup=>{await JournalEntry.deleteDocuments([setup.id,...setup.batch]);for(const id of setup.folderIds){const folder=game.folders.get(id);if(folder)await folder.delete();}},setup);
  assert.deepEqual(errors,[]);
  fs.writeFileSync("dist/skill-reference-live.json",JSON.stringify({count:setup.count,batchCount:setup.batch.length,ownership:setup.default,pageOwnership:setup.pageDefault,player:result,errors},null,2));
  console.log(JSON.stringify({count:setup.count,batch:setup.batch.length,ownership:setup.default,player:result,errors},null,2));
  await browser.close();
})().catch(async error=>{console.error(error);await browser?.close();process.exitCode=1;});
