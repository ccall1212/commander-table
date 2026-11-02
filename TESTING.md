# Statuses and abilities on cards — v0.62.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

You need two browser windows as two players (your window plus a private/incognito window).

1. Start a game (everyone **Keep 7**, then **Start game**) and put a few cards on the battlefield.
2. Right-click one of your battlefield cards → **Statuses & abilities…**. A checklist opens with **Statuses**, **Abilities** and **Your own**.
3. Tick **Goaded** and **Flying**. A column of small round icons should appear just outside the card's top-right corner, not touching the card. Hover an icon: its name shows.
4. Type a custom status (for example *Cursed*) and click **Add**. A small badge with its first letters appears. Remove it with **Remove**.
5. In the other player's window the same icons should appear next to that card, on their small copy of your board.
6. Tick enough to see how the column behaves (more than fit down the card's side should start a second column). Try a card near the right edge of the board: the icons should hang on its left side instead.
7. Tap the card (T): the icons should stay readable, in a row under the card.
8. The **Add Counters** area should be unchanged, and counters still show inside the card's top-right corner.
9. Move the card to the graveyard: the icons go away. Bring it back: it starts with none.
10. Please judge the look: icon size, whether the drawn icons are recognisable, and whether anything covers something important.

## Assistant verification

- **Unit tests (Node):** all 23 automatic test files pass.
- **Real browsers (Chromium, two players):** new `test_card_marks_browser` ticks statuses and abilities and adds a custom one through the checklist, checks the saved order, that icons are outside the card from its top for both players, the names, that tapping keeps them next to the card, that angle brackets in custom names are removed, and that they clear when the card leaves the battlefield. I looked at screenshots. The icons are simple drawings I made, not the game's official symbols; your eyes are needed on how they look. Real touch is not tested.
