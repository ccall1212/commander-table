# Arrow click fix and host-only Pass turn — v0.62.2 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

## Part 1: arrows on opponents' boards (the bug you found)

Use three players if you can (a host and two guests), otherwise two. Start a game and put a card on the battlefield for each player.

1. Press **W** over one of your own cards (or ☰ → **Targeting arrow…**) and click on an **opponent's small board**: empty space, one of their cards, and their name. Each should place an arrow. Try it on each opponent, and as a guest aiming at the host.
2. Click the way you normally do, slowly and with a slightly moving mouse. It used to fail unless the click was perfectly still.
3. Do it while the other players are moving cards, so the table keeps updating.
4. Dragging from one card to a target still works, and Esc or right-click still cancels.

## Part 2: Pass turn (v0.62.2)

You need two browser windows as two players: your normal window as the **host** and a private/incognito window as a guest. Everyone **Keep 7**, then the host clicks **Start game**.

1. **Guest on the host's turn.** When it is the host's turn, look at the guest's window: **Pass turn** should be greyed out. Hover it: the tooltip says only the host can pass another player's turn. Press **Space** in the guest's window: a message says it's the host's turn and only the host can pass it. The turn must not change.
2. **Guest on his own turn.** After the host passes, the guest's **Pass turn** turns yellow and works; pressing it (or Space) passes to the next player.
3. **Host on a guest's turn.** On the guest's turn, the host's **Pass turn** button is still clickable. Clicking it asks "It's … turn. Pass it for them?". Cancel does nothing; confirming passes the turn, and the game log says it was passed by the host.
4. **Three or more players (if you can):** a guest should never be able to pass another guest's turn either.
5. Everything else about turns (Round counter, Auto-Draw and Auto-Untap at the start of a turn) should behave as before.

Note: a player on an older version who is not the host can no longer pass someone else's turn either, because the host now ignores it.

## Assistant verification

- **Unit tests (Node):** new `test_pass_turn` checks the host's rule (a pass from anyone other than the active player or the host is ignored, a stale pass still is, the log says when the host passed) and the guest's button and message; I confirmed it fails without the change.
- **Real browsers (Chromium, two players):** new `test_pass_turn_browser` walks through the Pass turn steps 1 to 3. A three-player game was not run.
- **Arrow fix:** I reproduced your bug in a real browser: with even a 1-pixel mouse movement between pressing and releasing, the arrow was never placed on an opponent's board. The new `test_arrow_click_browser` fails on the old code and passes on the new, with a steady click, small and large mouse movement, a table redraw while the button is held, a guest aiming at the host, and a drag.
