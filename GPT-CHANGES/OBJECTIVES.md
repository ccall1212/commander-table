# Commander Table — Objectives

Open work and future ideas. Original objective numbers are kept so earlier discussions still make sense.

## Active and queued

### 76. Exile, and give to player — Built, awaiting Chris's test (v0.68.0)

Chris (2026-11-06): effects that exile an opponent's cards and let you play them (he exiled two cards from an opponent's deck and could play them, but the game had no way to give them to him, face down or up). Decision: the Forge way — the card goes into the receiving player's own exile, marked playable by them, face down when the effect says so (only the receiver can see it). Built: the **Library** right-click menu has **Exile, and give to…** / **Exile face down, and give to…** (player, then how many from the top), plus Search-library buttons per opponent, a "You may play this card from exile" line in the receiver's Reminders. Quick play is built too: playable graveyard/exile cards have a Play button and double-click in Reminders. Still an idea for later: a fuller "quick actions" list like Forge's (Play Commander, play from library) and an on-board marker for playable exile cards.

### 77. Printed abilities switch on automatically — Built, awaiting Chris's test (v0.69.0)

Chris (2026-11-06): abilities printed at the very start of a card (Vigilance on Kimarhri, Valiant Guardian) should be turned on automatically; Saga creatures like Summon: Ixion list theirs at the bottom. Built with a menu switch to turn it off.

### 79. Reminders: replacement effects and cost changes — Built, awaiting Chris's test (v0.71.0)

Chris (2026-11-06): Hardened Scales did not show up in Reminders ("kinda a big one"). Fixed by also listing "If … would … instead" effects, extra-trigger effects and cost changes. Chris will keep reporting cards that are still missing.

### 78. Reminders: missing keyword triggers — Shipped (v0.70.0)

Chris (2026-11-06): Gyre Sage's Evolve was not in Reminders. Fixed with a list of trigger-type keywords (Evolve, Exalted, Prowess, Battle cry, Annihilator, Extort, Persist, Undying, Afterlife, Cascade, Echo and more). Chris will report any cards still missing.

### 80. Step trackers for Sagas, Classes, Rooms and Battles — Built, awaiting Chris's test (v0.72.0)

