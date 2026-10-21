# Commander Table v0.30.0 — token gallery test copy

Download this branch ZIP, extract it, and double-click **index.html**. No terminal, installation, or local server is needed. Keep internet access on for token images and online play.

## Chris's testing and requested refinements

Tested by Chris: he tested the earlier copies, requested **Create X Tokens** and the image gallery, then said the gallery looked good. He requested automatic return to the battlefield after creation and a way to find alternate token artwork from the battlefield. Those refinements are included here and await his review; publication is not approved. His specific device/multiplayer coverage was not stated.

## Click list

1. Start a game with a deck that makes tokens. Open **☰ → Tokens**: see token pictures once each, with search/filter/sort controls and **Search all tokens…**. There should be no repeated create-one/create-X menu rows.
2. Click a token picture: quantity starts at 1. Enter 3 and choose **Create X Tokens**. Exactly three tokens should appear, the token galleries should close, and the battlefield should be visible. Use Undo: the whole batch should disappear together.
3. Repeat with 0, 61, a decimal, a blank field, and Cancel. Invalid entries should leave the quantity prompt open; Cancel should create nothing and return to the gallery. Try keyboard filtering and Enter as well.
4. Right-click a battlefield token-making card → **Create related token…**: see only its related token pictures and use the same quantity flow. In Touch mode, use **Actions** instead of right-click.
5. Play a card with related tokens and click **Choose tokens…** in its suggestion pop-up. For cards with only one linked token, check that the quick **+ Token** action still creates one directly.
6. In the gallery, choose **Search all tokens…** and search Treasure. Click a result picture and create two. Both the search and deck token galleries should close after creating the tokens. Cancel a search without losing the deck gallery.
7. Test **Sidebar** and **Grid** at approximately **1920×1080** and **1366×768** with a second player watching. Pictures, quantity prompt and Close must remain reachable; the second player should see created tokens, with no private hand/library information revealed.
8. If a deck has no linked tokens, its empty gallery should still offer **Search all tokens…**. A missing image should show the readable placeholder.
9. Try a deck linked to different artwork versions of the same token: equivalent versions should share one gallery entry. Same-name tokens with different printed stats or abilities must remain separate. Right-click a gallery picture → **Choose artwork…**, choose another set/printing, then create a token and verify the chosen art.
10. Right-click a token on the battlefield → **Switch printing…**. Matching artworks should appear. Change just one token, then try **Use for all copies** on equivalent tokens. Tapping, counters, position and ownership must stay unchanged, and different-stat/ability tokens must not change. Have the second player watch the new art. Check a copied regular card still offers the regular card's artwork.

## Validation

Current-revision Playwright/Chromium HTTP browser checks passed:

- Equivalent real Treasure artwork variants grouped into one gallery entry; same-name Soldier fixtures with different printed stats stayed separate.
- Creation closed the picker in Sidebar and Grid at 1920×1080 and 1366×768. Four batches of three were received by a second connected player. Cancel left the gallery open, and successful creation from live Scryfall search closed both nested token galleries.
- Gallery **Choose artwork…** loaded actual Scryfall token printings and created the selected printed version. Battlefield **Switch printing…** loaded matching artwork and changed a token while preserving its instance ID, tapped state, Charge counter, position and ownership. The second player received the new art. **Use for all copies** changed matching token instances.
- No page errors were observed. JavaScript syntax and existing targeting/P/T regression suites passed. New automated token-printing tests cover pagination, different Oracle IDs, legacy/transferred metadata, stats, abilities, colors, reverse faces, and ordinary-card lookup. New picker tests cover cancellation/invalid quantities, owner changes, semantic grouping, normal versus actual token copies, and closing nested galleries on success. GPT-6 Luna handled the bounded token-lookup implementation and focused test/review work; the primary assistant reviewed and ran browser checks.

The managed browser blocks direct `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; assistant browser checks use localhost HTTP. This does not substitute for Chris's normal extracted-copy check of this revision.

The deck randomizer/import draft PR #11 remains paused. No publication is approved.
