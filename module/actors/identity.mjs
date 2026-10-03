import {tr} from "../i18n/index.mjs";
/** The single source of citizen identifier codes and formatting. */
export const CLEARANCE_CODES = Object.freeze({
  infrared: "IR", red: "R", orange: "O", yellow: "Y", green: "G",
  blue: "B", indigo: "I", violet: "V", ultraviolet: "UV"
});

export function normalizeIdentityText(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function buildCitizenId(system, fallback = "") {
  if(system.identity?.useCitizenId===false)return fallback||tr("PNJ sin nombre");
  const name = normalizeIdentityText(system.identity?.name);
  // Existing characters are not renamed until a personal name is explicitly entered.
  if (!name) return fallback || tr("Ciudadano sin identificar");
  const sector = normalizeIdentityText(system.identity?.sector) || "???";
  const clearance = CLEARANCE_CODES[system.securityClearance] ?? "?";
  const clone = Number.isInteger(system.cloneNumber) && system.cloneNumber >= 1 ? system.cloneNumber : "?";
  return `${name}-${clearance}-${sector}-${clone}`;
}

/** Add name changes to the same document transaction, never issue a second update. */
export function synchronizeCitizenIdentity(actor, changes) {
  const {expandObject, mergeObject} = foundry.utils;
  const expanded = expandObject(changes);
  const next = mergeObject(actor.toObject(), expanded, {inplace: false});
  for (const key of ["name", "sector"]) {
    if (Object.hasOwn(expanded.system?.identity ?? {}, key)) {
      expanded.system.identity[key] = normalizeIdentityText(expanded.system.identity[key]);
      next.system.identity[key] = expanded.system.identity[key];
    }
  }
  const name = buildCitizenId(next.system, next.name);
  if (name !== actor.name || (next.system.identity?.useCitizenId!==false&&next.system.identity?.name)) expanded.name = name;
  // Keep the default token identity aligned, but preserve intentionally custom token names.
  if (name !== actor.name && !expanded.prototypeToken?.name
      && (!actor.prototypeToken.name || actor.prototypeToken.name === actor.name)) {
    expanded.prototypeToken = {...expanded.prototypeToken, name};
  }
  Object.keys(changes).forEach(key => delete changes[key]);
  Object.assign(changes, expanded);
}

/** Linked tokens with an automatic name follow the Actor; custom aliases stay intact. */
export async function synchronizeLinkedTokenNames(actor, previousName) {
  for (const token of actor.getDependentTokens({linked: true, concreteOnly: true})) {
    if (token.name === previousName && token.canUserModify(game.user, "update")) {
      await token.update({name: actor.name});
    }
  }
}
