# Changelog

All notable changes to Commander Table are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each release is tagged `vX.Y.Z` in git.

## [Unreleased]

## [0.29.0] - 2026-10-20

### Added
- Draw one shared targeting arrow between battlefield cards or players. Start from a card/player menu or the touch-accessible table menu, cancel with Escape or Cancel, and let any seated player clear the arrow. Arrows follow the displayed cards across layouts and disappear when an endpoint leaves the battlefield or table.

[Unreleased]: https://github.com/ccall1212/commander-table/compare/v0.29.0...HEAD
[0.29.0]: https://github.com/ccall1212/commander-table/compare/v0.28.1...v0.29.0

## [0.28.1] - 2026-10-19

### Changed
- Replace the Knight's Vigil table background (and its picker thumbnail) with new artwork.

## [0.28.0] - 2026-10-19

### Added
- Add a visual pre-game **Deck Builder** using the in-game card gallery: search and add cards, remove copies, change printings for one or ALL copies, sort/filter by name, type, color identity and mana value, and export through options to copy for Moxfield or plain text, or download a `.txt` file. Changes save to the deck in the browser.

### Fixed
- Keep saved printing changes isolated to the selected copy when switching one card's artwork during a game; choosing all copies still updates the full card name.



## [0.27.0] - 2026-10-19

### Added
- Make **Reveal to everyone** show just the selected card face-up in its normal spot in the opponent's hand fan, while the rest of the hand stays face-down.

### Fixed
- Clear a stale floating card preview when the pointer moves from a revealed card to a face-down card in an opponent's hand.


## [0.26.0] - 2026-10-19

### Added
- Add room chat with synchronized messages, recent history, pulsing/unread visual notifications, in-panel new-message highlights, and an optional quiet two-note sound that is off by default.
- Show a brief “YOUR TURN” or “NAME’S TURN” banner over the active player’s board when each new turn begins.

## [0.24.0] - 2026-10-18

### Added
- Open the existing Token menu by pressing **T** over empty space on your own battlefield, while preserving **T** for tapping/untapping cards and playing a hand card tapped.

## [0.23.0] - 2026-10-18

### Added
- Let players click a life total and set it directly, with the same life-change logging and multiplayer synchronization as the existing controls.
- Highlight poison totals in red at 10 or more counters, clearing the warning below 10 in both Sidebar and Grid views.
- Prompt the player to concede when their poison total first reaches 10 or more, matching the existing lethal-life and commander-damage prompts.


## [0.22.4] - 2026-10-18

### Changed
- Add a compact white battlefield P/T badge with individually clickable power and toughness values, no slash separator, and left/right-click adjustments for only the selected stat.


## [0.22.3] - 2026-10-18

### Fixed
- Restore the Concede confirmation when life reaches 0 or below or one commander deals 21 damage.
- Warn again when a player attempts to draw from an empty library, and highlight the zero library count in red.

## [0.22.2] - 2026-10-18

### Fixed
- Fix Grid view drops so battlefield cards can be moved to the Library, Graveyard, Exile, and Command zone instead of being repositioned on the battlefield.

## [0.22.1] - 2026-10-17

### Fixed
- Prevent Safari from taking over touch drags started around the overflowing hand and tabletop edges.
- Fit Touch mode to Safari's visible viewport and respect the device safe area without adding extra height.
- Keep menus, the game log and dialogs independently scrollable while the page stays fixed.

## [0.22.0] - 2026-10-17

### Added
- Add optional Touch mode from the hamburger menu for iPad, iPhone, and other touch screens, saved locally per browser/device.
- Let touch players tap cards to inspect them and open an **Actions** menu, or press and hold cards and piles to open their context menu.
- In Touch mode, prevent accidental page scrolling during card drags, use the dynamic mobile viewport height, and recommend landscape on narrow phones without blocking portrait play.
- Keep the standard desktop interaction path unchanged when Touch mode is off.

