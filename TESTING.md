# Power/toughness counted from the card's own text — v0.86.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game (practice is fine) and put cards on the battlefield from a deck; a second player in a private window shows what others see.

1. **Bronze Guardian** (or Master of Etherium, Darksteel Juggernaut, Filigree Attendant): its power is the number of **artifacts you control** (it counts itself). Put another artifact onto the battlefield: the power goes up by one. Remove it: back down.
2. **Equipment and counters add on top.** Attach an Equipment that says +2/+2 (it is an artifact too, so it also raises the count) and add a +1/+1 counter: the number is the count plus those. Hover the badge: it says the number was counted from the card's own text.
3. **Opponents:** Avalanche of Sector 7 counts the artifacts your **opponents** control. Have the other player put an artifact out: it changes on both screens.
4. **Graveyards:** Mortivore / Splinterfright / Lord of Extinction / Consuming Aberration / Spellheart Chimera: put creature cards (yours and the other player's) into graveyards and watch the number. A **Goyf** (Barrowgoyf, Polygoyf, Lhurgoyf, Necrogoyf) counts card types or creature cards in all graveyards (toughness one more).
5. **Hand size and life:** Psychosis Crawler / Body of Knowledge follow the number of cards in your hand; Serra Avatar follows your life total.
6. **A base set by hand wins:** right-click → Set power/toughness → the count is replaced by what you set (bonuses still add).
7. Other counts are **not** read and stay manual: mana value (Dodgy Jalopy), colours (Drove of Elves), your party, a chosen player. Tell me if one of those matters to you.
8. Tell me if any number is wrong for a card you know.

## Assistant verification
- 34 automatic unit tests pass, including new `test_cda`: 30+ real card wordings from the pre-con decks read correctly, the ones that cannot be read are refused, and counting on a two-player board (artifacts, lands, creatures incl. face-down, graveyards, hands, life, tribes, card types, differently named lands, "other").
- New two-player Chromium test `test_cda_browser`: Bronze Guardian with artifacts, Equipment and a counter on top, the opponent's artifacts (Avalanche) live, graveyards of both players (Mortivore), hand size (Body of Knowledge), a base set by hand wins, and nothing is stored on the cards.
- **Not tested:** touch, the Grid layout, more than two players, real card pictures; exile counts (Crackling Drake) are not read.
