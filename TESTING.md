# Victory screen and death screens — v0.65.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

You need at least three players for a proper test (your window as the host plus two private/incognito windows). Two players also works. Everyone **Keep 7**, then the host clicks **Start game**.

1. **Death screen.** With three players, one guest opens ☰ → **Concede game…** and confirms. That guest's whole screen should turn dark and grey with a bold black-and-white **skull and crossbones** (a free Pixabay image) over their board (try both ▥ Sidebar and ▦ Grid). In the other windows, that player's small board should be greyed out with a skull on it and their name marked OUT. No Victory screen yet (two players are still in).
2. **The win.** The second guest concedes too. **Every** window should show the **Victory** screen: a trophy, confetti, **VICTORY**, the winner's name colour, and who conceded. The winner's window says "You are the last one standing!"; the others say "<name> wins!". The game log says "… wins the game!".
3. **Closing it.** Click **Close** in one window and press **Esc** in another: each closes only for that player.
4. **New game.** Only the host's screen has **Start a new game**. (Don't need to click it unless you want a fresh game.)
5. **Taking it back.** As the host, restore a conceded player (click a player's name → **Restore to game (undo concede)**): the Victory screens and that player's death screen should disappear. Conceding again should show it again.
6. **Practice game.** Concede-ing in a solo practice game should not show a Victory screen (nobody else is in it).
7. Please say how the celebration feels: too much, too little, too long?

## Assistant verification

- **Unit tests (Node):** all 23 automatic test files pass.
- **Real browsers (Chromium, three players):** new `test_victory_browser` checks that nothing shows while two players remain, that all three see the right text when the second one concedes, host-only new game, Close and Escape, that undoing a concession removes it and a new concession brings it back, and the log line. The test also checks the death screen on the player's own board (Sidebar and Grid) and on everyone else's view of it. I looked at screenshots (the confetti falls after the first moment, so it is not in the still). No sound was added.
