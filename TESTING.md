# Word tags no longer cut off — v0.71.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough.

1. Play a creature and give it **Unblockable**, **Monstrous**, **Renowned** and **Exerted** (right-click -> Statuses & abilities…).
2. Each tag should show its **whole word** across the middle of the card, not cut off at the sides ("nblockab" before).
3. Check a small card (many players, Grid layout) and a tapped card; also hover the card: the big preview still shows the tags.
4. A very long custom status you type yourself may end in "…" on the card; hovering still shows the full name.

## Assistant verification
- All automatic unit tests pass. The statuses browser test now checks that word tags are whole and inside the card for both players, and it **fails on the old layout** (all three tags reported cut off) and passes on the new one.
- Not tested: looks on a real high-resolution screen or a phone.
