# Opening Auto-Draw timing — v0.55.1 (Objective #67)

Download the PR’s exact-commit ZIP, extract it and double-click `index.html`. No terminal or server is needed. Published through PR #83 after Chris approved publication with “Push”. No specific hands-on test results were supplied.

1. Host a game with **three or more players**. Enable Auto-Draw for each player, keep opening hands and start the game.
2. While the opening dice and results are visible, everyone’s hand should stay at seven. When the results fully close, the starting player should automatically draw exactly one card. Other players should not draw yet.
3. Pass the turn. The next player’s Auto-Draw should run normally, once, without an added dice delay.
4. Repeat with reduced motion enabled and in Sidebar/Grid. Check a guest winning the roll as well as the host.
5. In a **two-player** game, the first player should still skip the first draw. The second player should draw on their first turn, and the starting player should draw on their next turn.
6. With Auto-Draw off, no opening automatic draw should occur.

## Verification

- Node syntax and focused timer checks passed: one pending retry, no duplicate draws, current-turn revalidation, game-reset cancellation, Auto-Draw off and the two-player first-turn skip.
- Actual Chromium sessions connected through the real relay using known deck fixtures: three-player Sidebar at 1920 × 1080 with normal motion, Grid at 1366 × 768 with reduced motion, and Grid with normal motion passed. Both host-first and guest-first opening draws were exercised. Hand-count monitoring recorded draws only after the dice/results overlay disappeared; each starting player drew exactly once. Later-turn draws and repeated public updates passed without extra draws.
- A real two-player room passed the opening skip and subsequent automatic draws. No browser page errors were observed in the room tests.
- A Luna subagent reviewed the timer change with no actionable findings.
- Assistant browser checks used local HTTP. This environment previously blocked file:// navigation; Chris’s extract-and-double-click launch and real-device touch remain unverified for this copy.
