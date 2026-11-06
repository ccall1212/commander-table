# Trigger reminders panel — v0.67.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed. Two players are best (your window plus a private window); play with real decks.

1. **The tab.** In a game, look at the top-left of your board for **📝 Reminders** (with a number). Click it to open the panel. Drag it by the title to move it; the **▾** collapses it back to the tab (the position is remembered).
2. **My reminders.** Type *Landfall: draw 2 cards and gain 1 life* with the tag *each land* and press **Add**. Click its text to edit it; **✕** removes it. There are no tick boxes: reminders just stay listed.
3. **Saved with the deck.** Leave the game and start another game with the same deck: the reminder should still be there. A different deck has its own list. (Also try ☰ → backup: reminders are included.)
4. **From the table.** Play cards with triggers (for example a landfall card, an "at the beginning of your upkeep" card). Under **From the table** you should see the card name and the trigger line quoted from the card. One-time "When it enters" lines should not appear.
5. **Opponents.** Have the other player put a card like **Rhystic Study** (*Whenever an opponent casts a spell…*) on the battlefield. It should appear with their name in brackets. A card whose trigger only concerns them (like their own upkeep) should not. Press the **Opponents' triggers On/Off** button to hide their lines.
6. **Hide.** **✕** on a table line hides that trigger from now on.
7. Please tell me how it feels: is the panel in the way, are there too many lines on a busy board, is anything missing?

## Assistant verification

- **Unit tests (Node):** new `test_reminders` (finding trigger lines, filtering for opponents, cleaning the saved list); all 25 automatic test files pass.
- **Real browsers (Chromium, two players):** new `test_reminders_browser` checks the lines quoted for my cards and Rhystic Study, that one-time and opponent-only triggers are left out, the opponents switch, hiding, saving with the deck and in a backup, editing, no tick boxes, and collapsing to the tab. I looked at a screenshot.
- **Not tested:** real decks from Scryfall (my tests use made-up cards with real-style rules text), real touch.
