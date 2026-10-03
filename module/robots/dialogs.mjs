import {tr,trHTML} from "../i18n/index.mjs";
import {ITEM_SKILLS} from "../items/config.mjs";
import {DIFFICULTIES} from "../rolls/rules.mjs";
import {repairRobot,confirmRepair,swapCard,robotGM} from "./service.mjs";
import {isMechanicalActor} from "../actors/types.mjs";
export async function repairDialog(actor){
  robotGM(actor);const content=await foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/robots/repair.hbs",{
    repairers:game.actors.filter(isMechanicalActor).map(a=>({id:a.id,name:a.name})),skills:ITEM_SKILLS,difficulties:Object.entries(DIFFICULTIES).map(([key,d])=>({key,label:d.label}))});
  let pending;
  return foundry.applications.api.DialogV2.wait({window:{title:tr("Reparar robot · adjudicación del DJ")},content,buttons:[{action:"roll",label:tr("Tirar habilidad"),callback:(_e,b)=>pending??=(async()=>{
    const f=b.form.elements;try{const r=await repairRobot(actor,{repairer:game.actors.get(f.repairer.value),key:f.skill.value,difficulty:f.difficulty.value,modifier:f.modifier.value});
    if(await foundry.applications.api.DialogV2.confirm({window:{title:tr("Adjudicar reparación")},content:trHTML`<p>${r.roll.success?tr("Éxito"):tr("Fallo")}. El DJ decide si la reparación permite avanzar un estado. ¿Aplicar reparación?</p>`}))await confirmRepair(actor,r.expected);
    }catch(e){ui.notifications.error(e.message);}
  })()},{action:"cancel",label:tr("Cancelar")}]});
}
export async function swapDialog(actor){
  const cards=actor.items.filter(i=>i.type==="robotProgram"&&i.system.storageMode==="card");
  const escape=foundry.utils.escapeHTML;
  const opts=cards.map(i=>`<option value="${i.id}">${escape(i.name)}</option>`).join("");let pending;
  return foundry.applications.api.DialogV2.wait({window:{title:tr("Cambiar tarjeta")},content:trHTML`<p>Robomecánico en combate: tres turnos; primero se retira la tarjeta actual.</p><label>Retirar<select name="from"><option value="">Ninguna</option>${opts}</select></label><label>Insertar<select name="to">${opts}</select></label>`,buttons:[{action:"swap",label:tr("Cambiar"),callback:(_e,b)=>pending??=swapCard(actor,b.form.elements.from.value,b.form.elements.to.value).catch(e=>ui.notifications.error(e.message))},{action:"cancel",label:tr("Cancelar")}]});
}
