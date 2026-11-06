# Temporary effects end with their turn — v0.74.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. Two players (a private window) are best.

1. On your turn, give a creature a temporary effect (right-click -> **Temporary (until end of turn)** -> +1/+1, or a temporary status like Vigilance). **Pass the turn**: it should disappear right away, on your screen and the other player's.
2. **The case you found:** give a creature a temporary effect, then **reload the page (or leave and rejoin the game)**, then pass the turn. It should now disappear at once; before it stayed until your next turn.
3. Place a temporary effect on your creature during **another player's turn**: it should disappear when that player passes.
4. Permanent statuses, counters and abilities are never touched.

## Assistant verification
- New three-player Chromium test `test_temp_turn_browser`: every player's effect is gone as soon as the turn passes, a repeated check does not clear an effect placed this turn, an effect left over from an earlier turn (what a reload leaves behind) is cleared at once, and an effect placed during another player's turn ends with that turn. The two-player temporary-effects test and all 28 automatic unit tests pass.
- Not tested: an actual page reload (I simulated the leftover state); real mouse use.
