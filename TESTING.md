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


## Browser test status — pointer/clicking fix (v0.21.4)

Chris confirmed that he tested the pointer/clicking fix in a real browser before publication. This is user-performed browser testing; ChatGPT did not independently run the app in a browser or run an automated browser test. Use the checklist above for future regression checks.


# Manual test checklist — iPad and phone Touch mode (v0.22.0 candidate)

1. Extract the branch ZIP, run `python -m http.server 8099 --bind 0.0.0.0` in its folder, and open `http://127.0.0.1:8099/index.html` on that computer. For an iPhone/iPad on the same Wi-Fi, open `http://<COMPUTER-LAN-IP>:8099/index.html` on the device (replace the placeholder with the computer's local IP address).
2. Start Practice solo. Open **☰ → Touch mode**. Confirm the menu item shows a check mark and the toast explains that page scrolling is disabled. Reload and confirm Touch mode remains enabled on that device.
3. On a phone held upright, confirm a small banner recommends landscape and can be dismissed. Rotate sideways and confirm the banner disappears and the game uses the available screen height. Rotate back and confirm the game remains usable; the banner may appear again if it was not dismissed.
4. Tap a card in your hand and on the battlefield. Its large preview should appear and include an **Actions** button. Tap **Actions** and confirm the existing card context menu opens and its options work.
5. Press and hold a card for about half a second. Its context menu should open; lifting your finger must not also tap/untap or drag the card. Repeat on a Library/Graveyard pile and a card belonging to an opponent.
6. **Bottom-edge drag / page scroll:** drag several cards from the bottom 10–20 pixels of the hand, by the art and by the edges between overlapping cards. Safari should not move the page; the grabbed card should follow your finger.
7. **Internal scrolling:** open the game log and scroll it; open long card context menus and tall dialogs/viewers and scroll inside them. They should scroll without moving the page.
8. **Rotation / browser bars:** rotate portrait to landscape and back, and test after Safari's address/tab bars collapse or reappear. The board should stay within the visible screen and the landscape hint should remain dismissible.
9. Turn Touch mode off. Confirm normal desktop mouse/right-click behavior is restored; reload and confirm the saved off state remains. Check the browser console for errors.

**Important:** iPhone Safari does not reliably allow a normal website to force orientation lock, so Touch mode recommends landscape rather than requiring it. Real iPhone/iPad Safari testing is still needed to confirm touch gestures and screen sizing.


# Manual test checklist — Grid battlefield pile drops (v0.22.2 candidate)

## Start the app
1. Extract this ZIP.
2. In the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`.
3. Open `http://127.0.0.1:8099/index.html`.
4. Start a game with at least two players (a host tab and a second tab joined to the same room).

## Click-by-click checks
1. Select **Grid** view and use the player's own quadrant.
2. Drag a battlefield creature onto **LIB**. Expect it to move to the Library (normal drop goes to the top; hold Shift to put it on the bottom).
3. Drag another battlefield card onto **GY**; confirm it leaves the battlefield and appears in the Graveyard.
4. Drag a card onto **EXILE**; confirm it moves to Exile.
5. Drag a Commander/permanent onto **CMD**; confirm it moves to the Command zone.
6. Repeat all four destinations in **Sidebar** view to check that existing behavior is unchanged.
7. Repeat at browser sizes **1920×1080** and **1366×768**. In the second tab, confirm the other player's public view updates to the same zone.
8. Confirm ordinary card repositioning within the battlefield and attaching cards still work.
9. Check the browser console for errors, then stop the server with Ctrl+C.

**Not yet verified:** actual browser/multiplayer interaction; please run this checklist on the ZIP.


# Manual test checklist — lethal Concede prompt (v0.22.3 candidate)

## Start the app
1. Extract this exact branch ZIP.
2. From the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`.
3. Open `http://127.0.0.1:8099/index.html`.
4. For multiplayer checks, host in one tab and join the same room in a second tab using `http://127.0.0.1:8099/index.html?join=<ROOM>`.

## Click-by-click checks
1. **Life lethal:** in Practice solo, use the life − button to move from 1 to 0. Expect one Concede confirmation. Choose **Cancel**; click unrelated controls and cause a render. The prompt must not reopen by itself. Raise life above 0, then cross to 0 again; expect a new prompt.
2. **Commander damage lethal:** in a two-player game, open the victim's life/counters panel. Increase damage from one opposing Commander to 20, then to 21. Expect the Concede prompt when that one Commander reaches 21, even if life remains above 0. Cancel and confirm it does not reopen on render.
3. **Empty library:** use **Draw X…** repeatedly until the Library is empty. Confirm its 0 count is red in Sidebar and Grid. Attempt another draw. Expect the empty-library warning and Concede prompt. Cancel, then attempt another draw; expect the prompt again for that new attempt, not merely because the screen rendered.
4. **Partial draw:** if a Draw X action draws the remaining cards and requests more, expect the empty-library prompt once for that action, not one prompt per missing card.
5. **Remote life change:** in a two-tab game, have the other player change your life so it crosses from positive to 0 or below. Confirm your own tab shows the prompt.
6. **Layouts and sizes:** repeat the relevant checks in Sidebar and Grid at approximately 1920×1080 and 1366×768. Confirm a second player sees the red zero library count where the library is displayed.
7. **Console:** check both tabs for errors. Confirm canceling a prompt does not concede the game; choosing **Concede game** does.

Expected: one prompt per new lethal crossing or empty-library draw attempt, no prompt loop caused by render/state updates, and a red zero library count.


# Manual test checklist — separate Power/Toughness controls (v0.22.4 candidate)

1. Extract this branch ZIP, run `python -m http.server 8099 --bind 127.0.0.1` in the extracted folder, and open `http://127.0.0.1:8099/index.html`.
2. Start Practice solo and put a creature with printed P/T on the battlefield. Right-click it → **Power / Toughness**. Confirm the menu has **Power +1**, **Power −1**, **Toughness +1**, **Toughness −1**, plus **Manual +1/+1 (until reset)**.
3. Apply **Power +1** and **Power −1**. Only power should change; toughness should remain at its prior value. Repeat with the toughness controls and verify only toughness changes.
4. Add a real **+1/+1 counter** from **Counters**. Both stats should increase by one on top of the manual adjustments. Remove it and confirm both stats return while manual changes remain.
5. Use **Manual +1/+1 (until reset)**. Both stats should increase, but the card's counter display should not gain a +1/+1 counter. Choose **Reset power/toughness** and confirm manual P/T changes clear without removing real counters.
6. Use **Set power/toughness…** (for example, 4/4), then add a counter and a one-stat adjustment. Confirm the final badge combines the base override, counter(s), and independent changes. Reset and confirm the printed P/T returns.
7. Test a creature with no counters and one with multiple +1/+1 counters. Test a creature with unusual printed P/T if available.
8. Test in Sidebar and Grid at 1920×1080 and 1366×768. In a second browser tab/player, confirm the other player's board shows the same resulting P/T. Check the console for errors.

Expected: manual power-only changes never alter toughness; manual toughness-only changes never alter power; actual +1/+1 and −1/−1 counters still affect both stats; all players see the same displayed result.


# Manual test checklist — independently clickable power/toughness (v0.22.4 candidate)

1. Extract the ZIP and run `python -m http.server 8099 --bind 127.0.0.1` in the extracted project folder.
2. Open `http://127.0.0.1:8099/index.html`, click **Practice solo**, and put a creature on the battlefield.
3. **Click the blue power number itself.** Expect power to increase by 1 and toughness to stay unchanged. Click the dark toughness number itself. Expect toughness to increase by 1 and power to stay unchanged.
4. **Right-click the power number** and confirm only power decreases by 1. Right-click toughness and confirm only toughness decreases by 1.
5. Confirm the badge stays small and white like the original, with black power and toughness numbers side by side and no slash. Hovering or focusing either number should darken the entire corresponding half of the pill—clearly visible, full-height, rounded on the outside edge, and flat at the center seam. No small box just around the digit.
6. Right-click the card body (not a stat number) → **Power / Toughness**. Separately test **Power +1**, **Power −1**, **Toughness +1**, and **Toughness −1**. Each menu command must change only its named stat. Manual +1/+1 changes both intentionally.
7. Add a real +1/+1 counter and confirm both values increase; remove the counter and confirm both return. Reset manual changes and confirm actual counters remain.
8. Check Sidebar and Grid at approximately 1920×1080 and 1366×768.
9. If possible, host in one tab and join from a second. Verify clicks on either stat update the same single stat for both players.
10. Check the browser console for errors, then stop the server with Ctrl+C.


# Manual test checklist — direct life totals and poison warning (v0.23.0 candidate)

1. Extract the test ZIP and run `python -m http.server 8099 --bind 127.0.0.1` from the extracted folder, then open `http://127.0.0.1:8099/index.html`.
2. In Practice solo, click the life number itself (not +/−), enter `70`, confirm, and verify the total becomes 70. Repeat with `12`. Confirm Cancel, Escape, and backdrop dismissal leave the total unchanged. Try a decimal and verify it is rejected with a clear message.
3. With a second browser tab joined to the same room, click the first player's life number from the second tab and set it to 70; verify the owning player's total and both tabs update, then set it below 0 and confirm the existing lethal-life prompt still works. Check the action log records the change.
4. Open the counters dropdown and adjust Poison to 9, 10, and 11. The poison total should be normal at 9 and red at 10 and 11. When increasing from below 10 to 10 or more, a **Lethal poison** confirmation should appear with a **Concede game** button. Choose Cancel and confirm the game continues; cross the threshold again and choose Concede game to confirm you leave the game. Decrease back to 9 and confirm the red warning clears.
5. From a second player, increase/decrease the player's poison counters if the existing controls allow it; verify all players see the warning state update consistently.
6. Repeat the poison and direct-life checks in Sidebar and Grid at 1920×1080 and 1366×768. Check the browser console for errors.
7. Stop the local server with Ctrl+C.



# Manual test checklist — T hotkey opens the Token menu (v0.24.0 candidate)

1. Extract the exact branch ZIP. In the extracted project folder, run `python -m http.server 8099 --bind 127.0.0.1`, then open `http://127.0.0.1:8099/index.html`.
2. Start Practice solo with a deck. In **Sidebar** view, move the pointer to empty space on your own battlefield and press **T**. The existing Token menu should open near the pointer. Choose a listed token, or use **Search all tokens…**, and confirm the chosen token is created using the existing flow.
3. Put the pointer over one of your untapped battlefield cards and press **T**. It should tap; press **T** again and it should untap. The Token menu must not open for either press.
4. Put the pointer over a card in your hand and press **T**. It should play that card onto the battlefield tapped; the Token menu must not open.
5. Press **T** while pointing at an opponent's board, one of your Library/Graveyard/Exile/Command piles, the Grid hand/pile strip, the game log, or outside the board. The Token menu should not open from those locations.
6. Switch to **Grid**. Repeat the empty-space test inside your own quadrant, then repeat the card-in-hand and card-on-battlefield tests. The small life/hand/pile strip is not empty battlefield space and must not trigger the menu.
7. Repeat in Sidebar and Grid at approximately **1920×1080** and **1366×768**. If using a second player tab, confirm creating a token still uses the existing synchronized token flow.
8. Check the browser console for errors, then stop the server with Ctrl+C.

Expected: **T** opens the Token menu only when the pointer is over empty space on your own battlefield. Existing T actions for tapping/untapping a battlefield card and playing a hovered hand card tapped remain unchanged.


# Manual test checklist — Room chat and turn-start notifications (v0.26.0 candidate)

## Start the test copy
1. Extract this ZIP and run python -m http.server 8099 --bind 127.0.0.1 in the project folder.
2. Open http://127.0.0.1:8099/index.html. Host a game in one tab and join it from a second tab with http://127.0.0.1:8099/index.html?join=<ROOM> using a different name and deck.
3. Keep the browser console open during the checks. Stop the server with Ctrl+C when finished.

## Room chat
1. In both tabs, click Chat. Send a message from tab 1 with Enter and from tab 2 with the Send button. Expect each message in both histories with the correct sender and time.
2. Check the panel's **Sound off** control is off by default. Close Chat in both tabs and send a message from tab 2. Tab 1 should show a brief, gentle gold pulse on Chat, a small non-click-blocking popup near the top-right, and an unread count; the popup should fade after a short delay. Tab 2 should not show a duplicate popup for its own message.
3. Open Chat in tab 1 and turn **Sound on**. Send a message from tab 2: tab 1 should play a soft two-note chime, and Sound on should remain selected if the page is reloaded. Turn it off again and confirm later messages are silent. The other player's own sent message should not chime on their screen. Send several messages quickly and confirm the chime does not repeatedly fire for every rapid message.
4. With Chat still open, send another message from tab 2. The new message should briefly highlight in the history and the panel border should glow gently; the Chat button should also pulse. It should not show a separate popup or add an unread count while the panel is open. Scroll up in history, receive a new message, and confirm your scroll position is not forcibly jumped to the bottom.
5. Reload tab 2 and reopen Chat. Recent room history should be supplied again by the host. Confirm chat messages are not inserted into the game log and do not change cards, life, turns, or other game state.
6. Try sending a blank message and a message containing literal markup such as <b>hello</b>. Blank text should not send; markup should appear as plain text, not formatting. A long message should be capped at 280 characters.

## Turn-start banner
1. Start the game. Let the opening d20 roll overlay finish; then expect a short YOUR TURN banner over the first player's board. Other players should see NAME'S TURN over that same board.
2. Press Pass turn once. Each connected screen should show the banner over the new active player's board, with the appropriate label for that screen.
3. Switch between Sidebar and Grid, and check at approximately 1920×1080 and 1366×768. The message should remain readable over the correct board, including when the current player is in a miniature tile or being viewed full-size.
4. Reload a tab mid-turn and confirm the banner does not replay for the current turn; the next actual pass should trigger it once. Quickly pass several times and confirm old banners do not stack.
5. Start a Practice solo game. The turn banner should work after the opening roll; Room chat should be disabled. Check the console for errors.
6. Enable the operating system/browser reduced-motion preference and repeat a turn change and receive a chat message. The banner should appear briefly without moving/fading animation; chat popups, button pulse, panel glow, and message highlight should not animate.

Browser validation is required before publishing. If audio is blocked until a gesture, turn **Sound on** from inside the chat panel to enable it for that page. Check chat synchronization with a third player tab if possible.
