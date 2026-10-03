import {tr,trHTML} from "../i18n/index.mjs";
import {SYSTEM_ID as NS,ACTIONS,MOVEMENT} from "./config.mjs";
import {declarationOf,canDeclare,snapshotOf} from "./state.mjs";
import {renderCombat} from "./service.mjs";
import {requestCombat} from "./requests.mjs";

import {movementSummary} from "../vehicles/rules.mjs";
import {occupants} from "../vehicles/service.mjs";
import {enabled} from "./optional/settings.mjs";
import {specialActions} from "./optional/runtime.mjs";
import {optionalAttackHTML,optionalFormOptions} from "./optional/ui.mjs";
const open=new Set();
const selectOptions=(map,value)=>Object.entries(map).map(([key,label])=>({key,label,selected:key===value}));
const fields=form=>Object.fromEntries(new FormData(form));
async function show(combat,c,kind,content,submit,render) {
  const key=`${combat.id}.${c.id}.${kind}`;if(open.has(key))return;open.add(key);
  let pending;
  try{return await foundry.applications.api.DialogV2.wait({window:{title:kind==="attack"?tr("Resolver ataque"):tr("Declarar acción")},position:{width:470},classes:["p2-combat-dialog"],content,
    buttons:[{action:"confirm",label:kind==="attack"?tr("Atacar"):tr("Declarar"),default:true,callback:(_e,b)=>{
      pending??=Promise.resolve().then(()=>submit(b.form)).catch(error=>ui.notifications.error(error.message));return pending;
    }},{action:"cancel",label:tr("Cancelar"),type:"button"}],render});}
  finally{open.delete(key);}
}

export async function declarationDialog(combat,c) {
  if(!canDeclare(combat,c))throw Error(tr("No puedes editar esta declaración en la fase actual."));
  const d=declarationOf(combat,c)??{action:"other",movement:"walk"};
  const targeted=[...game.user.targets].map(t=>combat.combatants.find(x=>x.token?.uuid===t.document.uuid)).filter(t=>t&&t.id!==c.id&&t.visible);
  const targetId=targeted.length===1?targeted[0].id:targeted.length>1?"":d.targetId;
  const crew=c.actor.type==="vehicle"?await occupants(c.actor):[];
  const operators=[...(c.actor.system.vehicle?.control.electronicBrainAvailable?[{id:"electronicBrain",name:tr("Cerebro electrónico")}]:[]),...crew.filter(p=>p.actor&&p.role!=="passenger").map(p=>({id:p.actorUuid,name:p.actor.name}))];
  const content=await renderCombat("declaration",{name:c.name,isGM:game.user.isGM,isVehicle:c.actor.type==="vehicle",...d,
    actions:selectOptions({...specialActions(),...(enabled("burstFire")?{burst:tr("RÁFAGA")}:{}),...c.actor.type==="vehicle"?{attack:tr("Disparar"),evade:tr("Defensa"),move:tr("Conducir / maniobra"),other:tr("Operar sistema / otro")}:ACTIONS},d.burst?"burst":d.action),movements:selectOptions(c.actor.type==="vehicle"?{walk:movementSummary(c.actor.system.vehicle)}:c.actor.type==="robot"?{walk:trHTML`Locomoción: ${c.actor.system.robot.movement.mode||tr("sin configurar")} · ${c.actor.system.robot.movement.metersPerTurn??"?"} m/turno (DJ)`}:Object.fromEntries(Object.entries(MOVEMENT).filter(([key,m])=>(key!=="none"||enabled("weaponHandling")||enabled("ammunition")||enabled("hitLocation"))&&(game.user.isGM||!m.gmOnly)).map(([key,m])=>[key,`${m.label} · ${m.distance}`])),d.movement),
    weapons:c.actor.items.filter(i=>i.type==="weapon").map(i=>({id:i.id,name:i.name,selected:i.id===(d.weaponId||c.actor.system.npc?.activeWeaponId)})),
    integratedWeapons:["robot","vehicle"].includes(c.actor.type)?c.actor.items.filter(i=>i.type==="weapon"&&i.system.integrated).map(i=>({id:i.id,name:i.name,selected:d.integratedWeaponIds?.includes(i.id),operators:operators.map(o=>({...o,selected:d.weaponOperators?.[i.id]?.brain?o.id==="electronicBrain":o.id===d.weaponOperators?.[i.id]?.actorUuid}))})):[],
    targets:combat.combatants.filter(t=>t.id!==c.id&&t.visible).map(t=>({id:t.id,name:t.name,selected:t.id===targetId})),
    burstEnabled:enabled("burstFire"),burstTargets:combat.combatants.filter(t=>t.id!==c.id&&t.visible).map(t=>({id:t.id,name:t.name,selected:d.targetIds?.includes(t.id)})),gmModifier:c.getFlag(NS,"gmModifier")??0});
  return show(combat,c,"declaration",content,form=>requestCombat(combat,"declare",{...fields(form),targetIds:new FormData(form).getAll("targetIds"),weaponOperators:Object.fromEntries([...form.querySelectorAll("[data-weapon-operator]")].map(e=>[e.dataset.weaponOperator,e.value])),integratedWeaponIds:[...form.querySelectorAll('[name="integratedWeaponIds"]:checked')].map(e=>e.value),defending:form.elements.defending.checked,healthOverride:form.elements.healthOverride?.checked===true},c.id));
}

