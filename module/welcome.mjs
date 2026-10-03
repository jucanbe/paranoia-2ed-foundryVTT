const NS = "paranoia-2-edition";
export const WELCOME_BACKGROUND = `systems/${NS}/assets/art/alpha-complex-briefing.png`;
const LEVEL_ID = "defaultLevel0000";
const welcomeLevel = () => ({_id: LEVEL_ID, name: "Alpha Complex",
  background: {src: WELCOME_BACKGROUND, color: "#161012"}});

/** Repair only our marked landing scenes whose V14 level image is missing. */
export async function repairWelcomeScenes() {
  for (const scene of game.scenes.contents ?? []) {
    if (!scene.getFlag(NS, "welcomeScene")) continue;
    const levels = scene.levels?.contents ?? [];
    if (levels.some(level => level.background?.src)) continue;
    const level = scene.initialLevel ?? levels[0];
    if (level) await level.update({"background.src": WELCOME_BACKGROUND});
    else await scene.createEmbeddedDocuments("Level", [welcomeLevel()], {keepId: true});
  }
}

/** Populate an empty World once; never replace a campaign's existing scenes. */
export async function initializeWelcomeScene() {
  if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
  await repairWelcomeScenes();
  if (game.settings.get(NS, "welcomeSceneInitialized")) return;
  if (game.scenes.size) {
    await game.settings.set(NS, "welcomeSceneInitialized", true);
    return;
  }
  const scene = await foundry.documents.Scene.create({
    name: game.i18n.lang === "es" ? "Complejo Alfa · Sala de briefing" : "Alpha Complex · Briefing Room",
    levels: [welcomeLevel()], initialLevel: LEVEL_ID,
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
