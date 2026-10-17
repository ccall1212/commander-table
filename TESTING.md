# Manual test checklist — Draw Animation (v0.18.2 candidate)

This ZIP contains the v0.18.2 candidate for the card-draw animation. Please focus on the draw-flight tests first; the selection-rectangle regression checklist is retained below.

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

## Draw animation click list

1. **Single draw, Sidebar:** start Practice solo at 1920×1080 and click your Library once. The card should lift out of the stack, travel along a shallow arc, flip during the flight, and ease into its hand slot without a pause, gap, or last-frame jump.
2. **Draw several cards:** right-click your Library → **Draw X…** → enter 3. Each card should fly and become visible in the hand as its own animation finishes; they should not all pop into view after the last flight.
3. **Grid:** switch to Grid and repeat the single draw and Draw X tests in your own quadrant.
4. **Second player:** if convenient, repeat a draw in an online game. The other player should see a card-back-only flight and never see the drawn card's face.
5. **Smaller screen:** repeat in Sidebar or Grid at 1366×768 if convenient.

Please note whether the card starts from the top of the Library, whether the upward arc feels natural, and whether it settles cleanly into the hand.

## Selection rectangle regression checks (v0.18.1)

1. **Sidebar:** drag from an empty area of your battlefield around three cards across Creatures and Lands. Release, then drag a selected card. The drag preview should show every selected card in the same relative arrangement—not only the card you grabbed. The cards should move together and keep their spacing.
2. **Grid:** repeat the test in your own quadrant.
3. **Selection controls:** hold Shift while drawing to add to the selection. Shift-click a card to toggle it. Click empty battlefield space or press Esc to clear.
4. **Existing actions:** click one card to tap/untap it, and drag an unselected card; only that card should move.
5. **Zone drop:** drag a selected group to your Graveyard; the whole group should move.
6. **Multiplayer:** drag a selected group onto another player's battlefield; the whole group should transfer control.
7. **Arrange Zones:** open Arrange Zones; any selection should clear, and starting a rectangle should be disabled while arranging.

Try both 1920×1080 and 1366×768 if convenient. Record which steps were repeated and anything that behaved unexpectedly.

The feature was merged to main in v0.18.1. The published game is https://ccall1212.github.io/commander-table/. For code regression tests, use a local checkout of main and follow this checklist.