export async function attackDialog(combat,c) {
  if(!c.actor?.isOwner)throw Error(tr("No controlas este personaje."));
  const d=snapshotOf(combat,c)??declarationOf(combat,c)??{};
  const targeted=[...game.user.targets].map(t=>combat.combatants.find(x=>x.token?.uuid===t.document.uuid)).filter(Boolean);
  const targetId=!game.user.isGM&&d.targetId?d.targetId:targeted.length===1?targeted[0].id:targeted.length>1?"":d.targetId;
  const content=await renderCombat("attack-dialog",{name:c.name,isGM:game.user.isGM,detailedRange:enabled("range"),coverEnabled:enabled("cover"),movementEnabled:enabled("movement"),isBurst:!!d.burst,optionalHTML:optionalAttackHTML(combat,c,d),
    weapons:c.actor.items.filter(i=>i.type==="weapon").map(i=>({id:i.id,name:i.name,selected:i.id===(d.weaponId||c.actor.system.npc?.activeWeaponId)})),
    targets:combat.combatants.filter(t=>t.id!==c.id&&t.visible).map(t=>({id:t.id,name:t.name,selected:t.id===targetId})),
    gmModifier:c.getFlag(NS,"gmModifier")??0});
  const options=form=>({...optionalFormOptions(form),burstCount:d.burst?d.targetIds.length:1,pointBlank:form.elements.pointBlank?.checked??false,override:form.elements.override?.checked??false,messageMode:game.settings.get("core","messageMode")});
  return show(combat,c,"attack",content,form=>requestCombat(combat,"attack",options(form),c.id),(_event,app)=>{
    const form=app.element instanceof HTMLFormElement?app.element:app.element.querySelector("form");let revision=0;
    const preview=async()=>{
      const version=++revision,button=form.querySelector('[data-action="confirm"]');button.disabled=true;
      const notice=form.querySelector(".p2-combat-notice");
      try{
        const response=await requestCombat(combat,"preview",options(form),c.id),p=response.result??response;
        if(version!==revision||!app.rendered)return;
        for(const [key,value] of Object.entries({baseValue:p.baseValue,burstSkill:p.burstSkill??p.baseValue,finalTarget:p.finalTarget,...p.modifiers}))(form.querySelector(`[data-value="${key}"]`)??{}).textContent=value>0&&key!=="baseValue"&&key!=="finalTarget"?`+${value}`:value;
        form.querySelector('[data-value="skill"]').textContent=p.skillName;
        notice.textContent=[p.area?tr("Arma de campaña / área. Sin radio ni daño automático."):"",p.range?trHTML`Distancia: ${p.range}`:tr("Distancia no especificada; adjudicación del DJ."),p.experimental?tr("EXPERIMENTAL"):""].filter(Boolean).join(" · ");button.disabled=false;
      }catch(error){if(version===revision)notice.textContent=error.message;}
    };
    form.addEventListener("change",preview);preview();
  });
}
