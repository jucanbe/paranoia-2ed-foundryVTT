import {tr,trHTML} from "../i18n/index.mjs";
import {isMechanicalActor as isRulesActor} from "../actors/types.mjs";
import {DamageService} from "../damage/service.mjs";
import {DAMAGE_RESULTS} from "../health/rules.mjs";
import {requestCombat} from "./requests.mjs";
const NS="paranoia-2-edition";
const pending=new Set();
export async function resolveBurstDamage(message,index,options={}){
  if(!game.user.isGM||!message.author?.isGM)throw Error(tr("Requiere DJ."));
  const data=message.getFlag(NS,"burstAttack"),shot=data?.shots?.[index];if(!shot)throw Error(tr("Objetivo de ráfaga desconocido."));
  const adapter={id:`${message.id}:${index}`,author:message.author,rolls:[],getFlag:()=>shot,update:async changes=>{
    Object.assign(shot,changes[`flags.${NS}.attack`]);data.shots[index]=shot;
    const content=await foundry.applications.handlebars.renderTemplate(`systems/${NS}/templates/combat/burst-chat.hbs`,data);
    await message.update({content:content+(await Promise.all(message.rolls.map(r=>r.render()))).join(""),[`flags.${NS}.burstAttack`]:data},{notify:false});
  }};
  return resolveAttackDamage(adapter,options);
}
async function updateCard(message,data){
  const content=await foundry.applications.handlebars.renderTemplate(`systems/${NS}/templates/combat/attack-chat.hbs`,{
    ...data,outcome:data.hit?tr("IMPACTO"):tr("FALLO"),specialLabel:data.specialLabel??""});
  await message.update({content:content+(await Promise.all(message.rolls.map(r=>r.render()))).join(""),[`flags.${NS}.attack`]:data},{notify:false});
}
/** Executed on the coordinator, after the attack is reserved and its native roll posted. */
export async function resolveAttackDamage(message,options={}){
  if(!game.user.isGM||!message?.author?.isGM)throw Error(tr("Mensaje de ataque no válido o sin autorización del DJ."));
  const data=message.getFlag(NS,"attack");
  if(!data?.hit||!data.damagePending)return {resolved:false,messageId:data?.damageMessageId};
  if(pending.has(message.id))throw Error(tr("El daño ya se está resolviendo."));
  pending.add(message.id);
  try{
    const existing=game.messages.find(m=>m.author?.isGM&&m.getFlag(NS,"damage")?.sourceAttackId===message.id);
    if(existing){
      data.damagePending=false;data.damageMessageId=existing.id;data.damageStatus=tr("Consulta la tarjeta de daño existente");
      await updateCard(message,data);return {messageId:existing.id,resolved:existing.getFlag(NS,"damage").resolved};
    }
    if(options.automatic&&(data.area||data.damageNumber==null))return {pending:true};
    const attacker=await fromUuid(data.attacker),weapon=await fromUuid(data.weapon);
    const target=await fromUuid(options.targetUuid||data.target||"");
    if(options.automatic&&(target?.system.vehicle?.defense.smallArmsProtection||game.actors.some(a=>a.type==="vehicle"&&a.system.vehicle.crew.some(p=>p.actorUuid===target?.uuid||p.actorUuid===data.targetToken))))return {pending:true};
    if(!isRulesActor(target))throw Error(tr("Selecciona un objetivo para la adjudicación del DJ."));
    if(!options.targetUuid&&data.targetCloneNumber!=null&&target.system.cloneNumber!==data.targetCloneNumber)throw Error(tr("El clon objetivo cambió; no se aplica daño al reemplazo."));
    const result=await DamageService.resolveDamage({attacker,target,weapon,sourceAttackId:message.id,
      baseDamageNumber:options.baseDamageNumber??data.damageNumber,category:data.weaponCategory,protectionVehicle:options.protectionVehicle?await fromUuid(options.protectionVehicle):null,
      manualOnly:!!options.manualResult,manualResult:options.manualResult||undefined,
      messageMode:data.messageMode??game.settings.get("core","messageMode")});
    data.damagePending=false;data.damageMessageId=result.message?.id;
    data.damageStatus=result.applied?tr("Daño resuelto"):tr("Daño calculado · resultado pendiente del DJ en la tarjeta de daño");
    await updateCard(message,data);
    return {resolved:result.applied,messageId:result.message?.id};
  }catch(error){
    data.damageStatus=trHTML`Impacto confirmado · ${error.message}`;
    await updateCard(message,data);
    if(!options.automatic)throw error;
    return {pending:true,error:error.message};
  }finally{pending.delete(message.id);}
}
export async function attackDamageDialog(message){
  if(!game.user.isGM)return;
  const data=message.getFlag(NS,"attack");if(!data?.damagePending)return;
  const content=await foundry.applications.handlebars.renderTemplate(`systems/${NS}/templates/combat/damage.hbs`,{
    weapon:data.weaponName,status:data.damageStatus,base:data.damageNumber,vehicles:game.actors.filter(a=>a.type==="vehicle").map(a=>({uuid:a.uuid,name:a.name})),
    targets:game.actors.filter(a=>isRulesActor(a)).map(a=>({uuid:a.uuid,name:a.name,selected:a.uuid===data.target})),
    results:Object.entries(DAMAGE_RESULTS).map(([value,label])=>({value,label})),area:data.area});
  let submitted;
  return foundry.applications.api.DialogV2.wait({window:{title:tr("Resolver daño del impacto · DJ")},content,buttons:[
    {action:"resolve",label:tr("Resolver daño"),callback:(_e,b)=>submitted??=Promise.resolve().then(async()=>{
      const f=b.form.elements;
      try{return await requestCombat(null,"damage",{messageId:message.id,
        targetUuid:data.area?f.target.value:undefined,manualResult:f.result.value,protectionVehicle:f.protectionVehicle?.value||undefined,
        baseDamageNumber:f.base.value.trim()?f.base.valueAsNumber:undefined});}
      catch(error){ui.notifications.error(error.message);}
    })},{action:"cancel",label:tr("Dejar pendiente"),default:true}
  ]});
}
export function registerAttackDamage(){
  Hooks.on("renderChatMessageHTML",(message,html)=>{
    for(const button of html.querySelectorAll('[data-action="resolveBurstDamage"]')){
      if(!game.user.isGM){button.remove();continue;}
      button.addEventListener("click",async()=>{button.disabled=true;try{
        const index=Number(button.dataset.shot),shot=message.getFlag(NS,"burstAttack")?.shots[index];
        const values=await foundry.applications.api.DialogV2.wait({window:{title:tr("Daño de ráfaga · DJ")},content:trHTML`<label>ND manual<input name="base" type="number" value="${shot.damageNumber??""}"></label><label>Resultado manual<select name="result"><option value="">Calcular</option>${Object.entries(DAMAGE_RESULTS).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select></label>`,buttons:[{action:"resolve",label:tr("Resolver"),callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},{action:"cancel",label:tr("Cancelar")}]});
        if(values?.result!==undefined)await resolveBurstDamage(message,index,{baseDamageNumber:values.base===""?undefined:Number(values.base),manualResult:values.result||undefined});
      }catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});
    }
    for(const button of html.querySelectorAll('[data-action="resolveAttackDamage"]')){
      if(!game.user.isGM){button.remove();continue;}
      button.addEventListener("click",async()=>{button.disabled=true;try{await attackDamageDialog(message);}finally{button.disabled=false;}});
    }
  });
}
