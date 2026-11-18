# Summoning sickness icon — v0.80.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game covers most of this; a second player (private window) shows what others see.

1. Play a creature: a small gold **Zz** appears beside it (and on the other player's screen). Play a **land**: nothing. Play a **Vehicle**: Zz. Play a creature **face down**: Zz.
2. **Tap** the creature: the Zz disappears. **Untap** it: it comes back (it is still sick).
3. Play a creature that has **haste** (printed): no Zz. Give a sick creature **Temporary haste** (right-click, Temporary, Statuses & abilities until end of turn, Haste): the Zz hides; when the turn passes it is no longer hidden. Attach **Lightning Greaves** (or any "equipped creature has haste" card): the Zz hides; unattach it and it returns.
4. **Pass the turn**, and in the other player's turn check your creature is **still** sick. Let them play a creature in their turn. When the turn comes back to **you**, your creatures lose the Zz, but theirs keep it until **their** next turn begins.
5. **Give control** of a not-sick creature to the other player: it becomes sick on their board. They **Return control**: it is sick again on yours.
6. Right-click a creature, **Statuses & abilities…**: **Summoning sick** is ticked. Untick it: gone for everyone. Tick it: back. (It is not offered under Temporary.)
7. Check the wordings now read as haste: a card with "Creature tokens you control have haste" (Brudiclad) or "Commander creatures you control get +2/+2 and have haste" (Bloodsworn Steward).
8. Right-click a land → Statuses & abilities → tick **Summoning sick** by hand. Pass the turn and get your next turn back: it comes off by itself, even though you ticked it.
9. Click the small **▾** next to **Pass turn** → **Take an extra turn**. You stay the active player, the round number does not go up, you untap/draw, and the Zz on creatures you played this turn disappears.
10. Tell me: is the Zz size and place OK? Is it too much noise on a busy board? Any effect it gets wrong (for example a one-turn haste spell)?

## Assistant verification
- All 30 automatic unit tests pass, including new checks for the two new haste wordings (tokens, commander creatures, the anthem with a keyword).
- New two-player Chromium test `test_summoning_sick_browser` (local relay): creatures, Vehicles and face-down creatures are marked, lands and Equipment are not; hidden while tapped, and with printed, temporary or granted haste (and back when those end); ticked and editable in the Statuses window, not offered as temporary; still sick on the opponent's turn; cleared exactly when the controller's own next turn begins, not by someone else's turn; and giving control away and back makes it sick again. It also caught a real ordering bug (the sick status stopped printed haste from turning on), now fixed. I looked at screenshots of the icon on cards and the Statuses window.
- **Not tested:** real card images, a phone, touch, and the Grid layout (including how the new ▾ button fits there; it only appears once the game has started); an extra turn does not change player order (it is just the same player again).
