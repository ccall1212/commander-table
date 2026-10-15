# Changelog

All notable changes to Commander Table are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each release is tagged `vX.Y.Z` in git.

## [Unreleased]

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

[Unreleased]: https://github.com/ccall1212/commander-table/compare/v0.7.5...HEAD
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
