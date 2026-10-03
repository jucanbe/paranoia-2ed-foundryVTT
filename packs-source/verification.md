# Catalogue verification — Foundry V14.367

Tested 2026-09-28 against an isolated fresh User Data directory and a new world using a complete copy of the distributed system. No development-world Items, Actors, modules or databases were copied. The test world and its server were removed after verification.

- All three manifest packs automatically appeared with packageType `system`: weapons 25, armor 2, equipment 39.
- World Item collection remained empty. All 66 compendium documents loaded with valid Item schemas.
- Ordinary players could browse/read all three packs. Compendium Armor and Weapon sheets rendered; native drag-and-drop created embedded copies preserving L4, canonical skill/category and unknown damage.
- Eight generated attributes, derived capacities and skills persisted through character finalization. Citizen identifier remained DAVID-R-ARO-1.
- Equipment preview began at 100 credits. One flashlight and two meters of Plasticuerda previewed 84; refunding one meter previewed 87. Actor data and Items remained unchanged before confirmation.
- Confirmation wrote 87 credits and five embedded Items: three free assigned starters, one unassigned flashlight, one unassigned rope with quantity 1 and length 1 meter. Compendium provenance and catalogue IDs survived.
- Reload preserved credits, Item fields, length and character values.
- Repeating the completed submission created no duplicates. Recreating a character retained existing possessions and exactly three assigned starters.
- A missing starter lookup caused no writes. A cancelled native preUpdateActor hook left credits, character data and inventory unchanged.
- An ordinary Actor owner completed purchases successfully; simultaneous duplicate calls produced one success and one rejection. A forged purchaseOverride flag did not allow a player to overspend. No GM override control appeared in the player wizard.
- Pure tests cover exact prices, meter accounting, refunds, insufficient credits, invalid quantities, invalid IDs, clearance restrictions, explicit override, starter deduplication, source immutability and separation of malfunction/normal damage.
- Legacy L category, laserWeapons short skill, numeric damage string "0", range and notes survived; new unknown price defaulted to null. Actor inventory displayed rope length separately.
- No browser JavaScript errors occurred. All module/script syntax checks passed.

Automated suite: **32/33 passing**. The unchanged pre-existing test `eight d20 rolls and two distinct lower-only rerolls; third and repeat rejected` fails because the existing reroll implementation replaces with 17 while the test expects the prior 10. This catalogue task does not change that rule or its test.

No combat, damage resolution, ammunition expenditure, reload automation, power effects, robots or vehicles were added.
