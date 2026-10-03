import {isRulesActor} from "../actors/types.mjs";
import {LABELS} from "../sheets/labels.mjs";
import {DIFFICULTIES, ROLL_LABELS, calculateHealthTarget} from "./rules.mjs";
import {blockedReason,healthModifier} from "../health/rules.mjs";
import {readCheck, renderRollTemplate, rollCheck, rollAttributeDuel} from "./service.mjs";
import {effectivePowerHealth,powerModifier} from "../powers/rules.mjs";

// One active sheet action per Actor, including its dialog and asynchronous chat creation.
const pending = new Set();
async function once(actor, task) {
  if (pending.has(actor.uuid)) return;
  pending.add(actor.uuid);
  try { return await task(); }
  catch (error) { ui.notifications.error(error.message); }
  finally { pending.delete(actor.uuid); }
}

async function dialog(content, title, callback, render) {
  let submitted;
  return foundry.applications.api.DialogV2.wait({
    window: {title}, position: {width: 420}, content, classes: ["p2-roll-dialog"],
    buttons: [
      {action: "roll", label: ROLL_LABELS.roll, default: true, callback: (_event, button) => {
        // Latch the Promise synchronously: keyboard and click submissions share one operation.
        submitted ??= Promise.resolve().then(() => callback(button.form)).catch(error => {ui.notifications.error(error.message); return null;});
        return submitted;
      }},
      {action: "cancel", type: "button", label: ROLL_LABELS.cancel, callback: () => null}
    ], render
  });
}

export function sheetCheck(event, button) {
  return once(this.actor, async () => {
    const options = {actor: this.actor, type: button.dataset.checkType, key: button.dataset.checkKey};
    const check = readCheck(options.actor, options.type, options.key);
    if (event.shiftKey) return rollCheck(options);
    const content = await renderRollTemplate("check-dialog", {
      actorName: this.actor.name, checkName: check.name, baseValue: check.baseValue,isGM:game.user.isGM,healthModifier:healthModifier(effectivePowerHealth(this.actor),options.type==="skill"?options.key:""),blocked:blockedReason(effectivePowerHealth(this.actor)),
      difficulties: Object.entries(DIFFICULTIES).map(([key, value]) => ({key, ...value, selected: key === "normal"}))
    });
    return dialog(content, `${ROLL_LABELS.roll}: ${check.name}`, form => rollCheck({
      ...options, difficulty: form.elements.difficulty.value, modifier: form.elements.modifier.value,healthOverride:game.user.isGM&&!!form.elements.healthOverride?.checked
    }), (_event, app) => {
      const form = app.element.querySelector("form");
      const preview = () => {
        try {
          const override=game.user.isGM&&!!form.elements.healthOverride?.checked;
          form.querySelector("output").textContent = calculateHealthTarget(check.baseValue, form.elements.difficulty.value, form.elements.modifier.value,effectivePowerHealth(this.actor),override,options.type==="skill"?options.key:"").finalTarget+powerModifier(this.actor,options.type,options.key);
          form.querySelector('[data-action="roll"]').disabled = !!blockedReason(effectivePowerHealth(this.actor))&&!override;
        } catch { form.querySelector("output").textContent = "—"; form.querySelector('[data-action="roll"]').disabled = true; }
      };
      form.addEventListener("input", preview); preview();
    });
  });
}

export function sheetDuel() {
  return once(this.actor, async () => {
    if (!game.user.isGM) throw new Error(ROLL_LABELS.denied);
    const content = await renderRollTemplate("duel-dialog", {
      actorName: this.actor.name,
      attributes: Object.entries(LABELS.attributeNames).map(([key, label]) => ({key, label})),
      opponents: game.actors.filter(a => isRulesActor(a) && a.id !== this.actor.id).map(a => ({id: a.id, name: a.name}))
    });
    return dialog(content, ROLL_LABELS.duel, form => rollAttributeDuel(this.actor, form.elements.attributeA.value,
      game.actors.get(form.elements.opponent.value), form.elements.attributeB.value,{healthOverride:!!form.elements.healthOverride?.checked}));
  });
}
