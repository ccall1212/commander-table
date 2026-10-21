# Personal Undo — Objective #35, v0.41.0 test copy

This copy also includes Objective #37's opening-hand readiness (PR #58) and all published v0.39.0 features. Extract the ZIP and double-click **index.html**; no terminal or installation is needed. Keep internet access on. For multiplayer checks use two browsers/devices, and try Sidebar and Grid at 1920×1080 and 1366×768.

## Click list

1. Host and join with a second player. Keep both opening hands, then Start. Check that Start stays disabled until both keep and cards cannot enter the battlefield beforehand.
2. Change your life twice and tap a card. **Undo** / **Ctrl+Z** should reverse only your latest personal action. The dropdown beside Undo shows **Before:** entries; select an earlier one and confirm. Your later changes should disappear while the other player's board and the shared turn stay in place.
3. During your turn choose **Undo dropdown → Save phase checkpoint → Combat**. Change your life, move a card, then select **Combat checkpoint** and confirm. Only your board returns to that saved state. Cancelling the confirmation changes nothing.
4. Give a card to the other player through its right-click menu or drag it onto their board. Both histories should reset. Undo must not produce a second copy. Return it to its owner and try again. An incoming life or commander-damage change should also reset the recipient's history.
5. Pass the turn. Old entries should disappear. When your turn begins again, the starting checkpoint includes the normal automatic draw/untap. Restoring must not draw an extra card. Creating a token, undoing it and creating another must keep card IDs unique.
6. Open the history dropdown at both sizes/layouts, including a long history. The menu should stay within the window and scroll. Automatic resizing of default battlefield geometry can reset history; manual zone arrangements retain their usual behavior.
7. Reload and confirm the current game survives, with a fresh empty personal history. History from a discarded entry, completed handoff or earlier deal must not be reusable.

## Assistant checks

- `node tests/test_personal_undo.cjs` passes: personal labels and older restores; other board/shared table unchanged; monotonically increasing card IDs and retained definitions; incoming life/commander-damage and card transfer boundaries; stale menu/confirmation rejection; manual and automatic checkpoints; turn automation markers; bounded history and no-op actions. A room backup advancing its revision while a confirmation is open no longer blocks restoration or rewinds that revision.
- The combined opening-readiness, token-picker, P/T, moderation, mulligan, player-color, targeting, token-printing, backup, deck-health and chat suites pass. Syntax, cache-version and diff checks pass.
- Actual Chromium with two contexts over HTTP :8105 and the actual unchanged relay Worker running locally in Miniflare :8112 passed toolbar Undo, dropdown restore held open across an asynchronous room save, manual Combat checkpoint, unchanged shared phase/other board, UI Give Control transfer and incoming life request, and long-menu viewport/scroll behavior in Sidebar/Grid at 1920×1080 and 1366×768. State fixtures used CT.act; Undo, history selection/confirmation, checkpoint saving, transfer and life-request interactions used the UI. Shared-phase changes were driven through hostRecv because the game has no phase toolbar. No page errors. This used a real local relay, not a transport stub or the production service.
- Objective #37's separate browser pass used two contexts with the configured relay: both layouts/sizes, Draw 10 bottom-three readiness, pre-start B/menu rejection, pending guest reload, post-start movement and New Game reset; no page errors. See tests/test_opening_readiness_browser.cjs.

Tested by Chris: he reports the Undo button works as it should, likes #37 and tested the combined response copy. Publication of the combined features was approved with the final opening-label and response-color adjustments. This v0.41.0 integration retains the published v0.40.0 rule-label change; the larger pre-game wording redesign remains a suggestions follow-up. Assistant browser checks used localhost HTTP; extract-and-double-click testing is the human flow above. No real-device Safari or subjective audio result is claimed. Paused draft PR #11 remains untouched.
