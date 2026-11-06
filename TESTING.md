# Step trackers for Sagas, Classes, Rooms — v0.72.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game works for most of this; a second player (private window) shows what others see.

0. **The ☰ menu** is now grouped: Arrows, My hand, Display & layout, On my turn, Game & room. Everything should still be reachable; the two switches for automatic abilities/lore counters are gone (always on).
1. **Saga.** Play a Saga (for example Summon: Ixion). It should enter with **one Lore counter** and dots **I II III** running **down the left side** of the card (not covering power/toughness), I lit and ringed. The **"1 Lore" counter at the top right of the card** should appear on its own and go up with each chapter.
2. **Click** dot III: it jumps there (Lore counter becomes 3). Click the current dot again: it steps back one. The right-click menu has **Add a lore counter**, **Remove a lore counter** and **Go to chapter…**.
3. **Counters moved by other effects.** Use Tidus, Yuna's Guardian (or the Counters menu) to take a Lore counter off: the dots should follow.
4. **Automatic counter.** With auto-draw/auto-untap on, pass the turn around so it is your turn again: each of your Sagas should get one more Lore counter (the log says so), but not beyond its last chapter.
5. **Reminders.** Open the Reminders panel: your Saga should show **only the chapter it is on** (e.g. "II, III — …" at 2 or 3), not every chapter.
6. **Class** (levels 1, 2, 3, starting at 1) and **Room** (two doors 🔒/🔓, click to unlock): try them. A second player should see the same dots; only you can click yours.
7. **Battle:** play one; Counters menu has **Defense +1 / −1**.
8. Tell me how the dots look on a real card (size, covering the card text?) and if any Saga/Class shows the wrong number of steps, with its name.

## Assistant verification
- All 27 automatic unit tests pass, including new `test_tracks` (chapter parsing for Saga lines like "II, III —", Class levels, Room doors, dot state).
- New two-player Chromium test `test_tracks_browser`: Saga enters with lore 1, dots appear for both players, clicking moves/steps back, counter changes move the dots, the other player cannot click them, reminders show only the current chapter, Class and Room work, the menu steps work, and an automatic lore counter arrives at my next turn. I also looked at a screenshot of the dots.
- Not tested: real Scryfall text for every Saga/Class/Room/Battle, real mouse feel on small cards, touch.
