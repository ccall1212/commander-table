# Zz on the card + more Reminders — v0.81.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. A practice game covers most of this; a second player (private window) shows what others see.

## Zz on the card
1. Play a creature: the small gold **Zz** now sits **on the card**, in the middle under any word tags (Suspected, Prepared), instead of hanging off the card's edge. Give it **Suspected** from Statuses & abilities to compare. Other ability icons (Flying etc.) still hang outside.
2. Tap it: the Zz disappears. Haste: no Zz. Pass the turn and come back: it is gone. (Same rules as v0.80.0.)

## More Reminders (open the 📝 Reminders tab)
3. Play a **Siege** (e.g. Outpost Siege): choose Khans or Dragons. The chosen mode's line shows in the panel (it used to be missing).
4. Play a creature with a named ability that has punctuation, such as **Company Commander** ("Bring it Down! —") or **The Tenth Doctor** ("Allons-y! —"): its trigger is listed.
5. Put an **Aura or Equipment that gives a trigger** on a creature (e.g. Bear Umbra, Power Fist, The Sword of Kahless): its line is listed, under the right turn step.
6. Keywords: **Zurgo Stormrender** (Mobilize), **Bear Umbra** (Umbra armor), **Tovolar's Huntmaster** (Daybound/Nightbound), **Jötun Grunt** (Cumulative upkeep) each show a line.
7. Put a card with **Retrace** (e.g. Worm Harvest) in your graveyard: it shows under "Playable from graveyard / exile". Tell me if you see something different, and where the card was (hand, graveyard, battlefield).
8. A Saga chapter line like "II, III — Whenever…" should **not** appear twice.

## Assistant verification
- 30 automatic unit tests pass, including new checks for each reminder form above.
- I read every card of the 158 pre-cons (rules text from Scryfall) and compared old and new reminder results: 52 cards gain a reminder (list in the chat message).
- Two-player Chromium tests for summoning sickness and reminders pass.
- **Not tested:** real card images, touch, and the Grid layout.
