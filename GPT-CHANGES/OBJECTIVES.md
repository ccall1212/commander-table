# Commander Table — Objectives backlog

Features Chris has asked for that are **not built yet**. The numbers are Chris's original numbering; finished ones (1, 2, 3, 6, 8, 10, 13) were removed, and #7 (opponent boards looking dim) was dropped: the dimming only applies to players who are reconnecting or out, on purpose. Work on one at a time on its own branch and pull request, and read `AGENTS.md` first.

Status key: **Queued** = requested, not started. **Paused** = started, waiting on something. **Deferred** = on purpose not now.

Layouts that exist: **Sidebar** and **Grid** only. Every feature must be checked in both, at roughly 1920×1080 and 1366×768, with a second player watching if other players see it.

---

## 4. Larger battlefield cards on big displays — DEFERRED

Cards feel a little small when the browser is maximized on a 2K display (the size is fine at 1920×1080).

- Aim for roughly 15–20% larger cards at larger resolutions, where space allows; do not change how it looks at 1920×1080 and below.
- **Where to look:** in Sidebar your own board is drawn at its natural scale (limited by width). In Grid and in the opponent miniatures the board is auto-fitted: `computeFit()` in `js/app.js` picks the card size, and its `capPx` caps card width (56 px in miniatures, 150 px for a big board). Changing those numbers is the likely lever, but check that crowded boards still fit.
- Avoid clipping or overlapping cards more than today.

## 5. One-time "slam" animation when a card is played — QUEUED

When a Commander moves from the command zone to the battlefield, play a brief slam animation with a glow in the card's colour identity. Optionally do the same the first time a card with mana value 8 or more enters the battlefield.

- Trigger on the play event only, never on later dragging or repositioning.
- Keep it short, make it click-through, and respect `prefers-reduced-motion`.
- **Where to look:** card moves go through `moveCard()` / `doMove()` in `js/app.js`. The draw-card animation (`animateDrawCard()` and the `drawfx` message) is a working example of a click-through overlay effect that other players also see; copy its approach (a small host-validated message carrying no hidden information).

## 9. Choose a random deck from Archidekt or Moxfield — PAUSED

See [PR-11-DECK-IMPORT-INVESTIGATION.md](PR-11-DECK-IMPORT-INVESTIGATION.md). Draft PR #11. Do not merge or publish it until the live tests listed there pass.

## 12. Targeting arrows between cards (Forge-inspired) — QUEUED

Let a player draw an arrow from one card (or player) to another so the table can see what an effect targets.

- Right-click a card → **Send arrow to…**, then click the target (any player's battlefield). Everyone sees the same arrow. Make cancelling and clearing easy.
- Arrows are visual only: they must never move cards or change game state. Keep the existing right-click menus, dragging and touch behaviour working.
- **Where to look:** cross-player actions are messages relayed by the host, which validates the sender (see how `drawfx` is validated in `hostRecv`). Arrows need the same treatment, and must survive layout changes and the board scaling, so anchor them to card ids (`data-iid`), not pixel positions, and redraw after each render (`setHTML()` patches the DOM in place and cards are matched by `data-iid`).
- Start with one simple arrow at a time; decide colours/labels and the exact menu wording during implementation.


## 14. Show and search all available card printings — MERGED (v0.19.0 tag pending)

The card-printing switcher currently shows at most 10 versions, which is not enough for some heavily reprinted cards.

- Show all printings available from the app's existing card-data source instead of arbitrarily limiting the list to 10.
- Add a search/filter so players can find a printing by the set or product it came from; show the set name and set code/year where the data source provides them.
- Keep the picker usable for cards with many printings. Search should filter the available results, not silently remove printings from the underlying list.
- Selecting a printing must continue to change the displayed card without changing its identity or other game state.
- During implementation, confirm the card-data source's actual limits and fields before promising that every historical printing can be retrieved.

## 15. Upload custom table backgrounds and card backs — QUEUED

Allow players to upload their own image for a table background and/or card back, if the current rendering and settings structure can support it cleanly.

- Clearly show the required/recommended pixel dimensions, aspect ratio, and supported file types beside the upload control **before** the player chooses a file. Derive these requirements from the actual rendering behavior rather than guessing dimensions.
- Explain whether the image will be cropped, stretched, or fitted, and provide a preview if practical.
- Validate files and handle oversized or unsupported images with a clear message; avoid breaking the table if an image fails to load.
- Define whether uploads are local to that player's browser or shared with other players before implementation. Do not upload user images to a server unless that is explicitly designed and explained.
- Keep default backgrounds and card backs available, with an easy way to restore them.

## 16. Put newest actions at the top of the game log — IN PROGRESS

- Show the latest action at the top and older actions below it.
- Keep the log at the top when new actions arrive if the player is already viewing the newest entries; do not jump them back up while they scroll down to read history.
- Do not add card-printing changes to the game log. They are visual preferences, not meaningful game actions.
- Check Sidebar and Grid layouts, both 1920×1080 and 1366×768, and confirm a second player sees the same meaningful game log.

## 17. Separate floating chat notifications — QUEUED

Add a lightweight chat experience that is separate from the action log. New messages should briefly appear as an unobtrusive floating overlay and then fade away.

- Show who sent the message and the message text; use a short, readable fade-out delay.
- Provide a way to open or view recent chat history so messages that fade away are not permanently lost.
- Synchronize messages with the other players in the room using the existing host-validated networking approach; chat must not change game state or reveal hidden information.
- Keep the overlay out of the way of cards and controls, support different screen sizes, and respect `prefers-reduced-motion`.
- Decide whether players can mute/hide the overlay and how long chat history lasts during implementation.
