# Commander Table — Objectives

Open work and future ideas. Original objective numbers are kept so earlier discussions still make sense.

## Active and queued

### 76. Exile, and give to player — Built, awaiting Chris's test (v0.68.0)

Chris (2026-11-06): effects that exile an opponent's cards and let you play them (he exiled two cards from an opponent's deck and could play them, but the game had no way to give them to him, face down or up). Decision: the Forge way — the card goes into the receiving player's own exile, marked playable by them, face down when the effect says so (only the receiver can see it). Built: the **Library** right-click menu has **Exile, and give to…** / **Exile face down, and give to…** (player, then how many from the top), plus Search-library buttons per opponent, a "You may play this card from exile" line in the receiver's Reminders. Quick play is built too: playable graveyard/exile cards have a Play button and double-click in Reminders. Still an idea for later: a fuller "quick actions" list like Forge's (Play Commander, play from library) and an on-board marker for playable exile cards.

### Shipped recently (details in CHANGELOG.md)

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

### 48. More distinctive backgrounds — Queued

Develop a small set of original background concepts and review the art direction with Chris before adding them. Keep cards readable and check both layouts.

## Road to 1.0

### 67. 1.0 readiness — In progress

Goal: version 1.0 means the game is safe to share beyond friends, and what players have saved keeps working. The game stays a rules-free sandbox, so rules automation is not a 1.0 requirement. Touch support stays labelled **Beta** at 1.0 (Chris's decision, 2026-10-29); #18 continues afterward.

**Done:** automatic checks on every pull request (v0.56.0); PeerJS bundled instead of loaded from a CDN (v0.56.0); Report a bug and Privacy links and a Privacy section in the guide (v0.56.0); license changed to PolyForm Noncommercial (docs); accessibility pass on dialogs, labels and landmarks, supported-browsers list and an Accessibility section in the guide (v0.56.1); room lock, ask-before-joining and blocking removed players by browser and name, with a real connection-drop ability so refused and removed people receive nothing (v0.57.0); the saved-data upgrade tests (14 releases, v0.3.0 to v0.57.0); and the sync code for moving decks between computers (relay in v0.59.0's release train via PR #97, browser side v0.60.0).

**Still to do (Chris asked to finish all of these except full touch support):**
1. ~~Release-candidate multiplayer test.~~ Not needed (Chris, 2026-11-04): the game is working fine in Chrome, Edge and Safari. Firefox was not mentioned.
2. **Artwork and Scryfall audit.** Check all card backs and backgrounds for look-alikes of Wizards branding (two card backs were removed for this), and check use of Scryfall against its API guidelines. Consider a quick professional opinion on the license change and the Fan Content Policy. Not legal advice.
3. **Saved-data compatibility promise — decision pending.** The upgrade tests are published: 14 real releases (v0.3.0 to v0.57.0) are loaded into the current game by two tests (`tests/test_saved_data_upgrade.cjs`, automatic; and a real-browser one) and no upgrade problem was found. Still to decide with Chris: the compatibility promise for 1.0. Proposed: decks, backups and saved games made by any 1.x version keep opening in later 1.x versions; a change that would break that ships with a migration; the fixture tests enforce it. Not covered by the fixtures yet: uploaded custom images, hotkey and chat-panel preferences, and multiplayer (host or guest) saved games.
4. **Relay abuse protection.** Room codes are 5 characters from a 32-character set (about 33 million codes) with no rate limiting on the relay, and admin passphrase guesses are not throttled (the passphrase itself must be at least 20 characters and is compared safely). Relay changes deploy through Cloudflare and must stay backward compatible.
5. **Accessibility leftovers.** Cards on the table cannot be used from the keyboard alone, and the Deck Builder's card list has small buttons nested inside list items. Text over background images was not checked by the automatic scanner, so contrast there needs a manual look.

**Should have:** a short "relay is down" note for the owner and a known-limitations list in the guide.

**After 1.0:** the automation ideas (#55, #58, #62–65), #48, #4 and #45.

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
