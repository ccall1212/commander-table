# In response! — Objective #40, v0.42.0

Includes published v0.41.0 personal Undo/checkpoints and v0.40.0 opening readiness, with the final hidden opening-rule label during play. Extract the ZIP and double-click **index.html**; no terminal or installation is needed. For multiplayer checks, use two browsers/devices running the same version with internet access.

## Chris's testing and approval

Tested by Chris: he likes #37, reports Undo works as it should, and says In response looks amazing and has been tested. He explicitly approved publication after hiding the opening-rule label during play and matching the response cue to the responding player color. His testing of the earlier ZIP is separate from the assistant's final label/color checks below. The pre-game wording redesign is a separate suggestions follow-up.

## Click list

1. Host and join; choose different colors, such as blue and red. Keep both hands and Start. The London/3 Lands/10 → 7 label disappears after Start on both screens. A New Game restores the pre-game rule control.
2. Press **In response!** or **R**. Both screens show the pressing player's name, with text and glow matching that player's color. Repeated separate presses restart the cue, which fades about 1.8 seconds after the latest press.
3. Click an opponent's tile to enlarge it. Try both the button and R while that view remains open. The cue still uses your own name/color, and leaves the opponent view open. Repeat in Sidebar/Grid at 1920×1080 and 1366×768.
4. Type R in chat/search/text fields, hold R, and try R with a dialog open: these must not fire repeated cues. I still opens card information; Ctrl+R/⌘R retain browser behavior.
5. Calling a response must leave cards, turns, life, Undo history and the game log alone. The cue is click-through. With reduced motion enabled it appears without motion and still disappears normally.
6. Disconnect/reconnect or reload: the cue is unavailable while disconnected, and old cues are not replayed. New Game clears any current cue and requires both players to keep again.

## Assistant checks

- All 14 non-browser Node suites pass on the final combined integration: response, response transport, personal Undo, opening readiness, moderation, targeting, mulligan, player colors, P/T, token picker/printing, chat, backup and deck health. Response tests cover all six player colors and host/guest identity, authorization, current deal, repeat/fade/reset, no card/table/Undo/log mutation and offline queue behavior.
- Actual two-context Chromium over HTTP :8104 with the unchanged Worker in local Miniflare :8114 passes the full response regression after rebasing onto the published dependencies. Both screens show the rule before Keep and hide it after Start. Guest red/host blue text and gradient are checked on sender and receiver, including a red guest pressing button/R while focused on the blue host board. Both layouts/sizes, repeats, input/dialog guards, click-through, dismissal, reduced motion, controls/menu bounds, unchanged gameplay state, and disconnected guest behavior pass; no page errors. Browser comparisons exclude automatic layout/turn bookkeeping and room-save metadata. Card-info I is unchanged in source; no external lookup or real-device Safari result is claimed.
- The v0.40.0 label pass also checked that New Game restores the rule label on both screens. The rebased v0.41.0 Undo browser regression passed with two contexts and its own actual local relay, including history/checkpoint isolation, transfers and incoming effects.
- Prior network harness: t1–t10 passed; t11 passed after its fixture was updated to meet opening readiness. Direct-P2P/fallback checks t12/t13 failed identically on the proposal and the published v0.39.0 baseline because PeerJS proxy tunnels failed and the intentional fallback-test port reported ERR_UNSAFE_PORT. Those unavailable direct paths were not rerun for the final color-only change. No relay/Worker/protocol code changed.
- Changed JS/test syntax, all 21 cache/version links and diff checks pass. The downloadable archive is verified against the exact publication head.

Assistant browser checks use localhost HTTP; Chris's flow is extract/double-click above. Publication is authorized. Paused draft PR #11 remains untouched.
