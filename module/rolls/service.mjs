import {tr,trHTML} from "../i18n/index.mjs";
import {isMechanicalActor as isRulesActor} from "../actors/types.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {DIFFICULTIES, ROLL_LABELS, calculateTarget, calculateHealthTarget, evaluateCheck, evaluateDuel} from "./rules.mjs";
import {assertCanAct,healthModifier} from "../health/rules.mjs";
import {effectivePowerHealth,powerModifier} from "../powers/rules.mjs";
import {recordSkillUse,isEnabled} from "../development/service.mjs";

const ROOT = "systems/paranoia-2-edition/templates/rolls";
export async function renderRollTemplate(name, context) {
  return foundry.applications.handlebars.renderTemplate(`${ROOT}/${name}.hbs`, {labels: ROLL_LABELS, ...context});
}

export function readCheck(actor, type, key) {
  if (!isRulesActor(actor) || !actor.testUserPermission(game.user, "OWNER")) throw new Error(ROLL_LABELS.denied);
  if (typeof key !== "string") throw new Error(ROLL_LABELS.invalid);
  let name, baseValue;
  if (type === "attribute" && Object.hasOwn(LABELS.attributeNames, key)) {
    name = LABELS.attributeNames[key];
    baseValue = actor.system.attributes?.[key]?.value;
  } else if (type === "skill") {
    const [group, skill, extra] = key.split(".");
    if (!extra && Object.hasOwn(LABELS.skillNames, group) && Object.hasOwn(LABELS.skillNames[group], skill)) {
      name = LABELS.skillNames[group][skill];
      baseValue = actor.system.skills[group]?.[skill]?.value;
    }
  }
  calculateTarget(baseValue);
  return {actor, type, key, name, baseValue};
}

export async function postRolls(actor, rolls, content, messageMode, flags = {}) {
  const Message = foundry.utils.getDocumentClass("ChatMessage");
  // Native dice markup supplies Foundry's expandable die tooltip, even with custom cards.
  content += (await Promise.all(rolls.map(roll => roll.render()))).join("");
  const message = new Message({speaker: Message.getSpeaker({actor}), content, rolls, flags, sound: CONFIG.sounds.dice});
  message.applyMode(messageMode);
  return Message.create(message);
}

/** Public API: current document values are read at the moment of rolling. */
export async function rollCheck({actor, type, key, difficulty = "normal", modifier = 0, createMessage = true,healthOverride=false,healthReason="",healthSnapshot=null} = {}) {
  const check = readCheck(actor, type, key);
  if(healthSnapshot&&!game.user.isGM)throw Error(tr("Solo el DJ coordinador puede usar el estado inicial de Resolución."));
  const health=healthSnapshot??effectivePowerHealth(actor);
  assertCanAct({system:{health}},{override:healthOverride});
  const situational=calculateTarget(check.baseValue,difficulty,modifier).situationalModifier;
  const temporaryModifier=powerModifier(actor,type,key);
  const target = {...calculateHealthTarget(check.baseValue, difficulty, situational+temporaryModifier,health,healthOverride,type==="skill"?key:""),temporaryModifier};
  const messageMode = (["robot","vehicle"].includes(actor.type)&&game.user.isGM)||(actor.type==="npc"&&type==="attribute"&&key==="mutantPower")?"gm":game.settings.get("core", "messageMode");
  const roll = await new foundry.dice.Roll("1d20").evaluate({allowInteractive: messageMode !== "blind"});
  const result = {...check, ...target, ...evaluateCheck(roll.total, target.finalTarget, game.settings.get("paranoia-2-edition", "specialRollResults")), roll};
  if(type==="skill"&&isEnabled(actor)){
    // A per-adventure counter, no extra Chat card or per-roll audit entry.
    try{await recordSkillUse(actor,key);}catch(error){ui.notifications.warn(trHTML`Tirada realizada; no se pudo registrar el uso: ${error.message}`);}
  }
  if (createMessage) {
  const content = await renderRollTemplate("check-chat", {
    actorName: actor.name, checkName: check.name, typeLabel: ROLL_LABELS[type], ...target,healthReason,
    difficultyLabel: DIFFICULTIES[difficulty].label, dieResult: result.dieResult, outcome: result.label
  });
  result.message = await postRolls(actor, [roll], content, messageMode);
  }
  return result;
}

/** Duels deliberately use totals, never roll-under or optional natural-result rules. */
export async function rollAttributeDuel(actorA, attributeA, actorB, attributeB,{healthOverride=false}={}) {
  if (!game.user.isGM) throw new Error(ROLL_LABELS.denied);
  const a = readCheck(actorA, "attribute", attributeA), b = readCheck(actorB, "attribute", attributeB);
  const messageMode = game.settings.get("core", "messageMode");
  for (const participant of [a, b]) {
    assertCanAct(participant.actor,{override:healthOverride});
    participant.healthModifier=healthOverride?0:healthModifier(effectivePowerHealth(participant.actor));
    participant.temporaryModifier=powerModifier(participant.actor,"attribute",participant.key);
    participant.roll = await new foundry.dice.Roll("1d20 + @attribute + @health + @temporary", {attribute: participant.baseValue,health:participant.healthModifier,temporary:participant.temporaryModifier}).evaluate({allowInteractive: messageMode !== "blind"});
    participant.dieResult = participant.roll.dice[0].total;
    participant.total = participant.roll.total;
  }
  const outcome = evaluateDuel(a, b);
  const result = {a, b, ...outcome};
  const content = await renderRollTemplate("duel-chat", {
    participants: [a, b].map(p => ({actorName: p.actor.name, name: p.name, baseValue: p.baseValue,healthModifier:p.healthModifier,temporaryModifier:p.temporaryModifier, dieResult: p.dieResult, total: p.total})),healthOverride,
    outcome: outcome.tie ? ROLL_LABELS.tie : `${ROLL_LABELS.winner}: ${result[outcome.winner].actor.name}`
  });
  result.message = await postRolls(actorA, [a.roll, b.roll], content, messageMode);
  return result;
}
