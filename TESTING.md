# Printed abilities switch on automatically — v0.69.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed. A practice game is enough.

1. Play **Kimarhri, Valiant Guardian** (Vigilance is its first word): the **Vigilance** icon should appear on it right away.
2. Play a Saga creature such as **Summon: Ixion**: **First strike** (printed at the bottom) should be on.
3. Play a card with several, for example one that starts "Flying, lifelink" or has Flying and Trample on separate opening lines: all of them should be on.
4. A card whose ability only appears after a trigger line (or "Hexproof from black") should get nothing. A card played **face down** should get nothing.
5. Create a token or a copy of a creature with Flying: it should show the icon too.
6. Right-click your board -> turn **Turn on printed abilities automatically** off, play another: no icons. You can still add icons by hand (Statuses & abilities…).
7. Tell me about any card where it picked wrong or missed an ability, with the card's name.

## Assistant verification
- All automatic unit tests pass, including the new `test_keywords` (start of text, several per line, Saga bottom, skipped keywords like Flash/Ward, "Hexproof from", later lines, two-faced).
- Real browser (Chromium, two players): new `test_auto_keywords_browser` plays made-up cards and checks icons, face down, and the menu switch.
- Not tested: real Scryfall text for every card; real mouse use of the menu item.
