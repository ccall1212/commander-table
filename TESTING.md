# Floating and transparent chat — v0.33.0 test copy

Download the ZIP, extract it, and double-click **index.html**. No terminal or local server is needed. Keep internet access on. Use two players with the same test copy; chat is disabled in Practice solo.

Chris requested this feature but has not yet tested or approved publishing it. The published token release is included; the separate Deck Builder checks and backup/restore proposals are not included.

## Click list

1. Host a shared game and join from a second player. Open **💬 Chat**, send messages in both directions, and confirm the normal panel still works. Close one player's chat, send them a message, and check the unread indicator; opening chat should clear it.
2. Choose **Pop out**. Drag the **Room chat** heading to another part of the table. Chat should stay open, and dragging it should not tap, move or select cards. Buttons and the message input should remain usable.
3. Choose **Transparent**. Panel, heading, message area and composer backgrounds should be completely clear while messages, input and controls remain visible. Click empty space in the transparent chat to interact with the table underneath; scroll over message text to scroll the history.
4. Move transparent chat too. Send another message from the other player: it should appear without moving or closing the panel. Each player's mode and position should stay independent.
5. Close/reopen chat, then reload your game and reopen chat: mode and position should be remembered. Choose **Dock** to restore the solid normal panel; **Pop out** restores floating mode. **Reset** returns it to the default position.
6. Try Sidebar and Grid around 1920×1080 and 1366×768, then shrink/resize the window. The heading, Close, and composer must stay reachable. Check the panel after opening/closing the on-screen keyboard on a real touch device if available.
7. Tab to the floating heading and move it with arrow keys; Shift moves farther. Escape should close chat and focus the top-bar Chat button. If another dialog is open, Escape should close that dialog first.
8. While choosing a targeting arrow, try opening chat, moving it and typing: chat controls should work without selecting arrow endpoints. Close chat and continue/cancel picking normally.

## Assistant verification

- Geometry/preferences Node checks cover malformed saved values, extreme coordinates, wide/narrow/short viewports, visible viewport offsets and recovering the saved position after a temporary resize.
- Existing targeting, P/T, token picker and token-printing Node regressions passed; changed JavaScript syntax and diff/reference checks passed.
- Chromium over localhost HTTP with two connected players passed sending/receiving, unread clearing, mouse drag, keyboard movement, local-only preferences, close/reopen/reload persistence, Dock/Pop out/Reset, completely clear computed backgrounds, pointer-through empty space, scrolling message text, receipt while open, both Sidebar/Grid at 1920×1080 and 1366×768, a 390×300 emulated viewport, and Escape focus. A focused two-player pass also verified Close-button focus, dialog Escape priority, and using/sending chat while picking a targeting arrow. No page errors were observed.
- These are assistant HTTP browser observations, not real-device touch/Safari or Chris's hands-on results. Managed browser policy blocks `file://` navigation, so Chris's normal extracted-copy flow still needs his review.

PR #11 remains paused. Nothing in this test copy is approved for publication.
