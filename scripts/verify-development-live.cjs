const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{
  const browser=await chromium.launch({headless:true,channel:"msedge"}),errors=[];
  const watch=p=>{p.on("pageerror",e=>errors.push(e.message));p.on("console",m=>{if(m.type()==="error")errors.push(m.text());});};
  async function join(page,name){await page.goto("http://localhost:30001",{waitUntil:"networkidle"});await page.locator('input[name="username"]').fill(name);await page.getByRole("button",{name:"Join Game Session",exact:true}).click();await page.waitForFunction(()=>globalThis.game?.ready,{},{timeout:30000});}
  try{
    const gm=await browser.newPage({viewport:{width:1600,height:1000}});watch(gm);await join(gm,"Gamemaster");
    const result=await gm.evaluate(async()=>{const m=await import('/systems/paranoia-2-edition/tests/development.live.mjs');return m.runDevelopmentChecks();});console.log(JSON.stringify(result));
    // Exercise the existing Final Report with an explicit failed mission and its independent default 4 PD.
    await gm.evaluate(()=>{import('/systems/paranoia-2-edition/module/treason/dialogs.mjs').then(m=>m.missionDialog()).catch(e=>console.error(e.message));});
    const report=gm.locator('form:has(button:has-text("Confirmar informe"))');await report.waitFor();for(const checkbox of await report.locator('input[name^="include"]').all())await checkbox.uncheck();
    const row=report.locator('tr').filter({hasText:"DEVELOP-R-TEST-2"}).last();await row.locator('input[name^="include"]').check();await row.locator('select[data-outcome]').selectOption("failure");
    if(await row.locator('input[name^="pd"][type="number"]').inputValue()!=="4")throw Error("Missing default 4 PD");await report.locator('input[name="missionId"]').fill(`ui-dev-${result.actorId}`);
    await gm.getByRole("button",{name:"Confirmar informe",exact:true}).click();await gm.getByRole("button",{name:"Ascender después",exact:true}).waitFor();await gm.getByRole("button",{name:"Ascender después",exact:true}).click();
    if(await gm.evaluate(id=>game.actors.get(id).system.development.available,result.actorId)!==8)throw Error("Failed mission UI did not award four PD");console.log("Final Report failure awards default 4 PD, independently from clearance");
    const owner=await browser.newPage({viewport:{width:1600,height:1000}});watch(owner);await join(owner,result.ownerName);
    console.log(JSON.stringify(await owner.evaluate(async id=>{const m=await import('/systems/paranoia-2-edition/tests/development.live.mjs');return m.checkDevelopmentPermissions(id,true);},result.actorId)));
    await owner.locator('.p2-development [data-development-operation="spend"]').click();
    const spend=owner.locator('form:has(button:has-text("Aplicar mejoras"))');await spend.waitFor();await spend.getByRole("spinbutton",{name:"Incremento Medicina",exact:true}).fill("3");
    if(!(await spend.locator('[data-development-summary]').innerText()).includes("Total: 3 PD"))throw Error("Advancement preview wrong");
    if(process.env.DEVELOPMENT_SCREENSHOT)await owner.screenshot({path:process.env.DEVELOPMENT_SCREENSHOT});await owner.getByRole("button",{name:"Aplicar mejoras",exact:true}).click();
    await owner.waitForFunction(id=>game.actors.get(id).system.skills.perception.medicine.value===25,result.actorId);
    if(await gm.evaluate(id=>game.actors.get(id).system.development.available,result.actorId)!==5)throw Error("Coordinated owner spend incorrect");console.log("Owner advancement UI, preview, coordinated atomic spend 22 to 25");
    await owner.close();
    const observer=await browser.newPage({viewport:{width:1600,height:1000}});watch(observer);try{await join(observer,result.observerName);console.log(JSON.stringify(await observer.evaluate(async id=>{const m=await import('/systems/paranoia-2-edition/tests/development.live.mjs');return m.checkDevelopmentPermissions(id,false);},result.actorId)));}finally{await observer.close();}
    console.log(JSON.stringify({pageErrors:errors}));if(errors.length)throw Error("Browser errors");
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
