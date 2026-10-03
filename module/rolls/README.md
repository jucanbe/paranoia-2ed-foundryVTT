# Core rolls

Click an Attribute or Skill label to select difficulty and an integer modifier.
Shift-click makes a Normal check with modifier 0. Numeric inputs remain editable.
The GM's **Duelo de atributos** button compares any two Attributes.

The public API returns a Promise with the structured result, native Roll(s), and ChatMessage:

```js
await game.paranoia.rollCheck({actor, type: "attribute", key: "agility"});
await game.paranoia.rollCheck({actor, type: "skill", key: "dexterity.laserWeapons",
  difficulty: "difficult", modifier: 2});
await game.paranoia.rollAttributeDuel(actorA, "strength", actorB, "endurance");
```

API calls reject invalid values or insufficient ownership; sheet actions display the error.
Duels require a GM. Checks read current Actor values, including zero. Skills are already
effective ratings; no Basic Skill or Attribute is added. Checks use
`1d20 <= floor(baseValue * difficultyMultiplier) + modifier`, without clamping.
The World setting `specialRollResults` optionally overrides natural 1/20 outcomes.
Duels compare `1d20 + Attribute` totals and leave ties unresolved.

Chat follows V14 `core.messageMode` through `ChatMessage.applyMode`, with native dice
markup and Roll records. Only check data is passed to chat, never the Actor system object.
Creation dice remain independent raw d20 generation with no chat output.
Core combat calls this service. Its coordinator can supply a GM-only `healthSnapshot`
to retain a valid simultaneous declaration's initial health for the check. Normal checks
continue to use current health; damage calculations remain in DamageService.
