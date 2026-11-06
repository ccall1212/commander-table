# Statuses window tidy-up — v0.70.2 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough.

1. Play a creature, right-click it -> **Statuses & abilities…**.
2. In **Statuses**, the word tags (Prepared, Suspected, Monstrous, Renowned, Exerted, Saddled, Unblockable) should appear **once**, with no plain-text copy of the name next to them. **Goaded** (an icon) and all the **Abilities** (icons) should still show their names.
3. Hover a row: its meaning appears. Tick one: the card shows it as before.

## Assistant verification
- All automatic unit tests pass; the two-player statuses browser test passes (it ticks Flying and Goaded by name and checks the cards).
- Not tested: real mouse hover; the narrow-window look beyond the checkbox rows.
