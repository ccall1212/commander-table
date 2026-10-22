# Entry color choices and UI polish — v0.47.0 test copy

Extract the ZIP and double-click **index.html**; no terminal or local server is needed. This change has not been published.

1. Host a game. Under the opening rule, confirm the heading reads **Would you like to turn on auto-actions?** and Auto-Draw and Auto Untap All can still be chosen independently. Cancel, then join or host again and check the same wording in the Join flow.
2. At **Choose your player color**, confirm ten choices appear: the original six plus **Orange**, **Pink**, **Lime** and **White**. Pick a new color. A second player should see that color as taken and be able to choose another. The room still allows the same number of players.
3. In a game with two players, use **In response!** and draw a targeting arrow. Both should use the initiating player's selected color. Check Sidebar and Grid if possible.
4. Move a mouse over **↶ Undo**. Its yellow hover border should be complete on all four sides, including next to the ▾ history button. Hover ▾ separately and check its border too; keyboard focus should also show the full border.
5. On a smaller screen, confirm the color picker can scroll to every option and its Cancel button.

The separate iPhone Touch mode height fix remains in PR #69. This copy starts from published v0.46.1; if PR #69 publishes first, this branch will be refreshed before it is published. Paused draft PR #11 is untouched.

## Assistant verification

Chromium over localhost HTTP checked the Host and Join auto-action heading, ten picker choices and new color selection at 1366×768, 844×390 and 390×844, and the full Undo/history yellow hover border at 1366×768. No page errors occurred. Color, response and targeting unit checks pass, along with changed JavaScript syntax and diff whitespace checks. Live multiplayer response/arrow appearance, real iPhone Safari and direct file:// opening remain for Chris to check. Chris has not reported hands-on testing of this copy yet.
