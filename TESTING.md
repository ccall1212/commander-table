# Connection log and fewer false disconnects — v0.90.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start or join a game.

1. Open **Menu → Display & layout → Connection log…**. You should see a "connecting" and "connected" line with the time. **Copy** copies the text; **Clear** empties it.
2. Turn your wifi off for a few seconds and on again: the log should show "browser offline" / "closed" / "reconnecting" lines.
3. Switch to another browser tab for a minute or two and come back: the log shows "tab hidden" / "tab visible", and (if the tab was slowed) "timer ran late". The game should **not** drop and reconnect just because the tab was in the background.
4. Next time the game disconnects while you play, open the log, press Copy and send it to me; it will tell us whether it was wifi, a sleeping tab or the server.

## Assistant verification
- New unit test `test_connection_log` (fake socket and fake clock): real silence is declared dead and logged; a late timer (background tab or sleep) is not; closes are logged with their code.
- New real-browser test `test_connection_log_browser`: menu item opens the window, shows the connection, notes going offline, Clear works, no page errors.
- Other unit tests, pass-turn and share-hand browser tests pass.
- **Not tested:** a real hidden tab or sleeping laptop over a long time, or a real wifi drop.
