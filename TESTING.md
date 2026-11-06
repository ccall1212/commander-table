# Granted abilities: Equipment, Auras, everyone, opponents — v0.74.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. Two players (a private window) show what others see.

1. **Equipment.** Play a Sword-style Equipment ("Equipped creature gets +2/+2 and has trample") and a creature. Not attached: nothing. **Attach** it to the creature: the creature shows **Trample** with a dotted green ring (hover: "Granted by …"). Unattach: it goes away. Try attaching to a creature of the other player.
2. **Aura.** Same with an Aura ("Enchanted creature has flying").
3. **Everyone.** Play a card like "All creatures have haste": every creature on every board shows Haste (dotted).
4. **Opponents.** Play a card like "Creatures your opponents control have defender" (for example Test Wall): only the other players' creatures show Defender, not yours.
4b. **Hover** a granted icon: a small box names the ability, the card granting it, and the **owner's name in their player colour**. In the **Reminders** panel an opponent's name next to their card should also be in their colour.
5. In **Statuses & abilities** on an affected creature the granted ability is ticked; untick to switch it off for that creature.
6. Tell me which Equipment/Auras (names) did not work. The +N/+N part is not applied yet.

## Assistant verification
- All 28 automatic unit tests pass; `test_grants` now covers Equipment/Aura wording (including ones to ignore: bare +N/+N, Ward, quoted abilities), "All/Each/Other creatures", tribes, opponents, attachment to a creature on another board, and unattached cards granting nothing.
- Two-player Chromium test `test_grants_browser` covers a Sword on my creature, an Aura on the other player's creature, unattaching, "All creatures have haste" and an opponent-only card, checked on both screens.
- Not tested: real Scryfall wording of real cards; real mouse use of Attach.
