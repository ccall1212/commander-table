# Private admin dashboard

The dashboard lives at `admin.html` beside the game. Its source is public because this repository is public; the passphrase and live room data are protected by the Cloudflare Worker, not by hiding the page. On the lobby, selecting the **Tree of Life → Dragon Flame → Obsidian Gem → Gilded Knight** card backs in that order reveals a small Admin link for that browser tab. The sequence only hides the link; the relay checks the private passphrase on every admin request.

## Before using it

1. In Cloudflare, open **Workers & Pages → commander-table-relay → Settings → Variables and Secrets**. Add a **Secret** named `ADMIN_PASSPHRASE` with a private, random passphrase of at least 20 characters. Save/deploy the Worker. Do not commit or send the passphrase in a chat or put it in a browser URL. If it is lost, replace the secret in Cloudflare.
2. Deploy the relay's `RoomDirectory` Durable Object migration along with the Worker. Until the new Worker and secret are live, the page cannot list or manage rooms. The normal game continues to work without the admin secret.
3. Open `https://ccall1212.github.io/commander-table/admin.html` after publication, enter the passphrase, and choose **Sign in**. It stays in that browser tab's session storage for reloads; **Sign out** removes it. Every admin API request is checked by the Worker. Use a private device and close the tab when finished.

The list shows rooms whose **host is connected through the Cloudflare relay** and publishing status. It displays room code, host display name, player display names/connection status, started status and count, with 15-second refresh. Names are chosen by players and are not verified account identities. It never lists hands, libraries or private boards. A room falls off the list after the host disconnects or 90 seconds without a status update. A connection using the direct PeerJS fallback bypasses this relay; that game is absent and cannot be closed here. The count is therefore active *relay games*, not a guaranteed total of every game using the app.

**Request to join** sends a visible approval prompt to the host. After approval the dashboard shows a regular join link. You still enter with a deck and choose an available color, subject to the usual six-player limit. Approval does not grant moderator rights or reveal hidden cards.

**Spectate** opens a read-only Sidebar/Grid view with the public boards, game log and chat. It uses the current game's normal board renderer but does not take a seat, appear in the player roster, send chat, change cards, or notify the host or players. The passphrase is checked on every snapshot request, and the relay keeps a snapshot only briefly. Unrevealed hands and library cards remain hidden. Private room backups support board recovery, but they are not a live feed and are not exposed to spectators. Spectating only works while the host is connected through the relay, and it requires both the new game copy and updated Worker. An older host copy cannot provide snapshots.

**Close room** ends its relay connections and rejects this room code for 24 hours. This is for an unwanted or stuck relay game; it does not close any direct PeerJS connection already in use. The separate in-game host/delegate moderation controls still handle individual players and board transfers. Older game copies that do not understand the closure message may reconnect through direct PeerJS; ask your group to use the current game copy when testing this feature.

## Test before publication

The admin page can be opened from a ZIP, but its real list and controls require a Worker running the new code and a privately configured passphrase. Local automated tests cover the API and a simulated dashboard. A live test should host a room on the relay, confirm its host and roster appear, accept/decline a join request in the host browser, and close a throwaway room. Try both Sidebar and Grid for the host prompt. Do not test **Close room** on an active game you intend to keep.
