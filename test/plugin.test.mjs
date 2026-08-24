import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");

function lint(fixture) {
  try {
    execFileSync(oxlint, ["-c", "test/oxlintrc.json", `test/fixtures/${fixture}`], {
      cwd: root,
      encoding: "utf8",
    });
    return "";
  } catch (error) {
    // oxlint exits non-zero when it reports errors; the report is on stdout.
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

const count = (output, needle) => output.split(needle).length - 1;

test("flags every dangerous pattern in the bad fixture", () => {
  const output = lint("bad.tsx");
  assert.equal(count(output, "no-conditional-text-nodes-with-siblings"), 10);
  assert.equal(count(output, "no-return-text-nodes"), 1);
});

test("reports nothing for the good fixture", () => {
  const output = lint("good.tsx");
  assert.equal(count(output, "react-google-translate("), 0);
});
