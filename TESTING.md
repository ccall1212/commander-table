# Copy and graveyard placement fix + concede box — v0.65.2 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

## Part 1: where new cards appear (the bug you found)

Start a game and put a few cards on your battlefield.
1. **Copy.** Hover a battlefield card and press **C** (or right-click → **Copy this card**). The copy should appear **right beside** the original (to its right; if that spot is taken, the next free side), not in a corner. Try it on a card near the right edge and on a crowded board.
2. **From the graveyard.** Put a card into your graveyard (**G**), open the graveyard, and bring it back (including a **land**). It should appear **in the middle of your board**, easy to see and click, never under the hand and piles strip at the bottom.
3. Same for a card from **exile**. Cards you play from your hand should still go where they normally do.
4. Copies made from a graveyard card, or from another player's card, also appear in the middle of the board (there is no card of yours to sit beside).

## Part 2: the concede box (v0.65.1)

Use three players if you can (two works). Everyone **Keep 7**, the host **Start game**. Have each guest put a few cards on the battlefield (hover a hand card, press **B**) and, if you like, send a card to the graveyard (**G**) and exile (**E**).

1. **The box.** A guest opens ☰ → **Concede game…**. The box is small and has one tick box: **Also put my cards back…**, ticked.
2. **Cards put back.** Leave it ticked and press **Concede game**. That guest's hand, battlefield, graveyard and exile should all be empty, their library should hold the whole deck again, and a commander (if they have one) should be back in the command zone. Tokens and copies should simply be gone.
3. **Others' view.** In the other windows that player's board should show no cards and the skull; the player's name is marked OUT.
4. **Keep my cards.** With another guest, untick **Also put my cards back…** and concede. Their hand and battlefield should stay exactly as they were, and **their own screen is NOT darkened**, so they can still look through their cards. Everyone else still sees them marked OUT with the skull.
5. **Victory.** When only one player is left, everyone sees the Victory screen as before.
6. The same box appears if you reach 0 life and choose to concede, or draw from an empty library.
7. Tell me if the tick box wording is too long or the box feels too big.

## Assistant verification

- **Unit tests (Node):** all 23 automatic test files pass.
- **Placement:** new `test_card_placement_browser` checks a copy lands right beside its original (and the next free side when taken), and that cards returning from the graveyard and exile appear mid-board where they can be clicked; it fails on the old code.
- **Real browsers (Chromium):** `test_victory_browser` (three players) concedes once with the box ticked and once unticked and checks the cards, the dark screen and what others see; the new `test_concede_clear_browser` checks a commander, graveyard and exile all go back as described.
