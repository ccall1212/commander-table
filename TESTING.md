# Floating and transparent chat — v0.33.0 test copy

Download the ZIP, extract it, and double-click **index.html**. No terminal or local server is needed. Keep internet access on. Use two players with the same test copy; chat is disabled in Practice solo.

Tested by Chris: the initial floating/transparent test copy “looks good.” He also said the refined fade copy “looks good” and requested manual sizing. Chris approved merging and publishing the complete resizing copy on 2026-10-21; PR #52 is merged as v0.33.0. He did not describe specific hands-on resize actions. The published token release is included; the separate Deck Builder checks and backup/restore proposals are not included.

## Click list

1. Host a shared game and join from a second player. Open **💬 Chat**, send messages in both directions, and confirm the normal panel still works. Close one player's chat, send them a message, and check the unread indicator; opening chat should clear it.
2. Choose **Pop out**. Drag the **Room chat** heading to another part of the table. Chat should stay open, and dragging it should not tap, move or select cards. Buttons and the message input should remain usable.
3. Drag the bottom-right corner smaller and larger. Move the resized chat: its size must stay the same. Try the corner with arrow keys and Shift + arrows too. Check the input and Send stay usable at the minimum size. Close/reopen, reload and Dock/Pop out should remember your size; Reset restores the original size.
4. Choose **Transparent**. The subtitle, empty-chat hint, timestamps and “latest 100 messages retained” footer should disappear. Controls appear when interacting with chat. Panel, heading, message area and composer backgrounds should be completely clear while messages, input and controls remain visible. Click empty space in the transparent chat to interact with the table underneath; scroll over message text to scroll the history.
5. Leave transparent chat idle for eight seconds with no draft. It should fade to a small **Chat…** button. Click it to reveal chat and focus the input; the top-bar Chat button should also restore it. Type an unsent draft and wait: it must stay visible. Send it, then let chat fade and send a new message from the other player: chat should fade back in without taking keyboard focus. Solid chat should never fade.
6. Move transparent chat too. Send another message from the other player: it should appear without moving or closing the panel. Each player's mode and position should stay independent.
7. Close/reopen chat, then reload your game and reopen chat: mode and position should be remembered. Choose **Dock** to restore the solid normal panel; **Pop out** restores floating mode. **Reset** returns it to the default position.
8. Try Sidebar and Grid around 1920×1080 and 1366×768, then shrink/resize the window. The heading, Close, and composer must stay reachable. Check the panel after opening/closing the on-screen keyboard on a real touch device if available.
9. Tab to the floating heading and move it with arrow keys; Shift moves farther. Escape should close chat and focus the top-bar Chat button. If another dialog is open, Escape should close that dialog first.
10. While choosing a targeting arrow, try opening chat, moving it and typing: chat controls should work without selecting arrow endpoints. Close chat and continue/cancel picking normally.

## Assistant verification

- Geometry/preferences Node checks cover malformed saved values, extreme coordinates, wide/narrow/short viewports, visible viewport offsets and recovering the saved position after a temporary resize.
- Existing targeting, P/T, token picker and token-printing Node regressions passed; changed JavaScript syntax and diff/reference checks passed.
- Chromium over localhost HTTP with two connected players passed sending/receiving, unread clearing, mouse drag, keyboard movement, local-only preferences, close/reopen/reload persistence, Dock/Pop out/Reset, completely clear computed backgrounds, pointer-through empty space, scrolling message text, receipt while open, both Sidebar/Grid at 1920×1080 and 1366×768, a 390×300 emulated viewport, and Escape focus. A focused two-player pass also verified Close-button focus, dialog Escape priority, and using/sending chat while picking a targeting arrow. No page errors were observed.
- A fresh two-player Chromium HTTP pass verified actual eight-second fade timing, hidden helper text, the wake button and top-bar wake focusing the composer, unsent draft protection, sending after wake, incoming-message wake without focus theft, faded-area click-through, both layouts/sizes, and solid docked chat staying visible. No page errors were observed.
- A fresh two-player Chromium HTTP resize pass verified real pointer shrink, movement retaining size, keyboard resizing, capture-loss cancellation, sending from the minimum 260×240 transparent panel, independent saved size/reload, Sidebar/Grid at both screen sizes, fade/wake, temporary viewport shrink/restore, Dock and Reset. No page errors observed. Focused Luna review found no concrete resize lifecycle bug.
- These are assistant HTTP browser observations, not real-device touch/Safari or Chris's hands-on results. Managed browser policy blocks `file://` navigation, so Chris's normal extracted-copy flow still needs his review.

PR #11 remains paused. Publication approval covered this chat release only; the separate Deck Builder checks and backup/restore proposals still need their own approval.
