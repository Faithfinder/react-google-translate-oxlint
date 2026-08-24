import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// `plugin.meta.version` is what oxlint reports; nothing keeps it in step with
// the published version except this.
test("the plugin reports the package version", async () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const { default: plugin } = await import(join(root, "index.js"));
  assert.equal(plugin.meta.version, pkg.version);
  assert.equal(plugin.meta.name, "react-google-translate");
});

// Every rule needs a docs URL and a schema, or oxlint users get neither help
// text nor validation of the options they pass.
test("every rule is fully described", async () => {
  const { default: plugin } = await import(join(root, "index.js"));
  for (const [name, rule] of Object.entries(plugin.rules)) {
    assert.ok(rule.meta.docs.description, `${name} has no description`);
    assert.match(rule.meta.docs.url, /\/docs\/rules\/.+\.md$/, `${name} docs url`);
    assert.ok(Array.isArray(rule.meta.schema), `${name} has no schema`);
    assert.equal(rule.meta.hasSuggestions, true, `${name} offers no suggestions`);
  }
});
