import test from "node:test";
import assert from "node:assert/strict";
import {initializeWelcomeScene, repairWelcomeScenes, WELCOME_BACKGROUND} from "../module/welcome.mjs";

test("welcome scene is created once in an empty World and follows its language", async () => {
  let initialized = false, created = 0, activated = 0;
  globalThis.game = {user: {id: "gm", isGM: true}, users: {activeGM: {id: "gm"}},
    scenes: {size: 0}, i18n: {lang: "es"}, settings: {
      get: () => initialized, set: async (_ns, _key, value) => {initialized = value;}
    }};
  globalThis.foundry = {documents: {Scene: {create: async data => {
    created++; assert.equal(data.levels[0].background.src, WELCOME_BACKGROUND);
    assert.equal(data.initialLevel, data.levels[0]._id);
    assert.equal(data.background, undefined);
    assert.equal(data.grid.type, 0); assert.match(data.name, /Complejo Alfa/);
    return {activate: async () => {activated++;}};
  }}}};
  await initializeWelcomeScene(); await initializeWelcomeScene();
  assert.equal(created, 1); assert.equal(activated, 1);
});

test("repairs marked empty V14 levels even after initialization, preserving custom backgrounds", async () => {
  let repairs = 0;
  const blank = {background: {src: null}, update: async data => {
    assert.equal(data["background.src"], WELCOME_BACKGROUND); repairs++;
  }};
  game.scenes.contents = [
    {getFlag: () => true, levels: {contents: [blank]}, initialLevel: blank},
    {getFlag: () => true, levels: {contents: [{background: {src: "custom.png"}}]}},
    {getFlag: () => false, levels: {contents: [blank]}}
  ];
  await repairWelcomeScenes(); assert.equal(repairs, 1);
  game.scenes.contents = [];
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
