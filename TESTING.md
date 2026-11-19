# "Gets +N/+N for each …" cards — v0.86.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game (practice is fine) and put cards on the battlefield from a deck.

1. **Moon-Vigil Adherents** (0/0): put it on the battlefield: it should be **1/1** (it counts itself). Put another creature out: **2/2**. Put a creature card into your graveyard: it counts too. The other player's creatures do **not** count ("you control"). A +1/+1 counter adds on top. Hover the number: it says the bonus was counted from the card's own text.
2. **Other cards of this kind:** Multani (lands you control and land cards in your graveyard), Jarad, Wight of the Reliquary (creature cards in your graveyard), Akiri / Storm-Kiln Artist (+1/+0 per artifact), Borderland Behemoth (+4/+4 per other Giant), Yavimaya Enchantress (enchantments).
3. **Auras and Equipment:** **Crown of Skemfar** on a creature: +1/+1 for each Elf you control (and reach); **Ethereal Armor** (enchantments), **Cranial Plating** (artifacts), **Empyrial Plate** (cards in your hand), **Kemba's Banner** / **Crown of Gondor** (creatures), **Bonehoard** (creature cards in all graveyards). The number follows the count live, for both players.
4. **Counters on the card itself:** **Mace of the Valiant** / **Lion Sash** / **Gavel of the Righteous** (+1/+1 for each counter on the Equipment): put counters on the Equipment and watch the equipped creature. **Auras and Equipment attached to it:** Kor Spiritdancer, Gunner Conscript, Strong Back (attach some).
5. Cards that need colours, experience / poison counters, mana value or "greatest power" are **not** read and stay manual. Tell me if one of those matters.
6. Everything from v0.86.0 (Bronze Guardian, Goyfs…) still works.

## Assistant verification
- 34 automatic unit tests pass, including new checks from real wordings (Moon-Vigil Adherents, Crown of Skemfar, Ethereal Armor, Bonehoard, Mace of the Valiant, Kor Spiritdancer, Blazing Sunsteel, High Sentinels of Arashin, "Tuvasa the Sunlit") and counting on boards.
- New two-player Chromium test `test_cda_each_browser`: Moon-Vigil Adherents with creatures, a creature card in the graveyard, the other player's creature (not counted), a counter on top, and Crown of Skemfar counting Elves with reach, on both screens.
- I checked 66 pre-con cards with this wording: 36 are read; the rest need things the game cannot see.
- **Not tested:** touch, the Grid layout, more than two players, real card pictures.
