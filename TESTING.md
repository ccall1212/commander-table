# Reminders: keyword abilities — v0.70.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed.

1. Play **Gyre Sage**: its box in Reminders (**From the table**) should now show **Evolve** (highlighted in blue) with its rules text.
2. Try other cards of yours with keyword triggers: Exalted, Prowess, Battle cry, Annihilator, Extort, Persist/Undying, Afterlife, Mentor, Myriad, Cascade. Each should appear with its keyword highlighted.
3. Plain keywords (Flying, Vigilance, Trample, Ward) should NOT appear.
4. Tell me which cards still show nothing in Reminders that you expected, with their names, and I will add those keywords.

## Assistant verification
- Unit tests (`test_reminders`) cover Evolve as printed on Gyre Sage, keywords sharing a line, Annihilator with a number, opponents' cards, and plain keywords being left out; all 26 automatic test files pass.
- Real browser (two players): `test_reminders_browser` plays a Gyre Sage-style card and checks the box and the highlight.
- Not tested: real Scryfall text for each keyword card.
