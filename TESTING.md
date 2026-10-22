# Card-back preset removal — v0.45.1

This is a test copy. Extract the ZIP and double-click **index.html**; no terminal or local server is needed.

1. On the opening screen, open **Your look**. The card-back picker should have ten presets. Arcane Star and Shadow Black should be absent; the remaining presets should show their images.
2. Choose another preset, then host or join a game. Face-down cards in your Library and hand should use that backing. Check an opponent's face-down cards if a second player is available. Try Sidebar and Grid at 1920×1080 and 1366×768 if practical.
3. If you had previously chosen Arcane Star or Shadow Black, the selection should now show Ruby Sigil; your face-down cards should remain visible. A collection backup containing either older choice should also restore to Ruby Sigil.
4. If you have a custom uploaded card backing, it should still be available from **Your look** and work in game.

Please tell me which steps and browsers you tried. This PR is a test copy and has not been published.

## Assistant verification

Chromium over localhost HTTP at 1366×768 and 1920×1080 showed ten picker choices, all ten remaining images returned successfully, both removed saved IDs normalized to Ruby Sigil, and no page errors. JavaScript syntax and diff whitespace checks passed. Multiplayer, Sidebar/Grid face-down cards, custom uploads and file:// opening still need Chris’s hands-on check. Paused draft PR #11 is untouched.
