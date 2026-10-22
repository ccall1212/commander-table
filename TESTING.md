# Host opening-rule dialog — Objective #39, v0.44.0

This copy also includes Objective #41's compact readiness roster (PR #61). Extract the ZIP and double-click **index.html**; no terminal or installation is needed. Multiplayer checks use two browsers/devices with internet access and this same copy.

## Click list

1. Pick your saved deck and name. The main start area has **Host a game** without the old mulligan selector. Click Host to open the three-rule dialog. It explains that the rule can be changed after joining.
2. Choose a different rule, then Cancel or press Esc. You stay on the start screen; no room is created and your saved choice stays unchanged. Reopen: your last confirmed choice is selected.
3. Choose London, At least 3 lands, or Draw 10, bottom 3 and Continue. The existing color picker follows. After choosing a color, verify the opening rule and hand match your selection. Both alternate rules still allow one mulligan, with host-granted extras; London keeps its existing limits.
4. Join from the second browser. Joining skips the host rule dialog. Before Start, the host can click the opening-rule control and confirm a redeal with a different rule; both players receive the new deal.
5. Verify **Hands ready: 0/2** opens a live **Ready / Choosing** roster. Keep one hand while the other browser's roster is open: it updates to **1/2**. Draw 10 requires choosing bottom cards before counting as Ready. Keep both hands and Start: the rule and readiness controls disappear, and an open roster closes.
6. Check Sidebar and Grid at 1920×1080 and 1366×768. Start controls should fit without overlapping. New Game restores **0/2**. Practice solo still skips the host setup dialog.

## Verification

- Assistant syntax, version/cache, diff, mulligan, readiness, player-color and collection backup checks pass.
- Actual Chromium over localhost HTTP and the unchanged Worker in local Miniflare passes: Cancel/Esc, saved choice, single prompt under repeated clicks, bounds at both sizes, all three rule deals, existing color selection and solo flow. A two-player check changes the rule in-game and confirms both players receive the new 10-card deal and remain unkept. No page errors; settled prompt screenshot visually reviewed.
- The full #41 two-player browser regression also passes on this combined copy: Sidebar/Grid at 1920×1080 and 1366×768, compact wording, live roster, keyboard/focus, no toolbar overlap, Draw 10 bottoming, pre-start blocking, reload, Start hiding controls/closing roster, and New Game reset. Start is clicked in the smaller Grid view. No page errors.

Assistant multiplayer checks use HTTP. An additional local-file browser attempt was blocked by the managed browser policy (`net::ERR_BLOCKED_BY_ADMINISTRATOR`), so the assistant did not verify double-click/file loading. Chris has not tested these two UI changes yet; publication awaits his approval. No real-device Safari result is claimed. Paused draft PR #11 remains untouched.
