# Manual test checklist — Commander slam animation (v0.20.5 candidate)

## Start the app

1. Extract this ZIP.
2. In the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`.
3. Open `http://127.0.0.1:8099/index.html`.
4. Import a deck with a Commander and start a Practice game. For shared-table checks, use two browser tabs and join the same room.
5. Stop the server with Ctrl+C when finished.

## Click-by-click checks

1. **Commander slam:** move your Commander from the command zone onto the battlefield. Expect a visible lift-and-impact animation with a bright, split-color identity ring, a punchy boom-crack sound, and a ring that lasts longer. Two colors split top/bottom; three to five colors appear as separate radial segments.
2. **Color identities:** if possible, test a mono-color Commander, a multicolor Commander, and a colorless Commander. The colorless card should get a neutral glow.
3. **Ordinary movement sound:** move a normal card onto the battlefield and reposition a card already there. Each should make a softer card-tap sound, not the Commander boom.
4. **Other cards:** move a normal card from your hand onto the battlefield. It should make only the softer card-tap sound, not the Commander slam.
5. **Other moves:** move a Commander from graveyard or exile to the battlefield. It should not get the command-zone slam.
6. **Online (the case that was broken):** click **Host a game** in the first tab, copy the room code, and in a second tab open `http://127.0.0.1:8099/index.html?join=<ROOM>` with another name and deck. In the first tab, cast your Commander from the command zone by double-clicking it, then again (after returning it) by dragging it onto your battlefield. **Both tabs** should show the colored ring and hear the boom-crack Commander sound. Also place and reposition an ordinary card; both tabs should hear only the softer tap. Try the tests from the second tab too. Cards must stay clickable during effects.
7. **Layouts/sizes:** test Sidebar and Grid at approximately 1920×1080 and 1366×768.
8. **Reduced motion:** enable your operating system/browser reduced-motion preference and reload. The effect should show a brief static color flash (no movement); the impact sound should still play.
9. **Console:** check for errors.

Expected: a visible, click-through slam effect and short impact sound only when a Commander is played from the command zone; no Commander slam on later repositioning or ordinary card moves; ordinary battlefield placements/repositioning use only the softer tap.


# Manual test checklist — custom appearance uploads and pointer fixes (v0.21.4 candidate)

1. Extract the test ZIP and run `python -m http.server 8099 --bind 127.0.0.1` from its folder.
2. Open `http://127.0.0.1:8099/index.html` in Chrome, Edge, or Firefox.
3. In **Your look**, confirm the upload controls start collapsed behind the small **Upload your own images** control. Open it, upload a JPG, PNG, or WebP card back at least 250 × 350 px and a background at least 1280 × 720 px. Confirm each upload appears as a selected **Your upload** tile in the relevant preset grid and the game uses that image.
4. Try an unsupported file, an image under the minimum dimensions, and a file over 10 MB. Confirm clear errors appear and the previous appearance remains active.
5. Choose a built-in preset and confirm it becomes selected while the saved **Your upload** tile remains available but unselected. Click **Your upload** again and confirm it becomes selected. Reopen the upload panel and use **Remove saved ... image** only to delete the upload.
6. Check Practice solo, Sidebar and Grid at 1920 × 1080 and 1366 × 768.
7. Join a room from a second browser/tab. Confirm custom images stay local to the browser that uploaded them and do not leak to other players; built-in preset appearance should still be shared.
8. Reload the page and confirm the custom images remain saved and selected after reload. Check the console for errors, then stop the server with Ctrl+C.

Custom images are optimized to WebP and stored in that browser's local storage. They are not uploaded to the game server. Clearing site data removes them.

# Manual test checklist — pointer and dragging fixes (v0.21.4 candidate)

1. Right-click a card or empty battlefield space to open its context menu. Left-click several different places away from the menu, including the middle and lower part of the screen. The menu should close and the clicked target should still work.
2. Drag a single battlefield card by its art and by its text area. Only that card should move; the browser should not highlight text or start a native image drag.
3. Select one card (gold outline), then drag an unselected card. Only the card grabbed should move. Drag the selected card to move the selected group intentionally.
4. Draw a selection rectangle from empty battlefield space around multiple cards. The cards inside should be outlined; moving one of those selected cards should move the group. Click empty space or press Escape to clear the selection.
5. Repeat in Practice solo, Sidebar and Grid at 1920 × 1080 and 1366 × 768. Test a second player in another tab if available, and check the browser console.
