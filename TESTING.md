# Tab alerts — v0.91.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. You need two or more players (a second browser or private window is fine).

1. Start a game. On one player's page, switch to **another tab** (or put another window in front). Have another player **pass the turn** to that player: the hidden tab's title flashes "🔔 It's your turn!" and its icon gets a red dot. Switch back: it stops at once.
2. Hide a player's tab and have someone press **R** (In response!): the hidden tab flashes "<name>: In response!".
3. Hide a player's tab and have someone **aim an arrow** at that player or one of their cards: the tab flashes "<name> aimed an arrow at you".
4. While you are looking at the game, nothing flashes. Your own actions never flash your own tab.
5. **Menu → Display & layout → Tab alerts:** try turning the flashing off, the **soft chime** on (you hear a sample), and the **desktop pop-up** (the browser asks for permission; double-clicking index.html may not allow pop-ups, in which case you get a message and the tab still flashes).
6. Tell me if a chime or pop-up should be on by default, or if anything else should trigger an alert (chat messages, for example).

## Assistant verification
- New two-player Chromium test `test_tab_alerts_browser` (page hidden by simulation): turn, In response! and an arrow at you flash the title and swap the icon; nothing while the page is in front, for the player's own In response!, for an arrow between other players, or when the flashing is turned off; cleared when the page comes back; the menu lists the options. No page errors.
- Unit tests, pass-turn, roll/arrow and arrow-click browser tests pass.
- **Not tested:** a really hidden tab in a real browser (the test pretends the page is hidden), the chime, the desktop pop-up and its permission prompt, other browsers.
