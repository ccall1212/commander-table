# Unique player colors — v0.36.0 test copy

Download the ZIP, extract it, and double-click **index.html**. Keep internet access on. No terminal or local server needed. Use two players on this copy.

## Click list

1. Press **Host a game**. Before entering the table, choose **Red — Available · default** in the color picker. The host's player marker and name should turn red.
2. Join from a second browser/tab. Before entering the table, check that red says **Taken by [host name]** and is disabled. Choose another available color; verify each screen shows the same colors.
3. Have both players try to claim the same available color from separate screens in quick succession. Only one should receive it; the rejected player sees a message and can choose another.
4. Verify that Escape, clicking the backdrop, or the modal's close control cannot dismiss the required picker before selection. Its explicit **Cancel and return to lobby** action must safely leave a join that has not received room details.
5. On each browser, test at 1920×1080 and 1366×768 in Sidebar and Grid. Check the markers/name colors in both layouts.
6. Reload each browser and reconnect. The choices should remain. Start a new game; the colors should still remain. Remove a player from the table and verify that player's color becomes available to the remaining players.
7. Verify the shipped v0.35.0 opening-hand options and mulligan behavior remain present after this update.

## Verification

- Assistant-run Playwright Chromium checks used a host and three guests over localhost HTTP on port 8109. Host and join pickers appeared before board entry; red showed as taken and disabled for a guest; simultaneous claims gave blue to exactly one guest, and the loser saw blue stay disabled and could choose teal. Escape/backdrop clicks and the hidden close control could not dismiss the required picker; an unresolved room could be safely canceled back to the lobby with its pending session cleared. A forged higher-revision guest snapshot could not replace the host's confirmed color or opening-hand authority. Guest reload preserved its choice; new game did not reopen the picker; no later color-change menu appeared. Sidebar and Grid at 1920×1080 and 1366×768 passed with no page errors.
- Node color regressions cover deterministic legacy defaults, invalid and duplicate saved assignments, unassigned new seats, available/taken claims, simultaneous claim rejection, invalid palette values, non-seated claims, locked colors and JSON persistence. All `tests/test_*.cjs` suites, changed JavaScript syntax checks and `git diff --check` passed.
- Chris requested the feature; hands-on review and publication approval are pending. Managed Chromium blocks file:// navigation, so the assistant browser checks used HTTP. Real-device Safari/touch and extracted-copy flow still require appropriate checks.

Includes published v0.35.0 opening-hand rules and relay backup capability, plus the published v0.33.1 chat and arrow fix. PR #11 remains paused. Hands-on review and publication approval for v0.36.0 are pending.

Tested by Chris: “Mulligan looks great”; he approved push, merge and publication on 2026-10-21. Integrating the approved server PR changed only release/testing documentation alongside the server files; the tested browser source is unchanged.

Publication verification: v0.35.0 was merged after Chris’s approval; its automatic annotated tag points to the exact release merge. Production Workers Builds and Pages deployment succeeded. The server capability was confirmed through real Chromium health and a complete fresh-incognito recovery test using PR #55’s separate client copy.
