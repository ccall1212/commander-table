# iPhone Touch mode table height — v0.46.2 test copy

Extract the ZIP and double-click **index.html**; no terminal or local server is needed. This change is not published yet.

1. On an iPhone in landscape, open a saved game or enter Practice solo with a deck. Compare Touch mode off and on. The battlefield and hand should use the same available screen height in both modes; turning Touch mode on must not leave a large blank area below a thin table.
2. Open ☰ and turn Touch mode off and on again. The menu and table should remain visible after each switch. Rotate to portrait and back to landscape; the game should refill the screen both times. Dismiss the portrait landscape tip if it appears.
3. If possible, try a room with another player in Sidebar and Grid. Check that your hand, battlefield and opponent board stay visible, and that card dragging still works in Touch mode.

Chris tested v0.46.1 on a real iPhone in landscape and reported the table collapsing into a narrow band with blank space below. This copy addresses that observed problem; Chris has not tested v0.46.2 yet.

## Assistant verification

In mobile Chromium at 844×390 landscape and 390×844 portrait, Touch mode filled the full viewport while the page reported an artificially short visual viewport height of 170px. The top bar, battlefield and hand stayed within the game area with no page errors. A real iPhone Safari retest, multiplayer, Sidebar/Grid and direct file:// opening remain unverified here. Paused draft PR #11 is untouched.
