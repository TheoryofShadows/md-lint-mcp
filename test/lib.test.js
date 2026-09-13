import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractLinks,
  extractHeadings,
  checkHeadingHierarchy,
  lintMarkdown,
  lintMarkdownTree,
} from "../lib.js";

describe("extractors", () => {
  it("extracts links and images", () => {
    const links = extractLinks("[a](./x.md) ![img](./y.png) [](./z.md) <https://ex.com>");
    assert.ok(links.some((l) => l.url === "./x.md" && !l.isImage));
    assert.ok(links.some((l) => l.isImage));
    assert.ok(links.some((l) => l.url === "https://ex.com"));
  });
  it("extracts headings skipping fences", () => {
    const lines = ["# Title", "```", "# not", "```", "## Sub"].join("\n").split("\n");
    const h = extractHeadings(lines);
    assert.equal(h.length, 2);
    assert.equal(h[0].level, 1);
    assert.equal(h[1].level, 2);
  });
});

describe("heading hierarchy", () => {
  it("flags skip", () => {
    const issues = checkHeadingHierarchy([
      { level: 1, text: "A", line: 1 },
      { level: 3, text: "B", line: 2 },
    ]);
    assert.ok(issues.some((i) => i.code === "heading-skip"));
  });
});

describe("lintMarkdown integration", () => {
  let dir;
  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "md-lint-"));
    fs.writeFileSync(path.join(dir, "ok.md"), "# Ok\n\nSee [here](./other.md).\n");
    fs.writeFileSync(path.join(dir, "other.md"), "# Other\n");
    fs.writeFileSync(
      path.join(dir, "bad.md"),
      "## No H1\n\n[missing](./nope.md)\n[](./other.md)\n",
    );
    fs.writeFileSync(
      path.join(dir, "README.md"),
      "# Project\n\nTODO stuff\n\n## Install\n\nnpm i\n\n## License\n\nMIT\n",
    );
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("ok file passes relative links", () => {
    const r = lintMarkdown({ filePath: path.join(dir, "ok.md") });
    assert.equal(r.ok, true);
  });

  it("bad file reports broken link and heading issues", () => {
    const r = lintMarkdown({ filePath: path.join(dir, "bad.md") });
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => i.code === "broken-relative-link"));
    assert.ok(r.issues.some((i) => i.code === "missing-h1" || i.code === "empty-link-text"));
  });

  it("readme checks", () => {
    const r = lintMarkdown({ filePath: path.join(dir, "README.md") });
    assert.ok(r.issues.some((i) => i.code === "readme-placeholder"));
  });

  it("tree lint", () => {
    const r = lintMarkdownTree({ rootPath: dir });
    assert.ok(r.fileCount >= 3);
  });
});
