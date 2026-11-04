# Hotkeys on a whole selection — v0.63.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

Best with two players (your window plus a private window). Start a game and put at least five cards on your battlefield (hover a hand card and press **B**).

1. **Tap a group.** Drag a box around four cards to select them. Hover one of the selected cards and press **T**: all four should tap. Press **T** again: all four untap.
2. **One Undo.** Tap them again, then press **Ctrl+Z** once: all four untap together.
3. **A card outside the selection.** Hover the fifth, unselected card and press **T**: only that card taps.
4. **Other keys.** With the four selected, try **Z** (face down and up), **G** (all go to the graveyard; one **Ctrl+Z** brings them all back), and the counter and power/toughness hotkeys.
5. **Arrows from a group.** Select several cards, hover one and press **W**, then click another player's small board (or a card or name). One arrow should leave **every** selected card and arrive at that target, and the other player should see them all. With no selection, **W** still draws a single arrow.
6. **Right-click.** Right-click one of the selected cards: **Tap** and **Send arrows from N cards to…** should name the number of selected cards. Right-click a card outside the selection and it behaves as before.
7. Please say if any key should act on only one card even when a selection exists.

## Assistant verification

- **Unit tests (Node):** all 23 automatic test files pass.
- **Real browsers (Chromium, two players):** new `test_group_hotkeys_browser` covers T, Z, G and W on a group, one Undo, a card outside the selection and an empty selection; it fails on the old code. Attach (A) still works on one card at a time.
