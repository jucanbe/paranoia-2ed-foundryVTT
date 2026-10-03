import {tr,trHTML} from "../i18n/index.mjs";
import {CloneService,cloneRevision} from "./service.mjs";
import {INVENTORY_POLICIES,POWER_POLICIES,isTerminal,nextCitizenId} from "./rules.mjs";
import {HEALTH_STATES} from "../health/rules.mjs";
const pending=new Set();
export async function activateClone(){
  const actor=this.actor;
  if(!game.user.isGM||pending.has(actor.uuid))return;
  pending.add(actor.uuid);
  try{
    const expected=await cloneRevision(actor);
    const content=await foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/clones/activate.hbs",{
      current:actor.name,next:nextCitizenId(actor),health:HEALTH_STATES[actor.system.health.status],
      living:!isTerminal(actor.system.health),credits:actor.system.credits,powerName:actor.system.mutantPower.name,
      inventoryOptions:Object.entries(INVENTORY_POLICIES).map(([value,label])=>({value,label})),
      powerOptions:Object.entries(POWER_POLICIES).map(([value,label])=>({value,label}))
    });
    let submitted;
    await foundry.applications.api.DialogV2.wait({window:{title:tr("Activar siguiente clon · DJ")},position:{width:520},content,buttons:[
      {action:"activate",label:tr("Activar clon"),callback:(_event,button)=>submitted??=Promise.resolve().then(async()=>{
        const f=button.form.elements;
        const options={expected,inventory:f.inventory.value,power:f.power.value,powerName:f.powerName.value,
          credits:f.credits.valueAsNumber,causeOfDeath:f.causeOfDeath.value,gmNotes:f.gmNotes.value,
          appearanceNotes:f.appearanceNotes.value,livingOverride:f.livingOverride?.checked===true,silent:f.silent.checked};
        const result=await CloneService.activateNextClone(actor,options);
        ui.notifications.info(trHTML`${result.name} está preparado para entrar en servicio.`);
      })},
      {action:"cancel",label:tr("Cancelar"),default:true}
    ]});
  }catch(error){ui.notifications.error(error.message);}finally{pending.delete(actor.uuid);}
}
export function cloneHistoryView(actor){
  const dispositions={destroyed:tr("Destruido con el cuerpo anterior"),retainedByGM:tr("Conservado por decisión del DJ"),leftWithPreviousBody:tr("Con el cuerpo anterior (sin contenedor de botín)")};
  return [...actor.system.clones.history].reverse().map(record=>{
    const {gmNotes,...row}=record;
    return {...row,gmNotes:game.user.isGM?gmNotes:"",healthLabel:HEALTH_STATES[row.deathType],
      dateLabel:new Date(row.timestamp).toLocaleString(),dispositionLabel:dispositions[row.equipmentDisposition]??row.equipmentDisposition};
  });
}
