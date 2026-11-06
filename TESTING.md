# Shroud ability — v0.76.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game is enough.

1. Right-click a creature -> **Statuses & abilities…**: **Shroud** (an eye with a slash through it) is in the Abilities list, between Shield and Trample. Tick it: the icon shows beside the card; hover it for "Can't be the target of any spells or abilities".
2. Play **Lightning Greaves** and attach it to a creature: the creature should show **Haste** and **Shroud** with the dotted green "granted" ring (hover: who owns the card). Unattach: both go away.
3. A creature whose card starts with "Shroud" gets the icon when it enters the battlefield.
4. Tell me if the icon should look different.

## Assistant verification
- All 28 automatic unit tests pass, including checks that "Equipped creature has haste and shroud" (Lightning Greaves) is read and that a printed Shroud is recognised.
- Two-player Chromium test: Lightning Greaves attached to the other player's creature shows Shroud on both screens; the statuses browser test passes. I looked at a screenshot of the new icon in the Statuses window.
- Not tested: real Lightning Greaves card text from Scryfall.
