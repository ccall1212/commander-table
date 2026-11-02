# Use one set for the whole deck — v0.61.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed. You need an internet connection (it asks Scryfall).

1. Open **Deck Builder** on a saved deck (ideally one with several basic lands and some other cards). At the bottom, click **Use one set…**.
2. A list of sets appears. Type **Final Fantasy** (or **FIN**): the list narrows. Click the set.
3. A box asks to confirm and says how many cards will change, how many already are from the set, and which cards are not in the set (those stay as they are). Click **Switch to …**.
4. The deck's cards should now show that set's artwork. Basic lands with several versions in the set should be a mix of different versions, not all the same one.
5. Cards that are not in the set (for example an older card) should keep their old artwork.
6. Right after switching, a notice at the bottom has **Undo**. Click it: the old artwork comes back everywhere.
7. Try a set that has none of your cards (for example an old set like *Limited Edition Alpha* if you have no old cards): it should just say none of your cards were printed there, and change nothing.
8. Optional: start a practice game with the deck and check the cards use the new artwork.

## Assistant verification

- **Unit tests (Node):** new `test_set_assign` (runs in the automatic checks) covers the set list, reading every page of a set, grouping versions by card, random choice per copy, rows merging per printing, cards missing from the set and cards already in it left alone, and that the saved deck object is not changed until confirmed.
- **Real browser (Chromium) with a pretend Scryfall:** new `test_set_assign_browser` opens the Deck Builder, filters sets by name and code, checks the "nothing to change" message, the confirmation text, the saved deck and Undo. It does not talk to the real Scryfall, so the real set data (for example how many versions Forest has in Final Fantasy) still needs your check.
