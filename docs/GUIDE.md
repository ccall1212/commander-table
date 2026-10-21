# Commander Table: player guide

A full tour of the controls. For a short overview see the [README](../README.md).

**Play now:** https://ccall1212.github.io/commander-table/ — nothing to install. See [CHANGELOG.md](../CHANGELOG.md) for what changed in each version.


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

Decks are saved in your browser. Select a saved deck and choose **Deck Builder** to browse its cards as a large image grid like the in-game Library search. Hover a card to see its enlarged preview. Use the card-type chips to filter (such as Artifacts or Creatures), or sort by name, type, color identity or mana value. A compact **Deck checks** summary updates as you edit: it shows the count including commander(s), a missing-commander note, cards outside the combined commander color identity, and likely duplicate-name issues. If an older saved card is missing color identity data, the notes say that color identity could not be checked for those cards. Expand **Review notes** to see details, or dismiss the summary with **×**. These are common checks only, not a full Commander legality validator. They account for basic lands and card text that allows any number or up to a stated number of copies; house rules and other special cases are not enforced. Use the **×** on a card to remove one copy; **+ Add card** searches Scryfall as you type, and clicking a result adds it. Right-click a card for **Change printing…** or **Set as commander**. The printing picker can change one copy or use the selected printing for **ALL copies** of that card (useful for basic lands). **Export deck** opens **Export Options**: **Copy for Moxfield** keeps the current format including set/collector numbers, **Copy Plain Text** gives a simple names-and-quantities list, and **Download .txt** saves whichever format is selected. Arena and MTGO exports are not included. Your edits are saved with that deck in this browser and are used in future games.

### Back up and restore your collection

On the opening screen, choose **Back up / restore…** beside the Deck Builder. **Download backup** saves all decks (including chosen printings and linked tokens), appearance and uploaded images, your saved name, and display preferences to one `.json` file. This includes your floating chat panel's position, transparency/fade setting and size, plus the host's selected opening-hand rule. Keep the file to move your collection to another browser/computer or recover it later. Active games, room assignments, chat history, and connection identities are not included.

To restore, open the same control and select your backup file. Review how many decks will be added or skipped before clicking **Restore and reload**. Existing decks are kept; exact matches are skipped, and changed decks with the same ID are added as **(restored)** copies. Preferences and appearance stay as they are unless you check **Also restore saved preferences and appearance**. The page reloads after a successful restore. Files must be Commander Table collection backups, version 1, no larger than 20 MB. Normal decklist exports still use the Deck Builder's separate Export Options.

## Playing a game

- One person clicks **Host a game** and gets a 5-letter room code. Click the code in the top-left to copy an invite link, and send it to your friends. (☰ → **Copy invite link** does the same thing.)
- Everyone else opens the link (or enters the code) and clicks **Join**.
- The host clicks **Start game** to begin. The opening-hand rule is shown in the lobby and disappears after the game starts; it returns when starting a new game. If everyone rolled for first player (🎲 Dice, see **Turn helpers**), that order is used. Otherwise the turn order is random.
- The player whose turn it is has a yellow outline around their board in Sidebar and Grid layouts. Battlefield creatures show a compact power/toughness badge at the card's bottom-right. Click the power value to increase only power, or the toughness value to increase only toughness; right-click either value to decrease only that stat.
- Click your life total or an opponent’s displayed life total to set it directly; enter a whole number and confirm. The existing +/− controls remain available. Poison counters turn red at 10 or more and trigger a lethal-poison concede prompt when you reach that threshold.
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
- Right-click any of your cards for options: counters, transform, face down, **Copy this card**, give control, and move to any zone. From a card in your hand, choose **Reveal to everyone** to keep that one card face-up in your hand fan on opponents' screens while the rest stay face-down. Choose **Hide from everyone** on that card to turn it face-down again. Cards stop being individually revealed when they leave your hand. On iPad with **Touch mode** on, tap a card and choose **Actions**, or press and hold it to open those options.
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
- After you host or join a shared game, choose an available color in the picker before entering the table. Each player has a different color; taken colors show who chose them. Your choice stays with your seat when you reconnect or start a new game.

**Counters, power/toughness & card info**

