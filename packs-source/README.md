# System Item catalogue

The distributed `packs/weapons`, `packs/armor`, and `packs/equipment` directories are native Foundry V14 LevelDB compendiums, declared by `system.json`. Install/copy the **whole system folder, including packs**. No player-facing script, world import, module, or startup seeding is required. Existing running worlds need to be relaunched to discover newly added manifest packs.

## Source and scope

The three JSON files here are the editable canonical source. Weapons and armor were checked against the full JOC Spanish manual supplied on 2026-10-03: PDF pages 162–165 (Annex B), with descriptive rules on printed pages 89–92. The catalogue contains 41 weapons and 11 armor entries; these include all armament table rows through selectable ammunition profiles, all ten armor table rows, and preserved legacy/generic entries. Robot and vehicle sources are separate; integrated vehicle weapons retain matching verified catalogue statistics.

All normal weapon damage numbers and ranges remain unset. Malfunction codes are separate `system.sourceDetails` metadata and never substitute for normal damage. Unknown prices are null; only the 13 verified starting purchases have prices. The starter uniform has no inferred protection; the separate Réflex example is L4. Unknown skill/category/clearance text is blank. No effects execute from the descriptive metadata.

## Maintainer build

Stop servers using the destination packs. Set `FOUNDRY_APP` to a licensed local Foundry V14 `resources/app` directory and run `node scripts/build-packs.mjs` from the system. The builder uses Foundry's existing `classic-level`, adding no runtime dependency. Distribute the resulting pack directories alongside the system. Users do **not** run this command.

Each catalogue ID generates a deterministic 16-character SHA-256-derived document ID. Documents are written in sorted ID order with stable content; LevelDB housekeeping filenames/timestamps are storage details, not byte-for-byte reproducible build artifacts. Rebuilding does not change catalogue IDs or system compendium UUIDs. Do not edit the compiled databases as the primary source. Do not rebuild packs while Foundry holds their database locks.

## API and creation

`game.paranoia.ItemCatalog.getById("laser-pistol")` resolves only the system packs. `flags["paranoia-2-edition"].catalogId` persists on embedded copies; `catalogSource` records their canonical compendium UUID. Display names are never lookup keys.

Creation uses 100 credits, three free assigned starter Items, and the explicitly marked `startingPurchase` entries. Red is a **purchase eligibility** minimum, not an invented clearance requirement on those Items. A GM must explicitly toggle the budget/clearance override. Existing assigned starters are retained rather than duplicated. Existing possessions are retained; selected quantities form single new stacks, avoiding accidental modification of customized possessions.

`price` is numeric. `priceUnit` is item, bottle, or meter. Plasticuerda uses price 3 per meter; selected meters become `system.length`, with `system.quantity = 1` for the length of rope. Quantity continues to mean a count of Items.

The wizard keeps purchases local. Finalization resolves every pack Item, validates schemas, checks permissions and stale source data, then submits character fields, credits and the complete preserved/extended Item hierarchy in **one Actor update**. Native Foundry persists the parent and embedded hierarchy together. The local commit guard prevents repeated submission; missing packs/IDs or invalid budgets cause no Actor writes.

Run `node --test tests/catalogue.test.mjs` for source, budget, clearance and inventory tests. See `missing-statistics.md` for the exact list of unavailable values.
