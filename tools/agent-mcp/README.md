# Commander Table MCP agent

This companion MCP server lets an AI agent control one normal Commander Table player seat. It uses the game's browser client for networking, private hand state, and table updates; the server does not implement a second game protocol.

## Requirements

- Node.js 18 or newer. The server uses only built-in Node modules; it does not need npm packages.
- An MCP client that can start a local stdio server.
- A browser tab served from this local server. The game's online connection still uses the configured Commander Table relay.

## Configure an MCP client

Add this server to the MCP client's configuration, using the full path to this repository's `tools/agent-mcp/server.mjs`:

```json
{
  "mcpServers": {
    "commander-table": {
      "command": "node",
      "args": ["C:\\path\\to\\Commander-Table-Home\\tools\\agent-mcp\\server.mjs"],
      "env": { "CT_AGENT_PORT": "8787" }
    }
  }
}
```

Restart or reload the MCP client. Then open `http://127.0.0.1:8787/index.html?agent=1` in a browser tab. Join the same room as a regular player, choose a deck, and keep the tab open. The MCP `agent_status` tool reports when the seat is connected and ready.

Use `CT_AGENT_PORT` to choose a different local port if 8787 is occupied. The browser URL must use `127.0.0.1` or `localhost` and the same port. The HTTP server binds only to `127.0.0.1`; it does not expose the game or MCP tools to the network.

## Tools

- `agent_status` — connection and seat status.
- `observe_game` — own hand and zones, public table state, recent log and chat. Opponent hand and library identities are omitted.
- `send_chat` — send a message to everyone at the table.
- `draw_cards` — draw one to five cards into your own hand.
- `move_card` — move your own card between hand, battlefield, graveyard, exile, and command.
- `tap_card` and `untap_all` — update your battlefield.
- `pass_turn` — pass when it is your turn.

Commander Table is a freeform tabletop, so the tools do not check whether a move follows Magic rules or pays its costs. The agent should reason about legality, explain plans in room chat, and ask you before choices that belong to you. Do not give an agent this MCP server if you only want it to observe.

Each server process controls one connected game tab. To use more than one agent, run another MCP server on a different port and open another `?agent=1` tab for its seat.
