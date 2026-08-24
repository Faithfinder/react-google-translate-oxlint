# @faithfinder/oxlint-plugin-react-google-translate

An [oxlint](https://oxc.rs/docs/guide/usage/linter.html) plugin that flags JSX
patterns which crash React when the **Google Translate** browser extension is
active.

> A fork of [`oxlint-plugin-react-google-translate`](https://www.npmjs.com/package/oxlint-plugin-react-google-translate)
> by Maksym Dolynchuk, published while
> [upstream](https://github.com/dolynchuk/react-google-translate-oxlint) is
> inactive. It carries several false-positive fixes and wider component
> coverage — see [Changes from upstream](#changes-from-upstream).

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

```sh
pnpm add -D @faithfinder/oxlint-plugin-react-google-translate
```

Requires oxlint with JS-plugin support (`>=1.0`).

### Installing from git

The package also installs straight from this repository, which needs no registry
account and resolves under the same name, so the `jsPlugins` entry below is
unchanged:

```sh
# a tag, once one is pushed
pnpm add -D "github:Faithfinder/react-google-translate-oxlint#v0.2.0"

# or any commit
pnpm add -D "github:Faithfinder/react-google-translate-oxlint#<sha>"
```

Pin a tag or a commit SHA rather than a branch — a branch ref is refetched and
can move under you between installs. There is no build step, so the checkout is
used as-is, and the package resolves under the same scoped name either way.

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

## Rules

### `no-conditional-text-nodes-with-siblings`

Flags a conditionally rendered text node that sits alongside sibling nodes, and
static text preceded by a conditional sibling.

```jsx
// ❌ bad — bare text in a conditional, with a sibling
<p>{val ? "foo" : "bar"} <span>x</span></p>
<p>{val && "foo"}<span>x</span></p>
// ❌ bad — static text preceded by a conditional sibling
<p>{val ? <span>a</span> : <span>b</span>} tail</p>

// ✅ good — wrap the conditional text in an element
<p>{val ? <span>foo</span> : <span>bar</span>} <span>x</span></p>
// ✅ good — no siblings, so it can't crash
<p>{val ? "foo" : "bar"}</p>
```

### `no-return-text-nodes`

Flags a React component that returns a bare string or number. Under Translate
this can strand a stale value after a re-render, silently, with no error.

A component is any capitalised function declaration, or a capitalised binding
initialised with an arrow function or function expression.

```jsx
// ❌ bad
function Label() {
  return "hello";
}
const Label = () => "hello";
const Label = () => {
  return "hello";
};

// ✅ good
const Label = () => <span>hello</span>;
// ✅ good — lowercase, so it is a helper rather than a component
const label = () => "hello";
```

## Changes from upstream

- **`{cond ? <El/> : ""}` is no longer reported.** `''` renders nothing — the
  reconciler's guard is `newChild !== ''` — so no text node exists to reparent.
  The `''` is still reported wherever the opposite branch might render text this
  plugin cannot identify, including `expr ?? ''` and `cond && ''`, where a falsy
  test such as `0` renders text of its own.
- **`{cond ? <El/> : items?.map((i) => <li key={i} />)}` is no longer reported.**
  Only the `?.` made it a `ChainExpression` and so a candidate; the callback
  demonstrably returns JSX. `items?.map(String)` is still reported.
- **Arrow-function components are checked.** `no-return-text-nodes` previously
  visited only `FunctionDeclaration`, so `const Foo = () => "text"` — the
  dominant component style — went entirely unchecked.
- **Tests assert positions, not counts**, and fail when a fixture stops parsing.

## Difference from the ESLint plugin

The original uses TypeScript type information to detect text-returning
expressions (e.g. a variable typed as `string`, `value.toLocaleString()`).
oxlint *does* have type-aware linting via
[tsgolint](https://oxc.rs/docs/guide/usage/linter/type-aware.html), but it is
limited to built-in rules — a custom JS plugin's `context` exposes no
`parserServices`, so those type-driven cases cannot be detected here. The purely
syntactic cases — string/number literals, template literals, member and
optional-chain expressions, `t()` / `formatMessage()` calls, and static text
after a conditional — are all still flagged.

## Development

This repository uses [pnpm](https://pnpm.io) 11 — the version is pinned in
`packageManager`, so `corepack enable` gets you the right one.

```sh
pnpm install
pnpm test
```

## License

MIT © Maksym Dolynchuk, and contributors to this fork. Ported from
`eslint-plugin-react-google-translate` (MIT, getcouped).
