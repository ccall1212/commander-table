# Graveyard reminders — v0.90.2 test copy

To check this copy, extract the ZIP and double-click **index.html**.

1. Put **Evolution Witness** in your graveyard. The Reminders panel should **not** list it under "Playable from graveyard / exile".
2. A card that really can be used from the graveyard should still appear there: for example one with **Flashback**, **Escape**, **Retrace**, "You may cast this card from your graveyard", or a card like **Bloodghast** ("you may return Bloodghast from your graveyard to the battlefield").
3. Tell me if any graveyard card shows up that should not, or one that should is missing.

## Assistant verification
- `test_reminders` (unit) now checks Evolution Witness's wording (with its name and with "this creature") gives no graveyard line, and that Bloodghast, "Exile this card from your graveyard" and "You may cast this creature from your graveyard" still do. All other unit tests and the two reminders browser tests pass.
- **Not tested:** every card with graveyard abilities, only the wordings above.
