# Gold circle over the card backs — v0.62.1 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

1. Open **Your look** on the opening screen and pick a card back (try one of the dark or colourful ones, and also your uploaded one if you have it).
2. Host or join a game and look at your **Library** pile, and the face-down hands and libraries of other players in both ▥ Sidebar and ▦ Grid. The back should look exactly like the artwork, with **no gold oval over the middle**.
3. Put a card face down on the battlefield (Z): same check.
4. Please compare with the live game if you remember how it looked, and tell me if anything else on a card back still looks off.

## Assistant verification

- **Cause:** the built-in card back draws a gold oval emblem with CSS on top of the picture you choose. It is now stacked underneath the picture (it is only the fallback if a picture fails to load).
- **Real browsers (Chromium, two players):** new `test_cardback_art_browser` checks the stacking on both screens; I confirmed it fails with the old styles and passes with the fix. I looked at a screenshot of the Library: no oval.
