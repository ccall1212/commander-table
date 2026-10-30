# Room access: lock, ask before joining, blocking — v0.57.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

You need at least two browser windows that act as different players. The easiest way is your normal window for the host plus a **private/incognito window** (or a second browser) for each guest. Give each guest a different name.

1. **Open a room as the host.** Host a game, pick a color, and look in **☰** for the new **Room access…** item.
2. **Lock room.** Open **Room access…** and tick **Lock room**. The menu item should now say **(locked)** and the game log should say the host locked the room. In a private window, try to join with the room code. You should be sent back to the start screen with a message that the room is locked, and the host's table should be unchanged. Close the dialog before testing.
3. **Unlock.** Untick **Lock room**. The same private window should now be able to join normally and pick a color.
4. **Ask me before anyone joins.** Tick **Ask me before anyone joins**. From a second private window, try to join. That guest should see **Waiting for the host to let you in…** (with a **Cancel and return to lobby** button). The host should get a **Join request** box naming the guest. Try **Let in** (the guest should then pick a color and be seated) and, with another guest, **Decline** (that guest should be sent back to the start screen with a message).
5. **Kick and block.** Untick the ask option. Right-click a seated guest's name and choose **Kick from game…**. That guest should be removed. Try to rejoin from the same window **and from a new private window using the same name** (capitalization can differ). Both should be told they cannot join. Open **Room access…**: the removed name should be listed under **Blocked names**. Click **Unblock** and confirm they can join again.
6. **Reconnect while locked.** Lock the room again. In a seated guest's window, reload the page and use the **Resume**/**Rejoin** button. They should get back into the locked room.
7. Everything else (joining an open room, practice solo, normal play) should behave exactly as before. Please also watch for anything odd: for example a guest stuck on a waiting screen, a dialog that will not close, or the host being asked about someone who already left.

Note: everyone should be on this version for the lock to work smoothly. Someone on an older version who is turned away just sees the game "connecting".

## Assistant verification

- **Unit tests (Node):** new `test_room_access` covers an open room, a locked room, ask-first with Let in and Decline, blocking by browser ID and by name (including capitalization and a new browser ID), host-only settings, unblocking, and the saved table keeping the settings; new `test_net_drop` covers the network layer (broadcasts skip a connection that is not admitted, direct messages still arrive, dropping closes only that connection). All 19 unit test files pass, as do syntax and version checks.
- **Real browsers with a local copy of the relay (Chromium, four players):** new `test_room_access_browser` walks through steps 1–6 above. It also records everything each guest's page receives and checks that a locked-out or declined guest is never sent the table or the host's name, with a control showing that an admitted guest is. The existing browser tests for host/join prompts, opening readiness, undo, response cues, hotkeys and the Deck Builder still pass against the same build.
- **Not run:** the older `test_board_recovery_browser` fails the same way on the current published version, so it was not caused by this change; the two admin browser tests; Firefox and Safari; a real game with friends over the internet.
