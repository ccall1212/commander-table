# Quick Grab basic lands — v0.53.0 test copy (Objective #53)

Download the PR's exact-commit ZIP, extract it, and double-click `index.html`. No terminal or server is needed. This is a test branch awaiting Chris's review; the live game remains v0.52.1.

1. Select a deck containing basic lands and enter Practice or host/join a room. Before Start game, right-click your Library: **Quick grab basic land** should be directly below **Search library…**, disabled with an **after Start game** hint.
2. Keep your opening hand and start the game. Right-click your Library → **Quick grab basic land**. It should list the basic lands still in your Library with counts, such as Forest (6) or Island (4). Drawn/played lands should not be counted. Different printings of Forest should share one Forest entry; snow-covered basics and Wastes should appear when present. Nonbasic lands should not appear.
3. Choose a basic land → **To battlefield & shuffle**. Exactly one existing card should move from your Library onto your battlefield untapped, and the remaining Library should shuffle. Reopen the menu: that land's count should decrease by one.
4. Press **Ctrl+Z / ⌘Z** once. The land should return to the Library and the shuffle should be undone as the same action. Repeat with **To battlefield tapped & shuffle** and check the land arrives tapped.
5. If no basic lands remain, the submenu should say **No basic lands remaining**. Grabbing the final card in the Library should work, leaving an empty Library rather than creating an extra card.
6. In a real room with a second player watching, check both players can grab from their own Library. The other player should see the played land, its tapped state and the updated Library count; your private remaining basic-land choices/counts must not appear in their menu. Repeat in Sidebar and Grid at roughly 1920 × 1080 and 1366 × 768.
7. If using a phone/tablet, open the Library menu through the existing Touch mode long-press control and tap each submenu level. The nested menu supports clicks/taps as well as hover; real-device behavior needs your check.

## Assistant verification

- Node syntax and `git diff --check` passed; a Luna subagent reviewed the implementation with no actionable findings.
- Chromium Practice at 1920 × 1080 and 1366 × 768: correct remaining counts and grouping across printings; nonbasic exclusion; tapped/untapped placement; shuffle; reveal-top clearing; one Undo restoring the exact original Library order. Snow-covered basics, Wastes, the last remaining land, no-basics/empty Library, and a stale-menu action after the selected land left the Library passed. The Practice tests used a known deck fixture.
- Two real browser players connected through the live relay, with host and guest each grabbing from their own Library: Sidebar at 1920 × 1080 and Grid at 1366 × 768 passed. The observer saw the played card and correct tapped state; its own Library was unchanged. Public snapshots contained no private Library/hand arrays, and focusing/right-clicking the opponent’s Library did not expose Quick Grab choices. These room tests used known deck fixtures, not simulated opponent snapshots.
- The environment's Chromium blocks `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; Chris's extract-and-double-click check remains. Real-device touch behavior and subjective sound have not been checked.

The counted submenu is the chosen first version; a separate random-basic command is not included. Chris confirmed shuffle afterward. Requested work order after this feature: Objective #54, then #61; each remains a separate change.
