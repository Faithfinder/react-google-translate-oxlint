# @faithfinder/oxlint-plugin-react-google-translate

An [oxlint](https://oxc.rs/docs/guide/usage/linter.html) plugin that flags JSX
patterns which crash React when the **Google Translate** browser extension is
active.

> A fork of [`oxlint-plugin-react-google-translate`](https://www.npmjs.com/package/oxlint-plugin-react-google-translate)
> by Maksym Dolynchuk, maintained while
> [upstream](https://github.com/dolynchuk/react-google-translate-oxlint) is
> inactive. It carries false-positive fixes, wider component coverage and
> suggested fixes — see [Changes from upstream](#changes-from-upstream) and the
> [changelog](CHANGELOG.md).

When translating a page, Google Translate rewrites the DOM — wrapping text nodes
in `<font>` elements. If React then removes or reorders a **conditionally
rendered text node that has siblings**, `removeChild` / `insertBefore` throws
`NotFoundError` and the app white-screens. This is the long-standing
[facebook/react#11538](https://github.com/facebook/react/issues/11538).

This is an oxlint port of the ESLint plugin
[`eslint-plugin-react-google-translate`](https://www.npmjs.com/package/eslint-plugin-react-google-translate)
by getcouped (MIT). It catches the problem at lint time so you never ship it.

> Complements the runtime fix in
> [`react-google-translate-shim`](https://www.npmjs.com/package/react-google-translate-shim):
> lint keeps new code clean, the shim recovers if a crash still happens.

## Install

Requires oxlint `>=1.47` (the oldest release that applies plugin suggestion
fixes) and Node `>=22.12`.

**This fork is not on the npm registry yet**, so install it from git. The
package resolves under its scoped name either way, so nothing else in your
config changes when it does land:

```sh
# a tag — recommended
pnpm add -D "github:Faithfinder/react-google-translate-oxlint#v0.4.0"

# or any commit
pnpm add -D "github:Faithfinder/react-google-translate-oxlint#<sha>"
```

Pin a tag or a commit SHA rather than a branch — a branch ref is refetched and
can move under you between installs. There is no build step, so the checkout is
used as-is.

Once published, the registry install will be:

```sh
pnpm add -D @faithfinder/oxlint-plugin-react-google-translate
```

## Usage

Register the plugin in `.oxlintrc.json` via `jsPlugins`, then enable the rules
(they live under the `react-google-translate/` namespace):

```json
{
  "jsPlugins": ["@faithfinder/oxlint-plugin-react-google-translate"],
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": "error",
    "react-google-translate/no-return-text-nodes": "error"
  }
}
```

If your oxlint version doesn't resolve the bare package name, point `jsPlugins`
at the file directly:
`"./node_modules/@faithfinder/oxlint-plugin-react-google-translate/index.js"`.

### Fixing violations

Both rules ship a **suggestion** that wraps the offending node in an element:

```sh
oxlint --fix-suggestions
```

It is a suggestion rather than a plain `--fix` because the wrapper adds a DOM
node, and CSS can notice that — `> *` selectors and flex/grid child counts both
see it. Review the diff. No suggestion is offered in a `.ts`/`.mts`/`.cts` file,
where JSX does not parse.

## Rules

Full documentation for each rule lives in [`docs/rules/`](docs/rules).

### [`no-conditional-text-nodes-with-siblings`](docs/rules/no-conditional-text-nodes-with-siblings.md)

Flags a conditionally rendered text node that sits alongside sibling nodes, and
static text preceded by a conditional sibling. Fragments count as parents just
as elements do.

```jsx
// ❌ bad — bare text in a conditional, with a sibling
<p>{val ? "foo" : "bar"} <span>x</span></p>
<p>{val && "foo"}<span>x</span></p>
// ❌ bad — a fragment parent is the same hazard
<>{val ? "foo" : "bar"}<span>x</span></>
// ❌ bad — static text preceded by a conditional sibling
<p>{val ? <span>a</span> : <span>b</span>} tail</p>

// ✅ good — wrap the conditional text in an element
<p>{val ? <span>foo</span> : <span>bar</span>} <span>x</span></p>
// ✅ good — no siblings, so it can't crash
<p>{val ? "foo" : "bar"}</p>
// ✅ good — a comment is dropped by the JSX transform, so it is not a sibling
<p>{val ? "foo" : "bar"}{/* a note */}</p>
```

**Options** — `textReturningFunctions` names the functions whose return value
renders as bare text rather than as an element. oxlint gives a JS plugin no type
information, so `foo()` could return a string or a `ReactElement` and the rule
cannot tell; this list is how you supply the answer.

Functions the **language** guarantees return strings are already built in and
need no configuration — `toLocaleString`, `toString`, `toFixed`, `toISOString`,
`join`, `String`, `trim` and friends. What you add here are your project's own:
translators (`t`, `formatMessage`) and formatters (`formatCurrency`, `humanize`),
whose names only your codebase knows. Names match the final identifier of the
callee, so `formatMessage` covers `intl.formatMessage(...)` as well as a bare
call. `wrapWith` (default `"span"`) picks the element the suggestion uses.

```json
{
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": [
      "error",
      { "textReturningFunctions": ["t", "formatMessage", "formatCurrency"] }
    ]
  }
}
```

### [`no-return-text-nodes`](docs/rules/no-return-text-nodes.md)

Flags a React component that returns bare text — a string, a number, or a call
that renders as one. Under Translate this can strand a stale value after a
re-render, silently, with no error.

A component is any capitalised function declaration, a capitalised binding
initialised with an arrow or function expression, anything wrapped in `memo(...)`
or `forwardRef(...)`, a default export that is a function, and a class
component's `render`.

```jsx
// ❌ bad
function Label() {
  return "hello";
}
const Label = () => "hello";
const Label = ({ val }) => (val ? "a" : "b");
export default memo(() => "hello");
// a default export needs no name to be a component
export default () => "hello";
export default function () {
  return "hello";
}
// with `textReturningFunctions: ["t"]` configured
const Label = ({ t }) => t("key");
// built in, so no configuration needed
const Label = ({ d }) => d.toLocaleString();
class Label extends React.Component {
  render() {
    return "hello";
  }
}

// ✅ good
const Label = () => <span>hello</span>;
// ✅ good — lowercase, so it is a helper rather than a component
const label = () => "hello";
```

**Options** — the same two the sibling rule takes. `textReturningFunctions`
names your project's text-returning helpers, so `const Label = () => t("key")` —
the commonest bare-text component in an i18n codebase — is reported; the
language's own stringifiers (`toLocaleString`, `toFixed`, `String`, …) are built
in and need no configuration. `wrapWith` (default `"span"`) picks the element the
suggestion uses.

```json
{
  "rules": {
    "react-google-translate/no-return-text-nodes": [
      "error",
      { "textReturningFunctions": ["t", "formatMessage"] }
    ]
  }
}
```

## Changes from upstream

### Fewer false positives

- **`{cond ? <El/> : ""}` is no longer reported.** `''` renders nothing — the
  reconciler's guard is `newChild !== ''` — so no text node exists to reparent.
  The `''` is still reported wherever the opposite branch might render text this
  plugin cannot identify, including `expr ?? ''` and `cond && ''`, where a falsy
  test such as `0` renders text of its own.
- **A JSX comment is no longer counted as a sibling.** `{cond ? "a" : "b"}{/* c */}`
  was reported, but the JSX transform drops the comment entirely — the conditional
  is the parent's only child, and React replaces a lone child's contents rather
  than reparenting a text node.
- **`{cond ? <El/> : items?.map((i) => <li key={i} />)}` is no longer reported.**
  Only the `?.` made it a `ChainExpression` and so a candidate; the callback
  demonstrably returns JSX. `items?.map(String)` is still reported.

### Wider coverage

- **Fragments are checked.** `no-conditional-text-nodes-with-siblings` required
  the enclosing JSX parent to be a `JSXElement`, so `<>{cond ? "a" : "b"}<span/></>`
  went unreported — while the element-parent form was caught.
- **Arrow-function components are checked.** `no-return-text-nodes` previously
  visited only `FunctionDeclaration`, so `const Foo = () => "text"` — the
  dominant component style — went entirely unchecked.
- **`memo`, `forwardRef` and class components are checked**, including nested
  `memo(forwardRef(...))` and anonymous `export default memo(...)`.
- **Conditional returns are checked.** `() => cond ? "a" : "b"` returns text down
  at least one path; only direct literals were recognised before.
- **Text-returning calls are checked in return position.** `no-return-text-nodes`
  recognised only literals, so `() => t("key")` and `() => d.toLocaleString()` —
  the same calls the sibling rule already flags in a conditional branch — went
  unreported. Both rules now take `textReturningFunctions`.
- **Anonymous default exports are checked.** `export default () => "text"` and
  `export default function () { … }` have no name to capitalise and no declarator
  to hang the check on, so both went unvisited — while the equally anonymous
  `export default memo(() => "text")` was already caught.
- **Text-returning calls are matched through a member callee**, so
  `intl.formatMessage({...})` — the shape react-intl hands you — is caught, where
  upstream only recognised a bare identifier. **Built-in stringifiers are flagged
  with no configuration** (`toLocaleString`, `toFixed`, `join`, `String`, …), and
  the arity check is gone, so a zero-argument `date.toLocaleString()` counts.
  Upstream's hardcoded `t` / `formatMessage` guess is replaced by
  `textReturningFunctions`, where a project names its own helpers.

### Tooling

- **Suggested fixes** on both rules, via `oxlint --fix-suggestions`.
- **Rule options**, per-rule docs pages, and TypeScript declarations.
- **Tests are per-pattern cases** asserting reports by position, rather than one
  golden list, and suggestions are asserted by the code they produce.
- **CI lints this repo with oxlint**, runs the suite against the floor and latest
  oxlint, and fails when published files change without a version bump.

## Difference from the ESLint plugin

The original uses TypeScript type information to detect text-returning
expressions (e.g. a variable typed as `string`, `value.toLocaleString()`).
oxlint *does* have type-aware linting via
[tsgolint](https://oxc.rs/docs/guide/usage/linter/type-aware.html), but it is
limited to built-in rules — a custom JS plugin's `context.sourceCode` exposes an
empty `parserServices`, so those type-driven cases cannot be detected here. The
purely syntactic cases — string/number literals, template literals, member and
optional-chain expressions, i18n calls, and static text after a conditional —
are all still flagged.

## Development

This repository uses [pnpm](https://pnpm.io) 11 — the version is pinned in
`packageManager`, so `corepack enable` gets you the right one. pnpm 11 needs
Node 22.13 or newer.

```sh
pnpm install
pnpm test        # rule cases + suggestion output
pnpm lint        # oxlint over this repo
pnpm typecheck   # tsc over index.d.ts and types/usage.ts
```

Rule tests live in [`test/rules.test.mjs`](test/rules.test.mjs) as isolated
cases. To add one, append a `{ name, code, errors }` entry — `errors` lists
`"<line>: <rule>"` for each expected report, with line numbers as written in the
case's own template. [`test/rule-tester.mjs`](test/rule-tester.mjs) writes every
case to its own file and lints them in a single oxlint run. When oxlint fails
before linting starts — a rejected rule option, a plugin that will not load — the
harness raises its stdout and stderr rather than a parse error from inside itself.

`index.d.ts` is hand-written, and [`types/usage.ts`](types/usage.ts) is the
consumer that compiles against it under `pnpm typecheck`. It is neither shipped
nor executed; it exists so a declaration that would break an `oxlint.config.ts`
user fails in CI.

## Releasing

Tag pushes drive the release workflow. Bump the version in `package.json` — the
plugin reads it from there, so there is nothing to keep in step — add a changelog
entry, then push a `v*` tag. CI fails a PR that changes published files
without a bump. Publishing to npm is skipped unless an `NPM_TOKEN` secret is
configured, so the tag alone is still a usable install ref.

## License

MIT © Maksym Dolynchuk, and contributors to this fork. Ported from
`eslint-plugin-react-google-translate` (MIT, getcouped).
