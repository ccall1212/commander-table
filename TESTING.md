# Hidden admin access and spectating — v0.50.0 test copy (Objective #52)

Extract the ZIP and double-click `index.html`. The lobby sequence works locally. Live Spectate requires this game copy, the matching Cloudflare relay update, and a private `ADMIN_PASSPHRASE` secret set in Cloudflare. The ZIP alone cannot activate the server-side room feed. See [admin setup](docs/ADMIN.md).

1. On the lobby, confirm no Admin link is visible. Click the **Tree of Life**, **Dragon Flame**, **Obsidian Gem**, then **Gilded Knight** card backs. A small Admin link should appear. An out-of-order click should reset the sequence. The selected card back should still change normally. Open the link; a wrong passphrase should not reveal rooms.
2. With two browsers in a throwaway relay room, sign into the dashboard and choose **Spectate**. The viewer should show both public boards, arrows, life totals, log and chat in Sidebar and Grid. The admin should not take a player seat, appear in the roster or trigger a host/player prompt. Publicly revealed cards should still be visible; unrevealed hands and libraries should show backs/counts only.
3. In the spectator view, try clicking, dragging and using the normal game hotkeys. Nothing should change in either player's game. The layout buttons, log, chat viewing and **Admin rooms** link should work. Reload the spectator tab and check it resumes from the current public snapshot without asking for a deck or player color.
4. Close or disconnect the host and confirm Spectate reports that the relay host is unavailable. Check that direct PeerJS fallback rooms remain absent from the dashboard. This feature does not show private recovery backups.

## Assistant verification

Node tests cover protected spectator snapshots, public-card filtering, join/close regression and relay frames. Chromium with a simulated relay snapshot showed two boards, log, chat, Grid switching, blocked draw hotkey, hidden hand cards and the lobby sequence with no page errors. The actual Worker and live two-player flow have not been exercised by the assistant; Chris's multiplayer test is still needed. Objective #18's separate iPhone fix remains open in PR #69. Paused draft PR #11 is untouched.
