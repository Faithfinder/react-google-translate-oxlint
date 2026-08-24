/**
 * A small RuleTester for oxlint JS plugins.
 *
 * oxlint ships no in-process rule runner, so each case becomes its own file and
 * the whole directory is linted in a single oxlint run — isolation per case
 * without paying process startup per case. Built-in categories are switched off
 * so an unused variable in a two-line case cannot masquerade as a parse error.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const oxlint = join(root, "node_modules", ".bin", "oxlint");
const plugin = join(root, "index.js");

const RULE = /^react-google-translate\((.+)\)$/;

export const CONDITIONAL = "no-conditional-text-nodes-with-siblings";
export const RETURN_TEXT = "no-return-text-nodes";

const OFF = {
  correctness: "off",
  suspicious: "off",
  pedantic: "off",
  style: "off",
  restriction: "off",
  nursery: "off",
  perf: "off",
};

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const fileNameFor = (testCase, index) =>
  `${String(index).padStart(3, "0")}-${slug(testCase.name)}.${testCase.ext ?? "tsx"}`;

const writeCases = (cases) => {
  const dir = mkdtempSync(join(tmpdir(), "rgt-cases-"));
  const names = cases.map(fileNameFor);
  cases.forEach((testCase, i) => {
    // Only trailing whitespace is trimmed: a case that opens with a newline keeps
    // it, so the line numbers a case asserts are the ones visible in its template.
    writeFileSync(join(dir, names[i]), `${testCase.code.replace(/\s+$/, "")}\n`);
  });
  // Per-case options ride in `overrides` so one config still covers every case.
  const overrides = cases.flatMap((testCase, i) =>
    testCase.options
      ? [
          {
            files: [names[i]],
            rules: {
              [`react-google-translate/${testCase.rule ?? CONDITIONAL}`]: [
                "error",
                testCase.options,
              ],
            },
          },
        ]
      : []
  );
  writeFileSync(
    join(dir, ".oxlintrc.json"),
    JSON.stringify(
      {
        plugins: [],
        categories: OFF,
        jsPlugins: [plugin],
        rules: {
          [`react-google-translate/${CONDITIONAL}`]: "error",
          [`react-google-translate/${RETURN_TEXT}`]: "error",
        },
        overrides,
      },
      null,
      2
    )
  );
  return { dir, names };
};

const runOxlint = (dir, extraArgs = []) => {
  try {
    return execFileSync(
      oxlint,
      ["-c", ".oxlintrc.json", "--format", "json", ...extraArgs, "."],
      { cwd: dir, encoding: "utf8" }
    );
  } catch (error) {
    // oxlint exits non-zero whenever it reports anything; the JSON is on stdout.
    return error.stdout ?? "";
  }
};

/**
 * Lints every case and returns, per case, the reports it produced as
 * `"<line>: <rule>"` strings plus anything that was not one of our rules —
 * a parse error in a case would otherwise silently read as "no reports".
 */
export function lintCases(cases) {
  const { dir, names } = writeCases(cases);
  try {
    const parsed = JSON.parse(runOxlint(dir));
    const byFile = new Map(names.map((name) => [name, { reports: [], other: [] }]));
    for (const diagnostic of parsed.diagnostics ?? []) {
      const file = (diagnostic.filename ?? "").split("/").pop();
      const bucket = byFile.get(file);
      if (!bucket) continue;
      const line = diagnostic.labels?.[0]?.span?.line;
      const rule = RULE.exec(diagnostic.code ?? "");
      if (rule) bucket.reports.push(`${line}: ${rule[1]}`);
      else bucket.other.push(`${line}: ${diagnostic.code} ${diagnostic.message}`);
    }
    return names.map((name) => {
      const bucket = byFile.get(name);
      return { reports: bucket.reports.toSorted(), other: bucket.other };
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Applies every rule suggestion and returns the resulting source per case, so a
 * fixer is asserted by the code it actually produces rather than by its shape.
 */
export function applySuggestions(cases) {
  const { dir, names } = writeCases(cases);
  try {
    runOxlint(dir, ["--fix-suggestions"]);
    return names.map((name) => readFileSync(join(dir, name), "utf8").trim());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
