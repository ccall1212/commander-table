# Opening-hand rules — v0.35.0 test copy

Download the ZIP, extract it, and double-click **index.html**. Keep internet access on. No terminal or local server needed. Use two players on this copy.

## Click list

1. Before hosting, choose **Opening hand rule**: London (normal Commander first mulligan free), **At least 3 lands**, or **Draw 10, bottom 3**. Join with a second player; both must see/use the host's rule.
2. London: begin with seven. First mulligan is free; later keeps bottom one more card. After seven mulligans, Mulligan must disable and Keep must remain usable.
3. At least 3 lands: seven-card opening/mulligan hands include three randomly selected front-face Lands plus four random remaining cards. With fewer than three lands in the deck, the prompt should explain the fallback and still allow keeping. This house rule counts printed front-face Lands, not a land on a card's back face.
4. Draw 10, bottom 3: both players draw ten; Keep asks you to choose exactly three to put on the bottom. Short decks never require bottoming every card.
5. Before starting, the host can change the rule. Cancel must preserve existing hands; confirm must reshuffle/redeal everyone, including a player who already kept. Once the game starts, that rule control is unavailable. Start a new game to choose again; new games retain the selected policy by default.
6. Reload/reconnect a guest: their exact opening hand must stay intact rather than redeal. Check Sidebar/Grid at roughly 1920×1080 and 1366×768, and a narrow window: the opening-hand prompt should wrap and its buttons remain reachable.

## Verification

- GPT-6 Luna implemented and ran actual two-player Chromium over localhost HTTP checks: all three initial policies for host/guest, private-hand boundaries, exact reload/deal persistence, cancelled/confirmed pregame rule changes, ten-card bottom-three, changing rules after a keep, seven-mulligan cap, started-game rejection, newgame policy persistence, both layouts at both sizes and 320px prompt bounds. No page errors observed.
- Browser checks caught and fixed top-bar crowding at 1366px and a narrow prompt overflowing left. A forged higher-revision guest table-sync message cannot change the host's selected rule/deal identifier.
- Node rule regressions cover default sanitation, all modes, cap, short decks, impossible land counts, front-face classification, keep/bottom counts, host authority and deal reconciliation. Existing Node suites, changed JavaScript syntax and diff checks passed.
- Chris requested the feature; hands-on review and publication approval are pending. Managed Chromium blocks file:// navigation, so the assistant browser checks used HTTP. Real-device Safari/touch and extracted-copy flow still require appropriate checks.

Includes published v0.33.1 chat and arrow fix. This independent proposal does not include the pending moderation, Deck Builder checks or backup proposals. PR #11 remains paused. Nothing here is approved for publication.
