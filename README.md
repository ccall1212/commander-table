# Commander Table

A free, browser-based Magic: The Gathering Commander table for playing with friends online. It's a lot like the Tabletop Simulator setup many of us used to play on, but it runs right in your web browser.

Version 0.1.0

## What you need

- Chrome or Edge
- An internet connection. Card images come from Scryfall, and online play uses PeerJS, a free peer-to-peer connection service.
- Nothing to install

## Getting started

1. Open the `commander-table` folder and double-click `index.html`. It opens in your browser.
2. That's it.

To share it with friends, zip the whole `commander-table` folder and send them the zip. They unzip it and double-click `index.html` too.

## Importing your deck

1. Export your deck:
   - **Moxfield:** More, then Export, then "Copy Plain Text" (or "Copy for MTGA")
   - **Archidekt:** Export, then "Copy to clipboard"
2. Paste it into "Import a deck" in Commander Table.
3. Click **Load cards**, then **Save**.
4. If the export doesn't mark your commander, pick it from the dropdown. You can also set an optional partner or background.

Decks are saved in your browser.

## Playing a game

- One person clicks **Host a game** and gets a 5-letter room code. Click the code in the top-left to copy it.
- Everyone else enters the code and clicks **Join**.
- The host clicks **Start game** to randomize turn order.
- Supports 2 to 6 players. It's designed for 1v1 up to 4-player Commander.
- Want to practice alone? Click **Practice solo**.

## Playing on a LAN (office / same network)

Use this when the online link sits on "Connecting", for example on a work network that blocks browser peer-to-peer connections. It works like Forge's LAN play: one person's computer hosts, and everyone else just uses a browser. No accounts, and no install for the other players.

**Hosting (one person):**

- You need Python 3. Get it from the Microsoft Store (search for "Python").
- Double-click `Start LAN game.bat` in the game folder. A window opens (keep it open while you play) and the game opens in your browser.
- The first time, Windows asks whether Python may use the network. Tick both boxes (Private **and** Public, since office networks are often "Public") and click **Allow**.
- The lobby shows a line like `http://YOUR-PC-NAME:8790/`. Send that to the other players. They open it in Chrome or Edge and join with the room code as usual.

**Good to know:**

- Decks are saved per address, so decks imported on the online link need to be pasted once more at the LAN address. It stays the same afterwards.
- Card images still come from Scryfall, so everyone needs normal internet access.
- If port 8790 is busy, run `python lan-server.py --port 8791` from the game folder.
- If players can't reach the address, the host's firewall or the network may be blocking it. Try again with another person hosting.

## If something goes wrong

Dropped connections and crashed tabs happen, and recovering from them is the main reason this app exists.

- Everyone's cards live in their own browser, and the game is saved continuously.
- If someone's connection drops, it reconnects automatically.
- If a tab crashes or gets closed, reopen `index.html`. It puts you straight back into the game.
- If the host crashes, the other players' games pause and reconnect by themselves when the host reopens.
- Use the same browser you played in.

## Controls

**Cards on the table**

