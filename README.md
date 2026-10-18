# Commander Table

A free, browser-based Magic: The Gathering Commander table for playing with friends online. It's a lot like the Tabletop Simulator setup many of us used to play on, but it runs right in your web browser.

[![Version](https://img.shields.io/github/v/tag/ccall1212/commander-table?label=version&sort=semver&color=blue)](CHANGELOG.md) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Play now:** https://ccall1212.github.io/commander-table/ — nothing to install. See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

**Current app version:** v0.22.4.

## What you need

- Chrome, Edge or Firefox
- An internet connection. Card images and data come from Scryfall, and games connect through a small relay server.
- Nothing to install

## Getting started

1. Open https://ccall1212.github.io/commander-table/ in your browser.
2. Enter your name, pick or import a deck, and click **Host a game**.
3. Click the room code in the top-left. This copies an **invite link** (it looks like `…/commander-table/?join=CODE`). Send it to your friends.
4. Your friends open the link, enter a name, pick a deck, and press **Join**. The room code is already filled in. Typing the 5-letter code by hand works too.

Want to play without the website? There's also a downloadable copy of the game for local-network play. See **Playing on a LAN** below.

## Your look: card backs and play-area backgrounds

Before starting a game, use **Your look** on the opening screen to choose from 12 painted card backs and 10 illustrated play-area backgrounds. To upload your own JPG, PNG, or WebP image, open the small **Upload your own images** control. Card backs should be at least 250 × 350 pixels (5:7 portrait recommended); backgrounds should be at least 1280 × 720 pixels (16:9 recommended). Uploads up to 10 MB are optimized and saved only in your browser, so they remain available after you reopen the page in that browser and are not sent to other players. A saved **Your upload** tile shows the actual image and whether it is selected. Choose a preset without deleting your saved upload, or click **Your upload** to use it again. Use the remove button inside the upload panel only when you want to delete a saved image. Preset choices remain shared with the table. Backgrounds fill the play area and may crop at the edges; a dark overlay helps keep cards readable.

## Importing your deck

1. Export your deck:
   - **Moxfield:** More, then Export, then "Copy Plain Text" (or "Copy for MTGA")
   - **Archidekt:** Export, then "Copy to clipboard"
2. Paste it into "Import a deck" in Commander Table.
3. Click **Load cards**, then **Save**.
4. If the export doesn't mark your commander, pick it from the dropdown. You can also set an optional partner or background.

Decks are saved in your browser.

## Playing a game

- One person clicks **Host a game** and gets a 5-letter room code. Click the code in the top-left to copy an invite link, and send it to your friends. (☰ → **Copy invite link** does the same thing.)
- Everyone else opens the link (or enters the code) and clicks **Join**.
- The host clicks **Start game** to begin. If everyone rolled for first player (🎲 Dice, see **Turn helpers**), that order is used. Otherwise the turn order is random.
- The player whose turn it is has a yellow outline around their board in Sidebar and Grid layouts. Battlefield creatures show power and toughness in a compact, two-part badge at the card's bottom-right.
- Supports 2 to 4 players comfortably, and the table seats up to 6. It's designed for 1v1 up to 4-player Commander.
- When a Commander is played from the command zone, a punchy boom-crack Commander slam-and-glow effect highlights the play in its color identity, while ordinary card placements and battlefield repositioning use a softer tap sound. Two-color Commanders split the ring into top/bottom halves; three- to five-color identities use distinct radial segments. Players with reduced-motion preferences see a brief static color flash instead of movement.
- Want to practice alone? Click **Practice solo**.
- To concede, ☰ → **Concede game…** marks you out and skips you in turn order. If it was your turn, play passes to the next player.

## iPad and touch controls

On an iPad or phone, open the top-right **☰** menu and turn on **Touch mode**. The setting is saved only in that browser on that device, and does not change what other players see. Touch mode keeps the page fixed while dragging cards, including near the bottom edge of your hand, and uses the visible mobile screen height. Card menus, the game log, and dialogs can still scroll internally. On a phone in portrait, a reminder recommends rotating to landscape for more room; you can dismiss it and keep playing upright. Turn Touch mode off from the same menu to restore standard page behavior.

## Display settings

Open ☰ → **Display settings…** to adjust how things look on your screen:

- **Magnifier size:** how big the magnifier circle is (see **Magnifier** under **Cards on the table** below).
- **Hand size:** a slider for how big your hand cards are, with a **Reset** button.
- On very wide monitors (2500px and up), opponent names get a bit larger.

## Playing on a LAN (optional)

This is for playing without the website, for example when one computer hosts on your local network. It works like Forge's LAN play: one person's computer hosts, and everyone else just uses a browser. No accounts, and no install for the other players.

**Hosting (one person):**

- You need Python 3. On Windows, get it from the Microsoft Store (search for "Python").
- Start the server:
  - **Windows:** double-click `Start LAN game.bat`.
  - **macOS:** double-click `start-lan-game.command`. The first time, if macOS warns, right-click it and choose Open.
  - **Linux:** run `./start-lan-game.sh`.
  - **Any terminal:** run `python lan-server.py` (or `python3`) from the game folder.
- A small menu appears in the window. Press Enter to choose **[1] Start the game (opens your browser)**. The other options are **[2] Status** (address, connected players, version), **[3] Check for updates**, and **[Q] Quit**. Once it's running, the menu offers Open in browser, Status, Check for updates, and Stop. Keep the window open while you play.
- The first time, Windows asks whether Python may use the network. Tick both boxes (Private **and** Public, since office networks are often "Public") and click **Allow**.
- The lobby shows a line like `http://YOUR-PC-NAME:8790/`. Send that to the other players. They open it in Chrome or Edge and join with the room code as usual.
- The version is shown at the bottom of the lobby, like `v0.5.0 (abc1234)`. The part in brackets is the GitHub commit it's running, so it's always exact.

**Updates:**

- The host's browser checks GitHub automatically and shows "Update available". Click **Updates** (in the lobby footer, or the top bar during a game), then **Update & restart**.
- It downloads the latest version, keeps a backup of the replaced files in a `.backup` folder, restarts the server, and the page reloads by itself. Other players reconnect automatically and see a "reload to get the new version" notice.
- Only the host's computer can install updates. A git checkout updates with a fast-forward (like `git pull`) and refuses if it has uncommitted changes. A copy with changes that aren't on GitHub won't auto-update.

**Options:** `--port 8791` (if 8790 is busy), `--no-browser`, and `--start` (skip the menu).

**Good to know:**

- Decks are saved per address, so decks imported on the online link need to be pasted once more at the LAN address. It stays the same afterwards.
- Card images still come from Scryfall, so everyone needs normal internet access.
- If players can't reach the address, the host's firewall or the network may be blocking it. Try again with another person hosting.

## If something goes wrong

Dropped connections and crashed tabs happen, and recovering from them is the main reason this app exists.

**How connections work:**

- Games connect through a small relay server (on Cloudflare), so they work on office and school networks too. If the relay can't be reached, the game automatically tries a direct browser-to-browser connection.
- The top bar tells you what's happening, for example "Waiting for the host to open room ABCDE" or "Lost the connection to the host — reconnecting".
- Reloading the page or a short drop is fine. Everyone reconnects automatically and the game state is kept.
- Actions made while you're disconnected for more than about 20 seconds aren't applied late. You'll get a notice instead.
- If the same game is opened in a second tab, the first tab steps aside.
- For trouble, open ☰ → **Connection details…**. It shows a report you can copy and send.

**Other tips:**

- If a tab crashes or gets closed, open the game again. Your game state comes back with you.
- If the host's connection drops, the other players' games pause and reconnect by themselves once the host is back.
- Your decks are saved in your browser, so use the same browser you played in.

## Controls

**Cards on the table**

- Click a battlefield card to tap or untap it.
- Double-click a card in your hand to play it.
- Hover over a card in your hand and press **T** to play it onto the battlefield **tapped**; it is placed in the battlefield area that matches its card type. On the battlefield, **T** still taps or untaps it.
- Double-click your commander to cast it. Commander tax is manual: left-click the 🪙 chip beside CMD for +2, right-click for −2 (or use the commander's right-click menu).
- Right-click any of your cards for options: counters, transform, face down, **Copy this card**, give control, and move to any zone. On iPad with **Touch mode** on, tap a card and choose **Actions**, or press and hold it to open those options.
- Right-click an opponent's card (or use the graveyard/exile viewer) to **Copy this card** onto your battlefield — handy for Clone effects. Copies show a purple **TOKEN COPY** label and vanish if they leave the battlefield.
- Drag cards between hand, battlefield, graveyard, exile, library, and command zone. Shift-drop onto the library to put a card on the bottom. Drag cards within your hand to reorder it.
- **Select several battlefield cards:** drag from empty space on your battlefield to draw a rectangle around cards. The tabletop prevents browser text/image selection while you drag. Drag any selected card to move the group. Hold **Shift** while drawing to add cards, or **Shift-click** a card to toggle it. Click empty battlefield space or press **Esc** to clear the selection. Dropping a selected group onto one of your zone piles moves the whole group there; dropping it on another player's board gives them control of the whole group.
- **Give control by dragging:** drag any card (from your battlefield, hand, graveyard, exile, and so on) onto another player's battlefield to give them control of it. It lands where you drop it and still shows you as the owner, the same as **Give control to** in the right-click menu. They can give it back the same way or with **Return to owner**. If you own a card that another player controls, right-click it on their board and choose **Take back** to get it back without asking.
- **Card preview:** hover a card to see a big preview floating next to your mouse.
- **Magnifier:** hold **V** over the table and a circle follows your cursor. Every card inside it is shown large in a panel on the other half of the screen. The more cards in the circle, the smaller each tile, but each is as big as fits. Release **V** to close it. (**Z** is still "turn face-down.")

**Your battlefield**

- Your battlefield has three zones: **Creatures / Planeswalkers**, **Lands**, **Artifacts / Enchantments**. New cards drop into the right zone automatically, and basic lands / identical tokens pile up neatly.
- Your **LIB · GY · EXILE · CMD** piles and your hand float over the bottom of your battlefield, so the battlefield uses the full height. Drag a card onto one to put it there (Shift-drop on LIB = bottom); click LIB to draw; click GY/EXILE to search; drag a pile to pull its top card. Opponents' LIB / GY / EX / HAND counts and their commander are in their header.
- Drag any card anywhere you like — it stays exactly where you put it.
- Open ☰ → **Arrange zones** to move a zone (drag its name — its cards come with it) or resize it (drag the bottom-right corner). While you're arranging, **Tidy cards**, **Reset zones** and **Done** appear in the small box at the top-right of your battlefield. **Tidy cards** puts everything back into its zone; **Reset zones** restores the default layout. Your layout is remembered for future games. If you haven't arranged your zones yourself, the default zones stretch to fill the battlefield in every layout (cards keep their size). Zones you've arranged stay exactly where you put them.
- What you see is what everyone sees: opponents see your board exactly as you arranged it, and you see theirs the way they arranged it.
- Every board always fits the screen, so there's no scrolling.
- Battlefield cards are about 40% bigger (about 12 across instead of 17), so busy boards start overlapping cards sooner.
- Drag the bar between the opponents' area and yours to give your board more or less room. In the Top and Grid layouts, right-click a player's name → **Show this board large** (or double-click their board) to show it large.
- **Table layout** — switch with the buttons in the top bar (remembered):
  - ▥ **Sidebar**: your board big on the left. The right-hand column shows every other player as a small copy of their board, with their life top-left and their hand and piles along the bottom; your own slim YOU tile comes first. Click a tile to view that player's board big (their hand is then face-down in the bottom strip, and yours is hidden). Click your YOU tile to go back. New players start in this layout until they pick another.
  - ▦ **Grid**: every player gets an equal quadrant, and yours is drawn exactly like the opponents' (small hand fan bottom-left, piles bottom-right, life top-left). Cards are auto-fitted to be as big as they fit. Click an opponent to view them full size and use **← My board** to come back.
- The **📜 Log** button in the top bar slides the game log (and the shortcut help) out from the right edge. Newest actions appear at the top; scroll down for older actions. Card-printing changes are kept out of the log. Click the button again to close.
- Cards overlap more as your hand grows, and the card under your mouse lifts up so you can read it.
- Every opponent's hand shows in their header, right next to their commander: a small fan of card backs with the number of cards. If they turn on **Reveal my hand to everyone**, the fan shows their real cards face-up (marked REVEALED) — hover one to read it in the card preview.
- When you view another player's board (Sidebar or Grid), their hand (face-down card backs, or the real cards if they revealed it), Library, Graveyard, Exile and Command appear in the same bottom strip as yours, and your own are hidden. Click a pile to look through it. Click **YOU** to come back to your own board.

**Auras & Equipment**

- Drag an Aura or Equipment onto any creature — yours or an opponent's — to attach it. It tucks behind the creature and moves with it. You can even drag it straight from your hand.
- Or right-click it → **Equip to… / Enchant / attach to…** (hover + **A**), then click the creature.
- Right-click → **Unattach**, or just drag it somewhere else on your battlefield.
- If the creature leaves the battlefield, Equipment stays behind unattached, and an Aura offers a one-click "Put into graveyard".

**Life, counters & commander damage**

- Your life box is in the small floating box at the top-right of your battlefield, with your name, counters and commander damage: − **40** +. The **− / + buttons have generous click targets**, including on smaller opponent boards. Click **▾** to open the menu: commander damage on top (grouped by player, in their colour) and Poison, Energy, Experience, Rad and Tickets below. Opponents have the same box (click ▾ to see their counters; − / + on their life asks their game to change it).
- If your life drops from above 0 to 0 or below, or one opposing Commander deals you 21 damage, you're asked whether to concede. Choose **Cancel** to keep playing at 0 or negative life. If you attempt to draw from an empty library, its **0** count turns red and the Concede prompt appears again.
- Commander damage is in that same ▾ menu: one row per opposing commander, with − and + buttons (it also adjusts your life). The ▾ shows ⚔ and the highest damage once there is any, and the number turns red at 21. You can also change the damage your own commander has dealt from an opponent's ▾ menu.
- On an opponent's header, the tag in **your** color is the damage your commander has dealt them — click it to deal more (right-click to undo).
- Commander tax: the 🪙 chip beside **CMD** — **left-click +2, right-click −2**. It never goes up by itself.
- Counters stack down the top-right corner of a card; the P/T badge stays in the bottom-right corner. On both, **left-click goes up, right-click goes down**.
- Cards in your hand show their mana cost along the top edge; your hand count shows above your hand and every opponent's hand count is in their header.
- Your hand size is set in ☰ → **Display settings…** (see **Display settings** above).

**Counters, power/toughness & card info**

- Right-click a card → **Counters**: add +1/+1 or −1/−1 (they cancel each other out, like the real rules), Loyalty ±1 on planeswalkers, **Add a counter…** for any named counter (charge, shield, stun…), plus **Increment / Double / Decrement all counters** and **Reset counters**.
- Right-click a battlefield card → **Power / Toughness**. Use **Power +1 / Power −1** or **Toughness +1 / Toughness −1** to change just one stat; **Alt+1 / Alt+3** adjust power and **Alt+2 / Alt+4** adjust toughness. **Manual +1/+1 (until reset)** changes both stats without adding a counter. Real +1/+1 and −1/−1 counters still affect both stats, and the resulting P/T badge is shared with everyone. **Set power/toughness…** changes the base override; **Reset power/toughness** clears manual changes. Manual changes are bookkeeping aids: they stay until reset and do not automatically model or expire temporary effects or abilities from card rules text.
- Right-click any card (yours or an opponent's, or in a graveyard/exile search) → **View information**: big card image, rules text with mana symbols, official rulings, set and rarity, format legality and price.
- Shortcuts while hovering one of your cards: **+** / **−** add a +1/+1 / −1/−1 counter, **J** add a named counter, **Shift+1 / Shift+2 / Shift+3** increment / double / decrement all counters, **Alt+1 / Alt+3** power up/down, **Alt+2 / Alt+4** toughness up/down, **Z** face down, **I** view information (works on opponents' cards too).

**Graveyard tools & printings**

- The Graveyard pile shows a count like **12 · 7P** — 12 cards, 7 of them permanents. Hover a Graveyard or Exile pile for a breakdown by type (Creatures, Lands, Artifacts, Instants…).
- Searching a graveyard/exile/library has tabs: **All · Permanents · Non-permanents** (Alt+1/2/3), on top of the search box and type filters.
- Right-click your Graveyard (or Exile) → **Pick at random** → choose Any card, Permanent, or a card type. It announces the pick in the log and lets you move it, or make a token copy (normal or tapped).
- Right-click your Graveyard/Exile → **Top card** to move the newest card, or just drag the pile to pull its top card anywhere.
- Commander tax is manual: 🪙 chip beside **CMD** — left-click +2, right-click −2. The commander's right-click menu also has **Add commander tax (+2)** / **Remove commander tax (−2)**.
- Right-click any of your cards → **Switch printing…** to browse all printings available from Scryfall. Search by set or product name, set code, collector number, or year. **Use for all copies** changes every copy (great for basic lands). Everyone sees the new art, and your deck remembers the choice for future games.

**Library**

- Click your Library to draw; the card lifts out in a smooth arc, flips during its flight, and settles into your hand. Other players see the card-back animation without seeing its face.
- Right-click it for search, scry or look at the top X, mill, or **Reveal top card**. **Reveal top card** shows that card face up to everyone until it leaves the top of your library (draw, shuffle, etc.). **Play with top card revealed** is a separate, always-on option.

**Graveyard and exile**

- Click any graveyard or exile pile, yours or an opponent's, to open a searchable viewer.
- Type to filter by name, type, or rules text. Use the filter chips to narrow by card type, and sort by name, mana value, or type.

**Keyboard shortcuts**

Open **☰ → Hotkey list…** during a game to see the full reference.

Hover over one of your cards and press **T** to tap or untap it; if the hovered card is in your hand, **T** instead plays it onto the battlefield tapped. Press **F** to flip, **Z** to turn face down/up, **G** to move to Graveyard, **E** to move to Exile, **H** to move to Hand, **B** to move to Battlefield, **A** to attach, **J** to add a counter, or **I** to view card information.

Hover over your **Library** and press **S** to shuffle (the Library itself wiggles with a short sound), or **X** to mill the top card into your Graveyard. Press **L** anywhere during a game to open Search Library. **Ctrl+F** remains the browser's Find-on-page shortcut. You can also draw with **D**, untap all with **U**, pass the turn with **Space**, and undo with **Ctrl+Z** (or **⌘Z** on Mac).

For a hovered card, **+ / =** adds a +1/+1 counter and **− / _** adds a −1/−1 counter. **Shift+1 / Shift+2 / Shift+3** increments, doubles, or decrements all counters; **Alt+1 / Alt+2 / Alt+3 / Alt+4** adjusts power/toughness up or down. Hold **V** over the table for the magnifier.

## Life, damage, and counters

- Use the **−** and **+** buttons to change life. The buttons have larger hit areas; Shift-click for 5 at a time.
- **Commander damage:** there's a tracker for each opposing commander. Adding commander damage also removes life, and the tracker turns red at 21.
- **Poison and player counters:** energy, experience, rad, and tickets.
- You can change an opponent's life from their panel. The change is logged.
- **Monarch and initiative:** right-click a player's name.

## Tokens

- When you import a deck, the tokens related to your cards are linked automatically.
- When you play a card that makes tokens, a pop-up offers a one-click **+ Token** button.
- The Tokens menu (☰ → **Tokens**) lists your deck's tokens.
- **Search all tokens** finds any token on Scryfall.

## Turn helpers

- **Auto-untap and Auto-Draw** at the start of your turn are toggled with switches (green = on): Auto-untap is the switch next to **Untap All** in the top bar, and **Auto-Draw** is labeled clearly beside it. They're also still in the ☰ menu. Both start off in every game. In 1v1, the first player skips the first draw.
- A **Pass turn** button in the top bar, next to **Round N**. The round goes up only after every player has had a turn. It's safe to click: if two players press it at the same moment, only one pass counts.
- **Start game / turn order:** pressing **Start game** automatically rolls a d20 for every seated player. Everyone sees the animated results, ties re-roll automatically, and the highest roll goes first. 🎲 **Dice** remains available for other dice, a coin flip, and a random player picker.
- London mulligan, with the first mulligan free.
- A game log where card names show the card when you hover over them.
- **Undo** for your own actions.

## Good to know

- This is a sandbox, like Tabletop Simulator. It doesn't enforce the rules, so players keep each other honest.
- This is an unofficial fan project and is not affiliated with Wizards of the Coast. Card data and images come from Scryfall.
- Please don't charge money for it.
- After an update, everyone should reload the page with **Ctrl+F5**. Players on older versions are handled automatically, but a reload makes sure you have the new layout.

## Troubleshooting

- **Join says it can't reach the host:** check the room code (or use the invite link), and make sure the host still has the game open. ☰ → **Connection details…** shows a report you can copy and send if you need help.
- Very strict work and school networks can still block the connection. If Join keeps failing, try a different network, or use the optional LAN option above.

## For developers

- Commander Table is plain HTML, CSS and JavaScript with no build step.
- `docs/NETWORKING.md` explains how online play works. `docs/relay-protocol.md` describes the relay protocol, and `relay/SETUP.md` covers setting up the Cloudflare relay.
- Tests: `tests/net-harness.html` and `tests/test_relay_protocol.py`.
- Releases follow [semantic versioning](https://semver.org/). Each release is tagged `vX.Y.Z` and listed in [CHANGELOG.md](CHANGELOG.md).
- Licensed under MIT (see [LICENSE](LICENSE)). Card data and images are © their owners, via Scryfall. This is an unofficial fan project, not affiliated with Wizards of the Coast.
- Releasing: `python tools/bump-version.py X.Y.Z` (sets the version in index.html, its `?v=` file links and js/app.js), add a CHANGELOG.md entry, commit, tag `vX.Y.Z`, push.
