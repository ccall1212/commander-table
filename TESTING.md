# Grid menu, group moves, and turn arrows — v0.78.0 test copy

Download the ZIP, extract it, and double-click **index.html**. These changes are in the test copy only. Use two players in separate browsers or a normal and private window for the Grid check. You can also try the group actions in Practice mode.

1. With two players seated, choose **Grid** (▦). Right-click empty space on **your own** battlefield. The table menu should open with **Draw a card** at the top. Right-clicking a card, pile, or another player's board should keep its usual behavior. Switch to **Sidebar** (▥) and check that its empty-board menu still works.
2. Put at least three cards on your battlefield. Select them with a selection rectangle or Shift-click. Right-click one of the selected cards → **Move to** → **Exile**. All selected cards should move; an unselected card should stay. Press **Ctrl+Z** (or **⌘Z** on Mac) once to bring the whole group back. Try another **Move to** destination. Right-click an unselected card to confirm it still moves alone.
3. Select at least three battlefield cards again. Right-click a selected card → **Move to** → **Shuffle selected cards to library bottom**. Only those cards should be randomized and put after the cards already in your library. Open **Library** to inspect its order. One Undo should restore the group and your previous library order.
4. Draw an arrow to a card or player. Use **Pass turn** when it is your turn (or, as host, confirm a pass for someone else). The arrow should disappear for both players. A failed or cancelled pass should leave it in place.

## Assistant verification

- JavaScript and Python syntax checks passed; the version agrees in 31 places.
- All 29 dependency-free unit suites passed, including new group-move and turn-arrow checks.
- Browser tests were added for the Grid menu, group Move to, shuffled library bottom, and turn-arrow clearing. They could not be run here: the browser tool refused the local `file://` test copy under its URL policy. The browser behavior needs this hands-on check.
