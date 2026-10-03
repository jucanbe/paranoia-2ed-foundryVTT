import {tr} from "../i18n/index.mjs";
import {isMechanicalActor as isRulesActor} from "../actors/types.mjs";
import {DamageService} from "./service.mjs";
import {DAMAGE_RESULTS} from "../health/rules.mjs";
import {requireGM} from "../health/service.mjs";
import {WEAPON_CATEGORIES} from "../items/config.mjs";
import {ROBOT_RESULTS} from "../robots/rules.mjs";
import {VEHICLE_RESULTS} from "../vehicles/rules.mjs";
const pending=new Set();
export async function chooseDamageResult(result){
  requireGM(result.target);
  if(result.applied||pending.has(result.id))return;
  pending.add(result.id);
  try{
    const automatic=result.automaticResult;
    const labels=result.target.type==="vehicle"?VEHICLE_RESULTS:result.target.type==="robot"?ROBOT_RESULTS:DAMAGE_RESULTS;
    const content=await foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/damage/result.hbs",{
      targetName:result.target.name,number:result.finalDamageNumber,die:result.dieResult,automatic:automatic?labels[automatic]:null,
      results:Object.entries(labels).map(([value,label])=>({value,label}))});
    return await foundry.applications.api.DialogV2.wait({window:{title:tr("Resultado de daño")},content,buttons:[
      {action:"apply",label:tr("Aplicar resultado"),default:true,callback:async(_e,b)=>{
        const value=b.form.elements.result.value;
        try{return await DamageService.applyResolution(result,{manualResult:value||undefined});}catch(error){ui.notifications.error(error.message);}
      }},{action:"cancel",label:tr("Dejar pendiente")}
    ]});
  }finally{pending.delete(result.id);}
}
export async function openDamageDialog(target){
  requireGM(target);
  const key=`dialog:${target.uuid}`;if(pending.has(key))return;pending.add(key);
  try{
    const weapons=game.actors.filter(a=>isRulesActor(a)).flatMap(a=>a.items.filter(i=>i.type==="weapon").map(i=>({uuid:i.uuid,label:`${a.name} · ${i.name}`})));
    const content=await foundry.applications.handlebars.renderTemplate("systems/paranoia-2-edition/templates/damage/input.hbs",{
      targetName:target.name,weapons,vehicles:game.actors.filter(a=>a.type==="vehicle"&&a.uuid!==target.uuid).map(a=>({uuid:a.uuid,name:a.name})),categories:Object.entries(WEAPON_CATEGORIES).map(([value,entry])=>({value,label:`${entry.code} · ${entry.label}`}))});
    let submitted;
    return await foundry.applications.api.DialogV2.wait({window:{title:tr("Resolver daño recibido")},position:{width:500},content,buttons:[
      {action:"roll",label:tr("Tirar daño · 1d20"),default:true,callback:(_e,b)=>submitted??=Promise.resolve().then(async()=>{
        try{
          const f=b.form.elements,weapon=f.weapon.value?await fromUuid(f.weapon.value):null;
          const result=await DamageService.resolveDamage({target,weapon,attacker:weapon?.parent,
            baseDamageNumber:f.base.value.trim()?Number(f.base.value):undefined,category:f.category.value,
            applyStamina:f.stamina.checked,applyStrength:f.strength.checked,applyArmor:f.armor.checked,protectionVehicle:f.protectionVehicle?.value?await fromUuid(f.protectionVehicle.value):null,apply:false});
          await chooseDamageResult(result);return result;
        }catch(error){ui.notifications.error(error.message);}
      })},{action:"cancel",label:tr("Cancelar")}]});
  }finally{pending.delete(key);}
}
