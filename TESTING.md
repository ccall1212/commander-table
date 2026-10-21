# Opening readiness — Objective #37, v0.40.0 test copy

Extract the ZIP and double-click **index.html**. For the shared-game checks, keep internet access on and use two separate browsers or devices. Try both Sidebar and Grid at 1920×1080 and 1366×768.

## Click list

1. Host a room using each opening-hand rule in turn: London, At least 3 lands, and Draw 10, bottom 3. Join with a second player.
2. Before either player keeps, confirm **Start game** is disabled and the lobby names both players as still choosing. Try the host's hand/card menu and the **B** hotkey to play a card; it should stay out of the battlefield and explain that the host must start the game.
3. Keep the host's hand. Confirm the guest remains listed and Start stays disabled. Have the guest mulligan; it should remain listed. For Draw 10, bottom three cards; the guest should remain listed until all three selections are finished.
4. Have the guest keep. Confirm both names clear and Start becomes available. Undo the guest's Keep and confirm the host sees the guest pending again. A completed keep from an older deal must not satisfy readiness after a host redeal or new game.
5. Confirm the host cannot start while anyone is pending and can start after everyone currently seated and not out has kept. After start, the host should roll turn order and normal hand-to-battlefield moves should work.
6. While one player is pending, have the other player try dragging a card, using a battlefield menu action, making a token, making a copy, and receiving a control/return request to the battlefield. None should place a card on the battlefield.
7. Repeat the readiness display and Start checks in Sidebar and Grid at both screen sizes. Confirm the public lobby reveals only player names and keep status, never hidden card identities.

## Assistant checks

- `node tests/test_opening_readiness.cjs`: host readiness rejects unkept and stale-deal status; public status carries only the deal ID and keep flag beside the existing hand count; low-level moves, direct insertion and token/copy creation are blocked before start.
- Actual Chromium over localhost HTTP with two separate browser contexts and the configured relay: Start began disabled with both names listed; after only the host kept, the guest remained listed and Start stayed disabled; after the guest kept, the names cleared and Start enabled. Host and guest were at 1920×1080 and 1366×768, respectively; no page errors occurred. The relay connection used the configured service, not a local network stub.
- Existing mulligan tests cover London, three-lands and Draw 10/bottom-three rules. The broader click list remains for Chris: pre-start drag/menu/hotkey and incoming requests, undo/redeal/reconnect behavior, and Sidebar/Grid at both sizes were not part of the assistant-run browser pass.

---

# Collection backup and restore — PR #49, v0.39.0 test copy

Extract the ZIP and double-click **index.html**. Keep internet access on for card images and online play. No terminal or installation is needed.

## Chris's testing and approval

Tested by Chris: he has just tested the previously shared Deck Builder checks and collection backup ZIPs. He directed that both be refreshed onto the published releases, then pushed and merged. The #30 ZIP he tested was the earlier branch head `9a60d15`; it did not contain the refreshed #29 integration or the preference additions below. He explicitly approved refreshing and publishing both features; his original-ZIP testing and the assistant’s refreshed-integration checks are recorded separately here.

## Click list

1. In one browser, save two decks and change a card printing. Select a card back/background, enter a saved name, set a host opening-hand rule, and in a game pop chat out, enable Transparent, move it and resize it.
2. On the opening screen choose **Back up / restore… → Download backup**. Keep the downloaded JSON file.
3. In a separate browser with an existing deck and different saved preferences, select the backup. Review the preview; leave the preference checkbox off and restore. The imported deck and printing should appear, the existing deck should stay, and the destination's preferences should remain unchanged.
4. Select the same backup again, check **Also restore saved preferences and appearance**, and restore. Verify the name, appearance, display settings, host opening-hand choice, and floating chat position, transparency/fade behavior, width and height match the source browser.
5. Change a restored deck and select the original backup again. Preview should offer a “(restored)” copy while keeping both the original local deck and other decks. Exact matches should be skipped.
6. Select a plain `.txt` decklist or invalid JSON; an error should appear and Restore should stay disabled. Close a valid preview without restoring and confirm nothing changed.
7. At 1920×1080 and 1366×768, start a normal host game after restoring preferences. The usual player-color chooser should still appear. Choose a color, open chat and check that its saved size fits; resize the viewport and confirm the panel stays on-screen.

Active games, room and seat assignments, seat keys, recovery records, and network identities are excluded. Preference restore is optional. Existing decks are never replaced: matching decks are skipped and changed versions are added as copies. Collection backups must be version 1 and no larger than 20 MB.

## Assistant checks

- `node tests/test_backup.cjs`: 12 checks passed, including round-trip and invalid-value coverage for chat-panel position, transparency/fade mode and size, plus the host opening-hand selection. The key whitelist excludes session, recovery and identity data.
- `node tests/test_chat_panel.cjs`: chat-panel normalization and viewport geometry checks passed.
- `node tests/test_deck_health.cjs`: 9 checks passed for the published Deck Builder review notes.
- Actual Chromium Deck Builder regression passed at 1920×1080 and 1366×768: partner-color union, off-color warning, commander-inclusive total, duplicate grouping and printed exceptions, dismiss/edit/reopen updates; no page errors.
- Actual Chromium over HTTP on port 8109 downloaded a backup in one browser context and restored it in another at 1366×768, with preferences off and on. It confirmed that destination preferences and the existing deck remain intact when preferences are off, then restored the source preferences, chat-panel settings and opening-hand rule when selected. After restore, the normal host color chooser appeared; chat rendered at its saved dimensions at 1366×768 and 1920×1080. The network start was stubbed for this entry-flow check; no multiplayer session was tested. No page errors were observed.
- The app's published v0.37.0 recovery, chat, arrows, mulligan and color behavior and v0.38.0 Deck Builder checks were retained during integration. This refresh did not re-run the recovery Worker or multiplayer flows.

The managed browser blocks `file://` navigation; assistant browser checks used localhost HTTP. Chris reported testing the original ZIP through his browser; the refreshed integration checks above used HTTP. No real-device Safari result is claimed.

Primary verification: the existing moderation, mulligan, player-color, power/toughness, targeting and token picker/printing Node suites also passed after integration.

## Publication verification — 2026-10-21

Chris explicitly approved refreshing and publishing both features after testing their earlier ZIPs. Objective #29 merged through PR #50 as v0.38.0 at `e0e4afd03c62803e31e0ad0f4aacbd7dd82a3f8f`; Objective #30 merged through PR #49 as v0.39.0 at `225e1d08f894ae10eecf0b7ec8346af6b26fed43`. The automatic annotated release tags were fetched and their targets verified against those exact merge commits. GitHub Pages deployment and Workers Builds succeeded for both releases. The v0.39.0 release includes both features.

Live-page navigation was blocked here with `net::ERR_TUNNEL_CONNECTION_FAILED`, so deployment success is verified but the live footer was not observed. The merged feature branches and worktrees were removed after confirming they contained no unpublished commits. Paused draft PR #11 remains untouched. These publication checks do not imply that Chris tested the refreshed ZIPs.
