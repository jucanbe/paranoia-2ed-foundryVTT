// Maintainer inspection helper: only use against an explicitly isolated local test server.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
(async()=>{
  const browser=await chromium.launch({headless:true,channel:"msedge"});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1000}});
    const errors=[];
    page.on("pageerror",e=>{errors.push(e.message);console.log("PAGE ERROR",e.message);});
    page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.goto("http://localhost:30001",{waitUntil:"networkidle"});
    await page.locator("button").first().waitFor({timeout:20000});
    if(await page.locator('.tour [data-action="exit"]').count())await page.locator('.tour [data-action="exit"]').click();
    if(["login","verify"].includes(process.argv[2])){
      if(await page.getByRole("button",{name:"Login as User",exact:true}).count())await page.getByRole("button",{name:"Login as User",exact:true}).click();
      else if(await page.getByRole("button",{name:"Save and Continue",exact:true}).count())await page.getByRole("button",{name:"Save and Continue",exact:true}).click();
      if(await page.locator('input[name="username"]').count()){
        await page.locator('input[name="username"]').fill("Gamemaster");
        await page.getByRole("button",{name:"Join Game Session",exact:true}).click();
      }
      await page.waitForFunction(()=>globalThis.game?.ready,{},{timeout:30000});
      if(process.argv[2]==="verify"){
        const result=await page.evaluate(async()=>{
          const pack=game.packs.get("paranoia-2-edition.societies");
          if(game.world.id!=="society-fresh-validation")throw Error("Requires the isolated validation World");
          if(!pack)throw Error("Pack absent from fresh World");
          const index=await pack.getIndex(),docs=await pack.getDocuments();
          if(index.size!==16||docs.length!==16)throw Error("Pack count must equal 16");
          for(const journal of docs){
            if(journal.pages.size!==1)throw Error(`Missing page: ${journal.name}`);
            const content=journal.pages.contents[0].text.content;
            if(!content.includes("Estructura")||!content.includes("Jerarquía"))throw Error(`Incomplete content: ${journal.name}`);
          }
          const church=docs.find(d=>d.getFlag("paranoia-2-edition","societyKey")==="firstChurchChristProgrammer");
          globalThis.societyTestSheet=church.sheet;
          await church.sheet.render(true);
          return {version:game.version,pack:pack.collection,count:docs.length,names:docs.map(d=>d.name),gmNotes:church.pages.contents[0].text.content.includes("infiltración significativa"),modules:game.modules.filter(m=>m.active).length};
        });
        console.log(JSON.stringify(result,null,2));
        await page.locator('.p2-society-reference').waitFor();
        if(process.env.SOCIETY_SCREENSHOT)await page.screenshot({path:process.env.SOCIETY_SCREENSHOT});
        const journals=await page.evaluate(()=>game.packs.get("paranoia-2-edition.societies").index.map(j=>({id:j._id,name:j.name})));
        for(const journal of journals){
          await page.evaluate(async id=>{
            await globalThis.societyTestSheet?.close();
            globalThis.societyTestSheet=(await game.packs.get("paranoia-2-edition.societies").getDocument(id)).sheet;
            await globalThis.societyTestSheet.render(true);
          },journal.id);
          await page.locator('.p2-society-reference').waitFor();
          if(!(await page.locator('.p2-society-reference').innerText()).includes("Resumen"))throw Error(`Journal did not render: ${journal.name}`);
        }
        console.log("All 16 Journal sheets opened and rendered");
        const integration=await page.evaluate(async()=>{
          const tests=await import('/systems/paranoia-2-edition/tests/societies.live.mjs');
          return tests.runSocietyIntegrationChecks();
        });
        console.log(JSON.stringify(integration,null,2));
        for(const [name,isOwner] of [[integration.ownerName,true],[integration.observerName,false]]){
          const playerPage=await browser.newPage({viewport:{width:1600,height:1000}});
          playerPage.on("pageerror",e=>errors.push(e.message));
          playerPage.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
          try{
            await playerPage.goto("http://localhost:30001");
            await playerPage.locator('input[name="username"]').fill(name);
            await playerPage.getByRole("button",{name:"Join Game Session",exact:true}).click();
            await playerPage.waitForFunction(()=>globalThis.game?.ready);
            const permissions=await playerPage.evaluate(async({actorId,npcId,isOwner})=>{
              const tests=await import('/systems/paranoia-2-edition/tests/societies.live.mjs');
              return tests.checkPlayerViews(actorId,npcId,isOwner);
            },{actorId:integration.actorId,npcId:integration.npcId,isOwner});
            console.log(JSON.stringify(permissions));
          }finally{await playerPage.close();}
        }
        console.log(JSON.stringify({pageErrors:errors}));
        if(errors.length)throw Error("Browser page errors occurred");
        return;
      }
    }
    if(process.argv[2]?.startsWith("create")){
      await page.getByRole("button",{name:"Create World",exact:true}).click();
      await page.locator('input[name="title"]').waitFor();
      if(process.argv[2]==="create-save"){
        await page.getByRole("heading",{name:"Paranoia 2nd Edition",exact:true}).click();
        await page.locator('input[name="title"]').fill("Society fresh install validation");
        await page.locator('input[name="world-id"]').fill("society-fresh-validation");
        await page.getByRole("button",{name:"Continue",exact:true}).click();
        await page.locator('#world-create input[name="title"]').waitFor({state:"hidden"});
      }
    }
    console.log(await page.locator("body").innerText());
    console.log(await page.locator("form").evaluateAll(forms=>forms.map(f=>f.outerHTML)));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
