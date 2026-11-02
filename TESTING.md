# Share your hand with one player — v0.58.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

You need three browser windows as three players: your normal window (host) plus two **private/incognito windows** (or another browser). Give them different names, e.g. Dad, Son, Mom. Everyone picks a deck/color and clicks **Keep 7**.

1. **Whole hand.** In Son's window open **☰ → Share my hand with one player…**. Choose **Dad**. "What to show" should be disabled until someone is chosen; then pick **My whole hand**. In Dad's window, Son's miniature hand should now show real cards face-up (dashed outline, "shared with you"). In Mom's window it should still be card backs. Son's hand label should say "showing to Dad".
2. **Follows draws.** Son draws a card (D). Dad's view should gain that card. Mom's should not.
3. **Big view.** Dad clicks Son's name/board to view it big: the hand strip should read "SHARED WITH YOU" and show the real cards.
4. **Picked cards only.** Son reopens the dialog and chooses **Only the cards I pick**. Dad's view should go back to backs. Son right-clicks two cards → **Show to Dad**. Dad should see exactly those two (Son's cards get an eye mark).
5. **Played cards drop out.** The host clicks **Start game**. Son plays one of the shared cards: it disappears from what Dad sees.
6. **Switch.** Son chooses **Mom** in the dialog: Mom now sees the shared card, Dad no longer does.
7. **Stop.** Son chooses **Nobody**: Mom sees backs again and the "showing to" reminder disappears.
8. **Log.** The game log tells everyone that Son showed a hand/card to someone, but never says which card.
9. **Regression.** **Reveal my hand to everyone** still shows the hand to everybody.

Please also watch for anything odd (shared cards stuck after a player leaves, a dialog that will not close).

## Assistant verification

- **Unit tests (Node):** new `test_share_hand` covers the private message going only to the chosen player, log/public view never containing card names, draws/plays/mulligans following, switching, stopping, leaving and reconnecting, host forwarding rules and the receiver's checks (own cards only, size limits, seated sender).
- **Real browsers with a local relay (Chromium, three players):** new `test_share_hand_browser` walks through steps 1–7 and 9, and records everything Mom's browser receives to confirm card names never reach her until Son shares with her. These ran on an assistant machine; sound, real touch and your own hands-on check are still needed.
