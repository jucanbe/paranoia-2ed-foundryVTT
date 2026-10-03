import {tr,trHTML} from "../i18n/index.mjs";
import {damageNumber,armorForAttack,usesStrength,numeric} from "./rules.mjs";
import {lookupDamage} from "./table.mjs";
import {DAMAGE_RESULTS,HEALTH_STATES} from "../health/rules.mjs";
import {requireGM,applyHealthResult} from "../health/service.mjs";
import {postRolls} from "../rolls/service.mjs";
import {ROBOT_STATES,ROBOT_RESULTS} from "../robots/rules.mjs";
import {VEHICLE_STATES,VEHICLE_RESULTS,smokeProtection} from "../vehicles/rules.mjs";
import {woundDialog} from "../combat/optional/wounds.mjs";
const NS="paranoia-2-edition";
const applications=new Map();
const render=data=>foundry.applications.handlebars.renderTemplate(`systems/${NS}/templates/damage/chat.hbs`,data);
function serial(result){return {id:result.id,targetUuid:result.target.uuid,attackerName:result.attackerName,weaponName:result.weaponName,
  targetCloneNumber:result.targetCloneNumber,manualOnly:!!result.manualOnly,sourceAttackId:result.sourceAttackId??null,
  baseDamageNumber:result.baseDamageNumber,strengthBonus:result.strengthBonus,stamina:result.stamina,armorProtection:result.armorProtection,
  armorLabel:result.armorLabel,finalDamageNumber:result.finalDamageNumber,dieResult:result.dieResult,automaticResult:result.automaticResult,
  warnings:result.warnings,resolved:!!result.applied,manual:!!result.manual,result:result.result??null};}
async function card(result){return render({...serial(result),targetName:result.target.name,
  resultLabel:result.result?(result.target.type==="vehicle"?VEHICLE_RESULTS:result.target.type==="robot"?ROBOT_RESULTS:DAMAGE_RESULTS)[result.result]:tr("Pendiente del DJ"),stateLabel:(result.target.type==="vehicle"?VEHICLE_STATES:result.target.type==="robot"?ROBOT_STATES:HEALTH_STATES)[result.target.system.health.status],
  wounded:result.target.system.health.status==="wounded",stunned:result.target.system.health.stunned,
  unavailable:!result.automaticResult});}
