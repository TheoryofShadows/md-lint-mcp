# @mcpx-digital/md-lint

**MCP server that lints local Markdown for broken relative links, heading hierarchy, empty links, and common README issues.**

> **Local files only.** Relative targets are checked on disk. External `http(s)` links are **not** fetched (no scraping, no network link checks).

## Install (MCPX / npx)

```bash
npx -y @mcpx-digital/md-lint
```

> Prepared for npm as `@mcpx-digital/md-lint`. Until published, run from a local clone.

## Cursor `mcp.json` example

```json
{
  "mcpServers": {
    "md-lint": {
      "command": "npx",
      "args": ["-y", "@mcpx-digital/md-lint"]
    }
  }
}
```

Local clone:

```json
{
  "mcpServers": {
    "md-lint": {
      "command": "node",
      "args": ["/absolute/path/to/md-lint-mcp/index.js"]
    }
  }
}
```

## Tools

| Tool | What it does |
|------|----------------|
| `lint_markdown` | Lint one `.md` file |
| `lint_markdown_tree` | Lint Markdown files under a directory |

### Checks

- Broken **relative** links / images (filesystem)
- Empty link targets or empty link text
- Heading hierarchy (missing H1, level skips, multiple H1)
- README heuristics (short/empty, missing install/license keywords, placeholders)

## Example prompts

- “Lint README.md for broken links and heading issues”
- “Scan docs/ for Markdown problems”

## Development

```bash
git clone https://github.com/TheoryofShadows/md-lint-mcp.git
cd md-lint-mcp
npm install
npm test
node index.js
```

## Sell / list on MCPX

Suggested listing price: **$5**.

Install command: `npx -y @mcpx-digital/md-lint`

## License

MIT © TheoryofShadows
