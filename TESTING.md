# Arrow source highlighting — v0.48.0 (Objective #50)

Published in v0.48.0 through PR #71 after Chris approved the number-free highlight. For a local check, extract the ZIP and double-click **index.html**.

1. With two players, draw one arrow from a battlefield card to another card or player. Its source card should have a thin outline in your player color, and a colored circle should sit where the line leaves it. The line still follows both cards as boards move or resize.
2. Draw two or more arrows, including from the same card. All source circles and outlines should identify their starting points without numbers on the board. Remove an arrow by clicking/tapping its line; the others should remain.
3. Have the second player draw an arrow in their own color. Check both Sidebar and Grid, and try viewing the opponent's board; the outlines and source circles should follow the right cards. Try an arrow from a player's name or empty board area, which should get a source circle but no card outline.
4. Confirm a card under an arrow can still be used normally and a line can still be removed by keyboard (Tab, then Enter or Space). On touch, check that the line remains easy to tap.

## Assistant verification

Node targeting regression and JavaScript syntax checks pass. Chromium on the local app at 1366×768 rendered two source outlines and unnumbered circles in the player color, confirmed no number text, click-through circles, active line hit targets, individual removal, and no page errors. The check used a solo board with three visible test cards and a simulated public copy. Chris tested the first copy and liked the highlighting, then requested removal of the numbers and approved publication of the revision. Multiplayer, Sidebar/Grid switching, and real touch behavior still need Chris's review.

Objective #18's separate iPhone Touch mode fix remains open in PR #69. Paused draft PR #11 is untouched.
