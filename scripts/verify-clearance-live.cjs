// Development harness, restricted to the disposable local validation World.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{
  const browser=await chromium.launch({headless:true,channel:"msedge"}),errors=[];
  const watch=page=>{page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});};
  async function join(page,name){
    await page.goto("http://localhost:30001",{waitUntil:"networkidle"});
    await page.locator('input[name="username"]').fill(name);await page.getByRole("button",{name:"Join Game Session",exact:true}).click();
    await page.waitForFunction(()=>globalThis.game?.ready,{},{timeout:30000});
  }
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}});watch(page);await join(page,"Gamemaster");
    const result=await page.evaluate(async()=>{const m=await import('/systems/paranoia-2-edition/tests/clearance.live.mjs');return m.runClearanceChecks();});console.log(JSON.stringify(result));
    if(process.env.CLEARANCE_SCREENSHOT)await page.screenshot({path:process.env.CLEARANCE_SCREENSHOT});
    // Test the real Final Report form through the UI, with only our disposable actor selected.
    await page.evaluate(()=>{import('/systems/paranoia-2-edition/module/treason/dialogs.mjs').then(m=>m.missionDialog()).catch(e=>console.error(e.message));});
    await page.getByRole("button",{name:"Confirmar informe",exact:true}).waitFor();
    const table=page.locator('form:has(button:has-text("Confirmar informe"))');
    for(const checkbox of await table.locator('input[name^="include"]').all())await checkbox.uncheck();
    const target=table.locator("tr").filter({hasText:"DAVID-R-ARO-2"}).last();
    await target.locator('input[name^="include"]').check();await target.locator('select[data-outcome]').selectOption("success");
    await target.locator('input[name^="survivor"]').check();await target.locator('input[name^="count"]').check();
    await table.locator('input[name="missionId"]').fill(`ui-${result.actorId}`);
    await page.getByRole("button",{name:"Confirmar informe",exact:true}).click();await page.getByRole("button",{name:"Ascender después",exact:true}).waitFor();await page.getByRole("button",{name:"Ascender después",exact:true}).click();
    const uiCount=await page.evaluate(id=>game.actors.get(id).system.securityProgress.successfulMissions,result.actorId);if(uiCount!==1)throw Error("Final Report UI did not persist progress");console.log("Final Report UI success, PT independent, promotion postponed");
    await page.locator('.p2-clearance [data-clearance-operation="promote"]').click();
    const promotion=page.locator('form:has(button:has-text("Ascender ciudadano"))');await promotion.locator('input[name="reason"]').fill("Promotion UI verification");await promotion.getByRole("button",{name:"Ascender ciudadano",exact:true}).click();
    await page.waitForFunction(id=>game.actors.get(id).system.securityClearance==="orange",result.actorId);
    await page.locator('.p2-clearance [data-clearance-operation="history"]').click();await page.getByText("Historial privado de CS",{exact:true}).waitFor();
    if(!(await page.locator('form:has(button:has-text("Cerrar / reanudar"))').innerText()).includes("Promotion UI verification"))throw Error("History UI missing promotion");await page.getByRole("button",{name:"Cerrar / reanudar",exact:true}).click();console.log("Promotion confirmation and private history UI rendered");
    for(const [name,isOwner] of [[result.ownerName,true],[result.observerName,false]]){
      const p=await browser.newPage({viewport:{width:1600,height:1000}});watch(p);
      try{await join(p,name);console.log(JSON.stringify(await p.evaluate(async({id,isOwner})=>{const m=await import('/systems/paranoia-2-edition/tests/clearance.live.mjs');return m.checkClearancePermissions(id,isOwner);},{id:result.actorId,isOwner})));}finally{await p.close();}
    }
    await page.evaluate(()=>game.settings.set("paranoia-2-edition","showPromotionProgressToPlayers",false));
    const p=await browser.newPage({viewport:{width:1600,height:1000}});watch(p);try{await join(p,result.ownerName);if(await p.evaluate(id=>!!game.paranoia.SecurityClearanceService.getPromotionRequirements(game.actors.get(id)),result.actorId))throw Error("Hidden progress setting ignored");}finally{await p.close();}
    console.log(JSON.stringify({hiddenProgressSetting:true,pageErrors:errors}));if(errors.length)throw Error("Browser errors");
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
