# Big power/toughness and temporary Set power/toughness — v0.66.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. No terminal or local server is needed. Two players are best.

1. **Big numbers.** Put a creature on the battlefield, right-click it → **Power / Toughness** → **Set power/toughness…**, type **10000/7** and press Enter. The badge should show **10000** and **7**, fully readable and not cut off. The other player should see it too.
2. Try a negative and a very large value (**-5/999999**). A value with seven digits (**1000000/1**) should be refused with a message.
3. **Temporary set.** Select two or three creatures (drag a box), right-click one → **Temporary (until end of turn)** → **Set power/toughness until end of turn…**, type **0/1** (or any value). All selected cards should show it with the light-blue temporary outline. Counters, +1/+1 temporary effects and manual changes still apply on top.
4. **End of turn.** Pass the turn: the set values go away and the cards return to their normal power and toughness. A **permanent** Set power/toughness (step 1) should stay.
5. **Clear.** **Clear temporary effects** in the same menu removes it early. Undo reverses a group set in one step.
6. Please tell me if you want the typed value to also replace the card's printed numbers in the hover preview text, or if the badge is enough.

## Assistant verification

- **Unit tests (Node):** all 24 automatic test files pass.
- **Real browsers (Chromium, two players):** new `test_big_power_browser` sets 10000/7 through the menu, checks the badge, what the other player sees, and the 6-digit limit; `test_temporary_effects_browser` now also types a temporary 10000/7 on a three-card selection, checks 10001/8 with a temporary +1/+1, and that everything is gone when the turn passes. I looked at a screenshot of the wider badge.
