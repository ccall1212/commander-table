# Moderation and room recovery — v0.34.0 test copy

Extract the ZIP and double-click **index.html**, with internet access. No terminal or installation is needed. All players should use this copy.

**Server prerequisite:** the relay must advertise `room-vault-v1`. The server-only companion PR must be approved, deployed through Workers Builds and checked before the fresh-browser steps below can work against the normal online room. Until then this copy reports room backup unavailable; do not treat it as recovery-ready on the live server. A local assistant test used the actual new Worker in Miniflare, not the current production server.

## Click list

Use host, delegate, owner and replacement players. Check Sidebar and Grid at 1920×1080 and 1366×768.

1. Right-click a player name as host → Grant moderator permissions. Delegate can restore concessions, kick, or transfer boards. Ordinary players cannot. Only host grants/revokes; revoke and confirm controls disappear.
2. Start, concede as guest, restore as host/delegate. Turn eligibility returns without rewinding turns. Try all-conceded too.
3. Close a guest tab, reopen in the same browser, dismiss Resume, then Join the same room. Resume must retain the exact board without a new participant. Dismiss must not delete saved data.
4. Play cards on an owner's board; adjust life, counters/P/T and reveal one hand/top card. Menu → Choose / recover a board… → wait for **Saved to room**. Verify the host also sees saved status.
5. **Incognito regression:** close every window in that owner's private-browser session. Open a new private session, join the room with the same name. Choose **Request this board**; host/delegate sees **Review** and must approve **Assign board**. No duplicate seat should appear. Battlefield, private hand, library order, commander, life and adjustments must return. Ordinary players must not see hidden cards.
6. For connected force transfer: moderator → Transfer this board… → connected empty recipient. Owner need not approve. Recipient needs empty battlefield/graveyard/exile with no cards controlled elsewhere. Their previous board/deck is kept locally; transferred references follow the new owner. Host's own board cannot be source.
7. Reload the recipient, then new game: transferred deck works. Undo and arrows clear at handoff. Cancel a request/handoff and check no seats disappear. An unavailable backup must explain the problem and leave seats intact.
8. Kick guest as delegate: lobby opens and that identity cannot re-seat on reconnect; host cannot be kicked. Other players can continue. Delegating does not migrate the network host.

## Verification and limits

- Automated moderation checks cover host/delegate/member authorization, restore/kick, private seat authentication, host-ID spoof rejection, validated private boards, reference remapping and saved-session boundaries. Existing token/targeting/P/T suites pass.
- Actual Chromium HTTP + local Cloudflare-compatible SQLite Durable Object checks passed: destroy the entire original browser context, fresh same-name claim, moderator approval, full hidden hand/library order, battlefield/life/P/T/top-reveal restore, no duplicate, guest vault denial, recipient save/reload, saved status and Sidebar/Grid at both sizes. The test waits for the completed server save before closing. No page errors observed.
- Actual Miniflare integration checks cover storage across Worker restart, concurrent/large Unicode saves, stale revision protection, access denial, TTL, delete/clear and protocol compatibility. These do not establish live deployment.
- Earlier four-player real-production-relay HTTP checks passed local-only delegation, restore, kick and connected/private same-browser handoffs. The new server-backed flow still needs the production capability and Chris's hands-on testing. Chris's earlier incognito test failed with the old local-only copy; that limitation prompted this revision.
- Private boards are readable by the host and room service, not ordinary players. Saves expire 24 hours after completion. Closing before completion can lose recent changes. Lost data from before this feature cannot be recovered. Host identity migration is outside this feature.
- Managed Chromium blocks `file://`; assistant tests used HTTP. Chris's extract/open and real-device checks remain pending. GPT-6 Luna performed bounded investigation/review/server tests; primary implemented and browser-tested.

Includes published v0.33.1 chat/arrows. Independent mulligan, color, Deck Builder checks and Collection backup proposals are not bundled. PR #11 remains paused. Publication is not approved.
