# Manual test checklist — Commander slam animation (v0.20.1 candidate)

## Start the app

1. Extract this ZIP.
2. In the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`.
3. Open `http://127.0.0.1:8099/index.html`.
4. Import a deck with a Commander and start a Practice game. For shared-table checks, use two browser tabs and join the same room.
5. Stop the server with Ctrl+C when finished.

## Click-by-click checks

1. **Commander slam:** move your Commander from the command zone onto the battlefield. Expect a visible lift-and-impact animation with a bright color-identity ring and a short, quiet thud.
2. **Color identities:** if possible, test a mono-color Commander, a multicolor Commander, and a colorless Commander. The colorless card should get a neutral glow.
3. **Only on play:** drag/reposition the Commander after it is on the battlefield. No slam should play.
4. **Other cards:** move a normal card from your hand onto the battlefield. It should not get the Commander slam.
5. **Other moves:** move a Commander from graveyard or exile to the battlefield. It should not get the command-zone slam.
6. **Multiplayer:** with a second player, play a Commander from the command zone. Both players should see the same brief effect, and the card must remain clickable during the animation.
7. **Layouts/sizes:** test Sidebar and Grid at approximately 1920×1080 and 1366×768.
8. **Reduced motion:** enable your operating system/browser reduced-motion preference and reload. The slam animation should be skipped.
9. **Console:** check for errors.

Expected: a visible, click-through slam effect and short impact sound only when a Commander is played from the command zone; no effect on later repositioning or ordinary card moves.
