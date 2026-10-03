import {rollCheck, rollAttributeDuel} from "./service.mjs";

export function registerRolls() {
  game.settings.register("paranoia-2-edition", "specialRollResults", {
    name: "P2.Text.m1twkwqw", hint: "P2.Text.m1rhw19", scope: "world", config: true, type: Boolean, default: false
  });
  game.paranoia = Object.freeze({rollCheck, rollAttributeDuel});
}
