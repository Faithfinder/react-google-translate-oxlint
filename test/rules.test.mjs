import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONDITIONAL,
  RETURN_TEXT,
  applySuggestions,
  lintCases,
} from "./rule-tester.mjs";

/**
 * Each case is a standalone file, so a report is asserted against the line it
 * lands on within that case alone. Adding a pattern means adding a case, not
 * editing a shared list of every expectation in the suite.
 */
const cases = [
  /* ---------------------------------------------------------------- invalid */
  {
    name: "conditional text with an element sibling",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? "foo" : "bar"} <span>x</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`, `4: ${CONDITIONAL}`],
  },
  {
    name: "conditional text inside a fragment with siblings",
    code: `
export const A = ({ val }: any) => (
  <>
    {val ? "foo" : "bar"}
    <span>x</span>
  </>
);`,
    errors: [`4: ${CONDITIONAL}`, `4: ${CONDITIONAL}`],
  },
  {
    name: "logical-and text with a sibling",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val && "foo"}
    <span>x</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "static text preceded by a conditional sibling",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? <span>a</span> : <span>b</span>} tail
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "static text after a conditional inside a fragment",
    code: `
export const A = ({ val }: any) => (
  <>
    {val ? <span>a</span> : <span>b</span>} tail
  </>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "member expression branch with a sibling",
    code: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? obj.a : <span>b</span>} <span>y</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "template literal branch with a sibling",
    code: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? \`n=\${obj.n}\` : <span>b</span>}
    <span>y</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "fragment whose own bare text toggles",
    code: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? <>bare {obj.name} text</> : ""}
    <span>x</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "empty string opposite an unidentifiable branch",
    code: `
export const A = ({ symbol }: any) => (
  <p>
    {symbol === "%" ? symbol : ""}
    <input />
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "logical-and empty string with a renderable falsy test",
    code: `
export const A = ({ obj }: any) => (
  <p>
    {obj.count && ""}
    <span>x</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "fragment wrapping an expression container",
    code: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? <>{obj.name}</> : ""}
    <span>x</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "map callback returning strings",
    code: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? <b>x</b> : obj?.items?.map((i: any) => String(i))}
    <span>y</span>
  </p>
);`,
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "bare i18n helper call",
    code: `
export const A = ({ val, t }: any) => (
  <p>
    {val ? t("key") : <span>b</span>}
    <span>x</span>
  </p>
);`,
    options: { i18nFunctions: ["t"] },
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "namespaced i18n helper call",
    code: `
export const A = ({ val, intl }: any) => (
  <p>
    {val ? intl.formatMessage({ id: "a" }) : <span>b</span>}
    <span>x</span>
  </p>
);`,
    options: { i18nFunctions: ["formatMessage"] },
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "custom i18n helper via options",
    code: `
export const A = ({ val, i18n }: any) => (
  <p>
    {val ? i18n.translate("key") : <span>b</span>}
    <span>x</span>
  </p>
);`,
    options: { i18nFunctions: ["translate"] },
    errors: [`4: ${CONDITIONAL}`],
  },
  {
    name: "function declaration returning a string",
    code: `
export function Label() {
  return "text";
}`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "concise arrow returning a string",
    code: `export const Label = () => "text";`,
    errors: [`1: ${RETURN_TEXT}`],
  },
  {
    name: "arrow block returning a string",
    code: `
export const Label = () => {
  return "text";
};`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "function expression returning a string",
    code: `
export const Label = function () {
  return "text";
};`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "concise arrow returning a conditional of strings",
    code: `export const Label = ({ val }: any) => (val ? "a" : "b");`,
    errors: [`1: ${RETURN_TEXT}`],
  },
  {
    name: "block returning a conditional of strings",
    code: `
export const Label = ({ val }: any) => {
  return val ? "a" : "b";
};`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "block returning a logical-and string",
    code: `
export const Label = ({ val }: any) => {
  return val && "a";
};`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "memo-wrapped component returning a string",
    code: `
import { memo } from "react";
export const Label = memo(() => "text");`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "namespaced forwardRef component returning a string",
    code: `
import React from "react";
export const Label = React.forwardRef(() => "text");`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "anonymous default-exported memo component",
    code: `
import { memo } from "react";
export default memo(() => "text");`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "nested memo(forwardRef()) reports once",
    code: `
import { forwardRef, memo } from "react";
export default memo(forwardRef(() => "text"));`,
    errors: [`3: ${RETURN_TEXT}`],
  },
  {
    name: "class component render returning a string",
    code: `
import React from "react";
export class Label extends React.Component {
  render() {
    return "text";
  }
}`,
    errors: [`5: ${RETURN_TEXT}`],
  },
  {
    name: "class component render property returning a string",
    code: `
import React from "react";
export class Label extends React.Component {
  render = () => "text";
}`,
    errors: [`4: ${RETURN_TEXT}`],
  },

  /* ------------------------------------------------------------------ valid */
  {
    name: "conditional text with no siblings",
    code: `
export const A = ({ val }: any) => (
  <p>{val ? "foo" : "bar"}</p>
);`,
    errors: [],
  },
  {
    name: "conditional elements with an element sibling",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? <span>a</span> : <span>b</span>}
    <span>c</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "empty string opposite an element renders no text node",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? <b>{val}</b> : ""} <span>x</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "empty string opposite a fragment of elements",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? <><b>a</b><i>b</i></> : ""} <span>x</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "map callback returning elements",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? <b>x</b> : val?.items?.map((i: any) => <input key={i} />)}
    <span>y</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "flatMap block callback where every return is JSX",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val
      ? <b>x</b>
      : val?.items?.flatMap((i: any) => {
          if (i) return <input key={i} />;
          return <hr key={i} />;
        })}
    <span>y</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "the test of a conditional is evaluated, not rendered",
    code: `
export const A = ({ obj }: any) => (
  <p>
    {obj.flag ? <b>a</b> : <i>b</i>}
    <span>x</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "no i18n helper is assumed without options",
    code: `
