# Deck Builder checks — v0.38.0 test copy

Extract the ZIP and double-click **index.html**, with internet access for card images and online features. No terminal or installation is needed. This refresh carries forward the published moderation and recovery work, private room backups, entry colors, mulligan rules, room chat, and targeting arrows.

## Chris's testing and approval

Tested by Chris: he reports that he tested both refreshed ZIPs (#29 Deck Builder checks and #30 collection backup) and approved their publication. His message did not specify device, browser, or individual click coverage.

## Click list

1. Open a saved deck in **Deck Builder**. Check the displayed total includes commander(s); remove a commander and set a Commander candidate to confirm the count and missing-commander note update.
2. With partner commanders, verify a card matching either identity is accepted. Add a card outside the combined identity and confirm it appears in **Review notes**.
3. Add a duplicate nonbasic card and confirm likely duplicates are noted. Basic lands, Seven Dwarves (up to seven), and Rat Colony (any number) should be treated as common printed exceptions.
4. Expand/collapse **Review notes**, dismiss the summary with **×**, remove a card, close and reopen Deck Builder. Editing should update the count and notes; reopening should restore the summary.

## Assistant-run checks

- Actual Chromium (`/usr/bin/chromium`) over local HTTP at port 8108 passed `tests/test_deck_editor_browser.cjs`: commander-inclusive counts; partner color identity; out-of-identity warnings changing after a commander edit; duplicate grouping and printed exceptions; dismissal, card removal and reopening; 1920×1080 and 1366×768; no page errors.
- `tests/test_deck_health.cjs` and the available moderation, mulligan, color, chat, targeting, power/toughness and token suites passed. JavaScript syntax, version metadata and all local asset cache versions passed.
- The existing recovery browser suite and room-vault integration test were not rerun for this focused Deck Builder refresh. They need Miniflare, which is not installed in this checkout. Their existing main-branch coverage and previously recorded results remain unchanged; Chris's ZIP testing is reported separately above.
