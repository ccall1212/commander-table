# Collection backup and restore test copy

Download this branch ZIP, extract it, and double-click `index.html`. This test copy is not published. Browser storage belongs to each browser/address; a ZIP copy may have a different collection from the live website.

1. Save two decks. In Deck Builder, change a printing so you can recognize it later. Choose a card back/background, optionally upload an image, and enter your name.
2. Next to Deck Builder, click **Back up / restore… → Download backup**. Keep the downloaded `.json` file.
3. Open this extracted copy in a second browser, select that file in **Back up / restore…**, and check the preview. Leave the preferences checkbox off and click **Restore and reload**. Both decks should appear with their printings; this browser's name and appearance should stay as they were.
4. Restore the same file again. Matching decks should be skipped. Check **Also restore saved preferences and appearance** and restore: after reload, the saved name, appearance and preferences should match the first browser.
5. Edit a restored deck, then select the original backup again. Preview should offer a restored copy; confirm and verify both the edited deck and original version are available. Other decks must remain.
6. Select a plain decklist `.txt` file or invalid JSON: show a clear error and leave Restore disabled. Cancel/close a valid preview: the collection must remain unchanged.
7. Check the dialog at 1920×1080 and 1366×768; long previews should scroll inside the dialog and Close should remain reachable. Start Practice solo after restore and verify the selected printing is used. Sidebar/Grid in a two-player room should still work; backup controls only appear before a game.

Publication requires Chris's explicit approval. Chris has not yet tested this branch. Assistant checks are reported separately in the PR/chat.
