# Concede sends your cards to the graveyard — v0.65.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

Use two or three players. Everyone **Keep 7**, the host **Start game**, then have one guest put a few cards on the battlefield (hover a hand card, press **B**) and keep a few in hand.

1. That guest opens ☰ → **Concede game…**. The box now says everything in your hand and on your battlefield goes to your graveyard. Confirm.
2. Their hand and battlefield should be empty and their **Graveyard** count should equal the number of cards they had in hand plus on the battlefield. Their library should be unchanged.
3. In the other windows, that player's small board should show no cards, a bigger graveyard number, and the skull (death screen).
4. If they had a token or a copy, it should simply disappear rather than land in the graveyard.
5. A commander in the command zone stays where it is.
6. The other concede routes (life reaches 0 and you choose Concede, an empty library draw, lethal poison or commander damage) do the same.

## Assistant verification

- **Unit tests (Node):** all 23 automatic test files pass.
- **Real browsers (Chromium, three players):** the victory test now has a player put two cards on the battlefield, concede, and checks all seven cards are in the graveyard, library/exile/command are untouched, and the other players see it.
