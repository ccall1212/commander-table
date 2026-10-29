# Bundled PeerJS, footer links, privacy note and automatic checks — v0.56.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

Most of this release is behind the scenes. The things you can see or feel:

1. **Footer:** at the bottom of the start screen you should now see **Report a bug · Privacy · v0.56.0** after the Scryfall and Wizards line. **Report a bug** opens the project's GitHub Issues page. **Privacy** opens the guide on GitHub; until this version is published it won't show the new Privacy section yet. Check that the footer looks tidy on your screen and on a phone or iPad if you have one.
2. **Online play still works (this is the important one):** the direct-connection library now comes from the ZIP instead of the internet. Host a game in one tab or browser, join from another (or have a friend join), move a few cards, tap something and send a chat message. It should behave exactly as before. If hosting or joining ever fails with "PeerJS failed to load" or "needs an internet connection", tell us right away.
3. **Practice solo** should work exactly as before.
4. Read the new **Privacy** section in `docs/GUIDE.md` and tell us if anything in it is wrong or you would word it differently. Please read the "Site admin" line especially, because it describes the admin's ability to quietly watch a game's public table and chat.

## Assistant verification

- **Headless Chromium, opened from file://:** the `Peer` library is present and can be created, the page makes no requests to any CDN, "Host a game" opens its dialog, the footer links are correct and fit at 1600×900 and 390×844 with no sideways scrolling, and there were no page errors. The bundled PeerJS file is the unmodified 1.5.4 package file; its package checksum matched npm's published value.
- **Automatic checks, run locally on Node 22:** JavaScript and Python syntax, version numbers (26 places), and 17 unit-test files all pass. Two out-of-date tests (power/toughness and targeting arrows) were fixed first because newer features had broken them.
- **Not checked:** a real two-player online game (relay or direct connection), the checks running on GitHub itself (they run on the pull request), and real iPhone or iPad.
