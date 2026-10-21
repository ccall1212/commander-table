# In response! — Objective #40, v0.42.0 test copy

This copy includes Objective #37's opening readiness and #35's personal Undo/checkpoints, plus all published v0.39.0 features. Extract the ZIP and double-click **index.html**; no terminal or installation is needed. For multiplayer tests, keep internet access on and use two browsers/devices running this same copy.

## Click list

1. Host and join, choose colors, keep both hands, then Start. **In response!** becomes available in the top bar after Start while connected and still in the game.
2. Press the guest's **In response!** button. Both screens should show **IN RESPONSE!** with the guest's name, styled like the turn banner. Press again before it disappears: the cue should restart immediately. Try several separate presses of **R**, then stop; the cue should fade away about 1.8 seconds after the last press.
3. Have the host do the same. Test it during another player's turn, while viewing their board, and in Sidebar and Grid at 1920×1080 and 1366×768. The cue should stay centered in each person's window and allow clicks through to the board.
4. Type words containing R into chat, a search box or another text field. No response should fire. Holding R should not repeatedly fire; separate presses should. Ctrl+R/⌘R retain their browser behavior. Hover a card and press **I** to confirm card information still opens. **☰ → Hotkey list…** lists R.
5. Confirm calling a response leaves all cards, turns, life totals, Undo history and the game log alone. Use the cue to ask the group to hold while you respond.
6. Disconnect a guest, then reconnect. Response is unavailable while disconnected, and old cues must not replay when joining/reloading/reconnecting. Start a New Game while a cue is visible: the cue clears and stays unavailable until the new game starts.
7. With the browser's reduced-motion setting enabled, repeat the cue. It should appear without motion and still disappear after the same short pause.

## Assistant checks

- `node tests/test_response.cjs`: host-derived sender identity and current seated/non-conceded/current-deal guards, distinct repeat IDs/element replacement, fade/dedup and stale timer safety, no card/table/player/Undo/log mutation, authenticated sends, offline rejection, Practice, shortcut focus/modifier/held-key guards, and reset behavior pass.
- `node tests/test_response_transport.cjs`: the actual Net session drops response messages while disconnected or when sending fails, never replays them from the queue, and retains normal reliable action queuing/public snapshot coalescing. Uses deterministic fake sockets; this is a Node check, not a real connection test.
- Personal Undo, opening readiness, moderation, targeting, mulligan, player colors, P/T, token picker/printing, chat, backup and deck-health Node suites pass (14 non-browser suites including the two above). Changed JS syntax, all 21 version/cache links and diff checks pass.
- Actual Chromium with two contexts over HTTP :8104 and a real local Miniflare relay :8114 passed host/guest button and R sends, named cues on both screens, repeated presses, held-key rejection, typing/chat/modal and Ctrl+R guards, automatic dismissal, reduced motion, click-through behavior, and disabled guest controls after host disconnection. Sidebar/Grid at 1920×1080 and 1366×768, switching viewed boards, response/Undo/menu button placement and menu bounds passed; no page errors. Gameplay state, shared table, Undo and log comparisons remained unchanged across cues, excluding automatic layout/turn bookkeeping and room-save metadata. The card-info I shortcut is unchanged in source; the browser pass did not make an external card-info lookup.
- Actual Chromium network harness with the unchanged relay Worker running locally in Miniflare: t1–t10 passed; t11 passed after updating its fixture to mark every seat's current opening hand kept before Start. t12 and t13 direct-P2P/fallback checks failed identically on this branch and the published v0.39.0 baseline: PeerJS `wss://0.peerjs.com` proxy tunnel failure, with the intentional fallback-test port 9 also reporting `ERR_UNSAFE_PORT`. Direct PeerJS/fallback could not be verified here. No relay/Worker/protocol code was changed.

Chris has not tested this new copy yet. Assistant browser checks use localhost HTTP; Chris's flow is extract and double-click above. No real-device Safari or subjective audio result is claimed. PR #58 and #59 remain separate unapproved test proposals; paused draft PR #11 stays untouched.
