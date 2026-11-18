# Day / Night marker — v0.82.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game works for the basics; a second player (private window) shows what others see. The battlefield opens once the game has started.

1. Click the **☰ menu → Start Day / Night marker**. A small "Day / Night" token appears on your battlefield with a ☀ and a ☾, and a **☀ Day** chip appears next to "Round N" at the top. Everyone else sees the chip too.
2. Click the **☾** on the token: the chip changes to **☾ Night** for everyone and the log says you changed it to night. Click the **☀**: back to day. Right-click the token → **Change to night / day** does the same.
3. As the **other** player: the chip shows, the token on the keeper's board shows the sun and moon but clicking does nothing, and the ☰ menu says "Day / Night: <name> keeps it (day)" and is greyed out (you can't start a second one).
4. As the keeper: **☰ menu → Day / Night marker → Remove the marker**. The chip disappears for everyone. Now the other player can start their own.
5. Remove the marker, then put a **Daybound** card (e.g. Tovolar's Huntmaster or Arlinn, the Pack's Hope) onto the battlefield: a notice offers **Start Day / Night**. Clicking it creates the marker. (The offer comes once per game.)
6. Tell me: is the chip readable and in a good place? Is the token's size/place on the board OK? Should the board also get a faint warm/cool tint, or is this enough?

## Assistant verification
- Unit tests (30 files) pass, with new checks for the Day / Night tracker.
- New two-player Chromium test `test_day_night_browser`: start from the menu, the chip for both players, the other player cannot change or start a second one, sun/moon clicks, right-click menu, log entry, removal, and the Daybound offer.
- **Not tested:** touch, the Grid layout, the look on real card art, and more than two players.
