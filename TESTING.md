# Manual test checklist — newest-first game log (v0.19.1 candidate)

## Start the app

1. Extract this ZIP.
2. In the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`.
3. Open `http://127.0.0.1:8099/index.html`.
4. Import a deck and start a Practice game. For shared-log checks, open a second browser tab and join the same room.
5. Stop the local server with Ctrl+C when finished.

## Click-by-click checks

1. **Newest first:** open the 📜 Log. Confirm the most recent action is at the top and older actions appear below it.
2. **Live updates:** perform several actions (draw, tap a card, move a card). Confirm each new entry appears at the top.
3. **Read history:** scroll down to older entries, then perform another action. Confirm the log does not yank you back to the top while you are reading older entries.
4. **Reopen log:** scroll down, close the log, then open it again. Confirm it returns to the newest entry at the top.
5. **No printing spam:** right-click a card → **Switch printing…** → choose a different printing. Confirm the art changes but no printing-change entry appears in the log.
6. **Saved deck still works:** reload/reopen the deck or start a new Practice game and confirm the chosen printing is remembered.
7. **Multiplayer:** with a second tab/player, change a printing and confirm the card art still synchronizes, but neither player's game log records the printing change. Confirm normal game actions still appear for both players.
8. **Layouts and sizes:** check Sidebar and Grid at approximately 1920×1080 and 1366×768.
9. **Console:** check the browser console for errors.

Expected: the newest action is always the first visible entry when the log is opened, older actions remain scrollable below, and printing changes never add a log entry.
