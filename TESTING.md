# Commander Table v0.32.0 test copy

Download this branch ZIP, extract it, and double-click **index.html**. No terminal, installation, or local server is needed. Keep internet access on for card images and online play.

## Token gallery — published in v0.30.0

Tested by Chris on the final v0.30.0 test copy: “Perfect, push and merge and Publish.” He approved the token gallery, quantities, automatic return to the battlefield and matching artwork revision on 2026-10-21. His specific device and multiplayer coverage was not stated. This feature is included here because v0.32.0 builds on that published release.

Assistant checks on the approved token revision used Playwright/Chromium over localhost HTTP. Equivalent Treasure artwork grouped together; same-name Soldier fixtures with different stats stayed separate. Creation closed the picker in Sidebar and Grid at 1920×1080 and 1366×768. A second connected player received four batches of three tokens. Gallery artwork selection and battlefield **Switch printing…** loaded real Scryfall token printings; switching preserved instance ID, tapped state, counters, position and ownership, and the other player saw the new art. **Use for all copies** changed matching tokens. No page errors were observed. These checks applied to v0.30.0, not Chris's testing of this backup branch.

## Collection backup and restore — pending Chris's testing

1. Save two decks. In Deck Builder, choose a recognizable printing for at least one card. Choose a card back and background, optionally upload an image, and enter a saved name.
2. On the opening screen, click **Back up / restore… → Download backup** and keep the `.json` file.
3. Open this extracted copy in a second browser, select that file in **Back up / restore…**, and review the preview. Leave the preferences checkbox off and click **Restore and reload**. Both decks and their selected printings should appear; this browser's name and appearance should stay as they were.
4. Restore the same file again. Matching decks should be skipped. Check **Also restore saved preferences and appearance**, restore, and verify the saved name, appearance and display preferences now match the source browser.
5. Change a restored deck, then select the original backup again. Preview should offer a restored copy; confirm and verify both versions remain available and other decks are unchanged.
6. Select a plain decklist `.txt` file or invalid JSON. A clear error should appear and Restore should stay disabled. Close a valid preview without restoring and verify the collection remains unchanged.
7. Check the dialog at 1920×1080 and 1366×768. Long previews should remain usable and Close should stay reachable. Start Practice solo after restore and verify the selected printing and linked token artwork still work. Sidebar/Grid in a two-player room should still work; backup controls only appear before a game.

Chris has not tested backup and restore on this branch yet. Assistant automated and browser results will be reported separately. Publication of this branch still requires Chris's explicit approval.

The managed browser blocks direct `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; assistant browser checks use localhost HTTP. This does not replace Chris's normal extracted-copy check. The deck randomizer/import draft PR #11 remains paused.
