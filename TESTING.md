# Two new card backs — v0.46.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

1. On the opening screen, enter a name and open **Your look**. The **Card back** picker should now show twelve presets. The last two are **Gilded Knight** (an armored knight holding a sword in front of a stained-glass window) and **Obsidian Gem** (a dark faceted gem with silver smoke in a gothic silver frame). Both thumbnails should show their pictures and fit like the others.
2. Click **Gilded Knight**. Its tile should be highlighted. Import or pick a deck, then click **Practice solo**. The Library pile should show the knight picture. Do the same with **Obsidian Gem**.
3. Draw a card, flip one face down (**Z**) and look at the back on the battlefield. Try Sidebar and Grid at 1920×1080 and 1366×768 if practical.
4. With a second player (host in one tab, join from another): each player picks a different back, then both start. Each player should see the other's chosen back on face-down cards and hand fans. Anyone on an older cached copy would see Ruby Sigil for the new names, so reload both tabs first.
5. Reload the page: your choice should still be selected. A saved **Your upload** card back, if you have one, should still work.
6. The pictures should show no text, logos or Magic symbols. Tell us if anything looks off.

## Assistant verification (headless Chromium, opened from file://)

Page loaded with no page errors at 1920×1080 and 1366×768. The picker listed twelve backs; both new images loaded at 420×588 and contain visible detail. Selecting each new back saved the choice, and the Library pile in a Practice solo game used that image. Multiplayer, Grid layout, and the look of face-down cards on the battlefield were not checked. Paused draft PR #11 is untouched.
