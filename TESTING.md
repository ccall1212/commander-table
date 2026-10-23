# Immediate arrow preview — v0.54.1 (Objective #54 follow-up)

Download the PR's exact-commit ZIP, extract it, and double-click `index.html`. No terminal or server is needed. This preview awaits Chris's test and publication approval.

1. Enter Practice or host/join a game and play a card onto the battlefield. Hover the card and press **W**. Move the pointer away from the card without clicking it or holding a mouse button. The dashed arrow should immediately follow your pointer.
2. Move to another battlefield card, a player's name or their empty board space, and click once to place the arrow. A player-targeted arrow should end at the player's name. The source card should keep its position and tapped state.
3. Right-click a battlefield card or player name → **Send arrow to…**. Move straight to a target and click once. The preview should follow immediately; there should be no extra source selection or drag step.
4. Press W away from cards. Choose a source once, then move and click a target. The preview should begin following as soon as the source is chosen. Existing held-drag controls should also keep working.
5. Try Escape and right-click while the preview follows your pointer; switching away from the game window should also cancel it. No arrow should be sent and no draft should remain.
6. With a second player connected, repeat in both directions, using Sidebar at roughly 1920 × 1080 and Grid at 1366 × 768. The other player should see only the finished arrow, ending at the target's name.

## Assistant verification

- Node syntax and git diff checks passed. A Luna subagent reviewed the change with no actionable findings.
- Actual Chromium sessions connected through the real relay using known deck fixtures. Both players tested W and card-menu initiation in Sidebar at 1920 × 1080 and Grid at 1366 × 768. Pointer movement used no held button or extra source click; the draft followed the pointer, and one target click shared the completed arrow. Name endpoints were checked on both screens; source-card position and tapped state remained unchanged. No page errors were observed.
- Generic W with one source pick, Escape/right-click cancellation, window-blur cancellation and held-drag compatibility passed in both layouts. The blur boundary was exercised with a dispatched browser event, not a real operating-system window switch.
- This environment's Chromium blocks file:// navigation with ERR_BLOCKED_BY_ADMINISTRATOR. Assistant browser checks used local HTTP; Chris's extract-and-double-click launch and real-device touch behavior remain unverified.

Objective #61 is checkpointed separately on feat/selected-card-counters. Its counter changes are not in this ZIP.
