# Selected-card counters and recent reuse — v0.55.0 (Objective #61)

Download the PR's exact-commit ZIP, extract it, and double-click `index.html`. No terminal or server is needed. Published through PR #82 after Chris reported “Perfect” and approved publication. Includes the v0.54.1 arrow correction.

1. Enter Practice or host/join a room. Play at least four cards onto your battlefield and space them apart. Drag a selection box around three cards, then right-click one of those three. The menu should show **Counters · 3 selected** and keep their selection outlines.
2. Choose **Add +1/+1 counter**. Each selected card should gain one; the fourth card should not change. Press **Ctrl+Z / ⌘Z** once: the addition should undo for all three together. Try −1/−1 as well; opposing counters should cancel on each card separately.
3. Select three again → Counters → **Add a counter…**. Enter **Trample**, then quantity **2**. The prompt should clearly say the amount applies to each card. All three should gain two Trample counters, not share two between them. Cancel either prompt and check nothing changes.
4. Right-click the fourth card → Counters → **Most recent: Trample**. It should gain one without typing. The selected group should stay selected and unchanged. Try Most recent on the group too: each selected card should gain one. Undo should leave the recent counter type available, and reloading/resuming should remember it in this browser.
5. In a selected-group counter menu, choose **Manage this card only**. Its original increment/double/decrement/reset and existing-counter controls should affect only the right-clicked card. Left/right clicks on a counter badge and hover shortcuts (+, −, J, Shift+1/2/3) also remain single-card. Ordinary card tap/drag actions should work as before.
6. With a second player watching, repeat group additions and Undo in both directions. Check Sidebar at roughly 1920 × 1080 and Grid at 1366 × 768. The observer should see the new counters; their own cards must not change. Opponent-card menus should not offer these counter additions.
7. Hover a card and press W, or right-click → Send arrow to…: the published pointer-following interaction should still be present. It is included in this copy.

## Assistant verification

- Node syntax, focused counter-boundary checks and git diff checks passed. A Luna subagent reviewed the group/recent-counter implementation with no actionable findings.
- Two actual Chromium players connected through the real relay using known deck fixtures. Both directions passed in Sidebar at 1920 × 1080 and Grid at 1366 × 768: real rectangle selection, preserved group on right-click, +1/+1 additions, custom Trample quantity per card, outside-group recent reuse, one Undo for the group, observer updates, cancelled quantity prompt and opposing-counter cancellation. Recent type persistence passed a real reload/resume. No page errors were observed.
- Practice Chromium checks passed for group recent reuse, Manage this card only, single-card badge clicks and + hotkey, negative custom quantity per card and one-step Undo. No page errors were observed.
- Focused code checks used controlled fixtures to cover a foreign-owned card on your own battlefield, duplicate/missing/moved card IDs, board replacement and transfer-lock guards, invalid names/quantities, counter annihilation, Loyalty at zero and browser-local recent-type storage. These are code checks, not real ownership-transfer browser tests.
- Assistant browser checks used local HTTP because this environment's Chromium blocks file:// with ERR_BLOCKED_BY_ADMINISTRATOR. Chris's extract-and-double-click launch and real-device touch remain unverified.

This feature adds real counters. Status toggles/icons (#56), counter copying/dragging and cross-player counter transfers are separate or excluded from this objective.

Tested by Chris: reported “Perfect” for the supplied copy and approved publication. Specific device and interaction coverage was not supplied.
