# Life total moved off the board — v0.58.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

You need at least two players (your window plus a private/incognito window). Four is best for Grid view.

1. **Look.** In both layouts (▥ Sidebar and ▦ Grid), each small board should show the player's name and their life (− 40 + ▾) in the bar above the board. Nothing should sit on top of the board's top-left corner.
2. **Cards in the corner.** Have a player put a card on the top-left of their board (for example drag one to the Creatures row's far left). On another player's window, the card should be fully visible.
3. **Arrows.** Use ☰ → **Targeting arrow…** (or right-click a card → **Send arrow to…**) and point at that top-left card on someone else's small board. It should work.
4. **Life still works.** On another player's small board click − and +; the change should appear for that player. Click the number to type a life total. Click ▾ to open counters and commander damage. Do the same on your own board in Grid.
5. **Crowding.** In Grid with four players, and in a narrower window, check the name bar still looks tidy (name, TURN/YOU tags, life).

## Assistant verification

- **Unit tests (Node):** all 21 automatic test files pass.
- **Real browsers with a local relay (Chromium, four players):** new `test_life_in_header_browser` checks in Grid and Sidebar at 1366x768 and 1920x1080 that every small board's life total sits in its name bar above the board, fits without overflow, and that −, +, set-life and the counters menu work for an opponent and for me. I also looked at screenshots of both layouts. Real touch and your own hands-on check are still needed.