[0.28.1]: https://github.com/ccall1212/commander-table/compare/v0.28.0...v0.28.1
[0.28.0]: https://github.com/ccall1212/commander-table/compare/v0.27.0...v0.28.0
[0.27.0]: https://github.com/ccall1212/commander-table/compare/v0.26.0...v0.27.0
[0.26.0]: https://github.com/ccall1212/commander-table/compare/v0.24.0...v0.26.0
[0.24.0]: https://github.com/ccall1212/commander-table/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/ccall1212/commander-table/compare/v0.22.4...v0.23.0
[0.22.4]: https://github.com/ccall1212/commander-table/compare/v0.22.3...v0.22.4
[0.22.3]: https://github.com/ccall1212/commander-table/compare/v0.22.2...v0.22.3
[0.22.2]: https://github.com/ccall1212/commander-table/compare/v0.22.1...v0.22.2
[0.22.1]: https://github.com/ccall1212/commander-table/compare/v0.22.0...v0.22.1
[0.22.0]: https://github.com/ccall1212/commander-table/compare/v0.21.4...v0.22.0

## [0.21.4] - 2026-10-17

### Added
- Add custom card-back and play-area uploads behind a compact, collapsed control so the appearance picker stays uncluttered.
- Show saved custom images as selectable tiles with a clear selected state; keep uploads in browser storage for later reuse even when switching back to a preset.
- Validate formats, dimensions, and file sizes; optimize images to WebP and keep custom files local to the player's browser.

### Fixed
- Dismiss context menus when clicking or tapping outside them.
- Prevent browser text and image dragging on the tabletop from interfering with card dragging and accidentally selecting multiple cards.

[0.21.4]: https://github.com/ccall1212/commander-table/compare/v0.20.5...v0.21.4

## [0.20.5] - 2026-10-17

### Changed
- Sharpen the Commander cast sound into a punchier boom-crack, with a bright initial snap over a deeper impact.

## [0.20.4] - 2026-10-17

### Changed
- Add a subtle card-placement sound when cards enter the battlefield or are repositioned on it.
- Give Commander casts a heavier, layered boom and keep the color-identity ring visible longer.

## [0.20.3] - 2026-10-17

### Added
- When a Commander is cast from the command zone, a brief slam-and-glow effect plays on the battlefield card in its color identity, with a short impact sound. Everyone at the table sees it, it never blocks clicking, and it only plays when the card is cast (not when it is moved around afterwards).
- Two-color identities split the ring top and bottom; three to five colors use equal radial segments; colorless Commanders get a neutral glow. With reduced motion turned on you get a brief static flash instead of movement.


## [0.19.1] - 2026-10-17

### Changed
- Show the newest game-log entries at the top, with older actions below.

### Fixed
- Stop recording card-printing changes in the game log; changing art still updates the table and saved deck.


## [0.19.0] - 2026-10-17

### Added
- Show all available card printings and search them by set, product, collector number, or year when switching a card's art.


## [0.18.2] - 2026-10-17

### Fixed
- Smooth the draw-card animation with a lifted arc and gentler deceleration, then blend each card into its hand slot as it arrives instead of revealing the whole group after the last flight.

## [0.18.1] - 2026-10-17

### Added
- Drag on empty battlefield space to select several cards, then drag any selected card to move the group together.
- Hold **Shift** while drawing a selection rectangle to add cards; **Shift-click** toggles one card, and clicking empty space or pressing **Esc** clears the selection.
- Dropping a selected group on a zone pile moves the whole group; dropping it on another player's board gives that player control of the group.

### Fixed
- When dragging a selected group, show a layered preview of every selected card and keep their relative positions visible.

## [0.17.1] - 2026-10-17