export const A = ({ val, t, intl }: any) => (
  <p>
    {val ? t("key") : <span>b</span>}
    {val ? intl.formatMessage({ id: "a" }) : <span>c</span>}
    <span>x</span>
  </p>
);`,
    errors: [],
  },
  {
    name: "i18n helper not in the configured list",
    code: `
export const A = ({ val, i18n }: any) => (
  <p>
    {val ? i18n.translate("key") : <span>b</span>}
    <span>x</span>
  </p>
);`,
    options: { i18nFunctions: ["t", "formatMessage"] },
    errors: [],
  },
  {
    name: "lowercase helper is not a component",
    code: `export const label = () => "just a string";`,
    errors: [],
  },
  {
    name: "capitalised binding that is not a function",
    code: `export const Config = "some string";`,
    errors: [],
  },
  {
    name: "component returning an element",
    code: `export const Label = () => <span>text</span>;`,
    errors: [],
  },
  {
    name: "non-component class with a render method",
    code: `
export class helper {
  render() {
    return "text";
  }
}`,
    errors: [],
  },
];

const results = lintCases(cases);

for (const [i, testCase] of cases.entries()) {
  test(testCase.name, () => {
    assert.deepEqual(
      results[i].other,
      [],
      `case produced non-rule diagnostics (a parse error?): ${results[i].other.join("; ")}`
    );
    assert.deepEqual(results[i].reports, testCase.errors.toSorted());
  });
}

/* ------------------------------------------------------------- suggestions */

const suggestionCases = [
  {
    name: "wraps a conditional string branch",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? "foo" : "bar"} <span>x</span>
  </p>
);`,
    output: `
export const A = ({ val }: any) => (
  <p>
    {val ? <span>{"foo"}</span> : <span>{"bar"}</span>} <span>x</span>
  </p>
);`,
  },
  {
    name: "wraps static text without swallowing surrounding whitespace",
    code: `
export const A = ({ val }: any) => (
  <p>
    {val ? <b>a</b> : <i>b</i>} tail
  </p>
);`,
    output: `
export const A = ({ val }: any) => (
  <p>
    {val ? <b>a</b> : <i>b</i>} <span>tail</span>
  </p>
);`,
  },
  {
    name: "rewrites a fragment's delimiters rather than nesting it",
    code: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? <>bare {obj.name} text</> : ""}
    <span>x</span>
  </p>
);`,
    output: `
export const A = ({ val, obj }: any) => (
  <p>
    {val ? <span>bare {obj.name} text</span> : ""}
    <span>x</span>
  </p>
);`,
  },
  {
    name: "wraps a bare return value",
    code: `
export const Label = () => {
  return "text";
};`,
    output: `
export const Label = () => {
  return <span>{"text"}</span>;
};`,
  },
  {
    name: "wraps a concise arrow body",
    code: `export const Label = () => "text";`,
    output: `export const Label = () => <span>{"text"}</span>;`,
  },
  {
    name: "honours the wrapWith option",
    code: `export const Label = () => "text";`,
    rule: RETURN_TEXT,
    options: { wrapWith: "div" },
    output: `export const Label = () => <div>{"text"}</div>;`,
  },
  {
    name: "offers no JSX wrapper in a .ts file",
    ext: "ts",
    code: `export const Label = () => "text";`,
    output: `export const Label = () => "text";`,
  },
];

const fixed = applySuggestions(suggestionCases);

for (const [i, testCase] of suggestionCases.entries()) {
  test(`suggestion: ${testCase.name}`, () => {
    assert.equal(fixed[i], testCase.output.trim());
  });
}
