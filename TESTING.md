# Commander Table v0.31.0 — test copy

Download the branch ZIP, extract it, and double-click **index.html**. No terminal, installation, or local server is needed. Keep internet access on for card images and online play.

## Chris's testing status

Chris tested the token gallery on the separate v0.30.0 test copy and said, “Perfect, push and merge and Publish.” He approved the token gallery, quantities, automatic return to the battlefield, and matching artwork revision; that release is published as v0.30.0. His approval does **not** cover the Deck Builder checks in this v0.31.0 test copy. No human test of the Deck Builder checks is recorded yet.

## Click list

1. Open a saved/imported deck in **Deck Builder**. Check the summary includes commander(s) in the total.
2. Remove a commander and check the missing-commander note. Right-click a Commander candidate and choose **Set as commander**; confirm the summary updates.
3. Add a card outside the combined commander color identity. For partner commanders, check a card matching either identity is allowed.
4. Add a second copy of a nonbasic card and check for a duplicate note. Basic lands and cards such as Seven Dwarves or Rat Colony should not be flagged for their allowed copies.
5. Expand and collapse **Review notes**, dismiss the summary with **×**, close and reopen Deck Builder, and continue editing.
6. In a game, open **☰ → Tokens**. Check token pictures appear once each with search/filter/sort and **Search all tokens…**. Choose a token, enter 3, create it, and confirm the gallery closes and three tokens appear. Undo should remove the batch together.
7. Repeat token creation in **Sidebar** and **Grid** at approximately **1920×1080** and **1366×768**. Try cancel and invalid quantities. Check related-token suggestions, artwork selection, and battlefield token printing changes if convenient.

## Automated checks

- `tests/test_deck_health.cjs`: commander-inclusive count, missing commander, combined identity, legacy missing-color data, duplicate grouping, basic lands, printed any-number/up-to-N exceptions, and large quantities without per-copy expansion.
- `tests/test_token_picker.cjs` and `tests/test_token_printings.cjs`: token picker behavior, semantic grouping, quantity validation/cancellation, and printing lookup/update compatibility.
- Existing node suites, JavaScript syntax, all local cache links and app/meta version agreement.

## Assistant-run browser checks

- Deck Builder was opened in headless Chromium through localhost HTTP at 1920×1080 and 1366×768. With 99 warning notes expanded, the list remained scrollable and the header/close control stayed within the viewport. Dismiss/reopen, commander removal/replacement, and card removal refreshed the summary. No console errors were observed.
- The **+ Add card** search for Sol Ring returned HTTP 200 from Scryfall; its image also returned HTTP 200.
- In Practice solo, the merged token gallery opened from **☰ → Tokens**; selecting the Treasure fixture, entering 2 and choosing **Create X Tokens** created two battlefield tokens and closed the gallery. No console errors were observed.
- Token gallery and printing browser checks are recorded in the published v0.30.0 test notes: equivalent real Treasure printings grouped, different-stat Soldiers remained separate, batches were created and undone, gallery artwork choices and battlefield printing changes propagated to a second player, and no page errors were observed.
- Direct `file:///` navigation is blocked by the managed browser policy (`ERR_BLOCKED_BY_ADMINISTRATOR`). Assistant browser checks use localhost HTTP; this does not substitute for Chris's extracted-copy check.
