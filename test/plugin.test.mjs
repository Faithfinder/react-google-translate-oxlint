import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");

function lint(fixture) {
  try {
    execFileSync(
      oxlint,
      ["-c", "test/oxlintrc.json", `test/fixtures/${fixture}`],
      { cwd: root, encoding: "utf8" }
    );
    return "";
  } catch (error) {
    // oxlint exits non-zero when it reports errors; the report is on stdout.
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

const count = (output, needle) => output.split(needle).length - 1;

/**
 * Parse diagnostics into `{ rule, line, column, source }`, where `source` is the
 * fixture text from the reported position onward. Asserting on `source` is what
 * pins *which node* the rule blames, which is the point of most of these tests.
 */
function diagnostics(fixture) {
  const output = lint(fixture);
  const lines = readFileSync(
    join(root, "test", "fixtures", fixture),
    "utf8"
  ).split("\n");
  return [
    ...output.matchAll(
      /^\S+?:(\d+):(\d+): error react-google-translate\((.+?)\)/gm
    ),
  ].map(([, line, column, rule]) => ({
    rule,
    line: Number(line),
    column: Number(column),
    source: lines[Number(line) - 1].slice(Number(column) - 1),
  }));
}

const CONDITIONAL = "no-conditional-text-nodes-with-siblings";

test("flags every dangerous pattern in the bad fixture", () => {
  const output = lint("bad.tsx");
  assert.equal(count(output, CONDITIONAL), 6);
  assert.equal(count(output, "no-return-text-nodes"), 1);
});

test("reports nothing for the good fixture", () => {
  assert.equal(count(lint("good.tsx"), "react-google-translate("), 0);
});

test("blames the branch that contributes the text, not the empty string", () => {
  const found = diagnostics("bad.tsx");
  // `{val ? "foo" : ""}` — `''` renders nothing, so it can never be the node
  // React fails to remove. The hazard is `"foo"`.
  const onLine10 = found.filter((d) => d.line === 10);
  assert.equal(onLine10.length, 1);
  assert.ok(
    onLine10[0].source.startsWith('"foo"'),
    `expected the report on \`"foo"\`, got \`${onLine10[0].source}\``
  );
});

test("blames the fragment of bare text, not the empty string beside it", () => {
  const onLine19 = diagnostics("bad.tsx").filter((d) => d.line === 19);
  assert.equal(onLine19.length, 1);
  assert.ok(
    onLine19[0].source.startsWith("<>bare "),
    `expected the report on the fragment, got \`${onLine19[0].source}\``
  );
});

test("both-branches-text is exempt from H1 but not from H2", () => {
  // good.tsx has `{val ? "foo" : "bar"} <span/>` — clean, because React reuses
  // the single HostText fiber and only assigns nodeValue.
  assert.equal(count(lint("good.tsx"), "react-google-translate("), 0);

  // bad.tsx has the same expression preceded by `{val && <i/>}`, which can
  // mount and insertBefore against that very text node.
  const onLine34 = diagnostics("bad.tsx").filter((d) => d.line === 34);
  assert.equal(onLine34.length, 1);
  assert.ok(onLine34[0].source.startsWith('{val ? "foo" : "bar"}'));
});

test("map() through optional chaining is not a text node", () => {
  // Regression: `ChainExpression` used to be reported unconditionally, so
  // `items?.map(i => <li/>)` was flagged while `items.map(i => <li/>)` was not.
  const good = readFileSync(join(root, "test/fixtures/good.tsx"), "utf8");
  assert.ok(good.includes("val?.items?.map"), "fixture must cover the chain");
  assert.equal(count(lint("good.tsx"), CONDITIONAL), 0);
});
