#!/usr/bin/env node
/**
 * @mcpx-digital/md-lint — MCP server for local Markdown linting.
 * Broken relative links, heading hierarchy, empty links, README smells.
 * Local files only — does not HTTP-check external URLs.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { lintMarkdown, lintMarkdownTree } from "./lib.js";

const LOCAL =
  "Local files only. Relative links are checked on disk; external http(s) links are not fetched.";

const TOOLS = [
  {
    name: "lint_markdown",
    description:
      "Lint a Markdown file for broken relative links, heading hierarchy, empty links, and common README issues. " +
      LOCAL,
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to a .md file." },
        readmeChecks: {
          type: "boolean",
          description: "Enable README-specific heuristics (default true for README* names).",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "lint_markdown_tree",
    description: "Lint all Markdown files under a directory (skips node_modules/.git). " + LOCAL,
    inputSchema: {
      type: "object",
      properties: {
        rootPath: { type: "string", description: "Directory or file to scan." },
        dirPath: { type: "string", description: "Alias for rootPath." },
        maxFiles: { type: "number", description: "Max files (default 50)." },
        readmeChecks: { type: "boolean" },
      },
      required: ["rootPath"],
    },
  },
];

const handlers = {
  lint_markdown: lintMarkdown,
  lint_markdown_tree: lintMarkdownTree,
};

const server = new Server(
  { name: "md-lint", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  const handler = handlers[name];
  if (!handler) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }
  try {
    const result = await handler(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