### Fixed
- The draw-card animation never played in the Sidebar layout (your hand's box has no width there, so it was skipped), and opponents never saw it at all (it looked for their hand in a header that no longer exists). Your own draws now fly from your Library and flip over in both Sidebar and Grid, and everyone else sees a face-down card fly from that player's Library to their hand fan.

## [0.17.0] - 2026-10-16

### Added
- Animate a drawn card from the Library toward its owner's hand, with a short flip as it arrives.
- Other players see the card-back version of the animation, so the draw cue does not reveal a hidden card.

### Notes
- The animation is visual-only, does not block clicks or dragging, and is skipped when reduced motion is preferred. Chris reviewed the preview; ChatGPT completed source-level checks but did not run a real-browser or multiplayer test.

## [0.16.0] - 2026-10-16

### Added
- Press **S** while hovering over your Library to shuffle it with a small card-riffle animation and a synthesized shuffle sound.
- Press **X** while hovering over your Library to mill the top card into the Graveyard, with a short visual cue.
- Added an in-game **Hotkey list…** reference under the ☰ Options menu.
- Press **T** while hovering over a card in your hand to play it onto the battlefield tapped; it lands in the battlefield area appropriate for its card type. On the battlefield, **T** still taps or untaps.

### Changed
- Replaced the abbreviated **AD** top-bar label with **Auto-Draw**.
- Changed the card-to-Exile shortcut from **X** to **E**; **G** remains Graveyard and **B** remains Battlefield.
- Use **L** to open Search Library from anywhere; **S** is reserved for shuffling when the Library is hovered. Ctrl+F remains the browser's Find-on-page shortcut.

## [0.15.1] - 2026-10-17

### Fixed
- Made the life-total minus/plus controls easier to click, including in smaller opponent-board tiles, without enlarging the counters dropdown button.

## [0.15.0] - 2026-10-16

### Added
- Pressing **Start game** now automatically runs the opening turn-order d20 roll, animating every player's result on all connected screens and highlighting who goes first.
- Tied high rolls still reroll automatically; the selected highest roller starts the game.

## [0.14.2] - 2026-10-16

### Fixed
- Restored a clearly visible yellow outline around the active player's board in Sidebar and Grid layouts.

## [0.14.1] - 2026-10-16

### Fixed
- In Sidebar view, the commander-tax chip sits beside CMD instead of above the commander card, keeping the card from being pushed down.


## [0.14.0] - 2026-10-17

### Removed
- The "Opponents across the top" layout (▤). Only Sidebar and Grid remain. If you had Top selected you'll start in Sidebar. (A table with nobody else at it, such as Practice solo, still shows your board full width.)

## [0.13.1] - 2026-10-17

### Changed
- The Auto-Draw (**AD**) switch moved from the Library pile to the top bar, right beside Untap All and its auto-untap switch. It no longer covers the Graveyard.
- In the miniature strips (Grid and the opponent tiles) the hand fan now spreads across the free space between the hand and the piles instead of bunching up on the left.

## [0.13.0] - 2026-10-17

### Changed
- The hand and piles strip now looks like EDHPlay's: the board's background art runs behind it instead of a separate dark band, and the labels (HAND, LIB, GY, EXILE, CMD) are plain text rather than boxed pills. This applies to your own board, to another player's board when you view them, and in every layout. The strip still keeps its own space under the cards, so nothing is covered.
- Grid: your own quadrant is now a copy of the opponents' miniatures: life top-left, a small face-up hand fan bottom-left and small piles bottom-right, all drawn inside the board. Playing and dragging cards, tapping, the right-click menu, keyboard shortcuts, drawing from the Library, the AD switch, life and the ▾ menu all work from it.
- Top layout: cards can sit behind your hand and piles (like EDHPlay) instead of the board stopping above them, and a lifted hand card stays small so it doesn't cover its neighbours.
- Hovering a card in your hand shows the big preview in a fixed spot just above the hand instead of next to the mouse, so it never hides the other hand cards.

## [0.12.1] - 2026-10-17

### Changed
- Hovering an opponent's tile no longer greys it out or shows an eye in any layout. Clicking the tile still opens their board (the pointer just turns into a hand over it).
- The dark backing behind your hand and piles, and behind the hand/piles row in opponent tiles, is gone.
- Opponent tiles in the Top layout are no longer squashed: the top row is taller by default (about 47% of the screen), the hand and piles row in a tile is smaller, and boards keep at least ~3 rows of cards.

## [0.12.0] - 2026-10-17

### Added
- Opponents across the top (Top layout) now use the same simple miniature tiles as the Sidebar, with the greying eye on hover. Click a tile to view that board big underneath; your own YOU tile appears in the row so you can click back.
- In the Grid layout, click an opponent to view their board full size, and use **← My board** to come back.

### Changed
- Cards are bigger in Top and Grid: the board is auto-fitted to its area, so cards are as large as they fit (about 1.6x in Grid and 1.5x in Top at 1920x1000; miniature tiles about 1.5x). Zones and cards are spread or squeezed to fit, rows overlap a little when crowded, and your saved positions are never changed. Dragging cards (including giving one to a player) still lands exactly where you drop it.
- The hand and piles strip always keeps its own space under the board.

### Removed
- The Focus layout (◎): it behaved like Sidebar. If you had it selected you'll start in Sidebar, and the "Auto-focus" setting is gone.

## [0.11.0] - 2026-10-17

### Changed
- Opponent tiles in the Sidebar, Focus and Grid layouts are now simple, EDHPlay-style miniatures: a slim name bar, then a small copy of their board with their life and commander damage in the top-left corner and their hand (face-down, or face-up if revealed) and Library / Graveyard / Exile / Command in a strip along the bottom. The tall header with counters and the hand fan is gone.
- A miniature squishes the board vertically to fit its tile, so cards stay as large as possible (rows overlap a little when the board is tall).
- Hovering a tile greys it out and shows an eye; click anywhere on it to view that board big. The life +/- buttons still work without opening it.
- The right-hand column is wider (about a quarter of the screen), and your own YOU tile is slim while you look at your own board.

- Commander damage moved into the life menu (the ▾ under your life, like EDHPlay). It's grouped by player in that player's colour, with each commander's damage and − / + buttons (you can change yours and the damage your commander deals). The coloured chips beside the life total are gone; the ▾ shows ⚔ and the highest damage when there is any (red at 21). The menu floats above the board, so it is never cut off.

### Fixed
- Boards in the Top and Grid layouts shrank in 0.10.0 because space was reserved for the hand and piles strip. The reserved space now only applies to Sidebar and Focus, where it costs nothing, so Top and Grid boards are full size again.

## [0.10.0] - 2026-10-16

### Changed
- When you view another player's board (Sidebar, Focus or Grid), you now see their hand, Library, Graveyard, Exile and Command in the same bottom strip as your own. Their hand is shown as face-down card backs (face-up if they revealed it). Your own hand and piles are hidden until you click **YOU**. The floating zone bar at the top right of their board is gone.
- The bottom strip has its own reserved space on every board, so it never covers cards. Their Lands area can be hovered again, and your own board no longer hides cards under your hand.
- Right-click a card you own that another player controls (one you gave them) and choose **Take back** to get it straight back. They don't have to give it back; it goes to your battlefield and the log records it. Tokens you gave away can be taken back or returned too.
- New games start with a smaller Creatures / Planeswalkers area and bigger Lands and Artifacts / Enchantments areas. Saved layouts are left alone (☰ → Reset zones to adopt the new default).

## [0.9.1] - 2026-10-16

### Fixed
- Cards flickered on every action in Safari (Mac). The table was being redrawn from scratch each time, and Safari briefly shows re-created card images blank. Only the cards that actually changed are touched now, and card images no longer use lazy loading.

### Added
- ☰ → Connection details now also lists browser information (browser, screen size, view, image-loading and redraw timing) to help diagnose display problems. Copy it and send it along with a description.

## [0.9.0] - 2026-10-16

### Added
- Card backs and play-area backgrounds, take two: 12 painted card backs and 10 painted 16:9 backgrounds, picked under **Your look** on the opening screen. Your choice is saved in your browser and shared with the table.
- If a picture fails to load, the built-in card back and a plain dark board still show.

### Notes
- The artwork was generated with ChatGPT; the images were cropped and resized for the game (WebP). This replaces the code-drawn artwork that was rolled back in 0.8.1.

## [0.8.1] - 2026-10-16

### Removed
- The card-back and play-area-background picker from 0.8.0 is taken out again: the artwork was drawn in code and looked far worse than the preview. It will return when proper full-size artwork is ready. Games look exactly as in 0.7.5.

## [0.8.0] - 2026-10-16

### Added
- Added 15 selectable card backs, spanning red, blue, green, gold, purple, dragon, ocean, celestial, and necromancer themes.
- Added 10 selectable play-area backgrounds, including a dragon's lair, armored knight, nature vista, spellcasting mage, mage duel, necromancer's dominion, floating islands, forest, mountains, and arcane library.
- Appearance choices persist in the browser and are shared with other players so their table views show the selected card backs and backgrounds.
- Replaced the low-resolution atlases with 15 standalone 300×450 SVG card backs and 10 standalone 1920×1080 SVG play-area backgrounds that scale crisply at any display size.
- The chosen card-back design layers over the built-in back, leaving the emblem visible and preserving a fallback if custom artwork fails to load.

## [0.7.5] - 2026-10-15

### Fixed
- Reveal top card now publishes the actual current top card to the owner's Library and focused opponent view until that card leaves the top.
- The turn number now counts full rounds; a separate turn sequence protects against duplicate/late pass messages and keeps Auto-Draw/Auto-Untap running once per individual turn.
- Reaching zero or negative life prompts the player to concede; declining leaves their life unchanged and allows negative totals. Added a shared pre-game d20 roll to choose turn order and a Concede game menu option.
- Display settings use a responsive dialog width and max-height with more compact spacing.
- Focused opponent view includes their hand backs/revealed hand, Library (including a revealed top card), Graveyard, Exile, and Commander, in a bar at the top-right of their board.
- The top bar says "Round N" to match the log.

## [0.7.4] - 2026-10-15

### Fixed
- After an update, a normal refresh could run the new page with old cached game code, still showing the old version for up to 10 minutes (GitHub Pages caching). Every file link now carries the version (`?v=0.7.4`). If the page and code ever disagree, the game reloads itself once.

### Added
- If a new version goes live while the game is open, a notice offers to reload. The game carries on after the reload.
- `tools/bump-version.py X.Y.Z` sets the version in every place it's stored in one step.

## [0.7.3] - 2026-10-15

### Fixed
- In a hand of 7+ cards the second card couldn't be reached directly: the lifted first card covered it. The lifted card now follows the pointer's position across the hand, so every card is reachable in order.
- Hovering Library, Graveyard, Exile or Commander no longer lifts the pile over the AD switch; it just outlines the pile.

### Changed
- The Library, Graveyard, Exile and Commander piles are bigger: about 125px on a 1920-wide screen, up to 140px.

## [0.7.2] - 2026-10-15

### Changed
- Untap All, its auto-untap switch and Pass Turn moved to the top bar.
- The Draw button is gone: click your Library or press D to draw. The auto-draw switch is now a small **AD** switch beside LIB.
- Spacebar passes the turn instead of tapping the hovered card. Press T to tap.
- Copied cards are labelled **TOKEN COPY**.
- New players start in the Sidebar layout.

### Notes
- Prepared as a patch by ChatGPT and adapted on integration: the AD switch can't start a library-card drag, and the shortcut help mentions Space.

## [0.7.1] - 2026-10-14

### Fixed
- Raising Hand size also blew up the Library/Graveyard/Exile/Commander piles and squeezed the hand into a corner. The piles now have their own fixed size.
- The floating hand and piles have a soft dark backing, so zone outlines no longer show through behind them.

## [0.7.0] - 2026-10-14

### Changed
- Battlefield cards are about 40% bigger: the board is laid out about 12 cards across instead of 17. Older boards and saved layouts are converted automatically, and boards from players still on an older version are rescaled.
- Your hand, piles and Draw / Untap all / Pass turn float over the bottom of the battlefield instead of taking their own row, so the battlefield uses the full height. Hand size moved to ☰ → Display settings.
- Your name, life and commander damage sit in a small floating box at the top-right of your battlefield. Arrange zones and Tokens are in the ☰ menu.
- Untouched default zones stretch to fill the battlefield in every layout, and the cards in them keep their size.

### Added
- Sidebar and Focus layouts list every player, with your own board (YOU) first. Hover a board and click the eye to view it big, and click YOU to come back. This replaces the ⤢ / ⤡ buttons.

## [0.6.0] - 2026-10-14

### Added
- Drag any card from your battlefield, hand, graveyard, exile or another zone onto another player's battlefield to give them control of it. It lands where you drop it and still shows its owner.
- Magnifier: hold **V** and every card under a circle around the cursor is shown large, tiled as big as fits, on the other half of the screen. Set the circle size in ☰ → Display settings.
- Floating card preview next to the mouse pointer while hovering a card.

### Changed
- The right-hand preview and log column is gone, so the table uses the full width. The 📜 Log button slides the game log out from the right.
- Counters stack down the top-right corner of a card; power/toughness stays fixed in the bottom-right.
- Pass turn moved next to Draw and Untap all. Auto-draw and auto-untap now start off every game.
- Boards always fit the screen. The card-size slider from 0.5.0 is removed (the magnifier replaces it), so nothing scrolls.
- README rewritten for playing from the website; added this changelog and an MIT licence.

## [0.5.0] - 2026-10-14

### Added
- Card-size slider (80%–150%) in ☰ → Display settings. It only affects your own screen, and above 100% the battlefield scrolls so every card stays reachable.
- Focus view (◎), which gives the active player's battlefield the main area and can follow the turn automatically.
- Wider log sidebar and larger opponent names on very wide monitors (2500px+).

### Notes
- Prepared as a patch by ChatGPT and adapted on integration: the look at 100% is unchanged, and enlarged boards scroll instead of being cut off.

## [0.4.0] - 2026-10-14

### Added
- Online play through a Cloudflare relay (Worker + Durable Object), so games connect on networks that block direct browser-to-browser links. Falls back to direct PeerJS connections automatically.
- Invite links (`?join=CODE`) via the room-code button and ☰ → Copy invite link.
- Clear connection stages in the top bar, and ☰ → Connection details… for troubleshooting.
- Automated network tests (`tests/net-harness.html`, `tests/test_relay_protocol.py`) and design notes (`docs/NETWORKING.md`).

### Fixed
- Two players passing the turn at the same moment could skip a player.
- Actions made while offline were replayed late; they are now dropped after 20 seconds, with a notice.
- Repeated messages could be applied twice.
- A reloading host had to wait to reclaim its room.
- An older copy of the table could overwrite a newer one after a host reload.
- The same game open in two tabs made them kick each other off in a loop.

## [0.3.0] - 2026-10-14

### Added
- First version on GitHub and GitHub Pages.
- Optional LAN mode: `lan-server.py` with a terminal menu, a version shown as `vX (commit)`, and in-app updates from GitHub.
- Support for relay (TURN) servers, a longer connect timeout and clearer connection messages.

## [0.2.0] - 2026-10-13

### Added
- Free-form battlefield with movable zones that opponents see as you arranged them.
- Aura and Equipment attaching.
- Copy a card (marked COPY), counters and power/toughness menus, switch printing, and View information.
- Graveyard tools, the hand fan and hand-size slider, top, sidebar and grid views, commander-damage tags, and manual commander tax.

## [0.1.0] - 2026-10-13

### Added
- First playable build: paste-import decks from Moxfield or Archidekt (via Scryfall), 2–4 player rooms over PeerJS with self-healing reconnects, a searchable zone viewer, commander damage tracking and automatic tokens.

[Unreleased]: https://github.com/ccall1212/commander-table/compare/v0.28.0...HEAD
[0.20.5]: https://github.com/ccall1212/commander-table/compare/v0.20.4...v0.20.5
[0.20.4]: https://github.com/ccall1212/commander-table/compare/v0.20.3...v0.20.4
[0.20.3]: https://github.com/ccall1212/commander-table/compare/v0.19.1...v0.20.3
[0.19.1]: https://github.com/ccall1212/commander-table/compare/v0.19.0...v0.19.1
[0.19.0]: https://github.com/ccall1212/commander-table/compare/v0.18.2...v0.19.0
[0.18.2]: https://github.com/ccall1212/commander-table/compare/v0.18.1...v0.18.2
[0.18.1]: https://github.com/ccall1212/commander-table/compare/v0.17.1...v0.18.1
[0.17.1]: https://github.com/ccall1212/commander-table/compare/v0.17.0...v0.17.1
[0.17.0]: https://github.com/ccall1212/commander-table/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/ccall1212/commander-table/compare/v0.15.1...v0.16.0
[0.15.1]: https://github.com/ccall1212/commander-table/compare/v0.15.0...v0.15.1
[0.15.0]: https://github.com/ccall1212/commander-table/compare/v0.14.2...v0.15.0
[0.14.2]: https://github.com/ccall1212/commander-table/compare/v0.14.1...v0.14.2
[0.14.1]: https://github.com/ccall1212/commander-table/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/ccall1212/commander-table/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/ccall1212/commander-table/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/ccall1212/commander-table/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/ccall1212/commander-table/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/ccall1212/commander-table/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/ccall1212/commander-table/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/ccall1212/commander-table/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/ccall1212/commander-table/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/ccall1212/commander-table/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/ccall1212/commander-table/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/ccall1212/commander-table/compare/v0.7.5...v0.8.0
[0.7.5]: https://github.com/ccall1212/commander-table/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/ccall1212/commander-table/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/ccall1212/commander-table/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/ccall1212/commander-table/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/ccall1212/commander-table/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/ccall1212/commander-table/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ccall1212/commander-table/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ccall1212/commander-table/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ccall1212/commander-table/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ccall1212/commander-table/releases/tag/v0.3.0
