# Item data and sheets

Weapon, armor, and equipment use the existing V14 TypeDataModels and one ItemSheetV2
class with explicit type-specific field groups. Forms save on change. Image editing,
Item directory/compendium drops, and embedded sorting use Foundry's native handlers.
Optional ammunition, charges, uses, assignment details, weight and source notes are
collapsed. No inventory copy is stored in Actor.system. Equipment remains on the
owner/GM-only Secret tab, preserving existing sheet visibility.

Configuration is centralized in `config.mjs`. Clearances reuse the Character identity
enum and Spanish labels; Skill choices derive from the existing Character skill labels.
Canonical weapon category keys are laser, projectile, piercingProjectile, campaign,
melee and energy. Display codes are L/P/PP/C/B/E.

Armor follows the verified rule supplied by the user: `protectionType` plus numeric
`protectionValue`, including `all` (T). `armorCode` is a derived getter, e.g. L4 or T2.
There is no per-category protection matrix and no Armor Class. No damage subtraction
or reflect-armor color interaction is executed. These details can be recorded in
specialRules until the damage system is implemented.

Unspecified damage, protection, weight, charges and uses are null, distinct from 0.
New Items default to quantity 1; assigned/experimental/consumable flags default false.
Blank clearance/category/protection is supported where optional. Range retains its
original textual `range` field; no range formula or guessed catalogue values are added.

Small TypeDataModel migration fallbacks run on load:
- old weapon-category codes map to canonical English keys;
- weaponType, range, armorType and descriptive text remain intact;
- short skill keys become existing group.key paths; unknown skill text stays editable;
- numeric damage strings become numbers; original text stays in damageNotation;
- explicit legacy armorType codes such as L4 or T2 populate missing protection fields;
  descriptive armor types and Item names never generate statistics.

The already-existing combat code only receives category-key compatibility adjustments.
No new combat, damage, armor, consumption, reloading, grenade, or experimental effects
are implemented by this Item task. Robots and vehicles remain excluded.

System-owned catalogue packs and character-creation purchases were subsequently added
from the user's verified source extracts. See [catalogue documentation](../../packs-source/README.md)
and [missing statistics](../../packs-source/missing-statistics.md). Prices and units are
structured fields; sourceDetails keeps special/malfunction data separate from normal
weapon damage. Temporary test data is not production content.
