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

### 67. 1.0 readiness — In progress

Goal: version 1.0 means the game is safe to share beyond friends, and what players have saved keeps working. The game stays a rules-free sandbox, so rules automation is not a 1.0 requirement. Touch support stays labelled **Beta** at 1.0 (Chris's decision, 2026-10-29); #18 continues afterward.

**Done:** automatic checks on every pull request (v0.56.0); PeerJS bundled instead of loaded from a CDN (v0.56.0); Report a bug and Privacy links and a Privacy section in the guide (v0.56.0); license changed to PolyForm Noncommercial (docs); accessibility pass on dialogs, labels and landmarks, supported-browsers list and an Accessibility section in the guide (v0.56.1).

**Still to do (Chris asked to finish all of these except full touch support):**
1. **Lock down a room.** Let the host stop new players from joining (and decide how blocking a kicked player works). Kicking currently blocks only that browser's saved ID, so a fresh tab or private window may get back in, and anyone with the 5-character room code can join. Design is pending Chris's choice (lock only, host approval of each joiner, or both). Must be enforced by the host, validated like other host messages, and tolerated by older clients.
2. **Release-candidate multiplayer test.** A full 4-player game in real Chrome, Edge, Firefox and Safari, including the host dropping out, a laptop sleeping and rejoining. Record who tested what. Needs real people; an assistant can prepare the checklist.
3. **Artwork and Scryfall audit.** Check all card backs and backgrounds for look-alikes of Wizards branding (two card backs were removed for this), and check use of Scryfall against its API guidelines. Consider a quick professional opinion on the license change and the Fan Content Policy. Not legal advice.
4. **Saved-data upgrade test.** Load saved decks, collections, backups and saved games made by older versions into the current one, and decide what compatibility 1.0 promises.
5. **Relay abuse protection.** Room codes are 5 characters from a 32-character set (about 33 million codes) with no rate limiting on the relay, and admin passphrase guesses are not throttled (the passphrase itself must be at least 20 characters and is compared safely). Relay changes deploy through Cloudflare and must stay backward compatible.
6. **Accessibility leftovers.** Cards on the table cannot be used from the keyboard alone, and the Deck Builder's card list has small buttons nested inside list items. Text over background images was not checked by the automatic scanner, so contrast there needs a manual look.

**Should have:** a short "relay is down" note for the owner, a known-limitations list in the guide, and the sync code (#68) if it is ready in time (1.0 can ship without it).

**After 1.0:** the automation ideas (#55, #58, #62–65), #48, #4, #45 and #66.

### 68. Sync code to move decks between computers — Queued

A friend wants his saved decks on more than one laptop. Today the only way is Deck Builder → Back up / restore: download a file, send it to yourself somehow, and restore it, which Chris finds clunky. Chris chose a **sync code** over full logins (accounts would break the "no accounts" promise and add password, email, privacy-law and support work). The browser-only game stays exactly as it is for anyone who does not use it.

**How it should work**
- Deck Builder gets **Sync across computers…**. **Create sync code** makes a long random secret (at least 80 bits, shown in groups such as `XXXX-XXXX-XXXX-XXXX`) and uploads the collection. On another computer, **Use a sync code** takes the code and downloads the collection.
- Start with explicit **Upload this computer's decks** and **Download decks from sync** buttons, not automatic syncing. Downloading reuses the existing restore rules (nothing is deleted; exact matches are skipped; changed decks with the same ID arrive as **(restored)** copies), so two laptops can never overwrite each other silently.
- **Encrypt in the browser** with a key derived from the code, and store it on the relay under an ID derived separately from the code, so the server and anyone who sees its storage cannot read the decks and never sees the code itself. Say plainly in the guide's Privacy section that anyone who has the code can read and replace the synced decks, so it must be kept private, and that a lost code cannot be recovered (the local copy and file backups still work).
- Decks, tokens, printings and preferences only. Leave out uploaded images, chat, saved games and room identities, as the file backup does. Cap the stored size (the relay's room vault uses about 900 KB) and expire a synced copy after a long period of no use, with a **Delete synced copy** button.
- On the relay: new sync endpoints with the same origin checks as the rest, size and rate limits, and a stored-data check that matches the restore validator. Advertise a `sync-v1` feature so the browser only offers sync when the relay supports it, and keep older relays and older browsers working. Relay changes deploy through Cloudflare, so keep them backward compatible.
- Keep Back up / restore as it is, as the offline fallback.

**Done when:** a second browser can pull decks made in the first with only the code, the server holds only unreadable data, a wrong or expired code gives a clear message, and tests cover the encryption, the stored format, the size limit and the merge rules. Needs a real two-computer test by Chris.

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
