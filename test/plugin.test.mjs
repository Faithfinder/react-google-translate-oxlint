import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");
const RULE = /^react-google-translate\((.+)\)$/;

// Reports are keyed by the source line they point at rather than by a count of
// matches in the human-readable output: a count is equally happy if a report
// disappears here and a new one shows up somewhere else.
function lint(fixture) {
  let stdout;
  try {
    stdout = execFileSync(
      oxlint,
      ["-c", "test/oxlintrc.json", "--format", "json", `test/fixtures/${fixture}`],
      { cwd: root, encoding: "utf8" }
    );
  } catch (error) {
    // oxlint exits non-zero whenever it reports anything; the JSON is on stdout.
    stdout = error.stdout ?? "";
  }
  const source = readFileSync(
    join(root, "test", "fixtures", fixture),
    "utf8"
  ).split("\n");
  const violations = [];
  const parseErrors = [];
  for (const diagnostic of JSON.parse(stdout).diagnostics) {
    const line = diagnostic.labels?.[0]?.span?.line;
    const rule = RULE.exec(diagnostic.code ?? "");
    if (rule) violations.push(`${rule[1]}  ${source[line - 1].trim()}`);
    else parseErrors.push(`line ${line}: ${diagnostic.message}`);
  }
  return { violations: violations.sort(), parseErrors };
}

const EXPECTED_BAD = [
  "no-conditional-text-nodes-with-siblings  {obj.count && \"\"}",
  "no-conditional-text-nodes-with-siblings  {symbol === \"%\" ? symbol : \"\"}",
  "no-conditional-text-nodes-with-siblings  {val && \"foo\"}",
  "no-conditional-text-nodes-with-siblings  {val ? \"foo\" : \"bar\"} <span>x</span>",
  "no-conditional-text-nodes-with-siblings  {val ? \"foo\" : \"bar\"} <span>x</span>",
  "no-conditional-text-nodes-with-siblings  {val ? <>bare {obj.name} text</> : \"\"}",
  "no-conditional-text-nodes-with-siblings  {val ? <>{obj.name}</> : \"\"}",
  "no-conditional-text-nodes-with-siblings  {val ? <b>x</b> : obj?.items?.map((i: any) => String(i))}",
  "no-conditional-text-nodes-with-siblings  {val ? <span>a</span> : <span>b</span>} tail",
  "no-conditional-text-nodes-with-siblings  {val ? obj.a : <span>b</span>} <span>y</span>",
  "no-return-text-nodes  export const StaleArrow = () => \"i am a bare text node\";",
  "no-return-text-nodes  return \"i am a bare text node\";",
  "no-return-text-nodes  return \"i am a bare text node\";",
  "no-return-text-nodes  return \"i am a bare text node\";",
];

// A fixture that fails to parse produces no rule reports at all, which the two
// tests below would happily read as success.
test("both fixtures parse", () => {
  for (const fixture of ["good.tsx", "bad.tsx"]) {
    assert.deepEqual(lint(fixture).parseErrors, [], `${fixture} failed to parse`);
  }
});

test("flags every dangerous pattern in the bad fixture", () => {
  assert.deepEqual(lint("bad.tsx").violations, EXPECTED_BAD);
});

test("reports nothing for the good fixture", () => {
  assert.deepEqual(lint("good.tsx").violations, []);
});

// `plugin.meta.version` is what oxlint reports; nothing keeps it in step with
// the published version except this.
test("the plugin reports the package version", async () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const { default: plugin } = await import(join(root, "index.js"));
  assert.equal(plugin.meta.version, pkg.version);
  assert.equal(plugin.meta.name, "react-google-translate");
});
