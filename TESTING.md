# Dice pop-up and arrow target highlight — v0.59.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

You need two browser windows as two players (your window plus a private/incognito window); three is nicer.

## Dice, coin and random player
1. In one window click **🎲 Dice → Flip a coin**. In **both** windows a box should pop up in the middle of the screen with a spinning coin that lands on HEADS or TAILS, with the roller's name and color. It should match the line in the 📜 Log and go away by itself after a few seconds (or when clicked).
2. Try **Roll d6**, **Roll d20** and **Other dice → d100**. The die should tumble and settle on a number that matches the log.
3. Try **Pick a random player**. Names should flicker, then settle on one player.
4. Roll twice quickly: the newer result should replace the older one.
5. Check it does not get in the way of playing (it does not block clicks outside the box).

## Arrow target highlight
6. Start the game (everyone **Keep 7**, then **Start game**) and put a card on the battlefield for each player.
7. Right-click a card on your battlefield → **Send arrow to…**, then click a card on someone else's board (try the small board in the right column and, in ▦ Grid, an opponent's quadrant). The starting card AND the target card should both be outlined in your color, on every player's screen.
8. Draw a second arrow from another card to the same target: the newest arrow's color should be the one you see on the target.
9. Remove an arrow (click its line): its outlines should go away.

## Assistant verification
- **Unit tests (Node):** all 21 automatic test files pass.
- **Real browsers with a local relay (Chromium, two players):** new `test_roll_arrow_browser` rolls a d20, d100, flips a coin and picks a random player and checks the pop-up on both screens matches the logged result, that the host refuses invalid results, that it dismisses, and that an arrow outlines both source and target cards on both screens. I also looked at screenshots. Animation smoothness, sound and real touch still need your eyes.
