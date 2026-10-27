# Commander Table — Objectives

Open work and future ideas. Original objective numbers are kept so earlier discussions still make sense.

## Active and queued

### 18. Phone and tablet support — In progress

Touch support is labelled **Beta** in `README.md` and `docs/GUIDE.md` until it passes a real-device retest; remove those labels (and this note) when it does. Retest and improve Touch mode on real iPhone/iPad Safari: table height, bottom-edge hand dragging, card inspection/actions, group selection and menu scrolling. Check portrait/landscape and both layouts while preserving desktop controls.

[PR #69](https://github.com/ccall1212/commander-table/pull/69) awaits Chris’s iPhone retest. [Older v0.46.2 test ZIP](https://github.com/ccall1212/commander-table/archive/68a6341d2f9859783581af70f59df461ead05eee.zip) — predates current main and needs refreshing before being offered as a current copy.

### 5. Refine the Commander slam sound — Open refinement

Improve the Commander impact sound. Keep ordinary card placements softer and avoid replaying the effect when cards are repositioned.

### 45. Brief hotkey reminder — Queued

Show a small, dismissible reminder after game entry, with a saved **Don’t show again** checkbox. Respect custom shortcuts and wait until required entry dialogs finish.

Include only: **T** tap/untap or Tokens over empty battlefield; **Space** pass; **R** In response; **D** draw; **G** graveyard; **E** exile; **C** copy; **Ctrl+Z / ⌘Z** Undo.

### 48. More distinctive backgrounds — Queued

Develop a small set of original background concepts and review the art direction with Chris before adding them. Keep cards readable and check both layouts.

### 56. Card statuses, keyword counters and icons — Queued

Add readable markers such as **Goaded** and **Prepared**, plus icons for abilities. Keep on/off statuses separate from real counters that can be counted or proliferated.

Reference abilities: deathtouch, double strike, first strike, flying, haste, hexproof, indestructible, lifelink, menace, reach, shield, trample and vigilance. Decide icon placement, counter quantities and removal behavior. Counter copying/dragging is outside scope.

## Road to 1.0

### 67. 1.0 readiness — Queued

Goal: version 1.0 means the game is safe to share beyond friends, and what players have saved keeps working. The game stays a rules-free sandbox, so rules automation is not a 1.0 requirement. No implementation or test ZIP yet.

**Must have**
1. **Release-candidate multiplayer test.** Play a full 4-player game in real Chrome, Firefox, Edge and Safari, including the host dropping out, a laptop sleeping, and rejoining. Record who tested what and the results. Most automated tests are headless or solo, so this needs real people.
2. **Touch support.** Finish #18 or keep the **Beta** label. The label is already in `README.md` and `docs/GUIDE.md`.
3. **Licensing and artwork audit.** Chris decides whether to keep MIT or choose a non-commercial license: the README asks people not to charge money, but MIT allows it. Check all card backs and backgrounds for look-alikes of Wizards branding (two card backs were removed for this), and check use of Scryfall against its API guidelines. This is not legal advice; Chris may want a quick professional opinion.
4. **Saved-data safety.** Add a test that loads saved decks, collections and backups from older versions into the current one, and decide what compatibility 1.0 promises.
5. **Relay abuse protection.** Room codes are 5 characters from a 32-character set (about 33 million codes) and the relay has no rate limiting. Confirm what stops a stranger who guesses a code, and consider throttling admin passphrase attempts. The admin passphrase itself is already required to be at least 20 characters and compared safely.

**Should have:** a bug-report link, a short known-limitations list, a stated list of supported browsers, and a "relay is down" note for the owner.

**After 1.0:** the automation ideas (#55, #58, #62–65), #48, #4, #45 and #66.

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

### 66. Life points at the top middle of the board — Idea only

Consider moving life points to the top middle of each player’s board. Placement and its relationship to the player’s name are undecided.
