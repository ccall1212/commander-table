# Pre-con decks (all 158 from 2016 on) and deck links — v0.79.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. You need an internet connection, because the cards are looked up on Scryfall. For the "new player" view, test in a private window (or after deleting your saved decks).

1. On the start screen, look under **Your deck**: a **Pre-con decks** area with a **Choose a pre-con deck…** dropdown and a **🎲 Surprise me** button, and a line "Want a different deck? Browse Moxfield or Archidekt". Click each link: it should open the right site in a **new tab**.
2. Open the dropdown. The decks are in **groups by set and year, newest first**. Look at **Final Fantasy: 2025**: it should show exactly four decks (Cloud, Terra, Tidus, Y'shtola). Scroll to the bottom: the oldest group should be **Commander 2016**, nothing from 2015 or earlier.
3. Choose a deck, for example **Tidus, Yuna's Guardian**. After a few seconds it appears under Your deck as "Tidus, Yuna's Guardian · 100 cards", selected, and the dropdown marks it with a ✓. Enter a name and try **Practice solo**: you should get 7 cards in hand and your commander in the command zone.
4. Choose the same deck again: no second copy, it just selects it.
5. Click **🎲 Surprise me** a few times: each click adds a different deck you didn't have yet. Try a two-commander deck, **Frodo, Adventurous Hobbit + Sam, Loyal Attendant** (in Tales of Middle-earth: 2023).
6. **Look for duplicates:** you should not find two decks with the same cards. There should be no "Collector's Edition" versions, and the old Commander Anthology reprints are not there. Tell me if you spot any repeat.
7. Delete a pre-con deck (✕): its ✓ goes away and you can add it again.
8. Turn off your internet, choose a deck: you should get a clear message and nothing is saved.
9. Tell me: are the group names OK (for example "Star Trek: 2026", "Secret Lair: 2024"), are the deck names OK (they are the commander names), and is anything in the way for someone who already has decks?

## Assistant verification
- **The data:** built by `tools/build-precons.py` from MTGJSON (206 Commander decks listed, 178 after removing duplicates by comparing real card lists, **158 from 2016 on**, in 48 groups). Every deck is exactly 100 cards with its commander(s). The twelve decks you sent match the official lists card for card (three split-card names in the Y'shtola deck are written in short form in your list, same cards).
- **Real Scryfall check:** all 6,583 distinct card names in the decks were looked up on the real Scryfall and **none were missing**. I also added five decks through the real game page against the real Scryfall (Tidus, Frodo and Sam, Atraxa, Jean-Luc Picard...): each took about 2.5 seconds, came out with the right commander count and 100 cards, with tokens and pictures, and no missing cards.
- **Automatic checks** (`test_precons`): 158 decks, 100 cards each, no duplicate lists or commanders, nothing older than 2016, groups newest first and tidy, no Collector's Edition copies. **Browser test** (`test_precons_browser`, Scryfall faked): the grouped dropdown, the Final Fantasy: 2025 group, one click adds a full deck, repeats and Surprise me never make copies, the two-commander deck keeps both, a missing card is named, no internet is reported, and a practice game starts with a pre-con deck.
- **Not tested:** other people's browsers and a phone for the long dropdown, and the Grid/Sidebar layouts (start screen only).
