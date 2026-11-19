# Lands that enter tapped — v0.84.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game (practice is fine) with a deck that has some non-basic lands, or use the quick ways below. The battlefield opens once the game has started.

1. Play a land that says **"This land enters tapped."** (for example Barren Moor, a Temple, a gain-land): it should arrive **tapped**. The log says "played … tapped".
2. Play a plain land or a basic: it arrives **untapped** as before.
3. **Check lands** ("enters tapped unless you control a Plains or an Island", e.g. Dragonskull Summit, Sulfur Falls): tapped when you don't have the right land types, untapped when you do. A dual land with the right type counts.
4. **Fast lands** (Darkslick Shores: "unless you control two or fewer other lands"): untapped as one of your first three lands, tapped later. **Slow lands** (Deserted Beach: "two or more other lands") are the reverse: tapped early, untapped later.
5. **Battle lands** ("unless you control two or more basic lands", Sunken Hollow) and "**three or more other Forests**" (Gingerbread Cabin) read your lands too.
6. **Left alone on purpose:** lands that say "you may reveal a card" (Fortified Village, Gilt-Leaf Palace), "you may pay 3 life" (The Black Gate) and "you may have it enter tapped" are **not** tapped for you (you tap them yourself if needed).
7. With **Auto-untap** on, your tapped lands untap at the start of your turn as usual. "Untap All" still works.
8. Tell me if a land is tapped that should not be, or untapped that should be tapped.

## Assistant verification
- 32 automatic unit tests pass, including new `test_entertap` checks for every wording (always tapped, slow, fast, battle, check lands, "other Forests", opponents, Lair of the Hydra, and the ones left alone).
- I ran the rules over every land face in the 158 pre-con decks: 296 are decided automatically (225 always tapped, 71 conditional); 21 need a choice and are left alone; none of the "unless" wordings was misread.
- New two-player Chromium test `test_entertap_browser`: always-tapped, check, fast, slow, reveal and opponent-count lands, the other player seeing the tapped land, and the log text.
- **Not tested:** touch, the Grid layout, and more than two players; real lands from a live deck (the test uses made-up lands with the real rules text).
