import {tr,trHTML} from "../../i18n/index.mjs";
import {enabled} from "./settings.mjs";
import {attackTarget,rangeBand,malfunctions,woundRestriction} from "./rules.mjs";
import {healthModifier} from "../../health/rules.mjs";
import {declarationOf} from "../state.mjs";
import {canPurchase} from "../../creation/purchases.mjs";
const NS="paranoia-2-edition";
export const specialActions=()=>({...enabled("weaponHandling")?{draw:tr("DESENFUNDAR"),holster:tr("ENFUNDAR")}:{},...enabled("ammunition")?{reload:tr("RECARGAR")}:{}});
export function distanceMeters(a,b){
  try{
    if(!a?.object?.center||!b?.object?.center||a.parent?.id!==b.parent?.id||canvas?.scene?.id!==a.parent?.id)return null;
    const units=String(a.parent.grid.units).toLowerCase(),scale=[tr("m"),"meter","meters","metro","metros"].includes(units)?1:["ft","feet","foot","pie","pies"].includes(units)?0.3048:null;
    if(scale==null)return null;const distance=canvas.grid.measurePath([a.object.center,b.object.center]).distance*scale;return Number.isFinite(distance)?distance:null;
  }catch{return null;}
}
export function optionalPreview({baseValue,weapon,c,target,declaration,targetDeclaration,options,user,health,defending,gmModifier}){
  const active=["range","cover","movement","burstFire"].some(enabled),override=!!options.override&&user.isGM;
  if(enabled("weaponHandling")&&!weapon.system.integrated&&!c.getFlag(NS,"weaponReady")?.includes(weapon.id)&&!override)throw Error(tr("El arma está enfundada: desenfunda durante un turno antes de atacar."));
  if(enabled("ammunition")&&weapon.system.ammoCurrent===0&&!override)throw Error(tr("El arma está descargada."));
  if(enabled("malfunctions")&&weapon.system.malfunctioned&&!override)throw Error(tr("El arma está averiada; requiere reparación o excepción del DJ."));
  if(enabled("hitLocation")){
    const reason=woundRestriction(health.wounds??c.actor.system.health.wounds??[],"none",{weaponArm:weapon.system.requiredArm,override});if(reason)throw Error(reason);
  }
  if(!active)return null;
  const count=options.burstCount??1;
  if(count>1&&(!enabled("burstFire")||!weapon.system.burstCapable||count>weapon.system.burstMaxTargets))throw Error(tr("Esta arma no admite esa ráfaga."));
  let band="manual",distance=null;
  if(enabled("range")){
    distance=options.distanceMeters==null?distanceMeters(c.token,target?.token):Number(options.distanceMeters);
    band=rangeBand(distance,weapon.system.maxRangeMeters);
    if(band==="out"&&!override)throw Error(tr("Objetivo fuera de alcance."));
    if(options.rangeBand&&options.rangeBand!=="auto"){
      if(!["manual","pointBlank","short","medium","long"].includes(options.rangeBand))throw Error(tr("Banda de alcance no válida."));band=options.rangeBand;
    }
  }
  const movement=actor=>["character","npc"].includes(actor?.type);
  const attackerMovement=enabled("movement")&&movement(c.actor)?declaration?.movement??"none":"none",targetMovement=enabled("movement")&&movement(target?.actor)?targetDeclaration?.movement??"none":"none";
  const safeMovement=m=>["none","walk","march","run"].includes(m)?m:"none";
  const result=attackTarget({baseValue,targetCount:count,band,cover:enabled("cover")?options.cover??"none":"none",attackerMovement:user.isGM&&options.ignoreMovement?"none":safeMovement(attackerMovement),targetMovement:user.isGM&&options.ignoreMovement?"none":safeMovement(targetMovement),wounded:override?0:healthModifier(health,weapon.system.skill),defending,gmModifier});
  const pointBlank=!enabled("range")&&options.pointBlank&&weapon.system.weaponCategory!=="melee"?4:0;
  result.modifiers.pointBlank=pointBlank;result.finalTarget+=pointBlank;
  return {...result,distance,attackerMovement,targetMovement,situationalModifier:result.finalTarget-baseValue-result.modifiers.wounded};
}
export function validateOptionalDeclaration(actor,c,data,user){
  const override=user.isGM&&data.healthOverride;
  if(enabled("hitLocation")){const weaponArm=["attack","draw","holster","reload"].includes(data.action)?actor.items.get(data.weaponId)?.system.requiredArm??"none":"none";const reason=woundRestriction(actor.system.health.wounds??[],data.movement,{weaponArm,override});if(reason)throw Error(reason);}
  if(Object.hasOwn(specialActions(),data.action)){
    if(!actor.items.get(data.weaponId))throw Error(tr("Selecciona un arma propia."));
    if(["sprint","zoom"].includes(data.movement)&&!override)throw Error(tr("Desenfundar, enfundar o recargar no permiten sprint."));
    if(data.action==="reload"&&data.movement!=="none"&&!override)throw Error(tr("Recargar ocupa el turno sin otra acción normal: selecciona Sin desplazamiento."));
    if(data.action==="reload"&&data.defending&&!override)throw Error(tr("Recargar ocupa la acción normal; no se declara evasión simultánea sin excepción del DJ."));
  }
}
export function ammunitionData(weapon){const laser=weapon.flags?.[NS]?.catalogId==="laser-pistol";return {capacity:weapon.system.ammunition.capacity??(laser?6:null),type:weapon.system.ammoType||(laser?"laser-charge":"")};}
function ammoFor(actor,weapon){const type=ammunitionData(weapon).type;return actor.items.find(i=>i.type==="equipment"&&i.system.quantity>0&&(i.flags?.[NS]?.catalogId===type||i.uuid===type)&&canPurchase(i,actor.system.securityClearance,false));}
export async function resolveHandling(combat,c,{override=false}={}){
  if(!game.user.isGM)throw Error(tr("Requiere DJ."));
  const declaration=declarationOf(combat,c);
  if(!declaration||!Object.hasOwn(specialActions(),declaration.action))throw Error(tr("No hay manejo de arma declarado."));
  if(c.getFlag(NS,"otherAction")?.round===combat.round)return {duplicate:true};
  const weapon=c.actor.items.get(declaration.weaponId);if(!weapon)throw Error(tr("El arma no existe."));
  const ready=c.getFlag(NS,"weaponReady")??[],progress=c.getFlag(NS,"weaponProgress"),operation=declaration.action;
  const receipt=`${combat.id}:${c.id}:${combat.round}:${c.actor.system.cloneNumber??"mechanical"}:${weapon.id}`;
  if(operation==="reload"&&weapon.flags?.[NS]?.reloadReceipt===receipt){await c.unsetFlag(NS,"weaponProgress");await c.setFlag(NS,"otherAction",{round:combat.round,resolved:true});return {duplicate:true};}
  const required=override?1:operation==="reload"?weapon.system.reloadTurns??1:operation==="draw"?weapon.system.drawTurnsRequired??1:1;
  if(!Number.isInteger(required)||required<1)throw Error(tr("El DJ debe indicar un número válido de turnos."));
  if(operation==="draw"&&ready.some(id=>id!==weapon.id)&&!override)throw Error(tr("Enfunda el arma anterior primero: cambiar normalmente ocupa dos turnos."));
  if(operation==="reload"&&!override){if(!ammoFor(c.actor,weapon)||ammunitionData(weapon).capacity==null)throw Error(tr("Falta munición compatible o capacidad verificada."));}
  const done=override?required:progress?.weaponId===weapon.id&&progress.operation===operation?progress.done+1:1;
  if(done>=required){
    if(operation==="reload"){
      const ammo=ammoFor(c.actor,weapon),capacity=ammunitionData(weapon).capacity;if(capacity==null)throw Error(tr("Capacidad no disponible."));
      const items=c.actor.items.map(i=>{const source=i.toObject();if(i.id===weapon.id){source.system.ammoCurrent=capacity;source.flags??={};source.flags[NS]={...source.flags[NS],reloadReceipt:receipt};}if(i.id===ammo?.id)source.system.quantity-=1;return source;}).filter(i=>i.system.quantity!==0);
      if(!await c.actor.update({system:c.actor.system.toObject(),items},{diff:false,recursive:false,paranoiaOptionalCombat:true}))throw Error(tr("No se guardó la recarga."));
    }else await c.setFlag(NS,"weaponReady",operation==="draw"?[...new Set([...ready,weapon.id])]:ready.filter(id=>id!==weapon.id));
    await c.unsetFlag(NS,"weaponProgress");
  }else await c.setFlag(NS,"weaponProgress",{weaponId:weapon.id,operation,done,required});
  await c.setFlag(NS,"otherAction",{round:combat.round,resolved:true});return {done,required};
}
export async function recordShot(weapon,die,{burst=false,override=false,ignoreMalfunction=false}={}){
  const changes={},notes=[];
  if(enabled("ammunition")&&weapon.system.ammoCurrent!=null){
    const shots=burst?weapon.system.burstAmmoCost:1;
    if(shots==null)notes.push(tr("Consumo de ráfaga no verificado: ajuste manual de munición por el DJ."));
    else if(!Number.isInteger(shots)||shots<1)throw Error(tr("Consumo de munición no válido."));
    else if(weapon.system.ammoCurrent<shots&&!override)throw Error(tr("Munición insuficiente."));
    else changes["system.ammoCurrent"]=Math.max(0,weapon.system.ammoCurrent-shots);
  }
  const broken=enabled("malfunctions")&&!ignoreMalfunction&&malfunctions(weapon.system,die);
  if(broken){changes["system.malfunctioned"]=true;notes.push(trHTML`Avería del arma. ${weapon.system.specialRules||tr("Efecto y validez del disparo: adjudicación del DJ.")}`);}
  if(Object.keys(changes).length&&!await weapon.update(changes,{paranoiaOptionalCombat:true}))throw Error(tr("No se guardó el estado del arma."));
  return {malfunction:broken,notes,shot:broken?weapon.system.malfunctionShot:"resolve"};
}
