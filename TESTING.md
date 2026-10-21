# Opening readiness — Objective #37, v0.40.0 test copy

Extract the ZIP and double-click **index.html**. For shared-game checks, use two separate browsers or devices. Keep internet access on for online play.

## Click list

1. Host a room using each opening-hand rule in turn: London, At least 3 lands, and Draw 10, bottom 3. Join with a second player.
2. Before either player keeps, confirm **Start game** is disabled and the lobby names both players as still choosing. From a hand card, try the **B** hotkey and the right-click **Play** action; the card should stay out of the battlefield with an explanation.
3. Keep the host's hand. Confirm the guest remains listed and Start stays disabled. Have the guest mulligan; it should remain listed. For Draw 10, bottom three cards; the guest remains listed until all three selections are finished.
4. Have the guest keep. Confirm both names clear and Start becomes available. Undo the guest's Keep and confirm the host sees the guest pending again. A completed keep from an older deal must not satisfy readiness after a redeal or new game.
5. Confirm the host can start after everyone currently seated and not out has kept. The usual roll for turn order should happen, and hand-to-battlefield moves should work afterward. Try **Undo** after Start; it must not reopen a mulligan or restore an unkept opening snapshot.
6. While a player is pending, try dragging a card, making a token or copy, giving/returning control, and taking back a controlled card. None should enter the battlefield or disappear from its source.
7. Repeat the readiness and Start checks in Sidebar and Grid at 1920×1080 and 1366×768. Confirm only names and keep status appear; card identities remain private.

## Assistant checks

- `node tests/test_opening_readiness.cjs`: Start rejects unkept and stale-deal status, ignores repeated Start, starts when the host and every live seat have kept the current deal, and clears opening-hand undo history at Start. Undo cannot reopen a mulligan, while a late joiner can still keep after Start. It also checks that pre-start movement, token/copy creation and control-change paths stay blocked, while insertion works after Start. Public readiness adds only the current deal ID beside the existing kept flag and hand count.
- `node tests/test_mulligan.cjs` and `node tests/test_token_picker.cjs`: London, three-lands and Draw 10/bottom-three behavior remains covered; pre-start token quantity creation is rejected before the prompt.
- `node tests/test_moderation.cjs`: passed.
- Reproduce the Chromium pass with `python3 -m http.server 8106 --bind 127.0.0.1`, then `node tests/test_opening_readiness_browser.cjs` (requires Playwright, Chromium at `/usr/bin/chromium`, and the configured relay). Two browser contexts connected through the relay: Sidebar and Grid at both 1920×1080 and 1366×768; Draw 10 stayed pending through all three bottom selections; pre-start B hotkey and right-click Play left the card in hand; a guest reload preserved the pending current deal; after Start, B moved a card to the battlefield; Start a new game reset both seats to pending. No page errors occurred. The test called `Net.stop()` in both browser contexts and closed them when done.
- The browser pass did not exercise pre-start drag, incoming give/return/take requests, undo Keep, or a reconnect from a stale opening-deal snapshot. Node checks cover the network request guards and stale-deal Start rejection. Chris can use the click list above for the remaining browser checks.
