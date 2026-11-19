# Card types and creature types — v0.87.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game (practice is fine) and put cards on the battlefield from a deck; a second player in a private window shows what others see.

1. **Changeling** (Mirror Entity, Changeling Outcast, Chameleon Colossus…): a small **All types** tag on the card. With a card like **"Elves you control get +1/+1"** out (or Jagged-Scar Archers, "power and toughness equal to the number of Elves you control"), the Changeling counts as an Elf.
2. **Type-changing Aura:** attach an Aura that says "is a blue Frog / an Elk / a Treefolk" (Kenrith's Transformation, Lignify, Frogify-style) to an Elf. It gets a **Frog** (or Elk, Treefolk) tag, its base power and toughness change as before, and it **stops being an Elf** (no more Elf lord bonus; one fewer Elf in an Elf count). Detach: the tag goes away and it is an Elf again.
3. **"…in addition to its other types":** Stormtide Leviathan ("All lands are Islands"): every land, yours and the other player's, gets an **Island** tag. Biotransference: your creatures get an **Artifact** tag (and count for "artifacts you control", for example Bronze Guardian). Angelic Destiny: **Angel**.
4. **Permanents:** **Imprisoned in the Moon** / Minimus Containment / In Too Deep / Swift Reconfiguration on a creature: it gets a **Land / Treasure / Clue / Vehicle** tag and is no longer a creature.
5. **Omo, Queen of Vesuva:** a creature with an **everything** counter (use Add counter → custom name "everything") gets **All types**.
6. **Manual on purpose:** "chosen type" cards (Obelisk of Urd, banners), copy effects, one-shot returns, "until end of turn" animation. Tell me if one of these matters to you.
7. Hover a tag: it says which card gives it. Another player sees the same tags and the same numbers.

## Assistant verification
- 34 automatic unit tests pass, including new checks from real wordings (Frogify-style, Kenrith's Transformation, Darksteel Mutation, Lignify, Imprisoned in the Moon, Minimus Containment, Swift Reconfiguration, Angelic Destiny, Stormtide Leviathan, Biotransference, Dune Chanter, Secret Arcade, Arterial Alchemy, Changeling, Omo, Hero of Bretagard) and on boards (supertypes kept, the type order, an Elf turned Frog stops being an Elf, a Changeling counts as an Elf).
- New two-player Chromium test `test_types_browser`: Changeling tag and Elf-lord bonus, Elf count including the Changeling, a Frog Aura (tag, base 1/1, not an Elf any more, Elf count drops), Stormtide Leviathan tagging both players' lands, Imprisoned in the Moon turning a Bear into a Land, nothing saved on the cards.
- 49 pre-con cards with such text are read (26 are Changelings); the other 24 are the manual ones above.
- **Not tested:** touch, the Grid layout, more than two players, real card pictures.
