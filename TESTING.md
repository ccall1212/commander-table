# Abilities granted by other permanents — v0.73.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough; a second player (private window) shows what others see.

1. Play **Sphere Grid** and two creatures. Put a **+1/+1 counter** on one of them: it should show **Reach** and **Trample** icons with a **dotted green ring** (hover: "Granted by Sphere Grid"). The other creature shows nothing.
2. Remove the counter: the granted icons disappear on their own. A second player sees the same.
3. Turn **Reach** on by hand for the creature too: it shows once (solid), and stays when the counter is removed.
3b. Open the creature's **Statuses & abilities…**: the granted **Reach** and **Trample** should be **ticked**. Untick **Trample**: it disappears from that creature (for everyone) while Reach stays and Sphere Grid stays. Tick it again and it returns. Also try a creature that already has Trample turned on by hand: unticking removes it completely.
4. Try other cards of yours with this kind of line, for example one that says "Other Dragons you control have flying" or "Elves you control have ...". Tell me which cards did not work, with their names.
5. Reminder: power/toughness bonuses ("Creatures you control get +1/+1") are NOT included yet.

## Assistant verification
- All 28 automatic unit tests pass, including new `test_grants` (Sphere Grid wording, plural and singular, tribes, Other, conditions, things that must be ignored).
- New two-player Chromium test `test_grants_browser`: the grant shows for both players only on the creature with the counter, follows the counter, is never saved, and a hand-made ability is not duplicated. I also looked at a screenshot of the icons.
- Not tested: real Scryfall wording of Sphere Grid and other cards (I used the wording you described).
