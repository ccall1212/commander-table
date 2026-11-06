# Reminders sorted by the turn — v0.75.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough.

1. Put several cards with triggers on the battlefield (for example two or three with "At the beginning of combat…", one with "At the beginning of your upkeep…", one with "…end step…", a landfall card, a "Whenever you cast…" card, and Hardened Scales).
2. Open the **Reminders** panel. Under **From the table** you should see small headings in turn order: **Upkeep, Draw step, Main phase 1, Beginning of combat, Declare attackers and blockers, Combat damage, Main phase 2, End step**, then **When spells are cast, Other triggers, Playable from graveyard / exile, Always on**. Only headings that have something are shown.
3. **All the beginning-of-combat cards are under one heading**, with alike wording next to each other.
4. A card that has triggers at different times appears under each heading with just those lines (✕ hides only that box).
4b. With **no reminders of your own**, the panel should not show a "My reminders" heading or hint at the top; add one with **+ Add reminder** and the heading appears.
5. Tell me if the order or the headings should change (for example where "When spells are cast" should sit).

## Assistant verification
- All 28 automatic unit tests pass, with new checks for which time of the turn each kind of line belongs to (upkeep, draw, main, beginning of combat, attackers, combat damage, main 2, end step, cast, other, always on).
- New two-player Chromium test `test_reminders_order_browser` checks the headings and box order for a set of cards; the existing reminders browser test was updated for the new sections. I also looked at a screenshot.
- Not tested: real Scryfall wording of every trigger.