- Right-click a card → **Counters**: add +1/+1 or −1/−1 (they cancel each other out, like the real rules), Loyalty ±1 on planeswalkers, **Add a counter…** for any named counter (charge, shield, stun…), plus **Increment / Double / Decrement all counters** and **Reset counters**.
- Right-click a battlefield card → **Power / Toughness**. Use **Power +1 / Power −1** or **Toughness +1 / Toughness −1** to change just one stat; **Alt+1 / Alt+3** adjust power and **Alt+2 / Alt+4** adjust toughness. **Manual +1/+1 (until reset)** changes both stats without adding a counter. Real +1/+1 and −1/−1 counters still affect both stats, and the resulting P/T badge is shared with everyone. **Set power/toughness…** changes the base override; **Reset power/toughness** clears manual changes. Manual changes are bookkeeping aids: they stay until reset and do not automatically model or expire temporary effects or abilities from card rules text.
- Right-click any card (yours or an opponent's, or in a graveyard/exile search) → **View information**: big card image, rules text with mana symbols, official rulings, set and rarity, format legality and price.
- Symbolic printed power or toughness (such as `*`, `*+1`, or another nonnumeric symbol) starts at **0** in the battlefield controls. `*/5` becomes adjustable **0/5**; `*/*` becomes **0/0**. Change each stat as usual to match the current board. These are manual values, so the game does not calculate variable stats from card rules. **Reset power/toughness** returns symbolic stats to 0 and numeric stats to their printed values, with real counters still applied. The tooltip and card details retain the printed value.

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

Move your pointer over empty space on your own battlefield and press **T** to open the Token menu. Hover over one of your cards and press **T** to tap or untap it; if the hovered card is in your hand, **T** instead plays it onto the battlefield tapped. Press **F** to flip, **Z** to turn face down/up, **G** to move to Graveyard, **E** to move to Exile, **H** to move to Hand, **B** to move to Battlefield, **A** to attach, **J** to add a counter, or **I** to view card information.

Hover over your **Library** and press **S** to shuffle (the Library itself wiggles with a short sound), or **X** to mill the top card into your Graveyard. Press **L** anywhere during a game to open Search Library. **Ctrl+F** remains the browser's Find-on-page shortcut. You can also draw with **D**, untap all with **U**, pass the turn with **Space**, and undo with **Ctrl+Z** (or **⌘Z** on Mac).

**Personal Undo and checkpoints:** the dropdown beside **↶ Undo** lists your recent actions. Choose a **Before:** entry and confirm to restore your board to before that action; later personal actions are discarded. During your turn, choose **Save phase checkpoint → Combat** (or another phase name) to mark your current board. Your turn's starting Main 1 checkpoint is saved after automatic draw/untap. Restoring a checkpoint changes only your board, leaving the shared turn, shared phase and other boards in place. The menu keeps up to 40 actions/checkpoints in this tab. History resets when the turn changes, cards change controller, you send another player an effect or receive one, a board handoff occurs, or the default board geometry automatically resizes. Reloading starts fresh. Card transfers and other players' effects cannot be rewound through an older local snapshot.

For a hovered card, **+ / =** adds a +1/+1 counter and **− / _** adds a −1/−1 counter. **Shift+1 / Shift+2 / Shift+3** increments, doubles, or decrements all counters; **Alt+1 / Alt+2 / Alt+3 / Alt+4** adjusts power/toughness up or down. Hold **V** over the table for the magnifier.

## Life, damage, and counters

- Use the **−** and **+** buttons to change life. The buttons have larger hit areas; Shift-click for 5 at a time.
- **Commander damage:** there's a tracker for each opposing commander. Adding commander damage also removes life, and the tracker turns red at 21.
- **Poison and player counters:** energy, experience, rad, and tickets.
- You can change an opponent's life from their panel. The change is logged.
- **Monarch and initiative:** right-click a player's name.

## Tokens

- When you import a deck, its related tokens are linked automatically.
- **☰ → Tokens** opens an image gallery of your deck's tokens, using the same card viewer as token search. Filter by name, type, or rules text, or use the type chips and sort controls.
- Click a token picture (or use the arrow keys and Enter), enter a whole-number quantity from **1 to 60**, then choose **Create X Tokens**. The quantity starts at 1. Cancel creates nothing and leaves the gallery open. Creating tokens closes the token galleries and returns you to the battlefield. Each created batch undoes as one action.
- Right-click a battlefield card → **Create related token…** opens the same gallery for that card. In Touch mode, use the card's **Actions** menu.
- Playing a token-making card offers **Choose tokens…** to open its gallery. If the card makes just one kind of token, the pop-up also keeps its quick **+ Token** action.
- **Search all tokens…** in your deck's gallery searches Scryfall for other tokens and uses the same picture-and-quantity flow. If an image cannot load, the viewer shows a readable name/type placeholder.
- Alternate artworks of the same token share one gallery entry. Tokens with different printed stats, abilities, colors, types, or reverse faces stay separate even if their names match. Older saved tokens are checked against Scryfall when possible; if details cannot be loaded, their entries remain separate.
- Right-click a token picture → **Choose artwork…** to browse matching versions before creating it. For a token already on your battlefield, right-click → **Switch printing…**. Filter the printing picker by set, product, collector number, or year, then use one printing for the selected token or all matching token copies. Changing artwork keeps counters, P/T adjustments, tapping, position and ownership. A token copy of a regular card uses that regular card's printings.

## Targeting arrows

- Right-click a battlefield card or a player's name, choose **Send arrow to…**, then click a different battlefield card or empty space on a player's battlefield to target that player. Clicking their name also works on small screens. Repeat for more attackers or effects: existing arrows remain visible. Everyone sees the shared arrows, colored for the player who drew them.
- On touch, use the card preview's **Actions → Send arrow to…**, or **☰ → Targeting arrow…** and tap the starting card/player, then the target. Picking endpoints does not tap, drag, or change life totals. Press **Escape**, right-click, or tap **Cancel** to cancel picking.
- Click or tap anywhere along an arrow line, or its player-target marker, to remove only that arrow. You can also focus an arrow with Tab and press Enter or Space. Any seated player can remove an arrow. Use **Clear all** near the top of the table or **☰ → Clear all targeting arrows** to remove all arrows.
- Click **×** on the floating controls to hide them locally without removing arrows. If you are still picking an endpoint, this also cancels that pick. **☰ → Show arrow controls** reopens them; starting another arrow also brings them back.
- Arrows are visual only. Player targets land at a small marker inside their board. Arrows follow cards and boards when boards resize or layouts change, including your read-only YOU miniature while viewing another player in Sidebar, and hide if an endpoint is not currently visible. When a card leaves the battlefield or a player leaves the table, only the affected arrows disappear. A new game or host reload clears them all; joining/reconnecting receives the current collection from the host.
- Only battlefield card instance IDs and player IDs are shared. Cards in hands/libraries cannot be arrow endpoints; face-down battlefield cards can be used without revealing their identities. The table supports up to 128 arrows; reaching that limit asks you to clear some instead of erasing an existing arrow.

## Room chat and turn notifications

- Open **💬 Chat → Pop out** to keep chat in a floating panel over the game. Drag the **Room chat** heading wherever it fits. **Dock** restores the normal top-right panel.
- Choose **Transparent** for a completely clear floating background while messages and controls remain visible. Empty space passes clicks through to the table; message text stays selectable and scrollable. Helper labels, timestamps and the message-limit footer are hidden in this mode. Controls appear while interacting with chat. Toggle Transparent again to restore the solid background.
- Transparent chat fades after eight seconds of inactivity, leaving a small **Chat…** button in its saved position. Click it (or the top-bar Chat button) to fade chat back in and start typing. New incoming messages also reveal chat without taking keyboard focus. An unsent draft keeps chat visible; solid chat does not fade.
- Drag the floating chat’s **bottom-right corner** to resize it smaller or larger. The message area scrolls within the window; the composer stays visible. You can also Tab to the resize handle and use arrow keys (Shift for larger steps).
- **Reset** returns floating chat to its default position and size. The position, size and floating/transparent preferences are saved only in your browser, not shared with other players. Chat stays within the visible screen after resizing.
- For keyboard movement, Tab to the floating **Room chat** heading and use arrow keys (hold Shift for larger steps). Escape closes chat and returns focus to its top-bar button. Closing and reopening chat keeps its saved presentation.

- Click **💬 Chat** in the top bar to open room chat. Type a message and press **Enter** or **Send** to share it with everyone in the room. Chat is separate from the game log; opening the chat panel shows the latest 100 messages for the room session, including after a reconnect.
- When the panel is closed, messages from other players briefly appear as small notifications near the top-right of the table and then fade away. The **Chat** button gently pulses and shows an unread count until you open it. When chat is already open, the newest message and panel border briefly glow instead. Your own sent messages appear in history but do not create duplicate notifications.
- **Sound off** is the default. Use the button in the chat header to turn the quiet two-note message chime on or off; the choice is saved on that browser. Sounds play only for other players' messages, with rapid messages throttled to avoid repeated chimes.
- At the start of each turn, a short banner appears over that player's battlefield. The active player sees **YOUR TURN**; everyone else sees **NAME'S TURN** over the same player's board. It is visual only and never blocks card movement or clicks. With reduced motion enabled, the banner appears briefly without animation.

## Turn helpers

- **Auto-untap and Auto-Draw** at the start of your turn are toggled with switches (green = on): Auto-untap is the switch next to **Untap All** in the top bar, and **Auto-Draw** is labeled clearly beside it. They're also still in the ☰ menu. Both start off in every game. In 1v1, the first player skips the first draw.
- A **Pass turn** button in the top bar, next to **Round N**. The round goes up only after every player has had a turn. It's safe to click: if two players press it at the same moment, only one pass counts.
- **Start game / turn order:** pressing **Start game** automatically rolls a d20 for every seated player. Everyone sees the animated results, ties re-roll automatically, and the highest roll goes first. 🎲 **Dice** remains available for other dice, a coin flip, and a random player picker.
- **Opening hands:** the host chooses the rule in the lobby before hosting. London is the default: draw 7, with the first mulligan free and one fewer card kept for each later mulligan; it allows at most 7 mulligans. **At least 3 lands** deals three random front-face Land cards plus four random cards from the remaining deck; each mulligan gets a fresh hand, with no bottoming. If the deck has fewer than 3 lands, it deals as many as it can and fills the rest randomly. **Draw 10, bottom 3** deals up to 10 cards each time and asks you to put up to 3 on the bottom while keeping at least one. Both alternate rules allow one mulligan by default. Before a player keeps, the host can right-click their name and choose **Grant another mulligan**; each grant adds one attempt for that player. Double-faced cards count as lands only when their front face is a Land. The host can change the rule before the game starts after confirming a full redeal for everyone. Everyone must finish their opening-hand choice before the host can start; the lobby names anyone still choosing. Cards cannot be played onto the battlefield until the game starts.
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
- Releases follow [semantic versioning](https://semver.org/). Each release is tagged `vX.Y.Z` and listed in [CHANGELOG.md](../CHANGELOG.md).
- Licensed under MIT (see [LICENSE](../LICENSE)). Card data and images are © their owners, via Scryfall. This is an unofficial fan project, not affiliated with Wizards of the Coast.
- Releasing: `python tools/bump-version.py X.Y.Z` (sets the version in index.html, its `?v=` file links and js/app.js), add a CHANGELOG.md entry, commit, tag `vX.Y.Z`, push.

## Moderators, recovery and board handoffs

- The host is the default moderator. Right-click a player’s name to **Grant moderator permissions** or **Revoke moderator permissions** (host only). Delegates can **Restore to game (undo concede)** and **Kick from game…**. Restoring a player resumes their turn eligibility; it does not rewind turns already played. Kicking removes that seat and stops it reconnecting. A person using another browser identity is not an account ban.
- A moderator can choose **Transfer this board…**, then a connected replacement player. This forcibly moves the non-host board, including private hand/library and a copy of the saved deck. The recipient needs an empty battlefield, graveyard and exile and no cards controlled elsewhere; their existing hand/library/command are backed up locally and replaced. The original seat leaves the room. The original board’s color stays with it; the recipient’s previous color becomes available again. Ownership, attachments, commander references and revealed-card markers follow the transferred cards. Undo history and targeting arrows clear at this administrative boundary. The host’s own board stays tied to its hosting seat.
- On a compatible room server, complete private boards and the saved deck are uploaded through the host after changes. Open **Menu → Choose / recover a board…** to see connected seats and **Saved to room** status, or retry a save. Completed saves last 24 hours and include hidden hand/library order. Pending saves may miss the latest action if the browser closes. The host and room server receive the private cards; ordinary players receive only public card views and save status. This is for trusted play, not protection against a cheating host.
- A fresh browser can join with the same name and **Request this board** without creating a duplicate seat. A moderator reviews and approves the request. For a disconnected owner, handoff uses the last completed server save; if unavailable it can use an original same-browser session/deck. Failure leaves both seats intact. Previously lost cards cannot be reconstructed retroactively. Recipient local storage must work before a handoff completes. The room host must still be able to resume its saved hosting session; this does not recover a lost host identity.
- **Dismiss** hides the lobby’s resume reminder without deleting the saved game. Joining that room offers to resume the saved seat. Choose a different name if you intentionally join as another player; matching names open the board claim chooser. An active online tab also uses the browser’s normal leave confirmation. Keep the original browser’s data intact.
- Delegating moderation does not move the network host. Shared actions still need the host connected; a disconnected host should resume its saved hosting session. All participants should use this version for moderation rooms: private seat keys protect resumed/moderator identities and are retained with the saved host session.
