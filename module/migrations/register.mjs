import {tr,trHTML} from "../i18n/index.mjs";
const NS="paranoia-2-edition";
export const DATA_VERSION=1;
let running;
/** GM-only backup precedes writes. Failed documents remain eligible for retry. */
export function migrateWorld(){
  if(game.user.id!==game.users.activeGM?.id)return Promise.resolve({skipped:true});
  if(running)return running;
  running=run().finally(()=>{running=undefined;});return running;
}
async function run(){
  const documents=[...game.actors,...game.items].filter(d=>(d.getFlag(NS,"dataVersion")??0)<DATA_VERSION);
  const failures=[],migrated=[];
  if(documents.length){
    const backup={version:DATA_VERSION,timestamp:Date.now(),documents:documents.map(d=>d.toObject())};
    await foundry.documents.JournalEntry.create({name:trHTML`Respaldo de migración · ${new Date().toISOString()}`,ownership:{default:0},flags:{[NS]:{migrationBackup:DATA_VERSION}},pages:[{name:tr("Datos anteriores"),type:"text",text:{format:1,content:`<pre>${foundry.utils.escapeHTML(JSON.stringify(backup,null,2))}</pre>`}}]});
  }
  for(const document of documents)try{
    const system=foundry.utils.mergeObject(document._source.system,document.system.toObject(),{inplace:false});
    // No balance/history reconstruction and no mutation of embedded Item identity.
    const items=document.documentName==="Actor"?document.items.map(item=>({...item.toObject(),system:foundry.utils.mergeObject(item._source.system,item.system.toObject(),{inplace:false}),flags:foundry.utils.mergeObject(item.flags,{[NS]:{dataVersion:DATA_VERSION}},{inplace:false})})):undefined;
    await document.update({system,...(items?{items}:{}),[`flags.${NS}.dataVersion`]:DATA_VERSION},{paranoiaCreditTransaction:true});
    migrated.push(document.uuid);
  }catch(error){failures.push(document.uuid);console.error(`${NS} | Migration failed: ${document.uuid}`,error);}
  if(!failures.length)await game.settings.set(NS,"dataVersion",DATA_VERSION);
  else ui.notifications.error(tr("Migración incompleta. Se conserva el respaldo privado del DJ; consulta la consola y vuelve a intentarlo."));
  const result={version:DATA_VERSION,migrated,failures};console.info(`${NS} | Migration`,result);return result;
}
export function registerMigrations(){
  game.settings.register(NS,"dataVersion",{scope:"world",config:false,type:Number,default:0});
  game.paranoia=Object.freeze({...game.paranoia,MigrationService:Object.freeze({migrateWorld,version:DATA_VERSION})});
  Hooks.once("ready",()=>{if(game.settings.get(NS,"dataVersion")<DATA_VERSION)migrateWorld().catch(error=>{console.error(`${NS} | Migration`,error);ui.notifications.error(tr("No se pudo completar la migración. Los datos originales se conservan."));});});
}
