# Commander Table v0.31.0 — release checks

For a downloaded test copy: extract the ZIP and double-click **index.html**. No Python, terminal, installation or local server is needed. Keep internet access on for card images and online play.

## Included changes

- Deck Builder shows an informational summary of the total card count including commander(s), missing commander, cards outside the combined commander color identity, and likely duplicate names. Expand **Review notes** for details; dismiss the summary with **×**. It is not a full legality validator and does not enforce house rules.
- Basic lands and cards whose oracle text allows any number or up to a stated number of copies are excluded from false duplicate warnings.

## Automated checks

- `node tests/test_deck_health.cjs`: commander-inclusive count, missing commander, combined commander identity, duplicate-name grouping, basic-land exemption, and any-number / up-to-N exceptions.
- JavaScript syntax, local asset cache links and app/meta version agreement.

## Assistant-run browser check

- Headless Chromium opened the test copy through a local HTTP server at 1920 × 1080 and 1366 × 768. Expanding 99 warning notes kept the list scrollable and the modal header/close control within the viewport. Dismiss/reopen, commander removal and replacement, and card removal all refreshed the summary. No console errors were observed.
- The **+ Add card** search for Sol Ring returned HTTP 200 from Scryfall, and its image returned HTTP 200.
- Direct `file:///` navigation was blocked by the managed browser policy (`ERR_BLOCKED_BY_ADMINISTRATOR`), so extract-and-open was not observed in this browser pass. The localhost browser run exercised the same app files.

## Try it in the browser

1. Import or select a deck and open **Deck Builder**. Check the summary count includes the commander(s).
2. Remove a commander and confirm the missing-commander note appears. Set a commander from a card and confirm the summary updates.
3. Add a card outside the commander color identity and confirm it appears in the notes. With partner commanders, check a card matching either commander is allowed.
4. Add a second copy of a nonbasic card and check for a duplicate note. Add basic lands and cards such as Seven Dwarves or Rat Colony; their allowed copies should not be flagged.
5. Expand and collapse **Review notes**, dismiss the summary with **×**, and continue editing the deck.

No human browser test is recorded for this test copy yet.
