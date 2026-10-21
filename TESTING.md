# Commander Table v0.30.0 — release checks

## Linked token quantities

Tested by Chris: he tested the token test copy and requested the label **Create X Tokens** instead of “Several.” The revised label is included in this copy. He has not yet approved publication.

Assistant Playwright browser checks were run against a local HTTP copy using Chromium and seeded deck fixtures. Human browser testing has not been done yet.

- From the Tokens menu, created 3 linked tokens and undid them with one Undo action. Quantity entries `0`, `61`, and `2.5` left the prompt open and created nothing; Cancel closed the prompt without changing state. The original direct linked-token choice still created one.
- Played a card linked to two tokens. The suggestion chooser created one token and several tokens; the card's **Create related token** menu also created one and several.
- Started a host and joined from a second browser context; both showed **Connected**. At 1920×1080 and 1366×768, clicked Sidebar and Grid and confirmed each selected view. With the host at 1366×768 in Grid, created 3 linked tokens and confirmed the joiner received all 3 on the host's public battlefield view.
- No browser page errors or console errors were observed in these runs. Direct `file://` navigation was blocked by the managed browser with `net::ERR_BLOCKED_BY_ADMINISTRATOR`; therefore the normal extract-and-open flow remains unverified. The successful browser runs used `http://127.0.0.1`.

1. Extract the test copy and double-click **index.html**. Start a two-player game and keep the second player open to check that token creation remains local to the player who created the tokens.
2. At both 1920×1080 and 1366×768, test **Sidebar** and **Grid**. Open ☰ → **Tokens**, open a linked token, create 1 and several, then try 0, 61 and a decimal. Invalid entries should keep the prompt open; Cancel should create nothing.
3. Right-click a battlefield card with a related token → **Create related token** → choose that token. Create one and several. Repeat on a card with multiple related tokens.
4. Play a card with a token suggestion. Confirm **+ Token** still creates one immediately, then use **Create X Tokens** for a quantity. Repeat with a card that suggests multiple tokens and choose a token from the menu.
5. Open **Search all tokens…**, select a result, and check **Create 1** and **Create X Tokens**, including invalid quantities and Cancel.
6. On the second player, confirm the other player's battlefield token appears in the public game view and no private card information is exposed. Check both layouts and sizes above.

## Previous release checks (v0.29.0)

For a downloaded copy: extract the ZIP and double-click **index.html**. No Python, terminal, installation or local server is needed. Keep internet access on for card images and online play.

## Recorded approval

Tested by Chris: he reviewed the multiple-arrow test copy and symbolic power/toughness test copy and said, “Both of these look good to me. Please push both of them.” Publication was authorized on 2026-10-20. Do not infer specific multiplayer/device checks beyond that report.

## Included changes

- Multiple shared arrows remain at once. Click a line to remove only that arrow. **×** hides the controls without removing arrows; **☰ → Show arrow controls** reopens them, and **Clear all** clears the collection. Empty battlefield space targets that player; names remain a fallback.
- Symbolic P/T components start at zero for manual adjustment: `*/5 → 0/5`, `*/* → 0/0`, `3/* → 3/0`. Both stats use the usual +/- controls; real counters, base overrides and reset continue to apply. Printed definitions remain available.

## Automated integration checks

- `tests/test_targeting.cjs`: four attackers, unique IDs, individual click/keyboard removal, local controls dismissal/reopen, full join snapshots, independent endpoint pruning, sender authorization, privacy and scaled geometry.
- `tests/test_power_toughness.cjs`: symbolic/numeric baselines, generated adjustment controls, independent changes, counters, overrides/reset, public-state roundtrip, undo snapshots and hidden/non-creature exclusions.
- JavaScript syntax, all 16 local asset cache links and app/meta version agreement.

## Future regression checks

1. Draw four creature-to-player arrows; remove one by its line and confirm the other three remain. Hide/reopen controls, cancel a pick and clear all. Check card/pile/life actions away from a line.
2. Adjust a starred creature's power and toughness separately, add counters, set a base and reset. Check ordinary numeric creatures and face-down behavior.
3. In Sidebar and Grid, resize the window, move an arrow endpoint and change focus. Join another player using the same version and compare all arrows and adjusted stats. Use real touch hardware when checking Touch mode.

The deck randomizer/import draft remains paused at Chris's request; it is not part of this release.
