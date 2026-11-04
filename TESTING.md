# Concede puts your cards back (or keep them) — v0.65.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

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
- **Real browsers (Chromium):** `test_victory_browser` (three players) concedes once with the box ticked and once unticked and checks the cards, the dark screen and what others see; the new `test_concede_clear_browser` checks a commander, graveyard and exile all go back as described.
