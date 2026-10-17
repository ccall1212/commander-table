# Test Commander Table — Selection Rectangle (v0.18.0 candidate)

This is a test copy of the unmerged selection-rectangle feature.

## Start the app

1. Extract the ZIP to a folder.
2. Open a terminal in that folder.
3. Run:

   ```bash
   python -m http.server 8099 --bind 127.0.0.1
   ```

4. In your browser, open http://127.0.0.1:8099/index.html
5. Start a Practice game with a deck that has several battlefield cards. To test online group control, host a game and join from a second tab as described in AGENTS.md.
6. Stop the server with Ctrl+C when finished.

## Click list

1. **Sidebar:** drag from an empty area of your battlefield around three cards across Creatures and Lands. Release, then drag a selected card. The cards should move together and keep their spacing.
2. **Grid:** repeat the test in your own quadrant.
3. **Selection controls:** hold Shift while drawing to add to the selection. Shift-click a card to toggle it. Click empty battlefield space or press Esc to clear.
4. **Existing actions:** click one card to tap/untap it, and drag an unselected card; only that card should move.
5. **Zone drop:** drag a selected group to your Graveyard; the whole group should move.
6. **Multiplayer:** drag a selected group onto another player's battlefield; the whole group should transfer control.
7. **Arrange Zones:** open Arrange Zones; any selection should clear, and starting a rectangle should be disabled while arranging.

Try both 1920×1080 and 1366×768 if convenient. Tell Chris which steps you tested and anything that behaved unexpectedly.

This test build has not been merged or published. Do not use it as the live version.
