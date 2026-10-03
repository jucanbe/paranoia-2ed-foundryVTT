const NS = "paranoia-2-edition";
export const WELCOME_BACKGROUND = `systems/${NS}/assets/art/alpha-complex-briefing.png`;

/** Populate an empty World once; never replace a campaign's existing scenes. */
export async function initializeWelcomeScene() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id
    || game.settings.get(NS, "welcomeSceneInitialized")) return;
  if (game.scenes.size) {
    await game.settings.set(NS, "welcomeSceneInitialized", true);
    return;
  }
  const scene = await foundry.documents.Scene.create({
    name: game.i18n.lang === "es" ? "Complejo Alfa · Sala de briefing" : "Alpha Complex · Briefing Room",
    background: {src: WELCOME_BACKGROUND},
    width: 1536, height: 864, padding: 0,
    grid: {type: 0}, tokenVision: false, navigation: true,
    flags: {[NS]: {welcomeScene: true}}
  });
  await scene.activate();
  await game.settings.set(NS, "welcomeSceneInitialized", true);
}

export function registerWelcomeScene() {
  game.settings.register(NS, "welcomeSceneInitialized", {
    scope: "world", config: false, type: Boolean, default: false
  });
  Hooks.once("ready", () => initializeWelcomeScene().catch(error => {
    console.error(`${NS} | Welcome scene could not be initialized`, error);
  }));
}
