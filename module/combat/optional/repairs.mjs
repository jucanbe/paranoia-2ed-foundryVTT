import {staticMarkup} from "../../i18n/index.mjs";
import {tr,trHTML} from "../../i18n/index.mjs";
import {enabled} from "./settings.mjs";
import {rollCheck} from "../../rolls/service.mjs";
import {ITEM_SKILLS} from "../../items/config.mjs";
import {requestCombat} from "../requests.mjs";
export async function repairWeapon(weapon,{skill,prevent=false,override=false}={}){
  if(!weapon?.parent?.testUserPermission(game.user,"OWNER"))throw Error(tr("No controlas esta arma."));
  if(game.user.id!==game.users.activeGM?.id)return requestCombat(null,"weaponRepair",{weaponUuid:weapon.uuid,skill,prevent,override:game.user.isGM&&override});
  return executeWeaponRepair(weapon,{skill,prevent,override},game.user);
}
export async function executeWeaponRepair(weapon,{skill,prevent=false,override=false}={},user=game.user){
  if(!enabled("repairs")||!game.user.isGM||!weapon?.parent||!weapon.system.malfunctioned||!weapon.parent.testUserPermission(user,"OWNER")||(!user.isGM&&weapon.parent.type==="npc"))throw Error(tr("Reparación no disponible o sin permiso."));
  if(!user.isGM&&(override||!weapon.system.repairSkill))throw Error(tr("El DJ debe elegir la habilidad pertinente; las excepciones solo las autoriza el DJ."));
  if(!prevent&&(weapon.system.reliabilityType==="trulyExperimental"||!weapon.system.repairable)&&!override)throw Error(tr("Esta arma no admite reparación normal; el DJ puede autorizar una excepción."));
  const key=weapon.system.repairSkill||skill;if(!ITEM_SKILLS.some(s=>s.key===key))throw Error(tr("El DJ debe elegir una habilidad pertinente."));
  const result=await rollCheck({actor:weapon.parent,type:"skill",key});
  if(result.success&&!prevent&&!await weapon.update({"system.malfunctioned":false},{paranoiaOptionalCombat:true}))throw Error(tr("No se guardó la reparación."));
  if(prevent)ui.notifications.info(result.success?tr("Prueba lograda: el DJ puede evitar la consecuencia. El arma sigue averiada y necesita otra prueba de reparación."):tr("No se evita la consecuencia mediante esta prueba."));return result;
}
export async function repairDialog(weapon,prevent=false){
  if(!enabled("repairs")||!weapon?.parent?.isOwner)return;
  if(!game.user.isGM&&!weapon.system.repairSkill)throw Error(tr("El DJ debe configurar una habilidad de reparación pertinente para esta arma."));
  const escape=foundry.utils.escapeHTML,values=await foundry.applications.api.DialogV2.wait({window:{title:prevent?tr("Intentar evitar avería"):tr("Reparar arma")},content:trHTML`<p>${escape(weapon.name)} · ${escape(weapon.system.specialRules)}</p><label>Habilidad pertinente<select name="skill">${ITEM_SKILLS.map(s=>`<option value="${s.key}" ${s.key===weapon.system.repairSkill?"selected":""}>${escape(s.label)}</option>`).join("")}</select></label>${!prevent&&game.user.isGM?staticMarkup('<label><input name="override" type="checkbox"> Excepción del DJ: permitir reparación no normal</label>'):""}`,buttons:[{action:"roll",label:tr("Tirar habilidad"),callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},{action:"cancel",label:tr("Cancelar")}]});
  if(values?.skill)return repairWeapon(weapon,{skill:values.skill,prevent,override:!!values.override});
}
export function registerRepairs(){Hooks.on("renderChatMessageHTML",(message,html)=>{
  for(const button of html.querySelectorAll('[data-action="preventMalfunction"],[data-action="repairWeapon"]')){
    const trusted=message.author?.isGM&&(message.getFlag("paranoia-2-edition","attack")?.weapon===button.dataset.weapon||message.getFlag("paranoia-2-edition","burstAttack")?.weapon===button.dataset.weapon);
    let weapon;try{if(trusted)weapon=fromUuidSync(button.dataset.weapon);}catch{/* Deleted or malformed references do not break chat rendering. */}
    if(!trusted||!enabled("repairs")||!weapon?.parent?.isOwner){button.remove();continue;}
    button.addEventListener("click",async()=>{button.disabled=true;try{await repairDialog(await fromUuid(button.dataset.weapon),button.dataset.action==="preventMalfunction");}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});
  }
});}
