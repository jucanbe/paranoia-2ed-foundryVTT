# Secret Society Compendium — source and validation

The distributed system pack is **`paranoia-2-edition.societies`**, labelled **Paranoia 2ª Edición - Sociedades Secretas**. Its existing identity was preserved rather than renaming it to the suggested secret-societies ID. It contains exactly **16 JournalEntries**, each with one text page. Generated files: `packs/societies/`. Journal/page IDs remain deterministic SHA-256-derived 16-character IDs based on the unchanged society keys.

## Single canonical source

`module/societies/definitions.mjs` contains concise Spanish summaries of the supplied authoritative rulebook extracts. `module/societies/registry.mjs` exposes the sole public registry, aliases, the d20 table, ranks and machine-readable metadata. Creation, NPC generation, SecretSocietyService and the pack builder all consume that registry. `module/societies/reference.mjs` renders readable HTML for Journals and the member reference dialog, excluding GM notes unless explicitly requested by the GM view.

Keys: antifrankenstein, antimutants, sierraClub, communists, corporeMetal, humanists, firstChurchChristProgrammer, illuminati, deathLeopards, freeEnterprise, mystics, computerPhreaks, proTech, psionics, purgers, romantics.

All ally/enemy keys resolve. Directed relationships exactly follow the supplied source; they are not made symmetric. Communists and Illuminati have descriptive broad enemy notes rather than rigid all-society arrays. Libre Empresa has a descriptive business-contact note rather than treating all societies as allies. Unspecified Computer relationships, speech and other fields remain empty.

## Verified special metadata and integration

- Club Sierra: `development.skillCostMultipliers["perception.survival"] = 0.5`.
- Piratas Informáticos: initial PD access for `computerSecurity` / `programming`, with Spanish labels and `requiresSupportedSkill: true`.
- Románticos: initial PD access for `ancientCultures`, with its Spanish label and the same support condition.
- Comunistas: `benefitSkills` describes Propaganda Comunista, without adding it to the global Skill schema. Discovery uses existing Treason adjudication and never causes automatic death.
- Psiónicos: `advancement` records new-level trigger, GM selection, once-per-level behavior and original-power preservation. Promotions persist level entitlements; GM instruction adds a registry power via MutantPowerService. Learned powers use the existing pool and private action workflow, and clones preserve them. No retroactive grants are inferred for historical ranks lacking entitlements.
- Leopardos: the eight supplied labels apply only to that society.

The current creation PD budget is unchanged; these metadata describe future supported development options. Hacking, cybernetics, drugs, political actions, resource delays, equipment grants and other narrative benefits are not automated. Existing global Skills and Item catalogues were preserved. No scanned artwork was used; Journals use a generic core book icon. World custom societies remain outside the system source pack.

## Build and verification

Set `FOUNDRY_APP` to the installed Foundry resources/app directory, stop servers holding this pack open, then run `node scripts/build-societies.mjs`. `SOCIETY_PACK_OUTPUT` permits a staging build. The distributed pack was rebuilt in its original directory after the user closed Foundry. `node scripts/verify-societies.mjs` subsequently verified the installed database read-only: 16 stable Journals, 16 pages, exact agreement with canonical HTML and GM pack permissions. Syntax checks passed for society, power and DataModel modules and the live harness.

Automated suite: **135 tests passed**, zero failures. Coverage includes relationships, all d20 outcomes, ranks/metadata, GM/member HTML separation, migrations, custom societies, NPC selection, encrypted mission notes, permissions, one-time psionic learning, private learned-power use, and clone preservation. Other subsystem regressions cover powers, Treason, combat, Items, robots and vehicles.

An isolated clean **Foundry V14.368** World (`society-fresh-validation`) was created using only this system, with **zero active modules** and no manual imports. The pack was present immediately with 16 entries and one page per entry. All 16 Journal sheets opened and rendered; a representative Journal was visually reviewed. Real Foundry fixtures verified old name/rank/notes and string/custom migration; full creation commit and starter equipment; canonical NPC membership; missions and encrypted GM notes; Psionics promotion, GM learning, duplicate-level rejection and demotion/re-promotion; unchanged clearance and no automatic PT; clone retention of membership and learned powers. Separate owner and observer sessions verified member-only Character panel, GM-only NPC society, hidden pack and denial of player power grants.

The live harness is `scripts/inspect-foundry-local.cjs verify` with Playwright available through `PLAYWRIGHT_MODULE`, calling `tests/societies.live.mjs`. It is guarded to the disposable named World. It creates fixtures there and never uses a development campaign or production Actor. Live private use of a learned power spent PM through the existing request/coordinator workflow. Browser page errors and error-level console messages were both empty across the GM, owner and observer sessions. The temporary server was stopped and its temporary license copy removed after verification. As with the existing architecture, member-facing Actor source is not transport-encrypted; these privacy checks verify sheet/context/service visibility, not cryptographic confidentiality of ordinary Actor data.
