# Land placement and stacking — v0.89.0 test copy

To check this copy, extract the ZIP and double-click **index.html**. Start a game (a second private window shows what others see).

1. Put a few lands in your hand (or use a deck with many lands) and **double-click** them one by one. Each goes to the next open space in the **Lands** area, in neat rows.
2. Keep going to 20+ lands, also with a small browser window: none may end up behind your hand and every one can be clicked and dragged.
3. Try both **Sidebar** and **Grid** layouts, and with 3 or 4 players.
4. **Stacking:** Tangled Islet and Temple of Mystery (both G/U) should pile together; basics pile with basics; about six per pile. Each card in a pile shows a strip you can point at.
5. With a full Lands area, the next land snaps onto the most alike land (not attached; drag it away freely). Nothing should land in the Enchantments area.
6. Tell me how hovering stacked lands feels; a better hover preview is not built yet.

## Assistant verification
- New two/three/four-player Chromium test `test_land_placement_browser` also checks the G/U stack and that a red land stays out of it; it passes at 1366×768, 1920×1080, 1366×600 and 1100×560 in Sidebar and Grid: 20 lands fit the Lands area (tall windows), all 26 are above the hand and clickable.
- Unit tests pass. `test_card_placement_browser` and `test_room_vault` fail the same way on unchanged main in this environment.
- **Not tested:** touch, real mouse hover, sound.
