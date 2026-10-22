# Opening-hand roster — Objective #41, v0.43.0

Extract the ZIP and double-click **index.html**. No terminal or installation is needed. For multiplayer, use two browsers/devices with internet access and this same copy.

## Click list

1. Host and join with two players. The top bar shows **Hands ready: 0/2**, without inline player names or long waiting sentences. The opening rule is still available before Start.
2. Click **Hands ready** on either screen. The **Opening hands** dialog lists both names with **Choosing**. Close it with X or Esc; keyboard focus returns to Hands ready. Enter also opens the focused button.
3. Keep one hand while the other screen's roster is open. That player's row changes to **Ready** and the button to **1/2**. Start stays disabled. With Draw 10, bottom 3, selecting Keep alone does not count until the bottom cards have been chosen.
4. Keep both hands. The button shows **2/2** and the host can Start. The readiness button, rule label and any open readiness dialog disappear on both screens after Start. Battlefield moves are still blocked before Start.
5. Try Sidebar and Grid at both 1920×1080 and 1366×768. The roster should be compact, readable and inside the screen. New Game returns everyone to **0/2** and restores the opening rule.

## Verification

- Assistant code checks pass: changed JavaScript/test syntax, opening readiness, mulligan rules, personal Undo, response cues, player colors, version/cache links and diff checks.
- Actual two-player Chromium checks pass over localhost HTTP with the unchanged Worker in local Miniflare. Sidebar and Grid at 1920×1080 and 1366×768 cover compact wording, no top-bar collisions, roster bounds, keyboard Enter/Esc and focus return, live Choosing → Ready updates, Draw 10 bottoming, Start guards, pre-start battlefield blocking, reload, automatic dialog close after Start, hidden in-game rule/readiness controls and New Game reset. Start is clicked at 1366×768 in Grid. No page errors. Settled screenshots were visually reviewed.
- Assistant tests use HTTP; Chris's extract-and-double-click flow is above. No real-device Safari test is claimed. No relay/protocol code changed.

Chris has not tested this redesign yet; publication is awaiting his approval. Paused draft PR #11 remains untouched.
