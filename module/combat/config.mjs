import {localizedRecord} from "../i18n/index.mjs";
export const SYSTEM_ID = "paranoia-2-edition";
export const COMBAT_TURN_SECONDS = 5;
export const PHASES = localizedRecord({npcDecision: "Decisión de PNJ", playerDecision: "Decisión de jugadores", resolution: "Resolución", movement: "Movimiento"});
export const ACTIONS = localizedRecord({attack: "ATACAR", evade: "DEFENSA", move: "MOVER", other: "OTRO"});
export const MOVEMENT = localizedRecord({
  none:{label:"Sin desplazamiento",distance:"0 m",min:0,max:0},
  walk: {label: "Paseo", distance: "2 m", min: 2, max: 2},
  march: {label: "Marcha", distance: "2–5 m", min: 2, max: 5},
  run: {label: "Carrera", distance: "5–20 m", min: 5, max: 20},
  sprint: {label: "Sprint", distance: "20–40 m", min: 20, max: 40, preventsAttack: true},
  zoom: {label: "Zoom", distance: ">40 m · solo DJ", min: 40, max: null, gmOnly: true}
});
export {WEAPON_CATEGORIES} from "../items/config.mjs";
export const ATTACK_MODIFIERS = {pointBlank: 4, defenderEvading: -4};
