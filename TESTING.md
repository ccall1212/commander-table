# Hotkeys — v0.51.0 test copy (Objective #46)

Extract this branch ZIP and open `index.html`. These changes are on a test branch; the published game stays at v0.50.1 until Chris approves them.

1. Start a Practice game, keep your opening hand and start the game. Play a card onto the battlefield, hover it and press **C**. A token copy should appear. Holding C should create only one copy per press. C over a hand card should do nothing. Before Start, no card copy should enter the battlefield.
2. With two browsers in a room, hover a visible opponent card in Sidebar and press **C**. The copy should appear on your board. Repeat in Grid and while viewing that opponent's board. A face-down or otherwise hidden card must not be copied.
3. Open **☰ → Hotkeys**. Choose **Set** beside **Copy hovered visible card**, try an already-used key such as **G**, then assign **P**. The dialog should explain the conflict, accept P, and show it in the list and the card's right-click Copy menu. P should copy and C should no longer copy. Try a browser shortcut such as Ctrl+R; it should be rejected.
4. Change another shortcut, such as Draw or In response, and verify the new key works while its old key does not. Type that key in chat or another input: it should only type. Change the magnifier shortcut and hold it to inspect a card. Reset one shortcut, then restore all defaults. Reload the game; custom keys should persist until reset, and other players' shortcuts should remain their own.
5. Repeat card and shortcut checks in Sidebar and Grid at about 1920×1080 and 1366×768. The Hotkeys dialog should remain readable at a narrow viewport. Existing Undo, Space to pass, Library shuffle/mill, and T on an empty battlefield should still work.

## Assistant verification

Node syntax checks and the existing response/opening checks passed. A Node shortcut-registry test passed for defaults, contexts, conflicts, customization and reset. Chromium in a Practice game at 1366×768 and 1920×1080 confirmed C on a battlefield card, blocked C in hand, custom P and conflict feedback, right-click hint, public opponent-card copies in Sidebar and Grid, a face-down opponent-card block, ignored input typing, customized magnifier key release, and persistence after reload. Opponent boards in that browser check were simulated public snapshots; a live two-player relay test and Chris's hands-on check remain open. Draft PR #11 remains paused.