- Click a battlefield card to tap or untap it.
- Double-click a card in your hand to play it.
- Double-click your commander to cast it. Commander tax is manual: left-click the 🪙 chip above CMD for +2, right-click for −2 (or use the commander's right-click menu).
- Right-click any of your cards for options: counters, transform, face down, **Copy this card**, give control, and move to any zone.
- Right-click an opponent's card (or use the graveyard/exile viewer) to **Copy this card** onto your battlefield — handy for Clone effects. Copies show a purple **COPY** label and vanish if they leave the battlefield.
- Drag cards between hand, battlefield, graveyard, exile, library, and command zone. Shift-drop onto the library to put a card on the bottom. Drag cards within your hand to reorder it.

**Your battlefield**

- Your battlefield has three zones: **Creatures / Planeswalkers**, **Lands**, **Artifacts / Enchantments**. New cards drop into the right zone automatically, and basic lands / identical tokens pile up neatly.
- Your **LIB · GY · EXILE · CMD** piles sit at the bottom-right next to your hand (with **Draw** and **Untap all** buttons). Drag a card onto one to put it there (Shift-drop on LIB = bottom); click LIB to draw; click GY/EXILE to search; drag a pile to pull its top card. Opponents' LIB / GY / EX / HAND counts and their commander are in their header.
- Drag any card anywhere you like — it stays exactly where you put it.
- Click **▦ Arrange zones** to move a zone (drag its name — its cards come with it) or resize it (drag the bottom-right corner). Your layout is remembered for future games. **Tidy cards** puts everything back into its zone; **Reset zones** restores the default layout.
- What you see is what everyone sees: opponents see your board exactly as you arranged it, and you see theirs the way they arranged it.
- Drag the bar between the opponents' area and yours to give your board more or less room. Click ⤢ on an opponent (or double-click their board) to show it large.
- **Table layout** — switch with the ▤ ▥ ▦ buttons at the top right (remembered): **Top** (opponents across the top), **Sidebar** (your board big on the left, opponents stacked on the right — click ⤢ on one to swap their board into the big area), **Grid** (every player gets an equal quadrant, you bottom-left; opponents' boards are biggest here). In Sidebar and Grid the card preview & game log open from the **📜 Log** button.
- Cards overlap more as your hand grows, and the card under your mouse lifts up so you can read it.
- Every opponent's hand shows in their header, right next to their commander: a small fan of card backs with the number of cards. If they turn on **Reveal my hand to everyone**, the fan shows their real cards face-up (marked REVEALED) — hover one to read it in the preview panel.

**Auras & Equipment**

- Drag an Aura or Equipment onto any creature — yours or an opponent's — to attach it. It tucks behind the creature and moves with it. You can even drag it straight from your hand.
- Or right-click it → **Equip to… / Enchant / attach to…** (hover + **A**), then click the creature.
- Right-click → **Unattach**, or just drag it somewhere else on your battlefield.
- If the creature leaves the battlefield, Equipment stays behind unattached, and an Aura offers a one-click "Put into graveyard".

**Life, counters & commander damage**

- Your life box is at the top-left of your area: − **40** +. Click **▾** to open Poison, Energy, Experience, Rad and Tickets. Opponents have the same box (click ▾ to see their counters; − / + on their life asks their game to change it).
- Commander damage shows as colored tags — one per opposing commander, in that player's color. **Left-click +1, right-click −1** (it also adjusts your life). A tag turns red and pulses at 21.
- On an opponent's header, the tag in **your** color is the damage your commander has dealt them — click it to deal more (right-click to undo).
- Commander tax: the 🪙 chip above **CMD** — **left-click +2, right-click −2**. It never goes up by itself.
- Counter badges and the P/T badge on a card: **left-click goes up, right-click goes down**.
- Cards in your hand show their mana cost along the top edge; your hand count shows above your hand and every opponent's hand count is in their header.
- The hand bar (the thin bar above your hand) drags up/down to resize your hand cards; double-click it to reset.

**Counters, power/toughness & card info**

- Right-click a card → **Counters**: add +1/+1 or −1/−1 (they cancel each other out, like the real rules), Loyalty ±1 on planeswalkers, **Add a counter…** for any named counter (charge, shield, stun…), plus **Increment / Double / Decrement all counters** and **Reset counters**.
- Right-click a card → **Power / Toughness**: **Set power/toughness…** (e.g. 4/4), increment/decrement power or toughness, and **Reset**. The card shows its current P/T badge (printed P/T + counters + changes) and everyone sees it.
- Right-click any card (yours or an opponent's, or in a graveyard/exile search) → **View information**: big card image, rules text with mana symbols, official rulings, set and rarity, format legality and price.
- Shortcuts while hovering one of your cards: **+** / **−** add a +1/+1 / −1/−1 counter, **J** add a named counter, **Shift+1 / Shift+2 / Shift+3** increment / double / decrement all counters, **Alt+1 / Alt+3** power up/down, **Alt+2 / Alt+4** toughness up/down, **Z** face down, **I** view information (works on opponents' cards too).

**Graveyard tools & printings**

- The Graveyard pile shows a count like **12 · 7P** — 12 cards, 7 of them permanents. Hover a Graveyard or Exile pile for a breakdown by type (Creatures, Lands, Artifacts, Instants…).
- Searching a graveyard/exile/library has tabs: **All · Permanents · Non-permanents** (Alt+1/2/3), on top of the search box and type filters.
- Right-click your Graveyard (or Exile) → **Pick at random** → choose Any card, Permanent, or a card type. It announces the pick in the log and lets you move it, or make a token copy (normal or tapped).
- Right-click your Graveyard/Exile → **Top card** to move the newest card, or just drag the pile to pull its top card anywhere.
- Commander tax is manual: 🪙 chip above **CMD** — left-click +2, right-click −2. The commander's right-click menu also has **Add commander tax (+2)** / **Remove commander tax (−2)**.
- Right-click any of your cards → **Switch printing…** to pick from up to 10 printings (shows set, number, year). **Use for all copies** changes every copy (great for basic lands). Everyone sees the new art, and your deck remembers the choice for future games.

**Library**

- Click your library to draw.
- Right-click it for search, scry or look at the top X, mill, reveal, and play with the top card revealed.

**Graveyard and exile**

- Click any graveyard or exile pile, yours or an opponent's, to open a searchable viewer.
- Type to filter by name, type, or rules text. Use the filter chips to narrow by card type, and sort by name, mana value, or type.

**Keyboard shortcuts**

Hover over a card and press:

- **T** tap, **F** flip, **G** graveyard, **X** exile, **H** hand, **B** battlefield

Other shortcuts:

- **D** draw, **U** untap all, **S** search library, **Ctrl+Z** undo

## Life, damage, and counters

- Use the **−** and **+** buttons to change life. Shift-click for 5 at a time.
- **Commander damage:** there's a tracker for each opposing commander. Adding commander damage also removes life, and the tracker turns red at 21.
- **Poison and player counters:** energy, experience, rad, and tickets.
- You can change an opponent's life from their panel. The change is logged.
- **Monarch and initiative:** right-click a player's name.

## Tokens

- When you import a deck, the tokens related to your cards are linked automatically.
- When you play a card that makes tokens, a pop-up offers a one-click **+ Token** button.
- The Tokens menu lists your deck's tokens.
- **Search all tokens** finds any token on Scryfall.

## Turn helpers

- **Auto-untap and auto-draw** at the start of your turn are toggled with the small **on/off switch next to Draw and Untap all** at the bottom-right (green = on); they're also still in the ☰ menu. In 1v1, the first player skips the first draw.
- A **Pass turn** button.
- Dice, a coin, and a random player picker.
- London mulligan, with the first mulligan free.
- A game log where card names show the card when you hover over them.
- **Undo** for your own actions.

## Good to know

- This is a sandbox, like Tabletop Simulator. It doesn't enforce the rules, so players keep each other honest.
- This is an unofficial fan project and is not affiliated with Wizards of the Coast. Card data and images come from Scryfall.
- Please don't charge money for it.

## Troubleshooting

- **Join says it can't reach the host:** check the room code, and make sure the host still has the game open.
- Some strict work and school networks block peer-to-peer connections. If Join keeps failing on one, try a different network.
