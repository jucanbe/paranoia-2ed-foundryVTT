# Weapon and armor review — 2026-10-03

Source: `JOC-Paranoia-Manual Básico.ROLes.pdf`, Spanish JOC edition. Visual review of Annex B: PDF pages 162 (prices/clearance), 163 (armor) and 165 (armament), and of the weapon text on printed pages 89–92. PDF and printed page numbers differ.

## Result

- 41 weapons: all previous IDs are kept, and the laser rifle, sonic rifle, throwing knife, bow, rock and spear are added.
- 11 armors: the ten table rows plus the preserved starting uniform. Insulating T1, asbestos C4, combat T7, plate P3, mail P2, leather P1, Faraday E4, Kevlar P3, Reflec L4 and battle suit T4.
- Normal damage, type, range, radius, Cg, RCg, notes, price and clearance are stored in structured fields when verified. Malfunctions keep their independent damage.
- The normal slugthrower, semi-automatic slugthrower and cone rifle have 9, 9 and 10 ammunition profiles respectively. "Use" configures the attack without buying, creating or consuming ammunition, and without restoring charges.
- "Lanzaaguas" is corrected to "Lanzaagujas" (needle gun) while keeping `water-gun`. The former sonic weapon is now identified as the sonic pistol while keeping `sonic-weapon`. Neural whip E10, portable flamethrower E11 and Gauss E9 correct the previous categories.
- The Projectile Weapons skill, defined on printed page 67 and missing from the previous model, is added as `dexterity.projectileWeapons`; the other keys and scores are preserved.
- The seven integrated weapons of the Warrior Vulture keep their IDs and receive the verified catalogue attributes. No World Actor is modified.

## Interpretation and limits

`?` values remain unknown: no damage, type, charge or recharge is invented for mortars, missile launchers or gas launchers. `Pt` keeps the gas's particular effect without turning it into a fictitious damage number; `O` identifies a non-damaging effect. The spear keeps B/P and requires selecting B for melee or P when thrown. The former Axe is preserved, but it has no row of its own in this table and its statistics are still not assumed.

Cg and RCg are kept literally in `sourceDetails.chargeTurns` and `sourceDetails.tableRecharge`. They are not automatically converted into ammunition capacity or reload duration: the specific descriptive rules and the existing combat fields remain separate. Reflec colour effects, gas, stun, webs, cones and the Gauss restriction to robots require GM adjudication. The burst flag comes from the `r` note, without inventing consumption.

The starting uniform is not converted into Reflec L4 by inference. Assigned equipment remains free and character creation keeps its 100 credits. Copies already imported into Actors are not overwritten: they must be updated manually or replaced from the revised compendium if the GM wishes.

## Verification

- Tests for attributes, categories, keys, armor, profiles, permissions and purchase/creation regression.
- Foundry V14.368, isolated world: all 52 documents load with their strict models and their sheets open without errors; PP17 selected at 200 m and persisted after reload.
- Previous catalogue IDs and compendium UUIDs preserved.

The original PDF is not included in the repository.
