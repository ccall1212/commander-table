# Types row — v0.87.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game and put cards on the battlefield; a second player (private window) shows what others see.

1. Put a **Changeling** (Mirror Entity, Changeling Outcast…) on the battlefield: a small **All types** tag now sits **over the card's printed type line** (the line under the picture), not in the middle with the statuses.
2. Give a creature **Suspected** (right-click → Statuses & abilities): the **Suspected** tag stays in the middle, the type tag stays on the type line. They no longer pile on top of each other.
3. Add more types to one card: a Changeling (All types) + **Biotransference** (Artifact) + **Secret Arcade** (Enchantment) + an Aura like **Angelic Destiny** (Angel). The text gets **smaller** and the tags **wrap onto a second line**; every word stays fully visible and nothing goes past the card edge. With more than four you see **+N**; hover it for the list.
4. A frog Aura, Stormtide Leviathan (Island on lands), Imprisoned in the Moon (Land): all show in the same row. Tapping the card turns the row with it.
5. Hover a tag to see which card gives it. Another player sees the same row.
6. Tell me if the row covers something you want to read (the printed type line is hidden under it while a card has type tags), or if the text is too small on your screen. The other option was a row at the top-left under the title.

## Assistant verification
- 34 automatic unit tests pass; the two-player Chromium test `test_types_browser` now also checks that four tags stay inside the card on both screens and are smaller than a single tag; looked at real card pictures with one, two and four tags (two lines for three or four).
- **Not tested:** touch, the Grid layout, more than two players.

## Also in this copy (v0.88.0): add types by hand
1. Right-click a creature → **Statuses & abilities**. At the bottom there is a **Types** section. Type a type, for example **Elf**, and press **Add** (or press Enter): it appears in the Types row on the card (for the other player too), and the card now gets "Elves you control" bonuses and counts as an Elf in "the number of Elves you control".
2. **Remove** it from the same window. Tick **All types (like a Changeling)** to give the card every type.
3. Select several cards (drag a box around them), right-click one → Statuses & abilities → add a type: it goes on all of them.
4. The same section lists the types **other cards** give this card (for example "Given by other cards: Artifact (Biotransference)").
5. Move the card to your hand and back: the hand-made types are gone (like counters and statuses).
6. Good uses: a "chosen type" card (Obelisk of Urd, a Banner), a copy that says "except it's a Wall", a Shapeshifter whose text you want counted.
