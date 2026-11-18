# Pre-con decks and deck links — v0.79.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. You need an internet connection, because the cards are looked up on Scryfall. For the "new player" view, test in a private window (or after deleting your saved decks).

1. On the start screen, look under **Your deck**: there is a **Pre-con decks** area with a **Choose a pre-con deck…** dropdown (12 decks) and a **🎲 Surprise me** button, and a line "Want a different deck? Browse Moxfield or Archidekt". Click each link: it should open the right site in a **new tab**. (The import help text also has the two names as links.)
2. Open the dropdown and choose a deck, for example **Tidus, Yuna's Guardian**. After a few seconds it appears under Your deck as "Tidus, Yuna's Guardian · 100 cards", selected, and the dropdown marks it with a ✓. Enter a name and try **Practice solo**: you should get 7 cards in hand and your commander in the command zone.
3. Choose the same deck again: no second copy, it just selects it.
4. Click **🎲 Surprise me** a few times: each click adds a different deck you didn't have yet. Try **Frodo, Adventurous Hobbit + Sam, Loyal Attendant**: it has two commanders.
5. Delete a pre-con deck (✕): its ✓ goes away and you can add it again.
6. Turn off your internet, choose a deck: you should get a clear message and nothing is saved.
7. **Please check the lists:** open a few of these decks in the **Deck Builder** and tell me about any card that looks wrong or missing (names I could not check against Scryfall from my side). If a card cannot be found when you add a deck, the game names it.
8. Tell me: are the button names and the wording OK? Is the dropdown clear enough? Is anything in the way for someone who already has decks?

## Assistant verification
- All 12 lists checked automatically (`test_precons`): each parses into exactly 100 cards with the right commander(s), nothing skipped, singleton apart from basic lands, no repeated names. I changed one name, "Dusk/Dawn", to "Dusk // Dawn" because Scryfall would not find it without the spaces.
- Browser test (`test_precons_browser`) with Scryfall faked: the links open in a new tab, choosing from the dropdown saves a full deck with its commander and selects it, repeats and Surprise me never make copies, all 12 can be added, the two-commander deck keeps both, a missing card is named, no internet is reported with nothing saved, and a practice game starts with a pre-con deck (7-card hand, commander in the command zone). I looked at screenshots at laptop and phone widths.
- **Not tested:** the real Scryfall lookup (I cannot reach Scryfall from my side), so whether every card name is found is for you to confirm; the real look on a phone; and Grid/Sidebar (start screen only).
