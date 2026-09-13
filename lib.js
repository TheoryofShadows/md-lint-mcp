/**
 * Local Markdown lint helpers. Files only — no network link checks.
 */
import fs from "node:fs";
import path from "node:path";

export function readMarkdown(filePath) {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
  const text = fs.readFileSync(p, "utf8");
  return { path: p, text, lines: text.split(/\r?\n/) };
}

export function extractLinks(text) {
  const links = [];
  // [text](url) — skip images separately tracked
  const re = /(!)?\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    links.push({
      isImage: Boolean(m[1]),
      text: m[2],
      url: m[3].trim().replace(/^<|>$/g, "").split(/\s+/)[0],
      index: m.index,
    });
  }
  // bare angle links <http...>
  const angle = /<(https?:\/\/[^>]+)>/g;
  while ((m = angle.exec(text)) !== null) {
    links.push({ isImage: false, text: m[1], url: m[1], index: m.index });
  }
  return links;
}

export function extractHeadings(lines) {
  const headings = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      headings.push({ level: m[1].length, text: m[2], line: i + 1 });
    }
  }
  return headings;
}

export function checkRelativeLinks(filePath, links) {
  const issues = [];
  const baseDir = path.dirname(path.resolve(filePath));
  for (const link of links) {
    const url = link.url || "";
    if (!url || url === "#") {
      issues.push({
        severity: "error",
        code: "empty-link",
        message: `Empty link target for [${link.text}]`,
        url,
      });
      continue;
    }
    if (/^(https?:|mailto:|tel:|data:)/i.test(url)) continue; // external — not checked (no network)
    if (url.startsWith("#")) continue; // fragment only
    const clean = url.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = path.resolve(baseDir, clean);
    if (!fs.existsSync(target)) {
      issues.push({
        severity: "error",
        code: "broken-relative-link",
        message: `Relative link target missing: ${url}`,
        url,
        resolved: target,
      });
    }
  }
  return issues;
}

export function checkHeadingHierarchy(headings) {
  const issues = [];
  if (!headings.length) {
    issues.push({
      severity: "warning",
      code: "no-headings",
      message: "Document has no headings",
    });
    return issues;
  }
  if (headings[0].level !== 1) {
    issues.push({
      severity: "warning",
      code: "missing-h1",
      message: `First heading is H${headings[0].level}, expected H1`,
      line: headings[0].line,
    });
  }
  let prev = headings[0].level;
  for (let i = 1; i < headings.length; i++) {
    const h = headings[i];
    if (h.level > prev + 1) {
      issues.push({
        severity: "warning",
        code: "heading-skip",
        message: `Heading level jumps from H${prev} to H${h.level}`,
        line: h.line,
        text: h.text,
      });
    }
    prev = h.level;
  }
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length > 1) {
    issues.push({
      severity: "warning",
      code: "multiple-h1",
      message: `Multiple H1 headings (${h1s.length})`,
      lines: h1s.map((h) => h.line),
    });
  }
  return issues;
}

export function checkReadmeIssues(filePath, text, lines) {
  const issues = [];
  const base = path.basename(filePath).toLowerCase();
  if (!/^readme(\.md|\.markdown)?$/.test(base) && !argsIsReadmeHint(filePath)) {
    return issues;
  }
  if (!text.trim()) {
    issues.push({ severity: "error", code: "empty-readme", message: "README is empty" });
    return issues;
  }
  if (lines.length < 5) {
    issues.push({ severity: "warning", code: "short-readme", message: "README is very short (< 5 lines)" });
  }
  if (!/^#\s+/m.test(text)) {
    issues.push({ severity: "warning", code: "readme-no-title", message: "README missing top-level # title" });
  }
  const lower = text.toLowerCase();
  if (!/\blicen[cs]e\b/.test(lower)) {
    issues.push({ severity: "info", code: "readme-no-license-mention", message: "No license mention found" });
  }
  if (!/\binstall\b/.test(lower) && !/\bgetting started\b/.test(lower) && !/\busage\b/.test(lower)) {
    issues.push({
      severity: "info",
      code: "readme-no-install",
      message: "No Install / Getting Started / Usage section keywords found",
    });
  }
  // placeholder smells
  if (/\bTODO\b|TBD|lorem ipsum|your[_-]?name|xxx/i.test(text)) {
    issues.push({ severity: "warning", code: "readme-placeholder", message: "Possible placeholder text (TODO/TBD/lorem/xxx)" });
  }
  return issues;
}

function argsIsReadmeHint(filePath) {
  return /readme/i.test(path.basename(filePath));
}

export function lintMarkdown(args = {}) {
  const filePath = args.filePath;
  if (!filePath) throw new Error("filePath is required");
  const { path: resolved, text, lines } = readMarkdown(filePath);
  const links = extractLinks(text);
  const headings = extractHeadings(lines);
  const issues = [
    ...checkRelativeLinks(resolved, links),
    ...checkHeadingHierarchy(headings),
    ...checkEmptyLinkText(links),
    ...(args.readmeChecks !== false ? checkReadmeIssues(resolved, text, lines) : []),
  ];
  const bySeverity = { error: 0, warning: 0, info: 0 };
  for (const i of issues) bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  return {
    filePath: resolved,
    linkCount: links.length,
    headingCount: headings.length,
    headings,
    issueCount: issues.length,
    bySeverity,
    issues,
    ok: (bySeverity.error || 0) === 0,
  };
}

export function checkEmptyLinkText(links) {
  const issues = [];
  for (const link of links) {
    if (!link.isImage && !(link.text || "").trim() && link.url) {
      issues.push({
        severity: "warning",
        code: "empty-link-text",
        message: `Link has empty text: (${link.url})`,
        url: link.url,
      });
    }
  }
  return issues;
}

export function lintMarkdownTree(args = {}) {
  const root = path.resolve(args.rootPath || args.dirPath || ".");
  if (!fs.existsSync(root)) throw new Error(`Path not found: ${root}`);
  const maxFiles = args.maxFiles ?? 50;
  const files = [];
  function walk(dir) {
    if (files.length >= maxFiles) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= maxFiles) break;
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(md|markdown)$/i.test(ent.name)) files.push(full);
    }
  }
  if (fs.statSync(root).isFile()) files.push(root);
  else walk(root);
  const results = files.map((f) => lintMarkdown({ filePath: f, readmeChecks: args.readmeChecks }));
  return {
    root,
    fileCount: results.length,
    results,
    totalIssues: results.reduce((n, r) => n + r.issueCount, 0),
    filesWithErrors: results.filter((r) => !r.ok).map((r) => r.filePath),
  };
}
