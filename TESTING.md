# Symbolic power/toughness — v0.28.2 test copy

Download the ZIP, extract it, then double-click **index.html**. No Python, terminal, installation or local server is needed. Keep internet access on for card images and online play.

This is a separate test copy for the power/toughness fix, based on the published game. The targeting-arrow candidate remains in its own ZIP/PR.

## Quick check

1. Start Practice solo with a creature whose printed power/toughness is `*/5` (or `*/` another number), one with `*/*`, and an ordinary numeric creature. You can use your existing deck or the deck builder.
2. Put them on the battlefield. Expect `0/5` for `*/5`, `0/0` for `*/*`, and the usual stats for the numeric creature. Each should have the same power and toughness adjustment buttons.
3. Click power to raise only power; right-click it to lower only power. Repeat for toughness. From `0/5`, try `1/5`, `-1/5` and `-1/4`. The card must not tap or move when using the buttons.
4. Try the card menu's Power/Toughness actions and Alt+1/Alt+3 for power, Alt+2/Alt+4 for toughness. Add real +1/+1 and -1/-1 counters; they should affect both stats on top of manual changes. Undo should restore the preceding values.
5. Use **Set power/toughness…** for a numeric base, then **Reset power/toughness**. Reset should restore zero for symbolic sides and the printed number for numeric sides; real counters remain. The printed `*` value should still be visible in the badge tooltip/card information.
6. Check Sidebar and Grid, including a smaller window. A creature face down should retain the usual face-down behavior without revealing its printed stats. Hand cards and non-creatures without P/T should not gain battlefield P/T buttons.
7. If testing online, have both players use this updated ZIP. Change the symbolic creature's stats and confirm the other player sees the same values. Try giving control of it to the other player and adjusting it there.

## Checks already run

- JavaScript syntax checks and the regression test in `tests/test_power_toughness.cjs`.
- The regression checks exercise actual app helpers and generated card HTML: symbolic/numeric baselines, both buttons, independent +/- changes, counters, overrides/reset, public-state serialization, undo snapshots and hidden/non-creature exclusions.
- A Luna sub-agent independently reviews the change. Browser click/visual checks remain for this revised copy; Chris's reported bug is recorded, not a test pass for the fix.

Do not publish this candidate until Chris approves it.
