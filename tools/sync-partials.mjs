// Stamps the shared markup in partials/ into every page, between markers:
//   <!-- partial:header --> ... <!-- /partial:header -->
//   <!-- partial:cta label="Explore Assets" href="assets.html" --> ... <!-- /partial:cta -->
// Pages stay plain static HTML; run this after editing a partial.
// Usage: node tools/sync-partials.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const pages = readdirSync(root).filter((f) => f.endsWith(".html"));
let stale = 0;

for (const page of pages) {
  const path = join(root, page);
  const before = readFileSync(path, "utf8");
  const after = before.replace(/<!-- partial:([a-z-]+)((?: [a-z]+="[^"]*")*) -->[\s\S]*?<!-- \/partial:\1 -->/g, (whole, name, attrs) => {
    const file = join(root, "partials", name + ".html");
    if (!existsSync(file)) return whole;
    let html = readFileSync(file, "utf8").trim();
    for (const [, key, value] of attrs.matchAll(/ ([a-z]+)="([^"]*)"/g)) html = html.split("{{" + key + "}}").join(value);
    // On the landing page the logo scrolls back to the hero instead of reloading.
    if (name === "header" && page === "index.html") html = html.replace('href="index.html" aria-label="TRONAUT home"', 'href="#hero" aria-label="TRONAUT home"');
    return `<!-- partial:${name}${attrs} -->${html}<!-- /partial:${name} -->`;
  });
  if (after !== before) {
    stale++;
    if (check) console.error(`${page} is out of date with partials/`);
    else { writeFileSync(path, after); console.log(`updated ${page}`); }
  }
}
if (check && stale) process.exit(1);
if (!stale) console.log("partials in sync");
