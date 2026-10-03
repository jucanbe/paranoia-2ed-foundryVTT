# Paranoia 2ª Edición · Foundry VTT V14

Release candidate 0.2.0-rc.1, verified against V14.368. This unofficial system requires a licensed Foundry installation. No rulebook PDF or scanned art is distributed.

Original code and original documentation are licensed under [MIT](LICENSE), Copyright (c) 2026 Juan Cano. Third-party game material is outside that grant; see [NOTICE](NOTICE).

## Install

Extract the release ZIP into your Foundry user-data `Data/systems` directory. The resulting folder must be `paranoia-2-edition` with `system.json` directly inside. Restart Foundry, create a World using this system, and launch it. System Compendiums and settings are available immediately; no manual content import is required. Do not replace pack databases while Foundry has them open.

## Idiomas / Languages

Español e inglés están incluidos. Selecciona el idioma en los ajustes generales de Foundry (Idioma / Language) y recarga cuando lo solicite. Las fichas, asistentes, diálogos, mensajes nuevos y referencias del catálogo utilizan el idioma elegido. Los nombres, notas y demás contenido personalizado se conservan. Cambiar de idioma no modifica estadísticas ni datos de los documentos.

Spanish and English are included. Choose Language in Foundry’s general settings and reload when prompted. System UI and catalogue references follow that setting; custom content and stored document data remain unchanged.

## Development and build

Use Node.js 22+ (the validation environment uses Node 24). Runtime modules and CSS are plain source: there is no transpilation step or npm installation.

```sh
node --test tests/*.test.mjs
node scripts/audit-system.mjs
```

Set `FOUNDRY_APP` to your licensed installation's `resources/app` directory, which supplies `classic-level`. It is the only build dependency; it is not redistributed.

```sh
node scripts/build-packs.mjs
node scripts/package-system.mjs
node scripts/verify-pack-build.mjs
```

The first command rebuilds installed packs: stop any server using them first. Set `PACK_OUTPUT` to a separate directory to build safely while installed packs are open. Sources are `packs-source/*.json` and the canonical society registry. IDs and embedded relationships are deterministic; database binary bytes are not expected to be identical. The second command builds new packs under `dist/paranoia-2-edition` and produces a ZIP. It cleans only that staging directory. The third compares all database records across two successive source builds in a separate output directory. Runtime allowlist: manifest, modules, templates, styles, localization, documentation, packs. Tests, scripts, source assets, source PDFs, dependencies, diagnostic logs and credentials are excluded. Numeric LevelDB journal files are required database content.

Browser validation uses Playwright (`PLAYWRIGHT_MODULE` if installed elsewhere). `scripts/verify-release-live.cjs` accepts `FOUNDRY_URL` and `AUDIT_WORLD_ID`, defaulting to localhost:30001 and release-audit-clean. Run only in a disposable World. Historical live tests remain guarded against execution in a user's World.

## Types and architecture

Actors: `character`, `npc`, `robot`, `vehicle`, each with its own V14 sheet and DataModel. Items: `weapon`, `armor`, `equipment`, `robotProgram`, `robotPeripheral`. Memory cards use the existing program/card schema, not an unused extra Item type.

`module/paranoia-2-edition.mjs` registers models, V14 sheets and services. `game.paranoia` exposes RollService functions, CombatService, DamageService, HealthService, CloneService, MutantPowerService, TreasonService, SecretSocietyService, SecurityClearanceService, DevelopmentService, CreditService, NPCGenerator and MigrationService. See subsystem docs for exact exported methods. Sheets delegate rules and writes to these services. Active Effects contain temporary power effects; human/robot/vehicle health remains canonical in system data.

Canonical registries: identity clearances in `module/actors/identity.mjs`; Services in `module/creation/config.mjs`; skill labels/paths in `module/sheets/labels.mjs` and `module/items/config.mjs`; weapon/equipment categories in the latter; powers in `module/powers/registry.mjs`; societies in `module/societies/registry.mjs`; combat phases/movement in `module/combat/config.mjs`; damage mappings in the respective damage/health/robot/vehicle rule modules; promotion requirements in `module/clearance/rules.mjs`.

## Migrations and confidentiality

Back up your entire World before upgrading. Patch-safe DataModel migrations normalize old society names/ranks, armor codes/protections, weapon categories/ammunition/reliability and power aliases. Unknown names and source data remain preserved. World data version 1 is applied automatically by the active GM: a GM-only Journal backup is written before document updates. Failed documents remain retryable. Existing balances, skills and histories are preserved; no purchases, PD spending or rewards are inferred. MigrationService allows a deliberate retry/import migration. Locked system Compendiums are rebuilt from source rather than migrated in place.

Foundry-native privacy is intended to prevent accidental/table-level disclosure, not to defend against an authorized player deliberately inspecting synchronized client data.

Normal play uses native Foundry whispers, ownership and sheet visibility over HTTP. See [tabletop privacy](docs/native-privacy-audit.md).

## Known source gaps

Missing Damage Table columns and Annex B hit-location probabilities remain manual. Unknown weapon statistics, repair difficulties, vehicle accident values and Service/NPC source mappings are not guessed. See `packs-source/missing-statistics.md` in the developer checkout and subsystem docs. No salary tables, economic simulation or additional mechanics are introduced by this release.
