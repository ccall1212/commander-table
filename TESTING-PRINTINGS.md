# Test checklist — all card printings (v0.19.0 candidate)

1. Extract the branch ZIP.
2. In the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`.
3. Open `http://127.0.0.1:8099/index.html`.
4. Import a deck and start a solo practice game.
5. Right-click a card with many reprints (for example, Sol Ring) and choose **Switch printing…**.
6. Confirm the list shows more than 10 printings when Scryfall has them.
7. Search for a set name, set code, collector number, and year; confirm the list filters, then clear the search to restore all results.
8. Pick a printing and confirm the art changes. If multiple copies are present, test **Use for all copies**.
9. Repeat in Sidebar and Grid at approximately 1920×1080 and 1366×768. Check the browser console for errors.
10. Stop the local server with Ctrl+C.

The printing list is fetched from Scryfall, so these checks require an internet connection.
