import test from "node:test";
import assert from "node:assert/strict";
import {initializeWelcomeScene, WELCOME_BACKGROUND} from "../module/welcome.mjs";

test("welcome scene is created once in an empty World and follows its language", async () => {
  let initialized = false, created = 0, activated = 0;
  globalThis.game = {user: {id: "gm", isGM: true}, users: {activeGM: {id: "gm"}},
    scenes: {size: 0}, i18n: {lang: "es"}, settings: {
      get: () => initialized, set: async (_ns, _key, value) => {initialized = value;}
    }};
  globalThis.foundry = {documents: {Scene: {create: async data => {
    created++; assert.equal(data.background.src, WELCOME_BACKGROUND);
    assert.equal(data.grid.type, 0); assert.match(data.name, /Complejo Alfa/);
    return {activate: async () => {activated++;}};
  }}}};
  await initializeWelcomeScene(); await initializeWelcomeScene();
  assert.equal(created, 1); assert.equal(activated, 1);
});

test("welcome never replaces existing scenes or lets a player create one", async () => {
  let writes = 0;
  game.settings.get = () => false;
  game.settings.set = async () => {writes++;};
  foundry.documents.Scene.create = async () => {assert.fail("Must not create a scene");};
  game.scenes.size = 2;
  await initializeWelcomeScene(); assert.equal(writes, 1);
  game.scenes.size = 0; game.user.isGM = false;
  await initializeWelcomeScene(); assert.equal(writes, 1);
});
