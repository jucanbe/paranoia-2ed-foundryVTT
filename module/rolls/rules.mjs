import {localizedRecord,tr} from "../i18n/index.mjs";
import {healthModifier} from "../health/rules.mjs";
export const DIFFICULTIES = Object.freeze(localizedRecord({
  easy: {label: "Fácil", multiplier: 2}, normal: {label: "Normal", multiplier: 1},
  difficult: {label: "Difícil", multiplier: 0.5}, veryDifficult: {label: "Muy Difícil", multiplier: 0.25}
}));
export const ROLL_LABELS = localizedRecord({
  attribute: "Atributo", skill: "Habilidad", roll: "Tirar", cancel: "Cancelar", duel: "Duelo de atributos",
  base: "Valor base", difficulty: "Dificultad", modifier: "Modificador", target: "Objetivo", result: "Resultado",
  success: "ÉXITO", failure: "FALLO", spectacular: "ÉXITO ESPECTACULAR", critical: "FALLO CRÍTICO",
  opponent: "Oponente", total: "Total", winner: "Ganador", tie: "EMPATE",
  invalid: "El atributo o la habilidad no tiene un valor válido.", denied: "No tienes permiso para realizar esta tirada.",
  tooltip: "Clic para tirar; Mayús + clic: dificultad Normal, sin modificador.",
  setting: "Resultados especiales en tiradas", hint: "Un 1 natural es un éxito espectacular y un 20 natural es un fallo crítico."
});

export function calculateTarget(baseValue, difficulty = "normal", modifier = 0) {
  if (typeof baseValue !== "number" || !Number.isFinite(baseValue)) throw new Error(ROLL_LABELS.invalid);
  if (!Object.hasOwn(DIFFICULTIES, difficulty)) throw new Error(tr("Dificultad no válida."));
  if (!["number", "string"].includes(typeof modifier)) throw new Error(tr("El modificador debe ser un entero."));
  if (typeof modifier === "string" && !/^[+-]?\d+$/.test(modifier.trim())) throw new Error(tr("El modificador debe ser un entero."));
  const situationalModifier = Number(modifier);
  if (!Number.isSafeInteger(situationalModifier)) throw new Error(tr("El modificador debe ser un entero."));
  const multiplier = DIFFICULTIES[difficulty].multiplier;
  const difficultyTarget = Math.floor(baseValue * multiplier);
  const finalTarget = difficultyTarget + situationalModifier;
  if (!Number.isFinite(finalTarget)) throw new Error(ROLL_LABELS.invalid);
  return {baseValue, difficulty, multiplier, difficultyTarget, situationalModifier, finalTarget};
}

export function evaluateCheck(dieResult, finalTarget, special = false) {
  if (!Number.isInteger(dieResult) || dieResult < 1 || dieResult > 20 || !Number.isFinite(finalTarget)) throw new Error(ROLL_LABELS.invalid);
  const specialResult = special && dieResult === 1 ? "spectacular" : special && dieResult === 20 ? "critical" : null;
  const success = specialResult ? specialResult === "spectacular" : dieResult <= finalTarget;
  return {dieResult, success, failure: !success, specialResult, label: ROLL_LABELS[specialResult ?? (success ? "success" : "failure")]};
}

export function calculateHealthTarget(baseValue,difficulty="normal",modifier=0,health={},override=false,key=""){
  const target=calculateTarget(baseValue,difficulty,modifier);
  const adjustment=override?0:healthModifier(health,key);
  return {...target,healthModifier:adjustment,healthOverride:override,finalTarget:target.finalTarget+adjustment};
}

export function evaluateDuel(a, b) {
  for (const participant of [a, b]) {
    calculateTarget(participant.baseValue);
    evaluateCheck(participant.dieResult, participant.baseValue);
  }
  const totalA = a.baseValue + a.dieResult + (a.healthModifier??0) + (a.temporaryModifier??0);
  const totalB = b.baseValue + b.dieResult + (b.healthModifier??0) + (b.temporaryModifier??0);
  return {totalA, totalB, winner: totalA === totalB ? null : totalA > totalB ? "a" : "b", tie: totalA === totalB};
}
