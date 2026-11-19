# Sideways cards shown upright — v0.83.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game works (start it, then put cards on the battlefield). You need the cards' pictures, so use a real deck or import one that contains the cards below (or search tokens/cards in your deck editor).

1. Put **Wear // Tear** (or Fire // Ice, Rough // Tumble) on the battlefield. Instead of lying on its side with text running bottom-to-top, it should lie **upright and readable**, like a tapped card turned the other way.
2. **Tap** it (T): it now shows the plain portrait picture (the old look). Untap: upright again.
3. Hover it: the preview is a **landscape picture you can read**. Hold **V** over it: the magnifier shows it upright too.
4. Put a **Room** (Dazzling Theater // Prop Room) and the **Battle Invasion of Zendikar** on the battlefield: both lie upright. **Flip** the Battle (F): you see its normal upright back face (Awakened Skyclave).
5. Put **Commit // Memory** or **Struggle // Survive** (Aftermath), an Adventure (Bonecrusher Giant), a Pathway land, and a normal creature on the battlefield: all stay **as before** (no turning). Tell me if any card that is printed sideways is not turned, or one that is not sideways gets turned.
6. With a second player (private window): they see the same turned cards on your board.
7. Look at the cards in your hand and graveyard: they still show the plain picture. Is that OK, or should they be turned too?

## Assistant verification
- 31 automatic unit tests pass, including new `test_orient` checks (split cards, Rooms, Battle front/back, Aftermath, Adventures, double-faced cards, the published flag).
- New two-player Chromium test `test_sideways_browser`: which cards get turned for both players, tapping and flipping, and the landscape hover preview. Checked by eye with real card pictures too (Wear // Tear, Fire // Ice, Dazzling Theater, Commit // Memory, Invasion of Zendikar).
- **Not tested:** touch, the Grid layout, and more than two players.
