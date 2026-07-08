# oxlint-plugin-react-google-translate

An [oxlint](https://oxc.rs/docs/guide/usage/linter.html) plugin that flags JSX
patterns which crash React when the **Google Translate** browser extension is
active.

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
npm install --save-dev oxlint-plugin-react-google-translate
```

Requires oxlint with JS-plugin support (`>=1.0`).

## Usage

Register the plugin in `.oxlintrc.json` via `jsPlugins`, then enable the rules
(they live under the `react-google-translate/` namespace):

```json
{
  "jsPlugins": ["oxlint-plugin-react-google-translate"],
  "rules": {
    "react-google-translate/no-conditional-text-nodes-with-siblings": "error",
    "react-google-translate/no-return-text-nodes": "error"
  }
}
```

If your oxlint version doesn't resolve the bare package name, point `jsPlugins`
at the file directly:
`"./node_modules/oxlint-plugin-react-google-translate/index.js"`.

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

Flags a React component (a capitalized function declaration) that returns a bare
string or number. Under Translate this can strand a stale value after a
re-render, silently, with no error.

```jsx
// ❌ bad
function Label() {
  return "hello";
}

// ✅ good
function Label() {
  return <span>hello</span>;
}
```

## Difference from the ESLint plugin

The original uses TypeScript type information to detect text-returning
expressions (e.g. a variable typed as `string`, `value.toLocaleString()`).
oxlint's JS-plugin context has **no type-checker**, so those type-driven cases
are not detected here. The purely syntactic cases — string/number literals,
template literals, member and optional-chain expressions, `t()` / `formatMessage()`
calls, and static text after a conditional — are all still flagged.

## License

MIT © Maksym Dolynchuk. Ported from `eslint-plugin-react-google-translate`
(MIT, getcouped).
