# Commander Table v0.30.0 — token gallery test copy

Download this branch ZIP, extract it, and double-click **index.html**. No terminal, installation, or local server is needed. Keep internet access on for token images and online play.

## Chris's testing and requested refinements

Tested by Chris: he tested the earlier token copy, requested **Create X Tokens** instead of “Several,” then reported that the repeated token-menu entries looked cluttered. This revision replaces that menu with the same image gallery used by token search and lets him choose a quantity after clicking a picture. The new gallery revision has not yet been tested by Chris or approved for publication. His earlier device/multiplayer coverage was not stated.

## Click list

1. Start a game with a deck that makes tokens. Open **☰ → Tokens**: see token pictures once each, with search/filter/sort controls and **Search all tokens…**. There should be no repeated create-one/create-X menu rows.
2. Click a token picture: quantity starts at 1. Enter 3 and choose **Create X Tokens**. Exactly three tokens should appear, and the gallery should stay open. Close it and use Undo: the whole batch should disappear together.
3. Repeat with 0, 61, a decimal, a blank field, and Cancel. Invalid entries should leave the quantity prompt open; Cancel should create nothing and return to the gallery. Try keyboard filtering and Enter as well.
4. Right-click a battlefield token-making card → **Create related token…**: see only its related token pictures and use the same quantity flow. In Touch mode, use **Actions** instead of right-click.
5. Play a card with related tokens and click **Choose tokens…** in its suggestion pop-up. For cards with only one linked token, check that the quick **+ Token** action still creates one directly.
6. In the gallery, choose **Search all tokens…** and search Treasure. Click a result picture and create two. Close the search gallery to return to the deck's gallery. Cancel a search without losing the deck gallery.
7. Test **Sidebar** and **Grid** at approximately **1920×1080** and **1366×768** with a second player watching. Pictures, quantity prompt and Close must remain reachable; the second player should see created tokens, with no private hand/library information revealed.
8. If a deck has no linked tokens, its empty gallery should still offer **Search all tokens…**. A missing image should show the readable placeholder.

## Validation

Assistant Playwright/Chromium HTTP checks passed for this gallery revision:

- Real Scryfall token pictures loaded in Sidebar and Grid at 1920×1080 and 1366×768. Four batches of three tokens were created through the gallery, and the second connected player received all twelve.
- Invalid 0, 61 and 2.5 stayed in the quantity prompt and created nothing. Cancel returned to the gallery. Keyboard filtering/Enter, default quantity 1, one-step batch Undo and keeping the gallery open after creation worked.
- Related-card galleries and multi-token suggestion galleries opened the correct choices. The single-token suggestion still created one directly. Real Scryfall Treasure search used the same gallery flow and created a batch of two.
- No page errors were observed. Changed JavaScript syntax, existing targeting and P/T regression suites, source reference checks, and diff checks passed. A GPT-6 Luna agent independently reviewed the gallery flow and lifecycle guards.

The managed browser blocks direct `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; assistant browser checks use localhost HTTP. This does not substitute for Chris's normal extracted-copy check of this revision.

The deck randomizer/import draft PR #11 remains paused. No publication is approved.
