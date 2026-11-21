# Testing the MCP agent

This test copy needs an MCP client to start the local server. It cannot be tested by double-clicking `index.html` alone.

1. Configure the MCP server from `tools/agent-mcp/README.md` in an MCP client that has Node.js 18+ available, then restart that client.
2. Open `http://127.0.0.1:8787/index.html?agent=1` in a browser. Host a game there, or join your existing room with a second player seat. Choose a deck and keep this tab open.
3. In the MCP client, call `agent_status`, then `observe_game`. Confirm the agent's own hand appears and other players' hand/library identities do not.
4. Use `send_chat` to send a plan; confirm it appears in room chat. Reply in the game's chat and call `observe_game` to read your response.
5. Try `draw_cards`, `move_card` with one of the agent's card ids, and `tap_card` on one of its battlefield cards. Confirm the game updates normally for the other player. Use `pass_turn` on the agent's turn.
6. Close the browser tab and call `agent_status` again. It should report that the game tab is disconnected.

The action tools do not enforce Magic rules or mana costs. Do not use a game you care about for testing.
