# Arrow sources and order — v0.48.0 test copy (Objective #50)

Extract the ZIP and double-click **index.html**. The change is on a test branch and is not published to the live site yet.

1. With two players, draw one arrow from a battlefield card to another card or player. Its source card should have a thin outline in your player color, and a colored circle should sit where the line leaves it. The line still follows both cards as boards move or resize.
2. Draw two or more arrows, including from the same card. Each source circle and the middle of its line should show matching **1**, **2**, and so on in the order you drew them. Remove an arrow by clicking/tapping its line; the remaining numbers should close the gap. The numbers show drawing order, not combat damage order.
3. Have the second player draw an arrow in their own color. Check both Sidebar and Grid, and try viewing the opponent's board; the outlines and numbers should follow the right cards and remain legible. Try an arrow from a player's name or empty board area, which should get a source circle but no card outline.
4. Confirm a card under an arrow can still be used normally and a line can still be removed by keyboard (Tab, then Enter or Space). On touch, check that the line remains easy to tap.

## Assistant verification

Node targeting regression and JavaScript syntax checks pass. Chromium on the local app at 1366×768 rendered one arrow's outline and unnumbered source circle, then two arrows with matching source/line numbers and player color. It confirmed line hit targets remain active, number badges are click-through, and numbers disappear again after removing one arrow. No page errors occurred. The browser check used a solo board with three visible test cards and a simulated public copy; multiplayer, Sidebar/Grid switching, and real touch behavior still need Chris's review.

Objective #18's separate iPhone Touch mode fix remains open in PR #69. Paused draft PR #11 is untouched.
