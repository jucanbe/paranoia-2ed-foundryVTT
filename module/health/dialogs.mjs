import {tr} from "../i18n/index.mjs";
import {HEALTH_STATES,DAMAGE_RESULTS,hourlyDue} from "./rules.mjs";
import {requireGM,applyHealthResult,recoverStun,applyTreatment,markTreated,setHealthStatus,checkUntreated,hourlySurvival} from "./service.mjs";
import {openDamageDialog} from "../damage/dialogs.mjs";
import {woundDialog} from "../combat/optional/wounds.mjs";
const pending=new Set();
const confirm=content=>foundry.applications.api.DialogV2.confirm({window:{title:tr("Estado de salud · DJ")},content:`<p>${content}</p>`,yes:{label:tr("Continuar")},no:{label:tr("Cancelar")}});
async function selectValue(title,values,callback){
  const content=await foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/health/select.hbs",{options:Object.entries(values).map(([value,label])=>({value,label}))});
  let submitted;
  return foundry.applications.api.DialogV2.wait({window:{title},content,buttons:[
    {action:"apply",label:tr("Aplicar (DJ)"),default:true,callback:(_e,b)=>submitted??=Promise.resolve().then(()=>callback(b.form.elements.value.value,b.form.elements.notes.value))},
    {action:"cancel",label:tr("Cancelar")}
  ]});
}
export async function healthAction(event,button){
  const actor=this.actor;const action=button.dataset.healthAction;
  if(pending.has(actor.uuid))return;pending.add(actor.uuid);
  try{
    requireGM(actor);
    if(action==="location")await woundDialog(actor);
    else if(action==="damage")await openDamageDialog(actor);
    else if(action==="result")await selectValue(tr("Aplicar resultado de daño (DJ)"),DAMAGE_RESULTS,value=>applyHealthResult(actor,value,{manual:true}));
    else if(action==="state")await selectValue(tr("Corregir estado · Excepción explícita del DJ"),HEALTH_STATES,value=>setHealthStatus(actor,value));
    else if(action==="stun")await recoverStun(actor);
    else if(action==="treat")await selectValue(tr("Aplicar tratamiento autorizado por el DJ"),{treat:tr("Incapacitado → Herido / Herido → Sano")},(_v,notes)=>applyTreatment(actor,notes));
    else if(action==="mark")await selectValue(tr("Registrar atención médica"),{mark:tr("Marcar tratamiento recibido (sin cambiar estado)")},(_v,notes)=>markTreated(actor,notes));
    else if(action==="day")await checkUntreated(actor);
    else if(action==="hour"){
      if(!hourlyDue(actor.system.health,game.time.worldTime)&&!await confirm(tr("No consta una hora transcurrida desde la última revisión. ¿Realizar la prueba por decisión del DJ?")))return;
      const result=await hourlySurvival(actor);
      if(!result.success&&await confirm(tr("La prueba de Resistencia ha fallado. ¿Aplicar Muerto al clon actual?")))await applyHealthResult(actor,"dead");
    }
  }catch(error){ui.notifications.error(error.message);}finally{pending.delete(actor.uuid);}
}
export async function toggleArmor(event,button){
  if(!this.isEditable)return;
  const item=this.actor.items.get(button.closest("[data-item-id]")?.dataset.itemId);
  if(item?.type==="armor")await item.update({"system.equipped":!item.system.equipped});
}