Chris (2026-11-06): people made a custom "Saga" token to move up and down; wanted a visual cue for Sagas, Classes, Rooms and Battles with the next step shown as unlocked, automatic Saga counters (Tidus, Yuna's Guardian can move them away, so they stay real counters), and Saga reminders only for the current chapter. Built as numbered dots on the card, click to move, menu steps, automatic lore counter each turn, chapter-only Reminders.

### 81. Abilities granted by other cards — Phase 1 built, awaiting Chris's test (v0.73.0)

Chris (2026-11-06): Sphere Grid gives creatures with +1/+1 counters reach and trample; can this be automatic, and recreated for many cards? Phase 1 (built): simple "creatures you control [with a counter] have <icon abilities>" lines, shown as dotted-green granted icons for everyone, never saved. Not included (Phase 2 ideas, only if wanted): power/toughness anthems, "until end of turn" or targeted grants, abilities without an icon, opponents' creatures.

### 82. Granted abilities: Equipment/Auras, everyone, opponents — Built, awaiting Chris's test (v0.74.0)

Chris (2026-11-06): extend #81 to Equipment/Auras and "all creatures"/opponents effects. Built. Still not done (only if wanted): power/toughness bonuses (anthems and the +N/+N on Equipment/Auras), extra conditions (power N or greater, has flying, attacking).

### 83. Reminders sorted by the turn — Built, awaiting Chris's test (v0.75.0)

Chris (2026-11-06): sort Reminders so all "At the beginning of combat" lines are together, following the phases of a turn (upkeep at the top, main, combat, damage, main 2, end step). Built as headed sections in turn order, alike wording side by side.

### 84. Shroud ability and icon — Built, awaiting Chris's test (v0.76.0)

Chris (2026-11-07): add Shroud as an ability with an icon; Lightning Greaves ("Equipped creature has haste and shroud") was not working. Built: Shroud added (drawn icon: an eye with a slash) and works with printed-ability and granted-ability reading.

### 85. Shroud icon redesign and non-creature grants — Built, awaiting Chris's test (v0.77.0)

Chris (2026-11-07): Shroud icon should be a hooded figure; asked whether Shroud of Protection ("Other enchantments you control have shroud") works and whether it covers all enchantments. It did not; built support for enchantments, artifacts, lands, planeswalkers and permanents.

### 86. New-player help: pre-con decks and deck links — Built, awaiting Chris's test (v0.79.0)

Chris (2026-11-18): help new players start without hunting for a deck. Chosen: links to Moxfield and Archidekt under Your deck, and a **Choose a pre-con deck…** dropdown with **Surprise me**. A start-up pop-up was considered and skipped (too many pop-ups already, see #45). Chris first supplied twelve decklists, then asked for every Commander pre-con from 2016 on with **no duplicates**, grouped like "Final Fantasy: 2025". Built: 158 decks from MTGJSON (MIT license), 48 groups, exact duplicates (Collector's Edition versions and Commander Anthology / Commander Anthology II reprints) removed by comparing card lists, earliest release kept. Chris's twelve decks match the official lists. All 6,583 card names verified on the real Scryfall. `tools/build-precons.py` regenerates `js/precons.js` when new pre-cons come out; the MIT notice must stay in that file and in the guide's Credits. Open ideas: include older (pre-2016) decks, Secret Lair single decks are included (9 of them), other products (Brawl, Duel Decks) are not.

### 87. Summoning sickness icon — Built, awaiting Chris's test (v0.80.0)

Chris (2026-11-18): add summoning sickness to the table, as an icon in the statuses, if the research shows it is workable. Research (Comprehensive Rules of 2026-11-06, rule 302.6 and haste 702.10, plus a check of 6,064 distinct pre-con cards) found: sickness lasts until the controller's next turn begins; it applies to the permanent (Vehicles, animated lands) not just creatures; haste ignores it; a control change restarts it. Chosen design: advisory only (never blocks), a **Zz** status added when a creature or Vehicle enters or changes controller and cleared when its controller's next turn begins; the icon is hidden while tapped or hasty (printed, temporary, granted); lands never marked; manual tick/untick in Statuses & abilities. Defaults used where Chris did not choose: visible to everyone, no on/off setting. Not handled: extra turns (the game has none), one-turn "gains haste until end of turn" effects (use Temporary haste or untick), conditional haste, and "can attack as though it had haste" (no pre-con card uses it).

### 88. Keyword coverage in the Reminders panel and Zz on the card — Built, awaiting Chris's test (v0.81.0)

Chris (2026-11-18): the Zz should sit ON the card like Suspected and Prepared, and the reminders were missing some keywords (Retrace was his example), so read all the pre-cons and fill the gaps. Built: Zz drawn on the card; 52 pre-con cards gain a reminder (named-ability triggers with punctuation, bulleted Siege modes, Auras/Equipment that grant a trigger, Mobilize, Graft, Umbra armor, Daybound/Nightbound, Cumulative upkeep with a cost, Mayhem). Retrace already listed while the card is in the graveyard (checked); still to learn exactly what Chris saw.

### 89. Day / Night marker — Built, awaiting Chris's test (v0.82.0)

Chris (2026-11-18): werewolf decks need day and night. Decision: the player who plays the starting card keeps the marker and controls it, but everyone can see day or night. Built: the real Day // Night card (Midnight Hunt token, Day front and Night back; ☀ / ☾ buttons like the Saga dots flip it) started from the ☰ menu or from an offer when a Daybound/Nightbound card enters; a chip beside the round number shows the state to everyone while the marker exists; only the keeper can change or remove it; removing lets someone else start one. Also built: a quiet wolf howl (night) and rooster (day) when the card flips, from files Chris supplied, with a per-player off switch. Not built (ideas): a faint warm/cool board tint (Friend 2), spell counting to suggest the turn-start change.

### 90. Sideways cards shown upright — Built, awaiting Chris's test (v0.83.0)

Chris (2026-11-19): split cards (his friend played Wear // Tear) are "technically horizontal", so show them horizontal. Built: `js/orient.js` decides which pictures are printed sideways (Scryfall layout `split` except Aftermath, Rooms, a Battle's front; saved cards without a layout use a safe guess; the owner publishes an `hz` flag so other players agree). On the board they get the tapped turn the other way (tapping shows the plain picture), plus a landscape hover preview and magnifier. Not done: hand and pile thumbnails stay plain; Aftermath cards (half sideways) are left alone.

### 91. Lands that enter tapped are tapped automatically — Built, awaiting Chris's test (v0.84.0)

Chris (2026-11-19): lands that only say "This land enters tapped" should tap themselves, and the "…unless you control…" ones too; leave out the "you may reveal a card" ones. Built: `js/entertap.js` reads the land face's rules text; hooks into `insertCard` (not for Give/Return control). Handles always-tapped, slow/fast/battle/check lands, "N or more other <type>s", opponents count, opponents' land count, and Lair of the Hydra's backwards form; 296 pre-con land faces. Reveal, pay-life, "you may have it enter tapped" and Adventure lands (Zanarkand) are left alone. Ideas not built: the same for non-land permanents that enter tapped; an MDFC land played on its back face is judged by whichever face shows when it enters.

### 92. Automatic power/toughness and more granted abilities — Built, awaiting Chris's test (v0.85.0)

Chris (2026-11-19): look through the pre-cons for effects like Sphere Grid. Chosen: Auras/Equipment with extra clauses (and their +N/+N and base power/toughness, e.g. frogs, with counters on top), "with counters on them", creature-type variations, and the simple conditions on the card itself (during your turn, untapped, Lieutenant, counter thresholds). NOT done on purpose (manual): artifact counts, life totals, creature counts, equipped, attacking. Built in `js/grants.js` (new `pt`, `base`, `when`, `self` scope) and `effPT` in `js/app.js`; plain anthems added when Chris asked about "All elves get +1/+1". Added after Chris's testing: "loses flying" / "loses all abilities" hide icons (Colossus Hammer), "as long as equipped creature is legendary" (Champion's Helm), and fixed "enters with N counters" are added on entry (57 pre-con cards; X counters stay manual). Next idea from Chris: creature-type changes ("is a Frog", "all creatures are Spiders", changelings as an "All types" tag) — not built; "until end of turn" one-shot effects stay with the Temporary effects tool.

### 93. Power/toughness counted from the card's own text — Built, awaiting Chris's test (v0.86.0)

Chris (2026-11-19): Bronze Guardian-style cards ("power is equal to the number of artifacts you control") should work out their number automatically, as the BASE power/toughness (Equipment still adds), including graveyard, hand, opponents' and whole-board counts. Built in `js/cda.js`; the owner publishes the parsed spec as `cda` on the card definition. 53 of the 70 pre-con cards with such a line (mana value, colours, devotion, exile, the party and chosen-player counts stay manual). Order of precedence for the base: set by hand, then an Aura's base, then the count, then the printed number. Next: creature types (v0.87.0).

### 94. "Gets +N/+N for each …" cards — Built, awaiting Chris's test (v0.86.1)

Chris (2026-11-19): Moon-Vigil Adherents did nothing. Cause: only "equal to the number of …" was read in v0.86.0; "gets +1/+1 for each …" is a pump per count on top of the base. Added for the card itself and for Auras/Equipment (the page counts from the giver's side), plus new counts: counters on the card, Auras/Equipment attached to it, opponents you have, creatures with a counter. 36 of the 66 pre-con cards with such a line.

### 95. Card types and creature types change automatically — Built, awaiting Chris's test (v0.87.0)

Chris (2026-11-19): when a card turns something into a Frog or says "all creatures are also Spiders", show a type/status and use it; Changelings and shapeshifters need an "All types" tag, not every name. Built in `js/grants.js` (a first pass computes types before everything else, so "Elves you control", counts and P/T all see the new types; `types` on grants, `allTypes` on the working definition) and shown as `t:` word tags in `js/app.js`. 49 pre-con cards (26 Changelings). Manual: chosen type, copies, one-shot returns, until-end-of-turn animation, mana-value-dependent effects. Not built: types from effects that depend on other types (chains), "loses all creature types" for enchanted PLAYERS (Curse of Conformity).

### 96. Types row over the printed type line — Built, awaiting Chris's test (v0.87.1)

Chris (2026-11-19): the type tags should be a separate small "Types" area, like option B (over the printed type line), but never going off the card; they must get smaller as more are added. Built: `.ctypes` row (`typesRowHTML` and `fitTypeRows` in `js/app.js`): a first size from the number of letters, then measured after every redraw and shrunk until every word fits (at most two lines); "+N" beyond four. Chris: the text must always be visible. Option A (top-left under the title) was not built. Also added in the same version (v0.88.0): a **Types** section in Statuses & abilities to add types by hand (`tys` on the card: shared with other players, forgotten when the card leaves), counted like automatic types.

### Shipped recently (details in CHANGELOG.md)

- #95 Card types and creature types change automatically — v0.87.0.

- #94 "Gets +N/+N for each …" cards — v0.86.1.

- #93 Power/toughness counted from the card's own text — v0.86.0.

- #92 Automatic power/toughness, more granted abilities, loses-abilities and enters-with counters — v0.85.0.

- #91 Lands that enter tapped are tapped automatically — v0.84.0.

- #90 Sideways cards shown upright — v0.83.0.

- #89 Day / Night marker with sounds — v0.82.0.

- #88 Zz on the card and more reminders from the pre-cons — v0.81.0.

- #87 Summoning sickness icon and Take an extra turn — v0.80.0.

- #86 Pre-con decks (158, grouped, no duplicates) and links to Moxfield and Archidekt — v0.79.0.
- #48 All ten play-area backgrounds redrawn — v0.78.2.
- #84 Shroud ability and Lightning Greaves — v0.76.0.
- #83 Reminders sorted by the turn — v0.75.0.
- #82 Granted abilities: Equipment/Auras, everyone, opponents; owner names in colour — v0.74.0; temporary effects end with their turn — v0.74.1.
- #81 Granted abilities, phase 1 (Sphere Grid etc.) — v0.73.0.
- #80 Step trackers for Sagas, Classes, Rooms, Battles; grouped menu — v0.72.0.
- #79 Reminders: replacement effects and cost changes — v0.71.0; word-tag clipping fix — v0.71.1.
- #77 Printed abilities switch on automatically — v0.69.0.
- #76 Exile, and give to player plus quick play from Reminders — v0.68.0.
- #73 Temporary effects until end of turn — v0.64.0 and v0.66.0.
- #74 Victory screen and death screens — v0.65.0.
- #75 Trigger reminders panel, including your graveyard/exile cards that work from there — v0.67.0.

### 18. Phone and tablet support — In progress

Touch support is labelled **Beta** in `README.md` and `docs/GUIDE.md` until it passes a real-device retest; remove those labels (and this note) when it does. Retest and improve Touch mode on real iPhone/iPad Safari: table height, bottom-edge hand dragging, card inspection/actions, group selection and menu scrolling. Check portrait/landscape and both layouts while preserving desktop controls.

[PR #69](https://github.com/ccall1212/commander-table/pull/69) awaits Chris’s iPhone retest. [Older v0.46.2 test ZIP](https://github.com/ccall1212/commander-table/archive/68a6341d2f9859783581af70f59df461ead05eee.zip) — predates current main and needs refreshing before being offered as a current copy.

### 5. Refine the Commander slam sound — Open refinement

Improve the Commander impact sound. Keep ordinary card placements softer and avoid replaying the effect when cards are repositioned.

### 45. Brief hotkey reminder — On the back burner

Show a small, dismissible reminder with a saved **Don’t show again** checkbox. Chris (2026-11-04) is putting this on the back burner: joining a game already shows many pop-ups and he does not want to add another. If it comes back, consider placing the reminder on the title screen instead of after entering a game. Respect custom shortcuts.

Include only: **T** tap/untap or Tokens over empty battlefield; **Space** pass; **R** In response; **D** draw; **G** graveyard; **E** exile; **C** copy; **Ctrl+Z / ⌘Z** Undo.

### 48. More distinctive backgrounds — All ten redone, awaiting Chris's test (v0.78.2 test copy)

Chris (2026-11-17): the stock backgrounds look too AI-made, with too much detail in walls, floors and rock. Redrawing the ten scenes one set at a time in a softer, less detailed style, keeping the same names and ids. All ten are in the v0.78.2 test copy. Seven arrived at 1024×572 and were enlarged to 1672×941 (Into Nature, Dragon's Lair, Necromancer's Dominion, Celestial Realm, Haunted Ruins, Tranquil Shores, Eldritch Horizon); higher-resolution versions can replace them. Knight's Vigil and Arcane Study are still fairly detailed.

Develop a small set of original background concepts and review the art direction with Chris before adding them. Keep cards readable and check both layouts.

## Road to 1.0

### 67. 1.0 readiness — In progress

Goal: version 1.0 means the game is safe to share beyond friends, and what players have saved keeps working. The game stays a rules-free sandbox, so rules automation is not a 1.0 requirement. Touch support stays labelled **Beta** at 1.0 (Chris's decision, 2026-10-29); #18 continues afterward.

**Done:** automatic checks on every pull request (v0.56.0); PeerJS bundled instead of loaded from a CDN (v0.56.0); Report a bug and Privacy links and a Privacy section in the guide (v0.56.0); license changed to PolyForm Noncommercial (docs); accessibility pass on dialogs, labels and landmarks, supported-browsers list and an Accessibility section in the guide (v0.56.1); room lock, ask-before-joining and blocking removed players by browser and name, with a real connection-drop ability so refused and removed people receive nothing (v0.57.0); the saved-data upgrade tests (14 releases, v0.3.0 to v0.57.0); and the sync code for moving decks between computers (relay in v0.59.0's release train via PR #97, browser side v0.60.0).

**Still to do (updated by Chris after v0.78.2):**
1. **Artwork.** The ten play-area backgrounds are done (redrawn in v0.78.2). Remaining: redo the 12 card backs in a less noisy style, the same way as the backgrounds, then glance at them for look-alikes of Wizards branding (two card backs were removed for this earlier) and do a quick read of Scryfall's API guidelines against how the game uses Scryfall. A professional opinion on the license is optional and not planned.
2. **Saved-data compatibility promise — decision pending.** The upgrade tests are published: 14 real releases (v0.3.0 to v0.57.0) are loaded into the current game by two tests (`tests/test_saved_data_upgrade.cjs`, automatic; and a real-browser one) and no upgrade problem was found. Still to decide with Chris: the compatibility promise for 1.0. Proposed: decks, backups and saved games made by any 1.x version keep opening in later 1.x versions; a change that would break that ships with a migration; the fixture tests enforce it. Gaps: the newest fixture is v0.57.0, and things saved since then (per-deck reminders, Saga/Class/Room steps, granted-ability switch-offs, temporary-effect turn stamps) have no fixture yet, so add one from a recent release; also not covered: uploaded custom images, hotkey and chat-panel preferences, and multiplayer (host or guest) saved games.

**Not part of 1.0 (Chris, after v0.78.2):**
- ~~Relay abuse protection~~ (rate limiting room codes and admin passphrase guesses): this is a friend-of-a-friend project, so revisit only if it grows.
- ~~Accessibility leftovers~~ (keyboard-only card use, nested buttons in the Deck Builder list, a manual contrast check over backgrounds): treated as later visual changes.

**Should have:** a short "relay is down" note for the owner and a known-limitations list in the guide.

**After 1.0:** relay abuse protection, accessibility leftovers, the automation ideas (#55, #58, #62–65), #4 and #45. New-player help (links to Moxfield and Archidekt, pre-con decks) is built (#86) and is not a 1.0 blocker.

## Paused and on hold

### 9. Random decks and website imports — Paused

Archidekt/Moxfield random-deck and import work. Preserve [draft PR #11](https://github.com/ccall1212/commander-table/pull/11); resume only when Chris asks.

[Archived draft ZIP](https://github.com/ccall1212/commander-table/archive/a415ef5a9d13531a9c6b5877ab40adf84388c6dc.zip) — its separate test service is not deployed. [Investigation notes](PR-11-DECK-IMPORT-INVESTIGATION.md).

### 57. 100-card limit with a Whtz exception — On Hold

Limit decks to 100 cards unless **Whtz, the Bibliophile** is the commander. First decide whether the count includes commanders or means the Library itself, and whether oversized decks get a warning or are blocked from play.

### 59. Blocker relationships — On Hold

Let a defender connect a blocking card to an incoming attacker, redirecting the attacker’s arrow from the player to that blocker. Settle multiple blockers, changing/clearing blocks and how the attacked player stays identifiable. This is a visual aid; damage calculation is separate.

## Deferred display idea

### 4. Larger cards on big displays — Deferred

Explore roughly 15–20% larger battlefield cards on 2K displays without changing 1080p and smaller screens or crowding the board.

### 69. Several uploaded card backs and backgrounds — Not planned

Chris (2026-11-04): swapping in another image by uploading it again is easy enough, so keeping several uploads is not needed now. The game still keeps one uploaded card back and one uploaded background ("Your upload"). The sync size limit was already raised to 8 MB, so it would not block this if it ever comes back.

## Automation

**All items below are Deferred ideas.** Explore optional assistance with manual overrides; implementation has not started. No test ZIPs exist for these items.

Research reference: [Card-Forge/forge](https://github.com/Card-Forge/forge), especially its rules engine, mana abilities, cost payment and player choices.

### 55. Combat power and damage helper

Show incoming attack power while players choose blockers. Define attackers explicitly—tapping alone does not mean attacking. Accurate damage would need rules for trample, vigilance, first/double strike, prevention and damage assignment; consider a simpler incoming-power aid first.

### 58. Drag a card to target or attack

Dragging toward another player would target them, return the card to its original position and tap it, except with vigilance. Decide attack versus targeting, how vigilance is identified, and how intentional card transfers remain available.

### 62. Floating mana pool

Track white, blue, black, red, green and colorless mana with manual add/remove controls and Undo. Decide pool visibility and clearing at step/phase boundaries, including exceptions and accidental phase advances.

Keep generic costs distinct from colorless mana: Hero’s Blade’s **{2}** can use two red mana; **{C}** specifically requires colorless.

### 63. Configurable mana production

Support lands, mana creatures, artifacts and other permanents, including effects that grant creatures mana abilities. Let players edit output colors and amounts—for example, two green or normal mana plus an extra color.

For choices such as Rootbound Crag’s red/green output, explore a clean split-circle chooser inspired by Arena. Keep ordinary tapping separate from mana activation; define extra activation costs, cancellation and Undo.

### 64. Editable costs and explicit payment

When casting, show an editable cost, available floating mana and chosen payment. Allow activating more sources, then confirm or cancel. Inspecting a card should not trigger payment. Depends on #62 and #63.

- Support manual adjustments for reductions, commander tax, X and alternative costs; define which hybrid/Phyrexian costs are supported.
- Let players choose each payment combination. Wildgrowth Archaic’s **{2/G}{2/G}** can be paid as **GG**, **{2}+G** or **{4}**; do not automatically accept GG.
- Let players choose actual colors spent on generic costs because **converge** can make that choice matter. Define cancellation and Undo across the payment and card play.

### 65. Optional mana automation

After #62–#64, explore recognizing straightforward mana abilities and suggesting payments. Broader support must account for doubled/extra mana, granted abilities, spending restrictions and changing board effects.

Keep manual fallbacks and explicit payment confirmation. Full rules enforcement and automatic card-effect resolution would need separate scope.

## Layout ideas

### 70. Commander damage outside the ▾ menu — Idea only

Chris (2026-11-04): eventually bring commander damage back out of the life box's ▾ dropdown so it is visible on the board. Placement undecided; the life total now has its own space in each name bar (v0.58.1), which may leave room.

(The earlier idea #66, life points at the top middle of the board, was dropped: the name-bar life total from v0.58.1 solved the problem it was meant to fix.)
