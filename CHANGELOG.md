# Changelog

All notable changes to Commander Table are listed here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Each release is tagged `vX.Y.Z` in git.

## [Unreleased]

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

[Unreleased]: https://github.com/ccall1212/commander-table/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/ccall1212/commander-table/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ccall1212/commander-table/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ccall1212/commander-table/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ccall1212/commander-table/releases/tag/v0.3.0
