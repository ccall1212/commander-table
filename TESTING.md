# Reminders: replacement effects and cost changes — v0.71.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough.

1. Play **Hardened Scales**: its box in Reminders (**From the table**) should show "If one or more +1/+1 counters would be put on a creature you control, that many plus one +1/+1 counters are put on it instead."
2. Try **Doubling Season**, **Winding Constrictor**, **Panharmonicon**, **Rest in Peace**, and a cost reducer such as **Goblin Electromancer** or a cost increaser such as **Thalia, Guardian of Thraben**: each should list its line.
3. Cards with an ordinary "If you control a Forest, …" line should NOT be listed just for that.
4. Tell me which cards still show nothing that you expected, with their names.

## Assistant verification
- Unit tests (`test_reminders`) cover Hardened Scales, Doubling Season (two lines), Panharmonicon, cost reduction/increase, an ordinary "If" line being left out, and opponents; all 26 automatic test files pass.
- Not tested: real Scryfall text for each card.