async function publish(result){
  const content=await card(result);
  if(result.message){
    await result.message.update({content:content+(result.roll?await result.roll.render():""),[`flags.${NS}.damage`]:serial(result)},{notify:false});
  }else result.message=await postRolls(result.target,result.roll?[result.roll]:[],content,result.messageMode??game.settings.get("core","messageMode"),{[NS]:{damage:serial(result)}});
}
export class DamageService {
  static preview({attacker=null,target,weapon=null,baseDamageNumber,category,applyStamina=true,applyStrength=true,applyArmor=true,protectionVehicle=null}={}){
    requireGM(target);
    if(weapon&&weapon.type!=="weapon")throw Error(tr("Selecciona un Item de arma."));
    const base=baseDamageNumber===undefined?weapon?.system.damageNumber:baseDamageNumber;
    numeric(base,tr("ND base"));
    const strengthBonus=applyStrength&&!["robot","vehicle"].includes(attacker?.type)&&usesStrength(weapon)?numeric(attacker?.system.damageBonus,tr("Bonus de Daño del atacante")):0;
    const stamina=applyStamina&&!["robot","vehicle"].includes(target.type)?numeric(target.system.stamina,tr("Aguante del defensor")):0;
    if(protectionVehicle){requireGM(protectionVehicle);if(protectionVehicle.type!=="vehicle")throw Error(tr("Protección externa: selecciona un vehículo."));}
    const hull=protectionVehicle??(target.type==="vehicle"?target:null),damageCategory=category||weapon?.system.weaponCategory;
    const armor=applyArmor?armorForAttack(hull?hull.items.filter(i=>i.type==="armor"&&i.system.integrated):target.items,damageCategory):{armorProtection:0,armorLabel:tr("Omitida por el DJ"),warnings:[]};
    if(hull&&applyArmor){const smoke=smokeProtection(hull.system.vehicle,damageCategory);armor.armorProtection+=smoke;if(smoke)armor.armorLabel+=" · Humo antiláser +5";
      if(protectionVehicle)armor.armorLabel=trHTML`${hull.name}: ${armor.armorLabel} (sin acumular armadura personal)`;
      if(hull.system.vehicle.defense.smallArmsProtection)armor.warnings.push(tr("Protección frente a armas pequeñas: el DJ debe decidir si el arma puede afectar al vehículo/ocupantes. No hay inmunidad automática por categoría."));}
    if(!applyStamina)armor.warnings.push(tr("Aguante omitido por el DJ."));
    if(!applyStrength&&usesStrength(weapon))armor.warnings.push(tr("Bonus de Daño omitido por el DJ."));
    return {baseDamageNumber:base,strengthBonus,stamina,...armor,
      finalDamageNumber:damageNumber({baseDamageNumber:base,strengthBonus,stamina,armorProtection:armor.armorProtection})};
  }
  /** No attack is rolled here. Missing columns stay unresolved; no clamping/extrapolation. */
  static async resolveDamage(options={}){
    const {target,attacker=null,weapon=null,apply=true,post=true,manualResult}=options;
    if(options.manualOnly){
      requireGM(target);
      if(!Object.hasOwn(DAMAGE_RESULTS,manualResult))throw Error(tr("Selecciona el resultado manual."));
      const result={id:options.sourceAttackId??foundry.utils.randomID(),sourceAttackId:options.sourceAttackId,target,targetCloneNumber:target.system.cloneNumber,attackerName:attacker?.name??"",weaponName:weapon?.name??tr("Daño manual"),
        manualOnly:true,roll:null,automaticResult:null,applied:false,warnings:[],messageMode:options.messageMode};
      return this.applyResolution(result,{manualResult,post});
    }
    const values=this.preview(options);
    const roll=await new foundry.dice.Roll("1d20").evaluate();
    const result={...values,id:options.sourceAttackId??foundry.utils.randomID(),sourceAttackId:options.sourceAttackId,target,targetCloneNumber:target.system.cloneNumber,messageMode:options.messageMode,attackerName:attacker?.name??"",weaponName:weapon?.name??tr("Daño manual"),
      roll,dieResult:roll.total,automaticResult:lookupDamage(values.finalDamageNumber,roll.total),applied:false};
    if(apply&&(result.automaticResult||manualResult))await this.applyResolution(result,{manualResult,post});
    else if(post)await publish(result);
    return result;
  }
  static async applyResolution(result,{manualResult,post=true}={}){
    requireGM(result.target);
    if(result.targetCloneNumber!=null&&result.target.system.cloneNumber!==result.targetCloneNumber)throw Error(tr("El clon objetivo cambió. Este daño pertenece al cuerpo anterior."));
    if(result.applied||result.message?.getFlag(NS,"damage")?.resolved)return result;
    if(applications.has(result.id))return applications.get(result.id);
    const operation=(async()=>{
      const selected=manualResult??result.automaticResult;
      if(!Object.hasOwn(DAMAGE_RESULTS,selected))throw Error(tr("No hay columna automática para este ND; el DJ debe elegir un resultado."));
      result.result=selected;result.manual=manualResult!==undefined;
      await applyHealthResult(result.target,selected,{announce:false,damageId:result.id});
      result.applied=true;
      if(post)await publish(result);
      if(selected==="wounded")await woundDialog(result.target,result.id);
      return result;
    })();
    applications.set(result.id,operation);
    try{return await operation;}finally{applications.delete(result.id);}
  }
  static async fromMessage(message){
    const data=message.getFlag(NS,"damage");
    if(!data)throw Error(tr("Mensaje de daño no válido."));
    const target=await fromUuid(data.targetUuid);requireGM(target);
    return {...data,target,roll:message.rolls[0],message,applied:data.resolved};
  }
}
