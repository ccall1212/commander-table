# "During your turn" for groups — v0.88.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game and put cards on the battlefield; a second player (private window) shows what others see.

1. **Dion, Bahamut's Dominant** on the battlefield with a Knight (his own 2/2 Knight token, or any Knight): on **your turn** Dion and the Knight(s) show the **flying** icon. Pass the turn: the icons go away. They come back on your next turn. Another player's Knights never get it. A non-Knight creature does not.
2. **K'Vort-Class Raider** ("During your turn, this Spacecraft and creatures you control have hexproof"): hexproof on your turn for it and your creatures.
3. **Prava of the Steel Legion** ("During your turn, creature tokens you control get +1/+4"): token creatures show +1/+4 on your turn only.
4. Cait, Cage Brawler / Kefka / Cid (the card alone) still work as before.
5. A card that names itself and a group without the turn condition ("<Name> and other Elves you control get +1/+1") gives it to both.
6. Tell me if another card with "during your turn" or a similar shape is not picked up.

## Assistant verification
- 34 automatic unit tests pass, including new checks with the real Dion, K'Vort-Class Raider, Prava of the Steel Legion and Grand Abolisher wordings (and a board check: Dion and a Knight on their controller's turn only).
- The two-player Chromium test `test_grants_pt_browser` now also checks Dion and a Knight get flying on Dad's turn (on both screens) and lose it on Son's turn; a Bear does not get it. It passed three times in a row.
- **Not tested:** touch, the Grid layout, more than two players, the real Dion card picture.
