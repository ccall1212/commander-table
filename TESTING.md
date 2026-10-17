# Manual test checklist — all card printings (v0.19.0 candidate)

## Start the app

1. Extract this ZIP to a folder.
2. Open a terminal in that folder.
3. Run `python -m http.server 8099 --bind 127.0.0.1`.
4. Open http://127.0.0.1:8099/index.html.
5. Import a deck and start a Practice game. An internet connection is needed to load printings from Scryfall.
6. Stop the server with Ctrl+C when finished.

## Card printing click list

1. **More than 10 results:** right-click a card with many reprints (for example, Sol Ring) → **Switch printing…**. Confirm the list contains more than 10 printings if Scryfall has more available.
2. **Search by set/product:** search a set name (for example, a set/product name shown in the results) and confirm only matching printings remain.
3. **Search by code and number:** search a set code and a collector number; confirm matching results remain.
4. **Search by year:** enter a year shown in the list and confirm matching results remain.
5. **Clear search:** clear the search field and confirm all fetched printings return.
6. **Change one card:** choose **Use this printing** and confirm the art changes.
7. **Change all copies:** with two or more copies of the same card, choose **Use for all copies** and confirm every copy changes.
8. **Sidebar and Grid:** repeat the picker in both layouts at approximately 1920×1080 and 1366×768. The dialog should fit the screen and the list should scroll.
9. **Keyboard and no-results:** Arrow Up/Down should navigate visible results when the search field is not focused. A search with no matches should show a clear empty message.
10. **Console:** check the browser console for errors during loading, filtering, and selecting a printing.

The app should still show the current printing, preserve the existing **Use for all copies** behavior, and never change any card until a printing is chosen.
