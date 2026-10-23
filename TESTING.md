# W and name-targeted arrows — v0.54.0 (Objective #54)

Download the PR's exact-commit ZIP, extract it, and double-click `index.html`. No terminal or server is needed. This is a preview copy awaiting Chris's test and publication approval.

1. Enter Practice or host/join a room and play a card onto the battlefield. Hover it and press **W**. Drag from the card to another player's name (or their empty board space) and release. A dashed preview should follow your pointer; the finished arrow should end at their name. The source card should keep its position and tapped state.
2. Move away from cards and press **W**. Drag between battlefield cards or players. Try clicking the source and then the target instead: the existing click-to-pick flow should still work. Player arrows should end at names, including when empty board space was chosen.
3. Try **Escape** before moving the pointer and during a drag, and release over an invalid target. No arrow or leftover preview should remain, and releasing should not tap a card or activate the control underneath. After completing an arrow, a new intentional click should work immediately.
4. Open **☰ → Hotkeys**. Set targeting to another key, reload and check it is remembered. Clear it and check W no longer starts targeting; reset it to restore W. If your browser already used W for another action before this change, that shortcut should remain intact and targeting should be unassigned until you choose a key.
5. With a second player connected, draw arrows in both directions. The other player should see the completed arrow, not the moving dashed preview. Check Sidebar and Grid at roughly 1920 × 1080 and 1366 × 768, focus another player's board and resize the window. Arrows should follow visible names, including your own name when viewing someone else's board. Life points should stay in their existing position.
6. Click an arrow to remove it, or focus it with Tab and press Enter/Space. Try **Clear all** in the floating controls near the bottom. Check ordinary card dragging, tapping and hand-card actions still work outside targeting mode.

## Assistant verification

- Node syntax checks and `git diff --check` passed. A Luna subagent reviewed the code; findings about existing custom W bindings and release-click cancellation were addressed.
- Hotkey checks covered the new default, legacy custom W preservation, an explicitly cleared/custom targeting key and reset behavior. Actual Chromium Hotkeys menu checks covered Set/Clear/Reset and persistence after reload; a hovered hand card was not accepted as an endpoint, and normal card repositioning still worked.
- Two separate Chromium player sessions connected through the real relay using known deck fixtures. Sidebar at 1920 × 1080 and Grid at 1366 × 768 passed in both directions: W from a hovered card, local dashed drag preview, shared completed arrows ending at names on both screens, unchanged source position/tapped state, immediate intentional clicks, click-to-pick, focused boards, resize and Escape cancellation. No browser page errors were observed.
- Practice browser checks passed for dragging without a preselected source, card-to-card arrows, keyboard removal, invalid drops, a pointer-cancellation boundary event, Escape before the drag threshold and the text-input shortcut guard. The pointer-cancellation check used a dispatched browser event; it is not a real-device touch test.
- This environment's Chromium blocks `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, so assistant browser checks used local HTTP. Chris's extract-and-double-click launch and real-device touch checks remain unverified.

This change covers targeting visuals and controls. Life-point relocation remains undecided. Blocker relationships are separate Objective #59; next requested work after #54 is #61, selected-card counters and recent-counter reuse.
