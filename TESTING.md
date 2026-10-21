# Unique player colors — v0.36.0 test copy

Download the ZIP, extract it, and double-click **index.html**. Keep internet access on. No terminal or local server needed. Use at least two players with this copy; three are useful for switching between two opponents.

## Click list

1. Host a game and join from a second browser/tab. In the host's ☰ menu, choose **Choose player color… (currently Gold)** and then **Red — available**. The host's player marker and name should turn red on both screens.
2. On the second player's screen, open ☰ → **Choose player color… (currently Blue)**. Red should say **taken by [host name]** and be disabled. Choose another available color; verify each screen shows the same colors.
3. Have both players try to claim the same available color from separate screens in quick succession. Only one should receive it; the rejected player sees a message and can choose another.
4. On each browser, test at 1920×1080 and 1366×768 in Sidebar and Grid. Check the markers/name colors in both layouts.
5. Reload each browser and reconnect. The choices should remain. Start a new game; the colors should still remain. Remove a player from the table and verify that player's color becomes available to the remaining players.

## Verification

- Chromium HTTP check with two players: host chose red; guest saw red marked taken and disabled, then chose purple; both layouts at 1920×1080 and 1366×768 showed synchronized color state; reloading the host and starting a new game kept both choices. No page errors observed.
- All six Node suites passed. `node --check js/app.js` and `node --check js/player-colors.js` passed. The player-color checks cover legacy defaults, deterministic uniqueness, invalid/non-seated claims, competing claims, and serialized persistence.
- Color choices are host-owned table data. The relay protocol and player hidden state are unchanged.
- A real browser is needed for the two-player flow; double-clicking `index.html` alone cannot provide a shared room.
