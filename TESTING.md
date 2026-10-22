# Entry options and Deck Builder backup — Objectives #43 and #38, v0.45.0

Extract this ZIP and double-click **index.html**. You do not need a terminal or local server. These changes are a test copy; the published game stays at v0.44.1 until Chris approves publication.

## Click list

1. On the opening screen, notice the separate **Back up / restore…** button is gone. Open **Deck Builder** with a saved deck, then use **Back up / restore…** at the bottom. Confirm **Download backup** still saves a JSON file and the restore file picker still previews a selected backup. Close the backup window; Deck Builder should still be open.
2. In a fresh/private browser with no decks, **Deck Builder** should still open. Use its **Back up / restore…** button to restore the JSON file, review the preview, then press **Restore and reload**. Your deck should appear. Check optional preference/appearance restore only if you want those settings imported.
3. Host a game. The opening-rule dialog now has independent **Auto-Draw** and **Auto Untap All** checkboxes. Try Cancel once: it should return to the opening screen without a room. Open it again, choose either, both, or neither, then Continue and choose your color.
4. Join that room from a second browser. Choose its own two options and a different color. Try Cancel first if convenient; it should leave the browser on the opening screen. Host and joiner should each have the options they selected, independently of the other.
5. While still choosing opening hands, change the opening rule and choose **Redeal everyone**. The Auto-Draw/Auto Untap All choices should remain. Start a game and confirm the in-game switches can still change each option. Try Sidebar and Grid at 1920×1080 and 1366×768 if available.

When you report results, let me know which steps and browsers you tried. Existing saved sessions resume with their saved options.

## Assistant verification

- Collection backup unit checks pass, including download data, restore planning/merge, optional appearance/preferences, and rollback on storage failure.
- Actual Chromium checks over localhost HTTP cover Deck Builder backup access with a deck and with an empty collection, file restore into an empty collection, Host/Join cancel and confirmation, all three opening rules, all four Auto-Draw/Auto Untap combinations across the two players, pregame redeal, an in-game toggle, and no page errors. Host/join checks use a local copy of the existing relay Worker.
- Browser layout checks include Sidebar and Grid at 1366×768 and 1920×1080. JavaScript syntax, cache/version references and diff whitespace checks pass.
- Chris's hands-on ZIP result is pending. The assistant browser checks use HTTP; file:// and real Safari were not verified here.

Paused draft PR #11 remains untouched.
