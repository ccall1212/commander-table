# Land hover and transformed cards — v0.90.1 test copy

To check this copy, extract the ZIP and double-click **index.html**.

1. **Land piles:** put several lands that make the same mana on the battlefield so they pile top to bottom. Slowly move the mouse down the pile: each land stays where it is, the preview is smaller, and you can reach the ones below without leaving the pile. **Click or grab** a land and it comes to the front. Creatures still come to the front when you point at them.
2. **Exdeath, Void Warlock:** put it on the battlefield (3/3), put permanent cards (creatures, lands, artifacts…) in your graveyard, then **flip** it. It should become Neo Exdeath with power equal to the number of permanent cards in your graveyard and toughness 3. Add one more permanent to the graveyard: the power goes up. Instants and sorceries do not count. Flip back: 3/3.
3. If your deck was imported a while ago, the first flip may take a second while the game fetches Neo Exdeath's power/toughness.
4. Other double-faced creatures should also show their back face's power/toughness when flipped.

## Assistant verification
- `test_cda` (unit) now covers "permanent cards in your graveyard" and Neo Exdeath's wording; `test_cda_browser` (two real players) flips Exdeath: 3/3 on the front, power follows the graveyard on the back for both players, back to 3/3; an old-deck card gets its back P/T from a pretend Scryfall.
- `test_land_placement_browser` (2/3/4 players) checks that pointing at a land keeps it in place, pressing brings it forward, and a creature still comes forward (it fails if the fix is removed).
- Unit tests and other browser tests pass.
- **Not tested:** the real Scryfall request, touch, how the smaller preview feels.
