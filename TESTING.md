# Temporary effects until end of turn — v0.64.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

Best with two players (your window plus a private window). Start a game and put at least four creatures on your battlefield.

1. **+1/+1 on a group.** Drag a box around three cards to select them. Right-click one of them → **Temporary (until end of turn)** → **+1/+1 until end of turn · 3 selected**. All three should show +1/+1 in a **light-blue outlined** badge. A fourth, unselected card should not change.
2. **Not permanent.** The Power / Toughness menu and counters should not have changed (this is a separate temporary layer).
3. **A temporary ability.** With the three still selected, right-click one → Temporary → **Statuses & abilities until end of turn…**, tick **Vigilance** (or any ability or status). All three cards should show the icon with a **dashed light-blue outline and a small clock**. The window says these wear off when the turn passes.
4. **The other player.** In the other window, your cards should show the same temporary +1/+1 and markers.
5. **Hover.** Hover one of the cards: the big preview should show the markers beside it, with the temporary ones marked.
6. **End of turn.** Pass the turn (**Pass turn**, or the host passes for someone). All the temporary +1/+1 and temporary markers should vanish on both screens. Anything you added as permanent (for example a normal Flying marker or a permanent power change) should stay.
7. **Undo.** Ctrl+Z after a group Temporary action should undo it for the whole group in one step.
8. **Clear early.** Right-click → Temporary → **Clear temporary effects** removes them right away. Moving a card to the graveyard also clears its temporary effects.
9. The normal **Statuses & abilities…** window should now also work on a whole selection (it says how many cards).

## Assistant verification

- **Unit tests (Node):** all 23 automatic test files pass.
- **Real browsers (Chromium, two players):** new `test_temporary_effects_browser` covers +1/+1 and Vigilance on a selected group through the menus, that a permanent marker is untouched, what the other player sees, one Undo, and that everything temporary disappears when the turn is passed while the permanent marker stays. I looked at a screenshot.
- **Not tested:** hand-held end-of-turn behaviour with three or more players, and real touch.
