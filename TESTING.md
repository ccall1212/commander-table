# Shroud icon and Shroud of Protection — v0.77.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough.

1. Right-click a creature -> **Statuses & abilities…**: the **Shroud** icon is now a **hooded figure with its face covered**. Tick it and check it on the card.
2. Play **Shroud of Protection** ("Other enchantments you control have shroud") and a couple of other enchantments, plus a creature, a land and an artifact. Only your **other enchantments** should show Shroud (dotted green ring; hover shows who owns the card). Not Shroud of Protection itself, not the creature/land/artifact, and not another player's enchantments.
3. Try other cards of yours that say "Artifacts you control have…" or "Other permanents you control have…". Tell me which cards did not work, with their names.

## Assistant verification
- All 28 automatic unit tests pass, with new checks for Shroud of Protection's wording, artifacts/lands/permanents/nonland permanents, "Other" excluding the card itself, and an Enchantment Creature counting as an enchantment.
- Two-player Chromium test: Shroud of Protection gives Shroud to my other enchantment on both screens, and not to itself, a creature, or the other player's permanents. I looked at a screenshot of the new icon.
- Not tested: real Scryfall text for the real cards.
