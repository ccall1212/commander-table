# Exile, and give to player — v0.68.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed. Two players are best (your window plus a private window or a friend).

1. Start a game with two players. Player A **right-clicks their Library** and chooses **Exile, and give to…**, then B, then 1. Then again with **Exile face down, and give to…**. (The Search library window also has buttons for one chosen card.)
2. Player B opens their **Exile**: both cards should be there. B's **Reminders** tab should list "You may play this card from exile (owned by A)" for each.
3. Player A looks at B's board/exile: the face-up card is visible; the face-down one is only a card back (A cannot see what it is).
4. B plays one onto the battlefield: it turns face up, the "playable" reminder goes away, and the log says it was played.
5. B moves the other one (still in exile) to the graveyard: it should end up in **A's** graveyard.
6. Try 2 or 3 cards at once (the number box): they all arrive in B's exile.
7. Tell me: is this the flow you wanted? Do you want an on-board "playable" marker or a quick-actions list (Play Commander, play from graveyard, play exiled cards)?

## Assistant verification
- All automatic unit tests pass; new real-browser test `test_exile_give_browser` (two Chromium players) passes: card lands in the receiver's exile marked playable, face down stays secret from the giver, reminder shown, playing clears the mark, leaving exile sends it home.
- Not tested: real mouse use of the viewer buttons, touch, and a three-player table.
